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
  Compass
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
  parseScheduleExcelSheet,
  exportScheduleToTemplateExcel,
  exportMasterStoresToExcel,
  ParsedExcelScheduleSummary,
} from '../../services/scheduleExcelService';

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

type AdminTab = 'agendas' | 'calendar' | 'analytics' | 'monitoring' | 'master-excel';
type ActivityDomain = 'STORE' | 'OFFICE' | 'LEAVE' | 'ALL';
type DateFilterPreset = 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL' | 'CUSTOM';

// Category Configuration & Domain Mapping
export const CATEGORY_DOMAINS: Record<ScheduleCategory, { domain: 'STORE' | 'OFFICE' | 'LEAVE'; label: string; color: string; bg: string; border: string }> = {
  VISIT: { domain: 'STORE', label: 'Visit Toko', color: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  NSO: { domain: 'STORE', label: 'NSO Toko Baru', color: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' },
  AUDIT: { domain: 'STORE', label: 'Audit Investigasi', color: 'text-purple-800', bg: 'bg-purple-50', border: 'border-purple-200' },
  OPERATION: { domain: 'STORE', label: 'Operasional Lapangan', color: 'text-teal-800', bg: 'bg-teal-50', border: 'border-teal-200' },
  MEETING: { domain: 'OFFICE', label: 'Meeting / Koordinasi', color: 'text-blue-800', bg: 'bg-blue-50', border: 'border-blue-200' },
  TRAINING: { domain: 'OFFICE', label: 'Training / Coaching', color: 'text-cyan-800', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  WORK_PLAN: { domain: 'OFFICE', label: 'Work Plan / Admin', color: 'text-indigo-800', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  CUTI: { domain: 'LEAVE', label: 'Cuti / Izin / Sakit', color: 'text-rose-800', bg: 'bg-rose-50', border: 'border-rose-200' },
  OFF: { domain: 'LEAVE', label: 'Off / Hari Libur', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
};

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
  // Navigation State
  const [activeTab, setActiveTab] = useState<AdminTab>('agendas');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedPic, setSelectedPic] = useState<string>('ALL');
  const [selectedDomain, setSelectedDomain] = useState<ActivityDomain>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Full Calendar State
  const [calendarDate, setCalendarDate] = useState(() => new Date());
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

  // Excel Schedule Import
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelSummary, setExcelSummary] = useState<ParsedExcelScheduleSummary | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Master Store Data
  const [masterStores, setMasterStores] = useState<MasterStore[]>(() => getMasterStores());
  const [storeSearchFilter, setStoreSearchFilter] = useState('');
  const [storeFeedback, setStoreFeedback] = useState<string | null>(null);
  const storeImportInputRef = useRef<HTMLInputElement>(null);

  // Holding Time Update
  const holdingImportInputRef = useRef<HTMLInputElement>(null);

  // Today Date String
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Fetch Cloud Visit Reports
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

  // Helper: Determine status of an agenda
  const getAgendaStatusInfo = (agenda: ScheduleAgenda) => {
    const meta = CATEGORY_DOMAINS[agenda.category] || CATEGORY_DOMAINS.VISIT;
    const isStore = meta.domain === 'STORE';
    const isLeave = meta.domain === 'LEAVE';

    if (isLeave) {
      return {
        domain: 'LEAVE' as const,
        code: 'LEAVE',
        label: agenda.category === 'CUTI' ? 'Cuti / Izin' : 'Off / Libur',
        badge: 'bg-rose-50 text-rose-800 border-rose-200',
        dot: 'bg-rose-400',
        needsVisitTracking: false,
        report: undefined,
      };
    }

    if (!isStore) {
      return {
        domain: 'OFFICE' as const,
        code: 'OFFICE',
        label: agenda.completed ? 'Selesai' : 'Terjadwal',
        badge: 'bg-blue-50 text-blue-800 border-blue-200',
        dot: 'bg-blue-500',
        needsVisitTracking: false,
        report: undefined,
      };
    }

    // Store Activities (Visit, NSO, Audit, Operation)
    const report =
      reportMap.get(agenda.id) ||
      (agenda.storeCode && agenda.date ? reportMap.get(`${agenda.storeCode}_${agenda.date}`) : undefined);

    const actualIn = agenda.actualIn || report?.actualIn;
    const actualOut = agenda.actualOut || report?.actualOut;
    const isSubmitted = report?.status === 'SUBMITTED' || agenda.completed;

    if (isSubmitted || (actualIn && actualOut)) {
      return {
        domain: 'STORE' as const,
        code: 'COMPLETED',
        label: 'Selesai Kunjungan',
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-500',
        needsVisitTracking: true,
        report,
      };
    }
    if (actualIn && !actualOut) {
      return {
        domain: 'STORE' as const,
        code: 'IN_PROGRESS',
        label: 'Di Toko (In-Progress)',
        badge: 'bg-amber-50 text-amber-800 border-amber-300',
        dot: 'bg-amber-500 animate-pulse',
        needsVisitTracking: true,
        report,
      };
    }
    return {
      domain: 'STORE' as const,
      code: 'SCHEDULED',
      label: 'Belum Check-In',
      badge: 'bg-slate-100 text-slate-600 border-slate-200',
      dot: 'bg-slate-400',
      needsVisitTracking: true,
      report,
    };
  };

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
  const filteredAgendas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return agendas.filter((item) => {
      // 1. Date Filter
      if (datePreset === 'TODAY' && item.date !== dateRangeBounds.today) return false;
      if (datePreset === 'TOMORROW' && item.date !== dateRangeBounds.tomorrow) return false;
      if (datePreset === 'THIS_WEEK') {
        if (item.date < dateRangeBounds.weekStart || item.date > dateRangeBounds.weekEnd) return false;
      }
      if (datePreset === 'THIS_MONTH') {
        if (item.date < dateRangeBounds.monthStart || item.date > dateRangeBounds.monthEnd) return false;
      }
      if (datePreset === 'CUSTOM') {
        if (customStartDate && item.date < customStartDate) return false;
        if (customEndDate && item.date > customEndDate) return false;
      }

      // 2. Domain Filter
      const catMeta = CATEGORY_DOMAINS[item.category] || CATEGORY_DOMAINS.VISIT;
      if (selectedDomain !== 'ALL' && catMeta.domain !== selectedDomain) {
        return false;
      }

      // 3. Category Filter
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }

      // 4. PIC Filter
      if (selectedPic !== 'ALL') {
        if (!item.pic || !item.pic.toLowerCase().includes(selectedPic.toLowerCase())) {
          return false;
        }
      }

      // 5. Query Search
      if (q) {
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchLocation = item.location?.toLowerCase().includes(q);
        const matchPic = item.pic?.toLowerCase().includes(q);
        const matchStoreCode = item.storeCode?.toLowerCase().includes(q);
        const matchStoreName = item.storeName?.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchLocation && !matchPic && !matchStoreCode && !matchStoreName && !matchDesc) {
          return false;
        }
      }

      return true;
    });
  }, [
    agendas,
    searchQuery,
    datePreset,
    customStartDate,
    customEndDate,
    selectedDomain,
    selectedCategory,
    selectedPic,
    dateRangeBounds,
  ]);

  // Sorted Agendas
  const sortedAgendas = useMemo(() => {
    return [...filteredAgendas].sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (a.time || '').localeCompare(b.time || '');
    });
  }, [filteredAgendas]);

  // High-Level Domain Statistics
  const domainStats = useMemo(() => {
    let storeTotal = 0;
    let storeCompleted = 0;
    let storeInProgress = 0;
    let storeSubmittedReports = 0;

    let officeTotal = 0;
    let leaveTotal = 0;

    const uniqueStores = new Set<string>();
    const uniquePics = new Set<string>();

    filteredAgendas.forEach((a) => {
      const st = getAgendaStatusInfo(a);
      if (a.pic) uniquePics.add(a.pic.trim());

      if (st.domain === 'STORE') {
        storeTotal++;
        if (a.storeCode) uniqueStores.add(a.storeCode);
        if (st.code === 'COMPLETED') storeCompleted++;
        if (st.code === 'IN_PROGRESS') storeInProgress++;
        if (st.report?.status === 'SUBMITTED') storeSubmittedReports++;
      } else if (st.domain === 'OFFICE') {
        officeTotal++;
      } else if (st.domain === 'LEAVE') {
        leaveTotal++;
      }
    });

    const storeCompletionRate = storeTotal > 0 ? Math.round((storeCompleted / storeTotal) * 100) : 0;

    return {
      totalAll: filteredAgendas.length,
      storeTotal,
      storeCompleted,
      storeInProgress,
      storeSubmittedReports,
      storeCompletionRate,
      officeTotal,
      leaveTotal,
      uniqueStores: uniqueStores.size,
      uniquePics: uniquePics.size,
    };
  }, [filteredAgendas, reportMap]);

  // Team Members List
  const allTeamMembers = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => u.name && set.add(u.name.trim()));
    agendas.forEach((a) => a.pic && set.add(a.pic.trim()));
    return Array.from(set).sort();
  }, [users, agendas]);

  // Team Productivity Leaderboard Matrix
  const teamMatrix = useMemo(() => {
    const map = new Map<
      string,
      {
        pic: string;
        total: number;
        storeVisits: number;
        completedVisits: number;
        officeCount: number;
        leaveCount: number;
        submittedReports: number;
      }
    >();

    filteredAgendas.forEach((a) => {
      const name = a.pic?.trim() || 'Unassigned';
      if (!map.has(name)) {
        map.set(name, {
          pic: name,
          total: 0,
          storeVisits: 0,
          completedVisits: 0,
          officeCount: 0,
          leaveCount: 0,
          submittedReports: 0,
        });
      }
      const entry = map.get(name)!;
      entry.total++;

      const st = getAgendaStatusInfo(a);
      if (st.domain === 'STORE') {
        entry.storeVisits++;
        if (st.code === 'COMPLETED') entry.completedVisits++;
        if (st.report?.status === 'SUBMITTED') entry.submittedReports++;
      } else if (st.domain === 'OFFICE') {
        entry.officeCount++;
      } else if (st.domain === 'LEAVE') {
        entry.leaveCount++;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.completedVisits - a.completedVisits || b.total - a.total);
  }, [filteredAgendas, reportMap]);

  // Full Month Calendar Matrix Generation
  const calendarMonthData = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon ...
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Monday First Index: Mon = 0, Tue = 1 ... Sun = 6
    const shift = (firstDayIndex + 6) % 7;

    const days: { day: number; dateStr: string; agendas: ScheduleAgenda[] }[] = [];

    for (let i = 1; i <= totalDays; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayAgendas = agendas.filter((a) => a.date === dateStr);
      days.push({ day: i, dateStr, agendas: dayAgendas });
    }

    return {
      year,
      month,
      monthName: calendarDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
      shift,
      days,
    };
  }, [calendarDate, agendas]);

  // Selected Calendar Day Agendas
  const selectedDayAgendas = useMemo(() => {
    return agendas.filter((a) => a.date === selectedCalendarDate).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [agendas, selectedCalendarDate]);

  // =========================================================================
  // RAW DATA EXTRACTION HANDLERS
  // =========================================================================
  const handleExportRawAgendas = () => {
    const headers = [
      'ID Agenda',
      'Tanggal',
      'Jam Mulai',
      'Jam Selesai',
      'Domain Kegiatan',
      'Kategori Agenda',
      'Personil (PIC)',
      'Kode Toko',
      'Nama Toko',
      'Tipe Toko',
      'Lokasi / Alamat',
      'Area Manager (AM)',
      'Regional Manager (RM)',
      'Status Visit',
      'Actual IN (WIB)',
      'Actual OUT (WIB)',
      'Kepatuhan Geofence',
      'Jarak Check-In (m)',
      'Status Laporan QSC',
      'URL Google Drive Laporan',
      'Catatan / Instruksi',
    ];

    const rows = filteredAgendas.map((a) => {
      const st = getAgendaStatusInfo(a);
      const rep = st.report;
      const actualIn = a.actualIn || rep?.actualIn || '-';
      const actualOut = a.actualOut || rep?.actualOut || '-';
      const geofence =
        actualIn !== '-'
          ? a.silentAudit?.inDistanceToStoreMeters !== undefined
            ? `${a.silentAudit.inDistanceToStoreMeters}m Terverifikasi`
            : 'Radius 1-50m Toko'
          : '-';

      return [
        a.id,
        a.date,
        a.time || '08:00',
        a.endTime || 'Selesai',
        st.domain === 'STORE' ? 'Kegiatan Toko' : st.domain === 'OFFICE' ? 'Kantor & Koordinasi' : 'Status Cuti / Libur',
        a.category,
        a.pic || 'Belum Ditugaskan',
        a.storeCode || '-',
        a.storeName || a.location || a.title,
        a.storeType || '-',
        a.location || '-',
        a.areaManager || '-',
        a.regionalManager || '-',
        st.label,
        actualIn,
        actualOut,
        geofence,
        a.silentAudit?.inDistanceToStoreMeters ?? '-',
        rep?.status || (st.domain === 'STORE' ? 'Belum Ada Laporan' : 'Tidak Butuh Laporan'),
        rep?.qscDriveUrl || '-',
        a.description || '-',
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Mentah Agenda');
    XLSX.writeFile(wb, `Laporan_Mentah_Seluruh_Agenda_FMCU_${todayIso}.xlsx`);
    setShowExportModal(false);
  };

  const handleExportRawReports = () => {
    const headers = [
      'ID Laporan',
      'Agenda ID',
      'Tanggal Visit',
      'Kode Toko',
      'Nama Toko',
      'Tipe Toko',
      'Visitor / Auditor',
      'Store Head',
      'Area Manager',
      'Regional Manager',
      'Actual IN',
      'Actual OUT',
      'Jumlah Temuan Observasi',
      'Jumlah Foto Bukti',
      'Status Laporan',
      'Waktu Submit',
      'Link PDF Google Drive',
      'Link Spreadsheet CA Toko',
    ];

    const rows = cloudReports.map((r) => [
      r.id,
      r.agendaId || '-',
      r.visitDate || '-',
      r.storeCode || '-',
      r.storeName || '-',
      r.storeType || '-',
      r.visitorName || '-',
      r.storeHead || '-',
      r.areaManager || '-',
      r.regionalManager || '-',
      r.actualIn || '-',
      r.actualOut || '-',
      r.observations?.length || 0,
      r.evidencePhotos?.length || 0,
      r.status || 'DRAFT',
      r.submittedAt || '-',
      r.qscDriveUrl || '-',
      r.spreadsheetUrl || '-',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Mentah Laporan QSC');
    XLSX.writeFile(wb, `Laporan_Mentah_Visit_QSC_FMCU_${todayIso}.xlsx`);
    setShowExportModal(false);
  };

  const handleExportTeamMatrix = () => {
    const headers = [
      'Peringkat',
      'Nama Personil (PIC)',
      'Total Agenda',
      'Total Kunjungan Toko',
      'Kunjungan Selesai',
      'Persentase Realisasi',
      'Meeting & Koordinasi',
      'Cuti / Off',
      'Laporan QSC Submit',
    ];

    const rows = teamMatrix.map((item, idx) => {
      const rate = item.storeVisits > 0 ? Math.round((item.completedVisits / item.storeVisits) * 100) : 0;
      return [
        idx + 1,
        item.pic,
        item.total,
        item.storeVisits,
        item.completedVisits,
        `${rate}%`,
        item.officeCount,
        item.leaveCount,
        item.submittedReports,
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekapitulasi Performa Tim');
    XLSX.writeFile(wb, `Rekapitulasi_Produktivitas_Tim_FMCU_${todayIso}.xlsx`);
    setShowExportModal(false);
  };

  const handleExportHoldingTimeExcel = () => {
    const headers = [
      'No',
      'Kategori',
      'Suhu Mesin / Display',
      'Nama Produk',
      'Standar Holding Time Resmi',
      'Thawing',
      'Shelf Life Setelah Thawing',
      'Cooking Spec',
      'Lokasi Penyimpanan',
      'Keterangan Khusus',
    ];

    const rows: any[] = [];
    let no = 1;
    holdingStandards.categories.forEach((cat) => {
      cat.items.forEach((item) => {
        rows.push([
          no++,
          cat.name,
          cat.machineTemp || '-',
          item.name,
          item.holding || '-',
          item.thawing || '-',
          item.shelfLife || '-',
          item.cooking || '-',
          item.storage || '-',
          item.keterangan || '-',
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Holding Time R23');
    XLSX.writeFile(wb, `Standar_Holding_Time_R23_FMCU_${todayIso}.xlsx`);
  };

  // =========================================================================
  // EXCEL SCHEDULE IMPORT HANDLERS
  // =========================================================================
  const handleExcelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    setIsParsingExcel(true);
    setImportFeedback(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const wb = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];

        const summary = parseScheduleExcelSheet(ws, firstSheetName, users);
        setExcelSummary(summary);
      } catch (err) {
        console.error('Excel parse error:', err);
        alert('Format file Excel tidak sesuai standar FMCU. Silakan unduh template resmi terlebih dahulu.');
      } finally {
        setIsParsingExcel(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCommitExcelImport = () => {
    if (!excelSummary || excelSummary.agendas.length === 0) return;

    onImportExcel(excelSummary.updatedUsers, excelSummary.agendas, importMode);
    setImportFeedback(
      `Berhasil memperbarui jadwal: ${excelSummary.agendas.length} agenda diimpor dengan mode [${
        importMode === 'replace' ? 'Gantikan Seluruh Jadwal' : 'Gabungkan (Merge)'
      }].`
    );
    setExcelFile(null);
    setExcelSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setActiveTab('agendas');
  };

  // Reset Holding Time to Default
  const handleResetHoldingTime = () => {
    if (confirm('Kembalikan Standar Holding Time ke default resmi R23 (QA & Product Improvement)?')) {
      saveHoldingTimeStandards(INITIAL_HOLDING_TIME_R23);
      setHoldingStandards(INITIAL_HOLDING_TIME_R23);
      alert('Standar Holding Time berhasil dikembalikan ke standar bawaan R23.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-900 flex flex-col font-sans select-none antialiased">
      {/* =========================================================================
          1. CORPORATE HEADER (Command Bar)
          ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs px-3 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand & Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[9.5px] font-black uppercase tracking-wider">
                  Admin Command Center
                </span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 hidden sm:inline">
                  ● Real-Time Cloud Sync
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">
                Pusat Kendali Operasional &amp; Seluruh Agenda Personil
              </h1>
            </div>
          </div>

          {/* Quick Header Tools */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Tarik Data Mentah Export Button */}
            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Tarik & Ekspor Data Mentah Operasional (.xlsx)"
            >
              <FolderDown className="w-3.5 h-3.5 stroke-[2.4]" />
              <span className="hidden md:inline">Tarik Data Mentah</span>
            </button>

            {/* Peta Toko Live Maps */}
            {onOpenLiveMaps && (
              <button
                type="button"
                onClick={onOpenLiveMaps}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Buka Peta Lokasi Toko"
              >
                <Compass className="w-3.5 h-3.5 text-teal-600" />
                <span className="hidden lg:inline">Peta Toko</span>
              </button>
            )}

            {/* Standar R23 Quick Pill */}
            <button
              type="button"
              onClick={() => setShowHoldingTimeModal(true)}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Pratinjau Standar Holding Time R23"
            >
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden lg:inline">Holding Time R23</span>
            </button>

            {/* Tampilan Kru / User */}
            <button
              type="button"
              onClick={onSwitchToUserView}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Pratinjau tampilan kru / staff lapangan"
            >
              <Eye className="w-3.5 h-3.5 text-teal-600" />
              <span className="hidden sm:inline">Tampilan Staff</span>
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={onLogout}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200/70 transition flex items-center justify-center cursor-pointer shadow-2xs"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. CLASSIFICATION HUB CARDS (Mengelompokkan Domain Kegiatan Terstruktur)
          ========================================================================= */}
      <section className="px-3 sm:px-6 pt-4 pb-2 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Card 1: Domain Kunjungan Toko (Visit, NSO, Audit) */}
          <div
            onClick={() => {
              setSelectedDomain(selectedDomain === 'STORE' ? 'ALL' : 'STORE');
              setSelectedCategory('ALL');
            }}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between shadow-2xs ${
              selectedDomain === 'STORE'
                ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-400/20'
                : 'bg-white hover:bg-slate-50 border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Kegiatan Toko</span>
              </span>
              <span className="text-[10.5px] font-extrabold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded">
                {domainStats.storeCompletionRate}% Selesai
              </span>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {domainStats.storeTotal}
                </span>
                <span className="text-xs text-slate-500 font-semibold">Tugas Lapangan</span>
              </div>
              <span className="text-[10.5px] text-slate-500 font-medium block mt-1">
                {domainStats.storeCompleted} Selesai • {domainStats.storeInProgress} di Toko • {domainStats.uniqueStores} Toko
              </span>
            </div>
          </div>

          {/* Card 2: Domain Kantor & Koordinasi (Meeting, Training, Work Plan) */}
          <div
            onClick={() => {
              setSelectedDomain(selectedDomain === 'OFFICE' ? 'ALL' : 'OFFICE');
              setSelectedCategory('ALL');
            }}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between shadow-2xs ${
              selectedDomain === 'OFFICE'
                ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-400/20'
                : 'bg-white hover:bg-slate-50 border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Kantor &amp; Koordinasi</span>
              </span>
              <span className="text-[10.5px] font-extrabold text-blue-700 bg-blue-100/80 px-1.5 py-0.2 rounded">
                Non-Toko
              </span>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {domainStats.officeTotal}
                </span>
                <span className="text-xs text-slate-500 font-semibold">Sesi Agenda</span>
              </div>
              <span className="text-[10.5px] text-slate-500 font-medium block mt-1">
                Meeting, Training, Work Plan &amp; Konsolidasi
              </span>
            </div>
          </div>

          {/* Card 3: Domain Ketersediaan Personil (Cuti & Off) */}
          <div
            onClick={() => {
              setSelectedDomain(selectedDomain === 'LEAVE' ? 'ALL' : 'LEAVE');
              setSelectedCategory('ALL');
            }}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between shadow-2xs ${
              selectedDomain === 'LEAVE'
                ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-400/20'
                : 'bg-white hover:bg-slate-50 border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                <Coffee className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Status Personil</span>
              </span>
              <span className="text-[10.5px] font-extrabold text-rose-700 bg-rose-100/80 px-1.5 py-0.2 rounded">
                Cuti &amp; Off
              </span>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {domainStats.leaveTotal}
                </span>
                <span className="text-xs text-slate-500 font-semibold">Jadwal Libur/Cuti</span>
              </div>
              <span className="text-[10.5px] text-slate-500 font-medium block mt-1">
                Ketersediaan &amp; presensi istirahat personil
              </span>
            </div>
          </div>

          {/* Card 4: Laporan Resmi Selesai Disubmit */}
          <div
            onClick={() => setActiveTab('monitoring')}
            className="p-3.5 sm:p-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/80 transition-all cursor-pointer flex flex-col justify-between shadow-2xs"
          >
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>Laporan QSC Submit</span>
              </span>
              <span className="text-[10.5px] font-extrabold text-teal-700 bg-teal-100/80 px-1.5 py-0.2 rounded">
                Official PDF
              </span>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-teal-700 tracking-tight">
                  {domainStats.storeSubmittedReports}
                </span>
                <span className="text-xs text-slate-500 font-semibold">Laporan Terarsip</span>
              </div>
              <span className="text-[10.5px] text-slate-500 font-medium block mt-1">
                Tersimpan di Google Drive &amp; Cloud Database
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. 5-PILLAR MAIN NAVIGATION TABS
          ========================================================================= */}
      <section className="px-3 sm:px-6 pt-2 pb-3 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-1 sm:gap-2 p-1.5 bg-slate-200/70 rounded-2xl overflow-x-auto no-scrollbar">
          {/* Tab 1: Seluruh Agenda */}
          <button
            type="button"
            onClick={() => setActiveTab('agendas')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'agendas'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarIcon className="w-4 h-4 text-emerald-600" />
            <span>Seluruh Agenda ({filteredAgendas.length})</span>
          </button>

          {/* Tab 2: Kalender Penuh */}
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarIcon className="w-4 h-4 text-blue-600" />
            <span>Kalender Penuh</span>
          </button>

          {/* Tab 3: Visual Analitik & Grafik */}
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-purple-600" />
            <span>Visual Analitik &amp; Grafik</span>
          </button>

          {/* Tab 4: Monitoring Lapangan & Laporan */}
          <button
            type="button"
            onClick={() => setActiveTab('monitoring')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'monitoring'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Monitoring Visit &amp; Laporan</span>
            {domainStats.storeInProgress > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">
                {domainStats.storeInProgress} live
              </span>
            )}
          </button>

          {/* Tab 5: Pusat Data & Kelola Excel */}
          <button
            type="button"
            onClick={() => setActiveTab('master-excel')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'master-excel'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-700" />
            <span>Pusat Data &amp; Sinkronisasi Excel</span>
          </button>
        </div>
      </section>

      {/* =========================================================================
          4. MAIN CONTENT AREA
          ========================================================================= */}
      <main className="flex-1 px-3 sm:px-6 pb-12 max-w-7xl mx-auto w-full space-y-4">
        {/* Feedback Alert Banner */}
        {importFeedback && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-2xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{importFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setImportFeedback(null)}
              className="text-emerald-700 hover:text-emerald-900 font-black cursor-pointer text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------------------
            TAB 1: SELURUH AGENDA (DATA TABLE & HIGH DENSITY MANAGEMENT)
            --------------------------------------------------------------------- */}
        {activeTab === 'agendas' && (
          <div className="space-y-3.5 animate-in fade-in">
            {/* Filter & Action Tool Bar */}
            <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-2xs space-y-3">
              {/* Row 1: Search & Date Presets */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari kode toko, nama toko, PIC, atau catatan..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-slate-200/80 text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Date Filter Presets */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 text-xs">
                  {(
                    [
                      { key: 'ALL', label: 'Semua Tanggal' },
                      { key: 'TODAY', label: 'Hari Ini' },
                      { key: 'TOMORROW', label: 'Besok' },
                      { key: 'THIS_WEEK', label: 'Minggu Ini' },
                      { key: 'THIS_MONTH', label: 'Bulan Ini' },
                      { key: 'CUSTOM', label: 'Rentang Tanggal' },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setDatePreset(p.key)}
                      className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer text-xs ${
                        datePreset === p.key
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Inputs if CUSTOM is active */}
              {datePreset === 'CUSTOM' && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-3 text-xs font-bold animate-in fade-in">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Mulai:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs text-slate-800"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Sampai:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs text-slate-800"
                    />
                  </div>
                  {(customStartDate || customEndDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomStartDate('');
                        setCustomEndDate('');
                      }}
                      className="text-rose-600 hover:underline text-[11px]"
                    >
                      Reset Rentang
                    </button>
                  )}
                </div>
              )}

              {/* Row 2: Secondary Dropdowns & Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Domain Selector */}
                  <select
                    value={selectedDomain}
                    onChange={(e) => {
                      setSelectedDomain(e.target.value as ActivityDomain);
                      setSelectedCategory('ALL');
                    }}
                    className="h-8.5 px-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="ALL">Semua Domain Kegiatan</option>
                    <option value="STORE">Kegiatan Toko (Visit, NSO, Audit)</option>
                    <option value="OFFICE">Kantor &amp; Koordinasi (Meeting, Training)</option>
                    <option value="LEAVE">Status Personil (Cuti &amp; Off)</option>
                  </select>

                  {/* Category Dropdown */}
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-8.5 px-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="ALL">Semua Kategori Detail</option>
                    <option value="VISIT">VISIT (Store Visit)</option>
                    <option value="NSO">NSO (New Store Opening)</option>
                    <option value="MEETING">MEETING</option>
                    <option value="AUDIT">AUDIT</option>
                    <option value="TRAINING">TRAINING</option>
                    <option value="WORK_PLAN">WORK PLAN</option>
                    <option value="OPERATION">OPERATIONAL</option>
                    <option value="CUTI">CUTI</option>
                    <option value="OFF">OFF / LIBUR</option>
                  </select>

                  {/* PIC Dropdown */}
                  <select
                    value={selectedPic}
                    onChange={(e) => setSelectedPic(e.target.value)}
                    className="h-8.5 px-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="ALL">Semua Personil ({allTeamMembers.length})</option>
                    {allTeamMembers.map((pic) => (
                      <option key={pic} value={pic}>
                        {pic}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowExportModal(true)}
                    className="h-8.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Ekspor data mentah ke Excel"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Ekspor Data Mentah</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingAgenda(null);
                      setDefaultDateForModal(undefined);
                      setIsAgendaModalOpen(true);
                    }}
                    className="h-8.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Tambah Jadwal</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Agendas List Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Menampilkan <b className="text-slate-800">{sortedAgendas.length}</b> agenda terklasifikasi
                </span>
                <span className="text-[11px] text-slate-400">
                  Data otomatis tersinkron ke Cloudflare D1 &amp; Google Drive
                </span>
              </div>

              {sortedAgendas.length === 0 ? (
                <div className="py-14 px-4 text-center space-y-2">
                  <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto" />
                  <h3 className="text-sm font-black text-slate-700">Tidak Ada Agenda Sesuai Filter</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Silakan ubah domain, kategori, atau preset tanggal di atas.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/75 border-b border-slate-200/80 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                        <th className="py-3 px-3.5">Tanggal &amp; Waktu</th>
                        <th className="py-3 px-3">Kategori &amp; Domain</th>
                        <th className="py-3 px-3">Kegiatan / Lokasi / Toko</th>
                        <th className="py-3 px-3">Personil (PIC)</th>
                        <th className="py-3 px-3">Status Pelaksanaan</th>
                        <th className="py-3 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {sortedAgendas.map((agenda) => {
                        const st = getAgendaStatusInfo(agenda);
                        const isToday = agenda.date === todayIso;
                        const catMeta = CATEGORY_DOMAINS[agenda.category] || CATEGORY_DOMAINS.VISIT;

                        return (
                          <tr
                            key={agenda.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isToday ? 'bg-emerald-50/25' : ''
                            }`}
                          >
                            {/* 1. Date & Time */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-slate-900">{agenda.date}</span>
                                {isToday && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-white text-[9px] font-black">
                                    Hari Ini
                                  </span>
                                )}
                              </div>
                              <span className="text-[10.5px] text-slate-400 font-mono">
                                {agenda.time || '08:00'} - {agenda.endTime || 'Selesai'}
                              </span>
                            </td>

                            {/* 2. Category & Domain */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-lg text-[10.5px] font-black uppercase tracking-tight border inline-block ${catMeta.bg} ${catMeta.color} ${catMeta.border}`}
                              >
                                {catMeta.label}
                              </span>
                            </td>

                            {/* 3. Description / Location / Store */}
                            <td className="py-3 px-3 min-w-[220px]">
                              <div className="flex items-center gap-1.5">
                                {st.domain === 'STORE' ? (
                                  <Store className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                ) : st.domain === 'OFFICE' ? (
                                  <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                ) : (
                                  <Coffee className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                )}
                                <span className="font-black text-slate-900 leading-snug">
                                  {agenda.storeName || agenda.location || agenda.title}
                                </span>
                                {agenda.storeCode && (
                                  <span className="px-1.5 py-0.2 rounded bg-slate-100 font-mono text-[10px] font-black text-slate-700 shrink-0">
                                    {agenda.storeCode}
                                  </span>
                                )}
                              </div>
                              {agenda.description && (
                                <span className="text-[10px] text-slate-500 block mt-0.5 truncate max-w-sm">
                                  {agenda.description}
                                </span>
                              )}
                            </td>

                            {/* 4. PIC */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-black text-[10px] flex items-center justify-center shrink-0">
                                  {(agenda.pic || 'U').charAt(0)}
                                </div>
                                <span className="font-bold text-slate-800">
                                  {agenda.pic || 'Belum Ditugaskan'}
                                </span>
                              </div>
                            </td>

                            {/* 5. Status Pelaksanaan */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="flex flex-col gap-0.5">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black border self-start ${st.badge}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                  <span>{st.label}</span>
                                </span>
                                {st.needsVisitTracking && (agenda.actualIn || st.report?.actualIn) && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    IN: {agenda.actualIn || st.report?.actualIn}
                                    {(agenda.actualOut || st.report?.actualOut) &&
                                      ` • OUT: ${agenda.actualOut || st.report?.actualOut}`}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* 6. Actions */}
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {st.report && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewingReport(st.report!)}
                                    className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 transition cursor-pointer"
                                    title="Pratinjau Hasil Laporan Visit"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAgenda(agenda);
                                    setIsAgendaModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                  title="Edit Agenda"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDeletingAgenda(agenda)}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition cursor-pointer"
                                  title="Hapus Agenda"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------------
            TAB 2: KALENDER PENUH (FULL INTERACTIVE MONTH CALENDAR)
            --------------------------------------------------------------------- */}
        {activeTab === 'calendar' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Calendar Month Header & Navigation */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-black">
                  <CalendarIcon className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 capitalize">
                    {calendarMonthData.monthName}
                  </h2>
                  <span className="text-xs text-slate-500 font-medium">
                    Kalender Seluruh Jadwal Tim Lapangan &amp; Kantor
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const prev = new Date(calendarDate);
                    prev.setMonth(prev.getMonth() - 1);
                    setCalendarDate(prev);
                  }}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  title="Bulan Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setCalendarDate(now);
                    setSelectedCalendarDate(todayIso);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-black transition cursor-pointer"
                >
                  Bulan Ini
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = new Date(calendarDate);
                    next.setMonth(next.getMonth() + 1);
                    setCalendarDate(next);
                  }}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  title="Bulan Berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Calendar Grid & Detail Drawer Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Full Month Grid (2 Cols on Desktop) */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden p-3 sm:p-4 space-y-2">
                {/* Day Header Row */}
                <div className="grid grid-cols-7 text-center text-[11px] font-black text-slate-400 uppercase py-1 border-b border-slate-100">
                  <span>Sen</span>
                  <span>Sel</span>
                  <span>Rab</span>
                  <span>Kam</span>
                  <span>Jum</span>
                  <span className="text-rose-500">Sab</span>
                  <span className="text-rose-600">Min</span>
                </div>

                {/* Day Cells Matrix */}
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5 auto-rows-fr">
                  {/* Empty Shift Cells */}
                  {Array.from({ length: calendarMonthData.shift }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[72px] sm:min-h-[90px] rounded-xl bg-slate-50/50 p-1" />
                  ))}

                  {/* Month Day Cells */}
                  {calendarMonthData.days.map(({ day, dateStr, agendas: dayAgendas }) => {
                    const isSelected = dateStr === selectedCalendarDate;
                    const isToday = dateStr === todayIso;

                    return (
                      <div
                        key={dateStr}
                        onClick={() => setSelectedCalendarDate(dateStr)}
                        className={`min-h-[72px] sm:min-h-[90px] rounded-xl p-1.5 border transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-400/30'
                            : isToday
                            ? 'bg-emerald-50/50 border-emerald-300'
                            : 'bg-white hover:bg-slate-50 border-slate-200/70'
                        }`}
                      >
                        {/* Day Number */}
                        <div className="flex items-center justify-between">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                              isToday
                                ? 'bg-emerald-600 text-white'
                                : isSelected
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-800'
                            }`}
                          >
                            {day}
                          </span>
                          {dayAgendas.length > 0 && (
                            <span className="text-[10px] font-bold text-slate-400">
                              {dayAgendas.length}
                            </span>
                          )}
                        </div>

                        {/* Micro Chips */}
                        <div className="space-y-0.5 mt-1 overflow-hidden">
                          {dayAgendas.slice(0, 2).map((a) => {
                            const meta = CATEGORY_DOMAINS[a.category] || CATEGORY_DOMAINS.VISIT;
                            return (
                              <div
                                key={a.id}
                                className={`px-1 py-0.2 rounded text-[9px] font-bold truncate ${meta.bg} ${meta.color}`}
                                title={`${a.category}: ${a.storeName || a.title} (${a.pic})`}
                              >
                                {a.category}: {a.storeCode || a.pic}
                              </div>
                            );
                          })}
                          {dayAgendas.length > 2 && (
                            <span className="text-[8.5px] font-bold text-slate-400 block truncate">
                              +{dayAgendas.length - 2} lagi
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Day Detail Panel (1 Col on Desktop) */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Agenda Terpilih
                      </span>
                      <h3 className="text-sm font-black text-slate-900">
                        {new Date(selectedCalendarDate + 'T00:00:00').toLocaleDateString('id-ID', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAgenda(null);
                        setDefaultDateForModal(selectedCalendarDate);
                        setIsAgendaModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition cursor-pointer"
                      title="Tambah jadwal di tanggal ini"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>

                  {/* Day Agenda Items */}
                  <div className="space-y-2 max-h-[460px] overflow-y-auto no-scrollbar">
                    {selectedDayAgendas.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 space-y-1.5">
                        <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs">Tidak ada agenda pada tanggal ini.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAgenda(null);
                            setDefaultDateForModal(selectedCalendarDate);
                            setIsAgendaModalOpen(true);
                          }}
                          className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                        >
                          + Tambah Agenda
                        </button>
                      </div>
                    ) : (
                      selectedDayAgendas.map((item) => {
                        const st = getAgendaStatusInfo(item);
                        const meta = CATEGORY_DOMAINS[item.category] || CATEGORY_DOMAINS.VISIT;

                        return (
                          <div
                            key={item.id}
                            className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9.5px] font-black uppercase tracking-tight ${meta.bg} ${meta.color}`}
                              >
                                {meta.label}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {item.time || '08:00'} - {item.endTime || 'Selesai'}
                              </span>
                            </div>

                            <div>
                              <h4 className="text-xs font-black text-slate-900 leading-snug">
                                {item.storeName || item.location || item.title}
                              </h4>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                                <span className="font-bold text-slate-700">{item.pic || 'Belum Ditugaskan'}</span>
                                {item.storeCode && <span>• Kode: {item.storeCode}</span>}
                              </div>
                            </div>

                            {/* Status and Action Strip */}
                            <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                              <span className={`inline-flex items-center gap-1 font-bold ${st.code === 'COMPLETED' ? 'text-emerald-700' : 'text-slate-600'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                <span>{st.label}</span>
                              </span>

                              <div className="flex items-center gap-1">
                                {st.report && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewingReport(st.report!)}
                                    className="p-1 text-teal-700 hover:bg-teal-100 rounded"
                                    title="Lihat Laporan"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAgenda(item);
                                    setIsAgendaModalOpen(true);
                                  }}
                                  className="p-1 text-slate-600 hover:bg-slate-200 rounded"
                                  title="Edit"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingAgenda(item)}
                                  className="p-1 text-rose-600 hover:bg-rose-100 rounded"
                                  title="Hapus"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 text-center">
                  Total {selectedDayAgendas.length} agenda di tanggal ini
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------------
            TAB 3: VISUAL ANALITIK & GRAFIK OPERASIONAL
            --------------------------------------------------------------------- */}
        {activeTab === 'analytics' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Top Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Distribution Chart Bar */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <PieChart className="w-4 h-4 text-emerald-600" />
                    <span>Distribusi Kegiatan</span>
                  </h3>
                  <span className="text-[11px] font-bold text-slate-400">
                    {filteredAgendas.length} Total
                  </span>
                </div>

                {/* Stacked Progress Bar */}
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    style={{
                      width: `${filteredAgendas.length > 0 ? (domainStats.storeTotal / filteredAgendas.length) * 100 : 0}%`,
                    }}
                    className="bg-emerald-500 h-full"
                    title={`Kegiatan Toko: ${domainStats.storeTotal}`}
                  />
                  <div
                    style={{
                      width: `${filteredAgendas.length > 0 ? (domainStats.officeTotal / filteredAgendas.length) * 100 : 0}%`,
                    }}
                    className="bg-blue-500 h-full"
                    title={`Kantor & Koordinasi: ${domainStats.officeTotal}`}
                  />
                  <div
                    style={{
                      width: `${filteredAgendas.length > 0 ? (domainStats.leaveTotal / filteredAgendas.length) * 100 : 0}%`,
                    }}
                    className="bg-rose-400 h-full"
                    title={`Cuti & Libur: ${domainStats.leaveTotal}`}
                  />
                </div>

                {/* Legend Breakdown */}
                <div className="space-y-1.5 text-xs pt-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>Kegiatan Toko (Visit / NSO / Audit)</span>
                    </span>
                    <span className="font-black text-slate-900">{domainStats.storeTotal}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span>Kantor &amp; Koordinasi (Meeting/Train)</span>
                    </span>
                    <span className="font-black text-slate-900">{domainStats.officeTotal}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                      <span>Status Personil (Cuti / Libur Off)</span>
                    </span>
                    <span className="font-black text-slate-900">{domainStats.leaveTotal}</span>
                  </div>
                </div>
              </div>

              {/* Realisasi Kunjungan Gauge */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-teal-600" />
                    <span>Tingkat Realisasi Kunjungan</span>
                  </h3>
                  <span className="text-xs font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                    {domainStats.storeCompletionRate}% Target
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${domainStats.storeCompletionRate}%` }}
                      className="bg-teal-500 h-full rounded-full transition-all duration-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    <b className="text-slate-800">{domainStats.storeCompleted}</b> dari total{' '}
                    <b className="text-slate-800">{domainStats.storeTotal}</b> kunjungan toko telah selesai dilaksanakan oleh tim.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Sedang di Toko</span>
                    <span className="text-base font-black text-amber-600">{domainStats.storeInProgress} Kru</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Laporan Submit</span>
                    <span className="text-base font-black text-teal-700">{domainStats.storeSubmittedReports} Dokumen</span>
                  </div>
                </div>
              </div>

              {/* Master Data Metrics */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-purple-600" />
                    <span>Cakupan Toko &amp; Tim</span>
                  </h3>
                  <span className="text-xs font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                    610 Cabang
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block">Toko Terkunjungi</span>
                    <span className="text-lg font-black text-slate-900 block mt-0.5">
                      {domainStats.uniqueStores} <span className="text-xs text-slate-500">Cabang</span>
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block">Personil On-Duty</span>
                    <span className="text-lg font-black text-slate-900 block mt-0.5">
                      {domainStats.uniquePics} <span className="text-xs text-slate-500">Staff</span>
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500">
                  Total database resmi: <b className="text-slate-800">{masterStores.length}</b> toko di seluruh wilayah operasional.
                </div>
              </div>
            </div>

            {/* Team Productivity Matrix Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span>Rekapitulasi Produktivitas Seluruh Personil</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Breakdown aktivitas per personil mencakup kunjungan toko, koordinasi kantor, dan kepatuhan submit laporan.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportTeamMatrix}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Download Rekap (.xlsx)</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/75 border-b border-slate-200/80 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-3.5">Peringkat &amp; Nama Personil</th>
                      <th className="py-3 px-3 text-center">Total Agenda</th>
                      <th className="py-3 px-3 text-center">Visit Toko</th>
                      <th className="py-3 px-3 text-center">Realisasi Selesai</th>
                      <th className="py-3 px-3 text-center">% Realisasi</th>
                      <th className="py-3 px-3 text-center">Kantor &amp; Meeting</th>
                      <th className="py-3 px-3 text-center">Cuti &amp; Libur</th>
                      <th className="py-3 px-3 text-right">Laporan Submit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {teamMatrix.map((item, idx) => {
                      const rate = item.storeVisits > 0 ? Math.round((item.completedVisits / item.storeVisits) * 100) : 0;
                      return (
                        <tr key={item.pic} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-700 font-black text-[10px] flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span className="font-black text-slate-900">{item.pic}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-800">{item.total}</td>
                          <td className="py-3 px-3 text-center font-black text-emerald-800">{item.storeVisits}</td>
                          <td className="py-3 px-3 text-center font-black text-emerald-600">{item.completedVisits}</td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div style={{ width: `${rate}%` }} className="bg-emerald-500 h-full rounded-full" />
                              </div>
                              <span className="font-bold text-[11px] text-slate-700">{rate}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center text-blue-700 font-bold">{item.officeCount}</td>
                          <td className="py-3 px-3 text-center text-rose-600 font-bold">{item.leaveCount}</td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-black text-[10.5px]">
                              {item.submittedReports} Dokumen
                            </span>
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

        {/* ---------------------------------------------------------------------
            TAB 4: MONITORING VISIT LAPANGAN & LAPORAN RESMI
            --------------------------------------------------------------------- */}
        {activeTab === 'monitoring' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Header Tools */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-600 stroke-[2.4]" />
                  <span>Monitoring Actual Visit Toko &amp; Arsip Laporan QSC</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Khusus kegiatan kunjungan toko: verifikasi jam Actual IN/OUT, kepatuhan radius geofence, dan pratinjau PDF laporan resmi.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleExportRawReports}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Ekspor Laporan (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={loadReports}
                  disabled={isLoadingReports}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReports ? 'animate-spin' : ''}`} />
                  <span>Segarkan</span>
                </button>
              </div>
            </div>

            {/* Visit Monitoring Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/75 border-b border-slate-200/80 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-3.5">Personil (PIC)</th>
                      <th className="py-3 px-3">Toko Tujuan</th>
                      <th className="py-3 px-3">Jadwal (Plan)</th>
                      <th className="py-3 px-3">Actual IN (WIB)</th>
                      <th className="py-3 px-3">Actual OUT (WIB)</th>
                      <th className="py-3 px-3">Geofence Radius</th>
                      <th className="py-3 px-3">Status Laporan</th>
                      <th className="py-3 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {sortedAgendas
                      .filter((a) => (CATEGORY_DOMAINS[a.category] || CATEGORY_DOMAINS.VISIT).domain === 'STORE')
                      .map((agenda) => {
                        const st = getAgendaStatusInfo(agenda);
                        const rep = st.report;
                        const actualInTime = agenda.actualIn || rep?.actualIn;
                        const actualOutTime = agenda.actualOut || rep?.actualOut;
                        const distMeters = agenda.silentAudit?.inDistanceToStoreMeters;

                        return (
                          <tr key={agenda.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className="font-black text-slate-900 block">{agenda.pic || 'Belum Ditugaskan'}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{agenda.date}</span>
                            </td>

                            <td className="py-3 px-3 min-w-[200px]">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900">{agenda.storeName || agenda.location || agenda.title}</span>
                                {agenda.storeCode && (
                                  <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-black text-slate-600 font-mono">
                                    {agenda.storeCode}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block mt-0.5">{agenda.location || 'Bandung'}</span>
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-600">
                              {agenda.time || '08:00'} - {agenda.endTime || 'Selesai'}
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              {actualInTime ? (
                                <div className="flex items-center gap-1.5 text-emerald-800 font-mono font-black">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                  <span>{actualInTime}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Belum Check-In</span>
                              )}
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              {actualOutTime ? (
                                <div className="flex items-center gap-1.5 text-teal-800 font-mono font-black">
                                  <span className="w-2 h-2 rounded-full bg-teal-500" />
                                  <span>{actualOutTime}</span>
                                </div>
                              ) : actualInTime ? (
                                <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full text-[10px]">
                                  Sedang di Toko
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">-</span>
                              )}
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              {actualInTime ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                  <span>
                                    {distMeters !== undefined ? `${distMeters}m Terverifikasi` : 'Radius 1–50m Toko'}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">-</span>
                              )}
                            </td>

                            <td className="py-3 px-3 whitespace-nowrap">
                              {rep ? (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    rep.status === 'SUBMITTED'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                                  }`}
                                >
                                  {rep.status || 'DRAFT'}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[10.5px]">Belum Submit</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              {rep ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewingReport(rep)}
                                  className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-extrabold text-[10.5px] transition flex items-center gap-1 cursor-pointer ml-auto"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Lihat PDF</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[10.5px]">-</span>
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

        {/* ---------------------------------------------------------------------
            TAB 5: PUSAT DATA & SINKRONISASI EXCEL (JADWAL, 610 TOKO, R23)
            --------------------------------------------------------------------- */}
        {activeTab === 'master-excel' && (
          <div className="space-y-4 animate-in fade-in">
            {/* 3 Modular Cards: Jadwal, 610 Master Toko, Holding Time R23 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Dataset 1: Jadwal Agenda */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CalendarIcon className="w-5 h-5 stroke-[2.2]" />
                    <h3 className="text-sm sm:text-base font-black text-slate-900">
                      1. Dataset Jadwal Agenda
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Unggah atau ekspor seluruh jadwal kegiatan tim (Visit, NSO, Meeting, Training, dan Cuti/Libur).
                  </p>
                </div>

                {/* Upload Button & Template */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Jadwal Excel (.xlsx)</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelFileSelect}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => exportScheduleToTemplateExcel([], users, 'ALL', 'Template FMCU')}
                    className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Download Template Jadwal Resmi</span>
                  </button>
                </div>
              </div>

              {/* Dataset 2: 610 Master Toko */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-teal-700">
                    <Store className="w-5 h-5 stroke-[2.2]" />
                    <h3 className="text-sm sm:text-base font-black text-slate-900">
                      2. Database 610 Master Toko
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Database 610 cabang resmi FamilyMart Indonesia lengkap dengan AM, RM, koordinat GPS, dan tipe toko.
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => exportMasterStoresToExcel()}
                    className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export 610 Toko ke Excel (.xlsx)</span>
                  </button>

                  <div className="text-[11px] text-slate-500 text-center">
                    Terverifikasi: 610 Master Stores aktif
                  </div>
                </div>
              </div>

              {/* Dataset 3: Standar Holding Time R23 */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-700">
                    <Clock className="w-5 h-5 stroke-[2.2]" />
                    <h3 className="text-sm sm:text-base font-black text-slate-900">
                      3. Standar Holding Time R23
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    STD/FMI/PD-QC/001/R23 — Acuan resmi QA &amp; Product Improvement mencakup 9 kategori dan 71 produk display.
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleExportHoldingTimeExcel}
                    className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Standar R23 (.xlsx)</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setShowHoldingTimeModal(true)}
                      className="py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer text-center"
                    >
                      Pratinjau R23
                    </button>
                    <button
                      type="button"
                      onClick={handleResetHoldingTime}
                      className="py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-bold text-xs transition cursor-pointer text-center"
                    >
                      Reset Default
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Parsed Excel Preview Drawer if file selected */}
            {excelSummary && (
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3.5 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="text-sm font-black text-slate-900">
                        Pratinjau Impor Excel: {excelSummary.sheetName}
                      </h4>
                      <span className="text-xs text-slate-500">
                        {excelSummary.agendas.length} agenda berhasil diverifikasi dari file
                      </span>
                    </div>
                  </div>
                </div>

                {/* Breakdown Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block">Visit Toko</span>
                    <span className="text-base font-black text-slate-900 mt-0.5 block">{excelSummary.stats.visitCount}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block">NSO</span>
                    <span className="text-base font-black text-slate-900 mt-0.5 block">{excelSummary.stats.nsoCount}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block">Toko Cocok</span>
                    <span className="text-base font-black text-emerald-600 mt-0.5 block">{excelSummary.stats.matchedStoresCount}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-bold block">Personil Cocok</span>
                    <span className="text-base font-black text-teal-600 mt-0.5 block">{excelSummary.stats.matchedUsersCount}</span>
                  </div>
                </div>

                {/* Import Mode Radio */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="text-xs font-black text-slate-700 block">Pilih Mode Impor:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-start gap-2.5 ${
                        importMode === 'merge' ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="block font-black">Gabungkan (Merge)</span>
                        <span className="text-[10.5px] font-normal opacity-80 block">
                          Menambahkan jadwal baru ke jadwal yang sudah ada tanpa menghapus jadwal sebelumnya.
                        </span>
                      </div>
                    </label>

                    <label
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-start gap-2.5 ${
                        importMode === 'replace' ? 'bg-amber-50/70 border-amber-300 text-amber-950 font-bold' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="block font-black">Gantikan Seluruh Jadwal (Replace)</span>
                        <span className="text-[10.5px] font-normal opacity-80 block">
                          Menghapus jadwal lama dan menggantikannya dengan jadwal dari file ini.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setExcelSummary(null)}
                    className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleCommitExcelImport}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition cursor-pointer shadow-xs"
                  >
                    Konfirmasi &amp; Simpan ke Cloud
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* =========================================================================
          5. MODAL FORM: TAMBAH / EDIT AGENDA
          ========================================================================= */}
      {isAgendaModalOpen && (
        <AgendaFormModal
          isOpen={isAgendaModalOpen}
          initialData={editingAgenda}
          defaultDate={defaultDateForModal}
          allUsers={users}
          masterStores={masterStores}
          onClose={() => {
            setIsAgendaModalOpen(false);
            setEditingAgenda(null);
            setDefaultDateForModal(undefined);
          }}
          onSave={(saved) => {
            if (editingAgenda) {
              onUpdateAgenda(saved);
            } else {
              onAddAgenda(saved);
            }
            setIsAgendaModalOpen(false);
            setEditingAgenda(null);
            setDefaultDateForModal(undefined);
          }}
        />
      )}

      {/* =========================================================================
          6. MODAL KONFIRMASI HAPUS AGENDA
          ========================================================================= */}
      {deletingAgenda && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in select-none">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">Hapus Agenda Jadwal?</h3>
              <p className="text-xs text-slate-500">
                Apakah Anda yakin ingin menghapus jadwal untuk{' '}
                <b className="text-slate-800">{deletingAgenda.storeName || deletingAgenda.location}</b> ({deletingAgenda.date}) oleh personil{' '}
                <b className="text-slate-800">{deletingAgenda.pic}</b>?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAgenda(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deletingAgenda) {
                    onDeleteAgenda(deletingAgenda.id);
                    setDeletingAgenda(null);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition cursor-pointer shadow-xs"
              >
                Hapus Jadwal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          7. MODAL TARIK DATA MENTAH EXPORT ENGINE
          ========================================================================= */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in select-none">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <FolderDown className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  Pusat Tarik Data Mentah
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Pilih jenis laporan mentah berformat Excel (*.xlsx) yang ingin Anda unduh untuk keperluan analisis, rekap, atau arsip audit:
            </p>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleExportRawAgendas}
                className="w-full p-3 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-200 text-left transition flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="text-xs font-black text-emerald-950 block">
                    1. Data Mentah Seluruh Agenda
                  </span>
                  <span className="text-[10.5px] text-emerald-700 block mt-0.5">
                    Mencakup kolom waktu, PIC, toko, koordinat, presensi IN/OUT, &amp; geofence
                  </span>
                </div>
                <Download className="w-4 h-4 text-emerald-700 shrink-0" />
              </button>

              <button
                type="button"
                onClick={handleExportRawReports}
                className="w-full p-3 rounded-2xl bg-teal-50/70 hover:bg-teal-100/80 border border-teal-200 text-left transition flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="text-xs font-black text-teal-950 block">
                    2. Data Mentah Laporan Visit &amp; QSC
                  </span>
                  <span className="text-[10.5px] text-teal-700 block mt-0.5">
                    Mencakup skor temuan, foto bukti, link Google Drive PDF, dan status submit
                  </span>
                </div>
                <Download className="w-4 h-4 text-teal-700 shrink-0" />
              </button>

              <button
                type="button"
                onClick={handleExportTeamMatrix}
                className="w-full p-3 rounded-2xl bg-purple-50/70 hover:bg-purple-100/80 border border-purple-200 text-left transition flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="text-xs font-black text-purple-950 block">
                    3. Rekapitulasi Performa Tim
                  </span>
                  <span className="text-[10.5px] text-purple-700 block mt-0.5">
                    Matriks jumlah kunjungan, % realisasi, meeting, dan ketersediaan personil
                  </span>
                </div>
                <Download className="w-4 h-4 text-purple-700 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          8. MODAL PRATINJAU LAPORAN VISIT PDF (EXECUTIVE SUITE)
          ========================================================================= */}
      {previewingReport && (
        <ExecutiveReportPreviewModal
          isOpen={Boolean(previewingReport)}
          onClose={() => setPreviewingReport(null)}
          reportData={previewingReport}
          gdrivePdfUrl={previewingReport.qscDriveUrl}
          storeFolderName={previewingReport.storeName}
        />
      )}

      {/* =========================================================================
          9. MODAL STANDAR HOLDING TIME R23
          ========================================================================= */}
      {showHoldingTimeModal && (
        <HoldingTimeR23Modal
          isOpen={showHoldingTimeModal}
          onClose={() => setShowHoldingTimeModal(false)}
        />
      )}

      {/* Footer */}
      <DeveloperFooter className="py-6 border-t border-slate-200/80 bg-white" />
    </div>
  );
};

// =============================================================================
// SUB-COMPONENT: MODAL FORM TAMBAH / EDIT AGENDA LENGKAP
// =============================================================================
interface AgendaFormModalProps {
  isOpen: boolean;
  initialData: ScheduleAgenda | null;
  defaultDate?: string;
  allUsers: User[];
  masterStores: MasterStore[];
  onClose: () => void;
  onSave: (agenda: ScheduleAgenda) => void;
}

const AgendaFormModal: React.FC<AgendaFormModalProps> = ({
  isOpen,
  initialData,
  defaultDate,
  allUsers,
  masterStores,
  onClose,
  onSave,
}) => {
  const [storeSearch, setStoreSearch] = useState('');
  const [selectedStore, setSelectedStore] = useState<MasterStore | null>(null);

  const [date, setDate] = useState(
    initialData?.date || defaultDate || new Date().toISOString().split('T')[0]
  );
  const [time, setTime] = useState(initialData?.time || '08:00');
  const [endTime, setEndTime] = useState(initialData?.endTime || '17:00');
  const [category, setCategory] = useState<ScheduleCategory>(initialData?.category || 'VISIT');
  const [pic, setPic] = useState(initialData?.pic || (allUsers[0]?.name || ''));
  const [description, setDescription] = useState(initialData?.description || '');
  const [customLocation, setCustomLocation] = useState(initialData?.location || '');

  // Detect domain of selected category
  const currentDomain = (CATEGORY_DOMAINS[category] || CATEGORY_DOMAINS.VISIT).domain;
  const isStoreActivity = currentDomain === 'STORE';

  // Initialize store if editing
  useEffect(() => {
    if (initialData?.storeCode) {
      const match = findMasterStoreByCodeOrName(initialData.storeCode);
      if (match) setSelectedStore(match);
    }
  }, [initialData]);

  // Filtered Store Options (Top 12)
  const filteredStores = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return masterStores.slice(0, 10);
    return masterStores
      .filter((s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [masterStores, storeSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let storeName: string | undefined = undefined;
    let storeCode: string | undefined = undefined;
    let storeType: string | undefined = undefined;
    let location = customLocation;
    let title = `${category}`;

    if (isStoreActivity) {
      storeName = selectedStore?.name || initialData?.storeName || 'Store FamilyMart';
      storeCode = selectedStore?.code || initialData?.storeCode || '3000';
      storeType = selectedStore?.type || initialData?.storeType || 'CVS';
      location = selectedStore ? `${selectedStore.name} (${selectedStore.city})` : location || storeName;
      title = `${category}: ${storeName}`;
    } else {
      title = customLocation ? `${category}: ${customLocation}` : `${category} Personil`;
    }

    const savedAgenda: ScheduleAgenda = {
      id: initialData?.id || `agenda-${Date.now()}`,
      title,
      date,
      time,
      endTime,
      category,
      pic,
      location: location || 'Bandung',
      storeCode,
      storeName,
      storeType,
      areaManager: selectedStore?.areaManager || initialData?.areaManager || '',
      regionalManager: selectedStore?.regionalManager || initialData?.regionalManager || '',
      description,
      tags: [category, storeType || 'NON_STORE'],
    };

    onSave(savedAgenda);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in select-none">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
              <CalendarIcon className="w-4 h-4 stroke-[2.4]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                {initialData ? 'Edit Agenda Jadwal' : 'Tambah Agenda Baru'}
              </h3>
              <span className="text-[10.5px] text-slate-400">
                Mencakup kegiatan toko, koordinasi kantor, dan cuti/libur
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-3.5 text-xs">
          {/* Category Dropdown (Domain-aware) */}
          <div>
            <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
              Kategori Agenda *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ScheduleCategory)}
              className="w-full py-2 px-2.5 rounded-xl bg-slate-100 border border-slate-200 font-bold text-xs text-slate-800 outline-none focus:bg-white cursor-pointer"
            >
              <optgroup label="🏪 Kegiatan Lapangan (Memerlukan Toko & Check-In)">
                <option value="VISIT">VISIT (Store Visit Reguler)</option>
                <option value="NSO">NSO (New Store Opening)</option>
                <option value="AUDIT">AUDIT (Investigasi / Audit Khusus)</option>
                <option value="OPERATION">OPERATIONAL (Dukungan Operasional Toko)</option>
              </optgroup>
              <optgroup label="🏢 Kegiatan Kantor & Koordinasi (Non-Toko)">
                <option value="MEETING">MEETING (Koordinasi / Rapat Area)</option>
                <option value="TRAINING">TRAINING (Pelatihan / Coaching)</option>
                <option value="WORK_PLAN">WORK PLAN (Penyusunan Rencana Kerja)</option>
              </optgroup>
              <optgroup label="🏖️ Status Ketersediaan Personil">
                <option value="CUTI">CUTI (Cuti Tahunan / Izin / Sakit)</option>
                <option value="OFF">OFF (Hari Libur Reguler)</option>
              </optgroup>
            </select>
          </div>

          {/* Conditional Store Picker (Only if Store Activity) */}
          {isStoreActivity ? (
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                Toko FMCU (610 Cabang Resmi) *
              </label>
              {selectedStore ? (
                <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Store className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-black text-emerald-950 block truncate">
                        {selectedStore.code} - {selectedStore.name}
                      </span>
                      <span className="text-[10.5px] text-emerald-700 font-medium">
                        Tipe: {selectedStore.type} • {selectedStore.city}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStore(null)}
                    className="px-2 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-bold text-[10px] hover:bg-emerald-100 transition cursor-pointer"
                  >
                    Ganti
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                      placeholder="Ketik kode (misal: 3006) atau nama cabang..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
                    {filteredStores.map((st) => (
                      <div
                        key={st.code}
                        onClick={() => setSelectedStore(st)}
                        className="p-2 hover:bg-emerald-50 cursor-pointer flex items-center justify-between transition"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 block truncate">
                            {st.code} - {st.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {st.city} ({st.type})
                          </span>
                        </div>
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                          Pilih
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                Lokasi / Keterangan Ruang / Kegiatan
              </label>
              <input
                type="text"
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="Contoh: Kantor FMCU Bandung, Google Meet, Rumah..."
                className="w-full py-2 px-2.5 rounded-xl bg-slate-100 border border-slate-200 font-bold text-xs text-slate-800 outline-none focus:bg-white"
              />
            </div>
          )}

          {/* Date & Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                Tanggal *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full py-1.5 px-2.5 rounded-xl bg-slate-100 border border-slate-200 font-bold text-xs text-slate-800 outline-none focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                Jam Mulai *
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full py-1.5 px-2.5 rounded-xl bg-slate-100 border border-slate-200 font-bold text-xs text-slate-800 outline-none focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                Jam Selesai
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full py-1.5 px-2.5 rounded-xl bg-slate-100 border border-slate-200 font-bold text-xs text-slate-800 outline-none focus:bg-white"
              />
            </div>
          </div>

          {/* Personil PIC */}
          <div>
            <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
              Personil yang Ditugaskan (PIC) *
            </label>
            <select
              value={pic}
              onChange={(e) => setPic(e.target.value)}
              className="w-full py-2 px-2.5 rounded-xl bg-slate-100 border border-slate-200 font-bold text-xs text-slate-800 outline-none focus:bg-white cursor-pointer"
            >
              {allUsers.map((u) => (
                <option key={u.name} value={u.name}>
                  {u.name} ({u.role || 'Staff'})
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
              Catatan / Instruksi Tambahan
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instruksi kerja atau catatan penting agenda ini..."
              className="w-full p-2.5 rounded-xl bg-slate-100 border border-slate-200 font-medium text-xs text-slate-800 outline-none focus:bg-white"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition cursor-pointer shadow-xs"
            >
              {initialData ? 'Simpan Perubahan' : 'Buat Jadwal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
