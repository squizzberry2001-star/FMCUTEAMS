'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { NsoLink as Link } from '@nso/routerShim';
import { useParams } from '@nso/routerShim';
import { AppHeader } from '@nso/components/AppHeader';
import { Field } from '@nso/components/Field';
import { getReport, saveReport } from '@nso/lib/localStore';
import { loadRemoteReport, remoteDb, upsertRemoteReport } from '@nso/lib/remoteStore';
import { makeSpeedGroup, makeTransaction, syncCrewDependentRows } from '@nso/lib/reportDefaults';
import { uid } from '@nso/lib/normalize';
import { DEFAULT_PRODUCT_MASTER } from '@nso/lib/productMaster';
import { exportProductListPdf } from '@nso/lib/productListPdf';
import { exportProductUsageExcel } from '@nso/lib/productUsageExcel';
import { ProductLine, ProductMasterItem, ReportData, SpeedAccuracyGroup } from '@nso/lib/types';

function IconButton({ icon, label, className = '', disabled, onClick, type = 'button' }: { icon: string; label: string; className?: string; disabled?: boolean; onClick?: () => void; type?: 'button' | 'submit' }) {
  return <button type={type} className={`icon-btn ${className}`} disabled={disabled} onClick={onClick} title={label} aria-label={label}><span>{icon}</span><b>{label}</b></button>;
}

function productDisplayName(item: ProductMasterItem) {
  return `${item.category} - ${item.name}${item.article ? ` (${item.article})` : ''}`;
}

function ProductSelect({ master, value, onChange }: { master: ProductMasterItem[]; value: string; onChange: (item: ProductMasterItem) => void }) {
  const [query, setQuery] = useState('');
  const selected = master.find((item) => item.name === value) ?? master[0];
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? master.filter((item) => [item.category, item.article, item.name].join(' ').toLowerCase().includes(normalizedQuery)).slice(0, 90)
    : master;
  const kitchen = filtered.filter((item) => item.category === 'Kitchen');
  const beverage = filtered.filter((item) => item.category === 'Beverage');
  const grocery = filtered.filter((item) => item.category === 'Grocery');
  return (
    <div className="product-search-select">
      <div className="product-search-row"><span aria-hidden="true">S</span><input type="search" value={query} placeholder="Search produk / article..." onChange={(event) => setQuery(event.target.value)} /></div>
      <select value={selected?.id ?? ''} onChange={(event) => { const item = master.find((option) => option.id === event.target.value); if (item) onChange(item); }}>
        <option value="">Pilih produk</option>
        {beverage.length ? <optgroup label="Beverage">{beverage.map((item) => <option key={item.id} value={item.id}>{productDisplayName(item)}</option>)}</optgroup> : null}
        {kitchen.length ? <optgroup label="Kitchen">{kitchen.map((item) => <option key={item.id} value={item.id}>{productDisplayName(item)}</option>)}</optgroup> : null}
        {grocery.length ? <optgroup label="Grocery">{grocery.map((item) => <option key={item.id} value={item.id}>{productDisplayName(item)}</option>)}</optgroup> : null}
      </select>
      {normalizedQuery && filtered.length ? (
        <div className="product-suggestion-list">
          {filtered.slice(0, 6).map((item) => (
            <button type="button" key={item.id} onClick={() => { onChange(item); setQuery(''); }}>
              <b>{item.name}</b><small>{item.category} • {item.article || '-'}</small>
            </button>
          ))}
        </div>
      ) : null}
      {normalizedQuery && !filtered.length ? <small className="product-search-empty">Produk tidak ditemukan.</small> : null}
    </div>
  );
}

function QtyInput({ value, onCommit }: { value: number; onCommit: (qty: number) => void }) {
  const [draft, setDraft] = useState(String(value || 1));
  useEffect(() => { setDraft(String(value || 1)); }, [value]);
  function commit() {
    const parsed = Number(draft);
    onCommit(Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1);
  }
  return (
    <input
      aria-label="Qty"
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(event) => {
        const next = event.target.value.replace(/\D/g, '');
        setDraft(next);
      }}
      onBlur={commit}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
    />
  );
}

