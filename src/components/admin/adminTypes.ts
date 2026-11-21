import * as XLSX from 'xlsx';
import { ScheduleAgenda, VisitReportData } from '../../types';
import { GDriveVerifiedReportItem } from '../../data/gdriveVerifiedReportsData';
import { formatIndonesianDate } from '../../services/pdfGeneratorService';

export type AdminNavTab =
  | 'agenda'
  | 'calendar'
  | 'reports'
  | 'monitoring'
  | 'stores'
  | 'analytics';

export type ActivityKind =
  | 'VISIT'
  | 'NSO'
  | 'MEETING'
  | 'TRAINING'
  | 'AUDIT'
  | 'OPERATION'
  | 'LEAVE'
  | 'OFF'
  | 'OTHER';

export interface ClassifiedAgenda {
  agenda: ScheduleAgenda;
  kind: ActivityKind;
  isExplicitVisit: boolean;
  requiresReport: boolean;
  requiresCheckIn: boolean;
  badge: {
    label: string;
    shortLabel: string;
    color: string;
    bg: string;
    border: string;
    dot: string;
  };
  status: {
    code: 'COMPLETED' | 'IN_PROGRESS' | 'SCHEDULED' | 'LEAVE' | 'OFF';
    label: string;
    color: string;
    bg: string;
    border: string;
    dot: string;
  };
  report?: VisitReportData;
}

export interface UnifiedWebReport {
  id: string;
  source: 'CLOUD' | 'GDRIVE';
  category: 'VISIT' | 'NSO';
  format: 'PDF' | 'PPTX' | 'DOCX' | 'IMAGE';
  visitDate: string;
  storeCode: string;
  storeName: string;
  visitorName: string;
  actualIn: string;
  actualOut: string;
  observationsCount: number;
  evidenceCount: number;
  status: 'SUBMITTED' | 'DRAFT';
  fileName: string;
  folderName: string;
  gdriveViewUrl?: string;
  gdriveEmbedUrl?: string;
  gdriveSavedDate?: string;
  reportData: VisitReportData;
  updatedAtMs: number;
}

