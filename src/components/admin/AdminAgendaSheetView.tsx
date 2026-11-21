import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Upload,
  Download,
  Edit3,
  Trash2,
  Copy,
  Eye,
  AlertTriangle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileSpreadsheet,
  X,
  RefreshCw,
  SlidersHorizontal,
  MoreHorizontal,
} from 'lucide-react';
import { ScheduleAgenda, User, VisitReportData } from '../../types';
import {
  ActivityKind,
  ClassifiedAgenda,
  exportRowsToExcel,
  formatDisplayDateShort,
  formatLocalYmd,
} from './adminTypes';
import { exportScheduleToTemplateExcel } from '../../services/scheduleExcelService';
import { AdminMobileSheet } from './AdminMobileSheet';

interface AdminAgendaSheetViewProps {
  classifiedAgendas: ClassifiedAgenda[];
  agendas: ScheduleAgenda[];
  users: User[];
  todayYmd: string;
  pendingSyncCount: number;
  isRetryingSync: boolean;
  syncFeedback: { ok: boolean; title: string; detail: string } | null;
  onDismissFeedback: () => void;
  onRetrySync: () => void;
  onOpenCreate: (defaultDate?: string) => void;
  onOpenEdit: (agenda: ScheduleAgenda) => void;
  onDuplicateAgenda: (agenda: ScheduleAgenda) => void;
  onDeleteAgenda: (agenda: ScheduleAgenda) => void;
  onOpenUploadExcel: () => void;
  onPreviewReport: (report: VisitReportData) => void;
}

type DateScope = 'all' | 'today' | 'week' | 'month' | 'custom';
type SortKey = 'date' | 'pic' | 'kind' | 'store' | 'status';

const PAGE_SIZE = 100;

