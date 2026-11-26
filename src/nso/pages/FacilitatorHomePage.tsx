'use client';

import { useEffect, useState } from 'react';
import { AppHeader } from '@nso/components/AppHeader';
import { PinAccessModal } from '@nso/components/PinAccessModal';
import { createBlankReport } from '@nso/lib/reportDefaults';
import { deleteReport, getHistory, saveReport, saveHistory, getReport } from '@nso/lib/localStore';
import { DEFAULT_STORE_PIN, StoreHistoryItem } from '@nso/lib/types';
import { deleteRemoteReport, listRemoteReports, subscribeReports, convex, upsertRemoteReport, testFirebaseConnection } from '@nso/lib/remoteStore';
import { firebaseDiagnostics } from '@nso/lib/firebaseClient';
import { useNsoRouter } from '@nso/routerShim';

function formatHistoryDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('id-ID');
}

function validHistoryItem(item: StoreHistoryItem | null | undefined): item is StoreHistoryItem {
  return Boolean(item?.id && item?.storeName);
}

function normalizePin(value: string | null) {
  return String(value ?? '').replace(/\D/g, '');
}

function normalizeCode(value: string | null) {
  return normalizePin(value).slice(0, 4);
}

function pinMatches(input: string, expected: string) {
  const cleanInput = normalizeCode(input);
  const cleanExpected = normalizePin(expected);
  return cleanInput === cleanExpected || (cleanInput.length === 4 && cleanExpected.length > 4 && cleanExpected.startsWith(cleanInput));
}