/** Local WIB/browser YYYY-MM-DD date formatter (prevents UTC midnight drift) */
export function formatLocalYmd(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDisplayDateShort(ymd?: string): string {
  if (!ymd) return '-';
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const m = Number(parts[1]) - 1;
  return `${parts[2]} ${months[m] || parts[1]} ${parts[0]}`;
}

/**
 * Accurate FMCU domain classification:
 * Distinguishes official Store Visit vs NSO vs Meeting/Training/Audit/Operation/Leave/Off
 */
export function classifyAgendaItem(
  agenda: ScheduleAgenda,
  reportMap: Map<string, VisitReportData>
): ClassifiedAgenda {
  const titleLower = (agenda.title || '').toLowerCase().trim();
  const catUpper = (agenda.category || '').toUpperCase();

  const report =
    reportMap.get(agenda.id) ||
    (agenda.storeCode && agenda.date
      ? reportMap.get(`${String(agenda.storeCode).toUpperCase()}_${agenda.date}`)
      : undefined);

  // 1. Cuti / Izin / Sakit
  if (
    catUpper === 'CUTI' ||
    titleLower.includes('cuti') ||
    titleLower.includes('izin') ||
    titleLower.includes('sakit')
  ) {
    return {
      agenda,
      kind: 'LEAVE',
      isExplicitVisit: false,
      requiresReport: false,
      requiresCheckIn: false,
      badge: {
        label: 'Cuti / Izin',
        shortLabel: 'Cuti',
        color: 'text-rose-700',
        bg: 'bg-rose-50',
        border: 'border-rose-200/80',
        dot: 'bg-rose-500',
      },
      status: {
        code: 'LEAVE',
        label: 'Cuti / Izin',
        color: 'text-rose-700',
        bg: 'bg-rose-50',
        border: 'border-rose-200/80',
        dot: 'bg-rose-500',
      },
    };
  }

  // 2. Off / Libur
  if (
    catUpper === 'OFF' ||
    titleLower === 'off' ||
    titleLower.startsWith('off ') ||
    titleLower.includes('libur')
  ) {
    return {
      agenda,
      kind: 'OFF',
      isExplicitVisit: false,
      requiresReport: false,
      requiresCheckIn: false,
      badge: {
        label: 'Off / Libur',
        shortLabel: 'Off',
        color: 'text-slate-600',
        bg: 'bg-slate-100',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
      },
      status: {
        code: 'OFF',
        label: 'Libur / Off',
        color: 'text-slate-600',
        bg: 'bg-slate-100',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
      },
    };
  }

  // 3. NSO (New Store Opening)
  if (
    catUpper === 'NSO' ||
    /\bnso\b/.test(titleLower) ||
    titleLower.includes('opening') ||
    titleLower.includes('buka toko')
  ) {
    const isDone = Boolean(agenda.completed || report?.status === 'SUBMITTED');
    const inProgress = Boolean(!isDone && (agenda.actualIn || report?.actualIn));
    return {
      agenda,
      kind: 'NSO',
      isExplicitVisit: false,
      requiresReport: true,
      requiresCheckIn: true,
      badge: {
        label: 'NSO Toko Baru',
        shortLabel: 'NSO',
        color: 'text-amber-800',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
      },
      status: isDone
        ? {
            code: 'COMPLETED',
            label: 'Selesai',
            color: 'text-emerald-700',
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            dot: 'bg-emerald-500',
          }
        : inProgress
        ? {
            code: 'IN_PROGRESS',
            label: 'On-Site',
            color: 'text-amber-800',
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            dot: 'bg-amber-500',
          }
        : {
            code: 'SCHEDULED',
            label: 'Terjadwal',
            color: 'text-slate-600',
            bg: 'bg-slate-50',
            border: 'border-slate-200',
            dot: 'bg-slate-400',
          },
      report,
    };
  }

  // 4. Training / Coaching
  if (
    catUpper === 'TRAINING' ||
    titleLower.includes('training') ||
    titleLower.includes('coaching') ||
    titleLower.includes('shadowing') ||
    titleLower.includes('pelatihan')
  ) {
    const isDone = Boolean(agenda.completed);
    return {
      agenda,
      kind: 'TRAINING',
      isExplicitVisit: false,
      requiresReport: false,
      requiresCheckIn: false,
      badge: {
        label: 'Training',
        shortLabel: 'Training',
        color: 'text-cyan-800',
        bg: 'bg-cyan-50',
        border: 'border-cyan-200',
        dot: 'bg-cyan-500',
      },
      status: isDone
        ? {
            code: 'COMPLETED',
            label: 'Selesai',
            color: 'text-emerald-700',
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            dot: 'bg-emerald-500',
          }
        : {
            code: 'SCHEDULED',
            label: 'Terjadwal',
            color: 'text-slate-600',
            bg: 'bg-slate-50',
            border: 'border-slate-200',
            dot: 'bg-slate-400',
          },
    };
  }

  // 5. Meeting / Koordinasi
  if (
    catUpper === 'MEETING' ||
    titleLower.includes('meeting') ||
    titleLower.includes('rapat') ||
    titleLower.includes('koordinasi') ||
    titleLower.includes('briefing') ||
    titleLower.includes('evaluasi')
  ) {
    const isDone = Boolean(agenda.completed);
    return {
      agenda,
      kind: 'MEETING',
      isExplicitVisit: false,
      requiresReport: false,
      requiresCheckIn: false,
      badge: {
        label: 'Meeting',
        shortLabel: 'Meeting',
        color: 'text-blue-700',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        dot: 'bg-blue-500',
      },
      status: isDone
        ? {
            code: 'COMPLETED',
            label: 'Selesai',
            color: 'text-emerald-700',
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            dot: 'bg-emerald-500',
          }
        : {
            code: 'SCHEDULED',
            label: 'Terjadwal',
            color: 'text-slate-600',
            bg: 'bg-slate-50',
            border: 'border-slate-200',
            dot: 'bg-slate-400',
          },
    };
  }

  // 6. Audit Khusus
  if (catUpper === 'AUDIT' || titleLower.includes('audit') || titleLower.includes('investigasi')) {
    const isDone = Boolean(agenda.completed || report?.status === 'SUBMITTED');
    return {
      agenda,
      kind: 'AUDIT',
      isExplicitVisit: false,
      requiresReport: false,
      requiresCheckIn: false,
      badge: {
        label: 'Audit',
        shortLabel: 'Audit',
        color: 'text-violet-700',
        bg: 'bg-violet-50',
        border: 'border-violet-200',
        dot: 'bg-violet-500',
      },
      status: isDone
        ? {
            code: 'COMPLETED',
            label: 'Selesai',
            color: 'text-emerald-700',
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            dot: 'bg-emerald-500',
          }
        : {
            code: 'SCHEDULED',
            label: 'Terjadwal',
            color: 'text-slate-600',
            bg: 'bg-slate-50',
            border: 'border-slate-200',
            dot: 'bg-slate-400',
          },
      report,
    };
  }

  // 7. Operasional Lapangan
  if (
    catUpper === 'OPERATION' ||
    titleLower.includes('maintenance') ||
    titleLower.includes('opname') ||
    titleLower.includes('thawing') ||
    titleLower.includes('waste') ||
    titleLower.includes('holding time') ||
    titleLower.includes('support') ||
    titleLower.includes('pendampingan')
  ) {
    const isDone = Boolean(agenda.completed);
    return {
      agenda,
      kind: 'OPERATION',
      isExplicitVisit: false,
      requiresReport: false,
      requiresCheckIn: false,
      badge: {
        label: 'Operasional',
        shortLabel: 'Ops',
        color: 'text-teal-700',
        bg: 'bg-teal-50',
        border: 'border-teal-200',
        dot: 'bg-teal-500',
      },
      status: isDone
        ? {
            code: 'COMPLETED',
            label: 'Selesai',
            color: 'text-emerald-700',
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            dot: 'bg-emerald-500',
          }
        : {
            code: 'SCHEDULED',
            label: 'Terjadwal',
            color: 'text-slate-600',
            bg: 'bg-slate-50',
            border: 'border-slate-200',
            dot: 'bg-slate-400',
          },
    };
  }

  // 8. Explicit Store Visit
  const isExplicitVisit =
    catUpper === 'VISIT' || titleLower.includes('visit') || titleLower.includes('kunjungan');

  if (isExplicitVisit) {
    const actualIn = agenda.actualIn || report?.actualIn;
    const actualOut = agenda.actualOut || report?.actualOut;
    const isSubmitted = report?.status === 'SUBMITTED' || Boolean(agenda.completed);

    const status =
      isSubmitted || (actualIn && actualOut)
        ? {
            code: 'COMPLETED' as const,
            label: 'Selesai',
            color: 'text-emerald-700',
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            dot: 'bg-emerald-500',
          }
        : actualIn
        ? {
            code: 'IN_PROGRESS' as const,
            label: 'Di Toko',
            color: 'text-amber-800',
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            dot: 'bg-amber-500',
          }
        : {
            code: 'SCHEDULED' as const,
            label: 'Terjadwal',
            color: 'text-slate-600',
            bg: 'bg-slate-50',
            border: 'border-slate-200',
            dot: 'bg-slate-400',
          };

    return {
      agenda,
      kind: 'VISIT',
      isExplicitVisit: true,
      requiresReport: true,
      requiresCheckIn: true,
      badge: {
        label: 'Visit Toko',
        shortLabel: 'Visit',
        color: 'text-emerald-800',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
      },
      status,
      report,
    };
  }

  // 9. Work Plan / Admin / Other
  const isDone = Boolean(agenda.completed);
  return {
    agenda,
    kind: 'OTHER',
    isExplicitVisit: false,
    requiresReport: false,
    requiresCheckIn: false,
    badge: {
      label: catUpper === 'WORK_PLAN' ? 'Work Plan' : 'Tugas Lainnya',
      shortLabel: catUpper === 'WORK_PLAN' ? 'Plan' : 'Lainnya',
      color: 'text-indigo-700',
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      dot: 'bg-indigo-500',
    },
    status: isDone
      ? {
          code: 'COMPLETED',
          label: 'Selesai',
          color: 'text-emerald-700',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          dot: 'bg-emerald-500',
        }
      : {
          code: 'SCHEDULED',
          label: 'Terjadwal',
          color: 'text-slate-600',
          bg: 'bg-slate-50',
          border: 'border-slate-200',
          dot: 'bg-slate-400',
        },
    report,
  };
}

/**
 * Merge realtime Cloud Visit Reports (D1/GAS) + Verified Google Drive Reports (333+) into one clean unified list
 */
export function buildUnifiedWebReports(
  cloudReports: (VisitReportData & { updatedAtMs?: number })[],
  verifiedGDriveReports: GDriveVerifiedReportItem[]
): UnifiedWebReport[] {
  const result: UnifiedWebReport[] = [];
  const dedupeKeys = new Set<string>();

  // 1. Live Cloud Reports first (rich structured data)
  for (const r of cloudReports) {
    if (!r || (!r.storeName && !r.storeCode)) continue;
    const isNso =
      String(r.storeType || '').toUpperCase() === 'NSO' ||
      String(r.assignmentNotes || '').toLowerCase().includes('nso');
    const code = String(r.storeCode || '-').toUpperCase().trim();
    const date = r.visitDate || '';
    const key = `${code}_${date}_${(r.visitorName || '').toLowerCase().trim()}`;
    dedupeKeys.add(key);

    const updatedAtMs =
      r.updatedAtMs ||
      (r.submittedAt ? new Date(r.submittedAt).getTime() : 0) ||
      (date ? new Date(date).getTime() : 0);

    result.push({
      id: r.id || `cloud_${key}_${result.length}`,
      source: 'CLOUD',
      category: isNso ? 'NSO' : 'VISIT',
      format: 'PDF',
      visitDate: date,
      storeCode: code,
      storeName: r.storeName || code,
      visitorName: r.visitorName || '-',
      actualIn: r.actualIn || '-',
      actualOut: r.actualOut || '-',
      observationsCount: Array.isArray(r.observations) ? r.observations.length : 0,
      evidenceCount: Array.isArray(r.evidencePhotos) ? r.evidencePhotos.length : 0,
      status: r.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT',
      fileName: `Hasil Kunjungan-${r.storeName || code}-${date}.pdf`,
      folderName: code && code !== '-' ? `${code} - ${r.storeName}` : r.storeName || '-',
      gdriveViewUrl: (r as any).pdfUrl || (r as any).driveUrl || r.spreadsheetUrl || undefined,
      gdriveEmbedUrl: (r as any).gdriveEmbedUrl || undefined,
      gdriveSavedDate: date ? formatIndonesianDate(date, false) : undefined,
      reportData: r,
      updatedAtMs,
    });
  }

  // 2. Verified Google Drive Archive Reports
  for (const item of verifiedGDriveReports) {
    const code = String(item.storeCode || '-').toUpperCase().trim();
    const date = item.visitDate || '';
    const key = `${code}_${date}_${(item.personnelName || '').toLowerCase().trim()}`;
    if (dedupeKeys.has(key)) continue;
    dedupeKeys.add(key);

    const ts = date ? new Date(date).getTime() || 0 : 0;
    const reportData: VisitReportData = {
      id: item.id,
      agendaId: item.fileId,
      visitorName: item.personnelName,
      storeName: item.storeName,
      storeCode: code === '-' ? 'STORE' : code,
      storeType: item.category === 'NSO' ? 'NSO' : 'CVS',
      storeHead: '-',
      visitDate: date,
      areaManager: '-',
      regionalManager: '-',
      actualIn: '-',
      actualOut: '-',
      storeFrontPhoto: '',
      qscSheetTop: '',
      qscSheetBottom: '',
      spreadsheetUrl: item.gdriveViewUrl,
      assignmentNotes: item.fileName,
      crews: [],
      observations: [],
      evidencePhotos: [],
      status: 'SUBMITTED',
      updatedAtMs: ts,
    };

    result.push({
      id: item.id,
      source: 'GDRIVE',
      category: item.category,
      format: item.format,
      visitDate: date,
      storeCode: code,
      storeName: item.storeName,
      visitorName: item.personnelName,
      actualIn: '-',
      actualOut: '-',
      observationsCount: 0,
      evidenceCount: 0,
      status: 'SUBMITTED',
      fileName: item.fileName,
      folderName: item.subFolderName
        ? `${item.personnelName} / ${item.subFolderName}`
        : item.personnelName,
      gdriveViewUrl: item.gdriveViewUrl,
      gdriveEmbedUrl: item.gdriveEmbedUrl,
      gdriveSavedDate: date ? formatIndonesianDate(date, false) : undefined,
      reportData,
      updatedAtMs: ts,
    });
  }

  // Sort newest first
  return result.sort((a, b) => {
    if (b.visitDate !== a.visitDate) return (b.visitDate || '').localeCompare(a.visitDate || '');
    return b.updatedAtMs - a.updatedAtMs;
  });
}

/** Generic helper to export clean formatted Excel worksheets */
export function exportRowsToExcel(
  rows: Record<string, any>[],
  sheetName: string,
  fileName: string
): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  // Auto column widths for clean spreadsheet opening in Excel
  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    ws['!cols'] = headers.map((h) => {
      const maxLen = Math.max(
        h.length,
        ...rows.slice(0, 200).map((r) => String(r[h] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLen + 3, 10), 48) };
    });
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}
