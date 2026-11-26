'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from '@nso/routerShim';
import { findReportByToken, saveReport } from '@nso/lib/localStore';
import { getPublicStoreByToken, subscribeReportByToken, remoteDb, upsertRemoteReport } from '@nso/lib/remoteStore';
import { syncCrewDependentRows } from '@nso/lib/reportDefaults';
import { READINESS_ACTIONS, MACHINE_STATUSES } from '@nso/lib/preparationChecklist';
import { ReadinessItem, ReportData } from '@nso/lib/types';

function isReady(item: ReadinessItem) {
  return item.checked || item.status === 'OK';
}

function issueLabel(item: ReadinessItem) {
  const status = item.checked ? 'OK' : (item.status || 'Pending');
  return `${item.name} | Qty: ${item.qty || '-'} | Status: ${status}`;
}

function numbered(lines: string[]) {
  return lines.length ? lines.map((line, index) => `${index + 1}. ${line}`).join('\n') : '-';
}

function applyReadinessToSummary(report: ReportData): ReportData {
  const items = report.readinessChecklist ?? [];
  const issues = items.filter((item) => !isReady(item));
  const equipment = issues.filter((item) => item.area === 'Equipment').map(issueLabel);
  const tools = issues.filter((item) => item.section === 'Tools').map(issueLabel);
  const rawmat = issues.filter((item) => item.section === 'Rawmat' || item.section === 'Supplies').map(issueLabel);
  const correction = issues.length ? 'Rekomendasi STO/Order/Reservasi Order/Pembelian Pettycash' : '-';
  return {
    ...report,
    summaryItems: report.summaryItems.map((item) => {
      if (item.jenis === 'Equipments') return { ...item, keterangan: numbered(equipment), koreksi: equipment.length ? correction : '-' };
      if (item.jenis === 'Tools') return { ...item, keterangan: numbered(tools), koreksi: tools.length ? correction : '-' };
      if (item.jenis === 'Raw Material') return { ...item, keterangan: numbered(rawmat), koreksi: rawmat.length ? correction : '-' };
      return item;
    })
  };
}

function groupItems(items: ReadinessItem[]) {
  const map = new Map<string, ReadinessItem[]>();
  items.forEach((item) => {
    const key = `${item.area} - ${item.section}`;
    map.set(key, [...(map.get(key) ?? []), item]);
  });
  return Array.from(map.entries());
}

function areaLabel(key: string) {
  return key.split(' - ')[0] || key;
}

type ReadinessRowProps = {
  item: ReadinessItem;
  onUpdate: (itemId: string, patchItem: Partial<ReadinessItem>) => void;
};

const ReadinessRow = memo(function ReadinessRow({ item, onUpdate }: ReadinessRowProps) {
  const ready = isReady(item);

  return (
    <div className={`readiness-row ${ready ? 'ready' : 'not-ready'}`}>
      <label className="readiness-check">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={(event) => onUpdate(item.id, { checked: event.target.checked, status: event.target.checked ? 'OK' : item.status })}
        />
        <span>{item.name}</span>
        <small>{item.qty}</small>
      </label>
      {item.area === 'Equipment' ? (
        <select value={item.status} onChange={(event) => onUpdate(item.id, { status: event.target.value as ReadinessItem['status'], checked: event.target.value === 'OK' })}>
          {MACHINE_STATUSES.map((status) => <option key={status}>{status}</option>)}
        </select>
      ) : (
        <span className={ready ? 'status-pill live' : 'status-pill'}>{ready ? 'OK' : 'Belum Checklist'}</span>
      )}
      {!ready ? (
        <select required value={item.action} onChange={(event) => onUpdate(item.id, { action: event.target.value })}>
          <option value="">Pilih tindak lanjut</option>
          {READINESS_ACTIONS.map((action) => <option key={action}>{action}</option>)}
        </select>
      ) : <span className="status-pill live">Ready</span>}
      <input value={item.note} placeholder="Catatan" onChange={(event) => onUpdate(item.id, { note: event.target.value })} />
    </div>
  );
});

