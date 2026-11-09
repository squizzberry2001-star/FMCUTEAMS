import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
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
  MapPin,
  Store,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Check,
  Lock,
  Compass,
  ArrowUpDown,
  Filter,
  AlertTriangle,
  FileText,
  SlidersHorizontal,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Building2
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
  findMasterStoreByCodeOrName,
} from '../../data/masterStoresData';
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

type AdminTab = 'agendas' | 'actual-visits' | 'reports' | 'excel-import';
type DateFilterPreset = 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL' | 'CUSTOM';

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
  // Navigation
  const [activeTab, setActiveTab] = useState<AdminTab>('agendas');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedPic, setSelectedPic] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Cloud Reports State
  const [cloudReports, setCloudReports] = useState<VisitReportData[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [previewingReport, setPreviewingReport] = useState<VisitReportData | null>(null);

  // Holding Time Modal
  const [showHoldingTimeModal, setShowHoldingTimeModal] = useState(false);

  // Agenda Form Modal (Add / Edit)
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<ScheduleAgenda | null>(null);

  // Delete Confirmation Modal
  const [deletingAgenda, setDeletingAgenda] = useState<ScheduleAgenda | null>(null);

  // Excel Import State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelSummary, setExcelSummary] = useState<ParsedExcelScheduleSummary | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Master Stores Cache
  const masterStores = useMemo(() => getMasterStores(), []);

  // Today Date Key
  const todayKey = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Fetch Cloud Visit Reports on Mount & Sync
  const loadReports = async () => {
    setIsLoadingReports(true);
    try {
      const reps = await fetchAllVisitReportsFromCloud(true);
      if (Array.isArray(reps)) {
        setCloudReports(reps);
      }
    } catch (e) {
      console.warn('Failed to fetch visit reports in admin:', e);
    } finally {
      setIsLoadingReports(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  // Map of Reports by AgendaId and StoreCode_Date for quick lookup
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

  // Helper to determine visit status of an agenda
  const getAgendaVisitStatus = (agenda: ScheduleAgenda) => {
    const report =
      reportMap.get(agenda.id) ||
      (agenda.storeCode && agenda.date
        ? reportMap.get(`${agenda.storeCode}_${agenda.date}`)
        : undefined);

    const actualIn = agenda.actualIn || report?.actualIn;
    const actualOut = agenda.actualOut || report?.actualOut;
    const isSubmitted = report?.status === 'SUBMITTED' || agenda.completed;

    if (isSubmitted || (actualIn && actualOut)) {
      return {
        code: 'COMPLETED',
        label: 'Selesai Visit',
        badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-500',
        report,
      };
    }
    if (actualIn && !actualOut) {
      return {
        code: 'IN_PROGRESS',
        label: 'Di Toko (In-Progress)',
        badge: 'bg-amber-50 text-amber-800 border-amber-300',
        dot: 'bg-amber-500 animate-pulse',
        report,
      };
    }
    return {
      code: 'SCHEDULED',
      label: 'Terjadwal (Belum In)',
      badge: 'bg-slate-100 text-slate-600 border-slate-200',
      dot: 'bg-slate-400',
      report,
    };
  };

  // Date Filter Calculations
  const dateRangeBounds = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
    startOfWeek.setDate(diff);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const toIso = (d: Date) => d.toISOString().split('T')[0];

    return {
      todayIso: toIso(today),
      tomorrowIso: toIso(tomorrow),
      weekStartIso: toIso(startOfWeek),
      weekEndIso: toIso(endOfWeek),
      monthStartIso: toIso(startOfMonth),
      monthEndIso: toIso(endOfMonth),
    };
  }, []);

  // Filtered Agendas
  const filteredAgendas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return agendas.filter((item) => {
      // 1. Date Filter
      if (datePreset === 'TODAY' && item.date !== dateRangeBounds.todayIso) return false;
      if (datePreset === 'TOMORROW' && item.date !== dateRangeBounds.tomorrowIso) return false;
      if (datePreset === 'THIS_WEEK') {
        if (item.date < dateRangeBounds.weekStartIso || item.date > dateRangeBounds.weekEndIso)
          return false;
      }
      if (datePreset === 'THIS_MONTH') {
        if (item.date < dateRangeBounds.monthStartIso || item.date > dateRangeBounds.monthEndIso)
          return false;
      }
      if (datePreset === 'CUSTOM') {
        if (customStartDate && item.date < customStartDate) return false;
        if (customEndDate && item.date > customEndDate) return false;
      }

      // 2. PIC Filter
      if (selectedPic !== 'ALL') {
        if (!item.pic || !item.pic.toLowerCase().includes(selectedPic.toLowerCase())) {
          return false;
        }
      }

      // 3. Category Filter
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }

      // 4. Status Filter
      if (selectedStatus !== 'ALL') {
        const st = getAgendaVisitStatus(item);
        if (selectedStatus === 'COMPLETED' && st.code !== 'COMPLETED') return false;
        if (selectedStatus === 'IN_PROGRESS' && st.code !== 'IN_PROGRESS') return false;
        if (selectedStatus === 'SCHEDULED' && st.code !== 'SCHEDULED') return false;
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
    selectedPic,
    selectedCategory,
    selectedStatus,
    dateRangeBounds,
    reportMap,
  ]);

  // Sorted Agendas (Date Descending, then Time Ascending)
  const sortedFilteredAgendas = useMemo(() => {
    return [...filteredAgendas].sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (a.time || '').localeCompare(b.time || '');
    });
  }, [filteredAgendas]);

  // Executive Metrics Calculations
  const metrics = useMemo(() => {
    const total = filteredAgendas.length;
    let completed = 0;
    let inProgress = 0;
    let scheduled = 0;
    let submittedReportsCount = 0;
    const storeCodes = new Set<string>();
    const activePics = new Set<string>();

    filteredAgendas.forEach((a) => {
      const st = getAgendaVisitStatus(a);
      if (st.code === 'COMPLETED') completed++;
      else if (st.code === 'IN_PROGRESS') inProgress++;
      else scheduled++;

      if (st.report?.status === 'SUBMITTED') submittedReportsCount++;
      if (a.storeCode) storeCodes.add(a.storeCode);
      if (a.pic) activePics.add(a.pic.trim());
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      scheduled,
      submittedReportsCount,
      uniqueStores: storeCodes.size,
      activePersonnel: activePics.size,
      completionRate,
    };
  }, [filteredAgendas, reportMap]);

  // Team Personnel List from Users & Agendas
  const allTeamMembers = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.name) set.add(u.name.trim());
    });
    agendas.forEach((a) => {
      if (a.pic) set.add(a.pic.trim());
    });
    return Array.from(set).sort();
  }, [users, agendas]);

  // Handle Export Excel
  const handleExportFilteredAgendas = () => {
    exportScheduleToTemplateExcel(sortedFilteredAgendas, users, selectedPic, 'Jadwal Admin FMCU');
  };

  // Handle File Input Change for Excel
  const handleExcelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    setIsParsingExcel(true);
    setImportSuccessMsg(null);

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

  // Commit Excel Import
  const handleCommitExcelImport = () => {
    if (!excelSummary || excelSummary.agendas.length === 0) return;

    onImportExcel(excelSummary.updatedUsers, excelSummary.agendas, importMode);
    setImportSuccessMsg(
      `Berhasil mengimpor ${excelSummary.agendas.length} agenda baru dengan mode [${
        importMode === 'replace' ? 'Gantikan Jadwal' : 'Gabungkan'
      }].`
    );
    setExcelFile(null);
    setExcelSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setActiveTab('agendas');
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-900 flex flex-col font-sans select-none antialiased">
      {/* =========================================================================
          1. TOP EXECUTIVE HEADER BAR (Apple Minimalist Corporate Bar)
          ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs px-3 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Left Brand & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider">
                  Admin Operations
                </span>
                <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                  • 610 Master Toko Terkoneksi
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight truncate">
                Pusat Kendali Jadwal &amp; Visit Toko
              </h1>
            </div>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Live Maps */}
            {onOpenLiveMaps && (
              <button
                type="button"
                onClick={onOpenLiveMaps}
                className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Buka Peta Lokasi Toko & Rute"
              >
                <Compass className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="hidden md:inline">Peta Toko</span>
              </button>
            )}

            {/* Standar R23 */}
            <button
              type="button"
              onClick={() => setShowHoldingTimeModal(true)}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Buka Standar Holding Time R23"
            >
              <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="hidden md:inline">Standar R23</span>
            </button>

            {/* Switch to User View */}
            <button
              type="button"
              onClick={onSwitchToUserView}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Pratinjau tampilan kru / staff lapangan"
            >
              <Eye className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="hidden sm:inline">Tampilan Staff</span>
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={onLogout}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200/70 transition flex items-center justify-center cursor-pointer shadow-2xs"
              title="Keluar / Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. METRICS KPI STRIP (Data Density & High Visibility Cards)
          ========================================================================= */}
      <section className="px-3 sm:px-6 pt-4 pb-2 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {/* Card 1: Total Agenda */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Agenda</span>
              <CalendarIcon className="w-4 h-4 text-slate-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {metrics.total}
              </span>
              <span className="text-xs text-slate-500 font-semibold">Tugas</span>
            </div>
          </div>

          {/* Card 2: Actual Visit Selesai */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Visit Selesai
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
                {metrics.completed}
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                {metrics.completionRate}% Realisasi
              </span>
            </div>
          </div>

          {/* Card 3: Sedang Berlangsung */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                Sedang di Toko
              </span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-amber-600 tracking-tight">
                {metrics.inProgress}
              </span>
              <span className="text-xs text-slate-500 font-semibold">Personil Aktif</span>
            </div>
          </div>

          {/* Card 4: Laporan Selesai Submitted */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
                Laporan Submit
              </span>
              <FileText className="w-4 h-4 text-teal-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-teal-700 tracking-tight">
                {metrics.submittedReportsCount}
              </span>
              <span className="text-xs text-slate-500 font-semibold">Laporan Resmi</span>
            </div>
          </div>

          {/* Card 5: Cakupan Toko & Tim */}
          <div className="col-span-2 sm:col-span-1 p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Cakupan Toko</span>
              <Store className="w-4 h-4 text-slate-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {metrics.uniqueStores}
              </span>
              <span className="text-xs text-slate-500 font-semibold">
                Toko / {metrics.activePersonnel} Personil
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. MAIN SEGMENTED NAVIGATION TABS (Lordbank 4 Pillar Navigation)
          ========================================================================= */}
      <section className="px-3 sm:px-6 pt-2 pb-3 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 bg-slate-200/70 rounded-2xl overflow-x-auto no-scrollbar">
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

          <button
            type="button"
            onClick={() => setActiveTab('actual-visits')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'actual-visits'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-teal-600" />
            <span>Monitoring Actual Visit</span>
            {metrics.inProgress > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">
                {metrics.inProgress} live
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-teal-600" />
            <span>Status Hasil Laporan</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black">
              {metrics.submittedReportsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('excel-import')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'excel-import'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4 text-slate-700" />
            <span>Upload &amp; Kelola Excel</span>
          </button>
        </div>
      </section>

      {/* =========================================================================
          4. TAB CONTENT CONTAINER
          ========================================================================= */}
      <main className="flex-1 px-3 sm:px-6 pb-12 max-w-7xl mx-auto w-full space-y-4">
        {/* Success Alert Banner (e.g. from Excel Import) */}
        {importSuccessMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-2xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{importSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setImportSuccessMsg(null)}
              className="text-emerald-700 hover:text-emerald-900 font-black cursor-pointer text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------------------
            TAB 1: SELURUH AGENDA (EXCEL-STYLE TABLE & MANAGEMENT)
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
                      { key: 'CUSTOM', label: 'Pilih Rentang' },
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

                  {/* Category Dropdown */}
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-8.5 px-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="ALL">Semua Kategori</option>
                    <option value="VISIT">Visit Toko</option>
                    <option value="NSO">NSO (New Store Opening)</option>
                    <option value="MEETING">Meeting</option>
                    <option value="AUDIT">Audit</option>
                    <option value="TRAINING">Training</option>
                    <option value="WORK_PLAN">Work Plan</option>
                    <option value="CUTI">Cuti</option>
                    <option value="OFF">Off / Libur</option>
                  </select>

                  {/* Status Dropdown */}
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="h-8.5 px-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="COMPLETED">Selesai Visit</option>
                    <option value="IN_PROGRESS">Sedang di Toko</option>
                    <option value="SCHEDULED">Belum Check-In</option>
                  </select>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2">
                  {/* Export Excel Button */}
                  <button
                    type="button"
                    onClick={handleExportFilteredAgendas}
                    className="h-8.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Unduh jadwal terfilter ke format file Excel (.xlsx)"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Download Excel</span>
                  </button>

                  {/* Add New Agenda Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAgenda(null);
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

            {/* Agendas List Table (Excel View on Desktop, Fluid Cards on Mobile) */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              {/* Summary Bar */}
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Menampilkan <b className="text-slate-800">{sortedFilteredAgendas.length}</b> agenda tugas
                </span>
                <span className="text-[11px] text-slate-400">
                  Data tersinkron otomatis ke Edge Cloud
                </span>
              </div>

              {sortedFilteredAgendas.length === 0 ? (
                <div className="py-14 px-4 text-center space-y-2">
                  <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto" />
                  <h3 className="text-sm font-black text-slate-700">Tidak Ada Agenda Ditemukan</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Coba sesuaikan kata kunci pencarian atau ubah preset rentang tanggal di atas.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/75 border-b border-slate-200/80 text-[11px] font-black text-slate-600 uppercase tracking-wider">
                        <th className="py-3 px-3.5">Tanggal &amp; Waktu</th>
                        <th className="py-3 px-3">Kategori</th>
                        <th className="py-3 px-3">Toko &amp; Lokasi</th>
                        <th className="py-3 px-3">PIC On-Duty</th>
                        <th className="py-3 px-3">Status Visit</th>
                        <th className="py-3 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {sortedFilteredAgendas.map((agenda) => {
                        const status = getAgendaVisitStatus(agenda);
                        const isToday = agenda.date === todayKey;

                        return (
                          <tr
                            key={agenda.id}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isToday ? 'bg-emerald-50/30' : ''
                            }`}
                          >
                            {/* 1. Date & Time */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-900">{agenda.date}</span>
                                {isToday && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-white text-[9.5px] font-black">
                                    Hari Ini
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {agenda.time || '08:00'} - {agenda.endTime || 'Selesai'}
                              </span>
                            </td>

                            {/* 2. Category */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-lg text-[10.5px] font-black uppercase tracking-tight border ${
                                  agenda.category === 'VISIT'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : agenda.category === 'NSO'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : agenda.category === 'AUDIT'
                                    ? 'bg-purple-50 text-purple-800 border-purple-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {agenda.category || 'VISIT'}
                              </span>
                            </td>

                            {/* 3. Store & Location */}
                            <td className="py-3 px-3 min-w-[220px]">
                              <div className="flex items-center gap-1.5">
                                <Store className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                <span className="font-black text-slate-900 leading-snug">
                                  {agenda.storeName || agenda.location || agenda.title}
                                </span>
                                {agenda.storeCode && (
                                  <span className="px-1.5 py-0.2 rounded bg-slate-100 font-mono text-[10px] font-black text-slate-700 shrink-0">
                                    {agenda.storeCode}
                                  </span>
                                )}
                              </div>
                              {agenda.storeType && (
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  Tipe: {agenda.storeType} • {agenda.location || 'Bandung'}
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

                            {/* 5. Status Visit */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="flex flex-col gap-1">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black border self-start ${status.badge}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                                  <span>{status.label}</span>
                                </span>
                                {(agenda.actualIn || status.report?.actualIn) && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    IN: {agenda.actualIn || status.report?.actualIn}
                                    {(agenda.actualOut || status.report?.actualOut) &&
                                      ` • OUT: ${agenda.actualOut || status.report?.actualOut}`}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* 6. Actions */}
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Preview report if available */}
                                {status.report && (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewingReport(status.report!)}
                                    className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 transition cursor-pointer"
                                    title="Pratinjau Hasil Laporan Visit"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Edit Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAgenda(agenda);
                                    setIsAgendaModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                  title="Edit Agenda Jadwal"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete Button */}
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
            TAB 2: MONITORING ACTUAL VISIT & PRESENSI LAPANGAN
            --------------------------------------------------------------------- */}
        {activeTab === 'actual-visits' && (
          <div className="space-y-3.5 animate-in fade-in">
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-600 stroke-[2.4]" />
                  <span>Monitoring Actual Visit Lapangan Real-Time</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Verifikasi jam Actual IN / OUT dan kepatuhan radius 1–50 meter toko untuk seluruh personil on-duty.
                </p>
              </div>

              <button
                type="button"
                onClick={loadReports}
                disabled={isLoadingReports}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReports ? 'animate-spin' : ''}`} />
                <span>Segarkan Data</span>
              </button>
            </div>

            {/* Monitoring Table */}
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
                      <th className="py-3 px-3">Verifikasi Geofence</th>
                      <th className="py-3 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {sortedFilteredAgendas.map((agenda) => {
                      const status = getAgendaVisitStatus(agenda);
                      const rep = status.report;
                      const actualInTime = agenda.actualIn || rep?.actualIn;
                      const actualOutTime = agenda.actualOut || rep?.actualOut;
                      const distMeters = agenda.silentAudit?.inDistanceToStoreMeters;

                      return (
                        <tr key={agenda.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* PIC */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="font-black text-slate-900 block">
                              {agenda.pic || 'Belum Ditugaskan'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {agenda.date}
                            </span>
                          </td>

                          {/* Toko Tujuan */}
                          <td className="py-3 px-3 min-w-[200px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">
                                {agenda.storeName || agenda.location || agenda.title}
                              </span>
                              {agenda.storeCode && (
                                <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-black text-slate-600 font-mono">
                                  {agenda.storeCode}
                                </span>
                              )}
                            </div>
                            <span className="text-[10.5px] text-slate-400 block mt-0.5">
                              {agenda.location || 'Bandung'}
                            </span>
                          </td>

                          {/* Planned Time */}
                          <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-600">
                            {agenda.time || '08:00'} - {agenda.endTime || 'Selesai'}
                          </td>

                          {/* Actual IN */}
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

                          {/* Actual OUT */}
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

                          {/* Geofence Status */}
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

                          {/* Action */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {rep ? (
                              <button
                                type="button"
                                onClick={() => setPreviewingReport(rep)}
                                className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-extrabold text-[10.5px] transition flex items-center gap-1 cursor-pointer ml-auto"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Lihat Laporan</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[10.5px]">Belum Ada Laporan</span>
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
            TAB 3: STATUS HASIL LAPORAN VISIT & QSC
            --------------------------------------------------------------------- */}
        {activeTab === 'reports' && (
          <div className="space-y-3.5 animate-in fade-in">
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600 stroke-[2.4]" />
                  <span>Daftar Hasil Laporan Visit &amp; Temuan QSC</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Laporan resmi yang telah disubmit oleh tim, lengkap dengan pratinjau PDF, bukti foto, dan link Google Drive.
                </p>
              </div>

              <button
                type="button"
                onClick={loadReports}
                disabled={isLoadingReports}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReports ? 'animate-spin' : ''}`} />
                <span>Segarkan Laporan</span>
              </button>
            </div>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {cloudReports.length === 0 ? (
                <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-200/80 space-y-2">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                  <h3 className="text-sm font-black text-slate-700">Belum Ada Laporan Visit Tersimpan</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Laporan yang disubmit oleh staff di lapangan akan muncul di sini secara real-time.
                  </p>
                </div>
              ) : (
                cloudReports.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="min-w-0">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                            {report.visitDate}
                          </span>
                          <h3 className="font-black text-slate-900 text-sm truncate">
                            {report.storeName || 'FamilyMart'}
                          </h3>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                            report.status === 'SUBMITTED'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {report.status || 'DRAFT'}
                        </span>
                      </div>

                      {/* Store Specs */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-2">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">Kode Toko</span>
                          <span className="font-black text-slate-800 font-mono">
                            {report.storeCode || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">Visitor / Auditor</span>
                          <span className="font-bold text-slate-800 truncate block">
                            {report.visitorName || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">Actual IN / OUT</span>
                          <span className="font-bold text-slate-800 font-mono text-[11px]">
                            {report.actualIn || '-'} / {report.actualOut || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">Bukti Temuan</span>
                          <span className="font-bold text-slate-800">
                            {(report.observations || []).length} Temuan • {(report.evidencePhotos || []).length} Foto
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewingReport(report)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Pratinjau PDF</span>
                      </button>

                      {report.spreadsheetUrl && (
                        <a
                          href={report.spreadsheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                          title="Buka Spreadsheet Form CA Toko"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------------
            TAB 4: UPLOAD & KELOLA EXCEL (SCHEDULE IMPORT / EXPORT)
            --------------------------------------------------------------------- */}
        {activeTab === 'excel-import' && (
          <div className="space-y-4 animate-in fade-in max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-4">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-emerald-600" />
                  <span>Upload &amp; Sinkronisasi Jadwal Excel FMCU</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Unggah file Excel berformat resmi (*.xlsx / *.xls / *.csv) untuk memperbarui atau menambahkan jadwal tim lapangan secara instan.
                </p>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 sm:p-8 text-center bg-slate-50/70 hover:bg-emerald-50/30 transition cursor-pointer space-y-2.5"
              >
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
                  <FileSpreadsheet className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-black text-slate-800 block">
                    Klik untuk memilih file Excel atau seret file ke sini
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Mendukung template jadwal resmi FMCU (*.xlsx, *.xls)
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelFileSelect}
                  className="hidden"
                />
              </div>

              {/* Parsing State */}
              {isParsingExcel && (
                <div className="p-4 rounded-xl bg-slate-100 flex items-center justify-center gap-2 text-xs font-bold text-slate-700 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Membaca dan memverifikasi data Excel...</span>
                </div>
              )}

              {/* Parsed Summary Box */}
              {excelSummary && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-slate-900">
                          Pratinjau Data: {excelSummary.sheetName}
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          {excelSummary.agendas.length} jadwal valid terdeteksi
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block">Visit Toko</span>
                      <span className="text-base font-black text-slate-900 mt-0.5 block">
                        {excelSummary.stats.visitCount}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block">NSO</span>
                      <span className="text-base font-black text-slate-900 mt-0.5 block">
                        {excelSummary.stats.nsoCount}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block">Toko Cocok</span>
                      <span className="text-base font-black text-emerald-600 mt-0.5 block">
                        {excelSummary.stats.matchedStoresCount}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block">Personil Cocok</span>
                      <span className="text-base font-black text-teal-600 mt-0.5 block">
                        {excelSummary.stats.matchedUsersCount}
                      </span>
                    </div>
                  </div>

                  {/* Mode Import Options */}
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <span className="text-xs font-black text-slate-700 block">Pilih Mode Import:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-start gap-2.5 ${
                          importMode === 'merge'
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700'
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
                          importMode === 'replace'
                            ? 'bg-amber-50/70 border-amber-300 text-amber-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700'
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
                            Menghapus seluruh jadwal lama dan menggantikannya dengan jadwal dari file ini.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Commit Button */}
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

              {/* Template Download & Master Store Export Box */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Butuh template resmi Excel?
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Gunakan template bawaan agar nama kolom dan format jam sesuai standar sistem.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportScheduleToTemplateExcel([], users, 'ALL', 'Template FMCU')}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Download Template Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => exportMasterStoresToExcel()}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Export 610 Toko (.xlsx)</span>
                  </button>
                </div>
              </div>
            </div>
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
          allUsers={users}
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
          7. MODAL PRATINJAU LAPORAN VISIT PDF (EXECUTIVE SUITE)
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
          8. MODAL STANDAR HOLDING TIME R23
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
// SUB-COMPONENT: MODAL FORM TAMBAH / EDIT AGENDA
// =============================================================================
interface AgendaFormModalProps {
  isOpen: boolean;
  initialData: ScheduleAgenda | null;
  allUsers: User[];
  masterStores: MasterStore[];
  onClose: () => void;
  onSave: (agenda: ScheduleAgenda) => void;
}

const AgendaFormModal: React.FC<AgendaFormModalProps> = ({
  isOpen,
  initialData,
  allUsers,
  masterStores,
  onClose,
  onSave,
}) => {
  const [storeSearch, setStoreSearch] = useState('');
  const [selectedStore, setSelectedStore] = useState<MasterStore | null>(null);
  const [showStorePicker, setShowStorePicker] = useState(false);

  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(initialData?.time || '08:00');
  const [endTime, setEndTime] = useState(initialData?.endTime || '17:00');
  const [category, setCategory] = useState<ScheduleCategory>(initialData?.category || 'VISIT');
  const [pic, setPic] = useState(initialData?.pic || (allUsers[0]?.name || ''));
  const [description, setDescription] = useState(initialData?.description || '');

  // Initialize store if editing
  useEffect(() => {
    if (initialData?.storeCode) {
      const match = findMasterStoreByCodeOrName(initialData.storeCode);
      if (match) setSelectedStore(match);
    }
  }, [initialData]);

  // Filtered Store Options (Top 8 based on search)
  const filteredStores = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return masterStores.slice(0, 10);
    return masterStores
      .filter((s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 15);
  }, [masterStores, storeSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const storeName = selectedStore?.name || initialData?.storeName || 'Store FamilyMart';
    const storeCode = selectedStore?.code || initialData?.storeCode || '3000';
    const storeType = selectedStore?.type || initialData?.storeType || 'CVS';
    const location = selectedStore ? `${selectedStore.name} (${selectedStore.city})` : initialData?.location || storeName;

    const savedAgenda: ScheduleAgenda = {
      id: initialData?.id || `agenda-${Date.now()}`,
      title: `${category}: ${storeName}`,
      date,
      time,
      endTime,
      category,
      pic,
      location,
      storeCode,
      storeName,
      storeType,
      areaManager: selectedStore?.areaManager || initialData?.areaManager || '',
      regionalManager: selectedStore?.regionalManager || initialData?.regionalManager || '',
      description,
      tags: [category, storeType],
    };

    onSave(savedAgenda);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in select-none">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
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
                Pilih toko dari 610 database cabang resmi FMCU
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
          {/* Store Picker */}
          <div>
            <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
              Toko FMCU (610 Cabang) *
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
                  onClick={() => {
                    setSelectedStore(null);
                    setShowStorePicker(true);
                  }}
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
                {/* Store Option List */}
                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
                  {filteredStores.map((st) => (
                    <div
                      key={st.code}
                      onClick={() => {
                        setSelectedStore(st);
                        setShowStorePicker(false);
                      }}
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

          {/* Category & PIC */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                Kategori Agenda *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ScheduleCategory)}
                className="w-full py-2 px-2.5 rounded-xl bg-slate-100 border border-slate-200 font-bold text-xs text-slate-800 outline-none focus:bg-white cursor-pointer"
              >
                <option value="VISIT">VISIT (Store Visit)</option>
                <option value="NSO">NSO (New Store Opening)</option>
                <option value="MEETING">MEETING</option>
                <option value="AUDIT">AUDIT</option>
                <option value="TRAINING">TRAINING</option>
                <option value="WORK_PLAN">WORK PLAN</option>
                <option value="CUTI">CUTI</option>
                <option value="OFF">OFF / LIBUR</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                Personil (PIC) *
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
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
              Catatan / Instruksi Kunjungan
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Catatan tambahan untuk tim di lapangan..."
              className="w-full p-2.5 rounded-xl bg-slate-100 border border-slate-200 font-medium text-xs text-slate-800 outline-none focus:bg-white"
            />
          </div>

          {/* Buttons */}
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
