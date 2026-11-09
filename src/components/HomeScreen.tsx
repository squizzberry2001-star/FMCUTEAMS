import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  CalendarDays,
  MapPin,
  Search,
  X,
  Users,
  Tag,
} from 'lucide-react';
import { ScheduleAgenda, User, SCHEDULE_CATEGORY_OPTIONS } from '../types';
import { CalendarStrip, CalendarFocusTrigger } from './CalendarStrip';
import { ScheduleCard } from './ScheduleCard';
import { BottomNavbar, NavTabType } from './BottomNavbar';
import { EmployeeStoriesBar } from './EmployeeStoriesBar';
import { DeveloperFooter } from './DeveloperFooter';
import {
  getMondayOfWeek,
  getFullWeekDays,
} from '../services/scheduleExcelService';
import { isSamePersonName } from '../data/masterStoresData';

interface HomeScreenProps {
  user?: User | null;
  agendas: ScheduleAgenda[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onSelectAgenda?: (agenda: ScheduleAgenda) => void;
  onOpenNewAgenda?: () => void;
  onOpenExcelUpload?: () => void;
  onOpenLiveMaps?: () => void;
  onToggleComplete?: (id: string, e?: React.MouseEvent) => void;
  onOpenProfile?: () => void;
  onOpenCalendar?: () => void;
  onOpenHistory?: () => void;
  activeNavTab?: string;
  setActiveNavTab?: (tab: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  user,
  agendas,
  selectedDate,
  onSelectDate,
  onSelectAgenda,
  onOpenLiveMaps,
  onOpenProfile,
  onOpenCalendar,
  onOpenHistory,
  activeNavTab = 'home',
  setActiveNavTab,
}) => {
  // Tab Filter: 'Today' (Hari Ini), 'Week' (Minggu Ini), 'AllTeam' (Semua Tim - menggantikan Bulan Ini)
  const [selectedPeriod, setSelectedPeriod] = useState<'Today' | 'Week' | 'AllTeam'>('Today');
  const [nameFilter, setNameFilter] = useState<string>('');
  const [selectedPersonDropdown, setSelectedPersonDropdown] = useState<string>('ALL');
  const [selectedCategoryDropdown, setSelectedCategoryDropdown] = useState<string>('ALL');
  const [calendarFocus, setCalendarFocus] = useState<CalendarFocusTrigger>({
    mode: 'today',
    ts: Date.now(),
  });
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reference Monday for active week view (Always locked to running week)
  const currentWeekMonday = getMondayOfWeek();
  const activeWeekDays = getFullWeekDays(currentWeekMonday);
  const weekStartStr = activeWeekDays[0]?.dateStr || currentWeekMonday;
  const weekEndStr = activeWeekDays[activeWeekDays.length - 1]?.dateStr || currentWeekMonday;

  // Tanggal aktual hari ini (YYYY-MM-DD)
  const getTodayYmd = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Nama lengkap akun yang login
  const fullName = user?.name || 'Sarah Jenkins';

  // Live Digital Clock & Tanggal Aktual untuk Header
  const [liveNow, setLiveNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Bulan dan tahun aktual untuk pojok kanan atas kalender strip & header
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const shortMonthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  const shortDayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const formatShortDayDate = (dateYmd: string) => {
    const dt = new Date(dateYmd + 'T00:00:00');
    if (isNaN(dt.getTime())) return dateYmd;
    const dayLabel = shortDayNames[dt.getDay()];
    const dd = String(dt.getDate()).padStart(2, '0');
    const mon = shortMonthNames[dt.getMonth()];
    return `${dayLabel}, ${dd} ${mon}`;
  };
  const currentMonthYear = `${monthNames[liveNow.getMonth()]} ${liveNow.getFullYear()}`;
  const actualDateNum = liveNow.getDate();
  const actualMonthName = monthNames[liveNow.getMonth()];
  const actualYear = liveNow.getFullYear();
  const digitalClock = `${String(liveNow.getHours()).padStart(2, '0')}:${String(
    liveNow.getMinutes()
  ).padStart(2, '0')}:${String(liveNow.getSeconds()).padStart(2, '0')}`;

  // Ucapan salam berdasarkan jam aktual (Pagi, Siang, Sore, Malam)
  const getTimeGreeting = (date: Date) => {
    const hours = date.getHours();
    if (hours >= 4 && hours < 11) return 'Selamat Pagi';
    if (hours >= 11 && hours < 15) return 'Selamat Siang';
    if (hours >= 15 && hours < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  // Handler klik tab "Hari Ini", "Minggu Ini", "Semua Tim"
  const handleSelectPeriodTab = (period: 'Today' | 'Week' | 'AllTeam') => {
    setSelectedPeriod(period);
    const todayStr = getTodayYmd();

    if (period === 'Today') {
      // KETIKA USER KLIK TOMBOL HARI INI MAKA SELECTION PILL AUTO KE TANGGAL AKTUAL
      onSelectDate(todayStr);
      setCalendarFocus({ mode: 'today', ts: Date.now() });
    } else if (period === 'Week' || period === 'AllTeam') {
      // KETIKA USER KLIK MINGGU INI ATAU SEMUA TIM PILL AUTO FOCUS KE MINGGUAN AKTUAL
      setCalendarFocus({ mode: 'week', ts: Date.now() });
    }
  };

  // Rentang 1 Minggu Penuh untuk tab Semua Tim (mengikuti minggu dari pill yang dipilih atau minggu berjalan)
  const { teamWeekStartStr, teamWeekEndStr } = useMemo(() => {
    if (selectedDate >= weekStartStr && selectedDate <= weekEndStr) {
      // Gunakan Senin s/d Minggu dari currentWeekMonday (7 hari penuh jadwal mingguan)
      const monDate = new Date(currentWeekMonday + 'T00:00:00');
      const sunDate = new Date(monDate);
      sunDate.setDate(monDate.getDate() + 6);
      const sunStr = `${sunDate.getFullYear()}-${String(sunDate.getMonth() + 1).padStart(2, '0')}-${String(
        sunDate.getDate()
      ).padStart(2, '0')}`;
      return { teamWeekStartStr: currentWeekMonday, teamWeekEndStr: sunStr };
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
  }, [selectedDate, weekStartStr, weekEndStr, currentWeekMonday]);

  // Daftar seluruh nama tim unik terurut A-Z untuk fitur Filter by Nama
  const allTeamNamesAZ = useMemo(() => {
    const names = Array.from(
      new Set(agendas.map((a) => (a.pic || '').trim()).filter(Boolean))
    );
    return names.sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' }));
  }, [agendas]);

  // Filter agenda berdasarkan tab aktif:
  // - 'Today': Jadwal milik user pada tanggal terpilih
  // - 'Week': Jadwal milik user pada minggu aktual
  // - 'AllTeam': Jadwal Semua Tim dalam 1 Minggu Penuh (Diurutkan A-Z Nama Tim + Filter by Nama)
  const displayedAgendas = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();

    const filtered = agendas.filter((item) => {
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
      // 'AllTeam' -> Menampilkan jadwal seluruh tim dalam 1 Minggu Penuh + Filter by Nama
      if (item.date < teamWeekStartStr || item.date > teamWeekEndStr) return false;

      if (selectedPersonDropdown !== 'ALL' && selectedPeriod === 'AllTeam') {
        if (!isSamePersonName(item.pic, selectedPersonDropdown) && item.pic !== selectedPersonDropdown) {
          return false;
        }
      }
      if (selectedCategoryDropdown !== 'ALL') {
        if (item.category !== selectedCategoryDropdown) {
          return false;
        }
      }
      if (q) {
        const matchPic = (item.pic || '').toLowerCase().includes(q);
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchLoc = (item.location || '').toLowerCase().includes(q);
        return matchPic || matchTitle || matchLoc;
      }
      return true;
    });

    if (selectedPeriod === 'AllTeam') {
      return [...filtered].sort(
        (a, b) =>
          (a.pic || '').localeCompare(b.pic || '', 'id', { sensitivity: 'base' }) ||
          (a.date || '').localeCompare(b.date || '') ||
          (a.time || '').localeCompare(b.time || '')
      );
    }

    return filtered;
  }, [
    agendas,
    fullName,
    selectedPeriod,
    selectedDate,
    weekStartStr,
    weekEndStr,
    teamWeekStartStr,
    teamWeekEndStr,
    nameFilter,
    selectedPersonDropdown,
    selectedCategoryDropdown,
  ]);

  // Pengelompokan per Nama Tim (A-Z) untuk tab Semua Tim (1 Minggu Penuh):
  // Visual Nama Kecil Bold di atas, lalu di bawahnya semua agendanya dalam 1 minggu berurutan sampai bawah
  const groupedAllTeamWeekByPerson = useMemo(() => {
    if (selectedPeriod !== 'AllTeam') return [];
    const groupsMap = new Map<string, ScheduleAgenda[]>();
    for (const item of displayedAgendas) {
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
  }, [selectedPeriod, displayedAgendas]);

  // Scroll detection & auto navbar scale with rAF throttling & icon click restore
  const manualExpandedRef = useRef(false);
  const manualExpandedScrollTopRef = useRef(0);
  const lastScrollTopRef = useRef(0);

  const getScrollTop = () => {
    const targets = [
      window.scrollY,
      window.pageYOffset,
      document.documentElement?.scrollTop,
      document.body?.scrollTop,
      scrollContainerRef.current?.scrollTop,
    ];
    return Math.max(...targets.map((v) => (typeof v === 'number' && !isNaN(v) ? v : 0)));
  };

  const handleResetScale = () => {
    setIsScrolled(false);
    manualExpandedRef.current = true;
    manualExpandedScrollTopRef.current = getScrollTop();
  };

  const checkScroll = () => {
    const top = getScrollTop();
    const delta = top - lastScrollTopRef.current;
    lastScrollTopRef.current = top;
    if (top <= 10 || delta < -4) {
      setIsScrolled(false);
      manualExpandedRef.current = false;
    } else if (delta > 4 && top > 20) {
      setIsScrolled(true);
    }
  };

  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const top = getScrollTop();
          const delta = top - lastScrollTopRef.current;
          lastScrollTopRef.current = top;

          if (top <= 10) {
            setIsScrolled(false);
            manualExpandedRef.current = false;
          } else if (manualExpandedRef.current) {
            if (top > manualExpandedScrollTopRef.current + 8 || delta > 4) {
              manualExpandedRef.current = false;
              setIsScrolled(true);
            }
          } else if (delta < -4) {
            setIsScrolled(false);
          } else if (delta > 4 && top > 20) {
            setIsScrolled(true);
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', onScroll, { passive: true });
    }
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('touchmove', onScroll, { passive: true });
    window.addEventListener('wheel', onScroll, { passive: true });

    onScroll();

    return () => {
      if (container) {
        container.removeEventListener('scroll', onScroll);
      }
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('touchmove', onScroll);
      window.removeEventListener('wheel', onScroll);
    };
  }, []);

  return (
    <div
      ref={scrollContainerRef}
      onScroll={checkScroll}
      className="flex flex-col h-full bg-[#F8F9FD] overflow-y-auto overflow-x-hidden no-scrollbar px-4 sm:px-6 md:px-8 pt-0 pb-28 w-full max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto relative select-none"
    >
      {/* Top Header: Left "Welcome back!, {fullName}", Subtitle Greeting & Right Live Maps Icon */}
      <div className="relative pt-[max(0.75rem,env(safe-area-inset-top,12px))] pb-1 mb-3 flex items-center justify-between">
        <div className="text-left pr-14">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight tracking-tight">
            Welcome back!, {fullName}
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5 tracking-wide flex items-center gap-1.5">
            <span className="text-teal-700 font-extrabold">{getTimeGreeting(liveNow)}</span>
            <span>•</span>
            <span className="tabular-nums">{actualDateNum} {actualMonthName} {actualYear}</span>
            <span>•</span>
            <span className="tabular-nums text-slate-400">{digitalClock}</span>
          </p>
        </div>

        {/* ICON MAPS DI POJOK KANAN ATAS (SEJAJAR DENGAN TITLE) */}
        <button
          type="button"
          onClick={onOpenLiveMaps}
          className="w-11 h-11 rounded-full iphone-glass-icon-btn flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer group shadow-xs absolute right-0 top-1/2 -translate-y-1/2"
          title="Buka Live Maps Pinpoint & Rute Toko"
        >
          <MapPin className="w-5 h-5 stroke-[2.2] text-teal-700 group-hover:scale-110 transition-transform" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#2BB3A0] absolute top-2 right-2 border-2 border-white ring-2 ring-[#EAF8F2]" />
        </button>
      </div>

      {/* Section 1 Item 2: Instagram-Style Circle Story Bar Below "Hallo, User!" */}
      <EmployeeStoriesBar currentUser={user} agendas={agendas} className="mb-3 -mx-4 sm:-mx-6 px-0" />

      {/* Section 1 Item 6: Sticky on top Calendar Strip & Sub section Filter */}
      <div
        className={`sticky top-0 z-20 bg-[#F8F9FD] pt-[max(0.75rem,env(safe-area-inset-top,14px))] pb-3 mb-3 -mx-4 px-4 sm:-mx-6 sm:px-6 transition-all ${
          isScrolled ? 'border-b border-slate-200/60 shadow-xs' : ''
        }`}
      >
        {/* Section 1 Item 3: Kalender Mingguan & Badge Bulan Tahun (Tanpa badge lain di sebelahnya) */}
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-extrabold text-slate-400 tracking-wider uppercase">
            Kalender Mingguan
          </span>

          <span className="text-[10px] sm:text-[11px] font-bold text-teal-800 bg-white/90 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-teal-200/80 shadow-xs flex items-center gap-1">
            <CalendarDays className="w-3 h-3 text-teal-600" />
            <span>{currentMonthYear}</span>
          </span>
        </div>

        {/* Section 1 Item 2: Horizontal Scrollable Calendar Strip (Auto focus Minggu Aktual) */}
        <CalendarStrip
          selectedDate={selectedDate}
          onSelectDate={(dateStr) => {
            onSelectDate(dateStr);
          }}
          baseDate={currentWeekMonday}
          focusTrigger={calendarFocus}
        />

        {/* Section 1 Item 4: Sub section tab filter (Hari Ini, Minggu Ini, Semua Tim) & Counter */}
        <div className="mt-3.5 pt-3 border-t border-slate-200/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5 sm:gap-6">
              {(['Today', 'Week', 'AllTeam'] as const).map((period) => {
                const isActive = selectedPeriod === period;
                return (
                  <button
                    key={period}
                    type="button"
                    onClick={() => handleSelectPeriodTab(period)}
                    className="relative pb-1 transition-colors cursor-pointer"
                  >
                    <span
                      className={`text-xs sm:text-sm font-bold transition-colors ${
                        isActive ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {period === 'Today'
                        ? 'Hari Ini'
                        : period === 'Week'
                        ? 'Minggu Ini'
                        : 'Semua Tim'}
                    </span>
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4E80EE] rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            <span className="text-[11px] font-bold text-slate-500 flex-shrink-0">
              {displayedAgendas.length} agenda
            </span>
          </div>

          {/* Fitur Filter: Textbox Search & Tombol Filter Kategori Sejajar Rapi */}
          <div className="flex items-center gap-2 mt-2.5">
            {/* 1. Textbox Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder={selectedPeriod === 'AllTeam' ? 'Cari nama / agenda...' : 'Cari agenda / toko...'}
                className="w-full bg-white/95 border border-slate-200/90 rounded-xl pl-8 pr-7 py-1.5 text-[11px] font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-teal-500 shadow-2xs transition-all"
              />
              {nameFilter && (
                <button
                  type="button"
                  onClick={() => setNameFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 2. Tombol Filter Kategori Agenda (Sejajar dengan Textbox Search) */}
            <div className="relative shrink-0 max-w-[130px] sm:max-w-[155px] md:max-w-[180px]">
              <Tag className="w-3 h-3 text-teal-600 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedCategoryDropdown}
                onChange={(e) => setSelectedCategoryDropdown(e.target.value)}
                className="w-full bg-white/95 border border-slate-200/90 rounded-xl pl-6 pr-5 py-1.5 text-[10.5px] font-bold text-slate-700 outline-none focus:border-teal-500 cursor-pointer truncate shadow-2xs"
                title="Filter berdasarkan Kategori Agenda"
              >
                <option value="ALL" className="text-[10.5px] font-semibold text-slate-800 py-1">Semua Kategori</option>
                {SCHEDULE_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="text-[10.5px] font-medium text-slate-800 py-1">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Dropdown Nama Tim (Hanya jika periode Semua Tim dipilih) */}
            {selectedPeriod === 'AllTeam' && (
              <div className="relative shrink-0 max-w-[115px] sm:max-w-[140px] md:max-w-[165px]">
                <Users className="w-3 h-3 text-teal-600 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={selectedPersonDropdown}
                  onChange={(e) => setSelectedPersonDropdown(e.target.value)}
                  className="w-full bg-white/95 border border-slate-200/90 rounded-xl pl-6 pr-5 py-1.5 text-[10.5px] font-bold text-slate-700 outline-none focus:border-teal-500 cursor-pointer truncate shadow-2xs"
                  title="Filter berdasarkan Nama Tim (A-Z)"
                >
                  <option value="ALL" className="text-[10.5px] font-semibold text-slate-800 py-1">Semua Nama</option>
                  {allTeamNamesAZ.map((personName) => (
                    <option key={personName} value={personName} className="text-[10.5px] font-medium text-slate-800 py-1">
                      {personName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 1 Item 3 & 5: List Schedule Agenda */}
      <div className="space-y-3 pt-1">
        {displayedAgendas.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-card">
            <p className="text-slate-500 text-xs font-semibold">
              {selectedPeriod === 'AllTeam'
                ? `Belum ada schedule agenda tim yang cocok pada minggu ${formatShortDayDate(teamWeekStartStr)} – ${formatShortDayDate(teamWeekEndStr)}.`
                : selectedPeriod === 'Week'
                ? `Tidak ada agenda yang ditugaskan kepada Anda pada minggu ini.`
                : `Tidak ada agenda yang ditugaskan kepada Anda pada tanggal ini (${selectedDate}).`}
            </p>
            {selectedPeriod !== 'AllTeam' && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => handleSelectPeriodTab('AllTeam')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 text-xs font-bold border border-teal-200/60 hover:bg-teal-100 transition-colors cursor-pointer"
                >
                  <span>
                    Lihat Semua Tim 1 Minggu ({agendas.filter((a) => a.date >= teamWeekStartStr && a.date <= teamWeekEndStr).length})
                  </span>
                </button>
              </div>
            )}
          </div>
        ) : selectedPeriod === 'AllTeam' ? (
          /* Minimalist Text List Semua Tim dalam 1 Minggu Penuh: Visual Nama Kecil Bold di atas, lalu di bawahnya semua agendanya dalam 1 minggu sampai bawah */
          <div className="px-1">
            <div className="flex items-center justify-between px-1 mb-1.5">
              <span className="text-[10px] font-bold text-teal-700">
                Jadwal 1 Minggu: {formatShortDayDate(teamWeekStartStr)} – {formatShortDayDate(teamWeekEndStr)}
              </span>
              <span className="text-[10px] font-light text-slate-500">
                {groupedAllTeamWeekByPerson.length} personel
              </span>
            </div>

            <div className="divide-y divide-slate-200/70">
              {groupedAllTeamWeekByPerson.map((group) => (
                <div key={group.picName} className="py-2.5 px-1">
                  {/* Visual Nama Kecil Bold */}
                  <p className="text-[11px] font-bold text-slate-900 leading-tight mb-1">
                    {group.picName}
                  </p>

                  {/* Di bawahnya semua agendanya dalam satu minggu penuh */}
                  <div className="space-y-0.5 pl-2 border-l border-slate-200/80">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectAgenda && onSelectAgenda(item)}
                        className="w-full text-left py-1 px-1.5 rounded-lg hover:bg-slate-100/70 active:bg-slate-100 transition-colors flex items-start justify-between gap-2 cursor-pointer"
                      >
                        <p className="text-[11px] font-light text-slate-600 leading-snug min-w-0 flex-1">
                          <span className="font-normal text-slate-500">
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

                        <span className="text-[9px] font-light text-slate-400 shrink-0 tabular-nums pt-0.5">
                          {item.category === 'OFF' ? 'OFF' : item.time}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          displayedAgendas.map((agenda) => (
            <ScheduleCard
              key={agenda.id}
              agenda={agenda}
              onClick={onSelectAgenda}
            />
          ))
        )}
      </div>

      {/* Minimalist Page Footer */}
      <DeveloperFooter className="mt-auto pt-16 pb-8 text-center" />

      {/* Navbar */}
      <BottomNavbar
        activeTab={activeNavTab as NavTabType}
        onSelectTab={(tab) => {
          handleResetScale();
          if (setActiveNavTab) setActiveNavTab(tab);
          if (tab === 'calendar' && onOpenCalendar) onOpenCalendar();
          if (tab === 'history' && onOpenHistory) onOpenHistory();
          if (tab === 'profile' && onOpenProfile) onOpenProfile();
        }}
        isScrolled={isScrolled}
        onResetScale={handleResetScale}
      />
    </div>
  );
};