export default function FacilitatorHome() {
  const { navigate, initialStoreName } = useNsoRouter();
  const [items, setItems] = useState<StoreHistoryItem[]>([]);
  const [storeName, setStoreName] = useState(() => (initialStoreName || '').trim().toUpperCase());
  const [storePin, setStorePin] = useState('');
  const [message, setMessage] = useState('');
  const [firebaseCheck, setFirebaseCheck] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [secretTapCount, setSecretTapCount] = useState(0);
  const [showSecretPanel, setShowSecretPanel] = useState(false);
  const [pinAccess, setPinAccess] = useState<{ item: StoreHistoryItem; action: 'open' | 'clear'; targetUrl?: string; error?: string } | null>(null);

  useEffect(() => {
    if (initialStoreName && !storeName) {
      setStoreName(initialStoreName.trim().toUpperCase());
    }
  }, [initialStoreName]);

  
  async function changePin(item: StoreHistoryItem) {
    const newPin = window.prompt(`Masukkan PIN 4 angka baru untuk ${item.storeName}:`);
    if (!newPin) return;
    const cleanPin = normalizeCode(newPin);
    if (!/^\d{4}$/.test(cleanPin)) {
      alert('PIN wajib 4 digit angka.');
      return;
    }
    
    // Save locally
    const history = getHistory();
    const existing = history.find(h => h.id === item.id);
    if (existing) {
      existing.accessCode = cleanPin;
      saveHistory(history);
    }
    
    // Also save in full report locally
    const report = getReport(item.id);
    if (report) {
      report.accessCode = cleanPin;
      saveReport(report);
    }
    
    // Try to save to remote
    if (convex) {
      try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { firebaseDb } = await import('@nso/lib/firebaseClient');
        if (firebaseDb) {
          const ref = doc(firebaseDb, 'stores', item.id);
          await updateDoc(ref, { accessCode: cleanPin });
        }
      } catch (error) {
        console.error('Gagal update remote PIN:', error);
      }
    }
    
    alert(`PIN untuk ${item.storeName} berhasil diubah menjadi ${cleanPin}`);
    await refresh();
  }

  async function refresh() {
    setLoadingHistory(true);
    const local = getHistory().filter(validHistoryItem);
    try {
      const remote = (await listRemoteReports()).filter(validHistoryItem);
      const merged = [...remote, ...local.filter((l) => !remote.some((r) => r.id === l.id))];
      
        // Cleanup leftover PIN flags for deleted stores
        try {
          const validIds = new Set(merged.map(x => x.id));
          const toRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('nso-store-pin-ok:')) {
              const id = key.substring('nso-store-pin-ok:'.length);
              if (!validIds.has(id)) {
                toRemove.push(key);
              }
            }
          }
          toRemove.forEach(k => localStorage.removeItem(k));
        } catch (e) {}

        setItems(merged);
      setMessage('');
    } catch (error: any) {
      setItems(local);
      const errMsg = error?.message || String(error);
      setMessage(`Firebase belum bisa dimuat: ${errMsg}`);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeReports(() => void refresh());
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  function revealSecretPanel() {
    setSecretTapCount((current) => {
      const next = current + 1;
      if (next >= 10) {
        const password = window.prompt('Masukkan sandi panel rahasia:');
        if (password === 'superadmin') {
          setShowSecretPanel(true);
          setMessage('');
        } else if (password !== null) {
          setMessage('Sandi panel rahasia salah.');
        }
        return 0;
      }
      return next;
    });
  }

  function expectedPin(item: StoreHistoryItem) {
    return normalizePin(item.accessCode || DEFAULT_STORE_PIN) || DEFAULT_STORE_PIN;
  }

  function openProtected(item: StoreHistoryItem, targetUrl: string) {
    setPinAccess({ item, action: 'open', targetUrl });
  }

  function requestClearStore(item: StoreHistoryItem) {
    setPinAccess({ item, action: 'clear' });
  }

  async function submitHistoryPin(pin: string) {
    if (!pinAccess) return;
    if (!pinMatches(pin, expectedPin(pinAccess.item))) {
      setPinAccess({ ...pinAccess, error: 'PIN salah. Pastikan PIN akses 4 digit sesuai store.' });
      return;
    }

    if (pinAccess.action === 'clear') {
      const item = pinAccess.item;
      setPinAccess(null);
      setMessage(`Menghapus data ${item.storeName}...`);
      deleteReport(item.id);
      try { localStorage.removeItem(`nso-store-pin-ok:${item.id}`); } catch { /* ignore */ }
      try { await deleteRemoteReport(item.id); } catch { /* local mode fallback */ }
      await refresh();
      setMessage(`Data ${item.storeName} berhasil di-clear.`);
      return;
    }

    try { localStorage.setItem(`nso-store-pin-ok:${pinAccess.item.id}`, '1'); } catch { /* ignore */ }
    navigate(pinAccess.targetUrl || `/facilitator/${pinAccess.item.id}`);
  }

  async function runFirebaseCheck() {
    setFirebaseCheck('Mengecek koneksi Firebase...');
    const result = await testFirebaseConnection();
    setFirebaseCheck(result.message);
  }

  async function createNew() {
    const cleanStoreName = storeName.trim().toUpperCase();
    if (!cleanStoreName) {
      setMessage('Isi nama store terlebih dahulu.');
      return;
    }

    const enteredCode = normalizeCode(storePin);
    if (!/^\d{4}$/.test(enteredCode)) {
      setMessage('PIN wajib diisi 4 digit angka.');
      return;
    }
    if (items.some((item) => expectedPin(item) === enteredCode)) {
      setMessage('PIN sudah dipakai store lain. Gunakan PIN berbeda.');
      return;
    }

    const report = { ...createBlankReport(cleanStoreName), accessCode: enteredCode };
    saveReport(report);
    if (convex) {
      try { 
        await upsertRemoteReport(report); 
      } catch (e: any) { 
        alert(`Gagal membuat ke server Firebase: ${e.message || String(e)}`);
      }
    }
    try { localStorage.setItem(`nso-store-pin-ok:${report.id}`, '1'); } catch { /* ignore */ }
    navigate(`/facilitator/${report.id}`);
  }

  return (
    <main className="app-shell">
      <AppHeader />
      <div className="container grid dashboard-home">
        <section className="card hero-card dashboard-create-card">
          <h1 className="dashboard-secret-title" onClick={revealSecretPanel}>Dashboard Fasilitator</h1>
          <div className="notice firebase-diagnostic-notice">
            <button className="btn secondary mini-btn" type="button" onClick={runFirebaseCheck}>Cek Status Firebase</button>
            {firebaseCheck ? <small style={{ display: 'block', marginTop: '8px' }}>{firebaseCheck}</small> : null}
          </div>
          {message ? <p className="notice">{message}</p> : null}
          <div className="grid grid-2 align-end">
            <div className="field">
              <label>Nama Store Baru</label>
              <input
                value={storeName}
                onChange={(event) => setStoreName(event.target.value.toUpperCase())}
                autoCapitalize="characters"
                style={{ textTransform: 'uppercase' }}
                placeholder="CONTOH: FAMILYMART BRAGA BDG 3004"
              />
            </div>
            <div className="field store-pin-field">
              <label>PIN AKSES 4 DIGIT</label>
              <input
                value={storePin}
                onChange={(event) => setStorePin(normalizeCode(event.target.value))}
                inputMode="numeric"
                maxLength={4}
                placeholder="1234"
              />
            </div>
            <div className="actions">
              <button className="btn green icon-home-btn" onClick={createNew}>＋ Create</button>
              <button className="btn secondary icon-home-btn" onClick={refresh}>↻ Refresh</button>
            </div>
          </div>
        </section>

        <section className="card history-card">
          <div className="section-header compact-header history-header">
            <h2>History Store</h2>
            {loadingHistory ? <span className="history-loading-pill"><span className="spinner" /> Load</span> : null}
          </div>
          <div className="history-list">
            {loadingHistory ? (
              Array.from({ length: 4 }).map((_, index) => <div className="history-skeleton" key={index}><i /><b /><span /></div>)
            ) : null}
            {!loadingHistory && items.length === 0 ? <div className="empty-state-card"><div className="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg></div><div><h3>Belum Ada Evaluasi</h3><p>Yuk mulai kunjungan store pertamamu hari ini! Ketik nama store di atas.</p></div></div> : null}
            {!loadingHistory && items.map((item) => (
              <div className="history-item" key={item.id}>
                <div>
                  <b>{item.storeName}</b><br />
                  <span className="muted">Updated: {formatHistoryDate(item.updatedAt)}</span>
                </div>
                <div className="actions">
                  <button className="btn blue icon-home-btn" type="button" onClick={() => openProtected(item, `/facilitator/${item.id}`)}>✎ Buka</button>
                  <button className="btn secondary icon-home-btn" type="button" onClick={() => openProtected(item, `/report/${item.id}`)}>PDF</button>
                  <button className="btn danger icon-home-btn" type="button" onClick={() => requestClearStore(item)}>Clear</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <PinAccessModal
        open={Boolean(pinAccess)}
        storeName={pinAccess?.item.storeName}
        error={pinAccess?.error}
        eyebrow={pinAccess?.action === 'clear' ? 'Konfirmasi Clear Store' : 'Akses Store'}
        submitLabel={pinAccess?.action === 'clear' ? 'Hapus / Clear' : 'Buka'}
        onSubmit={submitHistoryPin}
        onCancel={() => setPinAccess(null)}
      />

      {showSecretPanel ? (
        <div className="modal-backdrop" onClick={() => setShowSecretPanel(false)}>
          <div className="modal-card secret-code-panel" onClick={(event) => event.stopPropagation()}>
            <div className="section-header compact-header">
              <div>
                <p className="eyebrow">Panel Rahasia</p>
                <h2>Kode History Store</h2>
              </div>
              <button className="icon-btn secondary small-icon" type="button" onClick={() => setShowSecretPanel(false)} aria-label="Tutup"><span>×</span><b>Tutup</b></button>
            </div>
            <div className="secret-code-list">
              {items.length === 0 ? <p className="muted">Belum ada kode.</p> : null}
              {items.map((item) => (
                <div className="secret-code-row" key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ flex: 1, fontWeight: 500, fontSize: '13px' }}>{item.storeName}</span>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <b style={{ fontSize: '15px', color: 'var(--blue)' }}>{expectedPin(item)}</b>
                    <button className="btn secondary" style={{ padding: '4px 10px', fontSize: '11px', minHeight: 'unset', height: '24px' }} onClick={() => changePin(item)}>Ubah PIN</button>
                  </div>
                </div>
              ))}

            </div>
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '2px dashed var(--border)', display: 'flex', gap: '8px' }}>
              <button 
                className="btn green" 
                style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
                                onClick={async () => {
                  const newNik = window.prompt('Masukkan NIK baru (hanya angka):');
                  if (!newNik) return;
                  const cleanNik = newNik.replace(/\D/g, '');
                  if (!cleanNik) {
                    alert('NIK harus berupa angka.');
                    return;
                  }
                  const newName = window.prompt('Masukkan Nama untuk NIK ' + cleanNik + ':');
                  if (!newName) return;
                  
                  try {
                    const { setDoc, doc, arrayUnion } = await import('firebase/firestore');
                    const { firebaseDb } = await import('@nso/lib/firebaseClient');
                    if (!firebaseDb) throw new Error('Koneksi Firebase tidak aktif.');
                    
                    const ref = doc(firebaseDb, 'settings', 'globalUsers');
                    await setDoc(ref, { users: arrayUnion({ nik: cleanNik, name: newName }) }, { merge: true });
                    
                    const raw = localStorage.getItem('nso-regional-bestie-extra-users');
                    const users = raw ? JSON.parse(raw) : [];
                    users.push({ nik: cleanNik, name: newName });
                    localStorage.setItem('nso-regional-bestie-extra-users', JSON.stringify(users));
                    
                    alert(`NIK ${cleanNik} atas nama ${newName} berhasil didaftarkan ke server!`);
                  } catch (e) {
                    alert('Gagal mendaftarkan NIK ke server: ' + String(e));
                  }
                }}
              >
                + Daftarkan NIK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}



