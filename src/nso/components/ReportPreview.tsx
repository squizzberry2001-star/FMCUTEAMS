'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  BEHAVIOR_METRICS,
  CREW_LEVELS,
  SPEED_CASHIER_METRICS,
  CrewBehaviorRow,
  CrewMember,
  CrewSpeedRow,
  ReportData,
  SpeedAccuracyGroup
} from '@nso/lib/types';
import { calculateSuggestPosition, formatStandard, ICE_TEA_STANDARD_MS, KSK_STANDARD_MS } from '@nso/lib/evaluation';

function shortLabel(label: string) {
  const map: Record<string, string> = {
    'Berterimakasih': 'Terima kasih',
    'Cekatan & Inisiatif': 'Cekatan',
    'Personal Hygiene': 'Hygiene',
    'Kebersihan Area Kerja': 'Area Kerja',
    'Cross Selling': 'Cross Sell',
    'Suggestive Selling': 'Suggestive',
    'Informasikan Harga dan pembayaran': 'Info Harga',
    'Menyerahkan Barang': 'Serah Barang',
    'KSK Sesuai SOP': 'KSK SOP',
    'ICE TEA Sesuai SOP': 'ICE TEA SOP'
  };
  return map[label] ?? label;
}

// Bottom limit for table content on a 960x540 slide (keeps clear of the watermark footer).
const PDF_PAGE_HEIGHT = 540;
const PDF_CONTENT_BOTTOM = PDF_PAGE_HEIGHT - 22;

function splitBySizes<T>(items: T[], sizes: number[] | null, fallback: number): T[][] {
  if (!sizes || !sizes.length || sizes.reduce((a, b) => a + b, 0) !== items.length) return chunks(items, fallback);
  const result: T[][] = [];
  let start = 0;
  sizes.forEach((size) => { result.push(items.slice(start, start + size)); start += size; });
  return result;
}

