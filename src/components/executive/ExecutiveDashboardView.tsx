import React, { useState, useMemo } from 'react';
import {
  Compass,
  Radio,
  Store,
  Users,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin,
  TrendingUp,
  FileText,
  Clock,
  Sparkles,
  Award,
  ShieldCheck,
  ChevronRight,
  Search,
  ExternalLink,
  Activity,
  Navigation,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { ScheduleAgenda, ScheduleCategory, User, VisitReportData } from '../../types';
import { StoreWithOwnership, isSamePersonName } from '../../data/masterStoresData';
import { UserLivePresence } from '../../services/userLivePresenceService';
import { resolveVisitedStoreReportData } from '../HistoryView';
import { getLocalDateYmd } from '../../utils/mapGeoUtils';
import { getMondayOfWeek, getFullWeekDays } from '../../services/scheduleExcelService';
import { getGDriveReportRegistryEntry, FMCU_REPORT_GDRIVE_FOLDER_URL } from '../../services/pdfGeneratorService';
import { findVerifiedGDriveReport, VerifiedGDriveReportMeta } from '../../services/gdriveReportLiveService';

interface ExecutiveDashboardViewProps {
  currentUser: User;
  agendas: ScheduleAgenda[];
  users: User[];
  stores: StoreWithOwnership[];
  livePresences: UserLivePresence[];
  cloudReports: (VisitReportData & { updatedAtMs?: number })[];
  onOpenLiveMaps?: () => void;
  onNavigateTab: (tab: any) => void;
  onOpenReportPreview: (params: {
    reportData: VisitReportData;
    gdrivePdfUrl: string;
    gdriveEmbedUrl?: string;
    storeFolderName?: string;
    pdfFileName?: string;
    gdriveSavedDate?: string;
  }) => void;
}

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  currentUser,
  agendas,
  users,
  stores,
  livePresences,
  cloudReports,
  onOpenLiveMaps,
  onNavigateTab,
  onOpenReportPreview,
}) => {
  const [activityPeriod, setActivityPeriod] = useState<'ALL' | 'MONTH' | 'WEEK' | 'TODAY'>('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'GDRIVE_ONLY'>('ALL');
  const [historyCategoryTab, setHistoryCategoryTab] = useState<'VISIT' | 'NSO' | 'ALL'>('VISIT');
  const [selectedRmFilter, setSelectedRmFilter] = useState<string>('ALL');

  const todayYmd = useMemo(() => getLocalDateYmd(), []);
  const fieldStaff = useMemo(() => users.filter((u) => !u.isAdmin), [users]);

  // 1. LIVE ACTIVE GPS RADAR PERSONNEL
  const now = Date.now();
  const activeRadarUsers = useMemo(() => {
    return livePresences.filter(
      (p) => p.isWebActive && p.isGpsActive && now - p.lastSeenMs < 3 * 60 * 1000
    );
  }, [livePresences, now]);

  // 2. PRODUCTIVITY STATS
  const productivityStats = useMemo(() => {
    const todayAgendas = agendas.filter((a) => a.date === todayYmd);
    const todayVisits = todayAgendas.filter(
      (a) => a.category === 'VISIT' || a.category === 'NSO' || Boolean(a.storeCode)
    );
    const todayCompleted = todayVisits.filter((a) => a.completed);

    const activeStaffCount = fieldStaff.length;
    const staffWithAgendaToday = new Set(todayAgendas.map((a) => a.pic)).size;
    const attendanceRate =
      activeStaffCount > 0 ? Math.round((staffWithAgendaToday / activeStaffCount) * 100) : 100;

    const totalAllVisits = agendas.filter(
      (a) => a.category === 'VISIT' || a.category === 'NSO' || Boolean(a.storeCode)
    ).length;
    const totalAllCompleted = agendas.filter(
      (a) =>
        (a.category === 'VISIT' || a.category === 'NSO' || Boolean(a.storeCode)) &&
        (a.completed || a.date < todayYmd)
    ).length;
    const overallCompletionRate =
      totalAllVisits > 0 ? Math.round((totalAllCompleted / totalAllVisits) * 100) : 92;

    return {
      activeStaffCount,
      activeRadarCount: activeRadarUsers.length,
      todayAgendasCount: todayAgendas.length,
      todayVisitsCount: todayVisits.length,
      todayCompletedCount: todayCompleted.length,
      attendanceRate,
      overallCompletionRate,
    };
  }, [agendas, todayYmd, fieldStaff, activeRadarUsers]);

  // 3. STORE & TEAM COVERAGE STATS
  const coverageStats = useMemo(() => {
    const totalStores = stores.length || 610;

    // Unique store codes scheduled in agendas
    const coveredStoreCodes = new Set<string>();
    agendas.forEach((a) => {
      if (a.storeCode && a.storeCode !== 'STORE') {
        coveredStoreCodes.add(String(a.storeCode).toUpperCase());
      }
    });

    const coveredCount = coveredStoreCodes.size;
    const pendingCount = Math.max(0, totalStores - coveredCount);
    const coveragePercentage = Math.round((coveredCount / totalStores) * 100);

    const ownedStoresCount = stores.filter((s) => s.ownerBestieName).length;
    const avgStoresPerBestie =
      fieldStaff.length > 0 ? (ownedStoresCount / fieldStaff.length).toFixed(1) : '16.1';

    return {
      totalStores,
      coveredCount,
      pendingCount,
      coveragePercentage,
      ownedStoresCount,
      avgStoresPerBestie,
    };
  }, [stores, agendas, fieldStaff]);

  // 4. ACTIVITY CATEGORY CLASSIFICATION
  const activityFilteredAgendas = useMemo(() => {
    const currentMonday = getMondayOfWeek(todayYmd);
    const weekDays = new Set(getFullWeekDays(currentMonday).map((d) => d.dateStr));
    const currentMonthPrefix = todayYmd.slice(0, 7); // e.g. "2026-11"

    return agendas.filter((a) => {
      if (activityPeriod === 'TODAY') return a.date === todayYmd;
      if (activityPeriod === 'WEEK') return weekDays.has(a.date);
      if (activityPeriod === 'MONTH') return (a.date || '').startsWith(currentMonthPrefix);
      return true;
    });
  }, [agendas, todayYmd, activityPeriod]);

  const categoryDistribution = useMemo(() => {
    const counts: Record<string, number> = {
      VISIT: 0,
      NSO: 0,
      AUDIT: 0,
      TRAINING: 0,
      MEETING: 0,
      WORK_PLAN: 0,
      OPERATION: 0,
      OFF: 0,
      CUTI: 0,
    };

    activityFilteredAgendas.forEach((a) => {
      const cat = a.category || 'OPERATION';
      if (counts[cat] !== undefined) {
        counts[cat]++;
      } else {
        counts['OPERATION']++;
      }
    });

    const total = activityFilteredAgendas.length || 1;
    return Object.entries(counts).map(([cat, count]) => ({
      category: cat as ScheduleCategory,
      count,
      percentage: Math.round((count / total) * 100),
    }));
  }, [activityFilteredAgendas]);

  // 5. REGIONAL OPERATIONAL DISTRIBUTION
  const regionalDistribution = useMemo(() => {
    const rmMap = new Map<
      string,
      {
        rmName: string;
        storeCount: number;
        visitCount: number;
        cities: Set<string>;
        areaManagers: Set<string>;
      }
    >();

    // Seed master stores
    stores.forEach((st) => {
      const rm = st.regionalManager || 'Non-Regional';
      if (!rmMap.has(rm)) {
        rmMap.set(rm, {
          rmName: rm,
          storeCount: 0,
          visitCount: 0,
          cities: new Set<string>(),
          areaManagers: new Set<string>(),
        });
      }
      const entry = rmMap.get(rm)!;
      entry.storeCount++;
      if (st.city) entry.cities.add(st.city);
      if (st.areaManager) entry.areaManagers.add(st.areaManager);
    });

    // Count scheduled visits in each region
    agendas.forEach((ag) => {
      if (ag.regionalManager && rmMap.has(ag.regionalManager)) {
        rmMap.get(ag.regionalManager)!.visitCount++;
      }
    });

    return Array.from(rmMap.values()).sort((a, b) => b.storeCount - a.storeCount);
  }, [stores, agendas]);

  // 6. COMPLETED STORE VISITS WITH REAL-TIME GDRIVE PREVIEW
  const completedVisits = useMemo(() => {
    // Collect all visits that have report or completed or past date
    const visitAgendas = agendas
      .filter((a) => a.category === 'VISIT' || a.category === 'NSO' || Boolean(a.storeCode))
      .filter((a) => a.completed || a.date <= todayYmd)
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.time || '').localeCompare(a.time || '');
      });

    return visitAgendas.map((ag) => {
      // Find verified report from real-time Google Drive / Cloud Vault
      const verifiedMeta = findVerifiedGDriveReport({
        storeCode: ag.storeCode,
        storeName: ag.storeName || ag.location,
        agendaId: ag.id,
        visitDate: ag.date,
        cloudReports,
      });

      const isNso =
        ag.category === 'NSO' ||
        String(ag.title || '').toUpperCase().includes('NSO') ||
        String(ag.location || '').toUpperCase().includes('NSO');

      return {
        agenda: ag,
        isNso,
        verifiedMeta,
        hasReport: Boolean(verifiedMeta),
        gdrivePdfUrl: verifiedMeta?.gdrivePdfUrl || FMCU_REPORT_GDRIVE_FOLDER_URL,
        gdriveEmbedUrl: verifiedMeta?.gdriveEmbedUrl,
        storeFolderName: verifiedMeta?.storeFolderName,
        pdfFileName: verifiedMeta?.pdfFileName,
        gdriveSavedDate: verifiedMeta?.gdriveSavedDate,
      };
    });
  }, [agendas, todayYmd, cloudReports]);

  const visitCount = useMemo(
    () => completedVisits.filter((v) => !v.isNso).length,
    [completedVisits]
  );
  const nsoCount = useMemo(
    () => completedVisits.filter((v) => v.isNso).length,
    [completedVisits]
  );

  const filteredCompletedVisits = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return completedVisits.filter((item) => {
      if (historyCategoryTab === 'VISIT' && item.isNso) return false;
      if (historyCategoryTab === 'NSO' && !item.isNso) return false;
      if (historyFilter === 'GDRIVE_ONLY' && !item.hasReport) return false;
      if (!q) return true;
      const ag = item.agenda;
      return (
        ag.title.toLowerCase().includes(q) ||
        (ag.storeCode || '').toLowerCase().includes(q) ||
        (ag.storeName || '').toLowerCase().includes(q) ||
        (ag.location || '').toLowerCase().includes(q) ||
        (ag.pic || '').toLowerCase().includes(q)
      );
    });
  }, [completedVisits, historySearch, historyFilter, historyCategoryTab]);

  const handlePreviewReport = (item: (typeof completedVisits)[0]) => {
    if (!item.hasReport || !item.verifiedMeta) return;

    onOpenReportPreview({
      reportData: item.verifiedMeta.reportData,
      gdrivePdfUrl: item.verifiedMeta.gdrivePdfUrl,
      gdriveEmbedUrl: item.verifiedMeta.gdriveEmbedUrl,
      storeFolderName: item.verifiedMeta.storeFolderName,
      pdfFileName: item.verifiedMeta.pdfFileName,
      gdriveSavedDate: item.verifiedMeta.gdriveSavedDate,
    });
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          CARD 1: PRODUKTIVITAS & RADAR LAPANGAN
          ========================================================================= */}
      <div className="bg-white rounded-[32px] p-5 sm:p-7 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-6 rounded-full bg-[#10B981]" />
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Card 1: Produktivitas &amp; Radar Lapangan
              </h2>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Live Monitoring Kinerja Tim &amp; Deteksi Posisi GPS Personel Realtime
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-extrabold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{productivityStats.activeRadarCount} Personel Online GPS</span>
            </span>

            {onOpenLiveMaps && (
              <button
                type="button"
                onClick={onOpenLiveMaps}
                className="px-3.5 py-1.5 rounded-2xl bg-[#3A657C] hover:bg-slate-900 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Buka Radar Peta</span>
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Responsive Layout: Produktivitas (Kiri) & Radar Visual (Kanan) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5">
          {/* Sisi Kiri: Matriks Produktivitas Tim (7 Kolom) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-slate-200/70">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
                  Total Tim Lapangan
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 mt-1 block">
                  {productivityStats.activeStaffCount}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold mt-0.5 block">
                  Field Specialists
                </span>
              </div>

              <div className="bg-[#F0FDF4] p-3.5 rounded-2xl border border-emerald-200/80">
                <span className="text-[10px] font-extrabold uppercase text-emerald-700 block tracking-wider">
                  Kunjungan Hari Ini
                </span>
                <span className="text-xl sm:text-2xl font-black text-emerald-900 mt-1 block">
                  {productivityStats.todayVisitsCount}
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold mt-0.5 block">
                  Target Visit Toko
                </span>
              </div>

              <div className="bg-[#EFF6FF] p-3.5 rounded-2xl border border-blue-200/80">
                <span className="text-[10px] font-extrabold uppercase text-blue-700 block tracking-wider">
                  Tingkat Kehadiran
                </span>
                <span className="text-xl sm:text-2xl font-black text-blue-900 mt-1 block">
                  {productivityStats.attendanceRate}%
                </span>
                <span className="text-[10px] text-blue-700 font-semibold mt-0.5 block">
                  Terjadwal Hari Ini
                </span>
              </div>

              <div className="bg-[#FAF5FF] p-3.5 rounded-2xl border border-purple-200/80">
                <span className="text-[10px] font-extrabold uppercase text-purple-700 block tracking-wider">
                  Efektivitas Kerja
                </span>
                <span className="text-xl sm:text-2xl font-black text-purple-900 mt-1 block">
                  {productivityStats.overallCompletionRate}%
                </span>
                <span className="text-[10px] text-purple-700 font-semibold mt-0.5 block">
                  Laporan Tuntas
                </span>
              </div>
            </div>

            {/* Jam Kerja Efektif & Standar Operasional */}
            <div className="bg-[#F8F9FA] rounded-2xl p-4 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800">
                    Standar Jam Operasional: 08:30 – 17:30 WIB (9 Jam)
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Tracking otomatis via koordinat presensi GPS aktif dan laporan visit per toko
                  </p>
                </div>
              </div>

              <span className="self-start sm:self-auto px-3 py-1 bg-white rounded-xl border border-slate-200 text-[10.5px] font-black text-slate-700 shadow-2xs">
                Status: Efektif Sesuai SOP
              </span>
            </div>
          </div>

          {/* Sisi Kanan: Radar Visual Real-time (5 Kolom) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-5 text-white flex flex-col justify-between relative overflow-hidden shadow-md">
            {/* Ambient Background Circles */}
            <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full border border-teal-500/20 pointer-events-none" />
            <div className="absolute -right-16 -bottom-16 w-60 h-60 rounded-full border border-teal-500/10 pointer-events-none" />

            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-[10px] font-black uppercase tracking-wider">
                  <Radio className="w-3 h-3 text-teal-400 animate-pulse" />
                  Live GPS Radar
                </span>
                <span className="text-[10px] text-slate-400 font-bold">WIB (UTC+7)</span>
              </div>

              <h4 className="text-sm sm:text-base font-black text-white">
                {productivityStats.activeRadarCount > 0
                  ? `${productivityStats.activeRadarCount} Personel Sedang di Lapangan`
                  : 'Seluruh Personel Standby / Menunggu Sesi'}
              </h4>
              <p className="text-[11px] text-slate-300 font-medium mt-1 leading-relaxed">
                Pemantauan radar mendeteksi staf yang aktif membuka aplikasi web dengan modul GPS
                terverifikasi.
              </p>
            </div>

            {/* Radar Quick Personnel List */}
            <div className="my-4 space-y-1.5 max-h-36 overflow-y-auto no-scrollbar pr-1">
              {activeRadarUsers.length > 0 ? (
                activeRadarUsers.slice(0, 3).map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-xl border border-white/10 text-xs transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="font-bold text-white truncate text-[11px]">{p.userName}</span>
                    </div>
                    <span className="text-[9.5px] font-extrabold text-teal-300 tabular-nums">
                      {p.lat.toFixed(3)}°, {p.lng.toFixed(3)}°
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-center text-xs text-slate-400">
                  Belum ada staf online saat ini
                </div>
              )}
            </div>

            {onOpenLiveMaps && (
              <button
                type="button"
                onClick={onOpenLiveMaps}
                className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#10B981] to-[#0D9488] hover:brightness-110 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Buka Radar &amp; Jalur Toko Lengkap</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          CARD 2: CAKUPAN TOKO DAN TIM
          ========================================================================= */}
      <div className="bg-white rounded-[32px] p-5 sm:p-7 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-6 rounded-full bg-[#3A657C]" />
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Card 2: Cakupan Toko dan Tim
              </h2>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Status 610 Jaringan Toko FamilyMart &amp; Beban Kerja 33 Personel Bestie In Charge
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-slate-100 rounded-full text-slate-700 text-xs font-black">
              Total 610 Toko
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('stores')}
              className="px-3 py-1 rounded-full bg-[#3A657C] hover:bg-slate-900 text-white text-xs font-extrabold flex items-center gap-1 transition cursor-pointer"
            >
              <span>Lihat Master Toko</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Stat Pill Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-5">
          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Jaringan Toko
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">610</span>
            <span className="text-[10.5px] text-slate-500 font-semibold block mt-0.5">
              Toko FamilyMart Terdaftar
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#ECFDF5] border border-emerald-200">
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">
              Toko Tercakup
            </span>
            <span className="text-2xl font-black text-emerald-900 mt-1 block">
              {coverageStats.coveredCount}
            </span>
            <span className="text-[10.5px] text-emerald-700 font-semibold block mt-0.5">
              {coverageStats.coveragePercentage}% Jaringan Tercakup
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFFBEB] border border-amber-200">
            <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block">
              Menunggu Kunjungan
            </span>
            <span className="text-2xl font-black text-amber-900 mt-1 block">
              {coverageStats.pendingCount}
            </span>
            <span className="text-[10.5px] text-amber-700 font-semibold block mt-0.5">
              Toko Belum Terjadwal
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#F0FDF4] border border-teal-200">
            <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-wider block">
              Kepemilikan Bestie
            </span>
            <span className="text-2xl font-black text-teal-900 mt-1 block">531</span>
            <span className="text-[10.5px] text-teal-700 font-semibold block mt-0.5">
              Rata-rata {coverageStats.avgStoresPerBestie} Toko / Bestie
            </span>
          </div>
        </div>

        {/* Visual Progress Bar Jaringan */}
        <div className="mt-5 p-4 bg-[#F8F9FA] rounded-2xl border border-slate-200/80">
          <div className="flex items-center justify-between text-xs font-black text-slate-800 mb-2">
            <span>Rasio Cakupan Operasional Jaringan</span>
            <span className="text-emerald-700">{coverageStats.coveragePercentage}% Selesai</span>
          </div>
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${coverageStats.coveragePercentage}%` }}
              title={`Tercakup: ${coverageStats.coveredCount} Toko`}
            />
            <div
              className="bg-amber-300 h-full transition-all duration-500"
              style={{ width: `${100 - coverageStats.coveragePercentage}%` }}
              title={`Menunggu: ${coverageStats.pendingCount} Toko`}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Toko Terjadwal / Dikunjungi ({coverageStats.coveredCount})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
              Menunggu Kunjungan ({coverageStats.pendingCount})
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CARD 3: KLASIFIKASI KATEGORI AKTIVITAS
          ========================================================================= */}
      <div className="bg-white rounded-[32px] p-5 sm:p-7 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-6 rounded-full bg-[#E59838]" />
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Card 3: Klasifikasi Kategori Aktivitas
              </h2>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Distribusi 9 Kategori Agenda &amp; Beban Aktivitas Tim Lapangan
            </p>
          </div>

          {/* Period Scope Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl self-start sm:self-auto">
            {(
              [
                { id: 'ALL', label: 'Semua' },
                { id: 'MONTH', label: 'Bulan Ini' },
                { id: 'WEEK', label: 'Minggu Ini' },
                { id: 'TODAY', label: 'Hari Ini' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivityPeriod(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  activityPeriod === p.id
                    ? 'bg-[#3A657C] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Breakdown Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-5">
          {categoryDistribution.map((item) => {
            const meta = getCategoryStyleMeta(item.category);
            return (
              <div
                key={item.category}
                className="p-4 rounded-2xl border border-slate-200/80 bg-[#FAFAFA] hover:bg-white hover:border-slate-300 transition shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-black ${meta.pillBg} ${meta.pillText}`}
                  >
                    {meta.label}
                  </span>
                  <span className="text-xs font-black text-slate-900 tabular-nums">
                    {item.count} Agenda
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1.5">
                  <span>Porsi dari Seluruh Agenda</span>
                  <span className="font-extrabold text-slate-700">{item.percentage}%</span>
                </div>

                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${meta.barColor}`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          CARD 4: DISTRIBUSI WILAYAH OPERASIONAL
          ========================================================================= */}
      <div className="bg-white rounded-[32px] p-5 sm:p-7 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-6 rounded-full bg-[#6B7FD7]" />
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Card 4: Distribusi Wilayah Operasional
              </h2>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Sebaran 6 Regional Manager (RM) &amp; Area Manager (AM) di Berbagai Kota
            </p>
          </div>

          <span className="px-3 py-1 bg-slate-100 rounded-full text-slate-700 text-xs font-black self-start sm:self-auto">
            {regionalDistribution.length} Regional Aktif
          </span>
        </div>

        {/* Regional Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-5">
          {regionalDistribution.map((reg, idx) => {
            const citiesList = Array.from(reg.cities).slice(0, 3).join(', ');
            return (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 hover:border-slate-300 transition"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[10px] font-extrabold text-[#3A657C] uppercase tracking-wider block">
                      Regional {idx + 1}
                    </span>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900">{reg.rmName}</h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-800 shadow-2xs shrink-0">
                    {reg.storeCount} Toko
                  </span>
                </div>

                <div className="space-y-1 text-[11px] text-slate-600 font-semibold mb-3">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{citiesList || 'Area FMCU'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{reg.areaManagers.size} Area Manager (AM)</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-xs">
                  <span className="text-[10.5px] font-bold text-slate-500">Aktivitas Kunjungan:</span>
                  <span className="font-extrabold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/80">
                    {reg.visitCount} Selesai
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          CARD 5: RIWAYAT KUNJUNGAN SELESAI (DENGAN TOMBOL PREVIEW LAPORAN GDRIVE)
          ========================================================================= */}
      <div className="bg-white rounded-[32px] p-5 sm:p-7 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-6 rounded-full bg-[#10B981]" />
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Card 5: Riwayat Kunjungan Selesai
              </h2>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Daftar Log Kunjungan Toko &amp; Pratinjau Dokumen PDF Realtime dari Google Drive
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Cari toko / PIC..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#3A657C]"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setHistoryFilter((v) => (v === 'ALL' ? 'GDRIVE_ONLY' : 'ALL'))
              }
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 border ${
                historyFilter === 'GDRIVE_ONLY'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Ada Laporan GDrive</span>
            </button>
          </div>
        </div>

        {/* Separated Classification Tabs: Store Visit vs NSO Opening */}
        <div className="pt-4 flex items-center gap-2 flex-wrap border-b border-slate-100 pb-3">
          <span className="text-xs font-bold text-slate-400 mr-1">Klasifikasi:</span>
          <button
            type="button"
            onClick={() => setHistoryCategoryTab('VISIT')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              historyCategoryTab === 'VISIT'
                ? 'bg-[#10B981] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Store Visit ({visitCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setHistoryCategoryTab('NSO')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              historyCategoryTab === 'NSO'
                ? 'bg-sky-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>NSO Opening ({nsoCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setHistoryCategoryTab('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              historyCategoryTab === 'ALL'
                ? 'bg-[#3A657C] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <span>Semua Kunjungan ({completedVisits.length})</span>
          </button>
        </div>

        {/* Completed Visits List Table / Cards */}
        <div className="pt-4 space-y-2.5">
          {filteredCompletedVisits.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs font-semibold">
              Tidak ada riwayat kunjungan {historyCategoryTab === 'VISIT' ? 'Store Visit' : historyCategoryTab === 'NSO' ? 'NSO' : ''} yang sesuai filter.
            </div>
          ) : (
            filteredCompletedVisits.slice(0, 15).map((item) => {
              const ag = item.agenda;
              return (
                <div
                  key={ag.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-[#F8FAFC] hover:bg-white border border-slate-200/80 hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        item.isNso
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {item.isNso ? <Sparkles className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[9.5px] font-black px-2 py-0.5 rounded-md ${
                            item.isNso
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {item.isNso ? 'NSO' : 'VISIT STORE'}
                        </span>

                        <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                          {ag.storeName || ag.location || ag.title}
                        </span>

                        {ag.storeCode && (
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                            #{ag.storeCode}
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Selesai
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        PIC: <strong className="text-slate-700 font-bold">{ag.pic}</strong> • Tanggal:{' '}
                        {ag.date} ({ag.time || '08:30'} WIB)
                      </p>

                      {/* Realtime GDrive Metadata if verified report is available */}
                      {item.hasReport && item.gdriveSavedDate && (
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                          <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                            GDrive: {item.gdriveSavedDate}
                          </span>
                          {item.pdfFileName && (
                            <span className="font-mono text-slate-500 truncate max-w-[240px]">
                              {item.pdfFileName}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Button: Preview Laporan (ONLY DISPLAYED IF REPORT EXISTS IN GDRIVE) */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {item.hasReport ? (
                      <button
                        type="button"
                        onClick={() => handlePreviewReport(item)}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#10B981] to-[#0D9488] hover:brightness-110 text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                        title="Buka pratinjau dokumen laporan PDF dari Google Drive"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Preview Laporan</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {filteredCompletedVisits.length > 15 && (
          <div className="text-center pt-3">
            <span className="text-xs font-bold text-slate-500">
              Menampilkan 15 dari {filteredCompletedVisits.length} riwayat kunjungan selesai
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

function getCategoryStyleMeta(category: ScheduleCategory): {
  label: string;
  pillBg: string;
  pillText: string;
  barColor: string;
} {
  switch (category) {
    case 'VISIT':
      return {
        label: 'Store Visit',
        pillBg: 'bg-emerald-50 border border-emerald-200',
        pillText: 'text-emerald-800',
        barColor: 'bg-emerald-500',
      };
    case 'NSO':
      return {
        label: 'NSO / Reopening',
        pillBg: 'bg-sky-50 border border-sky-200',
        pillText: 'text-sky-800',
        barColor: 'bg-sky-500',
      };
    case 'AUDIT':
      return {
        label: 'Audit SOP / QSC',
        pillBg: 'bg-amber-50 border border-amber-200',
        pillText: 'text-amber-800',
        barColor: 'bg-amber-500',
      };
    case 'TRAINING':
      return {
        label: 'Training / SBS',
        pillBg: 'bg-indigo-50 border border-indigo-200',
        pillText: 'text-indigo-800',
        barColor: 'bg-indigo-500',
      };
    case 'MEETING':
      return {
        label: 'Meeting & Rapat',
        pillBg: 'bg-blue-50 border border-blue-200',
        pillText: 'text-blue-800',
        barColor: 'bg-blue-500',
      };
    case 'WORK_PLAN':
      return {
        label: 'Work Plan',
        pillBg: 'bg-teal-50 border border-teal-200',
        pillText: 'text-teal-800',
        barColor: 'bg-teal-500',
      };
    case 'OPERATION':
      return {
        label: 'Operation Duty',
        pillBg: 'bg-slate-100 border border-slate-200',
        pillText: 'text-slate-800',
        barColor: 'bg-slate-500',
      };
    case 'CUTI':
      return {
        label: 'Cuti Resmi',
        pillBg: 'bg-rose-50 border border-rose-200',
        pillText: 'text-rose-800',
        barColor: 'bg-rose-500',
      };
    case 'OFF':
      return {
        label: 'Libur (OFF)',
        pillBg: 'bg-slate-100 border border-slate-200',
        pillText: 'text-slate-600',
        barColor: 'bg-slate-400',
      };
    default:
      return {
        label: 'Aktivitas',
        pillBg: 'bg-slate-100',
        pillText: 'text-slate-700',
        barColor: 'bg-slate-500',
      };
  }
}
