import JSZip from 'jszip';
import { VisitReportData, ObservationFinding } from '../types/visitReport';
import { formatDateDdMmYyyy } from './pdfGeneratorService';

/**
 * Base64 XLSX Template for CA Store Assignment (Identik persis dari C:\FMCUVISITREPORT\CA_Store_Assignment.xlsx)
 */
const TEMPLATE_BASE64 = "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";

const SHEET_PATH = 'xl/worksheets/sheet1.xml';

function safeText(value: any): string {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\u00a0/g, ' ').trim();
}

function isMeaningful(value: any): boolean {
  const text = safeText(value);
  return !!text && text !== '-';
}

function escapeXml(value: any): string {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function stripFormatMarkers(value: any): string {
  let text = String(value || '');
  if (typeof window !== 'undefined' && typeof (window as any).stripObservationFormatMarkers === 'function') {
    text = (window as any).stripObservationFormatMarkers(text);
  }
  if (/<[^>]+>/.test(text) && typeof document !== 'undefined') {
    const scratch = document.createElement('div');
    scratch.innerHTML = text.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>|<\/div>|<\/li>/gi, '\n');
    text = scratch.textContent || scratch.innerText || '';
  } else if (/<[^>]+>/.test(text)) {
    text = text
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>|<\/div>|<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '');
  }
  return text
    .replace(/<u>([\s\S]*?)<\/u>/gi, '$1')
    .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
    .replace(/(^|[^\*])\*([^\*\n]+?)\*/g, '$1$2')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function formatDateId(value: any): string {
  const raw = safeText(value);
  if (!raw || raw === '-') return '';
  const date = new Date(raw + (raw.includes('T') ? '' : 'T00:00:00'));
  if (Number.isNaN(date.getTime())) return raw;
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const day = String(date.getDate()).padStart(2, '0');
  const month = monthNames[date.getMonth()] || String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day} ${month} ${year}`;
}

export function sanitizeFileName(value: string): string {
  return String(value || 'CA_Store_Assignment')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'CA_Store_Assignment';
}

export interface CaFindingRow {
  temuan: string;
  deadline: string;
  blank?: boolean;
}

/**
 * Normalisasi seluruh temuan dari report (QSC & OPI observations)
 */
export function collectCAAssignmentRows(report: Partial<VisitReportData>): CaFindingRow[] {
  const observations: ObservationFinding[] = Array.isArray(report?.observations) ? report.observations : [];
  
  return observations
    .map((obs) => {
      const finding = stripFormatMarkers(obs.auditFinding || (obs as any).temuan || '');
      const deadline = safeText(obs.deadlineFormatted || obs.deadline);
      return {
        temuan: finding,
        deadline: deadline
      };
    })
    .filter((row) => isMeaningful(row.temuan));
}

function cellBlank(ref: string, style: number): string {
  return `<c r="${ref}" s="${style}"/>`;
}

function cellShared(ref: string, style: number, index: number): string {
  return `<c r="${ref}" s="${style}" t="s"><v>${index}</v></c>`;
}

function cellInline(ref: string, style: number, value: any): string {
  const text = safeText(value);
  if (!text) return cellBlank(ref, style);
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function cellNumber(ref: string, style: number, value: any): string {
  if (value === undefined || value === null || value === '') return cellBlank(ref, style);
  return `<c r="${ref}" s="${style}"><v>${Number(value)}</v></c>`;
}

function rowXml(rowNumber: number, height: number, cells: string[]): string {
  const span = rowNumber <= 32 ? ' spans="1:6"' : '';
  return `<row r="${rowNumber}"${span} ht="${height}" customHeight="1" x14ac:dyDescent="0.25">${cells.join('')}</row>`;
}

function estimateRowHeight(findingText: string): number {
  const text = safeText(findingText);
  const manualLines = text ? text.split('\n').length : 1;
  const estimatedWrapLines = text ? Math.ceil(text.length / 48) : 1;
  const totalLines = Math.max(manualLines, estimatedWrapLines);
  const calculated = 54 + totalLines * 18;
  return Math.max(187.5, Math.min(360, calculated));
}

function buildHeaderRows(meta: {
  storeCode: string;
  storeName: string;
  bestieName: string;
  visitDate: string;
  picStore: string;
}): string[] {
  return [
    rowXml(1, 45.75, [cellShared('A1', 11, 0), cellBlank('B1', 8), cellBlank('C1', 8), cellBlank('D1', 8), cellBlank('E1', 8), cellBlank('F1', 9)]),
    rowXml(2, 15.75, [cellBlank('A2', 1), cellBlank('B2', 1), cellBlank('C2', 1), cellBlank('D2', 1), cellBlank('E2', 1)]),
    rowXml(3, 27.75, [cellShared('A3', 7, 1), cellBlank('B3', 8), cellBlank('C3', 9), cellInline('D3', 10, meta.storeCode), cellBlank('E3', 9)]),
    rowXml(4, 27.75, [cellShared('A4', 7, 2), cellBlank('B4', 8), cellBlank('C4', 9), cellInline('D4', 10, meta.storeName), cellBlank('E4', 9)]),
    rowXml(5, 27.75, [cellShared('A5', 7, 14), cellBlank('B5', 8), cellBlank('C5', 9), cellInline('D5', 10, meta.bestieName), cellBlank('E5', 9)]),
    rowXml(6, 27.75, [cellShared('A6', 7, 3), cellBlank('B6', 8), cellBlank('C6', 9), cellInline('D6', 10, meta.visitDate), cellBlank('E6', 9)]),
    rowXml(7, 27.75, [cellShared('A7', 7, 4), cellBlank('B7', 8), cellBlank('C7', 9), cellInline('D7', 10, meta.picStore), cellBlank('E7', 9)]),
    rowXml(8, 27.75, []),
    rowXml(9, 50.25, [cellShared('A9', 2, 5), cellShared('B9', 12, 6), cellBlank('C9', 8), cellBlank('D9', 9), cellShared('E9', 3, 7), cellShared('F9', 3, 8)])
  ];
}

function buildDataRows(rows: CaFindingRow[]): string[] {
  const source = rows.length ? rows : [{ temuan: '', deadline: '', blank: true }];
  return source.map((row, index) => {
    const excelRow = 10 + index;
    const findingText = row.blank ? '' : row.temuan;
    const deadline = row.blank ? '' : formatDateId(row.deadline);
    const isFirst = index === 0;
    return rowXml(excelRow, estimateRowHeight(findingText), [
      cellNumber('A' + excelRow, isFirst ? 4 : 5, index + 1),
      cellInline('B' + excelRow, 13, findingText),
      cellBlank('C' + excelRow, 8),
      cellBlank('D' + excelRow, 9),
      cellInline('E' + excelRow, 6, deadline),
      cellBlank('F' + excelRow, 5)
    ]);
  });
}

function buildMergeCells(lastDataRow: number): string {
  const refs = [
    'A1:F1',
    'A3:C3', 'D3:E3',
    'A4:C4', 'D4:E4',
    'A5:C5', 'D5:E5',
    'A6:C6', 'D6:E6',
    'A7:C7', 'D7:E7',
    'B9:D9'
  ];
  for (let row = 10; row <= lastDataRow; row += 1) {
    refs.push('B' + row + ':D' + row);
  }
  return '<mergeCells count="' + refs.length + '">' + refs.map((ref) => '<mergeCell ref="' + ref + '"/>').join('') + '</mergeCells>';
}

export function createWorksheetXml(report: VisitReportData): string {
  const rows = collectCAAssignmentRows(report);
  const lastDataRow = 10 + Math.max(rows.length, 1) - 1;

  // Resolve Store Head / PIC Store
  let storeHead = report.storeHead || '';
  if (!storeHead && Array.isArray(report.crews)) {
    const headCrew = report.crews.find((c) => /store\s*head|leader|kepala/i.test(c.role || ''));
    if (headCrew) storeHead = headCrew.name;
  }

  const meta = {
    storeCode: report.storeCode || '',
    storeName: report.storeName || '',
    bestieName: report.visitorName || '',
    visitDate: formatDateId(report.visitDate),
    picStore: storeHead
  };

  const sheetRows = buildHeaderRows(meta).concat(buildDataRows(rows)).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac xr xr2 xr3" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xr="http://schemas.microsoft.com/office/spreadsheetml/2014/revision" xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" xmlns:xr3="http://schemas.microsoft.com/office/spreadsheetml/2016/revision3" xr:uid="{00000000-0001-0000-0000-000000000000}">' +
    '<sheetPr><outlinePr summaryBelow="0" summaryRight="0"/></sheetPr>' +
    '<dimension ref="A1:F' + lastDataRow + '"/>' +
    '<sheetViews><sheetView tabSelected="1" zoomScale="55" zoomScaleNormal="55" workbookViewId="0"><selection activeCell="B10" sqref="B10:D10"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultColWidth="0" defaultRowHeight="15.75" customHeight="1" x14ac:dyDescent="0.25"/>' +
    '<cols><col min="1" max="1" width="5.109375" customWidth="1"/><col min="2" max="2" width="3.88671875" customWidth="1"/><col min="3" max="3" width="12.44140625" customWidth="1"/><col min="4" max="4" width="22.44140625" customWidth="1"/><col min="5" max="5" width="19.6640625" customWidth="1"/><col min="6" max="6" width="91.5546875" customWidth="1"/><col min="7" max="16384" width="12.5546875" hidden="1"/></cols>' +
    '<sheetData>' + sheetRows + '</sheetData>' +
    buildMergeCells(lastDataRow) +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    '</worksheet>';
}

/**
 * Memastikan style kolom Kode Toko, Tanggal Visit, Tanggal Perbaikan, dan Temuan rata kiri (Left-Aligned)
 */
function enhanceCAStylesXml(xml: string): string {
  let nextXml = safeText(xml);

  // 1. Tanggal Perbaikan (s=6): ubah dari horizontal="center" ke horizontal="left"
  nextXml = nextXml.replace(
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="4" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/>',
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="4" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/>'
  );

  // 2. Daftar Temuan (s=13): ubah dari horizontal="center" ke horizontal="left"
  nextXml = nextXml.replace(
    '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/>',
    '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/>'
  );

  // 3. Kolom Kode Toko & Detail Nilai Header (s=10): terapkan text format (@) dan horizontal="left"
  nextXml = nextXml.replace(
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/>',
    '<xf numFmtId="49" fontId="3" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/>'
  );

  return nextXml;
}

/**
 * Membangun berkas workbook XLSX CA Assignment identik dengan format template C:\FMCUVISITREPORT\CA_Store_Assignment.xlsx
 */
export async function buildCAAssignmentWorkbook(report: VisitReportData): Promise<Blob> {
  const zip = await JSZip.loadAsync(TEMPLATE_BASE64, { base64: true });
  const stylesFile = zip.file('xl/styles.xml');
  if (stylesFile) {
    const rawStyles = await stylesFile.async('string');
    zip.file('xl/styles.xml', enhanceCAStylesXml(rawStyles));
  }
  zip.file(SHEET_PATH, createWorksheetXml(report));
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE'
  });
}

/**
 * Format nama berkas standar: "CA_Store_Assignment_{StoreName}_{DD-MM-YYYY}.xlsx"
 */
export function getCaAssignmentFileName(report: VisitReportData): string {
  const cleanStore = sanitizeFileName(report.storeName || 'Store');
  const dateFormatted = formatDateDdMmYyyy(report.visitDate);
  return `CA_Store_Assignment_${cleanStore}_${dateFormatted}.xlsx`;
}

/**
 * Menghasilkan string base64 untuk unggah / sinkronisasi ke Google Drive
 */
export async function generateCaAssignmentBase64(report: VisitReportData): Promise<string> {
  const blob = await buildCAAssignmentWorkbook(report);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(String(reader.result || ''));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Mengunduh berkas CA Assignment Excel (.xlsx) langsung di peramban web
 */
export async function downloadCAAssignmentExcel(report: VisitReportData): Promise<void> {
  const blob = await buildCAAssignmentWorkbook(report);
  const fileName = getCaAssignmentFileName(report);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1200);
}
