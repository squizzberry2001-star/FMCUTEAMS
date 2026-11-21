import {
  MasterStore,
  MasterStoreMergeResult,
  mergeMasterStores,
} from '../data/masterStoresData';

export interface ParsedMasterStorePdfResult {
  fileName: string;
  pageCount: number;
  rawRowsCount: number;
  incomingStores: MasterStore[];
  preview: MasterStoreMergeResult;
  detectedColumns: string[];
  warnings: string[];
  extractionMode: 'tabular' | 'pattern';
}

interface PositionedSpan {
  str: string;
  x: number;
  y: number;
  width: number;
}

interface PdfLine {
  page: number;
  y: number;
  spans: PositionedSpan[];
  cells: { x: number; text: string }[];
  fullText: string;
}

type CanonicalStoreField =
  | 'code'
  | 'name'
  | 'type'
  | 'city'
  | 'region'
  | 'address'
  | 'lat'
  | 'lng'
  | 'email'
  | 'storePhone'
  | 'storeHead'
  | 'areaManager'
  | 'areaManagerEmail'
  | 'regionalManager'
  | 'regionalManagerEmail';

const HEADER_MATCHERS: Array<{ field: CanonicalStoreField; patterns: RegExp[] }> = [
  {
    field: 'code',
    patterns: [/^kode(\s*toko)?$/i, /^code$/i, /^store\s*code$/i, /^kd\.?\s*toko$/i, /^id\s*toko$/i, /^no\.?\s*toko$/i],
  },
  {
    field: 'name',
    patterns: [/^nama(\s*toko)?$/i, /^store(\s*name)?$/i, /^toko$/i, /^outlet$/i, /^cabang$/i],
  },
  {
    field: 'type',
    patterns: [/^tipe(\s*toko)?$/i, /^type$/i, /^store\s*type$/i, /^format$/i, /^kategori$/i, /^concept$/i],
  },
  {
    field: 'city',
    patterns: [/^kota(\/kab)?$/i, /^city$/i, /^kabupaten$/i, /^area$/i, /^wilayah$/i],
  },
  {
    field: 'region',
    patterns: [/^region(al)?$/i, /^zona$/i],
  },
  {
    field: 'address',
    patterns: [/^alamat(\s*toko)?$/i, /^address$/i, /^lokasi$/i],
  },
  {
    field: 'lat',
    patterns: [/^lat(itude)?$/i, /^lintang$/i],
  },
  {
    field: 'lng',
    patterns: [/^lo?ng(itude)?$/i, /^bujur$/i],
  },
  {
    field: 'areaManagerEmail',
    patterns: [/email\s*(am|area\s*manager)/i, /(am|area\s*manager)\s*email/i],
  },
  {
    field: 'regionalManagerEmail',
    patterns: [/email\s*(rm|regional\s*manager)/i, /(rm|regional\s*manager)\s*email/i],
  },
  {
    field: 'email',
    patterns: [/^email(\s*toko|\s*store)?$/i, /^store\s*email$/i],
  },
  {
    field: 'storePhone',
    patterns: [/^(no\.?\s*)?(telp|telepon|hp|phone|wa|whatsapp)(\s*toko)?$/i, /^store\s*phone$/i, /^kontak$/i],
  },
  {
    field: 'storeHead',
    patterns: [/^store\s*head$/i, /^sh$/i, /^kepala\s*toko$/i, /^kt$/i, /^pic\s*toko$/i],
  },
  {
    field: 'areaManager',
    patterns: [/^area\s*manager$/i, /^am$/i, /^nama\s*am$/i],
  },
  {
    field: 'regionalManager',
    patterns: [/^regional\s*manager$/i, /^rm$/i, /^nama\s*rm$/i],
  },
];

const KNOWN_STORE_TYPES = [
  'FamiSuper',
  'CVS',
  'Housing',
  'Office',
  'Mall',
  'Hospital',
  'Campus',
  'Transit',
  'Stand Alone',
  'Standalone',
  'Apartment',
  'Kiosk',
  'NSO',
];

