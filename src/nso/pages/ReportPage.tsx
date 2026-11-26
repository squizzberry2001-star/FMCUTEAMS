'use client';

import { useEffect, useState } from 'react';
import { NsoLink as Link, useParams, useSearchParams } from '@nso/routerShim';
import { AppHeader } from '@nso/components/AppHeader';
import { CoffeePopup } from '@nso/components/CoffeePopup';
import { ReportPreview } from '@nso/components/ReportPreview';
import { getReport } from '@nso/lib/localStore';
import { loadRemoteReport, subscribeReport } from '@nso/lib/remoteStore';
import { ReportData } from '@nso/lib/types';
import { exportReportToPdf } from '@nso/lib/pdfExport';
import { syncCrewDependentRows } from '@nso/lib/reportDefaults';

export default function ReportPage() {
  const [showCoffeePopup, setShowCoffeePopup] = useState(true);
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const isFromForm = searchParams.get('from') === 'form';

  const [report, setReport] = useState<ReportData | null>(null);
  const [message, setMessage] = useState('Loading...');
  const [downloading, setDownloading] = useState(false);
  const [corporateMode, setCorporateMode] = useState(true);

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
      setReport(synced);
      setMessage('');
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!report) return;
    const unsub = subscribeReport(id, (newData) => {
      const synced = syncCrewDependentRows(newData);
      setReport(synced);
    });
    return unsub;
  }, [id, report?.id]);

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
      </main>
    );
  }

  return (
    <main>
      {showCoffeePopup && <CoffeePopup onClose={() => setShowCoffeePopup(false)} />}
      <AppHeader title={`Preview PDF - ${report.storeName}`} />
      <div className="print-toolbar no-print">
        {isFromForm && (
          <Link className="btn secondary" href={`/facilitator/${report.id}`}>Edit Data</Link>
        )}
        <button className="btn green download-btn" disabled={downloading} onClick={downloadPdf}>{downloading ? <span className="spinner" /> : null}{downloading ? 'Membuat PDF...' : 'Download PDF'}</button>
        <span className="muted">Export memakai halaman 960 x 540 pt.</span>
      </div>
      {downloading ? <div className="pdf-loading no-print"><span className="spinner large" /> Menyiapkan PDF...</div> : null}
      <ReportPreview report={report} variant={corporateMode ? 'corporate' : 'standard'} />
    </main>
  );
}
