'use client';

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from '@nso/routerShim';
import { Field } from '@nso/components/Field';
import { findReportByToken, saveReport } from '@nso/lib/localStore';
import { getPublicStoreByToken, subscribeReportByToken, remoteDb, upsertRemoteReport } from '@nso/lib/remoteStore';
import { syncCrewDependentRows } from '@nso/lib/reportDefaults';
import { DEFAULT_PRODUCT_MASTER } from '@nso/lib/productMaster';
import { LeftoverProductLine, ProductMasterItem, ReportData } from '@nso/lib/types';
import { uid } from '@nso/lib/normalize';

function productDisplay(item: ProductMasterItem) {
  return `${item.category} - ${item.name}${item.article ? ` (${item.article})` : ''}`;
}

function SimpleProductPicker({ master, value, onPick }: { master: ProductMasterItem[]; value: string; onPick: (item: ProductMasterItem | null, typedValue: string) => void }) {
  const [query, setQuery] = useState(value);
  useEffect(() => setQuery(value), [value]);
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return master.slice(0, 12);
    return master.filter((item) => [item.category, item.article, item.name].join(' ').toLowerCase().includes(q)).slice(0, 12);
  }, [query, master]);

  return (
    <div className="product-search-select leftover-product-picker">
      <div className="product-search-row">
        <span aria-hidden="true">⌕</span>
        <input
          value={query}
          placeholder="Ketik nama produk / artikel"
          onChange={(event) => setQuery(event.target.value)}
          onBlur={() => onPick(null, query)}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onPick(null, query);
              event.currentTarget.blur();
            }
          }}
        />
      </div>
      {suggestions.length ? (
        <div className="product-suggestion-list">
          {suggestions.map((item) => (
            <button type="button" key={item.id} onClick={() => { setQuery(item.name); onPick(item, item.name); }}>{productDisplay(item)}</button>
          ))}
        </div>
      ) : <small className="product-search-empty">Produk tidak ditemukan, tetap bisa input manual.</small>}
    </div>
  );
}

export default function LeftoverProductPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [report, setReport] = useState<ReportData | null>(null);
  const [status, setStatus] = useState('Loading halaman sisa produk...');
  const lastSnapshotRef = useRef('');

  async function load(fromRealtime = false) {
    let loaded: ReportData | null = null;
    try { loaded = await getPublicStoreByToken(token); } catch { /* local fallback */ }
    loaded = loaded ?? findReportByToken(token);
    const synced = loaded ? syncCrewDependentRows(loaded) : null;
    setReport(synced);
    lastSnapshotRef.current = synced ? JSON.stringify(synced) : '';
    setStatus(synced ? (fromRealtime ? 'Data realtime terupdate dari Firebase.' : 'Input sisa produk siap.') : 'Link sisa produk tidak valid atau database Firebase belum aktif.');
  }

  useEffect(() => {
    load();
    const unsubscribe = subscribeReportByToken(token, () => load(true));
    return unsubscribe;
  }, [token]);

  useEffect(() => {
    if (!report) return;
    const snapshot = JSON.stringify(report);
    if (!lastSnapshotRef.current || snapshot === lastSnapshotRef.current) return;
    const timeout = window.setTimeout(async () => {
      const synced = syncCrewDependentRows({ ...report, updatedAt: new Date().toISOString() });
      try {
        if (remoteDb) await upsertRemoteReport(synced);
        else saveReport(synced);
        lastSnapshotRef.current = JSON.stringify(synced);
        setStatus('Autosaved realtime ke dashboard fasilitator.');
      } catch {
        saveReport(synced);
        lastSnapshotRef.current = JSON.stringify(synced);
        setStatus('Autosaved lokal. Firebase belum aktif / tidak bisa diakses.');
      }
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [report]);

  function patch(next: (current: ReportData) => ReportData) {
    setReport((current) => current ? syncCrewDependentRows(next(current)) : current);
  }

  const productMaster = report?.productMaster?.length ? report.productMaster : DEFAULT_PRODUCT_MASTER;

  function updateLine(id: string, patchLine: Partial<LeftoverProductLine>) {
    patch((current) => ({
      ...current,
      leftoverProducts: (current.leftoverProducts ?? []).map((item) => item.id === id ? { ...item, ...patchLine, updatedAt: new Date().toISOString(), source: 'crew' } : item)
    }));
  }

  function addLine() {
    const first = productMaster[0];
    patch((current) => ({
      ...current,
      leftoverProducts: [
        ...(current.leftoverProducts ?? []),
        {
          id: uid('leftover'),
          product: first?.name ?? '',
          article: first?.article ?? '',
          category: first?.category ?? 'Kitchen',
          qty: 1,
          source: 'crew',
          updatedAt: new Date().toISOString()
        }
      ]
    }));
  }

  function deleteLine(id: string) {
    const ok = confirm('Hapus item sisa produk ini?');
    if (!ok) return;
    patch((current) => ({ ...current, leftoverProducts: (current.leftoverProducts ?? []).filter((item) => item.id !== id) }));
  }

  if (!report) {
    return <main className="audience-shell checklist-shell"><section className="audience-card"><p>{status}</p></section></main>;
  }

  if (!report.leftoverInputEnabled) {
    return (
      <main className="audience-shell checklist-shell">
        <section className="audience-card timer-empty">
          <p className="eyebrow">Sisa Produk</p>
          <h1>{report.storeName}</h1>
          <div className="empty-simulation readable-empty">Halaman ini belum diaktifkan Fasilitator</div>
        </section>
      </main>
    );
  }

  return (
    <main className="audience-shell checklist-shell">
      <section className="audience-card checklist-card-full leftover-input-card">
        <div className="section-header checklist-header">
          <div>
            <p className="eyebrow">Input Sisa Produk</p>
            <h1>{report.storeName}</h1>
            <p className="notice">{status}</p>
          </div>
          <button type="button" className="btn blue no-print" onClick={() => window.print()}>Print File</button>
        </div>
        <div className="leftover-editor-list">
          {(report.leftoverProducts ?? []).map((item) => (
            <div className="leftover-edit-row simple-leftover-row" key={item.id}>
              <SimpleProductPicker
                master={productMaster}
                value={item.product}
                onPick={(picked, typedValue) => updateLine(item.id, picked ? { product: picked.name, article: picked.article, category: picked.category } : { product: typedValue })}
              />
              <div className="leftover-inline-data">
                <b className="leftover-product-name">{item.product || 'Pilih produk'}</b>
                <input
                  aria-label="Qty sisa"
                  value={String(item.qty ?? '')}
                  inputMode="numeric"
                  onChange={(event) => updateLine(item.id, { qty: Math.max(0, Number(event.target.value.replace(/\D/g, '') || 0)) })}
                />
                <button type="button" className="btn danger icon-only-delete" aria-label="Hapus" onClick={() => deleteLine(item.id)}>×</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn green full-btn no-print" onClick={addLine}>Tambah Produk Sisa</button>
      </section>
    </main>
  );
}
