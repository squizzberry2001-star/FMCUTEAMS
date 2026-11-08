import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Plus,
  CalendarDays,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet
} from 'lucide-react';
import { ScheduleAgenda, User } from '../types';
import { CalendarStrip } from './CalendarStrip';
import { ScheduleCard } from './ScheduleCard';
import { BottomNavbar, NavTabType } from './BottomNavbar';
import { EmployeeStoriesBar } from './EmployeeStoriesBar';
import { DeveloperFooter } from './DeveloperFooter';
import {
  getMondayOfWeek,
  getFullWeekDays,
  formatWeekRangeDisplay,
} from '../services/scheduleExcelService';

interface HomeScreenProps {
  user?: User | null;
  agendas: ScheduleAgenda[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onSelectAgenda?: (agenda: ScheduleAgenda) => void;
  onOpenNewAgenda?: () => void;
  onOpenExcelUpload?: () => void;
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
  onOpenNewAgenda,
  onOpenExcelUpload,
  onToggleComplete,
  onOpenProfile,
  onOpenCalendar,
  onOpenHistory,
  activeNavTab = 'home',
  setActiveNavTab,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'Today' | 'Week' | 'Month'>('Today');
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reference Monday for active week view (Default: Monday of running week)
  const [currentWeekMonday, setCurrentWeekMonday] = useState<string>(() => getMondayOfWeek());

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

  const handleResetToCurrentWeek = () => {
    const runningMon = getMondayOfWeek();
    setCurrentWeekMonday(runningMon);
    const todayStr = new Date().toISOString().split('T')[0];
    onSelectDate(todayStr);
  };

  const activeWeekDays = getFullWeekDays(currentWeekMonday);
  const weekStartStr = activeWeekDays[0]?.dateStr || currentWeekMonday;
  const weekEndStr = activeWeekDays[activeWeekDays.length - 1]?.dateStr || currentWeekMonday;
  const isCurrentRunningWeek = currentWeekMonday === getMondayOfWeek();

  // Salam waktu berdasarkan actual jam (Pagi, Siang, Sore, Malam)
  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 11) return 'Pagi';
    if (hour >= 11 && hour < 15) return 'Siang';
    if (hour >= 15 && hour < 18) return 'Sore';
    return 'Malam';
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

  // Filter lingkup: 'my' (Jadwal Saya) atau 'all' (Semua Tim)
  const [scopeFilter, setScopeFilter] = useState<'my' | 'all'>(user?.isAdmin ? 'all' : 'my');

  // Filter agenda berdasarkan tanggal / tab periode dan pemilik agenda
  const filteredByScope = agendas.filter((item) => {
    if (scopeFilter === 'all') return true;
    if (!item.pic) return true;
    return (
      item.pic.toLowerCase().includes(fullName.toLowerCase()) ||
      fullName.toLowerCase().includes(item.pic.toLowerCase())
    );
  });

