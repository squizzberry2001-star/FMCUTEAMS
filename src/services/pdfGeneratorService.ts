import { jsPDF } from 'jspdf';
import { VisitReportData, ObservationFinding, EvidencePhoto } from '../types/visitReport';
import {
  generateCaAssignmentBase64,
  getCaAssignmentFileName
} from './caAssignmentExcelService';

export interface HtmlSlide {
  id: string;
  title: string;
  html: string;
  pageNum: number;
  skipFooterWatermark?: boolean;
}

// Cache for loaded base64 assets
const assetCache: Record<string, string> = {};

/**
 * Convert any image URL (local asset, relative path, or data URI) to Base64
 */
export async function loadImageAsBase64(url: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:image')) return url;
  if (assetCache[url]) return assetCache[url];

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const b64 = canvas.toDataURL('image/jpeg', 0.90);
          assetCache[url] = b64;
          resolve(b64);
          return;
        }
      } catch (err) {
        console.warn('Canvas toDataURL error for', url, err);
      }
      resolve(url);
    };
    img.onerror = () => {
      console.warn('Image load error for', url);
      resolve(url);
    };
    img.src = url;
  });
}

/**
 * Format date YYYY-MM-DD -> "16 Okt 2026" & "Jumat, 16 Okt 2026"
 */
export function formatIndonesianDate(dateStr?: string, includeDay: boolean = false): string {
  if (!dateStr) return '-';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  if (isNaN(d.getTime())) return dateStr;
  const formatted = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  return includeDay ? `${days[d.getDay()]}, ${formatted}` : formatted;
}

/**
 * Format date to DD-MM-YYYY
 */
export function formatDateDdMmYyyy(dateStr?: string): string {
  if (!dateStr) {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  }
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  if (isNaN(d.getTime())) {
    const m = String(dateStr).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return `${String(m[3]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}-${m[1]}`;
    return String(dateStr).replace(/[/\\:*?"<>|]/g, '-');
  }
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

/**
 * Get standard PDF file name: Hasil Kunjungan-{Store}-{Date}.pdf
 */
export function getPdfFileName(report: VisitReportData): string {
  const cleanStore = String(report.storeName || 'STORE').replace(/[/\\:*?"<>|]/g, ' ').trim();
  const dateFormatted = formatDateDdMmYyyy(report.visitDate);
  return `Hasil Kunjungan-${cleanStore}-${dateFormatted}.pdf`;
}

/**
 * Draw an image proportionally inside a bounding box
 */
function drawImageProportional(
  doc: jsPDF,
  imgData: string,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  format: string = 'JPEG'
) {
  if (!doc || !imgData) return;
  try {
    let imgW = boxW;
    let imgH = boxH;
    const props = (doc as any).getImageProperties ? (doc as any).getImageProperties(imgData) : null;
    if (props && props.width && props.height) {
      imgW = props.width;
      imgH = props.height;
    }

    const imgAspect = imgW / imgH;
    const boxAspect = boxW / boxH;

    let drawW = boxW;
    let drawH = boxH;
    let drawX = boxX;
    let drawY = boxY;

    if (imgAspect > boxAspect) {
      drawW = boxW;
      drawH = boxW / imgAspect;
      drawY = boxY + (boxH - drawH) / 2;
    } else {
      drawH = boxH;
      drawW = boxH * imgAspect;
      drawX = boxX + (boxW - drawW) / 2;
    }

    doc.addImage(imgData, format, drawX, drawY, drawW, drawH, undefined, 'MEDIUM');
  } catch (e) {
    console.warn('drawImageProportional error:', e);
  }
}

/**
 * Convert watermark image into pure white semi-transparent silhouette
 */
let cachedWhiteWatermark: string | null = null;

async function convertImageToWhiteTransparent(dataUrl: string, opacity: number = 0.38): Promise<string> {
  if (cachedWhiteWatermark) return cachedWhiteWatermark;
  if (!dataUrl || !dataUrl.startsWith('data:image')) return dataUrl;
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 200;
        canvas.height = img.naturalHeight || img.height || 100;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const res = canvas.toDataURL('image/png');
        cachedWhiteWatermark = res;
        resolve(res);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

/**
 * Helper to draw watermark in bottom-right corner of PDF page (White Transparent)
 */
function drawPageFooter(doc: jsPDF, watermarkBase64?: string) {
  if (!doc || !watermarkBase64) return;
  try {
    const pageWidth = 320;
    const pageHeight = 180;
    const wtrW = 16;
    const wtrH = wtrW / 1.767;
    const wtrX = pageWidth - wtrW - 5;
    const wtrY = pageHeight - wtrH - 4;

    try {
      if ((doc as any).GState) {
        const gState = new (doc as any).GState({ opacity: 0.45 });
        (doc as any).saveGraphicsState();
        (doc as any).setGState(gState);
        doc.addImage(watermarkBase64, 'PNG', wtrX, wtrY, wtrW, wtrH, undefined, 'NONE');
        (doc as any).restoreGraphicsState();
      } else {
        doc.addImage(watermarkBase64, 'PNG', wtrX, wtrY, wtrW, wtrH, undefined, 'NONE');
      }
    } catch {
      doc.addImage(watermarkBase64, 'PNG', wtrX, wtrY, wtrW, wtrH, undefined, 'NONE');
    }
  } catch (e) {
    console.warn('drawPageFooter watermark error:', e);
  }
}

/**
 * Draw a corporate divider slide
 */
function drawCorporateDividerSlide(doc: jsPDF, bgImage: string, watermarkBase64?: string) {
  if (!doc) return;
  doc.addPage([320, 180], 'landscape');
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 320, 180, 'F');

  if (bgImage) {
    try {
      doc.addImage(bgImage, 'JPEG', 0, 0, 320, 180, undefined, 'MEDIUM');
    } catch (e) {
      console.warn('Divider image error:', e);
    }
  }

  drawPageFooter(doc, watermarkBase64);
}

/**
 * Split a single full QSC sheet image into Top and Bottom halves (50% / 50%)
 */
export function splitImageIntoTopAndBottom(
  base64Url: string
): Promise<{ top: string; bottom: string }> {
  return new Promise((resolve) => {
    if (!base64Url || !base64Url.startsWith('data:image')) {
      resolve({ top: '', bottom: '' });
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        // Split horizontal tepat di tengah 50%/50% dengan overlap tipis 1.5% untuk kontinuitas baris tabel
        const overlap = Math.round(h * 0.015);
        const halfH = Math.round(h / 2);

        // Top half canvas: dari y=0 hingga y=halfH + overlap
        const topCanvas = document.createElement('canvas');
        topCanvas.width = w;
        topCanvas.height = halfH + overlap;
        const topCtx = topCanvas.getContext('2d');
        if (topCtx) {
          topCtx.drawImage(img, 0, 0, w, halfH + overlap, 0, 0, w, halfH + overlap);
        }
        const topBase64 = topCanvas.toDataURL('image/jpeg', 0.90);

        // Bottom half canvas: dari y=halfH - overlap hingga bawah
        const bottomCanvas = document.createElement('canvas');
        bottomCanvas.width = w;
        bottomCanvas.height = h - (halfH - overlap);
        const bottomCtx = bottomCanvas.getContext('2d');
        if (bottomCtx) {
          bottomCtx.drawImage(
            img,
            0,
            halfH - overlap,
            w,
            h - (halfH - overlap),
            0,
            0,
            w,
            h - (halfH - overlap)
          );
        }
        const bottomBase64 = bottomCanvas.toDataURL('image/jpeg', 0.90);

        resolve({ top: topBase64, bottom: bottomBase64 });
      } catch (err) {
        console.warn('splitImageIntoTopAndBottom error:', err);
        resolve({ top: base64Url, bottom: base64Url });
      }
    };
    img.onerror = () => {
      resolve({ top: base64Url, bottom: base64Url });
    };
    img.src = base64Url;
  });
}

// ============================================================================
// CA ASSIGNMENT DIRECT EXCEL / GOOGLE SPREADSHEET URL RESOLVER
// ============================================================================
const STORE_SPREADSHEET_CACHE_KEY = 'fmcu_store_ca_spreadsheet_urls_v2';
const storeCaUrlMemoryMap = new Map<string, string>();

const VERIFIED_STORE_SPREADSHEETS: Record<string, string> = {
  '0493': 'https://docs.google.com/spreadsheets/d/1HvkvVk6iIHRTy3Ebli07tcgahtzqmnzGeGLR_Ga7PxM/edit',
  '3013': 'https://docs.google.com/spreadsheets/d/16RVoYJVHHC_w2C2PUM9iMskbTLsy_1l6kmUyd2r0WSE/edit',
  '3099': 'https://docs.google.com/spreadsheets/d/1uAlW3Z3jlGICWK-F5PCgcEqd3koo2m3hSLZunDOG8_E/edit',
};

export function saveStoreCaSpreadsheetUrl(storeCode?: string, url?: string, agendaId?: string): void {
  if (!url) return;
  const cleanUrl = String(url).trim();
  if (
    !cleanUrl ||
    cleanUrl.includes('tinyurl.com') ||
    cleanUrl === FMCU_REPORT_GDRIVE_FOLDER_URL ||
    cleanUrl.includes('15Nb6vesuhbx5yZCqHekV8Fo5e9kyB0i8') ||
    cleanUrl.includes('1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a')
  ) {
    return;
  }

  const code = String(storeCode || '').toUpperCase().trim();
  if (code) storeCaUrlMemoryMap.set(code, cleanUrl);
  if (agendaId) storeCaUrlMemoryMap.set(`AGENDA:${agendaId}`, cleanUrl);

  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORE_SPREADSHEET_CACHE_KEY);
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      if (code) map[code] = cleanUrl;
      if (agendaId) map[`AGENDA:${agendaId}`] = cleanUrl;
      localStorage.setItem(STORE_SPREADSHEET_CACHE_KEY, JSON.stringify(map));
    } catch {}
  }
}

export function getCachedStoreCaSpreadsheetUrl(storeCode?: string, agendaId?: string): string | null {
  const code = String(storeCode || '').toUpperCase().trim();
  if (agendaId && storeCaUrlMemoryMap.has(`AGENDA:${agendaId}`)) {
    return storeCaUrlMemoryMap.get(`AGENDA:${agendaId}`)!;
  }
  if (code && storeCaUrlMemoryMap.has(code)) {
    return storeCaUrlMemoryMap.get(code)!;
  }
  if (code && VERIFIED_STORE_SPREADSHEETS[code]) {
    return VERIFIED_STORE_SPREADSHEETS[code];
  }

  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORE_SPREADSHEET_CACHE_KEY);
      if (raw) {
        const map: Record<string, string> = JSON.parse(raw);
        if (agendaId && map[`AGENDA:${agendaId}`]) return map[`AGENDA:${agendaId}`];
        if (code && map[code]) return map[code];
      }
    } catch {}
  }
  return null;
}