/** Measure a rendered (unscaled) slide and return how many tbody rows fit on each page. */
function measureRowPageSizes(section: HTMLElement): number[] {
  const sectionRect = section.getBoundingClientRect();
  const ratio = sectionRect.width ? sectionRect.width / 960 : 1;
  const thead = section.querySelector('thead');
  const rows = Array.from(section.querySelectorAll<HTMLElement>('tbody > tr'));
  if (!thead || !rows.length) return [];
  const headBottom = (thead.getBoundingClientRect().bottom - sectionRect.top) / ratio;
  const available = PDF_CONTENT_BOTTOM - headBottom - 2;
  const sizes: number[] = [];
  let used = 0;
  let count = 0;
  rows.forEach((row) => {
    const rect = row.getBoundingClientRect();
    const h = rect.height / ratio;
    if (count > 0 && used + h > available) {
      sizes.push(count);
      used = 0;
      count = 0;
    }
    used += h;
    count += 1;
  });
  if (count) sizes.push(count);
  return sizes;
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function splitByWeight<T>(items: T[], options: { maxWeight: number; maxItems?: number; itemWeight: (item: T) => number }) {
  const pages: T[][] = [];
  let current: T[] = [];
  let weight = 0;
  items.forEach((item) => {
    const itemWeight = Math.max(1, options.itemWeight(item));
    if (current.length && ((options.maxItems && current.length >= options.maxItems) || weight + itemWeight > options.maxWeight)) {
      pages.push(current);
      current = [];
      weight = 0;
    }
    current.push(item);
    weight += itemWeight;
  });
  if (current.length) pages.push(current);
  return pages;
}

function lineWeight(...parts: (string | undefined)[]) {
  const total = parts.reduce((sum, part) => sum + String(part || '').replace(/<[^>]+>/g, '').length, 0);
  return 1 + Math.ceil(total / 220);
}

function splitPdfText(value: string | undefined, limit = 360) {
  const text = String(value || '').trim();
  if (!text || text === '-') return ['-'];
  const chunks: string[] = [];
  let current = '';
  const tokens = text.split(/(\s+)/);
  tokens.forEach((token) => {
    if ((current + token).length > limit && current.trim()) {
      chunks.push(current.trim());
      current = token.trimStart();
    } else {
      current += token;
    }
  });
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : ['-'];
}

function expandSummaryRows(items: ReportData['summaryItems']) {
  return items.flatMap((item) => {
    const keteranganChunks = splitPdfText(item.keterangan, 360);
    const koreksiChunks = splitPdfText(item.koreksi, 360);
    const count = Math.max(keteranganChunks.length, koreksiChunks.length);
    return Array.from({ length: count }, (_, index) => ({
      ...item,
      id: `${item.id}-summary-${index}`,
      jenis: index === 0 ? item.jenis : `${item.jenis} (lanj.)`,
      keterangan: keteranganChunks[index] || '',
      koreksi: koreksiChunks[index] || ''
    }));
  });
}

function teamTransactionWeight(transaction: SpeedAccuracyGroup['transactions'][number]) {
  const productWeight = Math.max(1, Math.ceil((transaction.products.length || 1) / 2));
  return 2 + productWeight + lineWeight(transaction.keterangan, transaction.gapFinding, transaction.correction);
}

function PdfLogo() {
  return (
    <div className="pdf-logo">
      <div className="fg" />
      <div className="fw">FamilyMart</div>
      <div className="fb" />
    </div>
  );
}

function PageTitle({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <>
      <PdfLogo />
      <div className="pdf-title-row"><h2>{children}</h2>{subtitle ? <div className="pdf-subtitle">{subtitle}</div> : null}</div>
    </>
  );
}

function Placeholder() {
  return <div className="avatar-pdf" />;
}

function resolveDriveUrl(url?: string): string | undefined {
  if (!url) return url;
  let finalUrl = url;

  // Extract Google Drive ID if present from any Drive URL format and upgrade to HD 2560px
  const driveIdMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=view&)?id=)([a-zA-Z0-9_-]+)/) ||
                       url.match(/drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/);
  if (driveIdMatch && driveIdMatch[1]) {
    finalUrl = `https://drive.google.com/thumbnail?id=${driveIdMatch[1]}&sz=w2560`;
  } else if (url.includes('drive.google.com') && url.includes('id=')) {
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      finalUrl = `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w2560`;
    }
  } else if (url.includes('drive.google.com') && url.includes('&sz=')) {
    finalUrl = url.replace(/&sz=w?\d+/, '&sz=w2560');
  }

  // Prevent html2canvas CORS issues by proxying Google Drive images through our API
  if (finalUrl.startsWith('http') && (finalUrl.includes('google') || finalUrl.includes('googleusercontent'))) {
    return `/api/proxy?url=${encodeURIComponent(finalUrl)}`;
  }
  return finalUrl;
}