export const AdminAgendaSheetView: React.FC<AdminAgendaSheetViewProps> = ({
  classifiedAgendas,
  agendas,
  users,
  todayYmd,
  pendingSyncCount,
  isRetryingSync,
  syncFeedback,
  onDismissFeedback,
  onRetrySync,
  onOpenCreate,
  onOpenEdit,
  onDuplicateAgenda,
  onDeleteAgenda,
  onOpenUploadExcel,
  onPreviewReport,
}) => {
  const [search, setSearch] = useState('');
  const [dateScope, setDateScope] = useState<DateScope>('all');
  const [customDate, setCustomDate] = useState(todayYmd);
  const [selectedPic, setSelectedPic] = useState('ALL');
  const [selectedKind, setSelectedKind] = useState<ActivityKind | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'COMPLETED' | 'IN_PROGRESS' | 'SCHEDULED' | 'KENDALA'>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);

  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Date bounds for week / month
  const { weekStart, weekEnd, monthPrefix } = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return {
      weekStart: formatLocalYmd(mon),
      weekEnd: formatLocalYmd(sun),
      monthPrefix: todayYmd.slice(0, 7),
    };
  }, [todayYmd]);

  const uniquePics = useMemo(() => {
    const set = new Set<string>();
    classifiedAgendas.forEach((c) => {
      if (c.agenda.pic) set.add(c.agenda.pic.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [classifiedAgendas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return classifiedAgendas
      .filter((item) => {
        const ag = item.agenda;
        if (dateScope === 'today' && ag.date !== todayYmd) return false;
        if (dateScope === 'week' && (ag.date < weekStart || ag.date > weekEnd)) return false;
        if (dateScope === 'month' && !ag.date.startsWith(monthPrefix)) return false;
        if (dateScope === 'custom' && customDate && ag.date !== customDate) return false;

        if (selectedPic !== 'ALL' && ag.pic.trim() !== selectedPic) return false;
        if (selectedKind !== 'ALL' && item.kind !== selectedKind) return false;
        if (selectedStatus === 'KENDALA') {
          if (!ag.kendala) return false;
        } else if (selectedStatus !== 'ALL' && item.status.code !== selectedStatus) {
          return false;
        }

        if (q) {
          const hay = [
            ag.title,
            ag.pic,
            ag.storeCode,
            ag.storeName,
            ag.location,
            ag.date,
            item.badge.label,
            ag.kendala,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'date') {
          cmp = (a.agenda.date || '').localeCompare(b.agenda.date || '');
          if (cmp === 0) cmp = (a.agenda.time || '').localeCompare(b.agenda.time || '');
        } else if (sortKey === 'pic') {
          cmp = (a.agenda.pic || '').localeCompare(b.agenda.pic || '');
        } else if (sortKey === 'kind') {
          cmp = a.badge.label.localeCompare(b.badge.label);
        } else if (sortKey === 'store') {
          cmp = (a.agenda.storeName || a.agenda.location || '').localeCompare(
            b.agenda.storeName || b.agenda.location || ''
          );
        } else if (sortKey === 'status') {
          cmp = a.status.label.localeCompare(b.status.label);
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [
    classifiedAgendas,
    search,
    dateScope,
    customDate,
    todayYmd,
    weekStart,
    weekEnd,
    monthPrefix,
    selectedPic,
    selectedKind,
    selectedStatus,
    sortKey,
    sortDir,
  ]);

  useEffect(() => {
    setPage(1);
  }, [search, dateScope, customDate, selectedPic, selectedKind, selectedStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Inline KPI strip computed from current filtered dataset
  const stats = useMemo(() => {
    let visit = 0;
    let nso = 0;
    let done = 0;
    let inProgress = 0;
    let kendala = 0;
    for (const item of filtered) {
      if (item.kind === 'VISIT') visit++;
      if (item.kind === 'NSO') nso++;
      if (item.status.code === 'COMPLETED') done++;
      if (item.status.code === 'IN_PROGRESS') inProgress++;
      if (item.agenda.kendala) kendala++;
    }
    return { total: filtered.length, visit, nso, done, inProgress, kendala };
  }, [filtered]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' ? 'desc' : 'asc');
    }
  };

  const handleExportFiltered = () => {
    setShowExportMenu(false);
    const rows = filtered.map((item, idx) => {
      const ag = item.agenda;
      return {
        No: idx + 1,
        Tanggal: ag.date,
        Mulai: ag.time || '08:30',
        Selesai: ag.endTime || '17:00',
        Personil: ag.pic,
        Kategori: item.badge.label,
        'Judul Agenda': ag.title,
        'Kode Toko': ag.storeCode || '-',
        'Nama Toko / Lokasi': ag.storeName || ag.location || '-',
        Status: item.status.label,
        'Actual IN': ag.actualIn || item.report?.actualIn || '-',
        'Actual OUT': ag.actualOut || item.report?.actualOut || '-',
        'Laporan Visit':
          item.report?.status === 'SUBMITTED'
            ? 'SUBMITTED'
            : item.report
            ? 'DRAFT'
            : item.requiresReport
            ? 'BELUM'
            : '-',
        Kendala: ag.kendala || '-',
        Catatan: ag.description || '-',
      };
    });
    exportRowsToExcel(rows, 'Jadwal Agenda FMCU', `FMCU_Jadwal_Agenda_${todayYmd}.xlsx`);
  };

  const activeFilterCount =
    (dateScope !== 'all' ? 1 : 0) +
    (selectedPic !== 'ALL' ? 1 : 0) +
    (selectedKind !== 'ALL' ? 1 : 0) +
    (selectedStatus !== 'ALL' ? 1 : 0);

  const hasActiveFilters = Boolean(search.trim()) || activeFilterCount > 0;

  const resetFilters = () => {
    setSearch('');
    setDateScope('all');
    setSelectedPic('ALL');
    setSelectedKind('ALL');
    setSelectedStatus('ALL');
  };

  return (
    <div className="flex flex-col h-full admin-view-enter">
      {/* Sync Feedback Banner (only when active) */}
      {syncFeedback && (
        <div
          className={`mb-3 px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            syncFeedback.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <div className="min-w-0">
            <span className="font-semibold">{syncFeedback.title}</span>
            <span className="ml-2 opacity-80">{syncFeedback.detail}</span>
          </div>
          <button
            type="button"
            onClick={onDismissFeedback}
            className="p-1 rounded-md hover:bg-black/5 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pending Offline Sync Warning (only when queue exists) */}
      {pendingSyncCount > 0 && (
        <div className="mb-3 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900">
          <span>
            <strong>{pendingSyncCount} agenda</strong> masih antre sinkronisasi cloud.
          </span>
          <button
            type="button"
            onClick={onRetrySync}
            disabled={isRetryingSync}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isRetryingSync ? 'animate-spin' : ''}`} />
            <span>Sinkronkan Sekarang</span>
          </button>
        </div>
      )}

      {/* Main Flat Spreadsheet Sheet Container (edge-to-edge on mobile) */}
      <div className="bg-white border-y md:border border-slate-200 rounded-none md:rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* ============================================================
            MOBILE ULTRA-CLEAN SINGLE-ROW TOOLBAR (ZERO STACKED BUTTONS)
            ============================================================ */}
        <div className="md:hidden border-b border-slate-200 bg-white shrink-0">
          <div className="px-3 py-2 flex items-center gap-1.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari toko, PIC, agenda..."
                className="w-full h-9 pl-8 pr-6 rounded-lg border border-slate-200 bg-slate-50/70 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowMobileFilter(true)}
              className={`relative h-9 px-2.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer ${
                activeFilterCount > 0
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
              title="Filter Jadwal"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {activeFilterCount > 0 && (
                <span className="font-mono text-[10.5px] font-bold">{activeFilterCount}</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowMobileActions(true)}
              className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 flex items-center justify-center shrink-0 cursor-pointer"
              title="Import / Export Excel"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onOpenCreate(dateScope === 'custom' ? customDate : todayYmd)}
              className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition"
              title="Buat Jadwal Baru"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Slim Single-Line Non-Wrapping Stats Ticker */}
          <div className="px-3 py-1.5 border-t border-slate-100 bg-slate-50/70 flex items-center gap-3 text-[11px] overflow-x-auto no-scrollbar whitespace-nowrap">
            <span className="text-slate-600 tabular-nums">
              <strong className="text-slate-900">{stats.total}</strong> Baris
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600 tabular-nums">
              <strong className="text-emerald-700">{stats.visit}</strong> Visit
            </span>
            <span className="text-slate-600 tabular-nums">
              <strong className="text-amber-600">{stats.nso}</strong> NSO
            </span>
            <span className="text-slate-600 tabular-nums">
              <strong className="text-slate-800">{stats.done}</strong> Selesai
            </span>
            {stats.kendala > 0 && (
              <button
                type="button"
                onClick={() => setSelectedStatus(selectedStatus === 'KENDALA' ? 'ALL' : 'KENDALA')}
                className="text-rose-600 font-semibold cursor-pointer"
              >
                • {stats.kendala} Kendala
              </button>
            )}
          </div>
        </div>

        {/* ============================================================
            DESKTOP TOP ROW & FILTER BAR (SPREADSHEET TOOLBAR)
            ============================================================ */}
        <div className="hidden md:flex px-3.5 py-2.5 border-b border-slate-200 flex-wrap items-center justify-between gap-2.5 bg-white">
          {/* Minimalist Horizontal KPI Strip */}
          <div className="flex items-center gap-3 sm:gap-4 text-xs overflow-x-auto no-scrollbar">
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="font-bold text-slate-900 text-sm tabular-nums">{stats.total}</span>
              <span className="text-slate-500">Baris</span>
            </div>
            <span className="h-3.5 w-px bg-slate-200 shrink-0" />
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="font-bold text-emerald-700 tabular-nums">{stats.visit}</span>
              <span className="text-slate-500">Visit</span>
            </div>
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="font-bold text-amber-600 tabular-nums">{stats.nso}</span>
              <span className="text-slate-500">NSO</span>
            </div>
            <span className="h-3.5 w-px bg-slate-200 shrink-0" />
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="font-bold text-slate-800 tabular-nums">{stats.done}</span>
              <span className="text-slate-500">Selesai</span>
            </div>
            {stats.inProgress > 0 && (
              <div className="flex items-baseline gap-1.5 shrink-0">
                <span className="font-bold text-amber-700 tabular-nums">{stats.inProgress}</span>
                <span className="text-slate-500">Di Toko</span>
              </div>
            )}
            {stats.kendala > 0 && (
              <button
                type="button"
                onClick={() => setSelectedStatus(selectedStatus === 'KENDALA' ? 'ALL' : 'KENDALA')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold cursor-pointer shrink-0"
              >
                <AlertTriangle className="w-3 h-3" />
                <span>{stats.kendala} Kendala</span>
              </button>
            )}
          </div>

          {/* 3 Single-Purpose Primary Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenCreate(dateScope === 'custom' ? customDate : todayYmd)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Jadwal</span>
            </button>

            <button
              type="button"
              onClick={onOpenUploadExcel}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition cursor-pointer"
              title="Upload Jadwal dari File Excel"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span>Import Excel</span>
            </button>

            <div className="relative" ref={exportRef}>
              <button
                type="button"
                onClick={() => setShowExportMenu((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30">
                  <button
                    type="button"
                    onClick={handleExportFiltered}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tarik Data Tabel ({filtered.length} baris)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      exportScheduleToTemplateExcel(agendas, users);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Unduh Template Excel</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Filter Bar */}
        <div className="hidden md:flex px-3.5 py-2 border-b border-slate-200 bg-slate-50/70 flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari toko, PIC, kode, agenda..."
              className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Date Scope Segmented Pills */}
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-[11px] font-medium">
            {(
              [
                ['all', 'Semua'],
                ['today', 'Hari Ini'],
                ['week', 'Minggu Ini'],
                ['month', 'Bulan Ini'],
                ['custom', 'Tgl'],
              ] as [DateScope, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setDateScope(k)}
                className={`px-2 py-1 rounded-md transition cursor-pointer ${
                  dateScope === k
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {dateScope === 'custom' && (
            <div className="relative">
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 tabular-nums"
              />
            </div>
          )}

          {/* PIC Filter */}
          <select
            value={selectedPic}
            onChange={(e) => setSelectedPic(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:border-slate-900 max-w-[160px]"
          >
            <option value="ALL">Semua PIC ({uniquePics.length})</option>
            {uniquePics.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedKind}
            onChange={(e) => setSelectedKind(e.target.value as ActivityKind | 'ALL')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:border-slate-900"
          >
            <option value="ALL">Semua Kategori</option>
            <option value="VISIT">Visit Toko</option>
            <option value="NSO">NSO Toko Baru</option>
            <option value="MEETING">Meeting</option>
            <option value="TRAINING">Training</option>
            <option value="AUDIT">Audit</option>
            <option value="OPERATION">Operasional</option>
            <option value="OTHER">Work Plan / Lainnya</option>
            <option value="LEAVE">Cuti / Izin</option>
            <option value="OFF">Off / Libur</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:border-slate-900"
          >
            <option value="ALL">Semua Status</option>
            <option value="COMPLETED">Selesai</option>
            <option value="IN_PROGRESS">Di Toko (On-Site)</option>
            <option value="SCHEDULED">Terjadwal</option>
            <option value="KENDALA">Ada Kendala</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 px-1.5 py-1 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

        {/* Excel-Like Data Grid (Desktop & Tablet) + Clean Compact Rows (Mobile) */}
        <div className="flex-1 overflow-auto admin-sheet-scroll">
          {pagedRows.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <p className="text-sm font-semibold text-slate-700">Tidak ada jadwal yang cocok</p>
              <p className="text-xs text-slate-400 mt-1">
                Ubah filter di atas, buat jadwal baru, atau import dari file Excel.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop / Tablet Spreadsheet Table */}
              <table className="hidden md:table w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2 px-2.5 w-10 text-center border-r border-slate-200/70">#</th>
                    <th className="py-2 px-3 w-36 border-r border-slate-200/70">
                      <button
                        type="button"
                        onClick={() => toggleSort('date')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                      >
                        <span>Tanggal / Jam</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </button>
                    </th>
                    <th className="py-2 px-3 w-40 border-r border-slate-200/70">
                      <button
                        type="button"
                        onClick={() => toggleSort('pic')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                      >
                        <span>Personil (PIC)</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </button>
                    </th>
                    <th className="py-2 px-3 w-28 border-r border-slate-200/70">
                      <button
                        type="button"
                        onClick={() => toggleSort('kind')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                      >
                        <span>Kategori</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </button>
                    </th>
                    <th className="py-2 px-3 border-r border-slate-200/70">
                      <button
                        type="button"
                        onClick={() => toggleSort('store')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                      >
                        <span>Agenda & Toko / Lokasi</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </button>
                    </th>
                    <th className="py-2 px-3 w-32 border-r border-slate-200/70">Actual IN / OUT</th>
                    <th className="py-2 px-3 w-28 border-r border-slate-200/70">
                      <button
                        type="button"
                        onClick={() => toggleSort('status')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                      >
                        <span>Status</span>
                        <ArrowUpDown className="w-3 h-3 opacity-60" />
                      </button>
                    </th>
                    <th className="py-2 px-3 w-28 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[12.5px] text-slate-700">
                  {pagedRows.map((item, idx) => {
                    const ag = item.agenda;
                    const rowNum = (page - 1) * PAGE_SIZE + idx + 1;
                    const actualIn = ag.actualIn || item.report?.actualIn;
                    const actualOut = ag.actualOut || item.report?.actualOut;
                    const isTodayRow = ag.date === todayYmd;

                    return (
                      <tr
                        key={ag.id}
                        className={`group transition-colors hover:bg-slate-50/90 ${
                          isTodayRow ? 'bg-emerald-50/20' : 'bg-white'
                        }`}
                      >
                        <td className="py-2 px-2.5 text-center text-[11px] font-mono text-slate-400 border-r border-slate-100 tabular-nums">
                          {rowNum}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap tabular-nums">
                          <div className="font-medium text-slate-800 flex items-center gap-1.5">
                            <span>{formatDisplayDateShort(ag.date)}</span>
                            {isTodayRow && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Hari Ini" />
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {ag.time || '08:30'}–{ag.endTime || '17:00'}
                          </div>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 font-medium text-slate-800 max-w-[160px] truncate" title={ag.pic}>
                          {ag.pic}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${item.badge.bg} ${item.badge.color} ${item.badge.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${item.badge.dot}`} />
                            {item.badge.shortLabel}
                          </span>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 max-w-[320px]">
                          <div className="font-medium text-slate-900 truncate" title={ag.title}>
                            {ag.title}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                            {ag.storeCode && (
                              <span className="font-mono text-[10.5px] font-semibold text-slate-600 bg-slate-100 px-1 rounded">
                                #{ag.storeCode}
                              </span>
                            )}
                            <span className="truncate">{ag.storeName || ag.location || '-'}</span>
                            {ag.kendala && (
                              <span
                                className="inline-flex items-center gap-0.5 text-rose-600 font-semibold shrink-0"
                                title={`Kendala: ${ag.kendala}`}
                              >
                                <AlertTriangle className="w-3 h-3" />
                                Kendala
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 font-mono text-[11px] whitespace-nowrap tabular-nums">
                          {actualIn || actualOut ? (
                            <div className="space-y-0.5">
                              <div className="text-emerald-700">IN  {actualIn || '-'}</div>
                              <div className="text-slate-500">OUT {actualOut || '-'}</div>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${item.status.bg} ${item.status.color} ${item.status.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${item.status.dot}`} />
                            {item.status.label}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1">
                            {item.report && (
                              <button
                                type="button"
                                onClick={() => onPreviewReport(item.report!)}
                                className="p-1.5 rounded-md text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                                title="Lihat Laporan Visit di Web"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onOpenEdit(ag)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                              title="Edit Jadwal"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDuplicateAgenda(ag)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                              title="Duplikat Jadwal"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteAgenda(ag)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Hapus Jadwal"
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

              {/* Mobile Flat Scannable List (Zero Stacked Cards — Crisp 1px Dividers) */}
              <div className="md:hidden divide-y divide-slate-100">
                {pagedRows.map((item) => {
                  const ag = item.agenda;
                  const actualIn = ag.actualIn || item.report?.actualIn;
                  const actualOut = ag.actualOut || item.report?.actualOut;

                  return (
                    <div key={ag.id} className="px-3.5 py-3 bg-white active:bg-slate-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${item.badge.bg} ${item.badge.color} ${item.badge.border}`}
                            >
                              {item.badge.shortLabel}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                              {formatDisplayDateShort(ag.date)} • {ag.time || '08:30'}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold ${item.status.color}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${item.status.dot}`} />
                              {item.status.label}
                            </span>
                          </div>
                          <div className="text-[13px] font-semibold text-slate-900 mt-1 truncate">
                            {ag.title}
                          </div>
                          <div className="text-[11.5px] text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                            <span className="font-medium text-slate-700">{ag.pic}</span>
                            <span>•</span>
                            <span className="truncate">
                              {ag.storeCode ? `#${ag.storeCode} ` : ''}
                              {ag.storeName || ag.location || '-'}
                            </span>
                          </div>
                          {(actualIn || actualOut || ag.kendala) && (
                            <div className="mt-1 flex items-center gap-2 text-[10.5px] font-mono">
                              {actualIn && <span className="text-emerald-700">IN {actualIn}</span>}
                              {actualOut && <span className="text-slate-500">OUT {actualOut}</span>}
                              {ag.kendala && (
                                <span className="text-rose-600 font-sans font-semibold">
                                  • Kendala: {ag.kendala}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          {item.report && (
                            <button
                              type="button"
                              onClick={() => onPreviewReport(item.report!)}
                              className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenEdit(ag)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteAgenda(ag)}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Clean Spreadsheet Pagination Footer */}
        <div className="px-3.5 py-2 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span className="tabular-nums">
            Menampilkan{' '}
            <strong className="text-slate-800">
              {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filtered.length)}
            </strong>{' '}
            dari <strong className="text-slate-800">{filtered.length}</strong> agenda
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono font-semibold text-slate-700">
                {page}/{totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Sheet: Filter Jadwal */}
      <AdminMobileSheet
        isOpen={showMobileFilter}
        title="Filter Jadwal Agenda"
        onClose={() => setShowMobileFilter(false)}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
      >
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Periode Tanggal
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ['all', 'Semua'],
                ['today', 'Hari Ini'],
                ['week', 'Minggu Ini'],
                ['month', 'Bulan Ini'],
                ['custom', 'Pilih Tgl'],
              ] as [DateScope, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setDateScope(k)}
                className={`py-2 px-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                  dateScope === k
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {dateScope === 'custom' && (
            <div className="relative mt-2">
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs tabular-nums"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Personil (PIC)
          </label>
          <select
            value={selectedPic}
            onChange={(e) => setSelectedPic(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
          >
            <option value="ALL">Semua PIC ({uniquePics.length})</option>
            {uniquePics.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Kategori
            </label>
            <select
              value={selectedKind}
              onChange={(e) => setSelectedKind(e.target.value as ActivityKind | 'ALL')}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
            >
              <option value="ALL">Semua</option>
              <option value="VISIT">Visit Toko</option>
              <option value="NSO">NSO</option>
              <option value="MEETING">Meeting</option>
              <option value="TRAINING">Training</option>
              <option value="AUDIT">Audit</option>
              <option value="OPERATION">Operasional</option>
              <option value="OTHER">Lainnya</option>
              <option value="LEAVE">Cuti</option>
              <option value="OFF">Off / Libur</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
            >
              <option value="ALL">Semua</option>
              <option value="COMPLETED">Selesai</option>
              <option value="IN_PROGRESS">Di Toko</option>
              <option value="SCHEDULED">Terjadwal</option>
              <option value="KENDALA">Ada Kendala</option>
            </select>
          </div>
        </div>
      </AdminMobileSheet>

      {/* Mobile Bottom Sheet: Import & Export Excel */}
      <AdminMobileSheet
        isOpen={showMobileActions}
        title="Import & Export Jadwal"
        onClose={() => setShowMobileActions(false)}
      >
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              setShowMobileActions(false);
              onOpenUploadExcel();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-slate-200 bg-white active:bg-slate-50 text-left cursor-pointer"
          >
            <Upload className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900">Import Jadwal dari Excel</div>
              <div className="text-[11px] text-slate-500">Upload file .xlsx / .xls untuk update jadwal</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowMobileActions(false);
              handleExportFiltered();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-slate-200 bg-white active:bg-slate-50 text-left cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-700 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900">
                Tarik Data ke Excel ({filtered.length} baris)
              </div>
              <div className="text-[11px] text-slate-500">Unduh seluruh data jadwal sesuai filter aktif</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowMobileActions(false);
              exportScheduleToTemplateExcel(agendas, users);
            }}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-slate-200 bg-white active:bg-slate-50 text-left cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-900">Unduh Template Excel Jadwal</div>
              <div className="text-[11px] text-slate-500">Format resmi upload jadwal mingguan FMCU</div>
            </div>
          </button>
        </div>
      </AdminMobileSheet>
    </div>
  );
};
