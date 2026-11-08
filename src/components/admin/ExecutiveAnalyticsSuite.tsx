import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Store,
  Users,
  Calendar,
  Clock,
  ShieldCheck,
  Eye,
  Lock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Search,
  Download,
  Edit3,
  Trash2,
  Plus,
  Filter,
  ArrowUpRight,
  Layers,
  Activity,
  Award,
  Sparkles,
} from 'lucide-react';
import { ScheduleAgenda, ScheduleCategory, User } from '../../types';
import { StoreWithOwnership, isSamePersonName } from '../../data/masterStoresData';
import { getDailyStoreSequenceInfo } from '../../services/actualAttendanceService';

interface ExecutiveAnalyticsSuiteProps {
  currentUser: User;
  isReadOnly: boolean;
  agendas: ScheduleAgenda[];
  users: User[];
  stores: StoreWithOwnership[];
  bestieCount: number;
  onNavigateTab: (tab: any) => void;
  onOpenCreateAgenda?: () => void;
  onOpenEditAgenda?: (agenda: ScheduleAgenda) => void;
  onDeleteAgenda?: (id: string) => void;
  onExportExcel?: () => void;
  onOpenLiveMaps?: () => void;
}

const CATEGORY_META: Record<
  ScheduleCategory,
  { label: string; color: string; bg: string; text: string; border: string }
