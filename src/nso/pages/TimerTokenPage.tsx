'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from '@nso/routerShim';
import { ReportData, TimerRecord } from '@nso/lib/types';
import { findReportByToken } from '@nso/lib/localStore';
import { claimAudienceTransaction, getPublicStoreByToken, submitAudienceTimer, submitAudienceTransactionNote, subscribeReportByToken } from '@nso/lib/remoteStore';
import { msToTimer, uid } from '@nso/lib/normalize';
import { syncCrewDependentRows } from '@nso/lib/reportDefaults';

const SERVICE_CATEGORIES = [
  { key: 'Service', label: 'Service', placeholder: 'Tidak Senyum, Tidak Salam, Tidak Ramah, Tidak Sopan, Tidak Eye Contact' },
  { key: 'Promosi', label: 'Promosi', placeholder: 'Tidak Up selling, Tidak Cross Selling, Tidak Suggestive Selling' },
  { key: 'Pengetahuan Produk', label: 'Pengetahuan Produk', placeholder: 'Penjelasan produk kurang jelas' },
  { key: 'Transaksi', label: 'Transaksi', placeholder: 'Tidak menawarkan kantong, tidak menyebut total belanja, salah input' },
  { key: 'Barang yang diterima', label: 'Barang yang diterima', placeholder: 'Tidak ada supplies, request salah, kelengkapan produk kurang, penyajian salah' }
] as const;

type ServiceCategoryKey = (typeof SERVICE_CATEGORIES)[number]['key'];
type ServiceRatings = Record<ServiceCategoryKey, { selected: boolean; desc: string }>;

function makeEmptyRatings(): ServiceRatings {
  return SERVICE_CATEGORIES.reduce((acc, category) => {
    acc[category.key] = { selected: false, desc: '' };
    return acc;
  }, {} as ServiceRatings);
}

