import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar as CalendarIcon,
  Upload,
  FileSpreadsheet,
  Users,
  Plus,
  Search,
  Trash2,
  Edit3,
  CheckCircle2,
  Download,
  LogOut,
  Eye,
  Clock,
  Store,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Info,
  ShieldCheck,
  Building2,
  BarChart3,
  TrendingUp,
  FileDown,
  Briefcase,
  Coffee,
  Check,
  AlertTriangle,
  FolderDown,
  Sparkles,
  ExternalLink,
  Award,
  BookOpen,
  PieChart,
  SlidersHorizontal,
  Compass,
  MapPin,
  X,
  Filter,
  ArrowUpDown,
  FileText,
  UserCheck,
  CalendarDays,
  Layers,
  ChevronDown,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ScheduleAgenda, ScheduleCategory, User, VisitReportData } from '../../types';
import { DeveloperFooter } from '../DeveloperFooter';
import { HoldingTimeR23Modal } from '../visit/HoldingTimeR23Modal';
import { ExecutiveReportPreviewModal } from '../executive/ExecutiveReportPreviewModal';
import { fetchAllVisitReportsFromCloud } from '../../services/crossDeviceVisitSyncService';
import {
  MasterStore,
  getMasterStores,
  saveMasterStores,
  findMasterStoreByCodeOrName,
} from '../../data/masterStoresData';
import {
  HoldingTimeStandards,
  getActiveHoldingTimeStandards,
  saveHoldingTimeStandards,
  INITIAL_HOLDING_TIME_R23,
} from '../../data/holdingTimeR23';
import {
  parseScheduleExcelFile,
  exportScheduleToTemplateExcel,
  exportMasterStoresToExcel,
  ParsedExcelScheduleSummary,
} from '../../services/scheduleExcelService';

// ============================================================================
// PROPS INTERFACE
// ============================================================================
interface AdminPortalProps {
  adminUser: User;
  agendas: ScheduleAgenda[];
  users: User[];
  onAddAgenda: (newAgenda: ScheduleAgenda) => void;
  onUpdateAgenda: (updated: ScheduleAgenda) => void;
  onDeleteAgenda: (id: string) => void;
  onImportExcel: (
    importedUsers: User[],
    importedAgendas: ScheduleAgenda[],
    mode?: 'merge' | 'replace'
  ) => void;
  onSwitchToUserView: () => void;
  onLogout: () => void;
  onAddUser?: (newUser: User) => void;
  onResetUserPassword?: (userName: string) => void;
  onReplaySplash?: () => void;
  onOpenLiveMaps?: () => void;
}

// ============================================================================
// DOMAIN-ACCURATE ACTIVITY CLASSIFICATION
// ATURAN PENTING FMCU:
// "Tidak semua adalah kegiatan visit misal terdapat nama toko tapi agenda
// bukan tertulis visit maka BUKAN visit. Filter dan analisa dengan cermat."
// ============================================================================
export type ActivityKind =
  | 'VISIT'        // Hanya jika agenda secara eksplisit tertulis "VISIT" atau "KUNJUNGAN"
  | 'MEETING'      // Meeting, Rapat, Koordinasi, Briefing, Evaluasi
  | 'TRAINING'     // Training, Coaching, Pelatihan, Shadowing
  | 'NSO'          // New Store Opening (Setup Toko Baru)
  | 'AUDIT'        // Audit Investigasi / Khusus
  | 'OPERATION'    // Maintenance, Waste, Thawing, Stock Opname, Pendampingan Kasir/Barista
  | 'LEAVE'        // Cuti, Izin, Sakit
  | 'OFF'          // Hari Libur / Off
  | 'OTHER';       // Tugas Admin / Kantor / Lainnya

