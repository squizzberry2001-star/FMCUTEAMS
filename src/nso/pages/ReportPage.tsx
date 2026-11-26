'use client';

import { useEffect, useState } from 'react';
import { NsoLink as Link } from '@nso/routerShim';
import { useParams } from '@nso/routerShim';
import { AppHeader } from '@nso/components/AppHeader';
import { CoffeePopup } from '@nso/components/CoffeePopup';
import { PinAccessModal } from '@nso/components/PinAccessModal';
import { ReportPreview } from '@nso/components/ReportPreview';
import { getReport } from '@nso/lib/localStore';
import { loadRemoteReport, subscribeReport } from '@nso/lib/remoteStore';
import { DEFAULT_STORE_PIN, ReportData } from '@nso/lib/types';
import { exportReportToPdf } from '@nso/lib/pdfExport';
import { syncCrewDependentRows } from '@nso/lib/reportDefaults';

function normalizeStorePin(value?: string) {
  return String(value ?? '').replace(/\D/g, '');
}

function expectedStorePin(report: ReportData) {
  return normalizeStorePin(report.accessCode) || DEFAULT_STORE_PIN;
}

function pinMatches(input: string, expected: string) {
  const cleanInput = normalizeStorePin(input).slice(0, 4);
  const cleanExpected = normalizeStorePin(expected);
  return cleanInput === cleanExpected || (cleanInput.length === 4 && cleanExpected.length > 4 && cleanExpected.startsWith(cleanInput));
}

function hasSessionPinAccess(storeId: string) {
  try { return localStorage.getItem(`nso-store-pin-ok:${storeId}`) === '1'; } catch { return false; }
}

function markSessionPinAccess(storeId: string) {
  try { localStorage.setItem(`nso-store-pin-ok:${storeId}`, '1'); } catch { /* ignore */ }
}


export default function ReportPage() {
  const [showCoffeePopup, setShowCoffeePopup] = useState(true);
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [report, setReport] = useState<ReportData | null>(null);
  const [message, setMessage] = useState('Loading...');
  const [downloading, setDownloading] = useState(false);
  const [corporateMode, setCorporateMode] = useState(true);
  const [pendingReport, setPendingReport] = useState<ReportData | null>(null);
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    async function load() {
      let remote: ReportData | null = null;
      try { remote = await loadRemoteReport(id); } catch { /* ignore */ }
      const local = getReport(id);
      const loaded = remote ?? local;
      if (!loaded) {
        setReport(null);
        setMessage('Report tidak ditemukan.');
        return;
      }
      const synced = syncCrewDependentRows(loaded);
      if (!hasSessionPinAccess(synced.id)) {
        setReport(null);
        setPendingReport(synced);
        setPinError('');
        setMessage('Masukkan PIN akses untuk membuka preview PDF.');
        return;
      }
      setReport(synced);
      setPendingReport(null);
      setMessage('');
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!report || !hasSessionPinAccess(report.id)) return;
    const unsub = subscribeReport(id, (newData) => {
      const synced = syncCrewDependentRows(newData);
      setReport(synced);
    });
    return unsub;
  }, [id, report?.id]);

  function unlockReport(pin: string) {
    if (!pendingReport) return;
    if (!pinMatches(pin, expectedStorePin(pendingReport))) {
      setPinError('PIN salah. Masukkan PIN akses 4 digit yang sesuai.');
      return;
    }
    markSessionPinAccess(pendingReport.id);
    setReport(pendingReport);
    setPendingReport(null);
    setPinError('');
    setMessage('');
  }

  async function downloadPdf() {
    if (!report) return;
    setDownloading(true);
    try {
      await exportReportToPdf(`Regional Bestie NSO Report - ${report.storeName}`);
    } finally {
      setDownloading(false);
    }
  }

  if (!report) {
    return (
      <main className="app-shell">
        <AppHeader />
        <div className="container"><section className="card"><p>{message}</p><Link href="/facilitator">Kembali</Link></section></div>
        <PinAccessModal
          open={Boolean(pendingReport)}
          storeName={pendingReport?.storeName}
          error={pinError}
          onSubmit={unlockReport}
          onCancel={() => { setPendingReport(null); setPinError(''); setMessage('Akses preview PDF dibatalkan.'); }}
        />
      </main>
    );
  }

  return (
    <main>
      {showCoffeePopup && <CoffeePopup onClose={() => setShowCoffeePopup(false)} />}
      <AppHeader title={`Preview PDF - ${report.storeName}`} />
      <div className="print-toolbar no-print">
        <Link className="btn secondary" href={`/facilitator/${report.id}`}>Edit Data</Link>
        <button className="btn green download-btn" disabled={downloading} onClick={downloadPdf}>{downloading ? <span className="spinner" /> : null}{downloading ? 'Membuat PDF...' : 'Download PDF'}</button>
        <span className="muted">Export memakai halaman 960 x 540 pt.</span>
      </div>
      {downloading ? <div className="pdf-loading no-print"><span className="spinner large" /> Menyiapkan PDF...</div> : null}
      <ReportPreview report={report} variant={corporateMode ? 'corporate' : 'standard'} />
    </main>
  );
}