export default function StoreReadinessChecklistPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [report, setReport] = useState<ReportData | null>(null);
  const [status, setStatus] = useState('Loading checklist kesiapan NSO...');
  const [activeArea, setActiveArea] = useState('');
  const lastSnapshotRef = useRef('');
  const latestReportRef = useRef<ReportData | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const ignoreRealtimeUntilRef = useRef(0);

  const persistLatest = useCallback(async () => {
    const current = latestReportRef.current;
    if (!current) return;

    const synced = syncCrewDependentRows(applyReadinessToSummary({ ...current, updatedAt: new Date().toISOString() }));
    const snapshot = JSON.stringify(synced);
    if (snapshot === lastSnapshotRef.current) return;

    ignoreRealtimeUntilRef.current = Date.now() + 2500;
    try {
      if (remoteDb) await upsertRemoteReport(synced);
      else saveReport(synced);
      latestReportRef.current = synced;
      lastSnapshotRef.current = snapshot;
      setStatus('Tersimpan ke dashboard fasilitator.');
    } catch {
      saveReport(synced);
      latestReportRef.current = synced;
      lastSnapshotRef.current = snapshot;
      setStatus('Tersimpan lokal. Firebase belum aktif / tidak bisa diakses.');
    }
  }, []);

  const scheduleSave = useCallback((nextReport: ReportData) => {
    latestReportRef.current = nextReport;
    ignoreRealtimeUntilRef.current = Date.now() + 2500;
    setStatus('Menyimpan perubahan...');
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void persistLatest();
    }, 320);
  }, [persistLatest]);

  const load = useCallback(async (fromRealtime = false) => {
    if (fromRealtime && Date.now() < ignoreRealtimeUntilRef.current) return;

    let loaded: ReportData | null = null;
    try { loaded = await getPublicStoreByToken(token); } catch { /* local fallback */ }
    if (fromRealtime && Date.now() < ignoreRealtimeUntilRef.current) return;

    loaded = loaded ?? findReportByToken(token);
    const synced = loaded ? syncCrewDependentRows(loaded) : null;
    latestReportRef.current = synced;
    lastSnapshotRef.current = synced ? JSON.stringify(synced) : '';
    setReport(synced);
    setStatus(synced ? (fromRealtime ? 'Checklist realtime terupdate dari Firebase.' : 'Checklist siap diisi.') : 'Link checklist tidak valid atau database Firebase belum aktif.');
  }, [token]);

  useEffect(() => {
    void load();
    const unsubscribe = subscribeReportByToken(token, () => void load(true));
    return unsubscribe;
  }, [load, token]);

  useEffect(() => {
    const flushLocalDraft = () => {
      const current = latestReportRef.current;
      if (!current) return;
      saveReport(syncCrewDependentRows(applyReadinessToSummary({ ...current, updatedAt: new Date().toISOString() })));
    };
    window.addEventListener('pagehide', flushLocalDraft);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      flushLocalDraft();
      window.removeEventListener('pagehide', flushLocalDraft);
    };
  }, []);

  const patch = useCallback((next: (current: ReportData) => ReportData) => {
    const current = latestReportRef.current;
    if (!current) return;
    const nextReport = syncCrewDependentRows(next(current));
    latestReportRef.current = nextReport;
    setReport(nextReport);
    scheduleSave(nextReport);
  }, [scheduleSave]);

  const updateItem = useCallback((itemId: string, patchItem: Partial<ReadinessItem>) => {
    patch((current) => ({
      ...current,
      readinessChecklist: (current.readinessChecklist ?? []).map((item) => item.id === itemId ? { ...item, ...patchItem } : item)
    }));
  }, [patch]);

  const grouped = useMemo(() => groupItems(report?.readinessChecklist ?? []), [report?.readinessChecklist]);
  const areas = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    (report?.readinessChecklist ?? []).forEach((item) => {
      const key = item.area || 'Lainnya';
      const current = map.get(key) ?? { total: 0, done: 0 };
      map.set(key, { total: current.total + 1, done: current.done + (isReady(item) ? 1 : 0) });
    });
    return Array.from(map.entries()).map(([area, stats]) => ({ area, ...stats }));
  }, [report?.readinessChecklist]);
  const summary = useMemo(() => {
    const items = report?.readinessChecklist ?? [];
    const done = items.filter(isReady).length;
    return { total: items.length, done, pending: items.length - done };
  }, [report?.readinessChecklist]);

  useEffect(() => {
    if (!activeArea && areas.length) setActiveArea(areas[0].area);
    if (activeArea && areas.length && !areas.some((item) => item.area === activeArea)) setActiveArea(areas[0].area);
  }, [areas, activeArea]);

  const visibleGroups = grouped.filter(([group]) => !activeArea || areaLabel(group) === activeArea);

  if (!report) {
    return <main className="audience-shell checklist-shell"><section className="audience-card"><p>{status}</p></section></main>;
  }

  if (!report.readinessChecklistEnabled) {
    return (
      <main className="audience-shell checklist-shell">
        <section className="audience-card checklist-off-card">
          <div className="success-animation"><span>NSO</span><i>FamilyMart</i></div>
          <p className="eyebrow">Checklist Kesiapan NSO</p>
          <h1>{report.storeName}</h1>
          <h2>Halaman checklist belum diaktifkan Fasilitator.</h2>
          <p className="muted">Silakan hubungi fasilitator untuk mengaktifkan link checklist store.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="audience-shell checklist-shell">
      <section className="audience-card checklist-card-full">
        <div className="section-header checklist-header">
          <div>
            <p className="eyebrow">Checklist Kesiapan NSO</p>
            <h1>{report.storeName}</h1>
            <p className="notice checklist-status-line">{status}</p>
          </div>
          <button className="btn blue no-print" type="button" onClick={() => window.print()}>Print PDF</button>
        </div>

        <div className="checklist-score checklist-score-4">
          <div><span>Status Realtime</span><b>{status.includes('Menyimpan') ? 'SYNC' : 'LIVE'}</b></div>
          <div><span>Total Item</span><b>{summary.total}</b></div>
          <div><span>Checklist / OK</span><b>{summary.done}</b></div>
          <div><span>Perlu Tindak Lanjut</span><b>{summary.pending}</b></div>
        </div>

        <div className="checklist-area-actions no-print">
          {areas.map((area) => (
            <button key={area.area} type="button" className={activeArea === area.area ? 'active' : ''} onClick={() => setActiveArea(area.area)}>
              <b>{area.area}</b><span>{area.done}/{area.total} OK</span>
            </button>
          ))}
        </div>

        <div className="readiness-group-list printable-readiness-list">
          {visibleGroups.map(([group, items]) => (
            <details className="readiness-group" key={group} open>
              <summary><b>{group}</b><span>{items.filter(isReady).length}/{items.length} OK</span></summary>
              <div className="readiness-table">
                {items.map((item) => <ReadinessRow key={item.id} item={item} onUpdate={updateItem} />)}
              </div>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
