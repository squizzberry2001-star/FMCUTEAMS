import React, { useState, useRef, useEffect } from 'react';
import { Bell, Plus, CalendarDays, Sparkles } from 'lucide-react';
import { ScheduleAgenda, User } from '../types';
import { CalendarStrip } from './CalendarStrip';
import { ScheduleCard } from './ScheduleCard';
import { BottomNavbar, NavTabType } from './BottomNavbar';

interface HomeScreenProps {
  user?: User | null;
  agendas: ScheduleAgenda[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onSelectAgenda?: (agenda: ScheduleAgenda) => void;
  onOpenNewAgenda?: () => void;
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

  // Bulan dan tahun aktual untuk pojok kanan atas kalender strip
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const now = new Date();
  const currentMonthYear = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

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
      return true; // Tampilkan agenda minggu ini
    }
    return true; // Bulan ini
  });

  // Scroll detection & auto navbar scale with upscale lock on icon press
  const upscaleLockedRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  const getScrollTop = () => {
    const cTop = scrollContainerRef.current ? scrollContainerRef.current.scrollTop : 0;
    const wTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    return Math.max(cTop, wTop);
  };

  const handleResetScale = () => {
    setIsScrolled(false);
    upscaleLockedRef.current = true;
    lastScrollTopRef.current = getScrollTop();
  };

  const checkScroll = () => {
    const top = getScrollTop();

    if (upscaleLockedRef.current) {
      if (Math.abs(top - lastScrollTopRef.current) > 12) {
        upscaleLockedRef.current = false;
      } else {
        return;
      }
    }

    setIsScrolled(top > 15);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    window.addEventListener('scroll', checkScroll, { passive: true });
    document.addEventListener('scroll', checkScroll, { passive: true });
    if (container) {
      container.addEventListener('scroll', checkScroll, { passive: true });
    }
    return () => {
      window.removeEventListener('scroll', checkScroll);
      document.removeEventListener('scroll', checkScroll);
      if (container) {
        container.removeEventListener('scroll', checkScroll);
      }
    };
  }, []);

  return (
    <div
      ref={scrollContainerRef}
      onScroll={checkScroll}
      className="flex flex-col h-full bg-[#F8F9FD] overflow-y-auto no-scrollbar px-5 sm:px-6 pt-0 pb-28 max-w-xl mx-auto w-full relative select-none"
    >
      {/* ============================================================
          STICKY FROSTED HEADER (Title, Greeting, Bell & Calendar Strip)
          - Protected with safe-area-inset-top so it never collides with status bar / notch
          - Stays sticky at top when scrolling ("tetap terlihat walaupun di scroll")
          - Compacts gracefully on scroll for maximum agenda viewport
          ============================================================ */}
      <div className="sticky top-0 z-30 bg-[#F8F9FD]/95 backdrop-blur-xl -mx-5 px-5 sm:-mx-6 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top,20px))] pb-2.5 mb-3 border-b border-slate-200/50 shadow-xs transition-all duration-300">
        {/* Head Title "Your Weekly Schedule" & Time-based Greeting & Notification Bell */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className={`font-black text-slate-900 tracking-tight transition-all duration-300 ${
              isScrolled ? 'text-lg leading-tight' : 'text-2xl sm:text-[26px] leading-[1.15]'
            }`}>
              Your Weekly Schedule
            </h1>
            {!isScrolled && (
              <p className="text-xs text-slate-500 font-semibold mt-0.5 animate-in fade-in duration-200">
                Selamat {getTimeGreeting()}, {fullName}! 👋
              </p>
            )}
          </div>

          <button
            onClick={() => alert(`Notifikasi: Ada ${displayedAgendas.length} agenda terjadwal untuk tanggal ${selectedDate}.`)}
            className="w-9 h-9 rounded-full iphone-glass-icon-btn flex items-center justify-center text-[#2BB3A0] hover:scale-105 active:scale-95 transition-all relative flex-shrink-0 cursor-pointer group"
            title="Notifikasi Agenda"
          >
            <Bell className="w-4 h-4 stroke-[2.2] group-hover:scale-110 transition-transform" />
            <span className="w-2 h-2 rounded-full bg-[#2BB3A0] absolute top-1.5 right-1.5 border-2 border-white ring-1 ring-teal-200" />
          </button>
        </div>

        {/* Section 1 Item 3: Bulan dan Tahun Aktual di pojok kanan atas tepat di atas calendar strip */}
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[11px] font-extrabold text-slate-400 tracking-wider uppercase">
            Kalender Mingguan
          </span>
          <span className="text-[11px] font-bold text-teal-800 bg-white/90 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-teal-200/80 shadow-xs flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-teal-600" />
            <span>{currentMonthYear}</span>
          </span>
        </div>

        {/* Section 1 Item 2: Horizontal Calendar Strip (Senin s/d Minggu Actual Dates) */}
        <div className="mb-2">
          <CalendarStrip selectedDate={selectedDate} onSelectDate={onSelectDate} />
        </div>

        {/* Sub section: Period Filter Tabs (Today / Week / Month) & Scope Switcher */}
        <div className="flex flex-col gap-1.5 px-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              {(['Today', 'Week', 'Month'] as const).map((period) => {
                const isActive = selectedPeriod === period;
                return (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period)}
                    className="relative pb-1 transition-colors"
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

            {/* Scope Switcher: Jadwal Saya vs Semua Tim */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setScopeFilter('my')}
                className={`px-2 py-0.5 rounded-md transition-all ${
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
                className={`px-2 py-0.5 rounded-md transition-all ${
                  scopeFilter === 'all'
                    ? 'bg-white text-teal-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Semua Tim
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span className="truncate pr-2">
              {scopeFilter === 'my' ? `Jadwal untuk: ${fullName}` : 'Menampilkan jadwal seluruh tim'}
            </span>
            <span className="font-bold text-slate-500 flex-shrink-0">
              {displayedAgendas.length} agenda
            </span>
          </div>
        </div>
      </div>

        {/* Section 1 Item 3 & 5: List Schedule Agenda (dengan font title yang lebih kecil) */}
        <div className="space-y-3">
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

      {/* Navbar: Hapus tombol +, auto mengecil scale 0.91 saat scroll, auto reset saat section ditekan */}
      <BottomNavbar
        activeTab={activeNavTab as NavTabType}
        onSelectTab={(tab) => {
          handleResetScale();
          if (tab === activeNavTab) {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
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
