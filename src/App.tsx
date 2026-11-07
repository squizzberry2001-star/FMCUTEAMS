import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import confetti from 'canvas-confetti';
import { ScheduleAgenda, User } from './types';
import { initialAgendas, initialUsers } from './data/mockData';
import { HomeScreen } from './components/HomeScreen';
import { CalendarScheduleView } from './components/CalendarScheduleView';
import { HistoryView } from './components/HistoryView';
import { ProfileView } from './components/ProfileView';
import { NewAgendaModal } from './components/NewAgendaModal';
import { AgendaDetailView } from './components/AgendaDetailView';
import { LoginPage } from './components/LoginPage';
import { SplashScreen } from './components/SplashScreen';
import { PageTransitionLoader } from './components/PageTransitionLoader';
import { Smartphone, Monitor, Shield, ArrowLeft, MapPin, Navigation, WifiOff, RotateCw } from 'lucide-react';

// Code-split heavy components to make initial splash & login load instantly on mobile
const AdminPortal = lazy(() =>
  import('./components/admin/AdminPortal').then((m) => ({ default: m.AdminPortal }))
);
const DesktopDashboard = lazy(() =>
  import('./components/DesktopDashboard').then((m) => ({ default: m.DesktopDashboard }))
);
const VisitReportForm = lazy(() =>
  import('./components/visit/VisitReportForm').then((m) => ({ default: m.VisitReportForm }))
);

