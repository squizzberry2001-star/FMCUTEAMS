import * as XLSX from 'xlsx';
import { ScheduleAgenda, ScheduleCategory, User } from '../types';
import {
  MasterStore,
  getMasterStores,
  getBestieInChargeAssignments,
  getBestieByStoreCode,
} from '../data/masterStoresData';

// ============================================================================
// CORPORATE EXCEL SCHEDULE PARSER & EXPORTER SERVICE
// Ported 1:1 from C:\FMCUVISITREPORT\js\app.js (lines 18915-19825)
// ============================================================================

export interface ParsedExcelScheduleSummary {
  sheetName: string;
  agendas: ScheduleAgenda[];
  updatedUsers: User[];
  newUsersCount: number;
  stats: {
    totalRows: number;
    visitCount: number;
    nsoCount: number;
    nonStoreAgendaCount: number;
    offCount: number;
    cutiCount: number;
    matchedUsersCount: number;
    matchedStoresCount: number;
  };
}

// Store alias map for special shorthand names in Excel
const EXCEL_STORE_ALIAS_MAP: Record<string, string> = {
  'BDG RIAU': '3006', // BDG R.E MARTADINATA
  'BANDUNG RIAU': '3006',
  'LL RE MARTADINATA': '3006',
  'RE MARTADINATA': '3006',
  'RIAU': '3006',
  'BDG GATSU': '3007', // BDG GATSU
  'GATOT SUBROTO BDG': '3007',
  'BDG 23 PASKAL': '3005', // BDG 23 PASKAL
  'BDG PASKAL': '3010', // BDG PASKAL
  'PASKAL': '3010',
  'BDG DAGO': '3008', // BDG DAGO
  'DAGO': '3008',
  'BDG TERUSAN JAKARTA': '3017', // BDG TERUSAN JAKARTA
  'TERUSAN JAKARTA': '3017',
  'BDG ARCAMANIK': '3013', // BDG SUKAMISKIN ARCAMANIK
  'ARCAMANIK': '3013',
  'PASTEUR': '3019', // BDG PASTEUR
  'BDG PASTEUR': '3019',
  'SURYA SUMANTRI': '3002', // BDG SURYA SUMANTRI
  'BDG SURYA SUMANTRI': '3002',
  'BRAGA': '3004', // BDG BRAGA
  'BDG BRAGA': '3004',
  'BDG CIHAMPELAS': '3003', // BDG CIHAMPELAS
  'CIHAMPELAS': '3003',
  'SUKAJADI': '3001', // BDG SUKAJADI
  'BDG SUKAJADI': '3001',
  'DIPATIUKUR': '3001',
  'BUAH BATU': '3016', // BDG BUAH BATU
  'BDG BUAH BATU': '3016',
  'DUREN TIGA': '0410', // DUREN TIGA RAYA
  'BULUNGAN': 'BULUNGAN 2',
};

/**
 * Snap date input to Monday of its week (matching corporate rules from FMCUVISITREPORT)
 */
