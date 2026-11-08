import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  Trophy,
  Crown,
  Medal,
  Sparkles,
  Search,
  X,
  UserCheck,
  Cloud,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ScheduleAgenda, User } from '../types';
import { initialUsers } from '../data/mockData';
import { isSamePersonName, getStoresWithOwnership } from '../data/masterStoresData';
import { getMondayOfWeek, getFullWeekDays } from '../services/scheduleExcelService';
import { fetchAllVisitReportsFromCloud } from '../services/crossDeviceVisitSyncService';
import { VisitReportData } from '../types/visitReport';

export type LeaderboardPeriod = 'Daily' | 'Weekly' | 'Monthly' | 'AllTime';

interface LeaderboardTopVisitProps {
  user?: User | null;
  agendas?: ScheduleAgenda[];
  users?: User[];
  onBack?: () => void;
}

export interface LeaderboardRankItem {
  rank: number;
  userId: string;
  name: string;
  avatar: string;
  role: string;
  visitCount: number;
  completedVisits: number;
  gdriveReportsCount: number;
  score: number;
  isCurrentUser: boolean;
}

export const LeaderboardTopVisit: React.FC<LeaderboardTopVisitProps> = ({
  user,
  agendas = [],
  users = initialUsers,
  onBack,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<LeaderboardPeriod>('Daily');
  const [searchQuery, setSearchQuery] = useState('');
  const [gdriveReports, setGdriveReports] = useState<(VisitReportData & { updatedAtMs?: number })[]>([]);
  const [isSyncingGdrive, setIsSyncingGdrive] = useState(false);

  const currentUserName = user?.name || '';

  // 1. Tanggal Hari Ini, Minggu Berjalan, & Bulan Berjalan
  const now = new Date();
  const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const currentWeekMonday = getMondayOfWeek(todayYmd);
  const activeWeekDays = getFullWeekDays(currentWeekMonday);
  const weekStartStr = activeWeekDays[0]?.dateStr || currentWeekMonday;
  const weekEndStr = activeWeekDays[activeWeekDays.length - 1]?.dateStr || currentWeekMonday;

  // 2. Tarikan Data Laporan Visit Tersimpan di GDrive / Cloud
  const loadGdriveReports = async () => {
    setIsSyncingGdrive(true);
    try {
      const cloudReports = await fetchAllVisitReportsFromCloud(true);
      const localReports: (VisitReportData & { updatedAtMs?: number })[] = [];
      if (typeof window !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('fmcu_visit_report_')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (parsed && (parsed.agendaId || parsed.id)) {
                  localReports.push(parsed);
                }
              } catch {
                // ignore
              }
            }
          }
        }
      }

      const reportMap = new Map<string, VisitReportData & { updatedAtMs?: number }>();
      localReports.forEach((r) => {
        const id = r.agendaId || r.id;
        if (id) reportMap.set(id, r);
      });
      (cloudReports || []).forEach((r) => {
        const id = r.agendaId || r.id;
        if (id) reportMap.set(id, r);
      });

      setGdriveReports(Array.from(reportMap.values()));
    } catch (err) {
      console.warn('Gdrive reports fetch error:', err);
    } finally {
      setIsSyncingGdrive(false);
    }
  };

  useEffect(() => {
    loadGdriveReports();
  }, []);

  // 3. Efek Animasi Confetti (Celebration) saat Mount & Ganti Periode
  const fireConfetti = () => {
    try {
      // Dual-cannon celebration confetti
      confetti({
        particleCount: 65,
        spread: 60,
        origin: { y: 0.6, x: 0.25 },
        colors: ['#a855f7', '#ec4899', '#f59e0b', '#10b981', '#38bdf8', '#ffffff'],
      });
      confetti({
        particleCount: 65,
        spread: 60,
        origin: { y: 0.6, x: 0.75 },
        colors: ['#a855f7', '#ec4899', '#f59e0b', '#10b981', '#38bdf8', '#ffffff'],
      });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fireConfetti();
  }, [selectedPeriod]);

  // 4. Filter 36 Staff Users (exclude Admin)
  const staffMembers = useMemo(() => {
    return users.filter((u) => !u.isAdmin && u.name !== 'Admin FMCU');
  }, [users]);

  // 5. Hitung Skor & Peringkat Leaderboard Berdasarkan Tarikan Laporan GDrive
  const leaderboardData: LeaderboardRankItem[] = useMemo(() => {
    // Kumpulkan agenda yang relevan sesuai periode
    const relevantAgendas = agendas.filter((item) => {
      if (item.category === 'OFF' || item.category === 'CUTI') return false;

      if (selectedPeriod === 'Daily') {
        return item.date === todayYmd;
      }
      if (selectedPeriod === 'Weekly') {
        return item.date >= weekStartStr && item.date <= weekEndStr;
      }
      if (selectedPeriod === 'Monthly') {
        return (item.date || '').startsWith(currentMonthPrefix);
      }
      return true;
    });

    // Peta hitungan per personel
    const statsMap = new Map<
      string,
      {
        visitCount: number;
        completedCount: number;
        otherCount: number;
        gdriveReportCount: number;
      }
    >();

    // Inisialisasi untuk seluruh staf
    for (const staff of staffMembers) {
      statsMap.set(staff.name.trim().toLowerCase(), {
        visitCount: 0,
        completedCount: 0,
        otherCount: 0,
        gdriveReportCount: 0,
      });
    }

    // Iterasi agenda yang relevan
    for (const ag of relevantAgendas) {
      const picKey = (ag.pic || '').trim().toLowerCase();
      if (!picKey) continue;

      let targetKey: string | null = null;
      for (const [key] of statsMap.entries()) {
        if (key === picKey || isSamePersonName(key, picKey)) {
          targetKey = key;
          break;
        }
      }

      if (!targetKey) {
        targetKey = picKey;
        statsMap.set(targetKey, { visitCount: 0, completedCount: 0, otherCount: 0, gdriveReportCount: 0 });
      }

      const st = statsMap.get(targetKey)!;
      if (ag.category === 'VISIT') {
        st.visitCount += 1;
      } else {
        st.otherCount += 1;
      }
      if (ag.completed) {
        st.completedCount += 1;
      }
    }

    // DETEKSI JUMLAH LAPORAN VISIT YANG SUDAH DISIMPAN DI GDRIVE
    for (const rep of gdriveReports) {
      const visitor = (rep.visitorName || (rep as Record<string, any>).pic || (rep as Record<string, any>).auditorName || '').trim().toLowerCase();
      if (!visitor) continue;

      let targetKey: string | null = null;
      for (const [key] of statsMap.entries()) {
        if (key === visitor || isSamePersonName(key, visitor)) {
          targetKey = key;
          break;
        }
      }

      if (targetKey && statsMap.has(targetKey)) {
        const st = statsMap.get(targetKey)!;
        st.gdriveReportCount += 1;
        st.completedCount += 1;
      }
    }

    // Bangun daftar peringkat lengkap dengan rumus skor kompetitif
    const entries: LeaderboardRankItem[] = staffMembers.map((staff) => {
      const staffKey = staff.name.trim().toLowerCase();
      const st = statsMap.get(staffKey) || {
        visitCount: 0,
        completedCount: 0,
        otherCount: 0,
        gdriveReportCount: 0,
      };

      const ownedStoresCount = getStoresWithOwnership(staff.name).filter(
        (s) => s.isOwnedByBestie
      ).length;

      let periodMultiplier = 1;
      if (selectedPeriod === 'Daily') periodMultiplier = 2.0;
      else if (selectedPeriod === 'Weekly') periodMultiplier = 1.4;
      else if (selectedPeriod === 'Monthly') periodMultiplier = 1.1;

      // TARIKAN DATA UTAMA: LAPORAN VISIT TERSIMPAN DI GDRIVE
      const rawScore =
        st.gdriveReportCount * 125 * periodMultiplier +
        st.visitCount * 55 * periodMultiplier +
        st.completedCount * 30 +
        st.otherCount * 15 +
        Math.min(ownedStoresCount * 6, 80);

      const finalScore = Math.max(35, Math.round(rawScore));
      const avatarUrl = staff.avatar || '';

      return {
        rank: 0,
        userId: staff.id || staff.name,
        name: staff.name,
        avatar: avatarUrl,
        role: staff.role || 'Bestie Field FMCU',
        visitCount: st.visitCount,
        completedVisits: st.completedCount,
        gdriveReportsCount: st.gdriveReportCount,
        score: finalScore,
        isCurrentUser: Boolean(
          currentUserName && isSamePersonName(staff.name, currentUserName)
        ),
      };
    });

    // Urutkan berdasarkan Laporan GDrive Terbanyak -> Skor tertinggi -> Visit Count terbanyak -> Abjad A-Z
    entries.sort((a, b) => {
      if (b.gdriveReportsCount !== a.gdriveReportsCount) return b.gdriveReportsCount - a.gdriveReportsCount;
      if (b.score !== a.score) return b.score - a.score;
      if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount;
      return a.name.localeCompare(b.name, 'id', { sensitivity: 'base' });
    });

    // Assign rank 1, 2, 3, 4, ...
    return entries.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }, [
    agendas,
    staffMembers,
    selectedPeriod,
    todayYmd,
    weekStartStr,
    weekEndStr,
    currentMonthPrefix,
    currentUserName,
    gdriveReports,
  ]);

  // Top 3 Podium
  const rank1 = leaderboardData[0] || null;
  const rank2 = leaderboardData[1] || null;
  const rank3 = leaderboardData[2] || null;

  // Ranks 4+ untuk List Bawah
  const remainingRanks = useMemo(() => {
    const list = leaderboardData.slice(3);
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((item) => item.name.toLowerCase().includes(q));
  }, [leaderboardData, searchQuery]);

  // Posisi user aktif di leaderboard
  const currentUserRank = useMemo(() => {
    return leaderboardData.find((item) => item.isCurrentUser);
  }, [leaderboardData]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* =========================================================================
          HERO CARD: VIBRANT PURPLE-VIOLET GRADIENT Ala Gambar Referensi
          Background luar tetap putih, section leaderboard dihiasi gradasi ungu elegan
          ========================================================================= */}
      <div className="relative rounded-[32px] overflow-hidden bg-gradient-to-b from-[#3b0764] via-[#581c87] to-[#7c3aed] text-white shadow-2xl p-5 sm:p-6 border border-purple-800/40 select-none">
        {/* Glow ambient background orbs */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-fuchsia-500/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -left-20 w-48 h-48 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header: Tombol Back, Judul Leaderboard, & Selebrasi Confetti */}
        <div className="relative z-10 flex items-center justify-between mb-4">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 transition-transform flex items-center justify-center text-white backdrop-blur-md border border-white/20 cursor-pointer shadow-sm"
              title="Kembali"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.4]" />
            </button>
          ) : (
            <div className="w-10 h-10" />
          )}

          <div className="text-center">
            <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">
              Leaderboard
            </h2>
            <p className="text-[10px] font-medium text-purple-200">
              Top Visit Personel FMCU • Live Real-time
            </p>
          </div>

          {/* Interactive Confetti Trophy Button */}
          <button
            type="button"
            onClick={fireConfetti}
            className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 active:scale-90 transition-all flex items-center justify-center text-amber-300 border border-white/20 shadow-md cursor-pointer hover:rotate-12"
            title="Selebrasi Confetti! 🎉 (Klik untuk memicu confetti)"
          >
            <Trophy className="w-5 h-5 drop-shadow" />
          </button>
        </div>

        {/* Realtime GDrive Reports Detection Status Bar */}
        <div className="relative z-10 flex items-center justify-between gap-2 px-3 sm:px-4 py-2 rounded-2xl bg-black/35 backdrop-blur-md border border-white/15 mb-4 text-[10.5px]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-white">Cloud GDrive: </span>
              <span className="text-emerald-300 font-black">
                {gdriveReports.length} Laporan Visit Tersimpan
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={loadGdriveReports}
            disabled={isSyncingGdrive}
            className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold flex items-center gap-1 shrink-0 transition-all cursor-pointer disabled:opacity-50"
            title="Sinkronkan data laporan dari Google Drive"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncingGdrive ? 'animate-spin text-emerald-300' : 'text-slate-300'}`} />
            <span className="text-[10px] font-medium">Sync</span>
          </button>
        </div>

        {/* Filter Pills: Daily, Weekly, Monthly, All Time */}
        <div className="relative z-10 flex items-center justify-center gap-1.5 sm:gap-2 mb-7">
          {(
            [
              { id: 'Daily', label: 'Daily' },
              { id: 'Weekly', label: 'Weekly' },
              { id: 'Monthly', label: 'Monthly' },
              { id: 'AllTime', label: 'All Time' },
            ] as const
          ).map((tab) => {
            const isActive = selectedPeriod === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedPeriod(tab.id)}
                className={`py-1.5 px-3.5 sm:px-4 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-md font-extrabold scale-105'
                    : 'bg-white/10 hover:bg-white/20 text-white/80 border border-white/15'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* =====================================================================
            TOP 3 PODIUM DISPLAY (JUARA 2 DI KIRI, JUARA 1 DI TENGAH, JUARA 3 DI KANAN)
            Dengan Animasi 60fps Motion Slide-Up, Confetti & Deteksi Laporan GDrive
            ===================================================================== */}
        <div className="relative z-10 flex items-end justify-center gap-2 sm:gap-3 pt-4 pb-2">
          {/* PODIUM 2: RANK 2 (KIRI - KEDUA TERTINGGI) */}
          {rank2 && (
            <div className="flex-1 max-w-[105px] sm:max-w-[120px] flex flex-col items-center animate-in slide-in-from-bottom-10 fade-in duration-700 ease-out">
              {/* Avatar + Badge 2 */}
              <div className="relative mb-2 flex flex-col items-center">
                <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full ring-3 ring-slate-300 shadow-xl overflow-hidden bg-slate-800 flex items-center justify-center">
                  {rank2.avatar ? (
                    <img
                      src={rank2.avatar}
                      alt={rank2.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-slate-700 to-slate-900 text-white font-black text-sm flex items-center justify-center uppercase">
                      {rank2.name.substring(0, 2)}
                    </div>
                  )}
                </div>
                {/* Badge Medal 2 */}
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-tr from-slate-300 to-white text-slate-900 font-black text-[11px] flex items-center justify-center shadow-md ring-2 ring-[#6d28d9]">
                  2
                </div>
              </div>

              {/* Nama */}
              <span className="text-xs font-bold text-white text-center truncate max-w-[95px] leading-tight">
                {rank2.name.split(' ')[0]}
              </span>

              {/* Score Pill dengan Sparkle */}
              <div className="mt-1 mb-1 px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-400/30 flex items-center gap-1 shadow-sm">
                <span className="text-[10px]">💥</span>
                <span className="text-[11px] font-black text-purple-200">
                  {rank2.score}
                </span>
              </div>

              {/* GDrive Reports Pill */}
              <div className="mb-2 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-400/30 flex items-center gap-1 shadow-2xs">
                <Cloud className="w-2.5 h-2.5 text-emerald-300" />
                <span className="text-[9px] font-black text-emerald-200">
                  {rank2.gdriveReportsCount} GDrive
                </span>
              </div>

              {/* Stepped 3D Block #2 (Tinggi Medium: ~105px) */}
              <div className="w-full h-[105px] rounded-t-2xl bg-gradient-to-b from-[#e2e8f0] to-[#94a3b8] flex flex-col items-center justify-start pt-3 shadow-lg border-t border-white/60 relative">
                <div className="absolute inset-x-2 top-0 h-1 bg-white/40 rounded-full" />
                <span className="text-4xl sm:text-5xl font-black text-slate-400/90 tracking-tighter">
                  2
                </span>
                <span className="text-[9px] font-extrabold text-slate-600 uppercase tracking-wider mt-1">
                  {rank2.visitCount} Visit
                </span>
              </div>
            </div>
          )}

          {/* PODIUM 1: RANK 1 (TENGAH - PALING TINGGI & TERBESAR) */}
          {rank1 && (
            <div className="flex-1 max-w-[120px] sm:max-w-[135px] flex flex-col items-center z-10 animate-in slide-in-from-bottom-16 fade-in duration-700 ease-out">
              {/* Avatar + Crown / Gold Medal 1 dengan Glowing Aura */}
              <div className="relative mb-2 flex flex-col items-center">
                {/* Glowing Aura Ring */}
                <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-amber-400/40 via-yellow-300/30 to-amber-500/40 blur-sm animate-pulse pointer-events-none" />

                <div className="relative w-16 h-16 sm:w-19 sm:h-19 rounded-full ring-4 ring-amber-400 shadow-2xl overflow-hidden bg-slate-900 flex items-center justify-center">
                  {rank1.avatar ? (
                    <img
                      src={rank1.avatar}
                      alt={rank1.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-amber-600 via-amber-700 to-slate-950 text-white font-black text-lg flex items-center justify-center uppercase">
                      {rank1.name.substring(0, 2)}
                    </div>
                  )}
                </div>
                {/* Crown Interaktif: Klik untuk Confetti! */}
                <button
                  type="button"
                  onClick={fireConfetti}
                  className="absolute -top-3 -right-1 w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-200 text-slate-950 font-black text-xs flex items-center justify-center shadow-lg ring-2 ring-[#7c3aed] cursor-pointer animate-bounce hover:scale-110 active:scale-95 transition-transform"
                  title="Klik untuk Selebrasi Juara! 🎉"
                >
                  <Crown className="w-4 h-4 text-slate-950 fill-amber-300" />
                </button>
              </div>

              {/* Nama Juara 1 */}
              <span className="text-xs sm:text-sm font-black text-amber-200 text-center truncate max-w-[105px] leading-tight">
                {rank1.name.split(' ')[0]}
              </span>

              {/* Score Pill Juara 1 */}
              <div className="mt-1 mb-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 flex items-center gap-1 shadow-sm">
                <span className="text-xs">💥</span>
                <span className="text-xs font-black text-amber-300">
                  {rank1.score}
                </span>
              </div>

              {/* GDrive Reports Pill Juara 1 */}
              <div className="mb-2 px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-300/40 flex items-center gap-1 shadow-2xs">
                <Cloud className="w-2.5 h-2.5 text-emerald-300 animate-pulse" />
                <span className="text-[9.5px] font-black text-emerald-200">
                  {rank1.gdriveReportsCount} GDrive
                </span>
              </div>

              {/* Stepped 3D Block #1 (Paling Tinggi: ~135px) */}
              <div className="w-full h-[135px] rounded-t-2xl bg-gradient-to-b from-[#f8fafc] via-[#e2e8f0] to-[#cbd5e1] flex flex-col items-center justify-start pt-3 shadow-2xl border-t border-white relative">
                <div className="absolute inset-x-3 top-0 h-1 bg-white rounded-full" />
                <span className="text-5xl sm:text-6xl font-black text-slate-400/90 tracking-tighter">
                  1
                </span>
                <span className="text-[10px] font-black text-teal-700 uppercase tracking-wider mt-1 flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                  {rank1.visitCount} Visit
                </span>
              </div>
            </div>
          )}

          {/* PODIUM 3: RANK 3 (KANAN - KETIGA) */}
          {rank3 && (
            <div className="flex-1 max-w-[105px] sm:max-w-[120px] flex flex-col items-center animate-in slide-in-from-bottom-8 fade-in duration-700 ease-out">
              {/* Avatar + Badge 3 */}
              <div className="relative mb-2 flex flex-col items-center">
                <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full ring-3 ring-amber-600 shadow-xl overflow-hidden bg-slate-800 flex items-center justify-center">
                  {rank3.avatar ? (
                    <img
                      src={rank3.avatar}
                      alt={rank3.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-amber-800 to-slate-900 text-white font-black text-sm flex items-center justify-center uppercase">
                      {rank3.name.substring(0, 2)}
                    </div>
                  )}
                </div>
                {/* Badge Medal 3 */}
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-tr from-amber-700 to-amber-500 text-white font-black text-[11px] flex items-center justify-center shadow-md ring-2 ring-[#581c87]">
                  3
                </div>
              </div>

              {/* Nama */}
              <span className="text-xs font-bold text-white text-center truncate max-w-[95px] leading-tight">
                {rank3.name.split(' ')[0]}
              </span>

              {/* Score Pill */}
              <div className="mt-1 mb-1 px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-400/30 flex items-center gap-1 shadow-sm">
                <span className="text-[10px]">💥</span>
                <span className="text-[11px] font-black text-purple-200">
                  {rank3.score}
                </span>
              </div>

              {/* GDrive Reports Pill */}
              <div className="mb-2 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-400/30 flex items-center gap-1 shadow-2xs">
                <Cloud className="w-2.5 h-2.5 text-emerald-300" />
                <span className="text-[9px] font-black text-emerald-200">
                  {rank3.gdriveReportsCount} GDrive
                </span>
              </div>

              {/* Stepped 3D Block #3 (Tinggi Terpendek: ~80px) */}
              <div className="w-full h-[80px] rounded-t-2xl bg-gradient-to-b from-[#e2e8f0] to-[#94a3b8] flex flex-col items-center justify-start pt-3 shadow-lg border-t border-white/60 relative">
                <div className="absolute inset-x-2 top-0 h-1 bg-white/40 rounded-full" />
                <span className="text-4xl sm:text-5xl font-black text-slate-400/90 tracking-tighter">
                  3
                </span>
                <span className="text-[9px] font-extrabold text-slate-600 uppercase tracking-wider mt-1">
                  {rank3.visitCount} Visit
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          DAFTAR PERINGKAT 4+ (DARK SLEEK CARD ALA SCREENSHOT REFERENSI)
          Menampilkan baris dengan nomor besar, avatar, nama, dan score pill 💥
          ========================================================================= */}
      <div className="bg-[#18181b] rounded-3xl p-4 sm:p-5 text-white shadow-soft-card border border-slate-800">
        <div className="flex items-center justify-between gap-2 mb-3 px-1">
          <div className="flex items-center gap-2">
            <Medal className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
              Peringkat Lainnya
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            {remainingRanks.length} Personel
          </span>
        </div>

        {/* Search Bar Personel */}
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama personel di leaderboard..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-7 py-2 text-xs font-medium text-slate-200 placeholder:text-slate-500 outline-none focus:border-purple-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Baris Peringkat 4, 5, 6, 7, ... */}
        <div className="space-y-2">
          {remainingRanks.length === 0 ? (
            <div className="py-6 text-center text-slate-500 text-xs font-medium">
              Tidak ada personel yang cocok dengan pencarian &quot;{searchQuery}&quot;.
            </div>
          ) : (
            remainingRanks.map((item) => (
              <div
                key={item.userId}
                className={`flex items-center justify-between p-2.5 rounded-2xl transition-all ${
                  item.isCurrentUser
                    ? 'bg-purple-900/40 border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                    : 'bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Nomor Peringkat Besar Muted Sesuai Screenshot */}
                  <span className="w-7 text-center font-black text-2xl text-slate-500/70 shrink-0 tabular-nums">
                    {item.rank}
                  </span>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full ring-2 ring-white/10 overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center">
                    {item.avatar ? (
                      <img
                        src={item.avatar}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-indigo-900 to-purple-900 text-white font-bold text-xs flex items-center justify-center uppercase">
                        {item.name.substring(0, 2)}
                      </div>
                    )}
                  </div>

                  {/* Nama & Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs sm:text-sm font-bold text-white truncate">
                        {item.name}
                      </p>
                      {item.isCurrentUser && (
                        <span className="px-1.5 py-0.2 rounded-md bg-purple-500 text-[9px] font-black uppercase tracking-tight text-white shrink-0">
                          Anda
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {item.visitCount > 0
                          ? `${item.visitCount} Visit`
                          : `${item.role}`}
                      </span>
                      {item.gdriveReportsCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-emerald-950/80 border border-emerald-400/30 text-emerald-300 text-[9px] font-extrabold shadow-2xs">
                          <Cloud className="w-2.5 h-2.5 text-emerald-400" />
                          <span>{item.gdriveReportsCount} GDrive</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score Pill 💥 */}
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-950/90 border border-purple-500/40 text-purple-300 shrink-0 shadow-xs">
                  <span className="text-[11px]">💥</span>
                  <span className="text-xs font-black tabular-nums">
                    {item.score}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sticky Bar Peringkat Saya (Khusus jika user bukan di Top 3) */}
      {currentUserRank && currentUserRank.rank > 3 && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-900 to-indigo-900 text-white border border-purple-400/40 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-black text-sm">
              #{currentUserRank.rank}
            </div>
            <div>
              <p className="text-xs font-black flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-purple-300" />
                Posisi Anda Saat Ini
              </p>
              <p className="text-[10px] text-purple-200">
                {currentUserRank.visitCount} Visit • {currentUserRank.completedVisits} Selesai •{' '}
                <span className="text-emerald-300 font-bold">{currentUserRank.gdriveReportsCount} Laporan GDrive</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-white text-purple-950 font-black text-xs shadow-md">
            <span>💥</span>
            <span>{currentUserRank.score} Poin</span>
          </div>
        </div>
      )}
    </div>
  );
};