export interface ClassifiedAgenda {
  agenda: ScheduleAgenda;
  kind: ActivityKind;
  isExplicitVisit: boolean;
  requiresReport: boolean;
  requiresCheckIn: boolean;
  badge: {
    label: string;
    iconName: string;
    color: string;
    bg: string;
    border: string;
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

/**
 * Logika Klasifikasi Akurat:
 * Membedakan secara tegas apakah suatu agenda adalah Kunjungan Visit Toko
 * atau kegiatan lainnya meskipun lokasi menyebutkan nama toko.
 */
export function classifyAgendaItem(
  agenda: ScheduleAgenda,
  reportMap: Map<string, VisitReportData>
): ClassifiedAgenda {
  const titleLower = (agenda.title || '').toLowerCase().trim();
  const catUpper = (agenda.category || '').toUpperCase();
  const locLower = (agenda.location || '').toLowerCase();
  const descLower = (agenda.description || '').toLowerCase();

  // Terkait Laporan Visit
  const report =
    reportMap.get(agenda.id) ||
    (agenda.storeCode && agenda.date ? reportMap.get(`${agenda.storeCode}_${agenda.date}`) : undefined);

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
        iconName: 'Coffee',
        color: 'text-rose-700',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
      },
      status: {
        code: 'LEAVE',
        label: 'Cuti / Izin Resmi',
        color: 'text-rose-700',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        dot: 'bg-rose-500',
      },
      report: undefined,
    };
  }

  // 2. Off / Hari Libur
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
        iconName: 'Coffee',
        color: 'text-slate-600',
        bg: 'bg-slate-100',
        border: 'border-slate-200',
      },
      status: {
        code: 'OFF',
        label: 'Hari Libur / Off',
        color: 'text-slate-600',
        bg: 'bg-slate-100',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
      },
      report: undefined,
    };
  }

  // 3. Training / Coaching / Shadowing / Pelatihan
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
        label: 'Training / Coaching',
        iconName: 'BookOpen',
        color: 'text-cyan-800',
        bg: 'bg-cyan-50',
        border: 'border-cyan-200',
      },
      status: {
        code: isDone ? 'COMPLETED' : 'SCHEDULED',
        label: isDone ? 'Selesai Dilaksanakan' : 'Terjadwal',
        color: isDone ? 'text-emerald-700' : 'text-blue-700',
        bg: isDone ? 'bg-emerald-50' : 'bg-blue-50',
        border: isDone ? 'border-emerald-200' : 'border-blue-200',
        dot: isDone ? 'bg-emerald-500' : 'bg-blue-500',
      },
      report: undefined,
    };
  }

  // 4. Meeting / Koordinasi / Rapat
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
        label: 'Meeting / Koordinasi',
        iconName: 'Building2',
        color: 'text-blue-800',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
      },
      status: {
        code: isDone ? 'COMPLETED' : 'SCHEDULED',
        label: isDone ? 'Selesai Rapat' : 'Terjadwal',
        color: isDone ? 'text-emerald-700' : 'text-blue-700',
        bg: isDone ? 'bg-emerald-50' : 'bg-blue-50',
        border: isDone ? 'border-emerald-200' : 'border-blue-200',
        dot: isDone ? 'bg-emerald-500' : 'bg-blue-500',
      },
      report: undefined,
    };
  }

  // 5. NSO (New Store Opening)
  if (
    catUpper === 'NSO' ||
    titleLower.includes('nso') ||
    titleLower.includes('opening') ||
    titleLower.includes('buka toko')
  ) {
    const isDone = Boolean(agenda.completed);
    return {
      agenda,
      kind: 'NSO',
      isExplicitVisit: false,
      requiresReport: false,
      requiresCheckIn: false,
      badge: {
        label: 'NSO Toko Baru',
        iconName: 'Sparkles',
        color: 'text-amber-800',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
      },
      status: {
        code: isDone ? 'COMPLETED' : 'SCHEDULED',
        label: isDone ? 'Selesai Setup NSO' : 'Terjadwal',
        color: isDone ? 'text-emerald-700' : 'text-amber-700',
        bg: isDone ? 'bg-emerald-50' : 'bg-amber-50',
        border: isDone ? 'border-emerald-200' : 'border-amber-200',
        dot: isDone ? 'bg-emerald-500' : 'bg-amber-500',
      },
      report: undefined,
    };
  }

  // 6. Audit Khusus / Investigasi
  if (
    catUpper === 'AUDIT' ||
    titleLower.includes('audit') ||
    titleLower.includes('investigasi')
  ) {
    const isDone = Boolean(agenda.completed);
    return {
      agenda,
      kind: 'AUDIT',
      isExplicitVisit: false,
      requiresReport: false,
      requiresCheckIn: false,
      badge: {
        label: 'Audit Khusus',
        iconName: 'ShieldCheck',
        color: 'text-purple-800',
        bg: 'bg-purple-50',
        border: 'border-purple-200',
      },
      status: {
        code: isDone ? 'COMPLETED' : 'SCHEDULED',
        label: isDone ? 'Selesai Audit' : 'Terjadwal',
        color: isDone ? 'text-emerald-700' : 'text-purple-700',
        bg: isDone ? 'bg-emerald-50' : 'bg-purple-50',
        border: isDone ? 'border-emerald-200' : 'border-purple-200',
        dot: isDone ? 'bg-emerald-500' : 'bg-purple-500',
      },
      report: undefined,
    };
  }

  // 7. Operasional Lapangan (Maintenance, Thawing, Waste, Stock Opname, Pendampingan Toko)
  if (
    catUpper === 'OPERATION' ||
    titleLower.includes('maintenance') ||
    titleLower.includes('opname') ||
    titleLower.includes('thawing') ||
    titleLower.includes('waste') ||
    titleLower.includes('holding time') ||
    titleLower.includes('support') ||
    titleLower.includes('pendampingan') ||
    titleLower.includes('bantuan')
  ) {
    const isDone = Boolean(agenda.completed);
    return {
      agenda,
      kind: 'OPERATION',
      isExplicitVisit: false,
      requiresReport: false,
      requiresCheckIn: false,
      badge: {
        label: 'Operasional Lapangan',
        iconName: 'Briefcase',
        color: 'text-teal-800',
        bg: 'bg-teal-50',
        border: 'border-teal-200',
      },
      status: {
        code: isDone ? 'COMPLETED' : 'SCHEDULED',
        label: isDone ? 'Selesai Penugasan' : 'Terjadwal',
        color: isDone ? 'text-emerald-700' : 'text-teal-700',
        bg: isDone ? 'bg-emerald-50' : 'bg-teal-50',
        border: isDone ? 'border-emerald-200' : 'border-teal-200',
        dot: isDone ? 'bg-emerald-500' : 'bg-teal-500',
      },
      report: undefined,
    };
  }

  // 8. Work Plan / Tugas Admin / Kantor
  if (
    catUpper === 'WORK_PLAN' ||
    titleLower.includes('work plan') ||
    titleLower.includes('admin') ||
    titleLower.includes('laporan') ||
    titleLower.includes('rekap')
  ) {
    const isDone = Boolean(agenda.completed);
    return {
      agenda,
      kind: 'OTHER',
      isExplicitVisit: false,
      requiresReport: false,
      requiresCheckIn: false,
      badge: {
        label: 'Tugas Admin / Kantor',
        iconName: 'FileText',
        color: 'text-indigo-800',
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
      },
      status: {
        code: isDone ? 'COMPLETED' : 'SCHEDULED',
        label: isDone ? 'Selesai Tugas' : 'Terjadwal',
        color: isDone ? 'text-emerald-700' : 'text-indigo-700',
        bg: isDone ? 'bg-emerald-50' : 'bg-indigo-50',
        border: isDone ? 'border-emerald-200' : 'border-indigo-200',
        dot: isDone ? 'bg-emerald-500' : 'bg-indigo-500',
      },
      report: undefined,
    };
  }

  // 9. EXPLICIT VISIT:
  // HANYA dianggap VISIT jika:
  // - Category secara eksplisit 'VISIT'
  // - ATAU title secara eksplisit mengandung kata 'visit' atau 'kunjungan'
  const isExplicitVisit =
    catUpper === 'VISIT' ||
    titleLower.includes('visit') ||
    titleLower.includes('kunjungan');

  if (isExplicitVisit) {
    const actualIn = agenda.actualIn || report?.actualIn;
    const actualOut = agenda.actualOut || report?.actualOut;
    const isSubmitted = report?.status === 'SUBMITTED' || agenda.completed;

    if (isSubmitted || (actualIn && actualOut)) {
      return {
        agenda,
        kind: 'VISIT',
        isExplicitVisit: true,
        requiresReport: true,
        requiresCheckIn: true,
        badge: {
          label: 'Visit Toko Resmi',
          iconName: 'Store',
          color: 'text-emerald-800 font-bold',
          bg: 'bg-emerald-50',
          border: 'border-emerald-300',
        },
        status: {
          code: 'COMPLETED',
          label: 'Selesai Kunjungan',
          color: 'text-emerald-800',
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          dot: 'bg-emerald-500',
        },
        report,
      };
    }

    if (actualIn && !actualOut) {
      return {
        agenda,
        kind: 'VISIT',
        isExplicitVisit: true,
        requiresReport: true,
        requiresCheckIn: true,
        badge: {
          label: 'Visit Toko Resmi',
          iconName: 'Store',
          color: 'text-emerald-800 font-bold',
          bg: 'bg-emerald-50',
          border: 'border-emerald-300',
        },
        status: {
          code: 'IN_PROGRESS',
          label: 'Di Toko (In-Progress)',
          color: 'text-amber-800',
          bg: 'bg-amber-50',
          border: 'border-amber-300',
          dot: 'bg-amber-500 animate-pulse',
        },
        report,
      };
    }

    return {
      agenda,
      kind: 'VISIT',
      isExplicitVisit: true,
      requiresReport: true,
      requiresCheckIn: true,
      badge: {
        label: 'Visit Toko Resmi',
        iconName: 'Store',
        color: 'text-emerald-800 font-bold',
        bg: 'bg-emerald-50',
        border: 'border-emerald-300',
      },
      status: {
        code: 'SCHEDULED',
        label: 'Belum Check-In',
        color: 'text-slate-600',
        bg: 'bg-slate-100',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
      },
      report,
    };
  }

  // 10. Fallback: Agenda Umum Non-Visit
  const isDone = Boolean(agenda.completed);
  return {
    agenda,
    kind: 'OTHER',
    isExplicitVisit: false,
    requiresReport: false,
    requiresCheckIn: false,
    badge: {
      label: 'Agenda Non-Visit',
      iconName: 'Briefcase',
      color: 'text-slate-700',
      bg: 'bg-slate-100',
      border: 'border-slate-200',
    },
    status: {
      code: isDone ? 'COMPLETED' : 'SCHEDULED',
      label: isDone ? 'Selesai' : 'Terjadwal',
      color: isDone ? 'text-emerald-700' : 'text-slate-700',
      bg: isDone ? 'bg-emerald-50' : 'bg-slate-100',
      border: isDone ? 'border-emerald-200' : 'border-slate-200',
      dot: isDone ? 'bg-emerald-500' : 'bg-slate-400',
    },
    report: undefined,
  };
}

