'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { NsoLink as Link } from '@nso/routerShim';
import { useParams } from '@nso/routerShim';
import { AppHeader } from '@nso/components/AppHeader';
import { Field } from '@nso/components/Field';
import { getReport, saveReport } from '@nso/lib/localStore';
import { convex, loadRemoteReport, subscribeReport, upsertRemoteReport } from '@nso/lib/remoteStore';
import { syncCrewDependentRows } from '@nso/lib/reportDefaults';
import { MACHINE_STATUSES, READINESS_ACTIONS } from '@nso/lib/preparationChecklist';
import { ReadinessItem, ReportData } from '@nso/lib/types';
import { uid } from '@nso/lib/normalize';

const AREA_OPTIONS = ['Equipment', 'Beverage', 'Kitchen', 'Tools', 'Raw Material', 'Other'];
const SECTION_OPTIONS = ['Cashier', 'Beverage', 'Kitchen', 'Rawmat', 'Supplies', 'Tools', 'Layout', 'Cleaning'];

function countByArea(items: ReadinessItem[]) {
  const map = new Map<string, number>();
  items.forEach((item) => map.set(item.area || 'Other', (map.get(item.area || 'Other') ?? 0) + 1));
  return Array.from(map.entries()).map(([area, count]) => ({ area, count }));
}

function makeChecklistItem(area = 'Kitchen', section = 'Rawmat'): ReadinessItem {
  return {
    id: uid('ready_custom'),
    area,
    section,
    name: '',
    qty: '1',
    checked: false,
    status: 'Pending',
    action: '',
    note: ''
  };
}

export default function FacilitatorChecklistSettingsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [report, setReport] = useState<ReportData | null>(null);
  const [status, setStatus] = useState('Loading setting checklist...');
  const [activeArea, setActiveArea] = useState('Equipment');
  const lastSnapshotRef = useRef('');
  const dirtyUntilRef = useRef(0);
  const skipAutosaveRef = useRef(false);

  async function load(fromRealtime = false) {
    if (fromRealtime && Date.now() < dirtyUntilRef.current) return;
    let loaded: ReportData | null = null;
    try { loaded = await loadRemoteReport(id); } catch { /* local fallback */ }
    loaded = loaded ?? getReport(id);
    if (!loaded) {
      setStatus('Data NSO tidak ditemukan.');
      return;
    }
    const synced = syncCrewDependentRows(loaded);
    skipAutosaveRef.current = true;
    lastSnapshotRef.current = JSON.stringify(synced);
    setReport(synced);
    setStatus(fromRealtime ? 'Data checklist realtime terupdate.' : 'Setting checklist siap.');
  }

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    const unsub = subscribeReport(id, () => load(true));
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!report) return;
    const snapshot = JSON.stringify(report);
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      lastSnapshotRef.current = snapshot;
      return;
    }
    if (snapshot === lastSnapshotRef.current) return;
    const timeout = window.setTimeout(async () => {
      const synced = syncCrewDependentRows({ ...report, updatedAt: new Date().toISOString() });
      try {
        if (convex) await upsertRemoteReport(synced);
        else saveReport(synced);
        setStatus(convex ? 'Autosaved ke Firebase.' : 'Autosaved lokal.');
      } catch {
        saveReport(synced);
        setStatus('Autosaved lokal. Database belum aktif / tidak bisa diakses.');
      }
      lastSnapshotRef.current = JSON.stringify(synced);
      dirtyUntilRef.current = Date.now() + 700;
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [report]);

  function patch(next: (current: ReportData) => ReportData) {
    dirtyUntilRef.current = Date.now() + 2200;
    setReport((current) => current ? syncCrewDependentRows(next(current)) : current);
  }

  function updateItem(itemId: string, patchItem: Partial<ReadinessItem>) {
    patch((current) => ({
      ...current,
      readinessChecklist: (current.readinessChecklist ?? []).map((item) => item.id === itemId ? { ...item, ...patchItem } : item)
    }));
  }

  function deleteItem(itemId: string) {
    if (!confirm('Hapus item checklist ini?')) return;
    patch((current) => ({
      ...current,
      readinessChecklist: (current.readinessChecklist ?? []).filter((item) => item.id !== itemId)
    }));
  }

  function addItem() {
    patch((current) => ({
      ...current,
      readinessChecklist: [...(current.readinessChecklist ?? []), makeChecklistItem(activeArea, SECTION_OPTIONS[0])]
    }));
  }

  const areaCounts = useMemo(() => countByArea(report?.readinessChecklist ?? []), [report?.readinessChecklist]);
  const visibleItems = useMemo(() => (report?.readinessChecklist ?? []).filter((item) => item.area === activeArea), [report?.readinessChecklist, activeArea]);

  if (!report) {
    return <main className="app-shell"><AppHeader /><div className="container"><section className="card"><p>{status}</p><Link href="/facilitator">Kembali</Link></section></div></main>;
  }

  return (
    <main className="app-shell checklist-admin-page">
      <AppHeader title={`Setting Checklist - ${report.storeName}`} />
      <div className="container">
        <section className="card section-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Halaman Khusus Fasilitator</p>
              <h1>Tambah Item / Set Qty Produk Checklist NSO</h1>
              <p className="muted">{status}</p>
            </div>
            <div className="actions icon-action-row">
              <Link className="icon-btn secondary" href={`/facilitator/${report.id}?section=summary`}><span>←</span><b>Back Summary</b></Link>
              <button className="icon-btn green" type="button" onClick={() => patch((r) => ({ ...r, readinessChecklistEnabled: !r.readinessChecklistEnabled }))}>
                <span>{report.readinessChecklistEnabled ? '✓' : '○'}</span><b>{report.readinessChecklistEnabled ? 'Link Aktif' : 'Aktifkan Link'}</b>
              </button>
            </div>
          </div>
          <div className="checklist-admin-area-tabs">
            {AREA_OPTIONS.map((area) => {
              const count = areaCounts.find((item) => item.area === area)?.count ?? 0;
              return <button key={area} type="button" className={activeArea === area ? 'active' : ''} onClick={() => setActiveArea(area)}><b>{area}</b><span>{count} item</span></button>;
            })}
          </div>
          <div className="actions" style={{ margin: '12px 0' }}>
            <button className="btn green" type="button" onClick={addItem}>+ Tambah Item Area {activeArea}</button>
          </div>
          <div className="checklist-admin-list">
            {visibleItems.length === 0 ? <p className="notice">Belum ada item di area ini. Klik Tambah Item untuk membuat data.</p> : null}
            {visibleItems.map((item, index) => (
              <div className="checklist-admin-row" key={item.id}>
                <div className="row-number">{index + 1}</div>
                <Field label="Area">
                  <select value={item.area} onChange={(event) => updateItem(item.id, { area: event.target.value })}>
                    {AREA_OPTIONS.map((area) => <option key={area}>{area}</option>)}
                  </select>
                </Field>
                <Field label="Section">
                  <select value={item.section} onChange={(event) => updateItem(item.id, { section: event.target.value })}>
                    {SECTION_OPTIONS.map((section) => <option key={section}>{section}</option>)}
                  </select>
                </Field>
                <Field label="Nama Produk / Item"><input value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} /></Field>
                <Field label="Qty"><input value={item.qty} onChange={(event) => updateItem(item.id, { qty: event.target.value })} /></Field>
                <Field label="Status Mesin / Item">
                  <select value={item.status} onChange={(event) => updateItem(item.id, { status: event.target.value as ReadinessItem['status'] })}>
                    {MACHINE_STATUSES.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </Field>
                <Field label="Default Action">
                  <select value={item.action} onChange={(event) => updateItem(item.id, { action: event.target.value })}>
                    <option value="">-</option>
                    {READINESS_ACTIONS.map((action) => <option key={action}>{action}</option>)}
                  </select>
                </Field>
                <button className="icon-btn danger small-icon" type="button" onClick={() => deleteItem(item.id)}><span>DEL</span><b>Hapus</b></button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