async function parseProductMasterExcel(file: File): Promise<ProductMasterItem[]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const items: ProductMasterItem[] = [];
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1, defval: '' }) as unknown as unknown[][];
    const headerIndex = rows.findIndex((row) => row.map((cell) => String(cell).toLowerCase()).some((cell) => cell.includes('article') || cell.includes('description')));
    const header = headerIndex >= 0 ? rows[headerIndex].map((cell) => String(cell).toLowerCase()) : [];
    const articleIndex = header.findIndex((cell) => cell.includes('article'));
    const nameIndex = header.findIndex((cell) => cell.includes('description') || cell.includes('produk') || cell.includes('nama'));
    const startRow = headerIndex >= 0 ? headerIndex + 1 : 0;
    rows.slice(startRow).forEach((row, rowIndex) => {
      const article = String((articleIndex >= 0 ? row[articleIndex] : row[1]) ?? '').replace(/\.0$/, '').trim();
      const name = String((nameIndex >= 0 ? row[nameIndex] : row[2]) ?? '').trim();
      if (!article || !name || name.toLowerCase().includes('nama menu')) return;
      if (!/^\d+/.test(article)) return;
      const category = sheetName.toLowerCase().includes('bev') ? 'Beverage' : 'Kitchen';
      items.push({ id: `master_${category}_${article}_${items.length + rowIndex}`, category, article, name });
    });
  });
  const dedup = new Map(items.map((item) => [`${item.category}-${item.article}-${item.name}`, item]));
  return Array.from(dedup.values());
}