function matchHeaderField(raw: string): CanonicalStoreField | null {
  const cleaned = raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/[_.:#-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length > 42) return null;
  for (const matcher of HEADER_MATCHERS) {
    if (matcher.patterns.some((rx) => rx.test(cleaned))) {
      return matcher.field;
    }
  }
  return null;
}

function normalizeStoreCode(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/^#/, '')
    .replace(/\s+/g, '');
  if (!cleaned) return '';
  if (/^\d{1,4}$/.test(cleaned)) {
    return cleaned.padStart(4, '0');
  }
  return cleaned;
}

function isLikelyStoreCode(raw: string): boolean {
  const s = String(raw || '').trim().replace(/^#/, '');
  if (!s) return false;
  if (/^\d{4}$/.test(s)) {
    const n = Number(s);
    // Avoid mistaking plain years like 2024-2029 unless prefixed
    if (n >= 2020 && n <= 2035) return false;
    return true;
  }
  return /^(FM|FMI|ST|ID)[A-Z0-9-]{2,8}$/i.test(s);
}

function clusterSpansIntoLines(spans: PositionedSpan[], page: number): PdfLine[] {
  if (spans.length === 0) return [];
  const sorted = [...spans].sort((a, b) => {
    if (Math.abs(b.y - a.y) > 4.5) return b.y - a.y; // PDF y-axis increases upwards
    return a.x - b.x;
  });

  const rows: PositionedSpan[][] = [];
  for (const span of sorted) {
    const lastRow = rows[rows.length - 1];
    if (lastRow && Math.abs(lastRow[0].y - span.y) <= 4.5) {
      lastRow.push(span);
    } else {
      rows.push([span]);
    }
  }

  return rows.map((rowSpans) => {
    rowSpans.sort((a, b) => a.x - b.x);
    const cells: { x: number; text: string }[] = [];

    for (const sp of rowSpans) {
      const prev = cells[cells.length - 1];
      const prevSpan = rowSpans[rowSpans.indexOf(sp) - 1];
      const gap = prevSpan ? sp.x - (prevSpan.x + prevSpan.width) : 999;

      // Merge adjacent words into same cell when gap is small (<= 8pt)
      if (prev && gap <= 8.5) {
        prev.text = `${prev.text} ${sp.str}`.replace(/\s+/g, ' ').trim();
      } else {
        cells.push({ x: sp.x, text: sp.str.trim() });
      }
    }

    const fullText = cells.map((c) => c.text).join('  ').trim();
    return {
      page,
      y: rowSpans[0].y,
      spans: rowSpans,
      cells,
      fullText,
    };
  });
}

function parseCoordinatePair(text: string): { lat?: number; lng?: number } {
  const nums = text.match(/-?\d{1,3}[.,]\d{3,8}/g);
  if (!nums || nums.length === 0) return {};
  let lat: number | undefined;
  let lng: number | undefined;
  for (const raw of nums) {
    const val = Number(raw.replace(',', '.'));
    if (!Number.isFinite(val)) continue;
    // Indonesia bounding box: lat ~ -11..6, lng ~ 95..141
    if (val >= -12 && val <= 7 && lat === undefined) {
      lat = val;
    } else if (val >= 94 && val <= 142 && lng === undefined) {
      lng = val;
    }
  }
  return { lat, lng };
}

function buildNormalizedStore(
  partial: Partial<Record<CanonicalStoreField, string>>,
  existingByCode: Map<string, MasterStore>
): MasterStore | null {
  const code = normalizeStoreCode(partial.code || '');
  const rawName = String(partial.name || '')
    .replace(/^(familymart|family\s*mart|toko)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!code || !rawName || rawName.length < 2) return null;
  // Skip obvious header echo rows
  if (/^(nama|store|toko|kode|code)$/i.test(rawName)) return null;

  const existing = existingByCode.get(code);
  const parsedLat = Number(String(partial.lat || '').replace(',', '.'));
  const parsedLng = Number(String(partial.lng || '').replace(',', '.'));

  const lat = Number.isFinite(parsedLat) && parsedLat !== 0 ? parsedLat : existing?.lat ?? 0;
  const lng = Number.isFinite(parsedLng) && parsedLng !== 0 ? parsedLng : existing?.lng ?? 0;

  return {
    code,
    name: rawName,
    type: (partial.type || '').trim() || existing?.type || 'CVS',
    city: (partial.city || '').trim() || existing?.city || '',
    ...(partial.region || existing?.region
      ? { region: (partial.region || existing?.region || '').trim() }
      : {}),
    address: (partial.address || '').trim() || existing?.address || '',
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    email: (partial.email || '').trim() || existing?.email || '',
    storePhone: (partial.storePhone || '').trim() || existing?.storePhone || '',
    storeHead: (partial.storeHead || '').trim() || existing?.storeHead || '',
    areaManager: (partial.areaManager || '').trim() || existing?.areaManager || '',
    areaManagerEmail: (partial.areaManagerEmail || '').trim() || existing?.areaManagerEmail || '',
    regionalManager: (partial.regionalManager || '').trim() || existing?.regionalManager || '',
    regionalManagerEmail:
      (partial.regionalManagerEmail || '').trim() || existing?.regionalManagerEmail || '',
  };
}

export function parseMasterStorePdfTextPages(
  pagesItems: Array<Array<{ str?: string; transform?: number[]; width?: number }>>,
  fileName: string,
  existingStores: MasterStore[],
  mode: 'merge' | 'replace' = 'merge'
): ParsedMasterStorePdfResult {
  const allLines: PdfLine[] = [];
  for (let i = 0; i < pagesItems.length; i++) {
    const pageNum = i + 1;
    const spans: PositionedSpan[] = [];

    for (const item of pagesItems[i]) {
      const str = String(item?.str || '').trim();
      if (!str) continue;
      const transform = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
      spans.push({
        str,
        x: Number(transform[4] || 0),
        y: Number(transform[5] || 0),
        width: Number(item.width || str.length * 4.5),
      });
    }

    const pageLines = clusterSpansIntoLines(spans, pageNum);
    allLines.push(...pageLines);
  }
  return extractStoresFromPdfLines(allLines, pagesItems.length, fileName, existingStores, mode);
}

/**
 * Parse a Master Store PDF file directly in the browser using pdfjs-dist.
 * Supports both structured tabular PDFs (with column headers) and semi-structured store lists.
 */
export async function parseMasterStorePdfFile(
  file: File,
  existingStores: MasterStore[],
  mode: 'merge' | 'replace' = 'merge'
): Promise<ParsedMasterStorePdfResult> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdfDoc = await loadingTask.promise;

  const pagesItems: Array<Array<{ str?: string; transform?: number[]; width?: number }>> = [];
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    pagesItems.push(textContent.items as any[]);
  }

  return parseMasterStorePdfTextPages(pagesItems, file.name, existingStores, mode);
}