  const displayedAgendas = filteredByScope.filter((item) => {
    if (selectedPeriod === 'Today') {
      return item.date === selectedDate;
    }
    if (selectedPeriod === 'Week') {
      // Auto Default hanya fokus pada minggu yang berjalan (atau minggu yang sedang dipilih navigasi)
      return item.date >= weekStartStr && item.date <= weekEndStr;
    }
    return true; // Bulan ini
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
            // If user clicked icon while shrunken, stay expanded until scrolling DOWN again
            if (top > manualExpandedScrollTopRef.current + 8 || delta > 4) {
              manualExpandedRef.current = false;
              setIsScrolled(true);
            }
          } else if (delta < -4) {
            // Scroll ke ATAS: navbar membesar kembali (scale 1)
            setIsScrolled(false);
          } else if (delta > 4 && top > 20) {
            // Scroll ke BAWAH: navbar mengecil
            setIsScrolled(true);
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    // Capture phase catches scroll events from any child or container in the document
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
      {/* Section 1 Item 1: Center Top Header "Hallo, User!" (Bold) & Thin Small "Today {Tanggal} {Bulan} {Jam Digital}" */}
      <div className="relative flex items-center justify-center mb-3.5 min-h-[48px]">
        <div className="text-center px-11">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight tracking-tight">
            Hallo, {fullName}!
          </h1>
          <p className="text-[11px] font-light text-slate-500 tracking-wide mt-0.5 tabular-nums">
            Today {actualDateNum} {actualMonthName} {actualYear} • {digitalClock}
          </p>
        </div>

        <button
          onClick={() => alert(`Notifikasi: Ada ${displayedAgendas.length} agenda terjadwal untuk tanggal ${selectedDate}.`)}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full iphone-glass-icon-btn flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all flex-shrink-0 cursor-pointer group"
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
        {/* Section 1 Item 3: Bulan dan Tahun Aktual di pojok kanan atas tepat di atas calendar strip & Navigasi Minggu */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-extrabold text-slate-400 tracking-wider uppercase">
              Kalender Mingguan
            </span>
            {/* Week Navigator Pill */}
            <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-xl text-[10px]">
              <button
                type="button"
                onClick={handlePrevWeek}
                className="w-5 h-5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center transition cursor-pointer"
                title="Minggu Sebelumnya"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="font-extrabold text-slate-800 px-1 text-[10px]">
                {formatWeekRangeDisplay(currentWeekMonday)}
              </span>
              <button
                type="button"
                onClick={handleNextWeek}
                className="w-5 h-5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center transition cursor-pointer"
                title="Minggu Berikutnya"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!isCurrentRunningWeek && (
              <button
                type="button"
                onClick={handleResetToCurrentWeek}
                className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200 hover:bg-teal-100 transition cursor-pointer"
              >
                Reset Minggu Ini
              </button>
            )}
            <span className="text-[10px] sm:text-[11px] font-bold text-teal-800 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full border border-teal-200/80 shadow-xs flex items-center gap-1">
              <CalendarDays className="w-3 h-3 text-teal-600" />
              <span>{currentMonthYear}</span>
            </span>
          </div>
        </div>

        {/* Section 1 Item 2: Horizontal Calendar Strip */}
        <CalendarStrip selectedDate={selectedDate} onSelectDate={onSelectDate} baseDate={currentWeekMonday} />

        {/* Section 1 Item 4: Sub section tab filter & Counter */}
        <div className="mt-3.5 pt-3 border-t border-slate-200/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 sm:gap-5">
              {(['Today', 'Week', 'Month'] as const).map((period) => {
                const isActive = selectedPeriod === period;
                return (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period)}
                    className="relative pb-1 transition-colors cursor-pointer"
                  >
                    <span
                      className={`text-xs sm:text-sm font-bold transition-colors ${
                        isActive ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {period === 'Today' ? 'Hari Ini' : period === 'Week' ? 'Minggu Ini' : 'Bulan Ini'}
                    </span>
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4E80EE] rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Scope Switcher: Jadwal Saya vs Semua Tim & Tombol Upload Excel */}
            <div className="flex items-center gap-1.5">
              {onOpenExcelUpload && (
                <button
                  type="button"
                  onClick={onOpenExcelUpload}
                  className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[10px] font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                  title="Upload Schedule by Excel"
                >
                  <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                  <span className="hidden xs:inline">Upload Excel</span>
                </button>
              )}

              <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setScopeFilter('my')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    scopeFilter === 'my'
                      ? 'bg-white text-teal-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Jadwal Saya
                </button>
                <button
                  type="button"
                  onClick={() => setScopeFilter('all')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    scopeFilter === 'all'
                      ? 'bg-white text-teal-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Semua Tim
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span className="truncate pr-2">
              {scopeFilter === 'my'
                ? `Jadwal untuk: ${fullName}`
                : `Menampilkan jadwal seluruh tim (${formatWeekRangeDisplay(currentWeekMonday)})`}
            </span>
            <span className="font-bold text-slate-500 flex-shrink-0">
              {displayedAgendas.length} agenda
            </span>
          </div>
        </div>
      </div>

      {/* Section 1 Item 3 & 5: List Schedule Agenda (dengan font title yang lebih kecil) */}
      <div className="space-y-3 pt-2">
          {displayedAgendas.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-card">
              <p className="text-slate-500 text-xs font-semibold">
                {scopeFilter === 'my'
                  ? `Tidak ada agenda yang ditugaskan kepada Anda pada tanggal ini (${selectedDate}).`
                  : `Belum ada schedule agenda pada tanggal ini (${selectedDate}).`}
              </p>
              {scopeFilter === 'my' && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setScopeFilter('all')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 text-xs font-bold border border-teal-200/60 hover:bg-teal-100 transition-colors"
                  >
                    <span>Tampilkan Semua Agenda Tim ({agendas.filter(a => a.date === selectedDate).length})</span>
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

      {/* Navbar: Hapus tombol +, auto mengecil scale 0.91 saat scroll, auto reset saat section ditekan */}
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
