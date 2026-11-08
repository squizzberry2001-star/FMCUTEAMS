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
  'BDG RIAU': '3006', // LL RE MARTADINATA
  'BANDUNG RIAU': '3006',
  'LL RE MARTADINATA': '3006',
  'RE MARTADINATA': '3006',
  'DIPATIUKUR': 'BDG DIPATIUKUR',
  'BRAGA': 'BDG BRAGA',
  ' DAGO': 'BDG DAGO',
  'CIBOGO': 'BDG CIBOGO',
  'CIHAMPELAS': 'BDG CIHAMPELAS',
  'PADJAJARAN': 'BDG PADJAJARAN',
  'PAJAJARAN': 'BDG PADJAJARAN',
  'SUKAJADI': 'BDG SUKAJADI',
  'SARIJADI': 'BDG SARIJADI',
  'BUAH BATU': 'BDG BUAH BATU',
  'CIBADUYUT': 'BDG CIBADUYUT',
  'GATOT SUBROTO BDG': 'BDG GATOT SUBROTO',
  'BULUNGAN': 'BULUNGAN 2',
};

export function parseExcelSerialDate(val: any): string | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') {
    const utcDays = Math.floor(val - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.split(/[/-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
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

  // Check alias map first
  for (const [aliasKey, targetVal] of Object.entries(EXCEL_STORE_ALIAS_MAP)) {
    if (upper === aliasKey.trim() || upper.includes(aliasKey.trim())) {
      const aliasStore = allStores.find(
        (s) =>
          String(s.code).toUpperCase() === targetVal ||
          String(s.name).toUpperCase() === targetVal
      );
      if (aliasStore) return { store: aliasStore, cleanName: aliasStore.name };
    }
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
    if (
      upper === stName ||
      upper === stNameNoBdg ||
      upper.includes(stName) ||
      stName.includes(upper)
    ) {
      return { store: st, cleanName: st.name };
    }
  }

  // 4. Token overlap match
  const partTokens = upper
    .split(/[\s\-/,()]+/)
    .filter(
      (t) =>
        t.length >= 3 && !['BDG', 'BANDUNG', 'JAKARTA', 'SURABAYA', 'MALANG'].includes(t)
    );
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

export function matchOrRegisterUserByName(
  rawName: string,
  usersList: User[]
): { user: User; isNew: boolean } {
  const clean = String(rawName || '')
    .replace(/\s+/g, ' ')
    .trim();
  const norm = clean
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Exact or normalized match
  const exact = usersList.find((u) => {
    const uNorm = String(u.name || '')
      .toLowerCase()
      .replace(/[.,]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return uNorm === norm;
  });
  if (exact) return { user: exact, isNew: false };

  // 2. Token match (e.g. "M. Ghifary" vs "M Ghifary" or partial name)
  const tokens = norm.split(' ').filter((t) => t.length >= 2);
  let bestUser: User | null = null;
  let bestOverlap = 0;
  for (const u of usersList) {
    if (u.isAdmin) continue;
    const uNorm = String(u.name || '')
      .toLowerCase()
      .replace(/[.,]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const uTokens = uNorm.split(' ').filter((t) => t.length >= 2);
    let overlap = 0;
    for (const t of tokens) {
      if (uTokens.includes(t) || uNorm.includes(t)) overlap++;
    }
    if (overlap > bestOverlap && overlap >= Math.min(2, tokens.length)) {
      bestOverlap = overlap;
      bestUser = u;
    }
  }
  if (bestUser) return { user: bestUser, isNew: false };

  // 3. Auto-register new employee account with default password "0000"
  const newUser: User = {
    id: `usr-${clean.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
    name: clean,
    email: `${clean.toLowerCase().replace(/[^a-z0-9]/g, '.')}@fmcu.com`,
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

  // Detect header row
  let startRow = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const firstCell = String(rows[i]?.[0] || '')
      .trim()
      .toLowerCase();
    const secondCell = String(rows[i]?.[1] || '')
      .trim()
      .toLowerCase();
    if (firstCell === 'nama' || secondCell.includes('start date')) {
      startRow = i + 1;
      break;
    }
  }

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;

    const rawName = String(row[0] || '').trim();
    const rawStartDate = row[1];
    const rawStartTime = row[2];
    const rawEndDate = row[3];
    const rawEndTime = row[4];
    const rawDesc = String(row[5] || '').trim();
    const rawLoc = String(row[6] || '').trim();

    if (!rawName && !rawStartDate) continue;

    const { user: matchedUser, isNew } = matchOrRegisterUserByName(rawName, workingUsers);
    if (isNew) newUsersCount++;

    const dateStr = parseExcelSerialDate(rawStartDate);
    if (!matchedUser || !dateStr) continue;

    const endDateStr = parseExcelSerialDate(rawEndDate) || dateStr;
    const startTime = parseExcelTime24(rawStartTime, '08:30');
    const endTime = parseExcelTime24(rawEndTime, '17:30');

    matchedUsersSet.add(matchedUser.name);
    allDatesInSheet.add(dateStr);

    if (!scheduledDatesByUser.has(matchedUser.name)) {
      scheduledDatesByUser.set(matchedUser.name, new Set());
    }
    scheduledDatesByUser.get(matchedUser.name)!.add(dateStr);

    const descClean = rawDesc.trim();
    const descLower = descClean.toLowerCase();
    const locClean = rawLoc.trim();

    // ------------------------------------------------------------------------
    // RULE 1: Check for CUTI or OFF in Col F (Description)
    // ------------------------------------------------------------------------
    if (descLower === 'cuti' || /^cuti\b/i.test(descClean)) {
      cutiCount++;
      agendas.push({
        id: `xl-${sheetName.replace(/\s+/g, '')}-${r}-cuti`,
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
        id: `xl-${sheetName.replace(/\s+/g, '')}-${r}-off`,
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
    // ------------------------------------------------------------------------
    const rawDescLines = descClean
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const descPoints: string[] = [];

    if (rawDescLines.length > 1) {
      for (const line of rawDescLines) {
        const cleanedLine = line.replace(/^\d+[\.\)]\s*/, '').trim();
        if (cleanedLine) descPoints.push(cleanedLine);
      }
    } else if (/\d+[\.\)]\s+/.test(descClean)) {
      const splitByNum = descClean
        .split(/(?=\b\d+[\.\)]\s+)/)
        .map((s) => s.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter(Boolean);
      if (splitByNum.length > 1) {
        descPoints.push(...splitByNum);
      } else {
        descPoints.push(descClean.replace(/^\d+[\.\)]\s*/, '').trim());
      }
    } else if (descClean) {
      descPoints.push(descClean);
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
      if (ampParts.length === descPoints.length) {
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
      let locPart = '';
      if (locSegments.length >= numItems) {
        locPart = locSegments[idx] || '';
      } else if (locSegments.length === 1) {
        locPart = locSegments[0];
      } else {
        locPart = locSegments[idx] || locSegments[locSegments.length - 1] || '';
      }

      // ----------------------------------------------------------------------
      // RULE 3: STRICT VISIT STORE DETECTION
      // Visit Store = ONLY if Col F contains "Visit", "Visit Store", or "Refreshment QSC",
      // AND Col G does NOT contain "NSO" and does NOT contain "FMCU".
      // ----------------------------------------------------------------------
      const isVisitDesc = /\b(visit|visit\s+store|refe?r?shment\s+qsc)\b/i.test(descPart);
      const isNsoLoc = /\b(nso|new\s+store\s+opening|reopening|re-opening)\b/i.test(locPart);
      const isFmcuLoc = /\bfmcu\b/i.test(locPart);

      if (isVisitDesc && !isNsoLoc && !isFmcuLoc) {
        // Split multiple stores in locPart separated by '&'
        const storeSubParts = locPart
          ? locPart
              .split(/\s*&\s*/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

        if (storeSubParts.length > 0) {
          storeSubParts.forEach((subLoc, subIdx) => {
            if (/^(fmcu|online|zoom|teams|ho|head\s*office)$/i.test(subLoc)) {
              nonStoreAgendaCount++;
              const cat = classifyNonVisitCategory(descPart, subLoc);
              agendas.push({
                id: `xl-${sheetName.replace(/\s+/g, '')}-${r}-${idx}-${subIdx}`,
                title: descPart,
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
              id: `xl-${sheetName.replace(/\s+/g, '')}-${r}-${idx}-${subIdx}`,
              title: `Audit & Store Visit - Cabang ${storeName}`,
              date: dateStr,
              endDate: endDateStr,
              time: startTime,
              endTime,
              category: 'VISIT',
              location: matchedStore
                ? `${matchedStore.name} (${matchedStore.code}) - ${matchedStore.city}`
                : storeName,
              pic: matchedUser.name,
              description: `${descPart} — Lokasi: ${storeName}`,
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
            descPart,
            allStores
          );
          const storeCode = matchedStore ? matchedStore.code : 'STORE';
          const storeName = matchedStore ? matchedStore.name : cleanName || descPart;
          const bestieOwner = matchedStore ? getBestieByStoreCode(matchedStore.code) : '';
          if (matchedStore) matchedStoresSet.add(matchedStore.code);
          visitCount++;

          agendas.push({
            id: `xl-${sheetName.replace(/\s+/g, '')}-${r}-${idx}`,
            title: `Audit & Store Visit - Cabang ${storeName}`,
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
        let agendaTitle = descPart;
        let category: ScheduleCategory = classifyNonVisitCategory(descPart, locPart);

        if (isNsoLoc || /\b(nso|new\s+store\s+opening|reopening)\b/i.test(descPart)) {
          category = 'NSO';
          nsoCount++;
          if (!/\bnso\b/i.test(agendaTitle)) {
            agendaTitle = `NSO ${agendaTitle}`;
          }
        } else {
          nonStoreAgendaCount++;
        }

        const { store: refStore } = matchStoreFromLocationPart(locPart || descPart, allStores);

        agendas.push({
          id: `xl-${sheetName.replace(/\s+/g, '')}-${r}-${idx}`,
          title: agendaTitle,
          date: dateStr,
          endDate: endDateStr,
          time: startTime,
          endTime,
          category,
          location: locPart || 'FMCU / Head Office',
          pic: matchedUser.name,
          description: locPart ? `${descPart} — Lokasi: ${locPart}` : descPart,
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
            id: `xl-auto-off-${sheetName.replace(/\s+/g, '')}-${userName.replace(/\s+/g, '')}-${dObj.dateStr}`,
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
// EXPORT MASTER DATA TOKO (610) & TOKO KEPEMILIKAN BESTIE (531) TO EXCEL
// ============================================================================
export function exportMasterStoresToExcel(): void {
  const masterStores = getMasterStores();
  const ownerships = getBestieInChargeAssignments();

  const ownerByCode = new Map<string, string>();
  ownerships.forEach((o) => {
    if (o.storeCode && o.bestieName) {
      ownerByCode.set(o.storeCode.trim().toUpperCase(), o.bestieName);
    }
  });

  // Sheet 1: 610 Master Stores
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

  // Sheet 2: 531 Bestie In Charge Ownerships
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
  XLSX.utils.book_append_sheet(wb, wsStores, 'Master Data Toko (610)');
  XLSX.utils.book_append_sheet(wb, wsOwnership, 'Toko Kepemilikan (531)');

  XLSX.writeFile(
    wb,
    `FMCU_Master_Toko_Dan_Kepemilikan_${new Date().toISOString().split('T')[0]}.xlsx`
  );
}
