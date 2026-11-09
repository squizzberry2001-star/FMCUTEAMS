import React, { useState, useMemo, useEffect } from 'react';
import {
  Bell,
  Search,
  Plus,
  LayoutGrid,
  Calendar as CalendarIcon,
  Store,
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  FileSpreadsheet,
  Clock,
  ClipboardList,
  MapPin,
  Camera,
  User as UserIcon,
  Shield,
  ArrowRight,
  Share2,
  Navigation,
  Tag,
  CheckCircle2,
  Sparkles,
  Users,
  Trash2,
  Lock,
} from 'lucide-react';
import { ScheduleAgenda, User, SCHEDULE_CATEGORY_OPTIONS } from '../types';
import { CalendarStrip, CalendarFocusTrigger } from './CalendarStrip';
import { DeveloperFooter } from './DeveloperFooter';
import { ScheduleCard } from './ScheduleCard';
import { HistoryView } from './HistoryView';
import { CalendarScheduleView } from './CalendarScheduleView';
import { ProfileView } from './ProfileView';
import { EmployeeStoriesBar } from './EmployeeStoriesBar';
import { isSamePersonName, getStoresWithOwnership } from '../data/masterStoresData';
import {
  getMondayOfWeek,
  getFullWeekDays,
  formatWeekRangeDisplay,
  exportScheduleToTemplateExcel,
} from '../services/scheduleExcelService';

interface DesktopDashboardProps {
  user: User;
  agendas: ScheduleAgenda[];
  selectedAgenda?: ScheduleAgenda | null;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onSelectAgenda: (agenda: ScheduleAgenda) => void;
  onOpenNewAgenda: () => void;
  onOpenExcelUpload?: () => void;
  onOpenLiveMaps?: () => void;
  onOpenVisitForm?: (agenda: ScheduleAgenda) => void;
  onUpdateAgenda?: (updatedAgenda: ScheduleAgenda) => void;
  onDeleteAgenda?: (id: string) => void;
  onToggleComplete?: (id: string, e?: React.MouseEvent) => void;
  onLogout: () => void;
  onOpenAdminPortal?: () => void;
  onUpdateUser?: (updatedUser: User) => void;
  users?: User[];
}