> = {
  VISIT: {
    label: 'Visit Store',
    color: '#0D9488',
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
  },
  NSO: {
    label: 'NSO Opening',
    color: '#EC4899',
    bg: 'bg-pink-50',
    text: 'text-pink-700',
    border: 'border-pink-200',
  },
  TRAINING: {
    label: 'Training / SBS',
    color: '#8B5CF6',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  MEETING: {
    label: 'Meeting',
    color: '#3B82F6',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  AUDIT: {
    label: 'Audit / QC',
    color: '#F59E0B',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  WORK_PLAN: {
    label: 'Work Plan',
    color: '#10B981',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  OPERATION: {
    label: 'Operations',
    color: '#6366F1',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
  },
  CUTI: {
    label: 'Cuti Resmi',
    color: '#F43F5E',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
  OFF: {
    label: 'Libur / OFF',
    color: '#94A3B8',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
  },
};

const DAY_LABELS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const SHORT_DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export const ExecutiveAnalyticsSuite: React.FC<ExecutiveAnalyticsSuiteProps> = ({
  currentUser,
  isReadOnly,
  agendas,
  users,
  stores,
  bestieCount,
  onNavigateTab,
  onOpenCreateAgenda,
  onOpenEditAgenda,
  onDeleteAgenda,
  onExportExcel,
  onOpenLiveMaps,
}) => {
  // Interactive Analytics Filters
  const [selectedDateRange, setSelectedDateRange] = useState<'ALL' | 'WEEK_1' | 'WEEK_2'>('ALL');
  const [selectedRmFilter, setSelectedRmFilter] = useState<string>('ALL');
  const [staffSortMode, setStaffSortMode] = useState<'MOST_VISITS' | 'AZ'>('MOST_VISITS');
  const [staffSearch, setStaffSearch] = useState<string>('');
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditFilterType, setAuditFilterType] = useState<'ALL' | 'MULTI_STORE' | 'CHECKED_IN'>('ALL');

  const staffUsers = useMemo(() => users.filter((u) => !u.isAdmin), [users]);

  // Unique dates sorted
  const allSortedDates = useMemo(() => {
    return Array.from(new Set(agendas.map((a) => a.date))).sort();
  }, [agendas]);

  // Unique Regional Managers
  const rmOptions = useMemo(() => {
    const s = new Set<string>();
    stores.forEach((st) => {
      if (st.regionalManager) s.add(st.regionalManager);
    });
    return Array.from(s).sort();
  }, [stores]);

  // Filtered Agendas for Analytics
  const scopedAgendas = useMemo(() => {
    return agendas.filter((item) => {
      if (selectedDateRange === 'WEEK_1' && allSortedDates.length > 0) {
        const w1End = allSortedDates[Math.min(6, allSortedDates.length - 1)];
        if (item.date > w1End) return false;
      } else if (selectedDateRange === 'WEEK_2' && allSortedDates.length > 7) {
        const w2Start = allSortedDates[7];
        if (item.date < w2Start) return false;
      }

      if (selectedRmFilter !== 'ALL') {
        if (item.regionalManager && item.regionalManager !== selectedRmFilter) {
          return false;
        }
      }
      return true;
    });
  }, [agendas, selectedDateRange, selectedRmFilter, allSortedDates]);

  // Core KPI Calculations
  const kpiStats = useMemo(() => {
    const total = scopedAgendas.length;
    const visitAgendas = scopedAgendas.filter((a) => a.category === 'VISIT');
    const nsoAgendas = scopedAgendas.filter((a) => a.category === 'NSO');
    const trainingMeetingAgendas = scopedAgendas.filter(
      (a) => a.category === 'TRAINING' || a.category === 'MEETING' || a.category === 'AUDIT'
    );
    const offCutiAgendas = scopedAgendas.filter(
      (a) => a.category === 'OFF' || a.category === 'CUTI'
    );

    // Unique visited/scheduled stores
    const uniqueScheduledStoreCodes = new Set(
      visitAgendas.map((a) => a.storeCode || a.location).filter(Boolean)
    );
    const totalOwnedStores = Math.max(1, bestieCount || 531);
    const coveragePercent = Math.min(
      100,
      Math.round((uniqueScheduledStoreCodes.size / totalOwnedStores) * 1000) / 10
    );

    // Multi-store same-day sessions (1 day >= 2 stores)
    const personDateVisitCount = new Map<string, number>();
    visitAgendas.forEach((a) => {
      const key = `${a.pic.toLowerCase()}|${a.date}`;
      personDateVisitCount.set(key, (personDateVisitCount.get(key) || 0) + 1);
    });
    let multiStoreDaysCount = 0;
    let multiStoreAgendasCount = 0;
    personDateVisitCount.forEach((count) => {
      if (count >= 2) {
        multiStoreDaysCount += 1;
        multiStoreAgendasCount += count;
      }
    });

    // Actual IN / OUT stats
    const checkedInVisits = visitAgendas.filter((a) => Boolean(a.actualIn));
    const completedVisits = visitAgendas.filter(
      (a) => Boolean(a.actualIn && a.actualOut) || a.completed
    );
    const onTimeVisits = checkedInVisits.filter(
      (a) => a.silentAudit?.inTimingStatus !== 'LATE'
    );
    const onTimeRate =
      checkedInVisits.length > 0
        ? Math.round((onTimeVisits.length / checkedInVisits.length) * 100)
        : 100;

    return {
      total,
      visitCount: visitAgendas.length,
      nsoCount: nsoAgendas.length,
      trainingMeetingCount: trainingMeetingAgendas.length,
      offCutiCount: offCutiAgendas.length,
      uniqueStoresScheduled: uniqueScheduledStoreCodes.size,
      coveragePercent,
      multiStoreDaysCount,
      multiStoreAgendasCount,
      checkedInCount: checkedInVisits.length,
      completedVisitsCount: completedVisits.length,
      onTimeRate,
      avgVisitsPerStaff:
        staffUsers.length > 0
          ? (visitAgendas.length / staffUsers.length).toFixed(1)
          : '0.0',
    };
  }, [scopedAgendas, bestieCount, staffUsers.length]);

  // Chart 1: Daily Distribution (Monday = 0 ... Sunday = 6)
  const dailyDistribution = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => ({
      dayIndex: i,
      label: DAY_LABELS[i],
      shortLabel: SHORT_DAYS[i],
      visit: 0,
      nso: 0,
      nonStore: 0,
      off: 0,
      total: 0,
    }));

    scopedAgendas.forEach((a) => {
      const dt = new Date(a.date + 'T00:00:00');
      if (isNaN(dt.getTime())) return;
      const jsDay = dt.getDay(); // 0=Sun, 1=Mon...
      const idx = jsDay === 0 ? 6 : jsDay - 1;
      days[idx].total += 1;
      if (a.category === 'VISIT') days[idx].visit += 1;
      else if (a.category === 'NSO') days[idx].nso += 1;
      else if (a.category === 'OFF' || a.category === 'CUTI') days[idx].off += 1;
      else days[idx].nonStore += 1;
    });

    const maxDayTotal = Math.max(1, ...days.map((d) => d.total));
    return { days, maxDayTotal };
  }, [scopedAgendas]);

  // Chart 2: Category Donut Breakdown
  const categoryBreakdown = useMemo(() => {
    const counts: Record<ScheduleCategory, number> = {
      VISIT: 0,
      NSO: 0,
      TRAINING: 0,
      MEETING: 0,
      AUDIT: 0,
      WORK_PLAN: 0,
      OPERATION: 0,
      CUTI: 0,
      OFF: 0,
    };
    scopedAgendas.forEach((a) => {
      counts[a.category] = (counts[a.category] || 0) + 1;
    });

    const total = Math.max(1, scopedAgendas.length);
    let cumulativePercent = 0;

    return (Object.keys(CATEGORY_META) as ScheduleCategory[])
      .map((cat) => {
        const count = counts[cat] || 0;
        const pct = Math.round((count / total) * 1000) / 10;
        const startPct = cumulativePercent;
        cumulativePercent += (count / total) * 100;
        return {
          category: cat,
          ...CATEGORY_META[cat],
          count,
          pct,
          startPct,
        };
      })
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [scopedAgendas]);

  // Chart 3: Staff Productivity & Multi-Store Analytics (36 Personnel)
  const staffProductivity = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        visit: number;
        nso: number;
        nonStore: number;
        off: number;
        ownedStoresCount: number;
        multiStoreDays: number;
        total: number;
      }
    >();

    // Seed from all staff users & agenda PICs
    const allNames = new Set<string>([
      ...staffUsers.map((u) => u.name),
      ...scopedAgendas.map((a) => a.pic).filter(Boolean),
    ]);

    allNames.forEach((name) => {
      const owned = stores.filter(
        (s) => s.ownerBestieName && isSamePersonName(s.ownerBestieName, name)
      ).length;
      map.set(name.toUpperCase(), {
        name,
        visit: 0,
        nso: 0,
        nonStore: 0,
        off: 0,
        ownedStoresCount: owned,
        multiStoreDays: 0,
        total: 0,
      });
    });

    const visitPerDayTracker = new Map<string, number>();

    scopedAgendas.forEach((a) => {
      const key = (a.pic || '').toUpperCase();
      if (!key) return;
      const entry = map.get(key) || {
        name: a.pic,
        visit: 0,
        nso: 0,
        nonStore: 0,
        off: 0,
        ownedStoresCount: 0,
        multiStoreDays: 0,
        total: 0,
      };
      entry.total += 1;
      if (a.category === 'VISIT') {
        entry.visit += 1;
        const dayKey = `${key}|${a.date}`;
        visitPerDayTracker.set(dayKey, (visitPerDayTracker.get(dayKey) || 0) + 1);
      } else if (a.category === 'NSO') {
        entry.nso += 1;
      } else if (a.category === 'OFF' || a.category === 'CUTI') {
        entry.off += 1;
      } else {
        entry.nonStore += 1;
      }
      map.set(key, entry);
    });

    visitPerDayTracker.forEach((cnt, dayKey) => {
      if (cnt >= 2) {
        const personKey = dayKey.split('|')[0];
        const entry = map.get(personKey);
        if (entry) entry.multiStoreDays += 1;
      }
    });

    const q = staffSearch.trim().toLowerCase();
    const list = Array.from(map.values()).filter((p) =>
      q ? p.name.toLowerCase().includes(q) : true
    );

    if (staffSortMode === 'AZ') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
    } else {
      list.sort(
        (a, b) =>
          b.visit - a.visit ||
          b.total - a.total ||
          a.name.localeCompare(b.name, 'id', { sensitivity: 'base' })
      );
    }

    const maxStaffTotal = Math.max(1, ...list.map((p) => p.total));
    return { list, maxStaffTotal };
  }, [staffUsers, scopedAgendas, stores, staffSearch, staffSortMode]);

  // Chart 4: Regional Manager & Store Type Coverage Breakdown
  const regionalBreakdown = useMemo(() => {
    const rmMap = new Map<
      string,
      { rmName: string; totalStores: number; ownedStores: number; scheduledVisits: number }
    >();

    stores.forEach((st) => {
      const rm = st.regionalManager || 'Lainnya';
      const curr = rmMap.get(rm) || {
        rmName: rm,
        totalStores: 0,
        ownedStores: 0,
        scheduledVisits: 0,
      };
      curr.totalStores += 1;
      if (st.ownerBestieName) curr.ownedStores += 1;
      rmMap.set(rm, curr);
    });

    scopedAgendas
      .filter((a) => a.category === 'VISIT')
      .forEach((a) => {
        const rm = a.regionalManager || 'Novy Rusnani';
        const curr = rmMap.get(rm);
        if (curr) {
          curr.scheduledVisits += 1;
        }
      });

    return Array.from(rmMap.values()).sort((a, b) => b.totalStores - a.totalStores);
  }, [stores, scopedAgendas]);

  // Live Attendance & Multi-Store Audit List (08:30 - 17:30 + 1 Day 2 Stores)
  const visitAuditList = useMemo(() => {
    const visits = scopedAgendas.filter((a) => a.category === 'VISIT');
    const q = auditSearch.trim().toLowerCase();

    return visits
      .map((item) => {
        const seq = getDailyStoreSequenceInfo(item, scopedAgendas);
        return {
          agenda: item,
          storeOrderIndex: seq.storeOrderIndex,
          totalStoresToday: seq.totalStoresToday,
        };
      })
      .filter(({ agenda, totalStoresToday }) => {
        if (auditFilterType === 'MULTI_STORE' && totalStoresToday < 2) return false;
        if (auditFilterType === 'CHECKED_IN' && !agenda.actualIn) return false;
        if (q) {
          return (
            agenda.pic.toLowerCase().includes(q) ||
            agenda.title.toLowerCase().includes(q) ||
            agenda.location.toLowerCase().includes(q) ||
            (agenda.storeCode || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort(
        (a, b) =>
          (b.agenda.actualIn ? 1 : 0) - (a.agenda.actualIn ? 1 : 0) ||
          a.agenda.date.localeCompare(b.agenda.date) ||
          a.agenda.pic.localeCompare(b.agenda.pic, 'id', { sensitivity: 'base' }) ||
          a.storeOrderIndex - b.storeOrderIndex
      );
  }, [scopedAgendas, auditSearch, auditFilterType]);

  return (
    <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-300">
      {/* =====================================================================
          1. ROLE-ADAPTIVE COMMAND BANNER (ADMIN vs EXECUTIVE VIEWER / HOD)
          ===================================================================== */}
      <div
        className={`relative overflow-hidden rounded-3xl p-5 sm:p-7 text-white shadow-lg transition-all duration-500 ${
          isReadOnly
            ? 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-400/25'
            : 'bg-gradient-to-br from-[#008972] via-[#006E5B] to-slate-900 border border-teal-400/25'
        }`}
      >
        {/* Decorative ambient glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-teal-400/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              {isReadOnly ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/25 border border-indigo-300/40 text-indigo-200 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                  <Eye className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Executive Viewer • Head of Division</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-emerald-200 text-[10px] sm:text-[11px] font-black uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Master Admin • Full Control &amp; Scheduler</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/90 text-[10px] font-bold">
                {isReadOnly ? (
                  <>
                    <Lock className="w-3 h-3 text-amber-300" />
                    <span>Akses Pengamat (Tanpa Edit Data)</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    <span>Hak Akses Penuh (Buat, Edit &amp; Impor Jadwal)</span>
                  </>
                )}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight leading-snug">
              {isReadOnly
                ? 'Executive Division Analytics & Operations Intelligence'
                : 'FMCU Command Center & Schedule Analytics'}
            </h1>

            <p className="text-xs sm:text-sm text-white/80 leading-relaxed font-normal">
              {isReadOnly
                ? `Selamat datang, ${currentUser.name}. Pantau secara real-time performa cakupan 610 toko, produktivitas 36 personel lapangan, tren jadwal mingguan, serta kepatuhan jam kerja (08:30 – 17:30) & multi-toko.`
                : `Kelola penuh jadwal mingguan 36 personel FMCU, sinkronisasi Excel 7 kolom, 610 Master Toko, serta pantau rekaman presensi Actual IN/OUT (08:30 – 17:30) secara langsung.`}
            </p>
          </div>

          {/* Right Quick Actions (Responsive for Mobile & Desktop) */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onOpenLiveMaps && (
              <button
                type="button"
                onClick={onOpenLiveMaps}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl bg-white text-slate-900 hover:bg-teal-50 text-xs font-black shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-teal-600" />
                <span>Live Maps &amp; Rute</span>
              </button>
            )}

            {onExportExcel && (
              <button
                type="button"
                onClick={onExportExcel}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-extrabold transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-300" />
                <span>Export Laporan (.xlsx)</span>
              </button>
            )}

            {!isReadOnly && onOpenCreateAgenda && (
              <button
                type="button"
                onClick={onOpenCreateAgenda}
                className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.8]" />
                <span>Buat Jadwal Baru</span>
              </button>
            )}
          </div>
        </div>

        {/* Interactive Filter Strip inside Hero */}
        <div className="relative z-10 mt-5 pt-4 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/60 mr-1 flex items-center gap-1 shrink-0">
              <Filter className="w-3 h-3" /> Periode:
            </span>
            {[
              { id: 'ALL', label: `Semua Jadwal (${agendas.length})` },
              { id: 'WEEK_1', label: 'Minggu Berjalan' },
              { id: 'WEEK_2', label: 'Minggu Berikutnya' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedDateRange(p.id as any)}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                  selectedDateRange === p.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/60 shrink-0">
              Filter RM:
            </span>
            <select
              value={selectedRmFilter}
              onChange={(e) => setSelectedRmFilter(e.target.value)}
              className="bg-white/15 border border-white/25 text-white rounded-xl px-3 py-1 text-xs font-bold outline-none focus:bg-slate-900 cursor-pointer"
            >
              <option value="ALL" className="text-slate-900">
                Semua Regional Manager ({rmOptions.length})
              </option>
              {rmOptions.map((rm) => (
                <option key={rm} value={rm} className="text-slate-900">
                  RM: {rm}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. EXECUTIVE KPI SUMMARY CARDS (4 BENTO METRICS WITH RADIAL PROGRESS)
          ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* KPI 1: Coverage Store Rate */}
        <div
          onClick={() => onNavigateTab('stores')}
          className="bg-white rounded-3xl p-4 sm:p-5 shadow-soft-card border border-slate-200/80 hover:border-teal-300 transition-all cursor-pointer flex items-center justify-between gap-3 group"
        >
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Cakupan Kunjungan Toko
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <h3 className="text-2xl font-black text-slate-900 tabular-nums">
                {kpiStats.uniqueStoresScheduled}
              </h3>
              <span className="text-xs font-bold text-teal-600">
                / {stores.length} Toko
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-1 truncate">
              {bestieCount} Toko Kepemilikan Bestie
            </p>
          </div>

          {/* Animated SVG Radial Gauge */}
          <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle
                cx="28"
                cy="28"
                r="22"
                stroke="#F1F5F9"
                strokeWidth="5"
                fill="transparent"
              />
              <circle
                cx="28"
                cy="28"
                r="22"
                stroke="#0D9488"
                strokeWidth="5"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray="138.2"
                strokeDashoffset={
                  138.2 - (138.2 * Math.min(100, kpiStats.coveragePercent)) / 100
                }
                className="transition-all duration-700"
              />
            </svg>
            <span className="absolute text-[11px] font-black text-teal-700 tabular-nums">
              {kpiStats.coveragePercent}%
            </span>
          </div>
        </div>

        {/* KPI 2: Visit Store & Multi-Toko */}
        <div
          onClick={() => onNavigateTab('schedules')}
          className="bg-white rounded-3xl p-4 sm:p-5 shadow-soft-card border border-slate-200/80 hover:border-teal-300 transition-all cursor-pointer flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Total Visit Store &amp; NSO
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-black text-slate-900 tabular-nums">
                {kpiStats.visitCount}
              </h3>
              <span className="text-xs font-extrabold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200">
                +{kpiStats.nsoCount} NSO
              </span>
            </div>
            <p className="text-[11px] font-semibold text-teal-700 mt-1 truncate">
              {kpiStats.multiStoreDaysCount} sesi kunjungan 1 hari 2+ toko
            </p>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <Store className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3: Kepatuhan Jam Kerja (08:30 - 17:30) */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-soft-card border border-slate-200/80 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Kepatuhan Jam (08:30–17:30)
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-black text-slate-900 tabular-nums">
                {kpiStats.onTimeRate}%
              </h3>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                On-Time
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-1 truncate">
              {kpiStats.checkedInCount} terekam Actual IN • {kpiStats.completedVisitsCount} selesai
            </p>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 4: Produktivitas 36 Personel */}
        <div
          onClick={() => onNavigateTab('users')}
          className="bg-white rounded-3xl p-4 sm:p-5 shadow-soft-card border border-slate-200/80 hover:border-teal-300 transition-all cursor-pointer flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Rasio Beban Personel
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <h3 className="text-2xl font-black text-slate-900 tabular-nums">
                {kpiStats.avgVisitsPerStaff}
              </h3>
              <span className="text-xs font-bold text-indigo-600">
                Visit / Orang
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-1 truncate">
              {staffUsers.length} Personel Aktif • {kpiStats.trainingMeetingCount} Non-Store
            </p>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. ROW 1 CHARTS: TREN HARIAN (SENIN-MINGGU) & DONUT KOMPOSISI AGENDA
          ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* CHART 1: Tren Aktivitas Harian (Senin s/d Minggu) — 7 Columns */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 shadow-soft-card border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-teal-600" />
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Grafik Tren Aktivitas Harian (Senin – Minggu)
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Klik batang hari untuk melihat rincian perbandingan Visit Store, NSO, Non-Store, dan OFF
                </p>
              </div>

              {/* Legend Pills */}
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                <span className="inline-flex items-center gap-1 text-teal-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-teal-600" /> Visit
                </span>
                <span className="inline-flex items-center gap-1 text-pink-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-pink-500" /> NSO
                </span>
                <span className="inline-flex items-center gap-1 text-indigo-700">
                  <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> Training/Meeting
                </span>
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-300" /> OFF/Cuti
                </span>
              </div>
            </div>

            {/* Interactive Bar Chart Canvas */}
            <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-52 pt-6 pb-2 px-1 border-b border-slate-100">
              {dailyDistribution.days.map((d, idx) => {
                const isSelected = activeDayIndex === idx;
                const heightPct = Math.max(
                  8,
                  Math.round((d.total / dailyDistribution.maxDayTotal) * 100)
                );
                const visitShare = d.total > 0 ? (d.visit / d.total) * 100 : 0;
                const nsoShare = d.total > 0 ? (d.nso / d.total) * 100 : 0;
                const nonStoreShare = d.total > 0 ? (d.nonStore / d.total) * 100 : 0;
                const offShare = d.total > 0 ? (d.off / d.total) * 100 : 0;

                return (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => setActiveDayIndex(isSelected ? null : idx)}
                    className={`group flex flex-col items-center h-full justify-end cursor-pointer transition-all ${
                      isSelected ? 'scale-105' : 'hover:scale-[1.02]'
                    }`}
                  >
                    {/* Value Pill Above Bar */}
                    <span
                      className={`text-[10px] font-black mb-1.5 px-1.5 py-0.5 rounded-md tabular-nums transition-colors ${
                        isSelected
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 group-hover:text-teal-700'
                      }`}
                    >
                      {d.total}
                    </span>

                    {/* Stacked Bar */}
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[38px] rounded-t-2xl overflow-hidden flex flex-col-reverse bg-slate-100 transition-all duration-500 shadow-xs ${
                        isSelected ? 'ring-2 ring-teal-500 ring-offset-2' : ''
                      }`}
                    >
                      {visitShare > 0 && (
                        <div
                          style={{ height: `${visitShare}%` }}
                          className="w-full bg-gradient-to-t from-teal-600 to-emerald-500 transition-all duration-500"
                          title={`Visit Store: ${d.visit}`}
                        />
                      )}
                      {nsoShare > 0 && (
                        <div
                          style={{ height: `${nsoShare}%` }}
                          className="w-full bg-pink-500 transition-all duration-500"
                          title={`NSO: ${d.nso}`}
                        />
                      )}
                      {nonStoreShare > 0 && (
                        <div
                          style={{ height: `${nonStoreShare}%` }}
                          className="w-full bg-indigo-500 transition-all duration-500"
                          title={`Training / Meeting: ${d.nonStore}`}
                        />
                      )}
                      {offShare > 0 && (
                        <div
                          style={{ height: `${offShare}%` }}
                          className="w-full bg-slate-300 transition-all duration-500"
                          title={`OFF / Cuti: ${d.off}`}
                        />
                      )}
                    </div>

                    {/* Day Name */}
                    <span
                      className={`text-[11px] font-extrabold mt-2 ${
                        isSelected ? 'text-teal-700' : 'text-slate-600'
                      }`}
                    >
                      <span className="sm:hidden">{d.shortLabel}</span>
                      <span className="hidden sm:inline">{d.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Interactive Breakdown Footer */}
          <div className="mt-4 pt-3 flex flex-wrap items-center justify-between gap-2 bg-slate-50/90 rounded-2xl px-3.5 py-2.5 border border-slate-100 text-xs">
            {activeDayIndex !== null ? (
              <>
                <span className="font-black text-slate-800">
                  Detail Hari {dailyDistribution.days[activeDayIndex].label}:
                </span>
                <div className="flex flex-wrap items-center gap-3 font-bold">
                  <span className="text-teal-700">
                    Visit: {dailyDistribution.days[activeDayIndex].visit}
                  </span>
                  <span className="text-pink-600">
                    NSO: {dailyDistribution.days[activeDayIndex].nso}
                  </span>
                  <span className="text-indigo-600">
                    Non-Store: {dailyDistribution.days[activeDayIndex].nonStore}
                  </span>
                  <span className="text-slate-500">
                    OFF/Cuti: {dailyDistribution.days[activeDayIndex].off}
                  </span>
                </div>
              </>
            ) : (
              <>
                <span className="text-slate-500 font-semibold">
                   puncak aktivitas kunjungan berada pada hari kerja Senin – Jumat
                </span>
                <span className="font-black text-teal-700">
                  Total {scopedAgendas.length} Agenda Terjadwal
                </span>
              </>
            )}
          </div>
        </div>

        {/* CHART 2: Donut Chart Komposisi Kategori Agenda — 5 Columns */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 shadow-soft-card border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Proporsi Kategori Agenda
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Distribusi beban kerja operasional seluruh tim FMCU
                </p>
              </div>
              <span className="text-[11px] font-black text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">
                {categoryBreakdown.length} Kategori Aktif
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-5 my-2">
              {/* SVG Multi-Segment Donut Chart */}
              <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#F1F5F9"
                    strokeWidth="14"
                  />
                  {categoryBreakdown.map((seg) => {
                    const circumference = 2 * Math.PI * 38; // ~238.76
                    const strokeDash = (seg.pct / 100) * circumference;
                    const strokeOffset = -((seg.startPct / 100) * circumference);
                    return (
                      <circle
                        key={seg.category}
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="14"
                        strokeDasharray={`${strokeDash} ${circumference}`}
                        strokeDashoffset={strokeOffset}
                        className="transition-all duration-700"
                      />
                    );
                  })}
                </svg>
                <div className="absolute text-center">
                  <span className="text-lg font-black text-slate-900 block leading-none tabular-nums">
                    {scopedAgendas.length}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Total Agenda
                  </span>
                </div>
              </div>

              {/* Category Breakdown List */}
              <div className="w-full space-y-2 flex-1 max-h-48 overflow-y-auto no-scrollbar pr-1">
                {categoryBreakdown.map((item) => (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span className="font-black text-slate-900 tabular-nums">
                        {item.count}{' '}
                        <span className="text-[10px] font-semibold text-slate-400">
                          ({item.pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(3, item.pct)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Fokus Lapangan (Visit + NSO):</span>
            <span className="font-black text-teal-700">
              {Math.round(
                ((kpiStats.visitCount + kpiStats.nsoCount) / Math.max(1, kpiStats.total)) * 100
              )}
              % dari seluruh aktivitas
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          4. ROW 2 CHARTS: RANKING PRODUKTIVITAS 36 PERSONEL & CAKUPAN WILAYAH RM
          ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* CHART 3: Analitik Produktivitas & Beban Kerja 36 Personel — 7 Columns */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 shadow-soft-card border border-slate-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  Matriks Produktivitas &amp; Beban Kerja 36 Personel
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Perbandingan jumlah Visit Store, NSO, sesi 1 hari 2 toko, dan kuota toko kepemilikan Bestie
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-44">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  placeholder="Filter nama tim..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-teal-500"
                />
              </div>

              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setStaffSortMode('MOST_VISITS')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                    staffSortMode === 'MOST_VISITS'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  Top Visit
                </button>
                <button
                  type="button"
                  onClick={() => setStaffSortMode('AZ')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                    staffSortMode === 'AZ'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500'
                  }`}
                >
                  A–Z
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Horizontal Bar Ranking List */}
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {staffProductivity.list.map((person, index) => {
              const visitWidth = (person.visit / staffProductivity.maxStaffTotal) * 100;
              const nsoWidth = (person.nso / staffProductivity.maxStaffTotal) * 100;
              const otherWidth = (person.nonStore / staffProductivity.maxStaffTotal) * 100;

              return (
                <div
                  key={person.name}
                  className="p-2.5 rounded-2xl bg-slate-50/70 hover:bg-slate-50 border border-slate-100 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-200/80 text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0 tabular-nums">
                        {index + 1}
                      </span>
                      <span className="text-xs font-black text-slate-900 truncate">
                        {person.name}
                      </span>
                      {person.ownedStoresCount > 0 && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                          ★ {person.ownedStoresCount} Toko Bestie
                        </span>
                      )}
                      {person.multiStoreDays > 0 && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 shrink-0">
                          {person.multiStoreDays}x (1 Hari 2 Toko)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-bold tabular-nums">
                      <span className="text-teal-700 font-black">{person.visit} Visit</span>
                      {person.nso > 0 && (
                        <span className="text-pink-600">{person.nso} NSO</span>
                      )}
                      {person.nonStore > 0 && (
                        <span className="text-indigo-600">{person.nonStore} Agenda</span>
                      )}
                      <span className="text-slate-400">({person.total} total)</span>
                    </div>
                  </div>

                  {/* Multi-Segment Progress Bar */}
                  <div className="w-full h-2 bg-slate-200/70 rounded-full overflow-hidden flex">
                    {visitWidth > 0 && (
                      <div
                        style={{ width: `${visitWidth}%` }}
                        className="h-full bg-teal-600 transition-all duration-500"
                      />
                    )}
                    {nsoWidth > 0 && (
                      <div
                        style={{ width: `${nsoWidth}%` }}
                        className="h-full bg-pink-500 transition-all duration-500"
                      />
                    )}
                    {otherWidth > 0 && (
                      <div
                        style={{ width: `${otherWidth}%` }}
                        className="h-full bg-indigo-500 transition-all duration-500"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CHART 4: Distribusi Wilayah Regional Manager (RM) — 5 Columns */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 shadow-soft-card border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-600" />
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Distribusi Wilayah Regional Manager
                  </h3>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Sebaran 610 Master Toko &amp; Kepemilikan per Regional Manager
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('stores')}
                className="text-[11px] font-extrabold text-teal-700 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>Master Toko</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {regionalBreakdown.map((rm) => {
                const sharePct = Math.round((rm.totalStores / Math.max(1, stores.length)) * 100);
                const ownedPct = Math.round(
                  (rm.ownedStores / Math.max(1, rm.totalStores)) * 100
                );
                return (
                  <div
                    key={rm.rmName}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-slate-800 truncate">
                        RM: {rm.rmName}
                      </span>
                      <span className="font-extrabold text-teal-700 tabular-nums">
                        {rm.totalStores} Cabang ({sharePct}%)
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${ownedPct}%` }}
                        className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                      <span>{rm.ownedStores} Toko Kepemilikan Bestie ({ownedPct}%)</span>
                      <span className="text-indigo-600 font-bold">
                        {rm.scheduledVisits} Jadwal Visit Aktif
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 p-3 rounded-2xl bg-teal-50/70 border border-teal-200/70 flex items-center justify-between text-xs">
            <span className="font-bold text-teal-900">
              Total Jaringan Terintegrasi:
            </span>
            <span className="font-black text-teal-800">
              {stores.length} Toko • {bestieCount} Kepemilikan Aktif
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          5. LIVE SILENT ATTENDANCE & MULTI-STORE AUDIT MONITOR (08:30 - 17:30)
          ===================================================================== */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-soft-card border border-slate-200/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                Monitor Presensi Aktual (08:30 – 17:30) &amp; Sesi Multi-Toko
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                Silent Background Audit
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Pantauan jam Actual IN, Actual OUT, urutan kunjungan 1 hari 2 toko (Transit), serta verifikasi posisi latar belakang
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Pills */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'ALL', label: 'Semua Visit' },
                { id: 'MULTI_STORE', label: '1 Hari 2+ Toko' },
                { id: 'CHECKED_IN', label: 'Sudah Check-In' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAuditFilterType(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                    auditFilterType === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Cari nama, kode toko, lokasi..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Responsive Table / Mobile Card Hybrid */}
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                <th className="py-3 px-3.5">Personel (PIC)</th>
                <th className="py-3 px-3.5">Tanggal &amp; Sesi</th>
                <th className="py-3 px-3.5">Toko Tujuan</th>
                <th className="py-3 px-3.5">Actual IN (08:30)</th>
                <th className="py-3 px-3.5">Actual OUT (17:30)</th>
                <th className="py-3 px-3.5">Audit Sistem (Senyap)</th>
                <th className="py-3 px-3.5 text-right">
                  {isReadOnly ? 'Hak Akses' : 'Kendali Admin'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {visitAuditList.slice(0, 15).map(({ agenda, storeOrderIndex, totalStoresToday }) => {
                const audit = agenda.silentAudit;
                return (
                  <tr key={agenda.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                      {agenda.pic}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="font-bold text-slate-800 block">{agenda.date}</span>
                      {totalStoresToday > 1 ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-teal-50 text-teal-700 border border-teal-200 mt-0.5">
                          Toko Ke-{storeOrderIndex} dari {totalStoresToday}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">1 Toko Seharian</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 max-w-[210px] truncate">
                      {agenda.storeCode && (
                        <span className="font-mono font-black text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded mr-1.5 text-[10px]">
                          {agenda.storeCode}
                        </span>
                      )}
                      <span className="font-bold text-slate-800">
                        {agenda.storeName || agenda.location}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {agenda.actualIn ? (
                        <div>
                          <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            {agenda.actualIn}
                          </span>
                          {audit?.inTimingStatus === 'LATE' && (
                            <span className="block text-[9px] font-bold text-rose-600 mt-0.5">
                              Telat +{audit.lateMinutes || 0}m
                            </span>
                          )}
                          {audit?.inTimingStatus === 'CONTINUATION_VISIT' && (
                            <span className="block text-[9px] font-bold text-teal-600 mt-0.5">
                              Lanjutan Toko {storeOrderIndex}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Terjadwal ({agenda.time})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {agenda.actualOut ? (
                        <div>
                          <span className="font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            {agenda.actualOut}
                          </span>
                          {audit?.outTimingStatus === 'TRANSIT_TO_NEXT_STORE' && (
                            <span className="block text-[9px] font-bold text-indigo-600 mt-0.5">
                              Transit ke Toko {storeOrderIndex + 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Target {storeOrderIndex < totalStoresToday ? 'Transit' : '17:30'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {audit?.inDistanceToStoreMeters !== undefined ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Radius {audit.inDistanceToStoreMeters}m</span>
                        </span>
                      ) : agenda.actualIn ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Verified</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Menunggu Kunjungan</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      {isReadOnly ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-bold">
                          <Lock className="w-3 h-3" />
                          <span>Read-Only</span>
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          {onOpenEditAgenda && (
                            <button
                              type="button"
                              onClick={() => onOpenEditAgenda(agenda)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 transition cursor-pointer"
                              title="Edit Jadwal"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteAgenda && (
                            <button
                              type="button"
                              onClick={() => onDeleteAgenda(agenda.id)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                              title="Hapus Jadwal"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
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
  );
};