function formalizeNote(value: string) {
  const clean = value
    .replace(/\s+/g, ' ')
    .replace(/\btdk\b/gi, 'tidak')
    .replace(/\byg\b/gi, 'yang')
    .trim();
  if (!clean) return '';
  const sentence = clean.charAt(0).toUpperCase() + clean.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

function serializeRatings(ratings: ServiceRatings, extraOption: string) {
  const rows = SERVICE_CATEGORIES
    .map((category) => {
      const value = ratings[category.key];
      if (!value.desc.trim()) return '';
      return `${category.label}: ${formalizeNote(value.desc.trim())}`;
    })
    .filter(Boolean);
  if (extraOption.trim()) rows.push(`Opsi tambahan: ${formalizeNote(extraOption.trim())}`);
  return rows.join('\n');
}

function getDeviceId() {
  if (typeof window === 'undefined') return '';
  const key = 'regional-bestie-timer-device-id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = uid('device');
  localStorage.setItem(key, next);
  return next;
}

function normalizeCrewName(value?: string) {
  return String(value ?? '').trim().toUpperCase();
}

function groupCustomerVisibleNames(group: ReportData['speedGroups'][number]) {
  return [
    ...(group.roleAssignments?.Cashier ?? []),
    ...(group.roleAssignments?.Support ?? [])
  ].map(normalizeCrewName).filter(Boolean);
}

export default function CustomerTimerPage() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = params.token;
  const queryGroupId = searchParams.get('group') ?? '';
  const [report, setReport] = useState<ReportData | null>(null);
  const [message, setMessage] = useState('Loading timer customer...');
  const [selectedTransactionId, setSelectedTransactionId] = useState('');
  const [lockedTransactionId, setLockedTransactionId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerReady, setCustomerReady] = useState(false);
  const [selectedCashierCrewId, setSelectedCashierCrewId] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [serviceRatings, setServiceRatings] = useState<ServiceRatings>(() => makeEmptyRatings());
  const [extraOption, setExtraOption] = useState('');
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [confirmStop, setConfirmStop] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [busy, setBusy] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const startRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const deviceIdRef = useRef('');
  const lastSelectedRef = useRef('');

  async function load(fromRealtime = false) {
    let loaded: ReportData | null = null;
    try { loaded = await getPublicStoreByToken(token); } catch { /* fallback */ }
    loaded = loaded ?? findReportByToken(token);
    const synced = loaded ? syncCrewDependentRows(loaded) : null;
    setReport(synced);
    const enabledGroups = synced?.speedGroups.filter((group) => group.timerEnabled) ?? [];
    const active = (queryGroupId ? enabledGroups.find((group) => group.id === queryGroupId) : null) ?? enabledGroups[0] ?? null;
    if (!synced) setMessage('Link timer tidak valid atau database Firebase belum aktif.');
    else if (!active) setMessage('Simulasi belum dimulai oleh Fasilitator.');
    else setMessage(fromRealtime ? 'Data timer terupdate realtime.' : 'Timer customer siap.');
  }

  useEffect(() => {
    deviceIdRef.current = getDeviceId();
    load();
    const unsubscribe = subscribeReportByToken(token, () => load(true));
    return unsubscribe;
  }, [token, queryGroupId]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (startRef.current != null) setElapsed(Date.now() - startRef.current);
    }, 90);
    return () => window.clearInterval(timer);
  }, [running]);

  const activeGroup = useMemo(() => {
    if (!report) return null;
    const enabledGroups = report.speedGroups.filter((group) => group.timerEnabled);
    return (queryGroupId ? enabledGroups.find((group) => group.id === queryGroupId) : null) ?? enabledGroups[0] ?? null;
  }, [report, queryGroupId]);

  const cashierCrewOptions = useMemo(() => {
    if (!report || !activeGroup) return [];
    const cashierNames = new Set(groupCustomerVisibleNames(activeGroup));
    if (cashierNames.size) {
      const filtered = report.crews.filter((crew) => cashierNames.has(normalizeCrewName(crew.name)));
      if (filtered.length) return filtered;
    }
    const assignedNames = new Set(Object.values(activeGroup.roleAssignments ?? {}).flat().map(normalizeCrewName).filter(Boolean));
    if (assignedNames.size) return report.crews.filter((crew) => assignedNames.has(normalizeCrewName(crew.name)));
    return [];
  }, [report, activeGroup]);

  useEffect(() => {
    if (!activeGroup) {
      setSelectedTransactionId('');
      setLockedTransactionId('');
      setCustomerReady(false);
      setElapsed(0);
      setRunning(false);
      setConfirmStop(false);
      startRef.current = null;
      return;
    }
    const lockKey = `regional-bestie-timer-lock:${token}:${activeGroup.id}`;
    const locked = localStorage.getItem(lockKey) ?? '';
    const transaction = activeGroup.transactions.find((trx) => trx.id === locked);
    const usable = transaction && (!transaction.lockedByDeviceId || transaction.lockedByDeviceId === deviceIdRef.current) && !transaction.actualTime;
    const nextLocked = usable ? locked : '';
    setLockedTransactionId(nextLocked);
    setSelectedTransactionId(nextLocked);
    lastSelectedRef.current = nextLocked;
    const nextTransaction = activeGroup.transactions.find((trx) => trx.id === nextLocked);
    setKeterangan(nextTransaction?.keterangan && nextTransaction.keterangan !== '-' ? nextTransaction.keterangan : '');
    setServiceRatings(makeEmptyRatings());
    setExtraOption('');
    setElapsed(0);
    startRef.current = null;
    setRunning(false);
    setConfirmStop(false);
    setCustomerReady(true);
    setCustomerName((current) => current || 'CUSTOMER');
  }, [activeGroup?.id, token]);

  const activeTransaction = useMemo(() => {
    if (!activeGroup) return null;
    return activeGroup.transactions.find((transaction) => transaction.id === selectedTransactionId) ?? null;
  }, [activeGroup, selectedTransactionId]);

  const selectedCashierCrew = useMemo(() => {
    if (!report) return null;
    return report.crews.find((crew) => crew.id === selectedCashierCrewId) ?? null;
  }, [report, selectedCashierCrewId]);

  useEffect(() => {
    if (!selectedCashierCrewId) return;
    if (cashierCrewOptions.length && !cashierCrewOptions.some((crew) => crew.id === selectedCashierCrewId)) {
      setSelectedCashierCrewId('');
    }
  }, [cashierCrewOptions, selectedCashierCrewId]);


  useEffect(() => {
    if (!activeGroup) return;
    setCustomerReady(true);
    setCustomerName((current) => current || 'CUSTOMER');
    if (!selectedCashierCrewId && cashierCrewOptions[0]?.id) {
      setSelectedCashierCrewId(cashierCrewOptions[0].id);
    }
  }, [activeGroup?.id, cashierCrewOptions, selectedCashierCrewId]);

  useEffect(() => {
    if (!activeTransaction) return;
    if (lastSelectedRef.current !== activeTransaction.id) {
      setKeterangan(activeTransaction.keterangan && activeTransaction.keterangan !== '-' ? activeTransaction.keterangan : '');
      lastSelectedRef.current = activeTransaction.id;
    }
  }, [activeTransaction?.id]);

  useEffect(() => {
    if (!activeGroup && running) {
      startRef.current = null;
      setRunning(false);
      setConfirmStop(false);
      setElapsed(0);
      setMessage('Timer dinonaktifkan fasilitator.');
    }
  }, [activeGroup?.id, running]);

  const groupEnabled = Boolean(activeGroup?.timerEnabled);
  const transactionRecorded = Boolean(activeTransaction?.actualTime);
  const ownedByOther = Boolean(activeTransaction?.lockedByDeviceId && activeTransaction.lockedByDeviceId !== deviceIdRef.current);
  const canStart = Boolean(customerReady && groupEnabled && activeTransaction && !transactionRecorded && !ownedByOther && !running && !confirmStop && lockedTransactionId);
  const canSendNote = Boolean(customerReady && groupEnabled && activeTransaction && !ownedByOther && lockedTransactionId);

  useEffect(() => {
    if (!confirmStop) return;
    setCountdown(30);
    const interval = window.setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          window.clearInterval(interval);
          void saveCurrentTimer();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [confirmStop]);

  useEffect(() => {
    const note = serializeRatings(serviceRatings, extraOption);
    setKeterangan(note);
    if (!canSendNote || !note.trim()) return;
    const timer = window.setTimeout(() => {
      void sendNote(note, true);
    }, 550);
    return () => window.clearTimeout(timer);
  }, [serviceRatings, extraOption, canSendNote]);

  // Customer profile step is intentionally skipped; timer starts directly from transaction selection.

  async function chooseTransaction(transactionId: string) {
    if (!activeGroup || running || busy) return false;
    if (lockedTransactionId && lockedTransactionId !== transactionId) {
      setMessage('Transaksi lain sudah terkunci di device ini.');
      return false;
    }
    const transaction = activeGroup.transactions.find((trx) => trx.id === transactionId);
    if (!transaction) return false;
    if (transaction.actualTime) { setMessage('Transaksi ini sudah terekam.'); return false; }
    if (transaction.lockedByDeviceId && transaction.lockedByDeviceId !== deviceIdRef.current) { setMessage('Transaksi sudah dipilih customer lain.'); return false; }
    setBusy(true);
    try {
      await claimAudienceTransaction(token, { groupId: activeGroup.id, transactionId, deviceId: deviceIdRef.current });
      const lockKey = `regional-bestie-timer-lock:${token}:${activeGroup.id}`;
      localStorage.setItem(lockKey, transactionId);
      setLockedTransactionId(transactionId);
      setSelectedTransactionId(transactionId);
      setKeterangan(transaction.keterangan && transaction.keterangan !== '-' ? transaction.keterangan : '');
      setMessage('Transaksi sudah dipilih di device ini. Opsi transaksi lain otomatis freeze.');
      await load(true);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal memilih transaksi.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function enterTimer() {
    setCustomerName((customerName.trim() || 'CUSTOMER').toUpperCase());
    setCustomerReady(true);
    setMessage('Pilih nomor transaksi, lalu tap angka timer untuk mulai.');
  }

  function start() {
    if (!canStart) {
      if (!customerReady) setMessage('Pilih nomor transaksi terlebih dahulu.');
      else if (!groupEnabled) setMessage('Timer belum diaktifkan fasilitator untuk kelompok ini.');
      else if (!activeTransaction) setMessage('Pilih satu transaksi terlebih dahulu.');
      else if (ownedByOther) setMessage('Transaksi sudah dipilih customer lain.');
      else if (transactionRecorded) setMessage('Waktu transaksi ini sudah terekam dan tidak bisa diubah.');
      return;
    }
    startRef.current = Date.now() - elapsed;
    setRunning(true);
    setMessage(elapsed ? 'Timer dilanjutkan.' : 'Timer berjalan. Tekan Stop setelah transaksi selesai.');
  }

  function pauseTimer() {
    if (!running || startRef.current === null) return;
    const total = Date.now() - startRef.current;
    startRef.current = null;
    setElapsed(total);
    setRunning(false);
    setConfirmStop(false);
    setMessage('Timer dipause. Tekan tombol Play untuk lanjut.');
  }

  function restartTimer() {
    if (!customerReady) return;
    const ok = confirm('Konfirmasi Fasilitator: mulai ulang timer dari 00:00?');
    if (!ok) return;
    startRef.current = running ? Date.now() : null;
    setElapsed(0);
    setConfirmStop(false);
    setMessage(running ? 'Timer dimulai ulang dari 00:00.' : 'Timer sudah di-reset ke 00:00.');
  }

  function requestStop() {
    if (!running || confirmStop) return;
    const total = Date.now() - (startRef.current ?? 0);
    startRef.current = null;
    setElapsed(total);
    setRunning(false);
    setConfirmStop(true);
    setMessage('Konfirmasi stop. Timer dijeda. Jika tidak dibatalkan, waktu tersimpan otomatis dalam 30 detik.');
  }

  function cancelStop() {
    startRef.current = Date.now() - elapsed;
    setRunning(true);
    setConfirmStop(false);
    setCountdown(30);
    setMessage('Timer dilanjutkan.');
  }

  async function sendNote(note = keterangan, silent = false) {
    if (!report || !activeGroup || !activeTransaction || !canSendNote) return;
    setNoteSaving(true);
    try {
      await submitAudienceTransactionNote(token, { groupId: activeGroup.id, transactionId: activeTransaction.id, deviceId: deviceIdRef.current, keterangan: note });
      if (!silent) setMessage('Penilaian pelayanan tersimpan.');
      await load(true);
    } catch (error) {
      if (!silent) setMessage(error instanceof Error ? error.message : 'Gagal menyimpan penilaian.');
    } finally {
      setNoteSaving(false);
    }
  }

  async function saveCurrentTimer() {
    if (savingRef.current || !report || !activeGroup || !activeTransaction) return;
    if (startRef.current === null && elapsed === 0) return;
    savingRef.current = true;
    const total = startRef.current !== null ? Date.now() - startRef.current : elapsed;
    startRef.current = null;
    setRunning(false);
    setConfirmStop(false);
    setElapsed(total);
    const currentCustomerName = customerName.trim().toUpperCase() || `CUSTOMER ${activeGroup.transactions.findIndex((trx) => trx.id === activeTransaction.id) + 1}`;
    const note = serializeRatings(serviceRatings, extraOption).trim() || keterangan.trim();
    const record: TimerRecord = {
      id: uid('timer'),
      crewName: currentCustomerName,
      crewNik: '',
      storeName: report.storeName,
      role: 'Customer',
      elapsedMs: total,
      elapsedText: msToTimer(total),
      createdAt: new Date().toISOString(),
      groupId: activeGroup.id,
      groupTitle: activeGroup.title,
      transactionId: activeTransaction.id,
      transactionLabel: activeTransaction.label,
      customerName: currentCustomerName,
      keterangan: note,
      deviceId: deviceIdRef.current,
      cashierCrewId: selectedCashierCrewId,
      cashierCrewName: selectedCashierCrew?.name ?? ''
    };

    try {
      await submitAudienceTimer(token, record);
      setMessage(`Waktu tersimpan: ${record.elapsedText}. Transaksi ini terkunci dan tidak bisa direkam ulang.`);
      await load(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal menyimpan timer.');
      startRef.current = Date.now() - total;
      setRunning(true);
    } finally {
      savingRef.current = false;
    }
  }

  if (!report) {
    return <main className="audience-shell timer-shell"><section className="audience-card timer-empty"><p>{message}</p></section></main>;
  }

  if (!activeGroup) {
    return (
      <main className="audience-shell timer-shell">
        <section className="audience-card timer-empty">
          <p className="eyebrow">Timer Customer</p>
          <h1>{report.storeName}</h1>
          <div className="empty-simulation readable-empty">Simulasi belum dimulai oleh Fasilitator</div>
          <p className="muted center-text">Halaman akan otomatis update ketika fasilitator mengaktifkan kelompok timer.</p>
        </section>
      </main>
    );
  }

  const selectedProducts = activeTransaction?.products ?? [];
  const customerMenuRows = activeTransaction
    ? selectedProducts.map((item) => ({ ...item, transactionName: activeTransaction.label ?? '' }))
    : [];
  const currentTransactionIndex = activeTransaction ? activeGroup.transactions.findIndex((trx) => trx.id === activeTransaction.id) + 1 : 0;

  return (
    <main className="audience-shell timer-shell compact-timer-shell customer-minimal-shell">
      <section className="audience-card timer-card-full timer-modern-card one-screen-timer customer-minimal-timer">
        <div className="customer-floating-timer-controls">
          <button type="button" className={`timer-display smooth-timer compact-timer-display futuristic-timer-display timer-tap-button customer-primary-timer ${running ? 'running' : ''}`} onClick={() => running ? requestStop() : start()}>
            <span className="timer-play-stop">{running ? 'STOP' : 'PLAY'}</span>
            {msToTimer(elapsed)}
          </button>
          <div className="actions timer-actions compact-actions single-pause-action customer-pause-row">
            <button className="btn secondary" disabled={!running || confirmStop} onClick={pauseTimer}>Ⅱ Pause</button>
            {message ? <span className="timer-tap-help">{message}</span> : null}
          </div>
        </div>
        <div className="customer-floating-timer-spacer" aria-hidden="true" />
        <div className="customer-timer-stage stage-group">
          <span>Nomor Kelompok</span>
          <b>{activeGroup.title}</b>
          <small>{activeGroup.modeLabel}</small>
        </div>
        <div className="customer-timer-stage stage-transaction">
          <div className="timer-product-head"><b>Nomor Transaksi</b><span>{busy ? 'Mengunci...' : lockedTransactionId ? 'Terkunci' : 'Pilih'}</span></div>
          <div className="transaction-toggle locked-toggle compact-trx-toggle timer-trx-toggle customer-trx-grid">
            {activeGroup.transactions.map((transaction, index) => {
              const isSelected = transaction.id === selectedTransactionId;
              const lockedByOther = Boolean(transaction.lockedByDeviceId && transaction.lockedByDeviceId !== deviceIdRef.current);
              const isRecorded = Boolean(transaction.actualTime);
              const isFrozen = Boolean(lockedTransactionId && transaction.id !== lockedTransactionId);
              return (
                <button
                  type="button"
                  key={transaction.id}
                  className={`btn ${isSelected ? 'green' : 'secondary'} ${isRecorded ? 'recorded' : ''} ${lockedByOther ? 'locked-other' : ''}`}
                  disabled={busy || running || confirmStop || isRecorded || lockedByOther || isFrozen}
                  onClick={() => void chooseTransaction(transaction.id)}
                >
                  <span>{index + 1}</span>
                  <small>{isRecorded ? transaction.actualTime : lockedByOther ? 'Dipakai' : isFrozen ? 'Freeze' : isSelected ? 'Dipilih' : 'Pilih'}</small>
                </button>
              );
            })}
          </div>
        </div>
        <div className="timer-product-panel customer-product-panel customer-all-products">
          <div className="timer-product-head"><b>List Produk Transaksi</b><span>{activeTransaction ? `Transaksi ${currentTransactionIndex}` : 'Pilih transaksi'}</span></div>
          <div className="timer-product-list customer-product-list-all">
            {customerMenuRows.length ? customerMenuRows.map((item) => (
              <div className="timer-product-row" key={`${item.transactionName}-${item.id}`}><span>{!activeTransaction ? `${item.transactionName} - ` : ''}{item.product}</span><b>x{item.qty}</b></div>
            )) : <p className="muted">Menu belum diatur oleh fasilitator.</p>}
          </div>
        </div>
        <div className="service-rating-panel customer-feedback-panel">
          <div className="timer-product-head"><b>Feedback Customer</b><span>{noteSaving ? 'Menyimpan...' : 'Realtime'}</span></div>
          {SERVICE_CATEGORIES.map((category) => {
            const value = serviceRatings[category.key];
            return (
              <div className="service-rating-row no-check-service-row" key={category.key}>
                <label><b>{category.label}</b></label>
                <input
                  value={value.desc}
                  placeholder={category.placeholder}
                  onChange={(event) => setServiceRatings((current) => ({ ...current, [category.key]: { ...current[category.key], desc: event.target.value, selected: Boolean(event.target.value.trim()) } }))}
                />
              </div>
            );
          })}
          <div className="service-rating-row extra-option-row">
            <label><b>Catatan</b></label>
            <input value={extraOption} placeholder="Tambahkan feedback lain" onChange={(event) => setExtraOption(event.target.value)} />
          </div>
        </div>
      </section>
      {confirmStop ? (
          <div className="modal-backdrop confirm-stop-backdrop">
            <style>{`.confirm-stop-backdrop { z-index: 99999 !important; }`}</style>
            <div className="modal-card confirm-save-modal">
            <p className="eyebrow">Konfirmasi Stop</p>
            <h2 className="stop-confirm-title">Apakah sudah menerima semua pesanan?</h2>
            <div className="countdown-ring">{countdown}</div>
            <p className="muted">Tekan Ya jika semua pesanan sudah diterima. Tekan Batal jika tombol stop tidak sengaja tertekan.</p>
            <div className="actions">
              <button className="btn green" type="button" onClick={saveCurrentTimer}>Ya, Simpan</button>
              <button className="btn secondary" onClick={cancelStop}>Batal</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