export const DesktopDashboard: React.FC<DesktopDashboardProps> = ({
  user,
  agendas,
  selectedAgenda,
  selectedDate,
  onSelectDate,
  onSelectAgenda,
  onOpenNewAgenda,
  onOpenExcelUpload,
  onOpenLiveMaps,
  onOpenVisitForm,
  onUpdateAgenda,
  onDeleteAgenda,
  onToggleComplete,
  onLogout,
  onOpenAdminPortal,
  onUpdateUser,
  users = [],
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'Today' | 'Week' | 'AllTeam'>('Today');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPersonDropdown, setSelectedPersonDropdown] = useState<string>('ALL');
  const [calendarFocus, setCalendarFocus] = useState<CalendarFocusTrigger>({
    mode: 'today',
    ts: Date.now(),
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'schedule' | 'coverage' | 'profile'>('dashboard');

  const fullName = user.name || 'Bestie FMCU';

  // 1. Waktu Sapaan berdasarkan Jam Aktual
  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 11) return 'Pagi';
    if (hour >= 11 && hour < 15) return 'Siang';
    if (hour >= 15 && hour < 18) return 'Sore';
    return 'Malam';
  };

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const now = new Date();
  const currentMonthYear = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  // Daftar seluruh nama tim unik terurut A-Z untuk dropdown filter
  const allTeamNamesAZ = useMemo(() => {
    const names = Array.from(
      new Set(agendas.map((a) => (a.pic || '').trim()).filter(Boolean))
    );
    return names.sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' }));
  }, [agendas]);

  // 2. Reference Monday for running week
  const [currentWeekMonday, setCurrentWeekMonday] = useState<string>(() => getMondayOfWeek(selectedDate));

  // Otomatis sinkronkan currentWeekMonday ketika selectedDate berpindah minggu
  useEffect(() => {
    if (selectedDate) {
      const mon = getMondayOfWeek(selectedDate);
      setCurrentWeekMonday(mon);
    }
  }, [selectedDate]);

  const handlePrevWeek = () => {
    const dt = new Date(currentWeekMonday + 'T12:00:00');
    dt.setDate(dt.getDate() - 7);
    const prevMon = getMondayOfWeek(dt.toISOString().split('T')[0]);
    setCurrentWeekMonday(prevMon);
    onSelectDate(prevMon);
  };

  const handleNextWeek = () => {
    const dt = new Date(currentWeekMonday + 'T12:00:00');
    dt.setDate(dt.getDate() + 7);
    const nextMon = getMondayOfWeek(dt.toISOString().split('T')[0]);
    setCurrentWeekMonday(nextMon);
    onSelectDate(nextMon);
  };

  const activeWeekDays = getFullWeekDays(currentWeekMonday);
  const weekStartStr = activeWeekDays[0]?.dateStr || currentWeekMonday;
  const weekEndStr = activeWeekDays[activeWeekDays.length - 1]?.dateStr || currentWeekMonday;
  const isCurrentRunningWeek = currentWeekMonday === getMondayOfWeek();

  // Rentang 1 Minggu Penuh untuk tab Semua Tim (mengikuti minggu dari pill yang dipilih atau minggu berjalan)
  const { teamWeekStartStr, teamWeekEndStr } = useMemo(() => {
    if (selectedDate >= weekStartStr && selectedDate <= weekEndStr) {
      return { teamWeekStartStr: weekStartStr, teamWeekEndStr: weekEndStr };
    }

    const selDate = new Date(selectedDate + 'T00:00:00');
    if (isNaN(selDate.getTime())) {
      return { teamWeekStartStr: weekStartStr, teamWeekEndStr: weekEndStr };
    }
    const day = selDate.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const calMon = new Date(selDate);
    calMon.setDate(selDate.getDate() + diffToMon);
    const calSun = new Date(calMon);
    calSun.setDate(calMon.getDate() + 6);
    const toYmd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { teamWeekStartStr: toYmd(calMon), teamWeekEndStr: toYmd(calSun) };
  }, [selectedDate, weekStartStr, weekEndStr]);

  const handleSelectPeriodTab = (period: 'Today' | 'Week' | 'AllTeam') => {
    setSelectedPeriod(period);
    if (period === 'Today') {
      onSelectDate(todayYmd);
      setCalendarFocus({ mode: 'today', ts: Date.now() });
    } else if (period === 'Week' || period === 'AllTeam') {
      setCalendarFocus({ mode: 'week', ts: Date.now() });
    }
  };

  const shortMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const shortDayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const formatShortDayDate = (dateYmd: string) => {
    const dt = new Date(dateYmd + 'T00:00:00');
    if (isNaN(dt.getTime())) return dateYmd;
    return `${shortDayNames[dt.getDay()]}, ${String(dt.getDate()).padStart(2, '0')} ${shortMonthNames[dt.getMonth()]}`;
  };

  // 3. Filter Agendas Sesuai User, Periode, Kategori, & Pencarian (100% IDENTIK DENGAN MOBILE)
  const filteredAgendas = useMemo(() => {
    return agendas.filter((item) => {
      // Filter Kategori
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }

      // Filter Dropdown Nama Personel (khusus tab Semua Tim)
      if (selectedPersonDropdown !== 'ALL' && selectedPeriod === 'AllTeam') {
        if (!isSamePersonName(item.pic, selectedPersonDropdown) && item.pic !== selectedPersonDropdown) {
          return false;
        }
      }

      // Filter Pencarian Text
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          item.title.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          (item.pic || '').toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      // Filter Hak Kepemilikan User (Khusus Admin, selalu tampilkan seluruh agenda agar tidak tersembunyi)
      const isMyAgenda =
        Boolean(user?.isAdmin) ||
        !item.pic ||
        isSamePersonName(item.pic, fullName) ||
        item.pic.toLowerCase().includes(fullName.toLowerCase()) ||
        fullName.toLowerCase().includes(item.pic.toLowerCase());

      if (selectedPeriod === 'Today') {
        return isMyAgenda && item.date === selectedDate;
      }
      if (selectedPeriod === 'Week') {
        return isMyAgenda && item.date >= weekStartStr && item.date <= weekEndStr;
      }
      // 'AllTeam' -> Seluruh Tim pada 1 Minggu Berjalan
      return item.date >= teamWeekStartStr && item.date <= teamWeekEndStr;
    }).sort((a, b) => {
      if (selectedPeriod === 'AllTeam') {
        return (
          (a.pic || '').localeCompare(b.pic || '', 'id', { sensitivity: 'base' }) ||
          (a.date || '').localeCompare(b.date || '') ||
          (a.time || '').localeCompare(b.time || '')
        );
      }
      return (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || '');
    });
  }, [
    agendas,
    selectedCategory,
    selectedPersonDropdown,
    searchQuery,
    fullName,
    selectedPeriod,
    selectedDate,
    weekStartStr,
    weekEndStr,
    teamWeekStartStr,
    teamWeekEndStr,
  ]);

  const groupedAllTeamWeekByPerson = useMemo(() => {
    if (selectedPeriod !== 'AllTeam') return [];
    const groupsMap = new Map<string, ScheduleAgenda[]>();
    for (const item of filteredAgendas) {
      const picName = (item.pic || 'Tanpa Nama').trim();
      if (!groupsMap.has(picName)) {
        groupsMap.set(picName, []);
      }
      groupsMap.get(picName)!.push(item);
    }
    return Array.from(groupsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'id', { sensitivity: 'base' }))
      .map(([picName, items]) => ({
        picName,
        items: items.sort(
          (x, y) =>
            (x.date || '').localeCompare(y.date || '') ||
            (x.time || '').localeCompare(y.time || '')
        ),
      }));
  }, [filteredAgendas, selectedPeriod]);

  // 4. Hitungan Data Aktual & Glanceable Metrik Toko
  const ownedStores = useMemo(() => {
    return getStoresWithOwnership(fullName).filter((s) => s.isOwnedByBestie);
  }, [fullName]);

  const totalOwnedStoresCount = ownedStores.length;
  const visitedOwnedStoresCount = useMemo(() => {
    const visitedCodes = new Set(
      agendas
        .filter((a) => a.completed && (isSamePersonName(a.pic, fullName) || !a.pic))
        .map((a) => (a.storeCode || a.location || '').trim().toLowerCase())
    );

    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('fmcu_visit_report_')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && (isSamePersonName(parsed.visitorName, fullName) || !parsed.visitorName)) {
                if (parsed.storeCode) visitedCodes.add(String(parsed.storeCode).toLowerCase());
                if (parsed.storeName) visitedCodes.add(String(parsed.storeName).toLowerCase());
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }

    return ownedStores.filter(
      (s) => visitedCodes.has(s.code.toLowerCase()) || visitedCodes.has(s.name.toLowerCase())
    ).length;
  }, [agendas, fullName, ownedStores]);

  const userCoveragePct = totalOwnedStoresCount > 0
    ? Math.round((visitedOwnedStoresCount / totalOwnedStoresCount) * 100)
    : 100;

  const myAgendasThisPeriod = useMemo(() => {
    return agendas.filter((a) => {
      const isMine = !a.pic || isSamePersonName(a.pic, fullName);
      if (selectedPeriod === 'Today') return isMine && a.date === selectedDate;
      return isMine && a.date >= weekStartStr && a.date <= weekEndStr;
    });
  }, [agendas, fullName, selectedPeriod, selectedDate, weekStartStr, weekEndStr]);

  const completedCount = myAgendasThisPeriod.filter((a) => a.completed).length;
  const totalPeriodCount = myAgendasThisPeriod.length;

  // Kegiatan Terdekat Hari Ini (Chronological Next Agenda)
  const upcomingAgenda = useMemo(() => {
    const myTodayAgendas = agendas.filter(
      (a) => a.date === todayYmd && (isSamePersonName(a.pic, fullName) || !a.pic)
    );
    const incomplete = myTodayAgendas.filter((a) => !a.completed);
    return incomplete[0] || myTodayAgendas[0] || null;
  }, [agendas, todayYmd, fullName]);

  // Broadcast WhatsApp Rincian Agenda
  const handleShareWhatsApp = (agenda: ScheduleAgenda) => {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://fmcu-teams.web.app';
    const storeInfo = agenda.storeCode ? `[${agenda.storeCode}] ${agenda.location}` : agenda.location || '-';
    const msg = [
      `📢 *JADWAL PENUGASAN FMCU*`,
      `👤 *Personel:* ${agenda.pic || '-'}`,
      `📅 *Hari/Tanggal:* ${agenda.date}`,
      `⏰ *Waktu:* ${agenda.time || '08:30'}${agenda.endTime ? ` – ${agenda.endTime}` : ''} WIB`,
      `🏷️ *Kategori:* ${agenda.category}`,
      `🏢 *Toko / Lokasi:* ${storeInfo}`,
      `📝 *Agenda:* ${agenda.title}`,
      agenda.description ? `ℹ️ *Catatan:* ${agenda.description}` : '',
      ``,
      `🔗 *Buka Aplikasi Web FMCU Teams:*`,
      `${appUrl}`,
      ``,
      `_Pesan otomatis dikirim melalui Sistem Operasional FMCU._`,
    ]
      .filter(Boolean)
      .join('\n');

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="flex h-full w-full bg-[#F8F9FD] overflow-hidden select-none">
      {/* =========================================================================
          1. LEFT SIDEBAR NAVIGATION: FIT SCREEN HEIGHT (USER & LOGOUT NEVER CUT OFF)
          ========================================================================= */}
      <aside className="w-56 lg:w-60 xl:w-64 bg-white border-r border-slate-100 flex flex-col h-full p-3.5 lg:p-4 z-20 shrink-0 select-none">
        {/* Brand & Logo */}
        <div className="flex items-center gap-2.5 mb-4 shrink-0">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#32C2AD] to-[#20A894] flex items-center justify-center text-white shadow-pill-teal font-extrabold text-sm shrink-0">
            F
          </div>
          <div className="min-w-0">
            <span className="text-[9.5px] font-bold text-teal-600 tracking-wider uppercase block">
              FMCU TEAMS
            </span>
            <h2 className="text-xs lg:text-sm font-extrabold text-slate-800 leading-tight truncate">
              Operations Portal
            </h2>
          </div>
        </div>

        {/* Scrollable Navigation Area (Mencegah elemen bawah terdorong keluar layar) */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-1 pr-0.5 my-1">
          {[
            { id: 'dashboard' as const, label: 'Daily Schedule', icon: LayoutGrid },
            { id: 'schedule' as const, label: 'Master Kalender', icon: CalendarIcon },
            { id: 'coverage' as const, label: 'Coverage Store', icon: Store },
            { id: 'profile' as const, label: 'Akun & Profil', icon: UserIcon },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveMenu(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#EAF8F2] text-[#2BB3A0] shadow-2xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          {/* Admin Return Shortcut (Hanya jika user admin) */}
          {user.isAdmin && onOpenAdminPortal && (
            <div className="pt-1.5">
              <button
                type="button"
                onClick={onOpenAdminPortal}
                className="w-full flex items-center justify-between p-2 rounded-2xl bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-sm hover:brightness-105 active:scale-95 transition-all text-xs font-bold cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[10.5px] truncate">Portal Admin FMCU</span>
                </div>
                <ArrowRight className="w-3 h-3 shrink-0" />
              </button>
            </div>
          )}

          {/* Dynamic Real Coverage Summary Box */}
          <div className="mt-3.5 bg-gradient-to-br from-slate-50 via-teal-50/40 to-slate-50 rounded-2xl p-3 border border-teal-100/60">
            <div className="flex items-center justify-between text-teal-700 font-bold text-xs mb-0.5">
              <span className="flex items-center gap-1.5">
                <Store className="w-3 h-3" />
                <span>Coverage Toko</span>
              </span>
              <span className="text-xs font-black">{userCoveragePct}%</span>
            </div>
            <p className="text-[10px] text-slate-500 mb-1.5 font-medium leading-tight">
              {visitedOwnedStoresCount} dari {totalOwnedStoresCount || 30} toko Anda telah dikunjungi.
            </p>
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-400 to-teal-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${userCoveragePct}%` }}
              />
            </div>
          </div>
        </div>

        {/* User Card & Logout Button: FIT SCREEN, ALWAYS VISIBLE WITHOUT SCROLL */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between shrink-0 mt-auto">
          <div className="flex items-center gap-2 min-w-0 pr-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#32C2AD] to-[#20A894] text-white font-black text-xs flex items-center justify-center uppercase shadow-soft-sm shrink-0">
              {user.name.substring(0, 2)}
            </div>
            <div className="min-w-0">
              <h4 className="text-[11.5px] font-bold text-slate-800 truncate leading-tight">{user.name}</h4>
              <p className="text-[9px] text-slate-400 truncate leading-tight">{user.role || 'Bestie FMCU'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Keluar dari Akun (Logout)"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200/70 hover:border-red-200 transition-all cursor-pointer shrink-0 shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* =========================================================================
          2. MAIN MIDDLE CONTENT: SWITCHES PER ACTIVE MENU
          ========================================================================= */}
      <main className="flex-1 overflow-y-auto px-5 lg:px-8 py-6">
        <div className="w-full max-w-[1240px] mx-auto">
          {activeMenu === 'schedule' ? (
            /* Halaman Master Kalender */
            <CalendarScheduleView
              user={user}
              agendas={agendas}
              onBack={() => setActiveMenu('dashboard')}
              onSelectAgenda={onSelectAgenda}
              onOpenNewAgenda={onOpenNewAgenda}
              onOpenExcelUpload={onOpenExcelUpload}
              onToggleComplete={onToggleComplete}
              onEditAgenda={onUpdateAgenda ? (item) => onSelectAgenda(item) : undefined}
              onDeleteAgenda={user.isAdmin ? onDeleteAgenda : undefined}
              onExportExcel={(filterPerson) => {
                exportScheduleToTemplateExcel(agendas, users, filterPerson || 'ALL');
              }}
              initialDate={selectedDate}
              isReadOnly={Boolean(user.isExecutiveViewer || user.accessLevel === 'EXECUTIVE_VIEWER')}
            />
          ) : activeMenu === 'coverage' ? (
            /* Halaman Coverage Store & Leaderboard */
            <HistoryView
              user={user}
              agendas={agendas}
              users={users}
              onSelectAgenda={onSelectAgenda}
              onBack={() => setActiveMenu('dashboard')}
            />
          ) : activeMenu === 'profile' ? (
            /* Halaman Akun & Pengaturan Profil Desktop (Lebar penuh, 2 kolom seimbang) */
            <ProfileView
              user={user}
              medicinesCount={agendas.filter((a) => isSamePersonName(a.pic, fullName)).length}
              onBack={() => setActiveMenu('dashboard')}
              onLogout={onLogout}
              onUpdateUser={onUpdateUser}
            />
          ) : (
            /* Halaman Utama: Daily & Weekly Schedule */
            <>
              {/* Top Header: Salam, Search Box & Dropdown Kategori Sejajar */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
                    Your Weekly Schedule
                  </h1>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Selamat {getTimeGreeting()}, {fullName}! 👋
                  </p>
                </div>

                {/* Filter Controls: Search Textbox & Dropdown Kategori Sejajar */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Search Input */}
                  <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Cari agenda atau lokasi..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-white border border-slate-200/90 rounded-full pl-9 pr-4 py-2 text-xs font-medium text-slate-800 outline-none focus:border-teal-500 w-52 lg:w-60 shadow-2xs transition-all"
                    />
                  </div>

                  {/* Dropdown Kategori Agenda (Sejajar dengan Search) */}
                  <div className="relative flex items-center">
                    <Tag className="w-3.5 h-3.5 text-teal-600 absolute left-3 pointer-events-none" />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="bg-white border border-slate-200/90 rounded-full pl-8 pr-7 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-teal-500 cursor-pointer shadow-2xs max-w-[155px] truncate transition-all"
                      title="Filter Kategori Agenda"
                    >
                      <option value="ALL" className="text-xs font-semibold text-slate-800">Semua Kategori</option>
                      {SCHEDULE_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="text-xs font-medium text-slate-800">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dropdown Nama Tim (Hanya jika tab Semua Tim dipilih) */}
                  {selectedPeriod === 'AllTeam' && (
                    <div className="relative flex items-center">
                      <Users className="w-3.5 h-3.5 text-teal-600 absolute left-3 pointer-events-none" />
                      <select
                        value={selectedPersonDropdown}
                        onChange={(e) => setSelectedPersonDropdown(e.target.value)}
                        className="bg-white border border-slate-200/90 rounded-full pl-8 pr-7 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-teal-500 cursor-pointer shadow-2xs max-w-[170px] truncate transition-all"
                        title="Filter berdasarkan Nama Personel Tim (A-Z)"
                      >
                        <option value="ALL" className="text-xs font-semibold text-slate-800">
                          Semua Personel ({allTeamNamesAZ.length})
                        </option>
                        {allTeamNamesAZ.map((name) => (
                          <option key={name} value={name} className="text-xs font-medium text-slate-800">
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Live Maps Pinpoint Shortcut */}
                  {onOpenLiveMaps && (
                    <button
                      type="button"
                      onClick={onOpenLiveMaps}
                      className="w-9 h-9 rounded-full bg-[#EAF8F2] flex items-center justify-center text-teal-700 shadow-2xs hover:scale-105 active:scale-95 transition-all relative cursor-pointer"
                      title="Buka Live Maps Pinpoint & Rute Toko"
                    >
                      <MapPin className="w-4 h-4" />
                      <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-1.5 right-1.5 border-2 border-white ring-1 ring-[#EAF8F2]" />
                    </button>
                  )}

                  {/* Action Khusus Admin Saja (Disembunyikan dari User) */}
                  {user.isAdmin && (
                    <div className="flex items-center gap-2">
                      {onOpenExcelUpload && (
                        <button
                          type="button"
                          onClick={onOpenExcelUpload}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white hover:bg-slate-50 text-teal-700 border border-teal-300/80 text-xs font-bold shadow-2xs cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Upload Excel</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onOpenNewAgenda}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white text-xs font-bold shadow-pill-teal cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Buat Schedule</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Stories & Aktivitas Lapangan (Desktop View) */}
              <div className="bg-white rounded-3xl p-4 lg:p-5 shadow-soft-card mb-6 border border-slate-100">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-[#FF2E93] to-[#FF8A00] animate-pulse" />
                    <h3 className="text-xs lg:text-sm font-extrabold text-slate-800 tracking-tight">
                      Stories & Dokumentasi Lapangan
                    </h3>
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200/60">
                      Live 24 Jam
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
                    Klik lingkaran untuk melihat foto & update tim lapangan
                  </span>
                </div>
                <EmployeeStoriesBar currentUser={user} agendas={agendas} users={users} className="w-full" />
              </div>

              {/* 3 Top Summary Stat Cards: Data Aktual Dinamis */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Card 1: Real Coverage Store */}
                <div className="bg-white rounded-3xl p-4 lg:p-5 shadow-soft-card flex items-center justify-between border border-transparent hover:border-teal-100 transition-all">
                  <div>
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">
                      Coverage Toko Anda
                    </span>
                    <h3 className="text-2xl font-black text-slate-800 mt-1">
                      {userCoveragePct}%
                    </h3>
                    <p className="text-xs text-teal-600 font-semibold mt-0.5">
                      {visitedOwnedStoresCount} dari {totalOwnedStoresCount || 30} toko selesai
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-[#EAF8F2] text-[#2BB3A0] flex items-center justify-center shrink-0">
                    <Store className="w-6 h-6" />
                  </div>
                </div>

                {/* Card 2: Total Agenda Periode Ini */}
                <div className="bg-white rounded-3xl p-4 lg:p-5 shadow-soft-card flex items-center justify-between border border-transparent hover:border-orange-100 transition-all">
                  <div>
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">
                      Agenda Terjadwal
                    </span>
                    <h3 className="text-2xl font-black text-slate-800 mt-1">
                      {totalPeriodCount} Kegiatan
                    </h3>
                    <p className="text-xs text-orange-500 font-semibold mt-0.5">
                      {completedCount} kegiatan selesai
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-[#FFF4ED] text-[#FF9E79] flex items-center justify-center shrink-0">
                    <CalendarIcon className="w-6 h-6" />
                  </div>
                </div>

                {/* Card 3: Upcoming Next Real Time */}
                <div className="bg-white rounded-3xl p-4 lg:p-5 shadow-soft-card flex items-center justify-between border border-transparent hover:border-pink-100 transition-all">
                  <div className="min-w-0 pr-2">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">
                      Kegiatan Berikutnya
                    </span>
                    <h3 className="text-xl lg:text-2xl font-black text-slate-800 mt-1 truncate">
                      {upcomingAgenda ? (upcomingAgenda.category === 'OFF' ? 'OFF' : `${upcomingAgenda.time} WIB`) : 'Selesai'}
                    </h3>
                    <p className="text-xs text-pink-500 font-semibold mt-0.5 truncate">
                      {upcomingAgenda ? upcomingAgenda.title : 'Tidak ada agenda tertunda'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-[#FFEAF0] text-[#FF6B8B] flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Horizontal Calendar Strip */}
              <div className="bg-white rounded-3xl p-4 lg:p-5 shadow-soft-card mb-6 border border-slate-100">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs lg:text-sm font-bold text-slate-800">Kalender Mingguan</h3>
                  <span className="text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200/80 flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-teal-600" />
                    <span>{currentMonthYear}</span>
                  </span>
                </div>
                <CalendarStrip
                  selectedDate={selectedDate}
                  onSelectDate={(d) => {
                    onSelectDate(d);
                    setSelectedPeriod('Today');
                  }}
                  baseDate={currentWeekMonday}
                  focusTrigger={calendarFocus}
                />
              </div>

              {/* Period Filter Tabs (Hari Ini, Minggu Ini, Semua Tim) */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-6 px-1">
                  {(['Today', 'Week', 'AllTeam'] as const).map((period) => {
                    const isActive = selectedPeriod === period;
                    return (
                      <button
                        key={period}
                        type="button"
                        onClick={() => handleSelectPeriodTab(period)}
                        className="relative pb-1.5 transition-colors cursor-pointer"
                      >
                        <span
                          className={`text-xs lg:text-sm font-bold transition-colors ${
                            isActive ? 'text-slate-800 font-black' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          {period === 'Today' ? 'Hari Ini' : period === 'Week' ? 'Minggu Ini' : 'Semua Tim'}
                        </span>
                        {isActive && (
                          <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#4E80EE] rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Week Navigator Controls */}
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 shadow-2xs">
                    <button
                      type="button"
                      onClick={handlePrevWeek}
                      className="w-7 h-7 rounded-xl bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center transition shadow-2xs cursor-pointer active:scale-95"
                      title="Lihat Minggu Sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="px-2 text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <span>{formatWeekRangeDisplay(currentWeekMonday)}</span>
                      {isCurrentRunningWeek && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                          Minggu Berjalan
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleNextWeek}
                      className="w-7 h-7 rounded-xl bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center transition shadow-2xs cursor-pointer active:scale-95"
                      title="Lihat Minggu Berikutnya"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                    {filteredAgendas.length} agenda
                  </span>
                </div>
              </div>

              {/* List Schedule Agenda Grid */}
              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 pb-8">
                {filteredAgendas.length === 0 ? (
                  <div className="col-span-full py-10 text-center bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-card">
                    <p className="text-slate-400 text-xs font-medium">
                      Belum ada agenda yang cocok untuk {selectedPeriod === 'Today' ? `tanggal ${selectedDate}` : `minggu ${formatWeekRangeDisplay(currentWeekMonday)}`}.
                    </p>
                  </div>
                ) : selectedPeriod === 'AllTeam' ? (
                  <div className="col-span-full divide-y divide-slate-200/70 px-1 bg-white rounded-3xl p-4 shadow-soft-card">
                    {groupedAllTeamWeekByPerson.map((group) => (
                      <div key={group.picName} className="py-2.5 px-1">
                        <p className="text-[11px] font-bold text-slate-900 leading-tight mb-1">
                          {group.picName}
                        </p>
                        <div className="space-y-0.5 pl-2 border-l border-slate-200/80">
                          {group.items.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => onSelectAgenda(item)}
                              className={`w-full text-left py-1.5 px-2 rounded-xl hover:bg-slate-100/70 transition-colors flex items-start justify-between gap-2 cursor-pointer ${
                                selectedAgenda?.id === item.id ? 'bg-teal-50/80' : ''
                              }`}
                            >
                              <p className="text-[11px] font-normal text-slate-600 leading-snug min-w-0 flex-1">
                                <span className="font-semibold text-slate-500">
                                  {formatShortDayDate(item.date)} •{' '}
                                </span>
                                <span>
                                  {item.title}
                                  {item.location &&
                                  item.location !== 'OFF / LIBUR' &&
                                  !item.title.toLowerCase().includes(item.location.toLowerCase())
                                    ? ` — ${item.location}`
                                    : ''}
                                </span>
                              </p>

                              <span className="text-[9.5px] font-bold text-slate-400 shrink-0 tabular-nums pt-0.5">
                                {item.category === 'OFF' ? 'OFF' : item.time}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  filteredAgendas.map((agenda) => (
                    <div
                      key={agenda.id}
                      className={`transition-all ${
                        selectedAgenda?.id === agenda.id ? 'ring-2 ring-teal-400 rounded-[28px]' : ''
                      }`}
                    >
                      <ScheduleCard
                        agenda={agenda}
                        onClick={onSelectAgenda}
                      />
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* =========================================================================
          3. RIGHT SIDEBAR: AGENDA DETAIL INSPECTOR & ACTIONS (HANYA MUNCUL DI MENU DASHBOARD)
          ========================================================================= */}
      {activeMenu === 'dashboard' && (
        <aside className="w-80 lg:w-[320px] xl:w-[350px] bg-white border-l border-slate-100 flex flex-col h-full p-4 lg:p-5 overflow-y-auto z-20 shrink-0">
          {selectedAgenda ? (
            <div className="flex-1 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between mb-3 shrink-0">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Detail Agenda
                </span>
                <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                  {selectedAgenda.category}
                </span>
              </div>

              {/* Title & Description */}
              <h2 className="text-lg lg:text-xl font-black text-slate-900 tracking-tight leading-snug">
                {selectedAgenda.title}
              </h2>

              <p className="text-xs text-slate-400 font-normal leading-relaxed mt-1.5">
                {selectedAgenda.description || 'Tidak ada catatan tambahan untuk agenda ini.'}
              </p>

              {/* Info Badges */}
              <div className="space-y-2 mt-4">
                <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-[#F8FAFC] border border-slate-100">
                  <Clock className="w-4 h-4 text-teal-600 shrink-0" />
                  <div className="text-xs font-bold text-slate-700">
                    {selectedAgenda.date} • {selectedAgenda.time} WIB
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-[#F8FAFC] border border-slate-100">
                  <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                  <div className="text-xs font-bold text-slate-700 truncate">
                    {selectedAgenda.location}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-[#F8FAFC] border border-slate-100">
                  <UserIcon className="w-4 h-4 text-blue-600 shrink-0" />
                  <div className="text-xs font-bold text-slate-700">
                    PIC: {selectedAgenda.pic || 'Belum Ditentukan'}
                  </div>
                </div>
              </div>

              {/* Action 0: Toggle Selesai / Belum Selesai */}
              {onToggleComplete && (
                <button
                  type="button"
                  onClick={() => onToggleComplete(selectedAgenda.id)}
                  className={`w-full py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 border transition-all active:scale-95 cursor-pointer mt-3 shadow-2xs ${
                    selectedAgenda.completed
                      ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90'
                  }`}
                >
                  <CheckCircle2 className={`w-4 h-4 ${selectedAgenda.completed ? 'text-white' : 'text-slate-400'}`} />
                  <span>{selectedAgenda.completed ? 'Agenda Selesai Dikerjakan' : 'Tandai Sebagai Selesai'}</span>
                </button>
              )}

              {/* Action 1: Tombol Rute Google Maps */}
              <button
                type="button"
                onClick={() => {
                  const dest = selectedAgenda.location || selectedAgenda.title;
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`, '_blank');
                }}
                className="w-full py-2.5 px-3 rounded-2xl bg-teal-50 hover:bg-teal-100/90 text-teal-800 font-bold text-xs flex items-center justify-center gap-2 border border-teal-200 transition-all active:scale-95 cursor-pointer mt-3"
              >
                <Navigation className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>Rute ke Lokasi (Google Maps)</span>
              </button>

              {/* Action 2: Broadcast WhatsApp Action */}
              <button
                type="button"
                onClick={() => handleShareWhatsApp(selectedAgenda)}
                className="w-full py-2.5 px-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 font-bold text-xs flex items-center justify-center gap-2 border border-emerald-200 transition-all active:scale-95 cursor-pointer mt-2"
                title="Kirim rincian agenda ke WhatsApp"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Broadcast ke WhatsApp</span>
              </button>

              {/* Action 3: Tombol Buka Form Visit Report (Khusus Jadwal VISIT) */}
              {selectedAgenda.category === 'VISIT' && (
                <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-teal-200">
                  <span className="text-[10px] font-black text-teal-800 uppercase tracking-wider block mb-1">
                    Formulir Kunjungan &amp; Laporan
                  </span>
                  <p className="text-[11px] text-slate-600 mb-2.5">
                    Buka formulir inspeksi toko, input QSC FamiTrack, data crew, observasi, dan bukti foto.
                  </p>
                  {selectedAgenda.date > todayYmd && !user.isAdmin ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-400 text-xs font-black border border-slate-200 flex items-center justify-center gap-1.5 cursor-not-allowed select-none shadow-none"
                      title={`Form Visit terkunci. Kunjungan ke depan baru dapat dibuka saat tanggal ${selectedAgenda.date} tiba.`}
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Form Visit Terkunci (Hari H)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenVisitForm && onOpenVisitForm(selectedAgenda)}
                      className="w-full py-2.5 rounded-xl bg-[#00A389] text-white text-xs font-extrabold shadow-pill-teal hover:brightness-105 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Buka Form Visit Report</span>
                    </button>
                  )}
                  {selectedAgenda.date > todayYmd && !user.isAdmin && (
                    <p className="text-[9.5px] text-center font-medium text-slate-400 mt-2">
                      Jadwal kunjungan ke depan terkunci ({selectedAgenda.date}). Jadwal hari ini atau yang sudah lewat dapat dibuka.
                    </p>
                  )}
                </div>
              )}

              {/* Action 4: Hapus Agenda (Khusus Admin) */}
              {user.isAdmin && onDeleteAgenda && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Hapus agenda "${selectedAgenda.title}"? Perubahan akan langsung disinkronkan ke cloud.`)) {
                      onDeleteAgenda(selectedAgenda.id);
                    }
                  }}
                  className="w-full py-2 px-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] flex items-center justify-center gap-1.5 border border-rose-200 transition-all active:scale-95 cursor-pointer mt-3"
                  title="Hapus Agenda dari Sistem"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>Hapus Agenda (Admin)</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">Detail Agenda</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
                Pilih salah satu agenda di daftar untuk melihat detail informasi operasional.
              </p>
            </div>
          )}

          {/* Footer info & Developer Credits: FIT & NEVER CLIPPED */}
          <div className="mt-auto pt-4 border-t border-slate-100 shrink-0">
            {/* Tombol Buat Agenda Baru (HANYA MUNCUL UNTUK ADMIN) */}
            {user.isAdmin && (
              <button
                type="button"
                onClick={onOpenNewAgenda}
                className="w-full py-3 mb-2 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white font-bold text-xs shadow-pill-teal hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>+ Buat Agenda Baru</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            <DeveloperFooter className="text-center" />
          </div>
        </aside>
      )}
    </div>
  );
};