export function getMondayOfWeek(dateInput?: string): string {
  const d = dateInput ? new Date(dateInput + 'T00:00:00') : new Date();
  if (isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  const day = d.getDay(); // 0=Minggu, 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu
  // Senin hingga Minggu: jika Minggu (0), selisih -6 menuju Senin minggu ini
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Generate week days for a given week Monday.
 * Returns exactly 7 days (Senin s/d Minggu) for the actual week.
 */
export function getFullWeekDays(
  mondayStr: string
): { dayIndex: number; dayName: string; dateStr: string; isWeekend: boolean }[] {
  const baseMon = getMondayOfWeek(mondayStr);
  const dayNames = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];
  const result: { dayIndex: number; dayName: string; dateStr: string; isWeekend: boolean }[] = [];

  for (let i = 0; i < 7; i++) {
    const dt = new Date(baseMon + 'T00:00:00');
    dt.setDate(dt.getDate() + i);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    result.push({
      dayIndex: i,
      dayName: dayNames[i],
      dateStr: `${yyyy}-${mm}-${dd}`,
      isWeekend: i === 5 || i === 6,
    });
  }

  return result;
}

/**
 * Format 1 week range display (e.g. "08 - 15 Nov 2026" or "09 - 15 Nov 2026")
 */
export function formatWeekRangeDisplay(mondayStr: string): string {
  const days = getFullWeekDays(mondayStr);
  if (days.length === 0) return mondayStr;
  const startParts = days[0].dateStr.split('-');
  const endParts = days[days.length - 1].dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const startDay = parseInt(startParts[2], 10);
  const endDay = parseInt(endParts[2], 10);
  const startMonth = months[parseInt(startParts[1], 10) - 1];
  const endMonth = months[parseInt(endParts[1], 10) - 1];
  const year = endParts[0];

  if (startMonth === endMonth) {
    return `${String(startDay).padStart(2, '0')} - ${String(endDay).padStart(2, '0')} ${startMonth} ${year}`;
  }
  return `${String(startDay).padStart(2, '0')} ${startMonth} - ${String(endDay).padStart(2, '0')} ${endMonth} ${year}`;
}

const MONTH_NAME_MAP: Record<string, number> = {
  jan: 1, january: 1, januari: 1,
  feb: 2, february: 2, februari: 2, peb: 2, pebruari: 2,
  mar: 3, march: 3, maret: 3,
  apr: 4, april: 4,
  may: 5, mei: 5,
  jun: 6, june: 6, juni: 6,
  jul: 7, july: 7, juli: 7,
  aug: 8, august: 8, agu: 8, agt: 8, agustus: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, okt: 10, oktober: 10,
  nov: 11, november: 11, nop: 11, nopember: 11,
  dec: 12, december: 12, des: 12, desember: 12,
};

function expandTwoDigitYear(y: number): number {
  if (y >= 100) return y;
  return y >= 70 ? 1900 + y : 2000 + y;
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function parseExcelSerialDate(val: any): string | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) {
    // Excel 1900 date epoch without local timezone offset shift
    const utcDays = Math.round(val - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    // Add 60-second rounding buffer to prevent Jakarta LMT (+07:07:12) 23:59:48 shift back by 1 day
    const adjusted = new Date(val.getTime() + 60000);
    const yyyy = adjusted.getFullYear();
    const mm = String(adjusted.getMonth() + 1).padStart(2, '0');
    const dd = String(adjusted.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  let str = String(val)
    .replace(/\u00a0/g, ' ')
    .trim();
  if (!str) return null;

  // Numeric Excel serial passed as string (e.g. "46335")
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const num = Number(str);
    if (num >= 30000 && num <= 70000) {
      return parseExcelSerialDate(num);
    }
  }

  // Strip weekday prefix e.g. "Senin, 09 Nov 2026"
  str = str.replace(/^(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|mon|tue|wed|thu|fri|sat|sun)[a-z]*,?\s+/i, '').trim();

  // ISO YYYY-MM-DD (or with time suffix)
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (isValidYmd(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Month name formats: "02-Nov-2026", "2 Nov 2026", "2 November 26", "Nov 2, 2026"
  const dmyTextMatch = str.match(/^(\d{1,2})[\s\-/.]+([a-zA-Z]+)[\s\-/.,]+(\d{2,4})$/);
  if (dmyTextMatch) {
    const d = Number(dmyTextMatch[1]);
    const m = MONTH_NAME_MAP[dmyTextMatch[2].toLowerCase()];
    const y = expandTwoDigitYear(Number(dmyTextMatch[3]));
    if (m && isValidYmd(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const mdyTextMatch = str.match(/^([a-zA-Z]+)[\s\-/.]+(\d{1,2}),?[\s\-/.]+(\d{2,4})$/);
  if (mdyTextMatch) {
    const m = MONTH_NAME_MAP[mdyTextMatch[1].toLowerCase()];
    const d = Number(mdyTextMatch[2]);
    const y = expandTwoDigitYear(Number(mdyTextMatch[3]));
    if (m && isValidYmd(y, m, d)) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Numeric separated formats: YYYY/MM/DD, DD/MM/YYYY, DD-MM-YY, MM/DD/YYYY
  const parts = str.split(/[\/.\-]/).map((p) => p.trim());
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    const n0 = Number(parts[0]);
    const n1 = Number(parts[1]);
    const n2 = Number(parts[2]);

    if (parts[0].length === 4) {
      if (isValidYmd(n0, n1, n2)) {
        return `${n0}-${String(n1).padStart(2, '0')}-${String(n2).padStart(2, '0')}`;
      }
    } else {
      const y = expandTwoDigitYear(n2);
      // Indonesian default DD/MM/YYYY; fallback to MM/DD/YYYY if middle part > 12
      if (n1 > 12 && n0 <= 12 && isValidYmd(y, n0, n1)) {
        return `${y}-${String(n0).padStart(2, '0')}-${String(n1).padStart(2, '0')}`;
      }
      if (isValidYmd(y, n1, n0)) {
        return `${y}-${String(n1).padStart(2, '0')}-${String(n0).padStart(2, '0')}`;
      }
    }
  }

  return null;
}

export function parseExcelTime24(val: any, fallback = '08:30'): string {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') {
    const frac = val - Math.floor(val);
    const totalMinutes = Math.round(frac * 24 * 60);
    const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
    const mm = String(totalMinutes % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return `${String(val.getHours()).padStart(2, '0')}:${String(val.getMinutes()).padStart(2, '0')}`;
  }
  const str = String(val).trim();
  const m = str.match(/(\d{1,2})[:.](\d{2})\s*(AM|PM)?/i);
  if (m) {
    let hh = parseInt(m[1], 10);
    const mm = m[2];
    const ampm = (m[3] || '').toUpperCase();
    if (ampm === 'PM' && hh < 12) hh += 12;
    if (ampm === 'AM' && hh === 12) hh = 0;
    return `${String(hh).padStart(2, '0')}:${mm}`;
  }
  return fallback;
}

export function matchStoreFromLocationPart(
  rawPart: string,
  allStores: MasterStore[]
): { store: MasterStore | null; cleanName: string } {
  const cleaned = String(rawPart || '')
    .replace(/^\d+[\.\)]\s*/, '')
    .replace(
      /^(visit\s+store|visit|toko|store|cabang|fm|familymart|nso|reopening|re-opening)\s+/i,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 2) return { store: null, cleanName: '' };
  const upper = cleaned.toUpperCase();

  // Guard: Abaikan keyword non-store (OFF, LIBUR, CUTI, SAKIT, WEEKEND, WFH, dsb.)
  const NON_STORE_LOCATION_KEYWORDS = new Set([
    'OFF',
    'LIBUR',
    'OFF/LIBUR',
    'OFF / LIBUR',
    'WEEKEND',
    'WEEKEND/OFF',
    'WEEKEND / OFF',
    'CUTI',
    'SAKIT',
    'IZIN',
    'STANDBY',
    'HOME',
    'RUMAH',
    'WFH',
    'WFO',
    'HO',
    'HEAD OFFICE',
    'OFFICE',
    'REST',
    'DAY OFF',
  ]);

  if (
    NON_STORE_LOCATION_KEYWORDS.has(upper) ||
    /^(OFF|LIBUR|CUTI|SAKIT|IZIN|WEEKEND|STANDBY|WFH)(\s*[\/\-]\s*|$)/i.test(upper)
  ) {
    return { store: null, cleanName: '' };
  }

  // 0a. Exact alias match first (so BDG PASKAL [3010] and BDG 23 PASKAL [3005] stay distinct)
  if (EXCEL_STORE_ALIAS_MAP[upper]) {
    const targetVal = EXCEL_STORE_ALIAS_MAP[upper];
    const aliasStore = allStores.find(
      (s) =>
        String(s.code).toUpperCase() === targetVal ||
        String(s.name).toUpperCase() === targetVal
    );
    if (aliasStore) return { store: aliasStore, cleanName: aliasStore.name };
  }

  // 1. Exact Name or Code Match
  let exact = allStores.find(
    (s) =>
      String(s.name || '').toUpperCase() === upper ||
      String(s.code || '').toUpperCase() === upper
  );
  if (exact) return { store: exact, cleanName: exact.name };

  // 2. Match with 'BDG ' prefix
  exact = allStores.find((s) => String(s.name || '').toUpperCase() === 'BDG ' + upper);
  if (exact) return { store: exact, cleanName: exact.name };

  // 2b. Alias substring check (sorted longest key first)
  const aliasEntries = Object.entries(EXCEL_STORE_ALIAS_MAP).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [aliasKey, targetVal] of aliasEntries) {
    if (upper.includes(aliasKey.trim())) {
      const aliasStore = allStores.find(
        (s) =>
          String(s.code).toUpperCase() === targetVal ||
          String(s.name).toUpperCase() === targetVal
      );
      if (aliasStore) return { store: aliasStore, cleanName: aliasStore.name };
    }
  }

  // 3. Substring / Word Match (sort by longest store name first to avoid partial short matches)
  const sortedStores = [...allStores].sort(
    (a, b) => (b.name || '').length - (a.name || '').length
  );
  for (const st of sortedStores) {
    const stName = String(st.name || '')
      .toUpperCase()
      .trim();
    if (!stName || stName.length < 3) continue;
    const stNameNoBdg = stName.replace(/^BDG\s+/, '');

    // Whole word match jika query berada di dalam nama toko (hindari "OFF" mencocokkan "OFFICE")
    const isWholeWordInStoreName =
      upper.length >= 5 &&
      new RegExp(`\\b${upper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(stName);

    if (
      upper === stName ||
      upper === stNameNoBdg ||
      (stName.length >= 4 && upper.includes(stName)) ||
      isWholeWordInStoreName
    ) {
      return { store: st, cleanName: st.name };
    }
  }

  // 4. Token overlap match
  const STOP_WORDS = new Set([
    'BDG', 'BANDUNG', 'JAKARTA', 'SURABAYA', 'MALANG', 'BOGOR', 'DEPOK', 'TANGERANG', 'BEKASI',
    'OFF', 'LIBUR', 'CUTI', 'SAKIT', 'IZIN', 'WEEKEND', 'STANDBY', 'OFFICE', 'STORE', 'TOKO',
    'CABANG', 'VISIT', 'AUDIT', 'DAN', 'AND', 'THE', 'PARK', 'JALAN', 'RAYA', 'KAV'
  ]);
  const partTokens = upper
    .split(/[\s\-/,()]+/)
    .filter((t) => t.length >= 4 && !STOP_WORDS.has(t));
  if (partTokens.length > 0) {
    let bestStore: MasterStore | null = null;
    let bestScore = 0;
    for (const st of allStores) {
      const stName = String(st.name || '').toUpperCase();
      let matchedTokens = 0;
      for (const tok of partTokens) {
        if (stName.includes(tok)) matchedTokens++;
      }
      const score = matchedTokens / Math.max(partTokens.length, 1);
      if (score > bestScore && score >= 0.5 && matchedTokens >= 1) {
        bestScore = score;
        bestStore = st;
      }
    }
    if (bestStore) return { store: bestStore, cleanName: bestStore.name };
  }

  return { store: null, cleanName: cleaned };
}

function normalizePicForMatch(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchOrRegisterUserByName(
  rawName: string,
  usersList: User[]
): { user: User; isNew: boolean } {
  const clean = String(rawName || '')
    .replace(/\s+/g, ' ')
    .trim();

  // Guard: never auto-register blank or placeholder names
  if (!clean || clean === '-' || /^(nama|name|total|jumlah|keterangan)$/i.test(clean)) {
    return {
      user: {
        id: '',
        name: '',
        email: '',
        role: 'FMCU Specialist',
        isAdmin: false,
      },
      isNew: false,
    };
  }

  const norm = normalizePicForMatch(clean);

  // 1. Exact or normalized match
  const exact = usersList.find((u) => normalizePicForMatch(u.name || '') === norm);
  if (exact) return { user: exact, isNew: false };

  // 2. Token + Initial match (e.g. "M. Ghifary" / "M Ghifary" vs "Muhammad Ghifary")
  const tokens = norm.split(' ').filter((t) => t.length >= 1);
  let bestUser: User | null = null;
  let bestScore = 0;

  for (const u of usersList) {
    if (u.isAdmin) continue;
    const uNorm = normalizePicForMatch(u.name || '');
    const uTokens = uNorm.split(' ').filter((t) => t.length >= 1);
    if (uTokens.length === 0 || tokens.length === 0) continue;

    let exactMatches = 0;
    let initialMatches = 0;

    for (const t of tokens) {
      if (t.length >= 2 && uTokens.includes(t)) {
        exactMatches++;
      } else if (t.length === 1 && uTokens.some((ut) => ut.startsWith(t))) {
        initialMatches++;
      }
    }

    const totalScore = exactMatches * 2 + initialMatches;
    const minRequired = tokens.length >= 2 ? 3 : 2; // e.g., 1 exact (>=2 chars) + 1 initial = 3, or 2 exact = 4
    if (exactMatches >= 1 && totalScore >= minRequired && totalScore > bestScore) {
      bestScore = totalScore;
      bestUser = u;
    }
  }
  if (bestUser) return { user: bestUser, isNew: false };

  // 3. Auto-register new employee account with default password "0000" (deterministic unique slug)
  const baseSlug = clean
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'user';
  let candidateId = `usr-${baseSlug}`;
  let suffix = 2;
  while (usersList.some((u) => u.id === candidateId)) {
    candidateId = `usr-${baseSlug}-${suffix++}`;
  }

  const newUser: User = {
    id: candidateId,
    name: clean,
    email: `${baseSlug.replace(/-/g, '.')}@fmcu.com`,
    role: 'FMCU Specialist',
    password: '0000',
    isAdmin: false,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
      clean.replace(/\s+/g, '')
    )}`,
  };
  usersList.push(newUser);
  return { user: newUser, isNew: true };
}

function classifyNonVisitCategory(desc: string, loc: string): ScheduleCategory {
  const combined = `${desc} ${loc}`.toLowerCase();
  if (/\b(nso|new\s+store\s+opening|reopening|re-opening)\b/i.test(combined)) {
    return 'NSO';
  }
  if (/\b(audit|kalibrasi|uji\s+kompetensi|sertifikasi|qsc)\b/i.test(combined)) {
    return 'AUDIT';
  }
  if (
    /\b(sbs|training|basic\s+training|refreshment|orientasi|kelas|pengajar|in\s+class|field\s+training)\b/i.test(
      combined
    )
  ) {
    return 'TRAINING';
  }
  if (/\b(meeting|koordinasi|rapat|townhall|briefing|diskusi|sync)\b/i.test(combined)) {
    return 'MEETING';
  }
  if (/\b(work\s*plan|project|evaluasi|materi|modul|kurikulum|admin|rekap)\b/i.test(combined)) {
    return 'WORK_PLAN';
  }
  return 'OPERATION';
}

// ============================================================================
// PARSE SINGLE EXCEL WORKSHEET FOLLOWING STRICT FMCU CORPORATE RULES
// ============================================================================
export function parseScheduleExcelSheet(
  worksheet: XLSX.WorkSheet,
  sheetName: string,
  existingUsers: User[]
): ParsedExcelScheduleSummary {
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  const allStores = getMasterStores();
  const workingUsers: User[] = [...existingUsers];

  const agendas: ScheduleAgenda[] = [];
  const matchedUsersSet = new Set<string>();
  const matchedStoresSet = new Set<string>();
  const scheduledDatesByUser = new Map<string, Set<string>>();
  const allDatesInSheet = new Set<string>();

  let newUsersCount = 0;
  let visitCount = 0;
  let nsoCount = 0;
  let nonStoreAgendaCount = 0;
  let offCount = 0;
  let cutiCount = 0;

  // Detect header row (supports Indonesian/English variants)
  let startRow = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const firstCell = String(rows[i]?.[0] || '')
      .trim()
      .toLowerCase();
    const secondCell = String(rows[i]?.[1] || '')
      .trim()
      .toLowerCase();
    if (
      firstCell === 'nama' ||
      firstCell === 'name' ||
      firstCell === 'pic' ||
      secondCell.includes('start date') ||
      secondCell.includes('tanggal')
    ) {
      startRow = i + 1;
      break;
    }
  }

  let lastValidRawName = '';
  const safeSheetSlug = sheetName.replace(/[^a-zA-Z0-9_-]/g, '') || 'Sheet';

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 2) {
      lastValidRawName = '';
      continue;
    }

    const rawName = String(row[0] || '').trim();
    const rawStartDate = row[1];
    const rawStartTime = row[2];
    const rawEndDate = row[3];
    const rawEndTime = row[4];
    const rawDesc = String(row[5] || '').trim();
    const rawLoc = String(row[6] || '').trim();

    if (!rawName && !rawStartDate && !rawDesc && !rawLoc) {
      lastValidRawName = '';
      continue;
    }

    // Skip repeated header or summary rows
    if (rawName && /^(nama|name|total|jumlah|keterangan)$/i.test(rawName)) {
      continue;
    }

    // Carry forward merged-cell PIC name ONLY if this row has a valid date + activity
    const effectiveRawName = rawName || (rawStartDate && (rawDesc || rawLoc) ? lastValidRawName : '');
    if (!effectiveRawName) continue;
    if (rawName) lastValidRawName = rawName;

    const dateStr = parseExcelSerialDate(rawStartDate);
    if (!dateStr) continue;

    const { user: matchedUser, isNew } = matchOrRegisterUserByName(effectiveRawName, workingUsers);
    if (!matchedUser || !matchedUser.name) continue;
    if (isNew) newUsersCount++;

    const endDateStr = parseExcelSerialDate(rawEndDate) || dateStr;
    const startTime = parseExcelTime24(rawStartTime, '08:30');
    const endTime = parseExcelTime24(rawEndTime, '17:30');

    const descClean = rawDesc.trim();
    const locClean = rawLoc.trim();

    // Skip empty template rows (e.g., blank template sheet '16 - 22 Nov' where Col F & Col G are empty)
    if (!descClean && !locClean) continue;

    matchedUsersSet.add(matchedUser.name);
    allDatesInSheet.add(dateStr);

    if (!scheduledDatesByUser.has(matchedUser.name)) {
      scheduledDatesByUser.set(matchedUser.name, new Set());
    }
    scheduledDatesByUser.get(matchedUser.name)!.add(dateStr);

    const descLower = descClean.toLowerCase();

    // ------------------------------------------------------------------------
    // RULE 1: Check for CUTI or OFF in Col F (Description)
    // ------------------------------------------------------------------------
    if (descLower === 'cuti' || /^cuti\b/i.test(descClean)) {
      cutiCount++;
      agendas.push({
        id: `xl-${safeSheetSlug}-${r}-cuti`,
        title: 'CUTI',
        date: dateStr,
        endDate: endDateStr,
        time: startTime,
        endTime,
        category: 'CUTI',
        location: locClean || 'CUTI RESMI',
        pic: matchedUser.name,
        description: descClean || 'Cuti Resmi Karyawan FMCU',
        rawDescription: rawDesc,
        rawLocation: rawLoc,
        tags: ['CUTI', sheetName],
        completed: false,
        priority: 'NORMAL',
        createdBy: 'Excel Sync',
      });
      continue;
    }

    if (
      descLower === 'off' ||
      descLower === 'ganti off' ||
      /^ganti\s+off\b/i.test(descClean) ||
      descLower === 'libur'
    ) {
      offCount++;
      const isGantiOff = /ganti\s+off/i.test(descClean);
      agendas.push({
        id: `xl-${safeSheetSlug}-${r}-off`,
        title: isGantiOff ? `GANTI OFF (${descClean})` : 'HARI LIBUR / OFF',
        date: dateStr,
        endDate: endDateStr,
        time: startTime,
        endTime,
        category: 'OFF',
        location: locClean || 'OFF / LIBUR',
        pic: matchedUser.name,
        description: isGantiOff ? descClean : 'Libur Mingguan (OFF)',
        rawDescription: rawDesc,
        rawLocation: rawLoc,
        tags: ['OFF', sheetName],
        completed: true,
        priority: 'NORMAL',
        createdBy: 'Excel Sync',
      });
      continue;
    }

    // ------------------------------------------------------------------------
    // RULE 2: Parse Multi-Point Descriptions (Col F) & Locations (Col G)
    // Strip leading "Agenda :" and ONLY split into multiple points when numbered
    // bullets (1., 2., etc.) exist so metadata lines ("Level Peserta", "Jumlah Peserta")
    // stay attached to their agenda!
    // ------------------------------------------------------------------------
    const bodyWithoutAgendaPrefix = descClean.replace(/^\s*agenda\s*:\s*/i, '').trim();
    const descPoints: string[] = [];

    if (/(?:^|\n)\s*\d+[\.\)]\s+/.test(bodyWithoutAgendaPrefix)) {
      const splitByNum = bodyWithoutAgendaPrefix
        .split(/(?=(?:^|\n)\s*\d+[\.\)]\s+)/)
        .map((s) => s.replace(/^\s*\d+[\.\)]\s*/, '').trim())
        .filter(Boolean);
      if (splitByNum.length > 0) {
        descPoints.push(...splitByNum);
      } else {
        descPoints.push(bodyWithoutAgendaPrefix);
      }
    } else if (bodyWithoutAgendaPrefix) {
      descPoints.push(bodyWithoutAgendaPrefix);
    }

    const rawLocLines = locClean
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    let locSegments: string[] = [];

    if (rawLocLines.length > 1) {
      locSegments = rawLocLines.map((l) => l.replace(/^\d+[\.\)]\s*/, '').trim()).filter(Boolean);
    } else if (descPoints.length > 1 && locClean.includes('&')) {
      const ampParts = locClean
        .split(/\s*&\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (ampParts.length >= 2) {
        locSegments = ampParts;
      } else {
        locSegments = [locClean];
      }
    } else if (locClean) {
      locSegments = [locClean];
    }

    const numItems = Math.max(descPoints.length, 1);

    for (let idx = 0; idx < numItems; idx++) {
      const descPart = descPoints[idx] || descPoints[0] || 'Agenda Operasional';
      const cleanPointTitle = descPart
        .split(/\r?\n/)[0]
        .replace(/^\s*agenda\s*:\s*/i, '')
        .replace(/^\s*\d+[\.\)]\s*/, '')
        .trim();

      let locPart = '';
      if (locSegments.length >= numItems) {
        locPart = locSegments[idx] || '';
      } else if (locSegments.length === 1) {
        locPart = locSegments[0];
      } else {
        locPart = locSegments[idx] || locSegments[locSegments.length - 1] || '';
      }

      // ----------------------------------------------------------------------
      // RULE 3: STRICT VISIT STORE & NSO KEYWORD DETECTION
      // Visit Store = ONLY if Col F contains "Visit", "Visit Store", or "Refreshment QSC" / "Refershment QSC",
      // AND Col G does NOT contain "NSO" and does NOT contain "FMCU".
      // If Col G has store name but Col F does not have visit keyword -> NOT VISIT.
      // If Col F has store name but Col G has NSO -> NOT VISIT (NSO).
      // ----------------------------------------------------------------------
      const isNsoKeyword =
        /\b(nso|new\s+store\s+opening|reopening|re-opening)\b/i.test(cleanPointTitle) ||
        /\b(nso|new\s+store\s+opening|reopening|re-opening)\b/i.test(locPart);

      const isVisitKeyword = /\b(visit|visit\s+store|refershment\s+qsc|refreshment\s+qsc)\b/i.test(
        cleanPointTitle
      );
      const isFmcuLoc = /\bfmcu\b/i.test(locPart);

      const isVisitStore = isVisitKeyword && !isNsoKeyword && !isFmcuLoc;

      if (isVisitStore) {
        // Split multiple stores in locPart separated by '&'
        const storeSubParts = locPart
          ? locPart
              .split(/\s*&\s*/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

        const isRefreshmentQsc = /refershment\s+qsc|refreshment\s+qsc/i.test(cleanPointTitle);
        const visitPrefix = isRefreshmentQsc ? 'Refreshment QSC' : 'Visit Store';

        if (storeSubParts.length > 0) {
          storeSubParts.forEach((subLoc, subIdx) => {
            if (/^(fmcu|online|zoom|teams|ho|head\s*office)$/i.test(subLoc)) {
              nonStoreAgendaCount++;
              const cat = classifyNonVisitCategory(cleanPointTitle, subLoc);
              agendas.push({
                id: `xl-${safeSheetSlug}-${r}-${idx}-${subIdx}`,
                title: cleanPointTitle,
                date: dateStr,
                endDate: endDateStr,
                time: startTime,
                endTime,
                category: cat,
                location: subLoc,
                pic: matchedUser.name,
                description: `${descPart} (${subLoc})`,
                rawDescription: rawDesc,
                rawLocation: rawLoc,
                tags: [cat, sheetName],
                completed: false,
                priority: 'NORMAL',
                createdBy: 'Excel Sync',
              });
              return;
            }

            const { store: matchedStore, cleanName } = matchStoreFromLocationPart(
              subLoc,
              allStores
            );
            const storeCode = matchedStore ? matchedStore.code : 'STORE';
            const storeName = matchedStore ? matchedStore.name : cleanName || subLoc;
            const bestieOwner = matchedStore ? getBestieByStoreCode(matchedStore.code) : '';

            if (matchedStore) {
              matchedStoresSet.add(matchedStore.code);
            }
            visitCount++;

            agendas.push({
              id: `xl-${safeSheetSlug}-${r}-${idx}-${subIdx}`,
              title: `${visitPrefix} - ${storeName}`,
              date: dateStr,
              endDate: endDateStr,
              time: startTime,
              endTime,
              category: 'VISIT',
              location: matchedStore
                ? `${matchedStore.name} (${matchedStore.code}) - ${matchedStore.city}`
                : storeName,
              pic: matchedUser.name,
              description: `${cleanPointTitle} — Lokasi: ${storeName}`,
              rawDescription: rawDesc,
              rawLocation: rawLoc,
              storeCode,
              storeName,
              storeType: matchedStore?.type || 'CVS',
              storeHead: matchedStore?.storeHead || '',
              areaManager: matchedStore?.areaManager || '',
              regionalManager: matchedStore?.regionalManager || '',
              storeEmail: matchedStore?.email || '',
              bestieInCharge: bestieOwner,
              tags: ['VISIT', storeCode, sheetName],
              completed: false,
              priority: 'HIGH',
              createdBy: 'Excel Sync',
            });
          });
        } else {
          // Fallback if Col G is empty but Col F has store name after 'Visit Store'
          const { store: matchedStore, cleanName } = matchStoreFromLocationPart(
            cleanPointTitle,
            allStores
          );
          const storeCode = matchedStore ? matchedStore.code : 'STORE';
          const storeName = matchedStore ? matchedStore.name : cleanName || cleanPointTitle;
          const bestieOwner = matchedStore ? getBestieByStoreCode(matchedStore.code) : '';
          if (matchedStore) matchedStoresSet.add(matchedStore.code);
          visitCount++;

          agendas.push({
            id: `xl-${safeSheetSlug}-${r}-${idx}`,
            title: `${visitPrefix} - ${storeName}`,
            date: dateStr,
            endDate: endDateStr,
            time: startTime,
            endTime,
            category: 'VISIT',
            location: matchedStore
              ? `${matchedStore.name} (${matchedStore.code}) - ${matchedStore.city}`
              : storeName,
            pic: matchedUser.name,
            description: descPart,
            rawDescription: rawDesc,
            rawLocation: rawLoc,
            storeCode,
            storeName,
            storeType: matchedStore?.type || 'CVS',
            storeHead: matchedStore?.storeHead || '',
            areaManager: matchedStore?.areaManager || '',
            regionalManager: matchedStore?.regionalManager || '',
            storeEmail: matchedStore?.email || '',
            bestieInCharge: bestieOwner,
            tags: ['VISIT', storeCode, sheetName],
            completed: false,
            priority: 'HIGH',
            createdBy: 'Excel Sync',
          });
        }
      } else {
        // --------------------------------------------------------------------
        // RULE 4: NON-VISIT AGENDA (NSO, FMCU, Training, Meeting, Operation)
        // --------------------------------------------------------------------
        let agendaTitle = cleanPointTitle;
        let category: ScheduleCategory = classifyNonVisitCategory(cleanPointTitle, locPart);

        if (isNsoKeyword) {
          category = 'NSO';
          nsoCount++;
          if (!/\bnso\b/i.test(agendaTitle)) {
            agendaTitle = `NSO ${agendaTitle}`;
          }
        } else {
          nonStoreAgendaCount++;
        }

        const { store: refStore } = matchStoreFromLocationPart(locPart || cleanPointTitle, allStores);

        agendas.push({
          id: `xl-${safeSheetSlug}-${r}-${idx}`,
          title: agendaTitle,
          date: dateStr,
          endDate: endDateStr,
          time: startTime,
          endTime,
          category,
          location: locPart || 'FMCU / Head Office',
          pic: matchedUser.name,
          description: locPart ? `${descPart.replace(/\r?\n/g, ' | ')} — Lokasi: ${locPart}` : descPart.replace(/\r?\n/g, ' | '),
          rawDescription: rawDesc,
          rawLocation: rawLoc,
          storeCode: refStore?.code,
          storeName: refStore?.name,
          storeType: refStore?.type,
          storeHead: refStore?.storeHead,
          areaManager: refStore?.areaManager,
          regionalManager: refStore?.regionalManager,
          storeEmail: refStore?.email,
          tags: [category, sheetName],
          completed: false,
          priority: category === 'NSO' || category === 'AUDIT' ? 'HIGH' : 'NORMAL',
          createdBy: 'Excel Sync',
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // RULE 5: FILL UNSCHEDULED DAYS IN THE IMPORTED WEEK(S) AS "OFF"
  // --------------------------------------------------------------------------
  if (allDatesInSheet.size > 0 && scheduledDatesByUser.size > 0) {
    const sortedDates = Array.from(allDatesInSheet).sort();
    const minDateParts = sortedDates[0].split('-').map(Number);
    const maxDateParts = sortedDates[sortedDates.length - 1].split('-').map(Number);

    const startD = new Date(minDateParts[0], minDateParts[1] - 1, minDateParts[2], 12, 0, 0);
    const startDay = startD.getDay();
    const diffToMon = startDay === 0 ? -6 : 1 - startDay;
    startD.setDate(startD.getDate() + diffToMon);

    const endD = new Date(maxDateParts[0], maxDateParts[1] - 1, maxDateParts[2], 12, 0, 0);
    const endDay = endD.getDay();
    const diffToSun = endDay === 0 ? 0 : 7 - endDay;
    endD.setDate(endD.getDate() + diffToSun);

    const fullWeekDates: { dateStr: string; isWeekend: boolean }[] = [];
    const cur = new Date(startD);
    while (cur <= endD && fullWeekDates.length <= 35) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const dow = cur.getDay();
      fullWeekDates.push({
        dateStr: `${y}-${m}-${d}`,
        isWeekend: dow === 0 || dow === 6,
      });
      cur.setDate(cur.getDate() + 1);
    }

    scheduledDatesByUser.forEach((userDatesSet, userName) => {
      fullWeekDates.forEach((dObj) => {
        if (!userDatesSet.has(dObj.dateStr)) {
          offCount++;
          agendas.push({
            id: `xl-auto-off-${safeSheetSlug}-${userName.replace(/[^a-zA-Z0-9_-]/g, '')}-${dObj.dateStr}`,
            title: dObj.isWeekend ? 'WEEKEND / OFF' : 'HARI LIBUR / OFF',
            date: dObj.dateStr,
            endDate: dObj.dateStr,
            time: '08:30',
            endTime: '17:30',
            category: 'OFF',
            location: 'OFF / LIBUR',
            pic: userName,
            description: dObj.isWeekend
              ? 'Libur Akhir Pekan (Weekend Off)'
              : 'Hari Libur Mingguan (Off)',
            rawDescription: 'OFF',
            rawLocation: '',
            tags: ['OFF', sheetName],
            completed: true,
            priority: 'NORMAL',
            createdBy: 'Excel Auto-Off',
          });
        }
      });
    });
  }

  return {
    sheetName,
    agendas,
    updatedUsers: workingUsers,
    newUsersCount,
    stats: {
      totalRows: agendas.length,
      visitCount,
      nsoCount,
      nonStoreAgendaCount,
      offCount,
      cutiCount,
      matchedUsersCount: matchedUsersSet.size,
      matchedStoresCount: matchedStoresSet.size,
    },
  };
}

// ============================================================================
// PARSE COMPLETE EXCEL WORKBOOK FILE (SUPPORTS MULTI-SHEET OR SINGLE SHEET)
// ============================================================================
export interface ExcelWorkbookParseResult {
  workbook: XLSX.WorkBook;
  availableSheets: string[];
  summary: ParsedExcelScheduleSummary;
}

export async function parseScheduleExcelFile(
  file: File,
  existingUsers: User[],
  sheetNameOption: 'ALL' | string = 'ALL'
): Promise<ExcelWorkbookParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const availableSheets: string[] = workbook.SheetNames || [];

  const combinedAgendas: ScheduleAgenda[] = [];
  let workingUsers = [...existingUsers];
  let totalVisit = 0;
  let totalNso = 0;
  let totalNonStore = 0;
  let totalOff = 0;
  let totalCuti = 0;
  let totalNewUsers = 0;
  const matchedUsersSet = new Set<string>();
  const matchedStoresSet = new Set<string>();

  const sheetsToParse =
    sheetNameOption === 'ALL'
      ? availableSheets
      : availableSheets.filter(
          (s: string) => s.trim().toLowerCase() === sheetNameOption.trim().toLowerCase()
        );

  const seenAgendaIds = new Set<string>();
  sheetsToParse.forEach((sName: string, sheetIdx: number) => {
    const ws = workbook.Sheets[sName];
    if (!ws) return;
    const res = parseScheduleExcelSheet(ws, sName, workingUsers);
    for (const ag of res.agendas) {
      let uniqueId = ag.id;
      if (seenAgendaIds.has(uniqueId)) {
        uniqueId = `${ag.id}-s${sheetIdx}`;
      }
      seenAgendaIds.add(uniqueId);
      combinedAgendas.push(uniqueId === ag.id ? ag : { ...ag, id: uniqueId });
    }
    workingUsers = res.updatedUsers;
    totalVisit += res.stats.visitCount;
    totalNso += res.stats.nsoCount;
    totalNonStore += res.stats.nonStoreAgendaCount;
    totalOff += res.stats.offCount;
    totalCuti += res.stats.cutiCount;
    totalNewUsers += res.newUsersCount;
    res.agendas.forEach((a) => {
      if (a.pic) matchedUsersSet.add(a.pic);
      if (a.storeCode) matchedStoresSet.add(a.storeCode);
    });
  });

  return {
    workbook,
    availableSheets,
    summary: {
      sheetName:
        sheetNameOption === 'ALL'
          ? `Semua Sheet (${availableSheets.length} Periode Minggu)`
          : sheetNameOption,
      agendas: combinedAgendas,
      updatedUsers: workingUsers,
      newUsersCount: totalNewUsers,
      stats: {
        totalRows: combinedAgendas.length,
        visitCount: totalVisit,
        nsoCount: totalNso,
        nonStoreAgendaCount: totalNonStore,
        offCount: totalOff,
        cutiCount: totalCuti,
        matchedUsersCount: matchedUsersSet.size,
        matchedStoresCount: matchedStoresSet.size,
      },
    },
  };
}

// ============================================================================
// EXPORT SCHEDULE TO OFFICIAL 7-COLUMN EXCEL TEMPLATE ("Templete Jadwal.xlsx")
// ============================================================================
export function generateTemplateJadwalSheetData(
  agendas: ScheduleAgenda[],
  users: User[],
  targetUserName = 'ALL'
): any[][] {
  const header = [
    'Nama',
    'Start Date',
    'Start Time',
    'End Date',
    'End Time',
    'Description',
    'Location',
  ];
  const rows: any[][] = [header];

  const nonAdminUsers = users
    .filter((u) => !u.isAdmin)
    .filter((u) => targetUserName === 'ALL' || u.name === targetUserName)
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));

  for (const u of nonAdminUsers) {
    const userAgendas = agendas
      .filter((a) => a.pic.toLowerCase() === u.name.toLowerCase())
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    if (userAgendas.length === 0) continue;

    // Group by date so multi-point agendas on the same date export cleanly
    const byDate = new Map<string, ScheduleAgenda[]>();
    for (const ag of userAgendas) {
      if (!byDate.has(ag.date)) byDate.set(ag.date, []);
      byDate.get(ag.date)!.push(ag);
    }

    const sortedDates = Array.from(byDate.keys()).sort();
    for (const dateStr of sortedDates) {
      const dayItems = byDate.get(dateStr)!;

      // Check if it's a single OFF or CUTI item
      if (dayItems.length === 1 && (dayItems[0].category === 'OFF' || dayItems[0].category === 'CUTI')) {
        const item = dayItems[0];
        rows.push([
          u.name,
          dateStr,
          item.time || '08:30',
          item.endDate || dateStr,
          item.endTime || '17:30',
          item.category === 'CUTI' ? 'Cuti' : 'Off',
          '',
        ]);
        continue;
      }

      // Filter out auto-off if there are real agendas on the same day
      const activeItems = dayItems.filter((i) => i.category !== 'OFF');
      const itemsToExport = activeItems.length > 0 ? activeItems : dayItems;

      if (itemsToExport.length === 1) {
        const item = itemsToExport[0];
        const descText =
          item.rawDescription ||
          (item.category === 'VISIT'
            ? 'Visit Store'
            : item.title);
        const locText =
          item.rawLocation ||
          (item.category === 'VISIT'
            ? item.storeName || item.location
            : item.location);

        rows.push([
          u.name,
          dateStr,
          item.time || '08:30',
          item.endDate || dateStr,
          item.endTime || '17:30',
          descText,
          locText,
        ]);
      } else {
        // Multi-point formatting (1. ... \n 2. ...)
        const startTime = itemsToExport[0].time || '08:30';
        const endTime = itemsToExport[itemsToExport.length - 1].endTime || '17:30';

        // Check if all items are VISIT store on the same day -> can combine with '&'
        const allVisits = itemsToExport.every((i) => i.category === 'VISIT');
        if (allVisits) {
          const joinedStores = itemsToExport
            .map((i) => i.storeName || i.location)
            .join(' & ');
          rows.push([
            u.name,
            dateStr,
            startTime,
            dateStr,
            endTime,
            'Visit Store',
            joinedStores,
          ]);
        } else {
          const numberedDesc = itemsToExport
            .map((item, idx) => {
              const label =
                item.category === 'VISIT' ? 'Visit Store' : item.title;
              return `${idx + 1}. ${label}`;
            })
            .join('\n');
          const numberedLoc = itemsToExport
            .map((item, idx) => {
              const loc =
                item.category === 'VISIT'
                  ? item.storeName || item.location
                  : item.location;
              return `${idx + 1}. ${loc}`;
            })
            .join('\n');

          rows.push([
            u.name,
            dateStr,
            startTime,
            dateStr,
            endTime,
            numberedDesc,
            numberedLoc,
          ]);
        }
      }
    }
  }

  return rows;
}

export function exportScheduleToTemplateExcel(
  agendas: ScheduleAgenda[],
  users: User[],
  targetUserName = 'ALL',
  sheetLabel = 'Jadwal FMCU'
): void {
  const sheetData = generateTemplateJadwalSheetData(agendas, users, targetUserName);
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Official corporate column widths from C:\FMCUVISITREPORT\js\app.js
  ws['!cols'] = [
    { wch: 22 }, // Nama
    { wch: 14 }, // Start Date
    { wch: 13 }, // Start Time
    { wch: 14 }, // End Date
    { wch: 13 }, // End Time
    { wch: 54 }, // Description
    { wch: 58 }, // Location
  ];

  const wb = XLSX.utils.book_new();
  const safeSheetName = sheetLabel.slice(0, 31).replace(/[\\/?*[\]]/g, '-');
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName || 'Jadwal FMCU');

  const filename =
    targetUserName === 'ALL'
      ? `Templete_Jadwal_FMCU_All_Team_${new Date().toISOString().split('T')[0]}.xlsx`
      : `Templete_Jadwal_${targetUserName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

  XLSX.writeFile(wb, filename);
}

// ============================================================================
// MASTER TOKO EXCEL PARSER, VALIDATOR, MERGE PREVIEW & TEMPLATE EXPORTER
// ============================================================================
export interface MasterStoreMergeResult {
  stores: MasterStore[];
  addedCount: number;
  updatedCount: number;
  unchangedCount: number;
  invalidCount: number;
  errors: string[];
}

export interface ParsedMasterStoreExcelResult {
  sheetName: string;
  availableSheets: string[];
  incomingStores: Partial<MasterStore>[];
  mergePreview: MasterStoreMergeResult;
  invalidRows: { row: number; reason: string }[];
  detectedColumns: Record<string, string>;
}

type MasterStoreFieldKey =
  | 'code'
  | 'name'
  | 'type'
  | 'city'
  | 'region'
  | 'address'
  | 'areaManager'
  | 'areaManagerEmail'
  | 'regionalManager'
  | 'regionalManagerEmail'
  | 'storeHead'
  | 'email'
  | 'storePhone'
  | 'lat'
  | 'lng'
  | 'coordinates';

const MASTER_STORE_HEADER_ALIASES: Record<MasterStoreFieldKey, string[]> = {
  code: ['kode toko', 'store code', 'kd toko', 'id toko', 'no toko', 'kode', 'code', 'store_code', 'store id'],
  name: ['nama toko', 'store name', 'nama cabang', 'cabang', 'outlet', 'toko', 'name', 'store_name'],
  type: ['tipe toko', 'store type', 'store class', 'kategori toko', 'tipe', 'type', 'class', 'kelas', 'format'],
  city: ['kota / wilayah', 'kota/wilayah', 'kota / kabupaten', 'kota/kabupaten', 'kota', 'city', 'kabupaten'],
  region: ['wilayah', 'region', 'regional', 'area'],
  address: ['alamat lengkap', 'alamat toko', 'alamat', 'address', 'lokasi'],
  areaManager: ['area manager (am)', 'area manager', 'nama am', 'area_manager', 'am'],
  areaManagerEmail: ['email am', 'am email', 'area manager email', 'email area manager'],
  regionalManager: ['regional manager (rm)', 'regional manager', 'nama rm', 'regional_manager', 'rm'],
  regionalManagerEmail: ['email rm', 'rm email', 'regional manager email', 'email regional manager'],
  storeHead: ['store head', 'kepala toko', 'pic toko', 'store leader', 'store_head', 'sh'],
  email: ['email toko', 'store email', 'e-mail', 'email'],
  storePhone: [
    'no. telepon toko',
    'no telepon toko',
    'no. telp toko',
    'no telp toko',
    'telepon toko',
    'no telepon',
    'no telp',
    'telepon',
    'telp',
    'store phone',
    'phone',
    'no hp',
    'hp',
    'whatsapp',
  ],
  lat: ['latitude', 'koordinat lat', 'lintang', 'lat'],
  lng: ['longitude', 'koordinat lng', 'koordinat lon', 'bujur', 'lng', 'lon', 'long'],
  coordinates: ['koordinat', 'coordinates', 'lat,lng', 'lat/lng', 'lat lng'],
};

function normalizeHeaderCell(val: any): string {
  return String(val || '')
    .toLowerCase()
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchHeaderField(headerText: string): MasterStoreFieldKey | null {
  const norm = normalizeHeaderCell(headerText);
  if (!norm) return null;

  // 1. Exact alias match first (most specific)
  for (const [field, aliases] of Object.entries(MASTER_STORE_HEADER_ALIASES) as [
    MasterStoreFieldKey,
    string[],
  ][]) {
    if (aliases.some((alias) => norm === alias)) {
      return field;
    }
  }

  // 2. Normalized punctuation-stripped match (longest alias first to avoid 'email' matching 'email am')
  const stripped = norm.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const ranked: { field: MasterStoreFieldKey; alias: string }[] = [];
  for (const [field, aliases] of Object.entries(MASTER_STORE_HEADER_ALIASES) as [
    MasterStoreFieldKey,
    string[],
  ][]) {
    for (const alias of aliases) {
      ranked.push({ field, alias: alias.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() });
    }
  }
  ranked.sort((a, b) => b.alias.length - a.alias.length);

  for (const entry of ranked) {
    if (stripped === entry.alias) return entry.field;
  }
  for (const entry of ranked) {
    if (entry.alias.length >= 4 && stripped.includes(entry.alias)) {
      return entry.field;
    }
  }
  return null;
}

function getWorksheetCellDisplayString(ws: XLSX.WorkSheet, r: number, c: number): string {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell) return '';
  if (cell.w !== undefined && cell.w !== null && String(cell.w).trim() !== '') {
    return String(cell.w).trim();
  }
  if (cell.v !== undefined && cell.v !== null) {
    return String(cell.v).trim();
  }
  return '';
}

function getWorksheetCellRawValue(ws: XLSX.WorkSheet, r: number, c: number): any {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  return cell ? cell.v : '';
}

function parseCoordinateValue(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  const cleaned = String(val)
    .trim()
    .replace(/\s+/g, '')
    .replace(/,/g, '.');
  if (!cleaned || cleaned === '-') return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function normalizeIncomingStoreCode(rawCode: string, existingCodeSet: Set<string>): string {
  const trimmed = rawCode.trim().toUpperCase();
  if (!trimmed) return '';
  if (/^\d{1,3}$/.test(trimmed)) {
    const padded4 = trimmed.padStart(4, '0');
    if (existingCodeSet.has(padded4) || !existingCodeSet.has(trimmed)) {
      return padded4;
    }
  }
  return trimmed;
}

function buildMasterStoreMergePreview(
  existingStores: MasterStore[],
  incomingStores: Partial<MasterStore>[],
  mode: 'merge' | 'replace',
  initialInvalidCount = 0,
  initialErrors: string[] = []
): MasterStoreMergeResult {
  const errors = [...initialErrors];
  let invalidCount = initialInvalidCount;
  let addedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  const existingMap = new Map<string, MasterStore>();
  for (const s of existingStores) {
    const code = String(s.code || '').trim().toUpperCase();
    if (code) existingMap.set(code, s);
  }

  const normalizeLat = (val: any, fallback = 0): number => {
    const n = parseCoordinateValue(val);
    return n !== null && n >= -90 && n <= 90 ? n : fallback;
  };
  const normalizeLng = (val: any, fallback = 0): number => {
    const n = parseCoordinateValue(val);
    return n !== null && n >= -180 && n <= 180 ? n : fallback;
  };
  const pickStr = (incomingVal: any, fallback: string): string => {
    const s = String(incomingVal ?? '').trim();
    return s && s !== '-' ? s : fallback;
  };

  if (mode === 'replace') {
    const nextList: MasterStore[] = [];
    const seen = new Set<string>();
    for (const inc of incomingStores) {
      const code = String(inc.code || '').trim().toUpperCase();
      const name = String(inc.name || '').trim();
      if (!code || !name) {
        invalidCount++;
        errors.push(`Data tidak valid (kode/nama toko kosong): ${code || name || '(kosong)'}`);
        continue;
      }
      if (seen.has(code)) continue;
      seen.add(code);

      const prev = existingMap.get(code);
      const lat = normalizeLat(inc.lat ?? inc.latitude, prev?.lat ?? 0);
      const lng = normalizeLng(inc.lng ?? inc.longitude, prev?.lng ?? 0);

      const incRegion = String((inc as any).region ?? '').trim();
      const prevRegion = String((prev as any)?.region ?? '').trim();
      const nextRegion = incRegion && incRegion !== '-' ? incRegion : prevRegion;

      const nextStore: MasterStore = {
        code,
        name,
        type: pickStr(inc.type, prev?.type || 'CVS'),
        city: pickStr(inc.city, prev?.city || ''),
        ...(nextRegion ? ({ region: nextRegion } as Partial<MasterStore>) : {}),
        address: pickStr(inc.address, prev?.address || ''),
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        email: pickStr(inc.email, prev?.email || ''),
        storePhone: pickStr(inc.storePhone, prev?.storePhone || ''),
        storeHead: pickStr(inc.storeHead, prev?.storeHead || ''),
        areaManager: pickStr(inc.areaManager, prev?.areaManager || ''),
        areaManagerEmail: pickStr(inc.areaManagerEmail, prev?.areaManagerEmail || ''),
        regionalManager: pickStr(inc.regionalManager, prev?.regionalManager || ''),
        regionalManagerEmail: pickStr(inc.regionalManagerEmail, prev?.regionalManagerEmail || ''),
      };
      nextList.push(nextStore);
      if (prev) updatedCount++;
      else addedCount++;
    }

    return {
      stores: nextList,
      addedCount,
      updatedCount,
      unchangedCount,
      invalidCount,
      errors,
    };
  }

  // mode === 'merge' (upsert preserving existing fields/coordinates when incoming cells are blank)
  const mergedMap = new Map<string, MasterStore>();
  for (const s of existingStores) {
    const code = String(s.code || '').trim().toUpperCase();
    if (code) mergedMap.set(code, { ...s, code });
  }

  for (const inc of incomingStores) {
    const code = String(inc.code || '').trim().toUpperCase();
    if (!code) {
      invalidCount++;
      continue;
    }

    const prev = mergedMap.get(code);
    if (!prev) {
      const name = String(inc.name || '').trim();
      if (!name) {
        invalidCount++;
        errors.push(`Toko baru kode ${code} tidak memiliki Nama Toko.`);
        continue;
      }
      const lat = normalizeLat(inc.lat ?? inc.latitude, 0);
      const lng = normalizeLng(inc.lng ?? inc.longitude, 0);
      const incRegion = String((inc as any).region ?? '').trim();
      mergedMap.set(code, {
        code,
        name,
        type: pickStr(inc.type, 'CVS'),
        city: pickStr(inc.city, ''),
        ...(incRegion && incRegion !== '-' ? ({ region: incRegion } as Partial<MasterStore>) : {}),
        address: pickStr(inc.address, ''),
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        email: pickStr(inc.email, ''),
        storePhone: pickStr(inc.storePhone, ''),
        storeHead: pickStr(inc.storeHead, ''),
        areaManager: pickStr(inc.areaManager, ''),
        areaManagerEmail: pickStr(inc.areaManagerEmail, ''),
        regionalManager: pickStr(inc.regionalManager, ''),
        regionalManagerEmail: pickStr(inc.regionalManagerEmail, ''),
      });
      addedCount++;
    } else {
      const nextLat = normalizeLat(inc.lat ?? inc.latitude, prev.lat);
      const nextLng = normalizeLng(inc.lng ?? inc.longitude, prev.lng);
      const incRegion = String((inc as any).region ?? '').trim();
      const prevRegion = String((prev as any).region ?? '').trim();
      const nextRegion = incRegion && incRegion !== '-' ? incRegion : prevRegion;
      const updated: MasterStore = {
        code,
        name: pickStr(inc.name, prev.name),
        type: pickStr(inc.type, prev.type),
        city: pickStr(inc.city, prev.city),
        ...(nextRegion ? ({ region: nextRegion } as Partial<MasterStore>) : {}),
        address: pickStr(inc.address, prev.address),
        lat: nextLat,
        lng: nextLng,
        latitude: nextLat,
        longitude: nextLng,
        email: pickStr(inc.email, prev.email),
        storePhone: pickStr(inc.storePhone, prev.storePhone),
        storeHead: pickStr(inc.storeHead, prev.storeHead),
        areaManager: pickStr(inc.areaManager, prev.areaManager),
        areaManagerEmail: pickStr(inc.areaManagerEmail, prev.areaManagerEmail),
        regionalManager: pickStr(inc.regionalManager, prev.regionalManager),
        regionalManagerEmail: pickStr(inc.regionalManagerEmail, prev.regionalManagerEmail),
      };

      const changed =
        (
          ['name', 'type', 'city', 'address', 'lat', 'lng', 'email', 'storePhone', 'storeHead', 'areaManager', 'areaManagerEmail', 'regionalManager', 'regionalManagerEmail'] as (keyof MasterStore)[]
        ).some((k) => updated[k] !== prev[k]) || nextRegion !== prevRegion;

      if (changed) {
        mergedMap.set(code, updated);
        updatedCount++;
      } else {
        unchangedCount++;
      }
    }
  }

  return {
    stores: Array.from(mergedMap.values()),
    addedCount,
    updatedCount,
    unchangedCount,
    invalidCount,
    errors,
  };
}

/**
 * Parse a Master Toko Excel file (.xlsx / .xls / .csv) with flexible Indonesian/English column detection,
 * coordinate & field validation, duplicate code deduplication, and merge/replace preview.
 */
export async function parseMasterStoreExcelFile(
  file: File,
  existingStores: MasterStore[] = getMasterStores(),
  mode: 'merge' | 'replace' = 'merge',
  sheetNameOption?: string
): Promise<ParsedMasterStoreExcelResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const availableSheets: string[] = workbook.SheetNames || [];
  if (availableSheets.length === 0) {
    throw new Error('Berkas Excel tidak memiliki worksheet yang dapat dibaca.');
  }

  const targetSheetName =
    sheetNameOption && availableSheets.includes(sheetNameOption)
      ? sheetNameOption
      : availableSheets.find((s: string) => /master|toko|store/i.test(s)) || availableSheets[0];

  const ws = workbook.Sheets[targetSheetName];
  if (!ws || !ws['!ref']) {
    throw new Error(`Worksheet "${targetSheetName}" kosong.`);
  }

  const range = XLSX.utils.decode_range(ws['!ref']);

  // Detect header row within first 10 rows
  let headerRowIdx = -1;
  let colMap = new Map<number, MasterStoreFieldKey>();
  const detectedColumns: Record<string, string> = {};

  for (let r = range.s.r; r <= Math.min(range.e.r, range.s.r + 10); r++) {
    const candidateMap = new Map<number, MasterStoreFieldKey>();
    const candidateLabels: Record<string, string> = {};
    for (let c = range.s.c; c <= range.e.c; c++) {
      const headerStr = getWorksheetCellDisplayString(ws, r, c);
      const matchedField = matchHeaderField(headerStr);
      if (matchedField && !Array.from(candidateMap.values()).includes(matchedField)) {
        candidateMap.set(c, matchedField);
        candidateLabels[matchedField] = headerStr;
      }
    }
    const fields = new Set(candidateMap.values());
    if (fields.has('code') && (fields.has('name') || candidateMap.size >= 3)) {
      headerRowIdx = r;
      colMap = candidateMap;
      Object.assign(detectedColumns, candidateLabels);
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error(
      'Header kolom Master Toko tidak terdeteksi. Pastikan terdapat minimal kolom "Kode Toko" (Code) dan "Nama Toko" (Name).'
    );
  }

  const existingCodeSet = new Set(
    existingStores.map((s) => String(s.code || '').trim().toUpperCase()).filter(Boolean)
  );

  const dedupedByCode = new Map<string, Partial<MasterStore>>();
  const invalidRows: { row: number; reason: string }[] = [];
  const validationErrors: string[] = [];

  for (let r = headerRowIdx + 1; r <= range.e.r; r++) {
    const rawRecord: Partial<Record<MasterStoreFieldKey, any>> = {};
    let hasAnyValue = false;

    colMap.forEach((field, c) => {
      const strVal = getWorksheetCellDisplayString(ws, r, c);
      const rawVal = getWorksheetCellRawValue(ws, r, c);
      if (strVal !== '' || (rawVal !== '' && rawVal !== undefined && rawVal !== null)) {
        hasAnyValue = true;
      }
      // Preserve formatted string for code and phone so leading zeros ("0001", "0811...") are never lost
      if (field === 'code' || field === 'storePhone') {
        rawRecord[field] = strVal || String(rawVal ?? '').trim();
      } else if (field === 'lat' || field === 'lng') {
        rawRecord[field] = rawVal !== '' && rawVal !== undefined ? rawVal : strVal;
      } else {
        rawRecord[field] = strVal || String(rawVal ?? '').trim();
      }
    });

    if (!hasAnyValue) continue;

    const excelRowNum = r + 1;
    const code = normalizeIncomingStoreCode(String(rawRecord.code || ''), existingCodeSet);
    const name = String(rawRecord.name || '').trim();

    if (!code) {
      const reason = `Baris ${excelRowNum}: Kode Toko kosong.`;
      invalidRows.push({ row: excelRowNum, reason });
      validationErrors.push(reason);
      continue;
    }

    if (!name && (mode === 'replace' || !existingCodeSet.has(code))) {
      const reason = `Baris ${excelRowNum} (${code}): Nama Toko kosong.`;
      invalidRows.push({ row: excelRowNum, reason });
      validationErrors.push(reason);
      continue;
    }

    let parsedLat = parseCoordinateValue(rawRecord.lat);
    let parsedLng = parseCoordinateValue(rawRecord.lng);

    if ((parsedLat === null || parsedLng === null) && rawRecord.coordinates) {
      const coordParts = String(rawRecord.coordinates)
        .split(/[\/;|\s]+|,(?=\s*-?\d)/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (coordParts.length >= 2) {
        if (parsedLat === null) parsedLat = parseCoordinateValue(coordParts[0]);
        if (parsedLng === null) parsedLng = parseCoordinateValue(coordParts[1]);
      }
    }

    if (parsedLat !== null && (parsedLat < -90 || parsedLat > 90)) {
      validationErrors.push(`Baris ${excelRowNum} (${code}): Latitude di luar rentang valid (${parsedLat}).`);
      parsedLat = null;
    }
    if (parsedLng !== null && (parsedLng < -180 || parsedLng > 180)) {
      validationErrors.push(`Baris ${excelRowNum} (${code}): Longitude di luar rentang valid (${parsedLng}).`);
      parsedLng = null;
    }

    const cityOrRegion = String(rawRecord.city || rawRecord.region || '').trim();

    const storeObj: Partial<MasterStore> = {
      code,
      ...(name ? { name } : {}),
      ...(rawRecord.type ? { type: String(rawRecord.type).trim() } : {}),
      ...(cityOrRegion ? { city: cityOrRegion } : {}),
      ...(rawRecord.region ? ({ region: String(rawRecord.region).trim() } as Partial<MasterStore>) : {}),
      ...(rawRecord.address ? { address: String(rawRecord.address).trim() } : {}),
      ...(rawRecord.storeHead ? { storeHead: String(rawRecord.storeHead).trim() } : {}),
      ...(rawRecord.areaManager ? { areaManager: String(rawRecord.areaManager).trim() } : {}),
      ...(rawRecord.areaManagerEmail ? { areaManagerEmail: String(rawRecord.areaManagerEmail).trim() } : {}),
      ...(rawRecord.regionalManager ? { regionalManager: String(rawRecord.regionalManager).trim() } : {}),
      ...(rawRecord.regionalManagerEmail ? { regionalManagerEmail: String(rawRecord.regionalManagerEmail).trim() } : {}),
      ...(rawRecord.email ? { email: String(rawRecord.email).trim() } : {}),
      ...(rawRecord.storePhone ? { storePhone: String(rawRecord.storePhone).trim() } : {}),
      ...(parsedLat !== null ? { lat: parsedLat, latitude: parsedLat } : {}),
      ...(parsedLng !== null ? { lng: parsedLng, longitude: parsedLng } : {}),
    };

    const prevDup = dedupedByCode.get(code);
    if (prevDup) {
      dedupedByCode.set(code, { ...prevDup, ...storeObj });
    } else {
      dedupedByCode.set(code, storeObj);
    }
  }

  const incomingStores = Array.from(dedupedByCode.values());
  const mergePreview = buildMasterStoreMergePreview(
    existingStores,
    incomingStores,
    mode,
    invalidRows.length,
    validationErrors
  );

  return {
    sheetName: targetSheetName,
    availableSheets,
    incomingStores,
    mergePreview,
    invalidRows,
    detectedColumns,
  };
}

export function downloadMasterStoreTemplateExcel(): void {
  const header = [
    'Kode Toko',
    'Nama Toko',
    'Tipe Toko',
    'Kota / Wilayah',
    'Store Head',
    'Area Manager (AM)',
    'Email AM',
    'Regional Manager (RM)',
    'Email RM',
    'Email Toko',
    'No. Telepon Toko',
    'Alamat Lengkap',
    'Latitude',
    'Longitude',
  ];

  const sampleRows = [
    [
      '0001',
      'CIBUBUR',
      'FamiSuper',
      'Depok',
      'Rio Pratama',
      'Satrio Handoyo',
      'satrio.handoyo@familymartindonesia.com',
      'Sariyo, SS',
      'sariyo@familymartindonesia.com',
      'store.fmcibubur@familymartindonesia.com',
      '08118894794',
      'Jl. Alternatif Cibubur, Perumahan Raffles Hills, Cimanggis Depok',
      -6.37632,
      106.90414,
    ],
    [
      '3006',
      'BDG R.E MARTADINATA',
      'CVS',
      'Bandung',
      'Store Head Contoh',
      'Area Manager Contoh',
      'am.contoh@familymartindonesia.com',
      'Regional Manager Contoh',
      'rm.contoh@familymartindonesia.com',
      'store.bdgriau@familymartindonesia.com',
      '08110000000',
      'Jl. L.L.R.E. Martadinata No. 123, Bandung',
      -6.90734,
      107.61842,
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([header, ...sampleRows]);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 12 },
    { wch: 18 },
    { wch: 22 },
    { wch: 22 },
    { wch: 30 },
    { wch: 22 },
    { wch: 30 },
    { wch: 32 },
    { wch: 16 },
    { wch: 50 },
    { wch: 12 },
    { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Master Toko');
  XLSX.writeFile(wb, 'Template_Update_Master_Toko_FMCU.xlsx');
}

// ============================================================================
// EXPORT MASTER DATA TOKO & TOKO KEPEMILIKAN BESTIE TO EXCEL
// ============================================================================
export function exportMasterStoresToExcel(storesOverride?: MasterStore[] | unknown): void {
  const masterStores =
    Array.isArray(storesOverride) && storesOverride.length > 0 ? storesOverride : getMasterStores();
  const ownerships = getBestieInChargeAssignments();

  const ownerByCode = new Map<string, string>();
  ownerships.forEach((o) => {
    if (o.storeCode && o.bestieName) {
      ownerByCode.set(o.storeCode.trim().toUpperCase(), o.bestieName);
    }
  });

  // Sheet 1: Master Stores
  const storesHeader = [
    'Kode Toko',
    'Nama Toko',
    'Tipe Toko',
    'Kota / Wilayah',
    'Bestie In Charge (Kepemilikan)',
    'Store Head',
    'Area Manager (AM)',
    'Email AM',
    'Regional Manager (RM)',
    'Email RM',
    'Email Toko',
    'No. Telepon Toko',
    'Alamat Lengkap',
    'Latitude',
    'Longitude',
  ];

  const storesRows = masterStores.map((s) => [
    s.code,
    s.name,
    s.type,
    s.city,
    ownerByCode.get(String(s.code).toUpperCase()) || '-',
    s.storeHead,
    s.areaManager,
    s.areaManagerEmail,
    s.regionalManager,
    s.regionalManagerEmail,
    s.email,
    s.storePhone,
    s.address,
    s.lat,
    s.lng,
  ]);

  const wsStores = XLSX.utils.aoa_to_sheet([storesHeader, ...storesRows]);
  wsStores['!cols'] = [
    { wch: 12 },
    { wch: 28 },
    { wch: 12 },
    { wch: 18 },
    { wch: 24 },
    { wch: 22 },
    { wch: 22 },
    { wch: 30 },
    { wch: 22 },
    { wch: 30 },
    { wch: 32 },
    { wch: 16 },
    { wch: 50 },
    { wch: 12 },
    { wch: 12 },
  ];

  // Sheet 2: Bestie In Charge Ownerships
  const ownershipHeader = [
    'Bestie In Charge',
    'Kode Toko',
    'Nama Toko',
    'Area Manager (AM)',
    'Regional Manager (RM)',
    'Alamat Lengkap',
  ];
  const ownershipRows = ownerships.map((o) => [
    o.bestieName,
    o.storeCode,
    o.storeName,
    o.areaManager,
    o.regionalManager,
    o.address,
  ]);

  const wsOwnership = XLSX.utils.aoa_to_sheet([ownershipHeader, ...ownershipRows]);
  wsOwnership['!cols'] = [
    { wch: 24 },
    { wch: 12 },
    { wch: 28 },
    { wch: 22 },
    { wch: 22 },
    { wch: 55 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsStores, `Master Data Toko (${masterStores.length})`);
  XLSX.utils.book_append_sheet(wb, wsOwnership, `Toko Kepemilikan (${ownerships.length})`);

  const now = new Date();
  const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(wb, `FMCU_Master_Toko_Dan_Kepemilikan_${ymd}.xlsx`);
}