/**
 * Resolves the direct Google Drive Excel / Spreadsheet URL for a store's CA Assignment.
 * Strictly guarantees that it NEVER returns the root GDrive folder.
 */
export function resolveDirectCaSpreadsheetUrl(report: Partial<VisitReportData>): string {
  // 1. Direct spreadsheetUrl on report
  const raw = String(report.spreadsheetUrl || (report as any).caSpreadsheetUrl || (report as any).caExcelUrl || '').trim();
  const isInvalidOrRoot =
    !raw ||
    raw.includes('tinyurl.com') ||
    raw === FMCU_REPORT_GDRIVE_FOLDER_URL ||
    raw.includes('15Nb6vesuhbx5yZCqHekV8Fo5e9kyB0i8') ||
    raw.includes('1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a');

  if (!isInvalidOrRoot) {
    saveStoreCaSpreadsheetUrl(report.storeCode, raw, report.agendaId);
    return raw;
  }

  // 2. Check GDrive Report Registry Entry
  const regEntry = getGDriveReportRegistryEntry({
    storeCode: report.storeCode,
    storeName: report.storeName,
    agendaId: report.agendaId,
  });
  if (
    regEntry?.caSpreadsheetUrl &&
    !regEntry.caSpreadsheetUrl.includes('15Nb6vesuhbx5yZCqHekV8Fo5e9kyB0i8') &&
    !regEntry.caSpreadsheetUrl.includes('1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a')
  ) {
    saveStoreCaSpreadsheetUrl(report.storeCode, regEntry.caSpreadsheetUrl, report.agendaId);
    return regEntry.caSpreadsheetUrl;
  }
  if (
    regEntry?.caExcelUrl &&
    !regEntry.caExcelUrl.includes('15Nb6vesuhbx5yZCqHekV8Fo5e9kyB0i8') &&
    !regEntry.caExcelUrl.includes('1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a')
  ) {
    saveStoreCaSpreadsheetUrl(report.storeCode, regEntry.caExcelUrl, report.agendaId);
    return regEntry.caExcelUrl;
  }

  // 3. Check persistent store cache or verified dictionary
  const cached = getCachedStoreCaSpreadsheetUrl(report.storeCode, report.agendaId);
  if (cached) {
    return cached;
  }

  // 4. If storeFolderUrl exists in registry, use the store's dedicated folder rather than root folder
  if (
    regEntry?.storeFolderUrl &&
    regEntry.storeFolderUrl !== FMCU_REPORT_GDRIVE_FOLDER_URL &&
    !regEntry.storeFolderUrl.includes('15Nb6vesuhbx5yZCqHekV8Fo5e9kyB0i8')
  ) {
    return regEntry.storeFolderUrl;
  }

  // 5. Fallback: Direct Google Drive Search link for the exact CA Store Assignment file in Drive
  const cleanStore = String(report.storeName || report.storeCode || 'Store').trim();
  const searchDirectQuery = encodeURIComponent(`"CA_Store_Assignment" "${cleanStore}"`);
  return `https://drive.google.com/drive/search?q=${searchDirectQuery}`;
}

/**
 * Generate standard corporate 16:9 Widescreen Landscape jsPDF doc
 */
