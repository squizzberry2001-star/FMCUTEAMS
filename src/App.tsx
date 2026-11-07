import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { ScheduleAgenda, User } from './types';
import { initialAgendas } from './data/mockData';
import { HomeScreen } from './components/HomeScreen';
import { CalendarScheduleView } from './components/CalendarScheduleView';
import { HistoryView } from './components/HistoryView';
import { ProfileView } from './components/ProfileView';
import { DesktopDashboard } from './components/DesktopDashboard';
import { NewAgendaModal } from './components/NewAgendaModal';
import { AgendaDetailView } from './components/AgendaDetailView';
import { LoginPage } from './components/LoginPage';
import { Smartphone, Monitor } from 'lucide-react';

export const App: React.FC = () => {
  // 1. Data State for Agendas (Hapus seluruh dummy data lawas di browser)
  const [agendas, setAgendas] = useState<ScheduleAgenda[]>(() => {
    localStorage.removeItem('fmcu_agendas_schedule');
    const saved = localStorage.getItem('fmcu_agendas_schedule_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return initialAgendas; // Array kosong []
  });

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [selectedAgenda, setSelectedAgenda] = useState<ScheduleAgenda | null>(null);

  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('fmcu_user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        console.error(e);
      }
    }
    return {
      name: 'Sarah Jenkins',
      email: 'sarah.j@fmcuteams.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    };
  });

  // Mobile navigation active tab
  const [mobileTab, setMobileTab] = useState<'home' | 'calendar' | 'history' | 'profile'>('home');

  // Mobile sub-screen: 'main' (normal tabs) or 'detail' (agenda detail page)
  const [mobileScreen, setMobileScreen] = useState<'main' | 'detail'>('main');

  // Modal State for New Agenda
  const [showNewAgendaModal, setShowNewAgendaModal] = useState(false);

  // Forced layout override (auto / desktop / mobile) for testing on PC
  const [layoutMode, setLayoutMode] = useState<'auto' | 'desktop' | 'mobile'>('auto');
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('fmcu_agendas_schedule_v2', JSON.stringify(agendas));
  }, [agendas]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('fmcu_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('fmcu_user');
    }
  }, [user]);

  // Handlers
  const handleSelectAgenda = (agenda: ScheduleAgenda) => {
    setSelectedAgenda(agenda);
    setMobileScreen('detail'); // Navigasi ke Halaman Detail Agenda
  };

  const handleAddNewAgenda = (newAgenda: ScheduleAgenda) => {
    const updated = [newAgenda, ...agendas];
    setAgendas(updated);
    setSelectedAgenda(newAgenda);
    setShowNewAgendaModal(false);

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#2BB3A0', '#FF6B8B', '#FFB085', '#5C86FA'],
    });
  };

  const handleLogout = () => {
    setUser(null);
  };

  // Determine effective display layout: mobile or desktop
  const isMobileLayout =
    layoutMode === 'mobile' || (layoutMode === 'auto' && isMobileViewport);

  // If user is not authenticated, show real Login page
  if (!user) {
    return (
      <LoginPage
        onLogin={(loggedInUser) => {
          setUser(loggedInUser);
          setMobileTab('home'); // Otomatis langsung masuk di section 1 (Weekly Schedule)
          setMobileScreen('main');
        }}
        onContinueAsGuest={() => {
          setUser({
            name: 'Sarah Jenkins',
            email: 'sarah.j@fmcuteams.com',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          });
          setMobileTab('home'); // Otomatis langsung masuk di section 1 (Weekly Schedule)
          setMobileScreen('main');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F8F9FD] flex flex-col relative select-none">
      {/* Real Web Header / Control Banner for Desktop Viewers */}
      <div className="hidden lg:flex items-center justify-between px-6 py-2 bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-800">FMCU TEAMS Live Web Application</span>
          <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
            Real Web Mode
          </span>
        </div>

        {/* Layout Switcher (Allows testing true mobile layout right inside the desktop browser!) */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setLayoutMode('auto')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              layoutMode === 'auto'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Auto Responsive
          </button>
          <button
            onClick={() => setLayoutMode('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              layoutMode === 'desktop'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Monitor className="w-3.5 h-3.5 text-teal-600" />
            <span>Desktop Dashboard</span>
          </button>
          <button
            onClick={() => setLayoutMode('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              layoutMode === 'mobile'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-blue-600" />
            <span>Mobile App View</span>
          </button>
        </div>
      </div>

      {/* Main Content: Responsive Desktop or Native Mobile */}
      {isMobileLayout ? (
        /* Mobile Full-Screen Web App (No simulated hardware frame!) */
        <div className="flex-1 w-full max-w-md mx-auto min-h-screen bg-[#F8F9FD] flex flex-col relative">
          {mobileScreen === 'detail' && selectedAgenda ? (
            /* Halaman Detail Agenda ketika user klik list agenda (tanpa tombol checklist selesai) */
            <AgendaDetailView
              agenda={selectedAgenda}
              onBack={() => setMobileScreen('main')}
            />
          ) : (
            <>
              {/* Section 1: Your Weekly Schedule (Satu-satunya section dengan Navbar) */}
              {mobileTab === 'home' && (
                <HomeScreen
                  user={user}
                  agendas={agendas}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onSelectAgenda={handleSelectAgenda}
                  onOpenCalendar={() => setMobileTab('calendar')}
                  onOpenHistory={() => setMobileTab('history')}
                  onOpenProfile={() => setMobileTab('profile')}
                  activeNavTab={mobileTab}
                  setActiveNavTab={(tab) => setMobileTab(tab as any)}
                />
              )}

              {/* Section 2: Jadwal Agenda Kerja (Full halaman tanpa navbar) */}
              {mobileTab === 'calendar' && (
                <CalendarScheduleView
                  agendas={agendas}
                  onBack={() => setMobileTab('home')}
                  onSelectAgenda={handleSelectAgenda}
                />
              )}

              {/* Section 3: Coverage Store & History Aktivitas (Full halaman tanpa navbar) */}
              {mobileTab === 'history' && (
                <HistoryView
                  onBack={() => setMobileTab('home')}
                />
              )}

              {/* Section 4: Akun & Profil (Full halaman tanpa navbar) */}
              {mobileTab === 'profile' && (
                <ProfileView
                  user={user}
                  medicinesCount={agendas.length}
                  onBack={() => setMobileTab('home')}
                  onLogout={handleLogout}
                />
              )}
            </>
          )}
        </div>
      ) : (
        /* Full Desktop Web Dashboard */
        <DesktopDashboard
          user={user}
          agendas={agendas}
          selectedAgenda={selectedAgenda}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onSelectAgenda={handleSelectAgenda}
          onOpenNewAgenda={() => setShowNewAgendaModal(true)}
          onLogout={handleLogout}
        />
      )}

      {/* New Agenda Creation Modal (Desktop & Mobile) */}
      {showNewAgendaModal && (
        <NewAgendaModal
          initialDate={selectedDate}
          onClose={() => setShowNewAgendaModal(false)}
          onAddAgenda={handleAddNewAgenda}
        />
      )}
    </div>
  );
};

export default App;