export const App: React.FC = () => {
  // 1. Master State for Users (Admin + 36 User dari Excel dengan password 0000)
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('fmcu_users_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return initialUsers;
  });

  // 2. Master State for Agendas (582 Jadwal dari 3 Sheet Excel)
  const [agendas, setAgendas] = useState<ScheduleAgenda[]>(() => {
    const saved = localStorage.getItem('fmcu_agendas_master_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return initialAgendas;
  });

  // 3. User Session State
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('fmcu_user_session_v3');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        console.error(e);
      }
    }
    return null; // Tampilkan halaman Login terlebih dahulu
  });

  // Admin Preview Mode: Ketika admin ingin melihat pratinjau tampilan sisi user
  const [adminPreviewMode, setAdminPreviewMode] = useState(false);

  // Splash Screen Lifecycle:
  // Muncul saat aplikasi baru pertama kali dibuka / cold start (dimatikan lalu dibuka kembali), baik sebelum maupun sesudah login.
  // Tidak muncul jika aplikasi sedang berjalan di latar belakang (sessionStorage aktif).
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    return !sessionStorage.getItem('fmcu_session_splash_shown');
  });

  // Mandatory GPS Gate State on initial web load / splash completion
  const [gpsVerified, setGpsVerified] = useState<boolean>(() => {
    return (
      sessionStorage.getItem('fmcu_gps_verified') === 'true' ||
      sessionStorage.getItem('fmcu_gps_offline_mode') === 'true'
    );
  });
  const [isCheckingGps, setIsCheckingGps] = useState<boolean>(false);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);

  const requestMandatoryGps = () => {
    setIsCheckingGps(true);
    setGpsErrorMsg(null);
    if (!('geolocation' in navigator)) {
      setIsCheckingGps(false);
      setGpsErrorMsg('Perangkat/Browser tidak mendukung sensor GPS. Gunakan Mode Manual Offline.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);
        const now = new Date();
        const wibTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
        try {
          localStorage.setItem('fmcu_live_gps', `${lat}, ${lng} (Akurat)`);
          localStorage.setItem('fmcu_initial_checkin_time', wibTime);
          sessionStorage.setItem('fmcu_gps_verified', 'true');
          sessionStorage.removeItem('fmcu_gps_offline_mode');
        } catch (e) {
          console.warn(e);
        }
        setGpsVerified(true);
        setIsCheckingGps(false);
      },
      (err) => {
        setIsCheckingGps(false);
        if (!navigator.onLine) {
          setGpsErrorMsg('Terdeteksi OFFLINE / Tanpa Jaringan. Silakan aktifkan GPS atau masuk ke Mode Manual IN/OUT.');
        } else if (err.code === 1) {
          setGpsErrorMsg('Izin Lokasi GPS ditolak. Harap izinkan akses lokasi (Allow Location) pada browser/HP Anda.');
        } else {
          setGpsErrorMsg('Sinyal GPS lemah atau belum dinyalakan di pengaturan perangkat Anda.');
        }
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
    );
  };

  const handleEnableOfflineManualGps = () => {
    try {
      sessionStorage.setItem('fmcu_gps_offline_mode', 'true');
      localStorage.setItem('fmcu_live_gps', 'Mode Manual / Offline');
    } catch (e) {
      console.warn(e);
    }
    setGpsVerified(true);
  };

  useEffect(() => {
    if (!gpsVerified) {
      requestMandatoryGps();
    }
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
    sessionStorage.setItem('fmcu_session_splash_shown', 'true');
    if (
      sessionStorage.getItem('fmcu_gps_verified') === 'true' ||
      sessionStorage.getItem('fmcu_gps_offline_mode') === 'true'
    ) {
      setGpsVerified(true);
    } else {
      requestMandatoryGps();
    }
  };

  // Synchronize mobile status bar & theme-color seamless canvas (#F8F9FD) when splash is off
  useEffect(() => {
    if (!showSplash) {
      const themeColor = '#F8F9FD';
      const mTheme = document.querySelector('meta[name="theme-color"]');
      if (mTheme) mTheme.setAttribute('content', themeColor);
      const mApple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      if (mApple) mApple.setAttribute('content', 'default');
      const mScheme = document.querySelector('meta[name="color-scheme"]');
      if (mScheme) mScheme.setAttribute('content', 'light');

      document.documentElement.style.setProperty('background-color', themeColor, 'important');
      document.documentElement.style.setProperty('color-scheme', 'light');
      document.body.style.setProperty('background-color', themeColor, 'important');
      document.body.style.setProperty('color-scheme', 'light');
    }
  }, [showSplash]);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [selectedAgenda, setSelectedAgenda] = useState<ScheduleAgenda | null>(null);

  // Mobile navigation active tab
  const [mobileTab, setMobileTab] = useState<'home' | 'calendar' | 'history' | 'profile'>('home');

  // Screen routing: 'main' (normal tabs), 'detail' (agenda detail), 'visit-form' (UI/UX Form Visit)
  const [mobileScreen, setMobileScreen] = useState<'main' | 'detail' | 'visit-form'>('main');

  // Modal State for New Agenda
  const [showNewAgendaModal, setShowNewAgendaModal] = useState(false);

  // Forced layout override (auto / desktop / mobile) for testing on PC
  const [layoutMode, setLayoutMode] = useState<'auto' | 'desktop' | 'mobile'>('auto');

  // Only show Transition Loader when a concurrent render or Suspense load actually takes >200ms
  const [isPageTransitioning] = React.useTransition();
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

  // Eagerly preload heavy bundles in background during splash so there is ZERO suspense lag when dissolving
  useEffect(() => {
    import('./components/admin/AdminPortal');
    import('./components/DesktopDashboard');
    import('./components/visit/VisitReportForm');
  }, []);

  // Save master users to localStorage
  useEffect(() => {
    localStorage.setItem('fmcu_users_v2', JSON.stringify(users));
  }, [users]);

  // Save master agendas to localStorage
  useEffect(() => {
    localStorage.setItem('fmcu_agendas_master_v3', JSON.stringify(agendas));
  }, [agendas]);

  // Save logged-in session
  useEffect(() => {
    if (user) {
      localStorage.setItem('fmcu_user_session_v3', JSON.stringify(user));
    } else {
      localStorage.removeItem('fmcu_user_session_v3');
    }
  }, [user]);

  // Handlers for User & Profile Management
  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setAdminPreviewMode(false);
    setMobileTab('home');
    setMobileScreen('main');

    confetti({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.5 },
      colors: ['#2BB3A0', '#4E80EE', '#F59E0B'],
    });
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedAgenda(null);
    setAdminPreviewMode(false);
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
    setUsers((prev) =>
      prev.map((u) => (u.name.toLowerCase() === updatedUser.name.toLowerCase() ? updatedUser : u))
    );
  };

  // Handlers for Agenda Management
  const handleSelectAgenda = (agenda: ScheduleAgenda) => {
    setSelectedAgenda(agenda);
    setMobileScreen('detail');
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

  const handleUpdateAgenda = (updated: ScheduleAgenda) => {
    setAgendas((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    if (selectedAgenda && selectedAgenda.id === updated.id) {
      setSelectedAgenda(updated);
    }
  };

  const handleDeleteAgenda = (id: string) => {
    setAgendas((prev) => prev.filter((a) => a.id !== id));
    if (selectedAgenda && selectedAgenda.id === id) {
      setSelectedAgenda(null);
    }
  };

  // Handlers for Admin Excel Import & Sync
  const handleImportExcel = (importedUsers: User[], importedAgendas: ScheduleAgenda[]) => {
    // Merge users
    const existingMap = new Map(users.map((u) => [u.name.toLowerCase(), u]));
    importedUsers.forEach((u) => {
      if (!existingMap.has(u.name.toLowerCase())) {
        existingMap.set(u.name.toLowerCase(), u);
      }
    });

    setUsers(Array.from(existingMap.values()));
    setAgendas(importedAgendas);
  };

  const handleAddUser = (newUser: User) => {
    setUsers((prev) => [newUser, ...prev]);
  };

  const handleResetUserPassword = (userName: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.name.toLowerCase() === userName.toLowerCase() ? { ...u, password: '0000' } : u))
    );
  };

  // Determine effective display layout: mobile or desktop
  const isMobileLayout =
    layoutMode === 'mobile' || (layoutMode === 'auto' && isMobileViewport);

  // Mandatory GPS Activation Gate Modal (shown on initial web load / splash completion if GPS is not yet enabled)
  const gpsMandatoryModal = !showSplash && !gpsVerified && (
    <div className="fixed inset-0 z-[9000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg relative">
          <Navigation className="w-8 h-8 animate-bounce" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white animate-ping" />
        </div>

        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200">
            <MapPin className="w-3 h-3" />
            Sistem Wajib GPS Aktif
          </span>
          <h3 className="text-lg font-black text-slate-900">
            Aktifkan Lokasi GPS Anda
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Untuk merekam waktu & presensi <strong className="text-slate-800">Actual IN</strong> dan <strong className="text-slate-800">Actual OUT</strong> kunjungan toko secara valid, Anda wajib menyalakan layanan lokasi GPS perangkat.
          </p>
        </div>

        {gpsErrorMsg && (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold text-left flex items-start gap-2">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{gpsErrorMsg}</span>
          </div>
        )}

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={requestMandatoryGps}
            disabled={isCheckingGps}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-black text-xs shadow-md transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCw className={`w-4 h-4 ${isCheckingGps ? 'animate-spin' : ''}`} />
            <span>{isCheckingGps ? 'Mendeteksi Titik GPS...' : 'Nyalakan & Izinkan GPS Sekarang'}</span>
          </button>

          <button
            type="button"
            onClick={handleEnableOfflineManualGps}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <WifiOff className="w-3.5 h-3.5 text-slate-500" />
            <span>Susah Sinyal / Offline? Masuk Mode Manual IN/OUT</span>
          </button>
        </div>
      </div>
    </div>
  );

  // 1. If not authenticated, render Login Page
  if (!user) {
    return (
      <>
        {showSplash && (
          <SplashScreen
            onComplete={handleSplashComplete}
            user={null}
            targetThemeColor="#F8F9FD"
          />
        )}
        {gpsMandatoryModal}
        <LoginPage
          users={users}
          onLogin={handleLogin}
          onReplaySplash={() => setShowSplash(true)}
        />
      </>
    );
  }

  // 2. If logged in as ADMIN and not in preview mode, render dedicated Admin Portal
  if (user.isAdmin && !adminPreviewMode) {
    return (
      <>
        {showSplash && (
          <SplashScreen
            onComplete={handleSplashComplete}
            user={user}
            targetThemeColor="#FFFFFF"
          />
        )}
        <PageTransitionLoader visible={isPageTransitioning} />
        <Suspense fallback={<PageTransitionLoader visible={true} />}>
          <AdminPortal
            adminUser={user}
            agendas={agendas}
            users={users}
            onAddAgenda={handleAddNewAgenda}
            onUpdateAgenda={handleUpdateAgenda}
            onDeleteAgenda={handleDeleteAgenda}
            onImportExcel={handleImportExcel}
            onSwitchToUserView={() => setAdminPreviewMode(true)}
            onLogout={handleLogout}
            onAddUser={handleAddUser}
            onResetUserPassword={handleResetUserPassword}
            onReplaySplash={() => setShowSplash(true)}
          />
        </Suspense>
      </>
    );
  }

  // 3. User View (Field Staff View or Admin in Preview Mode)
  return (
    <>
      {showSplash && (
        <SplashScreen
          onComplete={handleSplashComplete}
          user={user}
          targetThemeColor="#F8F9FD"
        />
      )}
      {gpsMandatoryModal}
      <PageTransitionLoader visible={isPageTransitioning} />
      <div className="min-h-screen w-full bg-[#F8F9FD] flex flex-col relative select-none">
      {/* Admin Preview Floating Header */}
      {user.isAdmin && adminPreviewMode && (
        <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between text-xs sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <Shield className="w-4 h-4 text-teal-400" />
            <span className="font-bold">Mode Pratinjau Tampilan User (Super Admin)</span>
            <span className="hidden sm:inline text-slate-400">
              — Anda sedang melihat aplikasi dari sudut pandang karyawan lapangan.
            </span>
          </div>

          <button
            onClick={() => setAdminPreviewMode(false)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition-all shadow-sm active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Portal Admin</span>
          </button>
        </div>
      )}

      {/* Real Web Header / Control Banner for Desktop Viewers (Hidden when printing PDF) */}
      <div className="hidden lg:flex items-center justify-between px-6 py-2 bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-40 print:hidden">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-800">FMCU TEAMS Live Web Application</span>
          <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
            Real Web Mode
          </span>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            User: {user.name}
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
      {mobileScreen === 'visit-form' && selectedAgenda ? (
        /* Full UI/UX FORM VISIT (KHUSUS AGENDA VISIT) */
        <Suspense fallback={<PageTransitionLoader visible={true} />}>
          <VisitReportForm
            agenda={selectedAgenda}
            user={user}
            onBack={() => setMobileScreen('detail')}
          />
        </Suspense>
      ) : isMobileLayout ? (
        /* Mobile Full-Screen Web App */
        <div className="flex-1 w-full max-w-md mx-auto min-h-screen bg-[#F8F9FD] flex flex-col relative">
          {mobileScreen === 'detail' && selectedAgenda ? (
            /* Halaman Detail Agenda */
            <AgendaDetailView
              agenda={selectedAgenda}
              onBack={() => setMobileScreen('main')}
              onOpenVisitForm={() => setMobileScreen('visit-form')}
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
                  medicinesCount={agendas.filter((a) => a.pic?.toLowerCase().includes(user.name.toLowerCase())).length}
                  onBack={() => setMobileTab('home')}
                  onLogout={handleLogout}
                  onUpdateUser={handleUpdateUser}
                  onReplaySplash={() => setShowSplash(true)}
                />
              )}
            </>
          )}
        </div>
      ) : (
        /* Full Desktop Web Dashboard */
        <Suspense fallback={<PageTransitionLoader visible={true} />}>
          <DesktopDashboard
            user={user}
            agendas={agendas}
            selectedAgenda={selectedAgenda}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onSelectAgenda={handleSelectAgenda}
            onOpenNewAgenda={() => setShowNewAgendaModal(true)}
            onOpenVisitForm={(agenda) => {
              setSelectedAgenda(agenda);
              setMobileScreen('visit-form');
            }}
            onLogout={handleLogout}
            onOpenAdminPortal={user.isAdmin ? () => setAdminPreviewMode(false) : undefined}
          />
        </Suspense>
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
    </>
  );
};

export default App;