export async function generatePdfDoc(report: VisitReportData): Promise<jsPDF> {
  // Pre-load essential graphic assets as Base64
  const [
    coverB64,
    rawWatermarkB64,
    dividerQscB64,
    dividerEvidenceB64,
    dividerAssignmentB64
  ] = await Promise.all([
    loadImageAsBase64(report.storeFrontPhoto || '/assets/COVER1.jpg'),
    loadImageAsBase64('/assets/WTRMRK.png'),
    loadImageAsBase64('/assets/divider-qsc-observation.jpg'),
    loadImageAsBase64('/assets/divider-finding-evidence.jpg'),
    loadImageAsBase64('/assets/divider-store-assignment.jpg')
  ]);

  const watermarkB64 = await convertImageToWhiteTransparent(rawWatermarkB64, 0.4);

  const reportTitle = 'FMCU Visit Store Report';
  const visitDateText = formatIndonesianDate(report.visitDate, false);
  const dayDateText = formatIndonesianDate(report.visitDate, true);

  const resolvedCaLink = resolveDirectCaSpreadsheetUrl(report);
  const storeInfoTag = report.storeName && report.storeCode
    ? `KHUSUS ${report.storeName.toUpperCase()} (${report.storeCode}):`
    : 'HASIL VISIT AUDIT:';

  // 16:9 landscape format [320mm, 180mm]
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [320, 180],
    compress: true
  });

  // ========================================================================
  // PAGE 1: COVER SLIDE
  // ========================================================================
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 320, 180, 'F');

  if (coverB64) {
    try {
      // Natural 3.059:1 aspect ratio of COVER1.jpg (320mm x 105mm)
      doc.addImage(coverB64, 'JPEG', 0, 0, 320, 105, undefined, 'MEDIUM');
    } catch (e) {
      console.warn('Cover image error:', e);
    }
  }

  // White base rectangle for custom metadata
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 104, 320, 76, 'F');

  // Main Report Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(0, 153, 166); // #0099A6
  doc.text(reportTitle, 12, 124);

  // Accent Line Divider (FamilyMart Green)
  doc.setDrawColor(0, 153, 68);
  doc.setLineWidth(0.6);
  doc.line(12, 129, 65, 129);

  // Left Metadata (Nama Visitor, Store, Store Head)
  const leftRows = [
    { label: 'Nama Visitor', value: report.visitorName || '-', y: 143, size: 11 },
    { label: 'Nama Store', value: report.storeName || '-', y: 152, size: 11 },
    { label: 'Store Head', value: report.storeHead || '-', y: 161, size: 10.5 }
  ];
  leftRows.forEach((row) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(row.size);
    doc.setTextColor(100, 116, 139);
    doc.text(row.label, 12, row.y);
    doc.setTextColor(148, 163, 184);
    doc.text(':', 50, row.y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(String(row.value), 56, row.y);
  });

  // Right Metadata Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.roundedRect(180, 133, 130, 42, 3, 3, 'FD');

  const rightMeta = [
    { label: 'TANGGAL VISIT', value: visitDateText, x: 188, y: 140.5 },
    { label: 'KODE TOKO', value: report.storeCode || '-', x: 253, y: 140.5 },
    { label: 'TIPE TOKO', value: report.storeType || 'CVS', x: 188, y: 154 },
    { label: 'AREA MANAGER', value: report.areaManager || '-', x: 253, y: 154 },
    { label: 'REGIONAL MANAGER', value: report.regionalManager || 'Novy Rusnani', x: 188, y: 167.5 }
  ];

  rightMeta.forEach((m) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(m.label, m.x, m.y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(15, 23, 42);
    doc.text(String(m.value), m.x, m.y + 4.8);
  });

  drawPageFooter(doc, watermarkB64);

  // ========================================================================
  // PAGE 2: QSC / FAMITRACK RESULT (LEMBAR SPLIT TETAP DITAMPILKAN BERDAMPINGAN)
  // ========================================================================
  doc.addPage([320, 180], 'landscape');
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 320, 180, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('QSC / FamiTrack Result (Lembar Penilaian)', 12, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Dokumen fisik lembar form penilaian standar mutu, kebersihan & layanan operasional toko (Split Bagian Atas & Bawah)', 12, 21.5);

  doc.setDrawColor(0, 153, 166);
  doc.setLineWidth(0.35);
  doc.line(12, 24.5, 308, 24.5);

  // Lembar QSC Tetap Ditampilkan SPLIT (Card Kiri: Bagian Atas | Card Kanan: Bagian Bawah)
  let topQscRaw = report.qscSheetTop;
  let bottomQscRaw = report.qscSheetBottom;

  // Jika top & bottom belum ada tapi ada qscSheetPhoto, auto-split
  if ((!topQscRaw || !bottomQscRaw) && report.qscSheetPhoto) {
    const split = await splitImageIntoTopAndBottom(report.qscSheetPhoto);
    topQscRaw = topQscRaw || split.top;
    bottomQscRaw = bottomQscRaw || split.bottom;
  }

  if (!topQscRaw && !bottomQscRaw) {
    topQscRaw = report.qscSheetPhoto || '';
  }

  const [topQscB64, bottomQscB64] = await Promise.all([
    loadImageAsBase64(topQscRaw),
    loadImageAsBase64(bottomQscRaw),
  ]);

  if (topQscB64 && bottomQscB64 && topQscB64 !== bottomQscB64) {
    // 2 Card SPLIT Berdampingan (Sisi Kiri & Sisi Kanan)
    const cardW = 144;
    const cardH = 147;
    const cardY = 27;

    const cards = [
      { b64: topQscB64, caption: 'Lembar Form QSC / FamiTrack #1 (Bagian Atas)', x: 12 },
      { b64: bottomQscB64, caption: 'Lembar Form QSC / FamiTrack #2 (Bagian Bawah)', x: 164 }
    ];

    cards.forEach((item) => {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.roundedRect(item.x, cardY, cardW, cardH, 3, 3, 'FD');

      if (item.b64 && item.b64.startsWith('data:image')) {
        drawImageProportional(doc, item.b64, item.x + 2, cardY + 2, cardW - 4, cardH - 10, 'JPEG');
      } else {
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(item.x + 2, cardY + 2, cardW - 4, cardH - 10, 2, 2, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Foto Lembar QSC (Kosong)', item.x + cardW / 2, cardY + cardH / 2, { align: 'center' });
      }

      // Caption Bar
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(item.x + 2, cardY + cardH - 7, cardW - 4, 5.5, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(item.caption, item.x + 5, cardY + cardH - 3.2);
    });
  } else {
    // Single Full Frame Fallback
    const boxX = 12;
    const boxY = 27;
    const boxW = 296;
    const boxH = 147;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, 'FD');

    const singleB64 = topQscB64 || bottomQscB64;
    if (singleB64 && singleB64.startsWith('data:image')) {
      drawImageProportional(doc, singleB64, boxX + 2, boxY + 2, boxW - 4, boxH - 4, 'JPEG');
    } else {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(boxX + 2, boxY + 2, boxW - 4, boxH - 4, 2, 2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(148, 163, 184);
      doc.text('Foto Lembar QSC / FamiTrack (Kosong / Belum Diunggah)', boxX + boxW / 2, boxY + boxH / 2, { align: 'center' });
    }
  }

  // ========================================================================
  // PAGE 3: GENERAL INFORMATION (Store Crew Table)
  // ========================================================================
  doc.addPage([320, 180], 'landscape');
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 320, 180, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('General Information (Store Crew)', 12, 23);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Hari, Tanggal Visit :', 12, 33);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(dayDateText, 48, 33);

  doc.setDrawColor(0, 153, 166);
  doc.setLineWidth(0.35);
  doc.line(12, 38, 308, 38);

  const tableX = 12;
  let tableY = 46;
  const colW1 = 60;
  const colW2 = 186;
  const colW3 = 50;
  const headerH = 11;

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(tableX, tableY, colW1 + colW2 + colW3, headerH, 2, 2, 'F');
  doc.rect(tableX, tableY + 5, colW1 + colW2 + colW3, headerH - 5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('ROLE / JABATAN', tableX + 6, tableY + 7.2);
  doc.text('NAMA PERSONEL', tableX + colW1 + 6, tableY + 7.2);
  doc.text('JOB LEVEL', tableX + colW1 + colW2 + colW3 / 2, tableY + 7.2, { align: 'center' });

  tableY += headerH;
  const crewRows = (report.crews && report.crews.length > 0)
    ? report.crews
    : [
        { id: '1', role: 'Store Head', name: report.storeHead || '-', jobLevel: 'NS1' },
        { id: '2', role: 'Shift Leader', name: '-', jobLevel: 'NS1' },
        { id: '3', role: 'Crew Store 1', name: '-', jobLevel: 'MG1' },
        { id: '4', role: 'Crew Store 2', name: '-', jobLevel: 'MG1' }
      ];

  const rowH = 11.5;
  crewRows.forEach((crew, idx) => {
    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(tableX, tableY, colW1 + colW2 + colW3, rowH, 'F');

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(tableX, tableY + rowH, tableX + colW1 + colW2 + colW3, tableY + rowH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(String(crew.role || '-'), tableX + 6, tableY + 7.2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(String(crew.name || '-'), tableX + colW1 + 6, tableY + 7.2);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 153, 166);
    doc.text(String(crew.jobLevel || '-'), tableX + colW1 + colW2 + colW3 / 2, tableY + 7.2, { align: 'center' });

    tableY += rowH;
  });

  drawPageFooter(doc, watermarkB64);

  // ========================================================================
  // OBSERVATION FINDINGS (QSC & OPI)
  // ========================================================================
  const validObservations = (report.observations || []).filter(
    (o) => o && o.auditFinding && o.auditFinding.trim() !== ''
  );

  const drawObservationPages = (obsList: ObservationFinding[], sectionTitle: string) => {
    const totalObs = obsList.length;
    if (totalObs === 0) return;

    const cardX = 10;
    const cardW = 300;
    const leftColX = cardX + 3;
    const rightColX = cardX + 151;
    const boxW = 146;
    const contentW = boxW - 6;

    const measureBox = (text: string, isBold: boolean = false) => {
      const str = String(text || '-').trim() || '-';
      let fontSize = isBold ? 8.0 : 7.6;
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      let lines = doc.splitTextToSize(str, contentW);

      if (lines.length > 4) {
        fontSize = isBold ? 7.2 : 6.8;
        doc.setFontSize(fontSize);
        lines = doc.splitTextToSize(str, contentW);
      }
      if (lines.length > 7) {
        fontSize = isBold ? 6.6 : 6.1;
        doc.setFontSize(fontSize);
        lines = doc.splitTextToSize(str, contentW);
      }

      const lineH = fontSize * 0.42;
      const titleH = 4.0;
      const neededH = titleH + lines.length * lineH + 2.4;

      return { fontSize, lineH, lines, neededH };
    };

    const measureCard = (obs: ObservationFinding) => {
      const fTemuan = measureBox(obs.auditFinding, true);
      const fDampak = measureBox(obs.operationalImpact, false);
      const row1H = Math.max(18, Math.max(fTemuan.neededH, fDampak.neededH));

      const fIdeal = measureBox(obs.idealCondition, false);
      const fTindakan = measureBox(obs.actionPlan, true);
      const row2H = Math.max(15, Math.max(fIdeal.neededH, fTindakan.neededH));

      const fPenyebab = measureBox(obs.rootCause, false);
      const fHasil = measureBox(obs.expectedResult, false);
      const row3H = Math.max(15, Math.max(fPenyebab.neededH, fHasil.neededH));

      const headerH = 8.5;
      const cardH = headerH + 2 + row1H + 2 + row2H + 2 + row3H + 2;

      return { cardH, row1H, row2H, row3H, fTemuan, fDampak, fIdeal, fTindakan, fPenyebab, fHasil };
    };

    const renderCard = (obs: ObservationFinding, obsIndex: number, cardY: number, cardData: any) => {
      const { cardH, row1H, row2H, row3H, fTemuan, fDampak, fIdeal, fTindakan, fPenyebab, fHasil } = cardData;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.roundedRect(cardX, cardY, cardW, cardH, 3, 3, 'FD');

      // Card Header Strip
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(cardX, cardY, cardW, 8.5, 3, 3, 'F');
      doc.rect(cardX, cardY + 4, cardW, 4.5, 'F');

      // Finding Pill Badge
      doc.setFillColor(0, 153, 166);
      doc.roundedRect(cardX + 3, cardY + 1.5, 30, 5.5, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(`Temuan ${obsIndex + 1}/${totalObs}`, cardX + 18, cardY + 5.2, { align: 'center' });

      // Deadline Pill Badge
      const dlText = obs.deadlineFormatted || formatIndonesianDate(obs.deadline, false);
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(254, 202, 202);
      doc.setLineWidth(0.2);
      doc.roundedRect(cardX + cardW - 65, cardY + 1.4, 62, 5.8, 2.9, 2.9, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(185, 28, 28);
      doc.text(`Deadline: ${dlText}`, cardX + cardW - 34, cardY + 5.3, { align: 'center' });

      let curRowY = cardY + 10.5;

      // Row 1: Temuan (Soft Amber) & Dampak
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(253, 230, 138);
      doc.setLineWidth(0.2);
      doc.roundedRect(leftColX, curRowY, boxW, row1H, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(146, 64, 14);
      doc.text('TEMUAN AUDIT', leftColX + 3, curRowY + 4.2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fTemuan.fontSize);
      doc.setTextColor(15, 23, 42);
      fTemuan.lines.forEach((l: string, lIdx: number) => {
        doc.text(l, leftColX + 3, curRowY + 8.2 + lIdx * fTemuan.lineH);
      });

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(rightColX, curRowY, boxW, row1H, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(0, 153, 166);
      doc.text('DAMPAK OPERASIONAL', rightColX + 3, curRowY + 4.2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fDampak.fontSize);
      doc.setTextColor(51, 65, 85);
      fDampak.lines.forEach((l: string, lIdx: number) => {
        doc.text(l, rightColX + 3, curRowY + 8.2 + lIdx * fDampak.lineH);
      });

      curRowY += row1H + 2;

      // Row 2: Kondisi Ideal & Tindakan Perbaikan (Soft Emerald)
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(leftColX, curRowY, boxW, row2H, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(0, 153, 166);
      doc.text('KONDISI IDEAL / STANDAR', leftColX + 3, curRowY + 4.2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fIdeal.fontSize);
      doc.setTextColor(51, 65, 85);
      fIdeal.lines.forEach((l: string, lIdx: number) => {
        doc.text(l, leftColX + 3, curRowY + 8.2 + lIdx * fIdeal.lineH);
      });

      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(167, 243, 208);
      doc.setLineWidth(0.2);
      doc.roundedRect(rightColX, curRowY, boxW, row2H, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(4, 120, 87);
      doc.text('TINDAKAN PERBAIKAN (ACTION PLAN)', rightColX + 3, curRowY + 4.2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fTindakan.fontSize);
      doc.setTextColor(6, 78, 59);
      fTindakan.lines.forEach((l: string, lIdx: number) => {
        doc.text(l, rightColX + 3, curRowY + 8.2 + lIdx * fTindakan.lineH);
      });

      curRowY += row2H + 2;

      // Row 3: Penyebab & Hasil Yang Diharapkan
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(leftColX, curRowY, boxW, row3H, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(0, 153, 166);
      doc.text('PENYEBAB (ROOT CAUSE)', leftColX + 3, curRowY + 4.2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fPenyebab.fontSize);
      doc.setTextColor(51, 65, 85);
      fPenyebab.lines.forEach((l: string, lIdx: number) => {
        doc.text(l, leftColX + 3, curRowY + 8.2 + lIdx * fPenyebab.lineH);
      });

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(rightColX, curRowY, boxW, row3H, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(0, 153, 166);
      doc.text('HASIL YANG DIHARAPKAN', rightColX + 3, curRowY + 4.2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fHasil.fontSize);
      doc.setTextColor(51, 65, 85);
      fHasil.lines.forEach((l: string, lIdx: number) => {
        doc.text(l, rightColX + 3, curRowY + 8.2 + lIdx * fHasil.lineH);
      });
    };

    let i = 0;
    while (i < totalObs) {
      doc.addPage([320, 180], 'landscape');
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 320, 180, 'F');

      // Top Corporate Header Bar
      doc.setFillColor(0, 153, 166);
      doc.rect(0, 0, 320, 15, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(255, 255, 255);
      doc.text(sectionTitle, 12, 10.2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.2);
      doc.setTextColor(100, 116, 139);
      doc.text('Ringkasan observasi dan rencana tindak lanjut perbaikan toko', 12, 21.5);

      const card1 = measureCard(obsList[i]);
      const hasNext = i + 1 < totalObs;
      let card2 = null;
      let putTwoOnPage = false;

      if (hasNext) {
        card2 = measureCard(obsList[i + 1]);
        if (card1.cardH + 4 + card2.cardH <= 144) {
          putTwoOnPage = true;
        }
      }

      if (putTwoOnPage && card2) {
        const startY = 25;
        renderCard(obsList[i], i, startY, card1);
        renderCard(obsList[i + 1], i + 1, startY + card1.cardH + 4, card2);
        i += 2;
      } else {
        const startY = 25;
        renderCard(obsList[i], i, startY, card1);
        i += 1;
      }

      drawPageFooter(doc, watermarkB64);
    }
  };

  if (validObservations.length > 0) {
    drawCorporateDividerSlide(doc, dividerQscB64, watermarkB64);
    drawObservationPages(validObservations, 'QSC Observation');
  }

  // ========================================================================
  // EVIDENCE PHOTOS (3x2 Grid per page)
  // ========================================================================
  const validEvidence = (report.evidencePhotos || []).filter(
    (p) => p && (p.photoUrl || (p.caption && p.caption.trim()))
  );

  const drawPhotoGridPages = async (photos: EvidencePhoto[], sectionTitle: string) => {
    if (!photos || photos.length === 0) return;
    for (let i = 0; i < photos.length; i += 6) {
      doc.addPage([320, 180], 'landscape');
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 320, 180, 'F');

      doc.setFillColor(0, 153, 166);
      doc.rect(0, 0, 320, 18, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.setTextColor(255, 255, 255);
      doc.text(sectionTitle, 12, 11.8);

      const chunk = photos.slice(i, i + 6);
      const colXs = [10, 111.2, 212.4];
      const rowYs = [22, 97.5];
      const cardW = 97.6;
      const cardH = 72.7;

      for (let idx = 0; idx < chunk.length; idx++) {
        const ev = chunk[idx];
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const cx = colXs[col];
        const cy = rowYs[row];

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.25);
        doc.roundedRect(cx, cy, cardW, cardH, 3, 3, 'FD');

        const imgX = cx + 2.5;
        const imgY = cy + 3;
        const imgW = 44.5;
        const imgH = 66.7;

        doc.setFillColor(247, 250, 252);
        doc.roundedRect(imgX, imgY, imgW, imgH, 2, 2, 'F');

        const evB64 = await loadImageAsBase64(ev.photoUrl);
        if (evB64 && evB64.startsWith('data:image')) {
          try {
            drawImageProportional(doc, evB64, imgX, imgY, imgW, imgH, 'JPEG');
          } catch (e) {
            console.warn('Evidence photo proportional draw error:', e);
          }
        } else {
          doc.setFillColor(241, 245, 249);
          doc.roundedRect(imgX, imgY, imgW, imgH, 2, 2, 'F');
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text('Foto Tersimpan', imgX + imgW / 2, imgY + imgH / 2 - 2, { align: 'center' });
          doc.text('(Offline / GDrive)', imgX + imgW / 2, imgY + imgH / 2 + 3, { align: 'center' });
        }

        // Caption text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.8);
        doc.setTextColor(24, 24, 27);
        const descLines = doc.splitTextToSize(String(ev.caption || '-'), 45);
        doc.text(descLines.slice(0, 10), cx + 50, cy + 10);
      }

      drawPageFooter(doc, watermarkB64);
    }
  };

  if (validEvidence.length > 0) {
    drawCorporateDividerSlide(doc, dividerEvidenceB64, watermarkB64);
    await drawPhotoGridPages(validEvidence, 'Finding Evidence - Evidence Photos');
  }

  // ========================================================================
  // CORRECTIVE ACTION PHOTOS (if any)
  // ========================================================================
  const validCa = (report.caPhotos || []).filter(
    (p) => p && (p.photoUrl || (p.caption && p.caption.trim()))
  );
  if (validCa.length > 0) {
    drawCorporateDividerSlide(doc, dividerAssignmentB64, watermarkB64);
    await drawPhotoGridPages(validCa, 'Corrective Action Evidence & Result');
  }

  // ========================================================================
  // MEKANISME PELAPORAN / STORE ASSIGNMENT
  // ========================================================================
  drawCorporateDividerSlide(doc, dividerAssignmentB64, watermarkB64);

  doc.addPage([320, 180], 'landscape');
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 320, 180, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('Mekanisme Pelaporan & Tindak Lanjut Store', 12, 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Panduan resmi pengisian form rencana perbaikan (Corrective Action) hasil audit FMCU', 12, 30);

  doc.setDrawColor(0, 153, 166);
  doc.setLineWidth(0.35);
  doc.line(12, 35, 308, 35);

  // Modern CA Link Card
  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(153, 246, 228);
  doc.setLineWidth(0.25);
  doc.roundedRect(12, 41, 296, 23, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 118, 110);
  doc.text(`LINK FILE FORM CA ASSIGNMENT (EXCEL GOOGLE DRIVE) ${storeInfoTag}`, 18, 48.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 153, 166);
  let displayLink = resolvedCaLink;
  if (doc.getTextWidth(displayLink) > 280) {
    while (displayLink.length > 10 && doc.getTextWidth(displayLink + '...') > 280) {
      displayLink = displayLink.slice(0, -1);
    }
    displayLink = displayLink + '...';
  }
  doc.textWithLink(displayLink, 18, 57, { url: resolvedCaLink });

  // 4-Step Action Card
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.roundedRect(12, 69, 296, 95, 3, 3, 'FD');

  const steps = [
    {
      num: '1',
      title: 'Buka & Isi Formulir di Spreadsheet',
      desc: 'Buka dan isi langsung di spreadsheet file formulir perbaikan toko melalui link di atas.'
    },
    {
      num: '2',
      title: 'Isi Rencana & Bukti Perbaikan',
      desc: 'Tim store mengisi form tersebut berdasarkan temuan yang telah ditunjukkan pada file laporan ini.'
    },
    {
      num: '3',
      title: 'Patuhi Batas Waktu (Deadline)',
      desc: 'Tindakan perbaikan WAJIB dilakukan sebelum deadline yang diberikan oleh FMCU / Regional Bestie.'
    },
    {
      num: '4',
      title: 'Validasi & Konfirmasi Tindak Lanjut',
      desc: 'Forward email ini sebagai validasi bahwa sudah melakukan tindak lanjut hasil visit.'
    }
  ];

  steps.forEach((s, idx) => {
    const stepStartY = 74 + idx * 22;
    const circleX = 23;
    const circleY = stepStartY + 4.5;
    const circleRadius = 4.2;

    doc.setFillColor(0, 153, 166);
    doc.circle(circleX, circleY, circleRadius, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(s.num, circleX, circleY + 0.25, { align: 'center', baseline: 'middle' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(s.title, 33, stepStartY + 3.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(71, 85, 105);
    const descLines = doc.splitTextToSize(s.desc, 268);
    doc.text(descLines, 33, stepStartY + 8.2);

    if (idx < steps.length - 1) {
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(33, stepStartY + 17.5, 302, stepStartY + 17.5);
    }
  });

  drawPageFooter(doc, watermarkB64);

  return doc;
}

/**
 * Generate and trigger download of the PDF file
 */
export async function downloadReportPdf(report: VisitReportData): Promise<void> {
  const doc = await generatePdfDoc(report);
  const fileName = getPdfFileName(report);
  doc.save(fileName);
}

/**
 * Build HTML slides array matching the continuous 16:9 widescreen layout
 */
export function buildHtmlSlides(report: VisitReportData): HtmlSlide[] {
  const reportTitle = 'FMCU Visit Store Report';
  const visitDateText = formatIndonesianDate(report.visitDate, false);
  const dayDateText = formatIndonesianDate(report.visitDate, true);

  const resolvedCaLink = resolveDirectCaSpreadsheetUrl(report);
  const storeInfoTag = report.storeName && report.storeCode
    ? `KHUSUS ${report.storeName.toUpperCase()} (${report.storeCode}):`
    : 'HASIL VISIT AUDIT:';

  const slides: HtmlSlide[] = [];

  // Helper for divider slide
  const buildDividerSlideHtml = (imageSrc: string, title: string) => `
    <div class="w-full h-full bg-white relative overflow-hidden flex items-center justify-center">
      <img src="${imageSrc || ''}" class="w-full h-full object-cover" alt="${title || 'Divider'}" />
    </div>
  `;

  // 1. Cover Slide
  slides.push({
    id: 'cover',
    title: 'Cover - FMCU Visit Store Report',
    pageNum: slides.length + 1,
    html: `
      <div class="w-full h-full bg-white flex flex-col justify-between relative overflow-hidden">
        <div class="w-full h-[57%] overflow-hidden bg-slate-100">
          <img src="${report.storeFrontPhoto || '/assets/COVER1.jpg'}" class="w-full h-full object-cover object-top" alt="FamilyMart Banner" />
        </div>
        <div class="w-full h-[43%] px-[3.8%] pt-[1.8%] pb-[3%] flex flex-col justify-between bg-white">
          <h1 class="text-[#0099A6] font-extrabold text-[clamp(11px,2.7cqw,32px)] tracking-tight">${reportTitle}</h1>
          <div class="grid grid-cols-12 gap-4 items-center my-auto">
            <div class="col-span-6 space-y-[0.8cqw] text-[clamp(7.5px,1.15cqw,15px)]">
              <div class="grid grid-cols-12">
                <span class="col-span-4 text-slate-500 font-semibold">Nama Visitor</span>
                <span class="col-span-1 text-slate-400">:</span>
                <span class="col-span-7 font-bold text-slate-900">${report.visitorName || '-'}</span>
              </div>
              <div class="grid grid-cols-12">
                <span class="col-span-4 text-slate-500 font-semibold">Nama Store</span>
                <span class="col-span-1 text-slate-400">:</span>
                <span class="col-span-7 font-bold text-slate-900">${report.storeName || '-'}</span>
              </div>
              <div class="grid grid-cols-12">
                <span class="col-span-4 text-slate-500 font-semibold">Store Head</span>
                <span class="col-span-1 text-slate-400">:</span>
                <span class="col-span-7 font-bold text-slate-900">${report.storeHead || '-'}</span>
              </div>
            </div>
            <div class="col-span-6 bg-[#F8FAFC] border border-slate-200 rounded-xl p-[1.2cqw] grid grid-cols-2 gap-y-[0.6cqw] gap-x-3 text-[clamp(6px,0.85cqw,12px)]">
              <div>
                <div class="text-slate-400 font-bold uppercase text-[0.72cqw]">TANGGAL VISIT</div>
                <div class="text-slate-900 font-bold mt-0.5">${visitDateText}</div>
              </div>
              <div>
                <div class="text-slate-400 font-bold uppercase text-[0.72cqw]">KODE TOKO</div>
                <div class="text-slate-900 font-bold mt-0.5">${report.storeCode || '-'}</div>
              </div>
              <div>
                <div class="text-slate-400 font-bold uppercase text-[0.72cqw]">TIPE TOKO</div>
                <div class="text-slate-900 font-bold mt-0.5">${report.storeType || 'CVS'}</div>
              </div>
              <div>
                <div class="text-slate-400 font-bold uppercase text-[0.72cqw]">AREA MANAGER</div>
                <div class="text-slate-900 font-bold mt-0.5">${report.areaManager || '-'}</div>
              </div>
              <div class="col-span-2 pt-1 border-t border-slate-200/60">
                <div class="text-slate-400 font-bold uppercase text-[0.72cqw]">REGIONAL MANAGER</div>
                <div class="text-slate-900 font-bold mt-0.5">${report.regionalManager || 'Novy Rusnani'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  });

  // 2. QSC / FamiTrack Result (Lembar Split Tetap Ditampilkan)
  const hasSplitInReport = Boolean(report.qscSheetTop && report.qscSheetBottom);
  const qscTopImg = report.qscSheetTop || report.qscSheetPhoto;
  const qscBottomImg = report.qscSheetBottom;

  slides.push({
    id: 'qsc',
    title: 'QSC / FamiTrack Result',
    pageNum: slides.length + 1,
    skipFooterWatermark: true,
    html: `
      <div class="w-full h-full bg-white px-[3.2%] py-[2.8%] flex flex-col justify-between">
        <div>
          <h2 class="text-[#0099A6] font-extrabold text-[clamp(10px,2.2cqw,26px)]">QSC / FamiTrack Result (Lembar Penilaian)</h2>
          <p class="text-slate-500 font-medium text-[clamp(6.5px,0.85cqw,11px)]">Dokumen fisik lembar form penilaian standar mutu & operasional toko (Split Bagian Atas & Bawah)</p>
          <div class="w-full h-[2px] bg-[#0099A6] mt-[0.8cqw]"></div>
        </div>
        ${hasSplitInReport ? `
          <div class="flex-1 my-2 grid grid-cols-2 gap-3 overflow-hidden">
            <!-- Card 1: Bagian Atas -->
            <div class="border border-slate-200 rounded-xl p-[0.8cqw] bg-slate-50 flex flex-col justify-between overflow-hidden">
              <div class="flex-1 w-full flex items-center justify-center overflow-hidden">
                ${qscTopImg
                  ? `<img src="${qscTopImg}" class="w-full h-full object-contain" alt="Lembar QSC Bagian Atas" />`
                  : `<div class="flex flex-col items-center justify-center text-slate-400 p-3 text-center">
                       <span class="text-[clamp(8px,1cqw,14px)] font-bold text-slate-600">Lembar Form QSC #1 (Bagian Atas)</span>
                       <span class="text-[clamp(6px,0.75cqw,10px)] text-slate-400 mt-0.5">Belum ada foto</span>
                     </div>`}
              </div>
              <div class="text-[clamp(6.5px,0.8cqw,11px)] text-slate-700 font-semibold truncate pt-1 border-t border-slate-200 mt-1 flex items-center justify-between">
                <span>Lembar Form QSC #1 (Bagian Atas)</span>
                <span class="text-slate-400 font-medium">Split Bagian Atas</span>
              </div>
            </div>

            <!-- Card 2: Bagian Bawah -->
            <div class="border border-slate-200 rounded-xl p-[0.8cqw] bg-slate-50 flex flex-col justify-between overflow-hidden">
              <div class="flex-1 w-full flex items-center justify-center overflow-hidden">
                ${qscBottomImg
                  ? `<img src="${qscBottomImg}" class="w-full h-full object-contain" alt="Lembar QSC Bagian Bawah" />`
                  : `<div class="flex flex-col items-center justify-center text-slate-400 p-3 text-center">
                       <span class="text-[clamp(8px,1cqw,14px)] font-bold text-slate-600">Lembar Form QSC #2 (Bagian Bawah)</span>
                       <span class="text-[clamp(6px,0.75cqw,10px)] text-slate-400 mt-0.5">Belum ada foto</span>
                     </div>`}
              </div>
              <div class="text-[clamp(6.5px,0.8cqw,11px)] text-slate-700 font-semibold truncate pt-1 border-t border-slate-200 mt-1 flex items-center justify-between">
                <span>Lembar Form QSC #2 (Bagian Bawah)</span>
                <span class="text-slate-400 font-medium">Split Bagian Bawah</span>
              </div>
            </div>
          </div>
        ` : `
          <div class="flex-1 my-2 border border-slate-200 rounded-xl p-[0.8cqw] bg-slate-50 flex flex-col justify-between overflow-hidden">
            <div class="flex-1 w-full flex items-center justify-center overflow-hidden">
              ${(report.qscSheetPhoto || report.qscSheetTop || report.qscSheetBottom)
                ? `<img src="${report.qscSheetPhoto || report.qscSheetTop || report.qscSheetBottom}" class="w-full h-full object-contain" alt="Lembar QSC" />`
                : `<div class="flex flex-col items-center justify-center text-slate-400 p-3 text-center">
                     <span class="text-[clamp(8px,1cqw,14px)] font-bold text-slate-600">Lembar Form QSC / FamiTrack</span>
                     <span class="text-[clamp(6px,0.75cqw,10px)] text-slate-400 mt-0.5">Belum ada foto</span>
                   </div>`}
            </div>
            <div class="text-[clamp(6.5px,0.8cqw,11px)] text-slate-700 font-semibold truncate pt-1 border-t border-slate-200 mt-1 flex items-center justify-between">
              <span>Lembar Form QSC / FamiTrack</span>
              <span class="text-slate-400 font-medium">Fit Halaman Dokumen</span>
            </div>
          </div>
        `}
      </div>
    `
  });

  // 3. General Information (Store Crew Table)
  const crewRows = (report.crews && report.crews.length > 0)
    ? report.crews
    : [
        { id: '1', role: 'Store Head', name: report.storeHead || '-', jobLevel: 'NS1' },
        { id: '2', role: 'Shift Leader', name: '-', jobLevel: 'NS1' },
        { id: '3', role: 'Crew Store 1', name: '-', jobLevel: 'MG1' },
        { id: '4', role: 'Crew Store 2', name: '-', jobLevel: 'MG1' }
      ];

  slides.push({
    id: 'general-info',
    title: 'General Information (Crew Store)',
    pageNum: slides.length + 1,
    html: `
      <div class="w-full h-full bg-white px-[3.2%] py-[3%] flex flex-col justify-between">
        <div>
          <h2 class="text-slate-800 font-extrabold text-[clamp(10px,1.9cqw,24px)]">General Information</h2>
          <div class="mt-[1.4cqw] text-[clamp(7.5px,1.15cqw,15px)] text-slate-700">
            <span>Hari, Tanggal</span>
            <span class="mx-4">:</span>
            <strong class="text-slate-900">${dayDateText}</strong>
          </div>
          <div class="mt-[1.8cqw] overflow-hidden border border-slate-300 rounded-xl">
            <table class="w-full border-collapse text-[clamp(6.5px,1.05cqw,13px)]">
              <thead>
                <tr class="bg-[#0F172A] text-white font-bold">
                  <th class="py-[0.8cqw] px-3 w-[20%] text-left">Role / Jabatan</th>
                  <th class="py-[0.8cqw] px-3 w-[63%] text-left">Nama Personel</th>
                  <th class="py-[0.8cqw] px-3 w-[17%] text-center">Job Level</th>
                </tr>
              </thead>
              <tbody>
                ${crewRows.map((c, idx) => `
                  <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'} border-t border-slate-200">
                    <td class="py-[0.7cqw] px-3 font-bold text-slate-900">${c.role || '-'}</td>
                    <td class="py-[0.7cqw] px-3 text-slate-800">${c.name || '-'}</td>
                    <td class="py-[0.7cqw] px-3 text-center font-bold text-[#0099A6]">${c.jobLevel || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `
  });

  // Helper for Observation Slide HTML
  const buildObsSlideHtml = (titleText: string, pair: ObservationFinding[], startIdx: number, totalCount: number) => `
    <div class="w-full h-full bg-white flex flex-col justify-between">
      <div class="bg-[#0099A6] text-white px-[3.5%] py-[0.8cqw] font-bold text-[clamp(8px,1.2cqw,15px)]">
        ${titleText}
      </div>
      <div class="px-[2.6%] pt-[0.5cqw] pb-[0.5cqw] flex-1 flex flex-col justify-start gap-[1.1cqw]">
        <div class="text-[clamp(6px,0.85cqw,11px)] text-slate-500">Ringkasan observasi - beberapa temuan per halaman</div>
        ${pair.map((obs, idx) => {
          const dl = obs.deadlineFormatted || formatIndonesianDate(obs.deadline, false);
          return `
            <div class="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-xs">
              <div class="bg-[#0099A6] text-white px-3 py-[0.35cqw] flex items-center justify-between">
                <span class="font-bold text-[clamp(6.5px,0.95cqw,12px)]">Temuan ${startIdx + idx + 1}/${totalCount}</span>
                <span class="bg-white text-rose-700 font-bold text-[clamp(5.5px,0.72cqw,9px)] px-2 py-0.5 rounded-full">
                  Deadline Perbaikan: ${dl}
                </span>
              </div>
              <div class="p-[0.6cqw] grid grid-cols-2 gap-[0.55cqw] text-[clamp(5.5px,0.78cqw,10px)] leading-tight">
                <div class="bg-[#FEF3C7] border border-amber-200 rounded p-[0.5cqw]">
                  <div class="font-bold text-amber-800">Temuan Audit</div>
                  <div class="font-bold text-slate-900 mt-0.5 whitespace-pre-line">${obs.auditFinding || '-'}</div>
                </div>
                <div class="bg-slate-50 border border-slate-200 rounded p-[0.5cqw]">
                  <div class="font-bold text-[#008291]">Dampak Operasional</div>
                  <div class="text-slate-800 mt-0.5 whitespace-pre-line">${obs.operationalImpact || '-'}</div>
                </div>
                <div class="bg-slate-50 border border-slate-200 rounded p-[0.5cqw]">
                  <div class="font-bold text-[#008291]">Kondisi Ideal / Standar</div>
                  <div class="text-slate-800 mt-0.5 whitespace-pre-line">${obs.idealCondition || '-'}</div>
                </div>
                <div class="bg-[#ECFDF5] border border-emerald-200 rounded p-[0.5cqw]">
                  <div class="font-bold text-emerald-800">Tindakan Perbaikan (Action Plan)</div>
                  <div class="font-bold text-emerald-950 mt-0.5 whitespace-pre-line">${obs.actionPlan || '-'}</div>
                </div>
                <div class="bg-slate-50 border border-slate-200 rounded p-[0.5cqw]">
                  <div class="font-bold text-[#008291]">Penyebab (Root Cause)</div>
                  <div class="text-slate-800 mt-0.5 whitespace-pre-line">${obs.rootCause || '-'}</div>
                </div>
                <div class="bg-slate-50 border border-slate-200 rounded p-[0.5cqw]">
                  <div class="font-bold text-[#008291]">Hasil Yang Diharapkan</div>
                  <div class="text-slate-800 mt-0.5 whitespace-pre-line">${obs.expectedResult || '-'}</div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // 4. Observations (QSC & OPI)
  const validObservations = (report.observations || []).filter(
    (o) => o && o.auditFinding && o.auditFinding.trim() !== ''
  );

  if (validObservations.length > 0) {
    slides.push({
      id: 'divider-obs',
      title: 'Divider - QSC Observation',
      pageNum: slides.length + 1,
      html: buildDividerSlideHtml('/assets/divider-qsc-observation.jpg', 'QSC Observation')
    });

    for (let i = 0; i < validObservations.length; i += 2) {
      const pair = validObservations.slice(i, i + 2);
      slides.push({
        id: `obs-${i}`,
        title: `QSC Observation (Temuan ${i + 1}-${Math.min(i + 2, validObservations.length)})`,
        pageNum: slides.length + 1,
        html: buildObsSlideHtml('QSC Observation', pair, i, validObservations.length)
      });
    }
  }

  // Helper for Photo Grid Slide HTML (3x2)
  const buildPhotoGridSlideHtml = (titleText: string, chunk: EvidencePhoto[]) => `
    <div class="w-full h-full bg-white flex flex-col justify-between">
      <div class="bg-[#0099A6] text-white px-[3.5%] py-[1cqw] font-bold text-[clamp(10px,1.2cqw,16px)]">
        ${titleText}
      </div>
      <div class="px-[3%] py-[1.2cqw] flex-1 grid grid-cols-3 grid-rows-2 gap-[1.2cqw]">
        ${chunk.map((ev) => `
          <div class="border border-slate-300 rounded-xl p-[0.7cqw] grid grid-cols-12 gap-[0.8cqw] bg-white overflow-hidden shadow-2xs">
            <div class="col-span-6 bg-slate-100 rounded-lg overflow-hidden h-full">
              ${ev.photoUrl ? `<img src="${ev.photoUrl}" class="w-full h-full object-cover" alt="Evidence" />` : ''}
            </div>
            <div class="col-span-6 text-[clamp(6px,0.82cqw,11px)] text-slate-900 pt-1 leading-snug overflow-hidden">
              ${ev.caption || '-'}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // 5. Finding Evidence Photos
  const validEvidence = (report.evidencePhotos || []).filter(
    (p) => p && (p.photoUrl || (p.caption && p.caption.trim()))
  );

  if (validEvidence.length > 0) {
    slides.push({
      id: 'divider-ev',
      title: 'Divider - Finding Evidence',
      pageNum: slides.length + 1,
      html: buildDividerSlideHtml('/assets/divider-finding-evidence.jpg', 'Finding Evidence')
    });

    for (let i = 0; i < validEvidence.length; i += 6) {
      const chunk = validEvidence.slice(i, i + 6);
      slides.push({
        id: `ev-${i}`,
        title: `Finding Evidence Photos (${i + 1}-${Math.min(i + 6, validEvidence.length)})`,
        pageNum: slides.length + 1,
        html: buildPhotoGridSlideHtml('Finding Evidence - Evidence Photos', chunk)
      });
    }
  }

  // 6. CA Photos (if any)
  const validCa = (report.caPhotos || []).filter(
    (p) => p && (p.photoUrl || (p.caption && p.caption.trim()))
  );
  if (validCa.length > 0) {
    slides.push({
      id: 'divider-ca',
      title: 'Divider - Corrective Action',
      pageNum: slides.length + 1,
      html: buildDividerSlideHtml('/assets/divider-store-assignment.jpg', 'Corrective Action')
    });

    for (let i = 0; i < validCa.length; i += 6) {
      const chunk = validCa.slice(i, i + 6);
      slides.push({
        id: `ca-${i}`,
        title: `CA Evidence & Result (${i + 1}-${Math.min(i + 6, validCa.length)})`,
        pageNum: slides.length + 1,
        html: buildPhotoGridSlideHtml('Corrective Action Evidence & Result - Evidence Photos', chunk)
      });
    }
  }

  // 7. Store Assignment / Mekanisme Pelaporan
  slides.push({
    id: 'divider-assignment',
    title: 'Divider - Store Assignment',
    pageNum: slides.length + 1,
    html: buildDividerSlideHtml('/assets/divider-store-assignment.jpg', 'Store Assignment')
  });

  slides.push({
    id: 'assignment',
    title: 'Mekanisme Pelaporan',
    pageNum: slides.length + 1,
    html: `
      <div class="w-full h-full bg-white px-[3.5%] py-[3.8%] flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between pb-2 mb-3 border-b border-teal-600/30">
            <div>
              <h2 class="text-slate-900 font-extrabold text-[clamp(11px,1.8cqw,24px)] tracking-tight">
                Mekanisme Pelaporan & Tindak Lanjut Store
              </h2>
              <p class="text-slate-500 font-medium text-[clamp(7px,0.85cqw,12px)]">
                Panduan resmi pengisian form rencana perbaikan (Corrective Action) hasil audit FMCU
              </p>
            </div>
            <span class="px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-[#0099A6] text-[clamp(6.5px,0.75cqw,10px)] font-bold uppercase">
              Step by Step
            </span>
          </div>

          <!-- Modern CA Link Card -->
          <div class="bg-teal-50/70 border border-teal-200/80 rounded-xl p-[2%] mb-3.5 flex flex-col justify-center">
            <span class="text-[clamp(6px,0.7cqw,10px)] font-bold text-teal-800 uppercase tracking-wider mb-0.5">
              LINK FILE FORM CA ASSIGNMENT (EXCEL GOOGLE DRIVE) ${storeInfoTag}
            </span>
            <a href="${resolvedCaLink}" target="_blank" rel="noopener noreferrer" class="text-[#0099A6] font-extrabold text-[clamp(8px,1.25cqw,17px)] hover:underline break-all truncate">
              ${resolvedCaLink}
            </a>
          </div>

          <!-- Corporate Step List Card -->
          <div class="bg-white border border-slate-200/90 rounded-xl p-[2.5%] space-y-[1.2cqw]">
            <div class="flex items-start gap-3 pb-[1cqw] border-b border-slate-100">
              <div class="w-6 h-6 rounded-full bg-[#0099A6] text-white flex items-center justify-center font-bold text-[clamp(7px,0.9cqw,12px)] shrink-0 shadow-xs">
                1
              </div>
              <div>
                <h4 class="font-bold text-slate-900 text-[clamp(7.5px,1cqw,14px)] leading-snug">
                  Buka & Isi Formulir di Spreadsheet
                </h4>
                <p class="text-slate-600 text-[clamp(6.5px,0.85cqw,12px)] leading-relaxed mt-0.5">
                  Buka dan isi langsung di spreadsheet file formulir perbaikan toko melalui link di atas.
                </p>
              </div>
            </div>

            <div class="flex items-start gap-3 pb-[1cqw] border-b border-slate-100">
              <div class="w-6 h-6 rounded-full bg-[#0099A6] text-white flex items-center justify-center font-bold text-[clamp(7px,0.9cqw,12px)] shrink-0 shadow-xs">
                2
              </div>
              <div>
                <h4 class="font-bold text-slate-900 text-[clamp(7.5px,1cqw,14px)] leading-snug">
                  Isi Rencana & Bukti Perbaikan
                </h4>
                <p class="text-slate-600 text-[clamp(6.5px,0.85cqw,12px)] leading-relaxed mt-0.5">
                  Tim store mengisi form tersebut berdasarkan temuan yang telah ditunjukkan pada file laporan ini.
                </p>
              </div>
            </div>

            <div class="flex items-start gap-3 pb-[1cqw] border-b border-slate-100">
              <div class="w-6 h-6 rounded-full bg-[#0099A6] text-white flex items-center justify-center font-bold text-[clamp(7px,0.9cqw,12px)] shrink-0 shadow-xs">
                3
              </div>
              <div>
                <h4 class="font-bold text-slate-900 text-[clamp(7.5px,1cqw,14px)] leading-snug">
                  Patuhi Batas Waktu (Deadline)
                </h4>
                <p class="text-slate-600 text-[clamp(6.5px,0.85cqw,12px)] leading-relaxed mt-0.5">
                  Tindakan perbaikan WAJIB dilakukan sebelum deadline yang diberikan oleh FMCU / Regional Bestie.
                </p>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <div class="w-6 h-6 rounded-full bg-[#0099A6] text-white flex items-center justify-center font-bold text-[clamp(7px,0.9cqw,12px)] shrink-0 shadow-xs">
                4
              </div>
              <div>
                <h4 class="font-bold text-slate-900 text-[clamp(7.5px,1cqw,14px)] leading-snug">
                  Validasi & Konfirmasi Tindak Lanjut
                </h4>
                <p class="text-slate-600 text-[clamp(6.5px,0.85cqw,12px)] leading-relaxed mt-0.5">
                  Forward email ini sebagai validasi bahwa sudah melakukan tindak lanjut hasil visit.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  });

  // Attach watermark to slides (except those with skipFooterWatermark) - Pure White Transparent
  const watermarkSnippet = `
    <div class="absolute bottom-[1.2%] right-[1.2%] pointer-events-none select-none z-30" title="WTRMRK">
      <img src="/assets/WTRMRK.png" class="h-[clamp(8px,1.2cqw,15px)] w-auto object-contain" style="filter: brightness(0) invert(1); opacity: 0.35;" alt="WTRMRK" />
    </div>
  `;

  slides.forEach((s) => {
    if (s && s.html && !s.skipFooterWatermark) {
      const lastDivIdx = s.html.lastIndexOf('</div>');
      if (lastDivIdx !== -1) {
        s.html = s.html.slice(0, lastDivIdx) + watermarkSnippet + s.html.slice(lastDivIdx);
      }
    }
  });

  return slides;
}

// ============================================================================
// GOOGLE DRIVE & GOOGLE APPS SCRIPT (GAS) LIVE CONNECTION
// ============================================================================

export const FMCU_REPORT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbxC29L4Cb3NNvUl4IRe0MGDnrluvCvv1neuTjQieA8j7C4n7zgGfQ3dMA8SLXYBG0AWtw/exec';

export const FMCU_REPORT_GDRIVE_FOLDER_ID = '15Nb6vesuhbx5yZCqHekV8Fo5e9kyB0i8';

export const FMCU_REPORT_GDRIVE_FOLDER_URL =
  'https://drive.google.com/drive/u/3/folders/15Nb6vesuhbx5yZCqHekV8Fo5e9kyB0i8';

export interface GDriveSyncResult {
  success: boolean;
  pdfUrl?: string;
  qscPdfUrl?: string;
  caSpreadsheetUrl?: string;
  caExcelUrl?: string;
  storeFolderUrl?: string;
  visitorFolderUrl?: string;
  yearFolderUrl?: string;
  message?: string;
}

/**
 * Format Nama File Lembar QSC: "Lembar QSC-FAMITRACK-{nama store}-{DD-MM-YYYY}.pdf"
 */
export function getVerticalQscFileName(report: VisitReportData): string {
  if (!report) return 'Lembar QSC-Fami track-STORE.pdf';
  const cleanStore = String(report.storeName || 'STORE').replace(/[/\\:*?"<>|]/g, ' ').trim();
  const d = report.visitDate ? new Date(report.visitDate) : new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `Lembar QSC-Fami track-${cleanStore}-${dd}-${mm}-${yyyy}.pdf`;
}

/**
 * Stitches two images vertically (Top & Bottom) into a single seamless vertical image
 */
export async function stitchTwoImagesVertically(topSrc: string, bottomSrc: string): Promise<string> {
  const [topB64, bottomB64] = await Promise.all([
    loadImageAsBase64(topSrc),
    loadImageAsBase64(bottomSrc)
  ]);

  if (!topB64 && !bottomB64) return '';
  if (!topB64) return bottomB64;
  if (!bottomB64) return topB64;

  return new Promise((resolve) => {
    const imgTop = new Image();
    const imgBottom = new Image();
    let loadedCount = 0;

    const onBothLoaded = () => {
      loadedCount++;
      if (loadedCount < 2) return;

      try {
        const topW = imgTop.naturalWidth || 1200;
        const topH = imgTop.naturalHeight || 800;
        const bottomW = imgBottom.naturalWidth || 1200;
        const bottomH = imgBottom.naturalHeight || 800;

        const targetW = Math.max(topW, bottomW, 1200);
        const scaledTopH = Math.round((topH * targetW) / topW);
        const scaledBottomH = Math.round((bottomH * targetW) / bottomW);
        const totalH = scaledTopH + scaledBottomH;

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = totalH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(topB64);
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, totalH);

        // Draw top image
        ctx.drawImage(imgTop, 0, 0, targetW, scaledTopH);
        // Draw bottom image seamlessly directly underneath
        ctx.drawImage(imgBottom, 0, scaledTopH, targetW, scaledBottomH);

        // Thin subtle separator line
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, scaledTopH);
        ctx.lineTo(targetW, scaledTopH);
        ctx.stroke();

        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (err) {
        console.warn('stitchTwoImagesVertically error:', err);
        resolve(topB64 || bottomB64);
      }
    };

    imgTop.onload = onBothLoaded;
    imgTop.onerror = () => resolve(bottomB64 || topB64);

    imgBottom.onload = onBothLoaded;
    imgBottom.onerror = () => resolve(topB64 || bottomB64);

    imgTop.src = topB64;
    imgBottom.src = bottomB64;
  });
}

/**
 * Generate Vertical QSC Collage PDF (A4 Portrait, Mendukung Lembar Split Atas & Bawah Full Resolusi)
 */
export async function generateVerticalQscCollagePdf(report: VisitReportData): Promise<jsPDF | null> {
  let topSrc = report.qscSheetTop;
  let bottomSrc = report.qscSheetBottom;

  if ((!topSrc || !bottomSrc) && report.qscSheetPhoto) {
    const split = await splitImageIntoTopAndBottom(report.qscSheetPhoto);
    topSrc = topSrc || split.top;
    bottomSrc = bottomSrc || split.bottom;
  }

  const validPhotos: { b64: string; title: string }[] = [];

  if (topSrc) {
    const b64 = await loadImageAsBase64(topSrc);
    if (b64 && b64.startsWith('data:image')) {
      validPhotos.push({
        b64,
        title: bottomSrc && bottomSrc !== topSrc
          ? 'Lembar Form QSC #1 (Bagian Atas)'
          : 'Lembar Form QSC (Utuh)'
      });
    }
  }

  if (bottomSrc && bottomSrc !== topSrc) {
    const b64 = await loadImageAsBase64(bottomSrc);
    if (b64 && b64.startsWith('data:image')) {
      validPhotos.push({
        b64,
        title: 'Lembar Form QSC #2 (Bagian Bawah)'
      });
    }
  }

  if (validPhotos.length === 0) {
    const single = report.qscSheetPhoto || report.qscSheetTop || report.qscSheetBottom;
    if (!single) return null;
    const b64 = await loadImageAsBase64(single);
    if (!b64 || !b64.startsWith('data:image')) return null;
    validPhotos.push({ b64, title: 'Lembar Form QSC (Utuh)' });
  }

  // A4 Portrait [210mm x 297mm]
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const cleanStore = String(report.storeName || 'STORE').replace(/[/\\:*?"<>|]/g, ' ').trim();
  const dateFormatted = formatIndonesianDate(report.visitDate, false);

  validPhotos.forEach((photo, pIdx) => {
    if (pIdx > 0) doc.addPage();

    // Header Banner
    doc.setFillColor(0, 153, 68);
    doc.rect(0, 0, pageWidth, 22, 'F');
    doc.setFillColor(0, 153, 166);
    doc.rect(0, 22, pageWidth, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('LEMBAR QSC / FAMITRACK (SECTION 1 FORM VISIT)', 12, 10);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Store: ${cleanStore} (${report.storeCode || '-'}) | Auditor: ${report.visitorName || '-'} | Tanggal: ${dateFormatted} | ${photo.title} (${pIdx + 1}/${validPhotos.length})`,
      12,
      17
    );

    const boxX = 8;
    const boxY = 27;
    const boxW = 194;
    const boxH = 263;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'FD');

    drawImageProportional(doc, photo.b64, boxX + 1.5, boxY + 1.5, boxW - 3, boxH - 3, 'JPEG');
  });

  return doc;
}

/**
 * Live upload & sync report to official FMCU Google Drive folder (15Nb6vesuhbx5yZCqHekV8Fo5e9kyB0i8)
 */
export async function syncReportToGoogleDrive(
  report: VisitReportData,
  onProgress?: (pct: number, stage: string) => void
): Promise<GDriveSyncResult> {
  // 1. Resolve or pre-fetch exact CA Spreadsheet direct link before generating PDF document
  let resolvedCaUrl = resolveDirectCaSpreadsheetUrl(report);
  const isDirectFileUrl =
    resolvedCaUrl.includes('docs.google.com/spreadsheets') ||
    resolvedCaUrl.includes('drive.google.com/file');

  if (!isDirectFileUrl && report.storeCode) {
    try {
      onProgress?.(15, 'Mempersiapkan link langsung Google Spreadsheet CA Toko...');
      const caRes = await fetch(FMCU_REPORT_GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'createCaSpreadsheet',
          report: {
            storeCode: report.storeCode,
            storeName: report.storeName,
            visitorName: report.visitorName,
            observations: (report.observations || []).map((o) => ({
              temuan: o.auditFinding || '',
              tindakanPerbaikan: o.actionPlan || '',
              deadline: o.deadline || '',
              deadlineFormatted: o.deadlineFormatted || formatIndonesianDate(o.deadline, false)
            }))
          }
        })
      });
      if (caRes.ok) {
        const caData = await caRes.json();
        if (caData.caSpreadsheetUrl) {
          report.spreadsheetUrl = caData.caSpreadsheetUrl;
          saveStoreCaSpreadsheetUrl(report.storeCode, caData.caSpreadsheetUrl, report.agendaId);
        }
      }
    } catch (err) {
      console.warn('Pre-fetch CA spreadsheet error:', err);
    }
  }

  onProgress?.(25, 'Merender dokumen PDF HD 16:9, Lembar QSC & CA Assignment Excel...');
  const [doc, qscDoc, caExcelBase64] = await Promise.all([
    generatePdfDoc(report),
    generateVerticalQscCollagePdf(report),
    generateCaAssignmentBase64(report).catch((err) => {
      console.warn('CA Assignment generation warning during sync:', err);
      return '';
    }),
  ]);
  const pdfBase64 = doc.output('datauristring');
  const qscPdfBase64 = qscDoc ? qscDoc.output('datauristring') : '';
  const fileName = getPdfFileName(report);
  const caFileName = getCaAssignmentFileName(report);

  onProgress?.(65, 'Mengunggah 3 berkas laporan (PDF, Lembar QSC & CA Assignment) ke Google Apps Script & Google Drive...');

  const sanitizedReport = {
    id: report.id,
    storeCode: report.storeCode,
    storeName: report.storeName,
    storeType: report.storeType || 'CVS',
    auditorName: report.visitorName || 'Visitor',
    visitDate: report.visitDate,
    visitDateFormatted: formatIndonesianDate(report.visitDate, false),
    visitDayDateFormatted: formatIndonesianDate(report.visitDate, true),
    storeHead: report.storeHead || '',
    areaManager: report.areaManager || '',
    regionalManager: report.regionalManager || 'Novy Rusnani',
    storeEmail: report.storeEmail || '',
    actualIn: report.actualIn || '',
    actualOut: report.actualOut || '',
    observations: (report.observations || []).map((o) => ({
      temuan: o.auditFinding || '',
      tindakanPerbaikan: o.actionPlan || '',
      deadline: o.deadline || '',
      deadlineFormatted: o.deadlineFormatted || formatIndonesianDate(o.deadline, false)
    }))
  };

  const payload = {
    action: 'sendReport',
    report: sanitizedReport,
    visitorName: report.visitorName || 'Visitor',
    pdfBase64,
    qscPdfBase64,
    caExcelBase64,
    fileName,
    caFileName,
    gdriveFolderId: FMCU_REPORT_GDRIVE_FOLDER_ID,
    sendEmail: false
  };

  const response = await fetch(FMCU_REPORT_GAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Google Apps Script error: ${response.statusText}`);
  }

  const result = await response.json();
  onProgress?.(100, 'Berhasil disinkronkan ke Google Drive Toko!');

  if (result.caSpreadsheetUrl) {
    report.spreadsheetUrl = result.caSpreadsheetUrl;
    saveStoreCaSpreadsheetUrl(report.storeCode, result.caSpreadsheetUrl, report.agendaId);
  }

  const syncRes: GDriveSyncResult = {
    success: result.status === 'SUCCESS',
    pdfUrl: result.pdfUrl,
    qscPdfUrl: result.qscPdfUrl,
    caSpreadsheetUrl: result.caSpreadsheetUrl,
    caExcelUrl: result.caExcelUrl || result.caSpreadsheetUrl,
    storeFolderUrl: result.storeFolderUrl,
    visitorFolderUrl: result.visitorFolderUrl,
    yearFolderUrl: result.yearFolderUrl,
    message: result.message
  };

  saveGDriveReportRegistryEntry(report, syncRes);
  return syncRes;
}

const GDRIVE_PDF_REGISTRY_KEY = 'fmcu_gdrive_pdf_registry_v1';

export interface GDriveRegistryRecord {
  storeCode: string;
  storeName: string;
  agendaId?: string;
  visitDate: string;
  visitorName: string;
  pdfUrl?: string;
  caSpreadsheetUrl?: string;
  caExcelUrl?: string;
  gdriveEmbedUrl?: string;
  storeFolderUrl?: string;
  updatedAt: string;
}

export function toGDriveEmbedPreviewUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  const match = rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/file/d/${match[1]}/preview`;
  }
  return undefined;
}

export function saveGDriveReportRegistryEntry(
  report: VisitReportData,
  syncRes?: GDriveSyncResult
): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(GDRIVE_PDF_REGISTRY_KEY);
    const map: Record<string, GDriveRegistryRecord> = raw ? JSON.parse(raw) : {};
    const codeKey = String(report.storeCode || '').toUpperCase().trim();
    const nameKey = String(report.storeName || '').toUpperCase().trim();
    const record: GDriveRegistryRecord = {
      storeCode: report.storeCode || '',
      storeName: report.storeName || '',
      agendaId: report.agendaId,
      visitDate: report.visitDate || new Date().toISOString().split('T')[0],
      visitorName: report.visitorName || '',
      pdfUrl: syncRes?.pdfUrl || FMCU_REPORT_GDRIVE_FOLDER_URL,
      caSpreadsheetUrl: syncRes?.caSpreadsheetUrl || (report as any).caSpreadsheetUrl || report.spreadsheetUrl,
      caExcelUrl: syncRes?.caExcelUrl || syncRes?.caSpreadsheetUrl || (report as any).caExcelUrl,
      gdriveEmbedUrl: toGDriveEmbedPreviewUrl(syncRes?.pdfUrl),
      storeFolderUrl: syncRes?.storeFolderUrl || FMCU_REPORT_GDRIVE_FOLDER_URL,
      updatedAt: new Date().toISOString(),
    };
    if (codeKey) map[`CODE:${codeKey}`] = record;
    if (nameKey) map[`NAME:${nameKey}`] = record;
    if (report.agendaId) map[`AGENDA:${report.agendaId}`] = record;
    localStorage.setItem(GDRIVE_PDF_REGISTRY_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

export function getGDriveReportRegistryEntry(params: {
  storeCode?: string;
  storeName?: string;
  agendaId?: string;
}): GDriveRegistryRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GDRIVE_PDF_REGISTRY_KEY);
    if (!raw) return null;
    const map: Record<string, GDriveRegistryRecord> = JSON.parse(raw) || {};
    if (params.agendaId && map[`AGENDA:${params.agendaId}`]) {
      return map[`AGENDA:${params.agendaId}`];
    }
    const codeKey = String(params.storeCode || '').toUpperCase().trim();
    if (codeKey && map[`CODE:${codeKey}`]) {
      return map[`CODE:${codeKey}`];
    }
    const nameKey = String(params.storeName || '').toUpperCase().trim();
    if (nameKey && map[`NAME:${nameKey}`]) {
      return map[`NAME:${nameKey}`];
    }
    return null;
  } catch {
    return null;
  }
}


