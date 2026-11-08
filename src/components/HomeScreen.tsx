import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  CalendarDays,
  MapPin,
} from 'lucide-react';
import { ScheduleAgenda, User } from '../types';
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
  const currentMonthYear = `${monthNames[liveNow.getMonth()]} ${liveNow.getFullYear()}`;
  const actualDateNum = liveNow.getDate();
  const actualMonthName = monthNames[liveNow.getMonth()];
  const actualYear = liveNow.getFullYear();
  const digitalClock = `${String(liveNow.getHours()).padStart(2, '0')}:${String(
    liveNow.getMinutes()
  ).padStart(2, '0')}:${String(liveNow.getSeconds()).padStart(2, '0')}`;

  // Handler klik tab "Hari Ini", "Minggu Ini", "Semua Tim"
  const handleSelectPeriodTab = (period: 'Today' | 'Week' | 'AllTeam') => {
    setSelectedPeriod(period);
    const todayStr = getTodayYmd();

    if (period === 'Today') {
      // KETIKA USER KLIK TOMBOL HARI INI MAKA SELECTION PILL AUTO KE TANGGAL AKTUAL
      onSelectDate(todayStr);
      setCalendarFocus({ mode: 'today', ts: Date.now() });
    } else if (period === 'Week') {
      // KETIKA USER KLIK MINGGU INI PILL AUTO FOCUS KE MINGGUAN AKTUAL
      setCalendarFocus({ mode: 'week', ts: Date.now() });
    }
  };

  // Filter agenda berdasarkan tab aktif:
  // - 'Today': Jadwal milik user pada tanggal terpilih
  // - 'Week': Jadwal milik user pada minggu aktual
  // - 'AllTeam': Jadwal Semua Tim pada tanggal terpilih
  const displayedAgendas = agendas.filter((item) => {
    const isMyAgenda =
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
    // 'AllTeam' -> Menampilkan jadwal seluruh tim pada tanggal yang dipilih
    return item.date === selectedDate;
  });

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

    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('touchmove', onScroll, { passive: true });
    window.addEventListener('wheel', onScroll, { passive: true });

    onScroll();

    return () => {
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
      className="flex flex-col h-full bg-[#F8F9FD] overflow-y-auto no-scrollbar px-5 sm:px-6 pt-[max(1.5rem,env(safe-area-inset-top,24px))] pb-28 max-w-xl mx-auto w-full relative select-none"
    >
      {/* Section 1 Item 1: Top Header with Left Live Maps Icon, Center "Hallo, User!" & Right Notification Bell */}
      <div className="relative pt-8 pb-1 mb-4">
        {/* ICON MAPS DI POJOK KIRI ATAS HALAMAN SCHEDULE USER */}
        <button
          type="button"
          onClick={onOpenLiveMaps}
          className="absolute -left-1 top-0 w-10 h-10 rounded-full iphone-glass-icon-btn flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all flex-shrink-0 cursor-pointer group"
          title="Buka Live Maps Pinpoint & Rute Toko"
        >
          <MapPin className="w-5 h-5 stroke-[2.2] text-teal-700 group-hover:scale-110 transition-transform" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#2BB3A0] absolute top-2 right-2 border-2 border-white ring-2 ring-[#EAF8F2]" />
        </button>

        <div className="text-center px-8 pt-1">
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 leading-snug tracking-tight">
            Hallo, {fullName}!
          </h1>
          <p className="text-[11px] font-light text-slate-500 tracking-wide mt-1 tabular-nums">
            Today {actualDateNum} {actualMonthName} {actualYear} • {digitalClock}
          </p>
        </div>

        <button
          type="button"
          onClick={() => alert(`Notifikasi: Ada ${displayedAgendas.length} agenda terjadwal untuk tanggal ${selectedDate}.`)}
          className="absolute -right-1 top-0 w-10 h-10 rounded-full iphone-glass-icon-btn flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all flex-shrink-0 cursor-pointer group"
          title="Notifikasi Agenda"
        >
          <Bell className="w-5 h-5 stroke-[2.2] text-black group-hover:scale-110 transition-transform" />
          <span className="w-2.5 h-2.5 rounded-full bg-black absolute top-2.5 right-2.5 border-2 border-white ring-2 ring-[#EAF8F2]" />
        </button>
      </div>

      {/* Section 1 Item 2: Instagram-Style Circle Story Bar Below "Hallo, User!" */}
      <EmployeeStoriesBar currentUser={user} agendas={agendas} />

      {/* Section 1 Item 6: Sticky on top Calendar Strip & Sub section Filter */}
      <div className="sticky top-0 z-20 bg-[#F8F9FD]/95 backdrop-blur-md pt-[max(0.5rem,env(safe-area-inset-top,16px))] pb-3 mb-3 -mx-5 px-5 sm:-mx-6 sm:px-6 transition-all">
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
        </div>
      </div>

      {/* Section 1 Item 3 & 5: List Schedule Agenda */}
      <div className="space-y-3 pt-2">
        {displayedAgendas.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-card">
            <p className="text-slate-500 text-xs font-semibold">
              {selectedPeriod === 'AllTeam'
                ? `Belum ada schedule agenda tim pada tanggal ini (${selectedDate}).`
                : selectedPeriod === 'Week'
                ? `Tidak ada agenda yang ditugaskan kepada Anda pada minggu ini.`
                : `Tidak ada agenda yang ditugaskan kepada Anda pada tanggal ini (${selectedDate}).`}
            </p>
            {selectedPeriod !== 'AllTeam' && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('AllTeam')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 text-xs font-bold border border-teal-200/60 hover:bg-teal-100 transition-colors cursor-pointer"
                >
                  <span>
                    Lihat Semua Tim ({agendas.filter((a) => a.date === selectedDate).length})
                  </span>
                </button>
              </div>
            )}
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
      <DeveloperFooter />

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