// ============================================================================
// MAIN ADMIN PORTAL COMPONENT
// ============================================================================
export const AdminPortal: React.FC<AdminPortalProps> = ({
  adminUser,
  agendas = [],
  users = [],
  onAddAgenda,
  onUpdateAgenda,
  onDeleteAgenda,
  onImportExcel,
  onSwitchToUserView,
  onLogout,
  onOpenLiveMaps,
}) => {
  // Navigation Tabs:
  // 1. 'table' -> Data Agenda Lengkap (Spreadsheet View)
  // 2. 'calendar' -> Kalender Interaktif
  // 3. 'analytics' -> Rekap Produktivitas & Grafik
  // 4. 'monitoring' -> Audit Presensi Kunjungan & Laporan QSC
  // 5. 'datahub' -> Pusat Sinkronisasi Excel & Master Toko
  const [activeTab, setActiveTab] = useState<'table' | 'calendar' | 'analytics' | 'monitoring' | 'datahub'>('table');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterKind, setFilterKind] = useState<string>('ALL');
  const [filterPic, setFilterPic] = useState<string>('ALL');
  const [filterDatePreset, setFilterDatePreset] = useState<'TODAY' | 'TOMORROW' | 'WEEK' | 'MONTH' | 'ALL' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Calendar State
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Cloud Reports State
  const [cloudReports, setCloudReports] = useState<VisitReportData[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [previewingReport, setPreviewingReport] = useState<VisitReportData | null>(null);

  // Holding Time Standards (R23)
  const [holdingStandards, setHoldingStandards] = useState<HoldingTimeStandards>(() => getActiveHoldingTimeStandards());
  const [showHoldingTimeModal, setShowHoldingTimeModal] = useState(false);

  // Agenda Form Modal
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<ScheduleAgenda | null>(null);
  const [defaultDateForModal, setDefaultDateForModal] = useState<string | undefined>(undefined);

  // Delete Confirmation Modal
  const [deletingAgenda, setDeletingAgenda] = useState<ScheduleAgenda | null>(null);

  // Raw Data Export Modal
  const [showExportModal, setShowExportModal] = useState(false);

  // Master Store Data
  const [masterStores, setMasterStores] = useState<MasterStore[]>(() => getMasterStores());
  const [storeSearch, setStoreSearch] = useState('');
  const [storeFeedback, setStoreFeedback] = useState<string | null>(null);

  // Excel Schedule Import
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelSummary, setExcelSummary] = useState<ParsedExcelScheduleSummary | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Today Date
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Fetch Cloud Reports
  const loadReports = async () => {
    setIsLoadingReports(true);
    try {
      const reps = await fetchAllVisitReportsFromCloud(true);
      if (Array.isArray(reps)) {
        setCloudReports(reps);
      }
    } catch (e) {
      console.warn('Failed to load cloud reports in admin:', e);
    } finally {
      setIsLoadingReports(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  // Map of Reports by AgendaId and StoreCode_Date
  const reportMap = useMemo(() => {
    const map = new Map<string, VisitReportData>();
    cloudReports.forEach((r) => {
      if (r.agendaId) map.set(r.agendaId, r);
      if (r.storeCode && r.visitDate) {
        map.set(`${r.storeCode}_${r.visitDate}`, r);
      }
    });
    return map;
  }, [cloudReports]);

  // Classified Agendas List
  const allClassifiedAgendas = useMemo(() => {
    return agendas.map((ag) => classifyAgendaItem(ag, reportMap));
  }, [agendas, reportMap]);

  // Date Filter Bounds
  const dateRangeBounds = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const toIso = (d: Date) => d.toISOString().split('T')[0];

    return {
      today: toIso(today),
      tomorrow: toIso(tomorrow),
      weekStart: toIso(startOfWeek),
      weekEnd: toIso(endOfWeek),
      monthStart: toIso(startOfMonth),
      monthEnd: toIso(endOfMonth),
    };
  }, []);

  // Filtered Agendas
  const filteredClassifiedAgendas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allClassifiedAgendas.filter((item) => {
      const ag = item.agenda;

      // 1. Date Filter
      if (filterDatePreset === 'TODAY' && ag.date !== dateRangeBounds.today) return false;
      if (filterDatePreset === 'TOMORROW' && ag.date !== dateRangeBounds.tomorrow) return false;
      if (filterDatePreset === 'WEEK') {
        if (ag.date < dateRangeBounds.weekStart || ag.date > dateRangeBounds.weekEnd) return false;
      }
      if (filterDatePreset === 'MONTH') {
        if (ag.date < dateRangeBounds.monthStart || ag.date > dateRangeBounds.monthEnd) return false;
      }
      if (filterDatePreset === 'CUSTOM') {
        if (customStartDate && ag.date < customStartDate) return false;
        if (customEndDate && ag.date > customEndDate) return false;
      }

      // 2. Kind Filter (Visit vs Meeting vs Training vs Cuti dll)
      if (filterKind !== 'ALL') {
        if (filterKind === 'VISIT' && !item.isExplicitVisit) return false;
        if (filterKind === 'NON_VISIT' && item.isExplicitVisit) return false;
        if (filterKind !== 'VISIT' && filterKind !== 'NON_VISIT' && item.kind !== filterKind) return false;
      }

      // 3. PIC Filter
      if (filterPic !== 'ALL') {
        if (!ag.pic || !ag.pic.toLowerCase().includes(filterPic.toLowerCase())) {
          return false;
        }
      }

      // 4. Query Search
      if (q) {
        const matchTitle = ag.title?.toLowerCase().includes(q);
        const matchLocation = ag.location?.toLowerCase().includes(q);
        const matchPic = ag.pic?.toLowerCase().includes(q);
        const matchStoreCode = ag.storeCode?.toLowerCase().includes(q);
        const matchStoreName = ag.storeName?.toLowerCase().includes(q);
        const matchDesc = ag.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchLocation && !matchPic && !matchStoreCode && !matchStoreName && !matchDesc) {
          return false;
        }
      }

      return true;
    });
  }, [
    allClassifiedAgendas,
    filterDatePreset,
    dateRangeBounds,
    customStartDate,
    customEndDate,
    filterKind,
    filterPic,
    searchQuery,
  ]);

  // Quick Executive Metrics
  const metrics = useMemo(() => {
    const total = allClassifiedAgendas.length;
    const visits = allClassifiedAgendas.filter((i) => i.isExplicitVisit);
    const nonVisits = allClassifiedAgendas.filter((i) => !i.isExplicitVisit && i.kind !== 'LEAVE' && i.kind !== 'OFF');
    const leaves = allClassifiedAgendas.filter((i) => i.kind === 'LEAVE' || i.kind === 'OFF');

    const visitDone = visits.filter((i) => i.status.code === 'COMPLETED').length;
    const visitInProgress = visits.filter((i) => i.status.code === 'IN_PROGRESS').length;
    const visitPending = visits.filter((i) => i.status.code === 'SCHEDULED').length;

    const meetings = allClassifiedAgendas.filter((i) => i.kind === 'MEETING').length;
    const trainings = allClassifiedAgendas.filter((i) => i.kind === 'TRAINING').length;
    const ops = allClassifiedAgendas.filter((i) => i.kind === 'OPERATION' || i.kind === 'NSO' || i.kind === 'AUDIT').length;

    return {
      total,
      visitsCount: visits.length,
      visitDone,
      visitInProgress,
      visitPending,
      visitPercentage: visits.length > 0 ? Math.round((visitDone / visits.length) * 100) : 0,
      nonVisitsCount: nonVisits.length,
      meetings,
      trainings,
      ops,
      leavesCount: leaves.length,
    };
  }, [allClassifiedAgendas]);

  // Unique PICs list with tasks count
  const picList = useMemo(() => {
    const map = new Map<string, number>();
    agendas.forEach((a) => {
      const p = a.pic ? a.pic.trim() : 'Unassigned';
      map.set(p, (map.get(p) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [agendas]);

  // Calendar Matrix Computation
  const calendarMatrix = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday-based (1 = Monday, 7 = Sunday)
    let startDay = firstDayOfMonth.getDay();
    startDay = startDay === 0 ? 7 : startDay;

    const daysInMonth = lastDayOfMonth.getDate();
    const matrix: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];

    // Prev month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i > 0; i--) {
      const d = prevMonthLastDay - i + 1;
      const prevDate = new Date(year, month - 1, d);
      matrix.push({
        dateStr: prevDate.toISOString().split('T')[0],
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(year, month, d);
      matrix.push({
        dateStr: currDate.toISOString().split('T')[0],
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Next month padding (total cells divisible by 7)
    const remaining = 7 - (matrix.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const nextDate = new Date(year, month + 1, d);
        matrix.push({
          dateStr: nextDate.toISOString().split('T')[0],
          dayNum: d,
          isCurrentMonth: false,
        });
      }
    }

    return matrix;
  }, [calendarMonth]);

  // Calendar Agendas Map by Date
  const calendarAgendasMap = useMemo(() => {
    const map = new Map<string, ClassifiedAgenda[]>();
    allClassifiedAgendas.forEach((item) => {
      const d = item.agenda.date;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(item);
    });
    return map;
  }, [allClassifiedAgendas]);

  // Agendas for Selected Calendar Date
  const selectedCalendarAgendas = useMemo(() => {
    return calendarAgendasMap.get(selectedCalendarDate) || [];
  }, [calendarAgendasMap, selectedCalendarDate]);

  // Leaderboard / Rekap Tim
  const teamLeaderboard = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number;
        visits: number;
        visitDone: number;
        meetings: number;
        trainings: number;
        ops: number;
        leaves: number;
      }
    >();

    allClassifiedAgendas.forEach((item) => {
      const p = item.agenda.pic ? item.agenda.pic.trim() : 'Unassigned';
      if (!map.has(p)) {
        map.set(p, { total: 0, visits: 0, visitDone: 0, meetings: 0, trainings: 0, ops: 0, leaves: 0 });
      }
      const data = map.get(p)!;
      data.total += 1;
      if (item.isExplicitVisit) {
        data.visits += 1;
        if (item.status.code === 'COMPLETED') data.visitDone += 1;
      } else if (item.kind === 'MEETING') {
        data.meetings += 1;
      } else if (item.kind === 'TRAINING') {
        data.trainings += 1;
      } else if (item.kind === 'OPERATION' || item.kind === 'NSO' || item.kind === 'AUDIT') {
        data.ops += 1;
      } else if (item.kind === 'LEAVE' || item.kind === 'OFF') {
        data.leaves += 1;
      }
    });

    return Array.from(map.entries())
      .map(([name, stats]) => ({
        name,
        ...stats,
        completionRate: stats.visits > 0 ? Math.round((stats.visitDone / stats.visits) * 100) : 100,
      }))
      .sort((a, b) => b.total - a.total);
  }, [allClassifiedAgendas]);

  // Excel Schedule File Selection
  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);
    setIsParsingExcel(true);
    setImportFeedback(null);

    try {
      const parseRes = await parseScheduleExcelFile(file, users);
      setExcelSummary(parseRes.summary);
    } catch (err: any) {
      setImportFeedback(`Gagal membaca Excel: ${err?.message || 'Format tidak valid'}`);
    } finally {
      setIsParsingExcel(false);
    }
  };

  // Execute Excel Schedule Import
  const handleExecuteImport = () => {
    if (!excelSummary) return;
    try {
      onImportExcel(excelSummary.updatedUsers, excelSummary.agendas, importMode);
      setImportFeedback(
        `Sukses mengimpor ${excelSummary.agendas.length} agenda (${importMode === 'replace' ? 'Mode Timpa Penuh' : 'Mode Gabung'}).`
      );
      setExcelFile(null);
      setExcelSummary(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setImportFeedback(`Gagal menyimpan data impor: ${err?.message || 'Error tidak diketahui'}`);
    }
  };

  // Download Official Schedule Template
  const handleDownloadScheduleTemplate = () => {
    exportScheduleToTemplateExcel(agendas, users);
  };

  // Download Master Stores
  const handleDownloadMasterStores = () => {
    exportMasterStoresToExcel();
  };

  // Export Filtered Agendas to Raw Excel
  const handleExportRawAgendas = () => {
    const rows = filteredClassifiedAgendas.map((item, idx) => {
      const ag = item.agenda;
      return {
        'No': idx + 1,
        'Tanggal': ag.date,
        'Jam Mulai': ag.time || '08:00',
        'Jam Selesai': ag.endTime || '17:00',
        'PIC / Personil': ag.pic,
        'Klasifikasi Kegiatan': item.badge.label,
        'Apakah Visit Resmi': item.isExplicitVisit ? 'YA (VISIT TOKO)' : 'TIDAK (NON-VISIT)',
        'Judul Agenda': ag.title,
        'Kode Toko': ag.storeCode || '-',
        'Nama Toko / Lokasi': ag.storeName || ag.location,
        'Status Pelaksanaan': item.status.label,
        'Actual IN': ag.actualIn || item.report?.actualIn || '-',
        'Actual OUT': ag.actualOut || item.report?.actualOut || '-',
        'Laporan QSC Submit': item.report?.status === 'SUBMITTED' ? 'SUDAH SUBMIT' : item.isExplicitVisit ? 'BELUM' : 'TIDAK PERLU',
        'Deskripsi / Catatan': ag.description || '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Agenda FMCU');
    XLSX.writeFile(workbook, `FMCU_Data_Agenda_${todayIso}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-800 flex flex-col font-sans select-none">
      {/* ============================================================
          TOP EXECUTIVE APP BAR (Apple Glass Style, Minimalist, Clean)
          ============================================================ */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Left: Branding & Role */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black shadow-sm ring-2 ring-emerald-500/20">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
                  FMCU Central Admin
                </h1>
                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Master Data
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-500 leading-none mt-1">
                FamilyMart Operational & Activity Command Center
              </p>
            </div>
          </div>

          {/* Right: Quick Actions (Maps, Switch View, Logout) */}
          <div className="flex items-center gap-2">
            {onOpenLiveMaps && (
              <button
                type="button"
                onClick={onOpenLiveMaps}
                title="Buka Peta Live Pinpoint Toko"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 text-xs font-bold transition active:scale-95 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Live Maps</span>
              </button>
            )}

            <button
              type="button"
              onClick={onSwitchToUserView}
              title="Beralih ke Tampilan Staff Lapangan"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition active:scale-95 cursor-pointer border border-slate-200"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mode Staff</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              title="Keluar dari Portal Admin"
              className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center transition active:scale-95 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================
          EXECUTIVE 4-PILLAR STATS BAR (High-Density & Clean Clarity)
          ============================================================ */}
      <section className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-3.5">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Total Agenda */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-700 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-black uppercase text-slate-500 leading-none">
                Total Seluruh Agenda
              </span>
              <span className="block text-lg font-black text-slate-900 leading-tight mt-0.5">
                {metrics.total}{' '}
                <span className="text-xs font-bold text-slate-500">Kegiatan</span>
              </span>
              <span className="block text-[10px] font-bold text-slate-500 truncate mt-0.5">
                Terdaftar di database
              </span>
            </div>
          </div>

          {/* Card 2: Visit Toko Resmi */}
          <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="block text-[10px] font-black uppercase text-emerald-800 leading-none">
                  Visit Toko Resmi
                </span>
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-emerald-200 text-emerald-900">
                  {metrics.visitPercentage}% Done
                </span>
              </div>
              <span className="block text-lg font-black text-emerald-950 leading-tight mt-0.5">
                {metrics.visitDone} / {metrics.visitsCount}{' '}
                <span className="text-xs font-bold text-emerald-700">Toko</span>
              </span>
              <span className="block text-[10px] font-bold text-emerald-800 truncate mt-0.5">
                {metrics.visitInProgress} Sedang di Toko • {metrics.visitPending} Belum
              </span>
            </div>
          </div>

          {/* Card 3: Non-Visit Activities */}
          <div className="p-3 rounded-2xl bg-cyan-50/60 border border-cyan-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-black uppercase text-cyan-800 leading-none">
                Agenda Non-Visit
              </span>
              <span className="block text-lg font-black text-cyan-950 leading-tight mt-0.5">
                {metrics.nonVisitsCount}{' '}
                <span className="text-xs font-bold text-cyan-700">Sesi</span>
              </span>
              <span className="block text-[10px] font-bold text-cyan-800 truncate mt-0.5">
                {metrics.meetings} Meeting • {metrics.trainings} Training • {metrics.ops} Ops
              </span>
            </div>
          </div>

          {/* Card 4: Ketersediaan Personil */}
          <div className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Coffee className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-black uppercase text-rose-800 leading-none">
                Cuti & Hari Libur
              </span>
              <span className="block text-lg font-black text-rose-950 leading-tight mt-0.5">
                {metrics.leavesCount}{' '}
                <span className="text-xs font-bold text-rose-700">Personil</span>
              </span>
              <span className="block text-[10px] font-bold text-rose-800 truncate mt-0.5">
                Status ketersediaan tim
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          MAIN NAVIGATION TABS (5 Core Pillars)
          ============================================================ */}
      <nav className="bg-white border-b border-slate-200 sticky top-[57px] z-20 px-4 sm:px-6 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar gap-2 py-2">
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Tab 1: Data Table */}
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === 'table'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Data Agenda (Excel)</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  activeTab === 'table' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {filteredClassifiedAgendas.length}
              </span>
            </button>

            {/* Tab 2: Calendar */}
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Kalender Interaktif</span>
            </button>

            {/* Tab 3: Analytics */}
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analitik & Rekap Tim</span>
            </button>

            {/* Tab 4: Monitoring Visit & Laporan */}
            <button
              type="button"
              onClick={() => setActiveTab('monitoring')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === 'monitoring'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Audit Kunjungan & Laporan</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  activeTab === 'monitoring' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {metrics.visitsCount}
              </span>
            </button>

            {/* Tab 5: Data Hub & Sync */}
            <button
              type="button"
              onClick={() => setActiveTab('datahub')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === 'datahub'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Pusat Data & Sinkronisasi Excel</span>
            </button>
          </div>

          {/* Quick Add Agenda Button */}
          <button
            type="button"
            onClick={() => {
              setEditingAgenda(null);
              setDefaultDateForModal(todayIso);
              setIsAgendaModalOpen(true);
            }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Tambah Agenda Baru</span>
          </button>
        </div>
      </nav>

      {/* ============================================================
          MAIN CONTENT CONTAINER
          ============================================================ */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-4">
        {/* ============================================================
            TAB 1: DATA AGENDA LENGKAP (Spreadsheet Table View)
            "Kemudahan lihat data dibuat maksimal, spreadsheet-level"
            ============================================================ */}
        {activeTab === 'table' && (
          <div className="space-y-4">
            {/* Top Toolbar: Search, Filters, and Raw Export */}
            <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-xs space-y-3">
              {/* Row 1: Search & Date Presets */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama toko, kode toko (misal: 3006), PIC, atau judul kegiatan..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Date Filter Buttons */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
                  <span className="text-[11px] font-black text-slate-400 uppercase mr-1">Tanggal:</span>
                  {(
                    [
                      { id: 'ALL', label: 'Semua' },
                      { id: 'TODAY', label: 'Hari Ini' },
                      { id: 'TOMORROW', label: 'Besok' },
                      { id: 'WEEK', label: 'Minggu Ini' },
                      { id: 'MONTH', label: 'Bulan Ini' },
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setFilterDatePreset(preset.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        filterDatePreset === preset.id
                          ? 'bg-slate-800 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: Category Chips & PIC Filter & Export */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                {/* 1-Click Classification Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-black text-slate-400 uppercase mr-1">Filter Jenis:</span>

                  <button
                    type="button"
                    onClick={() => setFilterKind('ALL')}
                    className={`px-2.5 py-1 rounded-full text-xs font-black transition cursor-pointer ${
                      filterKind === 'ALL'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    Semua ({allClassifiedAgendas.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterKind('VISIT')}
                    className={`px-2.5 py-1 rounded-full text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                      filterKind === 'VISIT'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    <Store className="w-3 h-3" />
                    <span>Hanya Visit Toko ({metrics.visitsCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterKind('NON_VISIT')}
                    className={`px-2.5 py-1 rounded-full text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                      filterKind === 'NON_VISIT'
                        ? 'bg-cyan-700 text-white'
                        : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200'
                    }`}
                  >
                    <Building2 className="w-3 h-3" />
                    <span>Semua Non-Visit ({metrics.nonVisitsCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterKind('MEETING')}
                    className={`px-2.5 py-1 rounded-full text-xs font-black transition cursor-pointer ${
                      filterKind === 'MEETING'
                        ? 'bg-blue-700 text-white'
                        : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'
                    }`}
                  >
                    Meeting ({metrics.meetings})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterKind('TRAINING')}
                    className={`px-2.5 py-1 rounded-full text-xs font-black transition cursor-pointer ${
                      filterKind === 'TRAINING'
                        ? 'bg-cyan-700 text-white'
                        : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200'
                    }`}
                  >
                    Training ({metrics.trainings})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterKind('LEAVE')}
                    className={`px-2.5 py-1 rounded-full text-xs font-black transition cursor-pointer ${
                      filterKind === 'LEAVE'
                        ? 'bg-rose-700 text-white'
                        : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    Cuti / Off ({metrics.leavesCount})
                  </button>
                </div>

                {/* Right: PIC Dropdown & Download Button */}
                <div className="flex items-center gap-2">
                  {/* PIC Dropdown */}
                  <select
                    value={filterPic}
                    onChange={(e) => setFilterPic(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="ALL">Semua Personil ({picList.length})</option>
                    {picList.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} ({p.count})
                      </option>
                    ))}
                  </select>

                  {/* 1-Click Excel Export */}
                  <button
                    type="button"
                    onClick={handleExportRawAgendas}
                    title="Unduh data tabel saat ini ke spreadsheet Excel"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tarik Excel (.xlsx)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SPREADSHEET HIGH-DENSITY DATA TABLE */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-black tracking-wider">
                      <th className="py-2.5 px-3 text-center w-10">No</th>
                      <th className="py-2.5 px-3 w-28">Tanggal & Jam</th>
                      <th className="py-2.5 px-3 w-36">Personil (PIC)</th>
                      <th className="py-2.5 px-3 w-32">Jenis Kegiatan</th>
                      <th className="py-2.5 px-4 min-w-[200px]">Judul Agenda & Deskripsi</th>
                      <th className="py-2.5 px-3 min-w-[160px]">Lokasi / Toko</th>
                      <th className="py-2.5 px-3 w-36">Status Pelaksanaan</th>
                      <th className="py-2.5 px-3 w-28 text-center">Laporan QSC</th>
                      <th className="py-2.5 px-3 w-20 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredClassifiedAgendas.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <p className="font-bold text-sm text-slate-600">Tidak ada agenda yang cocok dengan filter</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Coba ubah tanggal preset, kata kunci pencarian, atau jenis kegiatan
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredClassifiedAgendas.map((item, idx) => {
                        const ag = item.agenda;
                        const hasStore = Boolean(ag.storeCode || ag.storeName);

                        return (
                          <tr
                            key={ag.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                            }`}
                          >
                            {/* No */}
                            <td className="py-2 px-3 text-center font-bold text-slate-400">
                              {idx + 1}
                            </td>

                            {/* Tanggal & Jam */}
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className="font-black text-slate-900 block leading-tight">
                                {ag.date}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 block leading-tight mt-0.5">
                                {ag.time || '08:00'} - {ag.endTime || '17:00'} WIB
                              </span>
                            </td>

                            {/* PIC */}
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-slate-800 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                                  {ag.pic ? ag.pic.charAt(0).toUpperCase() : '?'}
                                </div>
                                <span className="font-bold text-slate-800 truncate" title={ag.pic}>
                                  {ag.pic || 'Unassigned'}
                                </span>
                              </div>
                            </td>

                            {/* Jenis Kegiatan Badge */}
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${item.badge.bg} ${item.badge.color} ${item.badge.border}`}
                              >
                                {item.isExplicitVisit && <Store className="w-3 h-3 shrink-0" />}
                                {item.kind === 'MEETING' && <Building2 className="w-3 h-3 shrink-0" />}
                                {item.kind === 'TRAINING' && <BookOpen className="w-3 h-3 shrink-0" />}
                                {item.kind === 'LEAVE' && <Coffee className="w-3 h-3 shrink-0" />}
                                <span>{item.badge.label}</span>
                              </span>
                            </td>

                            {/* Judul & Deskripsi */}
                            <td className="py-2 px-4">
                              <p className="font-black text-slate-900 leading-tight">
                                {ag.title}
                              </p>
                              {ag.description && (
                                <p className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">
                                  {ag.description}
                                </p>
                              )}
                            </td>

                            {/* Lokasi / Toko */}
                            <td className="py-2 px-3">
                              {hasStore ? (
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {ag.storeCode && (
                                      <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 border border-emerald-200">
                                        {ag.storeCode}
                                      </span>
                                    )}
                                    <span className="font-black text-slate-800 text-xs">
                                      {ag.storeName || ag.location}
                                    </span>
                                  </div>
                                  {!item.isExplicitVisit && (
                                    <span className="text-[9.5px] font-bold text-slate-400 block mt-0.5">
                                      (Lokasi Toko, Agenda Non-Visit)
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="font-medium text-slate-700">
                                  {ag.location || 'Kantor / Daring'}
                                </span>
                              )}
                            </td>

                            {/* Status Pelaksanaan */}
                            <td className="py-2 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${item.status.dot} shrink-0`} />
                                <span
                                  className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${item.status.bg} ${item.status.color} ${item.status.border}`}
                                >
                                  {item.status.label}
                                </span>
                              </div>
                              {/* Actual In/Out info for visit */}
                              {item.isExplicitVisit && (ag.actualIn || item.report?.actualIn) && (
                                <span className="text-[9.5px] font-bold text-slate-500 block mt-0.5">
                                  IN: {ag.actualIn || item.report?.actualIn}{' '}
                                  {ag.actualOut || item.report?.actualOut ? `• OUT: ${ag.actualOut || item.report?.actualOut}` : ''}
                                </span>
                              )}
                            </td>

                            {/* Laporan QSC */}
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              {item.isExplicitVisit ? (
                                item.report ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewingReport(item.report!)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black transition cursor-pointer shadow-xs active:scale-95"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>Lihat PDF</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    Menunggu
                                  </span>
                                )
                              ) : (
                                <span className="text-[11px] font-bold text-slate-300">—</span>
                              )}
                            </td>

                            {/* Aksi */}
                            <td className="py-2 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAgenda(ag);
                                    setIsAgendaModalOpen(true);
                                  }}
                                  title="Edit Agenda"
                                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition active:scale-95 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingAgenda(ag)}
                                  title="Hapus Agenda"
                                  className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center justify-center transition active:scale-95 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer: Summary Count */}
              <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs text-slate-500 font-bold">
                <span>
                  Menampilkan <strong className="text-slate-800">{filteredClassifiedAgendas.length}</strong> dari{' '}
                  <strong className="text-slate-800">{allClassifiedAgendas.length}</strong> total agenda
                </span>
                <span className="text-[11px] text-slate-400">
                  FamilyMart Operations Data Engine
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 2: KALENDER INTERAKTIF (Full Month Interactive Matrix)
            ============================================================ */}
        {activeTab === 'calendar' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left 2 Cols: Interactive Calendar Matrix */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
              {/* Calendar Month Header & Nav */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-900 leading-none">
                    {calendarMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                  </h2>
                  <p className="text-xs font-bold text-slate-500 mt-1">
                    Klik pada tanggal untuk melihat agenda kerja
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
                    }}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setCalendarMonth(now);
                      setSelectedCalendarDate(now.toISOString().split('T')[0]);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
                  >
                    Bulan Ini
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
                    }}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Day Labels */}
              <div className="grid grid-cols-7 gap-1 text-center font-black text-[11px] text-slate-400 uppercase py-1 border-b border-slate-100">
                <span>Sen</span>
                <span>Sel</span>
                <span>Rab</span>
                <span>Kam</span>
                <span>Jum</span>
                <span className="text-amber-600">Sab</span>
                <span className="text-rose-600">Min</span>
              </div>

              {/* Days Matrix */}
              <div className="grid grid-cols-7 gap-1.5">
                {calendarMatrix.map((cell) => {
                  const dayAgendas = calendarAgendasMap.get(cell.dateStr) || [];
                  const isSelected = selectedCalendarDate === cell.dateStr;
                  const isToday = todayIso === cell.dateStr;

                  const visitCount = dayAgendas.filter((i) => i.isExplicitVisit).length;
                  const nonVisitCount = dayAgendas.filter((i) => !i.isExplicitVisit && i.kind !== 'LEAVE' && i.kind !== 'OFF').length;
                  const leaveCount = dayAgendas.filter((i) => i.kind === 'LEAVE' || i.kind === 'OFF').length;

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => setSelectedCalendarDate(cell.dateStr)}
                      className={`min-h-[72px] sm:min-h-[82px] p-1.5 rounded-xl text-left border flex flex-col justify-between transition cursor-pointer ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                          : isToday
                          ? 'border-emerald-400 bg-emerald-50/50 text-slate-900'
                          : cell.isCurrentMonth
                          ? 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                          : 'border-slate-100 bg-slate-50/50 text-slate-300'
                      }`}
                    >
                      {/* Top Day Number */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${
                            isToday && !isSelected
                              ? 'bg-emerald-600 text-white'
                              : isSelected
                              ? 'text-white'
                              : 'text-slate-700'
                          }`}
                        >
                          {cell.dayNum}
                        </span>

                        {dayAgendas.length > 0 && (
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {dayAgendas.length}
                          </span>
                        )}
                      </div>

                      {/* Micro Dot Indicators */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {visitCount > 0 && (
                          <span
                            className="inline-block w-2 h-2 rounded-full bg-emerald-500"
                            title={`${visitCount} Visit Toko`}
                          />
                        )}
                        {nonVisitCount > 0 && (
                          <span
                            className="inline-block w-2 h-2 rounded-full bg-blue-500"
                            title={`${nonVisitCount} Non-Visit (Meeting/Training)`}
                          />
                        )}
                        {leaveCount > 0 && (
                          <span
                            className="inline-block w-2 h-2 rounded-full bg-rose-500"
                            title={`${leaveCount} Cuti/Off`}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 text-xs font-bold text-slate-500 pt-2 border-t border-slate-100 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Visit Toko</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>Meeting / Training</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Cuti / Off</span>
                </span>
              </div>
            </div>

            {/* Right 1 Col: Selected Date Agenda List */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-none">
                      Agenda Tanggal {selectedCalendarDate}
                    </h3>
                    <p className="text-xs font-bold text-slate-500 mt-1">
                      {selectedCalendarAgendas.length} kegiatan terjadwal
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingAgenda(null);
                      setDefaultDateForModal(selectedCalendarDate);
                      setIsAgendaModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition active:scale-95 cursor-pointer"
                    title="Tambah agenda pada tanggal ini"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* List Container */}
                <div className="divide-y divide-slate-100 mt-2 max-h-[500px] overflow-y-auto no-scrollbar space-y-2">
                  {selectedCalendarAgendas.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                      <CalendarDays className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-xs text-slate-600">Tidak ada agenda pada tanggal ini</p>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAgenda(null);
                          setDefaultDateForModal(selectedCalendarDate);
                          setIsAgendaModalOpen(true);
                        }}
                        className="mt-3 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
                      >
                        + Jadwalkan Kegiatan
                      </button>
                    </div>
                  ) : (
                    selectedCalendarAgendas.map((item) => {
                      const ag = item.agenda;
                      return (
                        <div key={ag.id} className="pt-2 pb-2 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-[9.5px] font-black px-2 py-0.5 rounded-md border ${item.badge.bg} ${item.badge.color} ${item.badge.border}`}
                            >
                              {item.badge.label}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500">
                              {ag.time || '08:00'} WIB
                            </span>
                          </div>

                          <h4 className="text-xs font-black text-slate-900 leading-tight">
                            {ag.title}
                          </h4>

                          <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <span className="font-bold text-slate-700 truncate">
                              📍 {ag.storeName || ag.location || '-'}
                            </span>
                            <span className="font-bold text-slate-500 shrink-0">
                              👤 {ag.pic}
                            </span>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center justify-end gap-1.5 pt-1">
                            {item.report && (
                              <button
                                type="button"
                                onClick={() => setPreviewingReport(item.report!)}
                                className="text-[10px] font-black text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <FileText className="w-3 h-3" />
                                <span>Lihat Laporan</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAgenda(ag);
                                setIsAgendaModalOpen(true);
                              }}
                              className="text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                              Edit
                            </button>
                            <span className="text-slate-300">•</span>
                            <button
                              type="button"
                              onClick={() => setDeletingAgenda(ag)}
                              className="text-[10px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 3: ANALITIK & REKAP PRODUKTIVITAS TIM
            ============================================================ */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            {/* Top Row: Visual Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Distribusi Kegiatan */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    Distribusi Kegiatan Tim
                  </h3>
                  <PieChart className="w-4 h-4 text-slate-400" />
                </div>

                <div className="space-y-2">
                  {/* Visit Toko Bar */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-emerald-800 flex items-center gap-1">
                        <Store className="w-3.5 h-3.5" /> Visit Toko Resmi
                      </span>
                      <span className="text-slate-800">
                        {metrics.visitsCount} ({metrics.total > 0 ? Math.round((metrics.visitsCount / metrics.total) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${metrics.total > 0 ? (metrics.visitsCount / metrics.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Meeting Bar */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-blue-800 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" /> Meeting & Koordinasi
                      </span>
                      <span className="text-slate-800">
                        {metrics.meetings} ({metrics.total > 0 ? Math.round((metrics.meetings / metrics.total) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${metrics.total > 0 ? (metrics.meetings / metrics.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Training Bar */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-cyan-800 flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" /> Training & Coaching
                      </span>
                      <span className="text-slate-800">
                        {metrics.trainings} ({metrics.total > 0 ? Math.round((metrics.trainings / metrics.total) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full"
                        style={{ width: `${metrics.total > 0 ? (metrics.trainings / metrics.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Cuti & Off Bar */}
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-rose-800 flex items-center gap-1">
                        <Coffee className="w-3.5 h-3.5" /> Cuti & Libur Off
                      </span>
                      <span className="text-slate-800">
                        {metrics.leavesCount} ({metrics.total > 0 ? Math.round((metrics.leavesCount / metrics.total) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full"
                        style={{ width: `${metrics.total > 0 ? (metrics.leavesCount / metrics.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Kepatuhan Visit Lapangan */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    Realisasi Visit Toko
                  </h3>
                  <Award className="w-4 h-4 text-emerald-600" />
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-500 flex flex-col items-center justify-center shrink-0">
                    <span className="text-xl font-black text-emerald-800 leading-none">
                      {metrics.visitPercentage}%
                    </span>
                    <span className="text-[9px] font-bold text-emerald-600 uppercase mt-0.5">Selesai</span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <p className="font-black text-slate-800">
                      {metrics.visitDone} dari {metrics.visitsCount} Visit Selesai
                    </p>
                    <p className="text-[11px] font-bold text-slate-500">
                      • {metrics.visitInProgress} sedang berada di toko
                    </p>
                    <p className="text-[11px] font-bold text-slate-500">
                      • {metrics.visitPending} belum melakukan check-in
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 3: Master Toko Coverage */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    Database Master Toko
                  </h3>
                  <Store className="w-4 h-4 text-slate-400" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black text-slate-900 leading-none">
                      {masterStores.length}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      Cabang Aktif
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-500">
                    Terdata resmi di seluruh area Jabodetabek, Bandung, dan sekitarnya.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('datahub')}
                    className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Kelola Master Toko di Data Hub</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Row: Team Productivity Leaderboard */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-4 sm:px-6 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 leading-none">
                    Rekapitulasi Produktivitas Personil (Team Leaderboard)
                  </h3>
                  <p className="text-xs font-bold text-slate-500 mt-1">
                    Akumulasi beban kerja, visit toko selesai, dan kegiatan operasional
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-black tracking-wider">
                      <th className="py-2.5 px-3 text-center w-12">Rank</th>
                      <th className="py-2.5 px-3">Nama Personil</th>
                      <th className="py-2.5 px-3 text-center">Total Agenda</th>
                      <th className="py-2.5 px-3 text-center">Visit Selesai / Total</th>
                      <th className="py-2.5 px-3 text-center">Meeting</th>
                      <th className="py-2.5 px-3 text-center">Training</th>
                      <th className="py-2.5 px-3 text-center">Cuti / Off</th>
                      <th className="py-2.5 px-3 min-w-[120px]">Tingkat Realisasi Visit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold">
                    {teamLeaderboard.map((person, idx) => (
                      <tr key={person.name} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 text-center font-black text-slate-400">
                          #{idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-800 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                              {person.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-black text-slate-900">{person.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-slate-800">
                          {person.total}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-emerald-700 font-black">
                            {person.visitDone}
                          </span>{' '}
                          / <span className="text-slate-500">{person.visits}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center text-blue-700">
                          {person.meetings}
                        </td>
                        <td className="py-2.5 px-3 text-center text-cyan-700">
                          {person.trainings}
                        </td>
                        <td className="py-2.5 px-3 text-center text-rose-700">
                          {person.leaves}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${person.completionRate}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-black text-slate-700 w-9 text-right">
                              {person.completionRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 4: MONITORING VISIT TOKO & LAPORAN QSC
            Khusus Kunjungan Toko Resmi (Wajib Geofence & Laporan)
            ============================================================ */}
        {activeTab === 'monitoring' && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="bg-emerald-900 text-white rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base font-black">
                    Monitoring Kunjungan Toko Resmi FMCU
                  </h2>
                </div>
                <p className="text-xs text-emerald-200 mt-1">
                  Menampilkan hanya agenda yang berstatus <strong>Visit Toko Resmi</strong>. Presensi actual IN/OUT terekam otomatis via radius 1–50m.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadReports}
                  disabled={isLoadingReports}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition active:scale-95 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReports ? 'animate-spin' : ''}`} />
                  <span>Segarkan Laporan</span>
                </button>
              </div>
            </div>

            {/* Table of Store Visits */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-black tracking-wider">
                      <th className="py-2.5 px-3 text-center w-10">No</th>
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">PIC Lapangan</th>
                      <th className="py-2.5 px-3">Kode & Nama Toko</th>
                      <th className="py-2.5 px-3 text-center">Actual IN (Auto)</th>
                      <th className="py-2.5 px-3 text-center">Actual OUT (Auto)</th>
                      <th className="py-2.5 px-3 text-center">Status Audit</th>
                      <th className="py-2.5 px-3 text-center">Laporan QSC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold">
                    {allClassifiedAgendas
                      .filter((i) => i.isExplicitVisit)
                      .map((item, idx) => {
                        const ag = item.agenda;
                        const inTime = ag.actualIn || item.report?.actualIn || '-';
                        const outTime = ag.actualOut || item.report?.actualOut || '-';

                        return (
                          <tr key={ag.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 text-center text-slate-400 font-black">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-900 font-black">
                              {ag.date}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-800">
                              {ag.pic}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900 border border-emerald-200 mr-1.5">
                                {ag.storeCode || '3006'}
                              </span>
                              <span className="font-black text-slate-900">
                                {ag.storeName || ag.location}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">
                              {inTime !== '-' ? (
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  {inTime} WIB
                                </span>
                              ) : (
                                <span className="text-slate-400">Belum IN</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">
                              {outTime !== '-' ? (
                                <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  {outTime} WIB
                                </span>
                              ) : (
                                <span className="text-slate-400">Belum OUT</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black border ${item.status.bg} ${item.status.color} ${item.status.border}`}
                              >
                                {item.status.label}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {item.report ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewingReport(item.report!)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black transition cursor-pointer shadow-xs active:scale-95"
                                >
                                  <FileText className="w-3 h-3" />
                                  <span>Lihat PDF</span>
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  Belum Submit
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB 5: DATA HUB & EXCEL SYNC (Schedule, Master Toko, R23)
            ============================================================ */}
        {activeTab === 'datahub' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Box 1: Excel Schedule Sync */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-black">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-800">
                    1. Sinkronisasi Jadwal Kerja
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500">
                    Upload & Download Jadwal Excel
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleExcelFileSelect}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Pilih File Excel Jadwal...</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadScheduleTemplate}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Download Template Excel</span>
                </button>

                {importFeedback && (
                  <div className="p-2.5 rounded-xl bg-slate-100 text-[11px] font-bold text-slate-700">
                    {importFeedback}
                  </div>
                )}

                {/* Summary Modal / Section if parsed */}
                {excelSummary && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                    <p className="text-xs font-black text-emerald-900">
                      File Siap Diimpor: {excelSummary.agendas.length} Agenda
                    </p>
                    <div className="text-[11px] text-emerald-800 space-y-0.5">
                      <p>• {excelSummary.stats.visitCount} Visit Toko Resmi</p>
                      <p>• {excelSummary.stats.nonStoreAgendaCount} Agenda Non-Visit</p>
                      <p>• {excelSummary.stats.cutiCount + excelSummary.stats.offCount} Cuti & Off</p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <label className="text-[11px] font-bold text-emerald-950 flex items-center gap-1">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'merge'}
                          onChange={() => setImportMode('merge')}
                        />
                        Gabung
                      </label>
                      <label className="text-[11px] font-bold text-emerald-950 flex items-center gap-1">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                        />
                        Timpa Semua
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={handleExecuteImport}
                      className="w-full py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-black hover:bg-emerald-800 transition cursor-pointer"
                    >
                      Eksekusi Impor Sekarang
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Box 2: Master Store 610 Toko */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-black">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-800">
                    2. Master Toko (610 Cabang)
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500">
                    Database Koordinat & Info Toko
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Total Database</span>
                  <span className="text-xs font-black text-slate-900">{masterStores.length} Toko</span>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadMasterStores}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Master Toko (.xlsx)</span>
                </button>

                <p className="text-[11px] text-slate-500">
                  Data master toko memuat koordinat GPS presisi (Latitude, Longitude), Area Manager, dan Regional Manager.
                </p>
              </div>
            </div>

            {/* Box 3: Holding Time Standards (R23) */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-black">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-800">
                    3. Standar Holding Time R23
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500">
                    71 Produk & 9 Kategori Resmi
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowHoldingTimeModal(true)}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Lihat Standar Holding Time R23</span>
                </button>

                <p className="text-[11px] text-slate-500">
                  Nomor Dokumen: STD/FMI/PD-QC/001/R23. Mencakup seluruh parameter holding time makanan, minuman, dan bakery.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================
          MODAL: TAMBAH / EDIT AGENDA (Domain-Aware Smart Form)
          ============================================================ */}
      {isAgendaModalOpen && (
        <AgendaFormModal
          isOpen={isAgendaModalOpen}
          editingAgenda={editingAgenda}
          defaultDate={defaultDateForModal}
          users={users}
          masterStores={masterStores}
          onClose={() => {
            setIsAgendaModalOpen(false);
            setEditingAgenda(null);
          }}
          onSave={(saved) => {
            if (editingAgenda) {
              onUpdateAgenda(saved);
            } else {
              onAddAgenda(saved);
            }
            setIsAgendaModalOpen(false);
            setEditingAgenda(null);
          }}
        />
      )}

      {/* ============================================================
          MODAL: KONFIRMASI HAPUS AGENDA
          ============================================================ */}
      {deletingAgenda && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 shadow-xl border border-slate-200">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-black text-slate-900">Konfirmasi Hapus Agenda</h3>
              <p className="text-xs text-slate-500 mt-1">
                Apakah Anda yakin ingin menghapus agenda{' '}
                <strong className="text-slate-800">"{deletingAgenda.title}"</strong> ({deletingAgenda.date})? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAgenda(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteAgenda(deletingAgenda.id);
                  setDeletingAgenda(null);
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: PREVIEW LAPORAN VISIT PDF (Executive Mode)
          ============================================================ */}
      {previewingReport && (
        <ExecutiveReportPreviewModal
          isOpen={Boolean(previewingReport)}
          reportData={previewingReport}
          onClose={() => setPreviewingReport(null)}
        />
      )}

      {/* ============================================================
          MODAL: STANDAR HOLDING TIME R23
          ============================================================ */}
      {showHoldingTimeModal && (
        <HoldingTimeR23Modal
          isOpen={showHoldingTimeModal}
          onClose={() => setShowHoldingTimeModal(false)}
        />
      )}

      {/* Footer */}
      <DeveloperFooter />
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: AGENDA FORM MODAL (DOMAIN-AWARE)
// ============================================================================
interface AgendaFormModalProps {
  isOpen: boolean;
  editingAgenda: ScheduleAgenda | null;
  defaultDate?: string;
  users: User[];
  masterStores: MasterStore[];
  onClose: () => void;
  onSave: (agenda: ScheduleAgenda) => void;
}

const AgendaFormModal: React.FC<AgendaFormModalProps> = ({
  isOpen,
  editingAgenda,
  defaultDate,
  users,
  masterStores,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState(editingAgenda?.title || '');
  const [date, setDate] = useState(editingAgenda?.date || defaultDate || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(editingAgenda?.time || '08:00');
  const [endTime, setEndTime] = useState(editingAgenda?.endTime || '17:00');
  const [category, setCategory] = useState<ScheduleCategory>(editingAgenda?.category || 'VISIT');
  const [pic, setPic] = useState(editingAgenda?.pic || (users[0]?.name || ''));
  const [selectedStoreCode, setSelectedStoreCode] = useState(editingAgenda?.storeCode || '');
  const [customLocation, setCustomLocation] = useState(editingAgenda?.location || '');
  const [description, setDescription] = useState(editingAgenda?.description || '');
  const [completed, setCompleted] = useState(Boolean(editingAgenda?.completed));

  // Auto-detect if title is explicit visit
  const isVisitCategory = category === 'VISIT';

  // Handle store select
  const handleStoreChange = (code: string) => {
    setSelectedStoreCode(code);
    const store = masterStores.find((s) => s.code === code);
    if (store) {
      if (!title || title.startsWith('Visit ')) {
        setTitle(`Visit Toko ${store.name}`);
      }
      setCustomLocation(store.name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) {
      alert('Mohon isi Judul Agenda dan Tanggal');
      return;
    }

    const matchedStore = masterStores.find((s) => s.code === selectedStoreCode);

    const newAgenda: ScheduleAgenda = {
      id: editingAgenda?.id || `ag-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: title.trim(),
      date,
      time: time || '08:00',
      endTime: endTime || '17:00',
      category,
      location: matchedStore ? matchedStore.name : customLocation || 'Kantor Pusat',
      pic: pic || 'Unassigned',
      storeCode: matchedStore ? matchedStore.code : undefined,
      storeName: matchedStore ? matchedStore.name : undefined,
      storeType: matchedStore ? matchedStore.type : undefined,
      description: description.trim(),
      tags: [category.toLowerCase()],
      completed,
    };

    onSave(newAgenda);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 leading-none">
              {editingAgenda ? 'Edit Agenda Kerja' : 'Tambah Agenda Kerja Baru'}
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-1">
              FamilyMart Management Activity Form
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Row 1: Kategori Kegiatan */}
          <div>
            <label className="block font-black text-slate-700 mb-1">Jenis Kegiatan *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ScheduleCategory)}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none"
            >
              <option value="VISIT">🏪 Visit Toko Resmi (Wajib Presensi & Laporan QSC)</option>
              <option value="MEETING">🏢 Meeting / Rapat / Koordinasi</option>
              <option value="TRAINING">📚 Training / Coaching / Shadowing</option>
              <option value="OPERATION">🛠️ Operasional Toko / Maintenance / Opname</option>
              <option value="NSO">✨ NSO (New Store Opening)</option>
              <option value="AUDIT">🛡️ Audit Investigasi</option>
              <option value="WORK_PLAN">📋 Work Plan / Tugas Admin</option>
              <option value="CUTI">☕ Cuti / Izin / Sakit</option>
              <option value="OFF">💤 Off / Hari Libur</option>
            </select>
            {!isVisitCategory && (
              <p className="text-[11px] font-bold text-slate-500 mt-1">
                ℹ️ Agenda non-visit tidak mewajibkan check-in radius toko atau pembuatan laporan QSC.
              </p>
            )}
          </div>

          {/* Row 2: Store Picker (If Visit or Store Operation) */}
          {isVisitCategory ? (
            <div>
              <label className="block font-black text-slate-700 mb-1">Pilih Toko FMCU (Master 610 Toko) *</label>
              <select
                value={selectedStoreCode}
                onChange={(e) => handleStoreChange(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none"
              >
                <option value="">-- Pilih Toko FamilyMart --</option>
                {masterStores.map((s) => (
                  <option key={s.code} value={s.code}>
                    [{s.code}] {s.name} ({s.type || 'CVS'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block font-black text-slate-700 mb-1">Lokasi / Ruang / Keterangan Tempat</label>
              <input
                type="text"
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="Misal: Kantor Pusat, Ruang Meeting Lt. 3, atau Zoom Online"
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none"
              />
            </div>
          )}

          {/* Row 3: Judul Agenda */}
          <div>
            <label className="block font-black text-slate-700 mb-1">Judul Agenda Kegiatan *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Misal: Visit Store BDG R.E Martadinata atau Training Barista Batch 3"
              required
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none"
            />
          </div>

          {/* Row 4: Tanggal & Waktu */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-black text-slate-700 mb-1">Tanggal *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-black text-slate-700 mb-1">Mulai</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-black text-slate-700 mb-1">Selesai</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          {/* Row 5: PIC & Status */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-black text-slate-700 mb-1">Personil (PIC) *</label>
              <select
                value={pic}
                onChange={(e) => setPic(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none"
              >
                {users.map((u) => (
                  <option key={u.name} value={u.name}>
                    {u.name} ({u.role || 'Staff'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-black text-slate-700 mb-1">Status Selesai</label>
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={completed}
                  onChange={(e) => setCompleted(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>Tandai Selesai</span>
              </label>
            </div>
          </div>

          {/* Row 6: Deskripsi / Catatan */}
          <div>
            <label className="block font-black text-slate-700 mb-1">Catatan / Detail Instruksi</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Catatan tambahan, agenda pembahasan, atau poin fokus pemeriksaan..."
              rows={2}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-xs transition active:scale-95 cursor-pointer"
            >
              Simpan Agenda
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