function PhotoOrEmpty({ src, className = '' }: { src?: string; className?: string }) {
  if (!src) return <div className={`photo-empty ${className}`} />;
  return <div style={{ backgroundImage: `url(${resolveDriveUrl(src)})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }} className={`photo-filled ${className}`} />;
}

function checkLabel(value?: string) {
  return value === 'Y' ? 'OK' : '-';
}

function displayDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function formatCompactTime(value?: string, isTarget = false) {
  if (!value) return isTarget ? '05:00' : '-';
  const clean = String(value).trim();
  if (!clean || clean === '-') return isTarget ? '05:00' : '-';

  if (isTarget && (clean === '00:05' || clean === '00:05:00' || clean === '5' || clean === '05:00')) {
    return '05:00';
  }

  const parts = clean.split(':').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 3) {
    if (parts[0] === '00' || parts[0] === '0') {
      return `${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
    }
    return `${parts[0]}:${parts[1]}:${parts[2]}`;
  }
  if (parts.length === 2) {
    if (isTarget && (parts[0] === '00' || parts[0] === '0')) {
      return `${parts[1].padStart(2, '0')}:00`;
    }
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return clean;
}

function CoverPage({ report }: { report: ReportData }) {
  const facilitator = [report.general.facilitator, report.general.facilitator2].filter(Boolean).join(' / ') || '-';
  return (
    <section className="pdf-page cover-page-pdf">
      {report.general.coverPhotoUrl ? <div className="cover-photo" style={{ backgroundImage: `url(${resolveDriveUrl(report.general.coverPhotoUrl)})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }} /> : <div className="cover-placeholder">Foto Cover</div>}
      <div className="cover-bars"><div className="green" /><div className="blue" /></div>
      <div className="cover-left">
        <h1>{report.general.title}<br />{report.general.subtitle}</h1>
        <div className="cover-store">{report.storeName || 'Nama Store'}</div>
        <div className="cover-info">
          <span>Store Leader</span><span>:</span><b>{report.general.storeLeader || '-'}</b>
          <span>Kode Toko</span><span>:</span><b>{report.general.storeCode || report.storeKey || '-'}</b>
          <span>Area Manager</span><span>:</span><b>{report.general.areaManager || '-'}</b>
          <span>Regional Manager</span><span>:</span><b>{report.general.regionalManager || '-'}</b>
          <span>Store Type</span><span>:</span><b>{report.general.storeType || '-'}</b>
          <span>MPA/MPS</span><span>:</span><b>{report.general.mpaMps || '-'}</b>
          <span>Tanggal Pelaksanaan</span><span>:</span><b>{displayDate(report.general.date)}</b>
          <span>Fasilitator</span><span>:</span><b>{facilitator}</b>
        </div>
      </div>
    </section>
  );
}

function CrewPage({ crews }: { crews: CrewMember[] }) {
  return (
    <section className="pdf-page crew-store-page">
      <PageTitle>Crew Store</PageTitle>
      <div className="crew-single-grid-pdf">
        {crews.map((crew) => {
          const photo = crew.photoUrl || crew.groomingPhotoUrl;
          return (
            <article className="crew-card-pdf" key={crew.id}>
              <div className="crew-card-photo">
                                  {photo ? (
                    <div
                      className="crew-card-photo-cover"
                      style={{ backgroundImage: `url(${resolveDriveUrl(photo)})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", width: '100%', height: '100%' }}
                    />
                  ) : <Placeholder />}
              </div>
              <div className="crew-card-info">
                <div className="crew-card-name">{formatCrewName(crew.name)}</div>
                <div className="crew-card-label" style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '0px', alignItems: 'center' }}>
                  NIK <span className="crew-card-value">{crew.nik || '-'}</span>
                </div>
                <div className="crew-card-label" style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '0px', alignItems: 'center' }}>
                  LEVEL <span className="crew-card-value level">{crew.level.replace('NS3', 'NS 3')}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function BehaviorTable({ rows, crews }: { rows: CrewBehaviorRow[]; crews: CrewMember[] }) {
  const crewMap = new Map(crews.map((crew) => [crew.id, crew]));
  return (
    <table className="pdf-table behavior-pdf-table">
      <thead>
        <tr>
          <th className="name-col" rowSpan={2}>Nama Crew</th>
          <th className="group-head" colSpan={5}>Service</th>
          <th className="group-head" colSpan={3}>Team Work</th>
          <th className="group-head" colSpan={2}>Hygiene</th>
          <th className="group-head" colSpan={1}>Grooming</th>
          <th className="text-col" rowSpan={2}>Gap Learning</th>
          <th className="text-col" rowSpan={2}>Gap non-Learning</th>
          <th className="text-col" rowSpan={2}>Correction</th>
        </tr>
        <tr>
          {BEHAVIOR_METRICS.map((metric) => (
            <th className="rotate-head" key={metric}><div>{shortLabel(metric)}</div></th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const crew = crewMap.get(row.crewId);
          return (
            <tr key={row.crewId}>
              <td className="name-col">{formatCrewName(crew?.name)}</td>
              {BEHAVIOR_METRICS.map((metric) => <td className="check-col" key={metric}>{checkLabel(row.values[metric])}</td>)}
              <td>{row.gapLearning || '-'}</td>
              <td>{row.gapNonLearning || '-'}</td>
              <td>{row.correction || '-'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BehaviorPage({ rows, crews }: { rows: CrewBehaviorRow[]; crews: CrewMember[] }) {
  return (
    <section className="pdf-page">
      <PageTitle>Crew Behavior</PageTitle>
      <BehaviorTable rows={rows} crews={crews} />
    </section>
  );
}

function BehaviorCoverPage() {
  return (
    <section className="pdf-page team-cover-page behavior-cover-page">
      <PdfLogo />
      <div className="team-cover-content behavior-cover-content">
        <h1>Crew Behavior</h1>
        <p>Observation Summary</p>
      </div>
    </section>
  );
}

function SpeedCrewTable({ rows, crews }: { rows: CrewSpeedRow[]; crews: CrewMember[] }) {
  const crewMap = new Map(crews.map((crew) => [crew.id, crew]));
  return (
    <table className="pdf-table speed-crew-table">
      <thead>
        <tr>
          <th className="name-col" rowSpan={2}>Nama</th>
          <th className="group-head" colSpan={SPEED_CASHIER_METRICS.length}>Cashier</th>
          <th className="group-head" colSpan={4}>Barista</th>
          <th className="text-col" rowSpan={2}>Gap Learning</th>
          <th className="text-col" rowSpan={2}>Gap Non-Learning</th>
          <th className="text-col" rowSpan={2}>Correction</th>
          <th className="suggest-col" rowSpan={2}>Suggest Position</th>
        </tr>
        <tr>
          {SPEED_CASHIER_METRICS.map((metric) => <th className="rotate-head" key={metric}><div>{shortLabel(metric)}</div></th>)}
          <th className="rotate-head"><div>KSK SOP</div></th>
          <th className="rotate-head time-head"><div>Waktu KSK {formatStandard(KSK_STANDARD_MS)}</div></th>
          <th className="rotate-head"><div>ICE TEA SOP</div></th>
          <th className="rotate-head time-head"><div>Waktu ICE TEA {formatStandard(ICE_TEA_STANDARD_MS)}</div></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const crew = crewMap.get(row.crewId);
          return (
            <tr key={row.crewId}>
              <td className="name-col">{formatCrewName(crew?.name)}</td>
              {SPEED_CASHIER_METRICS.map((metric) => <td className="check-col" key={metric}>{checkLabel(row.values[metric])}</td>)}
              <td className="check-col">{checkLabel(row.values['KSK Sesuai SOP'])}</td>
              <td className="time-col">{row.kskTime || '-'}</td>
              <td className="check-col">{checkLabel(row.values['ICE TEA Sesuai SOP'])}</td>
              <td className="time-col">{row.iceTeaTime || '-'}</td>
              <td>{row.gapLearning || '-'}</td>
              <td>{row.gapNonLearning || '-'}</td>
              <td>{row.correction || '-'}</td>
              <td className="suggest-col"><b>{calculateSuggestPosition(row) || 'Belum Memenuhi'}</b></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SpeedCrewCoverPage() {
  return (
    <section className="pdf-page team-cover-page speed-crew-cover-page">
      <PdfLogo />
      <div className="team-cover-content speed-crew-cover-content">
        <h1>Speed &amp; Accuracy Crew<br /><span>(Hasil Test Per Crew)</span></h1>
      </div>
    </section>
  );
}

function SpeedCrewPage({ rows, crews }: { rows: CrewSpeedRow[]; crews: CrewMember[] }) {
  return (
    <section className="pdf-page speed-page">
      <PageTitle subtitle="(Hasil Test Per Crew)">Speed & Accuracy Crew</PageTitle>
      <SpeedCrewTable rows={rows} crews={crews} />
    </section>
  );
}

function splitTeamTransactions(group: SpeedAccuracyGroup) {
  return splitByWeight(group.transactions, {
    maxWeight: 16,
    maxItems: 3,
    itemWeight: teamTransactionWeight
  });
}



function TransactionProducts({ trx }: { trx: SpeedAccuracyGroup['transactions'][number] }) {
  if (!trx) return null;
  const products = trx.products.length ? trx.products : [{ id: `empty-${trx.id}`, product: '-', qty: 1 }];
  return (
    <table className="trx-table">
      <thead>
        <tr><th>Produk</th><th className="trx-qty-col">Qty</th></tr>
      </thead>
      <tbody>
        {products.map((item) => (
          <tr key={item.id}>
            <td className="trx-product-name">{item.product || '-'} {item.article ? `(${item.article})` : ''}</td><td className="trx-qty-cell">{item.qty || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TeamCell({ group }: { group: SpeedAccuracyGroup }) {
  const teamText = (group.roleComposition || group.teamMembers || '-').trim();
  const lines = teamText.split('\n').map((line) => line.trim()).filter(Boolean);
  const [modeLine, ...roleLines] = lines.length ? lines : ['-'];
  return (
    <div className="team-speed-header-info">
      <div className="team-mode-badge">{modeLine}</div>
      {roleLines.length ? (
        <div className="team-role-list">
          {roleLines.map((line) => <span key={line}>{line}</span>)}
        </div>
      ) : null}
    </div>
  );
}

function TeamSpeedCoverPage() {
  return (
    <section className="pdf-page team-cover-page">
      <PdfLogo />
      <div className="team-cover-content">
        <h1>Speed &amp; Accuracy Team</h1>
      </div>
    </section>
  );
}

function TeamSpeedPage({ group, transactions, pageIndex, pageTotal }: { group: SpeedAccuracyGroup; transactions: SpeedAccuracyGroup['transactions']; pageIndex?: number; pageTotal?: number }) {
  const pageLabel = pageTotal && pageTotal > 1 ? ` (${(pageIndex || 0) + 1}/${pageTotal})` : '';
  return (
    <section className="pdf-page team-speed-page">
      <PageTitle>{group.title}{pageLabel}</PageTitle>
      <TeamCell group={group} />
      <div className="trx-card-grid">
        {transactions.map((trx) => (
          <div className="trx-card" key={trx.id}>
            <div className="trx-card-header">{trx.label}</div>
            <div className="trx-card-body">
              <TransactionProducts trx={trx} />
              <div className="trx-card-timings">
                <div className="timing-box"><span>Target Waktu</span><strong>{formatCompactTime(trx.targetTime, true)}</strong></div>
                <div className="timing-box"><span>Actual Time</span><strong>{formatCompactTime(trx.actualTime)}</strong></div>
              </div>
              <div className="trx-card-notes">
                <div className="note-box"><span>Keterangan</span><p>{trx.keterangan || '-'}</p></div>
                <div className="note-box"><span>Gap Finding</span><p>{trx.gapFinding || '-'}</p></div>
                <div className="note-box"><span>Correction</span><p>{trx.correction || '-'}</p></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
function splitSummaryItems(report: ReportData) {
  return splitByWeight(expandSummaryRows(report.summaryItems), {
    maxWeight: 24, // Ditingkatkan agar tetap di 1 slide
    maxItems: 6,
    itemWeight: (item) => lineWeight(item.jenis, item.keterangan, item.koreksi)
  });
}

function SummaryTable({ items }: { items: ReportData['summaryItems'] }) {
  return (
    <table className="summary-table">
      <thead><tr><th>Jenis</th><th>Keterangan</th><th>Koreksi</th></tr></thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}><td>{item.jenis}</td><td>{item.keterangan}</td><td>{item.koreksi}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function SummaryPage({ items }: { items: ReportData['summaryItems'] }) {
  return (
    <section className="pdf-page">
      <PageTitle>Summary</PageTitle>
      <SummaryTable items={items} />
    </section>
  );
}

function SummaryCoverPage() {
  return (
    <section className="pdf-page team-cover-page summary-cover-page">
      <PdfLogo />
      <div className="team-cover-content summary-cover-content">
        <h1>Summary</h1>
        <p>Key Findings & Correction Plan</p>
      </div>
    </section>
  );
}

function PhotoCollagePage({ title, photos }: { title: string; photos: string[] }) {
  const fill = [...photos];
  while (fill.length < 10) fill.push('');
  return (
    <section className="pdf-page">
      <PageTitle>{title}</PageTitle>
      <div className="photo-grid-pdf">
        {fill.slice(0, 10).map((src, index) => src ? <div style={{ backgroundImage: `url(${resolveDriveUrl(src)})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", width: "100%", height: "100%" }} className="photo-filled" key={`${src}-${index}`} /> : <div className="photo-empty" key={`empty-${index}`} />)}
      </div>
    </section>
  );
}

function LayoutPage({ title, photos, type }: { title: string; photos: string[]; type: 'layout' | 'planogram' }) {
  const visiblePhotos = photos.slice(0, 4);
  const items = visiblePhotos.length ? visiblePhotos : [''];
  const countClass = `layout-photo-count-${items.length}`;
  return (
    <section className="pdf-page layout-photo-page">
      <PageTitle>{title}</PageTitle>
      <div className={`${type === 'layout' ? 'layout-grid-pdf' : 'planogram-grid-pdf'} ${countClass}`}>
        {items.map((src, index) => <PhotoOrEmpty src={src} key={`${src || 'empty'}-${index}`} />)}
      </div>
    </section>
  );
}

function ThankYouPage({ note }: { note: string }) {
  return <section className="pdf-page"><div className="thankyou">{note || '"Thank You"'}</div></section>;
}


function formatCrewName(name?: string) {
  if (!name) return '-';
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  return parts.map((part, i) => i >= 2 ? part.charAt(0).toUpperCase() + '.' : part).join(' ');
}

export function ReportPreview({ report, variant = 'standard' }: { report: ReportData; variant?: 'standard' | 'corporate' }) {
  const crewSortOrder = new Map(CREW_LEVELS.map((level, index) => [level, index]));
  const sortedCrews = [...report.crews].sort((a, b) => (crewSortOrder.get(a.level) ?? 999) - (crewSortOrder.get(b.level) ?? 999) || a.name.localeCompare(b.name));
  const orderedBehaviorRows = sortedCrews.map((crew) => report.behaviorRows.find((row) => row.crewId === crew.id)).filter(Boolean) as CrewBehaviorRow[];
  const orderedSpeedRows = sortedCrews.map((crew) => report.speedRows.find((row) => row.crewId === crew.id)).filter(Boolean) as CrewSpeedRow[];
  const crewChunks = chunks(sortedCrews, 10);
  const measureSignature = JSON.stringify([
    orderedBehaviorRows.map((row) => [row.crewId, row.gapLearning, row.gapNonLearning, row.correction]),
    orderedSpeedRows.map((row) => [row.crewId, row.gapLearning, row.gapNonLearning, row.correction, row.kskTime, row.iceTeaTime]),
    sortedCrews.map((crew) => crew.name),
    report.summaryItems.map((item) => [item.id, item.jenis, item.keterangan, item.koreksi]),
    variant
  ]);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<{ signature: string; behavior: number[]; speed: number[]; summary: number[] } | null>(null);
  const measuredFresh = measured?.signature === measureSignature;

  useLayoutEffect(() => {
    if (measuredFresh) return;
    const root = measureRef.current;
    if (!root) return;
    const run = () => {
      const behaviorSection = root.querySelector<HTMLElement>('[data-measure="behavior"]');
      const speedSection = root.querySelector<HTMLElement>('[data-measure="speed"]');
      const summarySection = root.querySelector<HTMLElement>('[data-measure="summary"]');
      setMeasured({
        signature: measureSignature,
        behavior: behaviorSection ? measureRowPageSizes(behaviorSection) : [],
        speed: speedSection ? measureRowPageSizes(speedSection) : [],
        summary: summarySection ? measureRowPageSizes(summarySection) : []
      });
    };
    if (typeof document !== 'undefined' && 'fonts' in document) {
      let cancelled = false;
      run();
      document.fonts.ready.then(() => { if (!cancelled) run(); }).catch(() => undefined);
      return () => { cancelled = true; };
    }
    run();
  }, [measureSignature, measuredFresh]);

  const behaviorChunks = splitBySizes(orderedBehaviorRows, measuredFresh ? measured!.behavior : null, 7);
  const speedChunks = splitBySizes(orderedSpeedRows, measuredFresh ? measured!.speed : null, 7);
  const teamPages = report.speedGroups.flatMap((group) => {
    const parts = splitTeamTransactions(group);
    return parts.length ? parts.map((transactions, index) => ({ group, transactions, index, total: parts.length })) : [];
  });
  const docChunks = chunks(report.documentationPhotos, 10);
  const layoutChunks = chunks(report.layoutCounterPhotos, 4);
  const planoChunks = chunks(report.planogramPhotos, 4);
  const summaryRows = expandSummaryRows(report.summaryItems);
  const summarySizes = measuredFresh ? measured!.summary : null;
  const summaryChunks = summarySizes && summarySizes.length && summarySizes.reduce((a, b) => a + b, 0) === summaryRows.length
    ? splitBySizes(summaryRows, summarySizes, 6)
    : splitSummaryItems(report);

  const pageItems = [
    { key: 'cover', node: <CoverPage report={report} /> },
    ...crewChunks.map((part, index) => ({ key: `crew-${index}`, node: <CrewPage crews={part} /> })),
    { key: 'behavior-cover', node: <BehaviorCoverPage /> },
    ...behaviorChunks.map((part, index) => ({ key: `behavior-${index}`, node: <BehaviorPage rows={part} crews={sortedCrews} /> })),
    { key: 'speed-crew-cover', node: <SpeedCrewCoverPage /> },
    ...speedChunks.map((part, index) => ({ key: `speed-${index}`, node: <SpeedCrewPage rows={part} crews={sortedCrews} /> })),
    { key: 'team-cover', node: <TeamSpeedCoverPage /> },
    ...teamPages.map(({ group, transactions, index, total }) => ({ key: `team-${group.id}-${index}`, node: <TeamSpeedPage group={group} transactions={transactions} pageIndex={index} pageTotal={total} /> })),
    { key: 'summary-cover', node: <SummaryCoverPage /> },
    ...summaryChunks.map((part, index) => ({ key: `summary-${index}`, node: <SummaryPage items={part} /> })),
    ...docChunks.map((part, index) => ({ key: `doc-${index}`, node: <PhotoCollagePage title="Dokumentasi Preparation & Simulasi Store" photos={part} /> })),
    ...layoutChunks.map((part, index) => ({ key: `layout-${index}`, node: <LayoutPage title="Layout Counter" photos={part} type="layout" /> })),
    ...planoChunks.map((part, index) => ({ key: `plano-${index}`, node: <LayoutPage title="Display Planogram" photos={part} type="planogram" /> })),
    { key: 'thanks', node: <ThankYouPage note={report.general.closingNote} /> }
  ];

  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    function updatePreviewScale() {
      setPreviewScale(Math.min(1, Math.max(0.32, (window.innerWidth - 24) / 960)));
    }
    updatePreviewScale();
    window.addEventListener('resize', updatePreviewScale);
    return () => window.removeEventListener('resize', updatePreviewScale);
  }, []);

  const frameStyle: CSSProperties | undefined = previewScale < 1
    ? ({ width: `${960 * previewScale}px`, height: `${540 * previewScale}px`, '--preview-scale': String(previewScale) } as CSSProperties)
    : undefined;

  return (
    <>
      <div className={`report-stage ${variant === 'corporate' ? 'corporate-report-stage' : ''}`} id="report-preview">
        {pageItems.map((item) => <div className="pdf-page-frame" style={frameStyle} key={item.key}>{item.node}</div>)}
      </div>
      {!measuredFresh ? (
        <div
          ref={measureRef}
          aria-hidden="true"
          className={`report-stage pdf-measure-stage ${variant === 'corporate' ? 'corporate-report-stage' : ''}`}
          style={{ position: 'fixed', left: -20000, top: 0, width: 960, visibility: 'hidden', pointerEvents: 'none', zIndex: -1 }}
        >
          <section className="pdf-page pdf-measure-page" data-measure="behavior" style={{ height: 'auto', minHeight: PDF_PAGE_HEIGHT, overflow: 'visible' }}>
            <PageTitle>Crew Behavior</PageTitle>
            <BehaviorTable rows={orderedBehaviorRows} crews={sortedCrews} />
          </section>
          <section className="pdf-page speed-page pdf-measure-page" data-measure="speed" style={{ height: 'auto', minHeight: PDF_PAGE_HEIGHT, overflow: 'visible' }}>
            <PageTitle subtitle="(Hasil Test Per Crew)">Speed &amp; Accuracy Crew</PageTitle>
            <SpeedCrewTable rows={orderedSpeedRows} crews={sortedCrews} />
          </section>
          <section className="pdf-page pdf-measure-page" data-measure="summary" style={{ height: 'auto', minHeight: PDF_PAGE_HEIGHT, overflow: 'visible' }}>
            <PageTitle>Summary</PageTitle>
            <SummaryTable items={summaryRows} />
          </section>
        </div>
      ) : null}
    </>
  );
}