function extractStoresFromPdfLines(
  allLines: PdfLine[],
  pageCount: number,
  fileName: string,
  existingStores: MasterStore[],
  mode: 'merge' | 'replace'
): ParsedMasterStorePdfResult {

  const existingByCode = new Map<string, MasterStore>();
  for (const s of existingStores) {
    existingByCode.set(String(s.code).trim().toUpperCase(), s);
  }

  const warnings: string[] = [];

  // 1. Detect best column header row
  let headerIdx = -1;
  let columnAnchors: Array<{ field: CanonicalStoreField; x: number; label: string }> = [];

  for (let i = 0; i < Math.min(allLines.length, 45); i++) {
    const line = allLines[i];
    const matched: Array<{ field: CanonicalStoreField; x: number; label: string }> = [];
    const usedFields = new Set<CanonicalStoreField>();

    for (const cell of line.cells) {
      const field = matchHeaderField(cell.text);
      if (field && !usedFields.has(field)) {
        usedFields.add(field);
        matched.push({ field, x: cell.x, label: cell.text });
      }
    }

    if (matched.length >= 2 && (usedFields.has('code') || usedFields.has('name'))) {
      if (matched.length > columnAnchors.length) {
        headerIdx = i;
        columnAnchors = matched.sort((a, b) => a.x - b.x);
      }
    }
  }

  const extractedMap = new Map<string, MasterStore>();
  let extractionMode: 'tabular' | 'pattern' = 'tabular';
  let rawRowsCount = 0;

  // Strategy A: Tabular coordinate-aligned extraction
  if (headerIdx >= 0 && columnAnchors.length >= 2) {
    for (let i = headerIdx + 1; i < allLines.length; i++) {
      const line = allLines[i];
      if (!line.fullText) continue;

      // Skip repeated page headers or page numbers ("Page 1 of 5", "Halaman 2")
      if (/^(page|hal(aman)?)\s*\d+/i.test(line.fullText)) continue;
      const isRepeatedHeader =
        line.cells.filter((c) => matchHeaderField(c.text) !== null).length >= 2;
      if (isRepeatedHeader) continue;

      rawRowsCount++;
      const rowData: Partial<Record<CanonicalStoreField, string>> = {};

      for (const cell of line.cells) {
        // Assign cell to nearest column anchor by x coordinate
        let bestAnchor = columnAnchors[0];
        let bestDist = Math.abs(cell.x - bestAnchor.x);
        for (const anchor of columnAnchors) {
          const d = Math.abs(cell.x - anchor.x);
          if (d < bestDist) {
            bestDist = d;
            bestAnchor = anchor;
          }
        }
        const prevVal = rowData[bestAnchor.field];
        rowData[bestAnchor.field] = prevVal ? `${prevVal} ${cell.text}` : cell.text;
      }

      // Extract lat/lng if combined in a single column or full text
      if (!rowData.lat || !rowData.lng) {
        const coords = parseCoordinatePair(line.fullText);
        if (coords.lat !== undefined && !rowData.lat) rowData.lat = String(coords.lat);
        if (coords.lng !== undefined && !rowData.lng) rowData.lng = String(coords.lng);
      }

      // If row has a store code embedded in first cell like "0001 - CIBUBUR"
      if (rowData.code && !rowData.name) {
        const splitMatch = rowData.code.match(/^#?(\d{3,4}|[A-Z]{2}\d{2,4})\s*[-–:|]\s*(.+)$/i);
        if (splitMatch) {
          rowData.code = splitMatch[1];
          rowData.name = splitMatch[2];
        }
      }

      const store = buildNormalizedStore(rowData, existingByCode);
      if (store) {
        extractedMap.set(store.code, store);
      }
    }
  }

  // Strategy B: Smart pattern fallback if tabular extraction yielded 0 rows
  if (extractedMap.size === 0) {
    extractionMode = 'pattern';
    for (const line of allLines) {
      const text = line.fullText;
      if (!text || text.length < 6) continue;
      if (/^(page|hal(aman)?)\s*\d+/i.test(text)) continue;

      // Try finding a valid store code cell or token
      let codeToken = '';
      let codeCellIdx = -1;
      for (let c = 0; c < line.cells.length; c++) {
        const tokens = line.cells[c].text.split(/\s+/);
        const hit = tokens.find((t) => isLikelyStoreCode(t));
        if (hit) {
          codeToken = hit;
          codeCellIdx = c;
          break;
        }
      }

      if (!codeToken) continue;
      rawRowsCount++;

      const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const phoneMatch = text.match(/(?:\+62|62|08)\d{7,12}/);
      const typeMatch = KNOWN_STORE_TYPES.find((tp) =>
        new RegExp(`\\b${tp.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)
      );
      const coords = parseCoordinatePair(text);

      // Extract name from the cell after code or remainder of code cell
      let nameCandidate = '';
      const codeCellRemainder = line.cells[codeCellIdx].text
        .replace(codeToken, '')
        .replace(/^[\s\-–:|.]+/, '')
        .trim();

      if (codeCellRemainder.length >= 2 && !/^\d+$/.test(codeCellRemainder)) {
        nameCandidate = codeCellRemainder;
      } else if (line.cells[codeCellIdx + 1]) {
        nameCandidate = line.cells[codeCellIdx + 1].text;
      }

      // Clean out email/phone/type from name candidate
      if (emailMatch) nameCandidate = nameCandidate.replace(emailMatch[0], '');
      if (phoneMatch) nameCandidate = nameCandidate.replace(phoneMatch[0], '');
      if (typeMatch) {
        nameCandidate = nameCandidate.replace(new RegExp(`\\b${typeMatch}\\b`, 'i'), '');
      }
      nameCandidate = nameCandidate.replace(/\s+/g, ' ').trim();

      const remainingCells = line.cells
        .slice(codeCellIdx + 2)
        .map((c) => c.text)
        .filter(
          (t) =>
            t &&
            t !== emailMatch?.[0] &&
            t !== phoneMatch?.[0] &&
            t.toLowerCase() !== typeMatch?.toLowerCase()
        );

      const store = buildNormalizedStore(
        {
          code: codeToken,
          name: nameCandidate,
          type: typeMatch || '',
          city: remainingCells[0] && remainingCells[0].length <= 28 ? remainingCells[0] : '',
          address: remainingCells.find((t) => t.length > 20 || /jl\.?|jalan/i.test(t)) || '',
          lat: coords.lat !== undefined ? String(coords.lat) : '',
          lng: coords.lng !== undefined ? String(coords.lng) : '',
          email: emailMatch?.[0] || '',
          storePhone: phoneMatch?.[0] || '',
        },
        existingByCode
      );

      if (store) {
        extractedMap.set(store.code, store);
      }
    }
  }

  const incomingStores = Array.from(extractedMap.values());

  if (incomingStores.length === 0) {
    throw new Error(
      'Tidak ditemukan data toko valid di dalam PDF. Pastikan PDF berbasis teks (bukan hasil scan gambar) dan memuat kolom Kode Toko (contoh: 0001) serta Nama Toko.'
    );
  }

  if (extractionMode === 'pattern') {
    warnings.push(
      'Header tabel standar tidak terdeteksi penuh — sistem mengekstrak kode & nama toko secara otomatis dengan mode pencocokan pola.'
    );
  }

  const missingCoordsCount = incomingStores.filter((s) => !s.lat || !s.lng).length;
  if (missingCoordsCount > 0) {
    warnings.push(
      `${missingCoordsCount} toko belum memuat koordinat GPS di PDF (koordinat lama tetap dipertahankan pada mode Gabung).`
    );
  }

  const preview = mergeMasterStores(existingStores, incomingStores, mode);

  return {
    fileName,
    pageCount,
    rawRowsCount,
    incomingStores,
    preview,
    detectedColumns:
      columnAnchors.length > 0
        ? columnAnchors.map((c) => c.label)
        : ['Kode Toko', 'Nama Toko', 'Auto-Detect'],
    warnings,
    extractionMode,
  };
}