export default function ProductAdminPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [report, setReport] = useState<ReportData | null>(null);
  const [status, setStatus] = useState('Loading admin produk...');
  const [busyLabel, setBusyLabel] = useState('');
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedTransactionId, setSelectedTransactionId] = useState('');
  const lastSnapshotRef = useRef('');

  async function load() {
    let loaded: ReportData | null = null;
    try { loaded = await loadRemoteReport(id); } catch { /* local fallback */ }
    loaded = loaded ?? getReport(id);
    const synced = loaded ? syncCrewDependentRows(loaded) : null;
    setReport(synced);
    setStatus(synced ? '' : 'Data store tidak ditemukan.');
    lastSnapshotRef.current = synced ? JSON.stringify(synced) : '';
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!report) return;
    const snapshot = JSON.stringify(report);
    if (!lastSnapshotRef.current || snapshot === lastSnapshotRef.current) return;
    const timeout = window.setTimeout(async () => {
      const synced = syncCrewDependentRows({ ...report, updatedAt: new Date().toISOString() });
      try {
        if (remoteDb) await upsertRemoteReport(synced);
        else saveReport(synced);
        setStatus(remoteDb ? 'Autosaved ke database.' : 'Autosaved lokal.');
      } catch {
        saveReport(synced);
        setStatus('Autosaved lokal. Firebase belum aktif / tidak bisa diakses.');
      }
      lastSnapshotRef.current = JSON.stringify(synced);
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [report]);

  const productMaster = useMemo(() => {
    const existing = report?.productMaster?.length ? report.productMaster : DEFAULT_PRODUCT_MASTER;
    const missing = DEFAULT_PRODUCT_MASTER.filter(p => !existing.find(e => e.id === p.id));
    return [...existing, ...missing];
  }, [report?.productMaster]);
  const selectedGroup = useMemo(() => {
    if (!report) return null;
    return report?.speedGroups.find((group) => group.id === selectedGroupId) ?? report.speedGroups[0] ?? null;
  }, [report, selectedGroupId]);
  const selectedTransaction = useMemo(() => {
    if (!selectedGroup) return null;
    return selectedGroup.transactions.find((trx) => trx.id === selectedTransactionId) ?? selectedGroup.transactions[0] ?? null;
  }, [selectedGroup, selectedTransactionId]);

  useEffect(() => {
    if (!report) return;
    const firstGroup = report.speedGroups[0]?.id ?? '';
    if (!selectedGroupId || !report.speedGroups.some((group) => group.id === selectedGroupId)) setSelectedGroupId(firstGroup);
  }, [report?.speedGroups, selectedGroupId, report]);

  useEffect(() => {
    if (!selectedGroup) return;
    const firstTrx = selectedGroup.transactions[0]?.id ?? '';
    if (!selectedTransactionId || !selectedGroup.transactions.some((trx) => trx.id === selectedTransactionId)) setSelectedTransactionId(firstTrx);
  }, [selectedGroup, selectedTransactionId]);

  function patch(next: (current: ReportData) => ReportData) {
    setReport((current) => current ? syncCrewDependentRows(next(current)) : current);
  }

  function updateGroup(groupId: string, nextGroup: Partial<SpeedAccuracyGroup>) {
    patch((r) => ({ ...r, speedGroups: r.speedGroups.map((g) => g.id === groupId ? { ...g, ...nextGroup } : g) }));
  }

  function updateTransaction(group: SpeedAccuracyGroup, trxId: string, nextTransaction: Partial<SpeedAccuracyGroup['transactions'][number]>) {
    updateGroup(group.id, { transactions: group.transactions.map((trx) => trx.id === trxId ? { ...trx, ...nextTransaction } : trx) });
  }

  function deleteTransaction(group: SpeedAccuracyGroup, trxId: string) {
    if (group.transactions.length <= 1) {
      alert('Minimal harus ada 1 transaksi.');
      return;
    }
    if (!confirm('Hapus transaksi ini?')) return;
    const nextTransactions = group.transactions.filter((trx) => trx.id !== trxId);
    updateGroup(group.id, { transactions: nextTransactions });
    setSelectedTransactionId(nextTransactions[0]?.id ?? '');
  }

  function addTransaction(group: SpeedAccuracyGroup) {
    const nextTransactions = [...group.transactions, makeTransaction(group.transactions.length + 1, undefined, report?.productMaster)];
    updateGroup(group.id, { transactions: nextTransactions });
    setSelectedTransactionId(nextTransactions[nextTransactions.length - 1].id);
  }

  function updateProduct(group: SpeedAccuracyGroup, trxId: string, productId: string, nextProduct: Partial<ProductLine>) {
    const transaction = group.transactions.find((trx) => trx.id === trxId);
    if (!transaction) return;
    updateTransaction(group, trxId, { products: transaction.products.map((product) => product.id === productId ? { ...product, ...nextProduct } : product) });
  }

  function addGroup() {
    const nextGroup = makeSpeedGroup((report?.speedGroups.length ?? 0) + 1);
    patch((r) => ({ ...r, speedGroups: [...r.speedGroups, nextGroup] }));
    setSelectedGroupId(nextGroup.id);
    setSelectedTransactionId(nextGroup.transactions[0]?.id ?? '');
  }

  function addProduct(group: SpeedAccuracyGroup, trxId: string) {
    const transaction = group.transactions.find((trx) => trx.id === trxId);
    const first = productMaster[0];
    if (!transaction || !first) return;
    updateTransaction(group, trxId, { products: [...transaction.products, { id: uid('prd'), product: first.name, article: first.article, category: first.category, qty: 1 }] });
  }

  function deleteProduct(group: SpeedAccuracyGroup, trxId: string, productId: string) {
    const ok = confirm('Hapus produk ini?');
    if (!ok) return;
    const transaction = group.transactions.find((trx) => trx.id === trxId);
    if (!transaction) return;
    const first = productMaster[0];
    const nextProducts = transaction.products.filter((product) => product.id !== productId);
    updateTransaction(group, trxId, { products: nextProducts.length ? nextProducts : first ? [{ id: uid('prd'), product: first.name, article: first.article, category: first.category, qty: 1 }] : [] });
  }

  
  async function handleMasterUpload(file: File | null) {
    if (!file || !report) return;
    setBusyLabel('Membaca master produk Excel...');
    try {
      const master = await parseProductMasterExcel(file);
      if (!master.length) throw new Error('Master produk tidak ditemukan di Excel.');
      patch((r) => ({ ...r, productMaster: master }));
      setStatus(`Master produk berhasil diupload: ${master.length} item.`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Upload master produk gagal.');
    } finally {
      setBusyLabel('');
    }
  }

  async function printProductList() {
    if (!report) return;
    setBusyLabel('Membuat Reservasi List...');
    try { await exportProductListPdf(report); } finally { setBusyLabel(''); }
  }

  
  async function saveGlobalTemplate() {
    if (!report) return;
    if (!confirm('Jadikan kelompok dan produk saat ini sebagai Template Bawaan untuk pembuatan report NSO baru?')) return;
    try {
      const templateData = {
        speedGroups: report.speedGroups,
        productMaster: report.productMaster,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('nso_global_template', JSON.stringify(templateData));
      alert('Template bawaan berhasil disimpan! Semua report NSO baru akan menggunakan produk dan kelompok ini.');
    } catch (e) {
      alert('Gagal menyimpan template: ' + String(e));
    }
  }

  async function exportUsageExcel() {
    if (!report) return;
    setBusyLabel('Membuat Excel pemakaian produk...');
    try { await exportProductUsageExcel(report); } finally { setBusyLabel(''); }
  }

  if (!report) {
    return <main className="app-shell facilitator-app"><AppHeader title="Setting Produk" /><div className="container"><section className="card"><p>{status}</p><Link href="/facilitator">Kembali</Link></section></div></main>;
  }

  return (
    <main className="app-shell facilitator-app product-admin-page">
      <AppHeader title={`Setting Produk - ${report.storeName}`} />
      <div className="container">
        <section className="card section-card admin-product-panel structured-product-admin">
          <div className="section-header">
            <div>
              <p className="eyebrow">Halaman Setting Produk</p>
              <h2 className="admin-secret-title" onClick={() => setAdminClickCount((value) => value + 1)}>Ruang Setting Produk & Qty</h2>
              {status ? <p className="muted">{status}</p> : null}
            </div>
            <div className="actions icon-action-row">
              <Link className="icon-btn secondary" href={`/facilitator/${report.id}?section=team-speed`}><span>←</span><b>Section Team</b></Link>
              
              
              
              <IconButton icon="GLB" label="Jadikan Template Global" className="secondary" onClick={() => void saveGlobalTemplate()} />
              <label className="icon-btn blue" title="Upload Master Data"><span>UP</span><b>Upload Master Data</b><input hidden type="file" accept=".xlsx,.xls" onChange={(event) => void handleMasterUpload(event.target.files?.[0] ?? null)} /></label>
              <IconButton icon="XLS" label="Export Excel" className="green" disabled={Boolean(busyLabel)} onClick={exportUsageExcel} />
              <IconButton icon="＋" label="Tambah Kelompok" className="green" onClick={addGroup} />
            </div>
          </div>
          <div className="product-master-status"><b>{productMaster.length}</b> master produk aktif - Kitchen & Beverage</div>
          {busyLabel ? <p className="notice">{busyLabel}</p> : null}

          <div className="product-admin-step">
            <h3>1. Pilih Kelompok</h3>
            <div className="group-tab-row product-group-tabs">
              {report.speedGroups.map((group) => (
                <button key={group.id} type="button" className={selectedGroup?.id === group.id ? 'active' : ''} onClick={() => { setSelectedGroupId(group.id); setSelectedTransactionId(group.transactions[0]?.id ?? ''); }}>
                  <span>{group.title}</span>
                  <small>{group.modeLabel}</small>
                </button>
              ))}
            </div>
          </div>

          {selectedGroup ? (
            <div className="product-admin-step">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>2. Pilih Nomor Transaksi</h3>
                <IconButton icon="+" label="Tambah Transaksi" className="green small-btn" onClick={() => addTransaction(selectedGroup)} />
              </div>
              <div className="transaction-toggle product-trx-tabs">
                {selectedGroup.transactions.map((trx, index) => (
                  <div className={`transaction-tab-card ${selectedTransaction?.id === trx.id ? 'active' : ''}`} key={trx.id}>
                    <button type="button" className={`btn ${selectedTransaction?.id === trx.id ? 'green' : 'secondary'}`} onClick={() => setSelectedTransactionId(trx.id)}>
                      <span>T{index + 1}</span>
                      <small>{trx.actualTime || trx.label}</small>
                    </button>
                    <button type="button" className="transaction-delete-btn" title={`Hapus Transaksi ${index + 1}`} aria-label={`Hapus Transaksi ${index + 1}`} onClick={() => deleteTransaction(selectedGroup, trx.id)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {selectedGroup && selectedTransaction ? (
            <div className="product-admin-step product-detail-step">
              <div className="section-header compact-header">
                <div>
                  <h3>3. List Produk - {selectedGroup.title} / Transaksi {selectedGroup.transactions.findIndex((trx) => trx.id === selectedTransaction.id) + 1}</h3>
                </div>
                <IconButton icon="+" label="Tambah Produk" className="secondary" onClick={() => addProduct(selectedGroup, selectedTransaction.id)} />
              </div>
              <Field label="Label Transaksi"><input value={selectedTransaction.label} onChange={(event) => updateTransaction(selectedGroup, selectedTransaction.id, { label: event.target.value })} /></Field>
              <div className="product-editor-list structured-product-list">
                {selectedTransaction.products.map((product) => (
                  <div className="product-edit-row structured-product-row" key={product.id}>
                    <ProductSelect master={productMaster} value={product.product} onChange={(item) => updateProduct(selectedGroup, selectedTransaction.id, product.id, { product: item.name, article: item.article, category: item.category })} />
                    <QtyInput value={product.qty} onCommit={(qty) => updateProduct(selectedGroup, selectedTransaction.id, product.id, { qty })} />
                    <IconButton icon="Del" label="Hapus" className="danger small-icon" onClick={() => deleteProduct(selectedGroup, selectedTransaction.id, product.id)} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}


