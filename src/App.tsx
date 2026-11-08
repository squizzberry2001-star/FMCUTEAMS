import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import confetti from 'canvas-confetti';
import { ScheduleAgenda, User } from './types';
import { initialAgendas, initialUsers } from './data/mockData';
import { HomeScreen } from './components/HomeScreen';
import { CalendarScheduleView } from './components/CalendarScheduleView';
import { HistoryView } from './components/HistoryView';
import { ProfileView } from './components/ProfileView';
import { NewAgendaModal } from './components/NewAgendaModal';
import { ExcelScheduleUploadModal } from './components/ExcelScheduleUploadModal';
import { LiveStoreMapsModal } from './components/LiveStoreMapsModal';
import { AgendaDetailView } from './components/AgendaDetailView';
import { LoginPage } from './components/LoginPage';
import { SplashScreen } from './components/SplashScreen';
import { PageTransitionLoader } from './components/PageTransitionLoader';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import {
  fetchSchedulesFromCloud,
  pushAllSchedulesToCloud,
  pushSingleAgendaToCloud,
  deleteAgendaFromCloud,
  subscribeToLocalSync,
} from './services/cloudScheduleSyncService';
import { fetchAllVisitReportsFromCloud } from './services/crossDeviceVisitSyncService';
import {
  initSilentBackgroundPositioning,
  hydrateAgendasWithLocalAttendance,
  flushOfflineAttendanceQueue,
} from './services/actualAttendanceService';
import { Shield, ArrowLeft } from 'lucide-react';
import { GpsEnforcerGuard } from './components/common/GpsEnforcerGuard';

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
    try {
      localStorage.removeItem('fmcu_users_v2');
      const saved = localStorage.getItem('fmcu_users_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return initialUsers;
  });

  // 2. Master State for Agendas (Jadwal resmi dari TEMPLET EXCEL JADWAL.xlsx + Live Cloud Sync + Offline Attendance)
  const [agendas, setAgendas] = useState<ScheduleAgenda[]>(() => {
    try {
      localStorage.removeItem('fmcu_agendas_master_v5');
      localStorage.removeItem('fmcu_agendas_master_v3');
      localStorage.removeItem('fmcu_agendas_master_v2');
      const saved = localStorage.getItem('fmcu_agendas_master_v6');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return hydrateAgendasWithLocalAttendance(parsed);
        }
      }
    } catch (e) {
      console.error(e);
    }
    return hydrateAgendasWithLocalAttendance(initialAgendas);
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

  // Silent Background Positioning & Offline Attendance Auto-Sync (Disembunyikan 100% dari sisi user)
  useEffect(() => {
    initSilentBackgroundPositioning();
    flushOfflineAttendanceQueue();

    const handleOnlineFlush = () => {
      flushOfflineAttendanceQueue();
    };
    window.addEventListener('online', handleOnlineFlush);
    return () => {
      window.removeEventListener('online', handleOnlineFlush);
    };
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
    sessionStorage.setItem('fmcu_session_splash_shown', 'true');
    initSilentBackgroundPositioning();
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

  // Modal State for New Agenda, Excel Schedule Upload & Live Maps
  const [showNewAgendaModal, setShowNewAgendaModal] = useState(false);
  const [showExcelUploadModal, setShowExcelUploadModal] = useState(false);
  const [showLiveMapsModal, setShowLiveMapsModal] = useState(false);

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

  // Save master users to localStorage safely
  useEffect(() => {
    try {
      localStorage.setItem('fmcu_users_v5', JSON.stringify(users));
    } catch (e) {
      console.warn('localStorage users quota warning:', e);
    }
  }, [users]);

  // Save master agendas to localStorage safely
  useEffect(() => {
    try {
      localStorage.setItem('fmcu_agendas_master_v6', JSON.stringify(agendas));
    } catch (e) {
      console.warn('localStorage agendas quota warning:', e);
    }
  }, [agendas]);

  // ==========================================================================
  // CROSS-DEVICE REAL-TIME ONLINE SCHEDULE SYNC (Cloudflare D1 + GAS Vault)
  // ==========================================================================
  const isSyncingCloudRef = useRef(false);

  const syncSchedulesFromCloud = async () => {
    if (isSyncingCloudRef.current) return;
    isSyncingCloudRef.current = true;
    try {
      const [cloudAgendas, cloudReports] = await Promise.all([
        fetchSchedulesFromCloud(),
        fetchAllVisitReportsFromCloud(true).catch(() => null),
      ]);

      // Cache cloud reports to localStorage so that all components instantly have updated reports
      if (cloudReports && Array.isArray(cloudReports) && cloudReports.length > 0) {
        for (const rep of cloudReports) {
          const repKey = `fmcu_visit_report_${rep.agendaId || rep.id}`;
          try {
            localStorage.setItem(repKey, JSON.stringify(rep));
          } catch {
            // ignore quota
          }
        }
      }

      if (cloudAgendas && cloudAgendas.length > 0) {
        let hydratedCloud = hydrateAgendasWithLocalAttendance(cloudAgendas);

        if (cloudReports && cloudReports.length > 0) {
          const reportMap = new Map<string, any>();
          cloudReports.forEach((r) => {
            if (r.agendaId) reportMap.set(r.agendaId, r);
            if (r.id) reportMap.set(r.id, r);
          });

          hydratedCloud = hydratedCloud.map((a) => {
            const matchedRep = reportMap.get(a.id);
            if (matchedRep) {
              return {
                ...a,
                completed: true,
                actualIn: a.actualIn || matchedRep.actualIn,
                actualOut: a.actualOut || matchedRep.actualOut,
              };
            }
            return a;
          });
        }

        setAgendas((prev) => {
          // Cloud is the master cross-device source of truth, but preserve any unsynced local agenda
          const cloudIdSet = new Set(hydratedCloud.map((a) => a.id));
          const unsyncedLocal = prev.filter(
            (a) => !cloudIdSet.has(a.id) && (a.id.startsWith('sch-') || a.id.startsWith('local-'))
          );
          const merged = unsyncedLocal.length > 0 ? [...unsyncedLocal, ...hydratedCloud] : hydratedCloud;

          const buildSig = (list: ScheduleAgenda[]) =>
            list
              .map(
                (a) =>
                  `${a.id}:${a.date}:${a.pic}:${a.title}:${a.category}:${a.completed ? 1 : 0}:${a.actualIn || ''}:${a.actualOut || ''}`
              )
              .sort()
              .join('|');
          if (buildSig(prev) !== buildSig(merged)) {
            return merged;
          }
          return prev;
        });
      }
    } catch (err) {
      console.warn('Cloud schedule sync warning:', err);
    } finally {
      isSyncingCloudRef.current = false;
    }
  };

  useEffect(() => {
    // 1. Initial sync on load
    syncSchedulesFromCloud();

    // 2. Poll every 6 seconds when tab is active so changes from other devices appear online
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        syncSchedulesFromCloud();
      }
    }, 6000);

    // 3. Sync immediately when user focuses or switches back to the app
    const handleVisibility = () => {
      if (!document.hidden) syncSchedulesFromCloud();
    };
    const handleFocus = () => syncSchedulesFromCloud();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'fmcu_agendas_master_v6' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setAgendas(parsed);
        } catch {
          // ignore
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('online', syncSchedulesFromCloud);
    const unsubBroadcast = subscribeToLocalSync(() => {
      syncSchedulesFromCloud();
    });

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('online', syncSchedulesFromCloud);
      unsubBroadcast();
    };
  }, []);

  // Save logged-in session safely
  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem('fmcu_user_session_v3', JSON.stringify(user));
      } else {
        localStorage.removeItem('fmcu_user_session_v3');
      }
    } catch (e) {
      console.warn('localStorage session quota warning:', e);
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
    if (user?.isExecutiveViewer) return;
    const updated = [newAgenda, ...agendas];
    setAgendas(updated);
    setSelectedAgenda(newAgenda);
    setShowNewAgendaModal(false);
    pushSingleAgendaToCloud(newAgenda);

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#2BB3A0', '#FF6B8B', '#FFB085', '#5C86FA'],
    });
  };

  const handleUpdateAgenda = (updated: ScheduleAgenda) => {
    if (user?.isExecutiveViewer) return;
    setAgendas((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    if (selectedAgenda && selectedAgenda.id === updated.id) {
      setSelectedAgenda(updated);
    }
    pushSingleAgendaToCloud(updated);
  };

  const handleDeleteAgenda = (id: string) => {
    if (user?.isExecutiveViewer) return;
    setAgendas((prev) => prev.filter((a) => a.id !== id));
    if (selectedAgenda && selectedAgenda.id === id) {
      setSelectedAgenda(null);
    }
    deleteAgendaFromCloud(id);
  };

  // Handlers for Admin & User Excel Import & Sync
  const handleImportExcel = (
    importedUsers: User[],
    importedAgendas: ScheduleAgenda[],
    mode: 'merge' | 'replace' = 'merge'
  ) => {
    if (user?.isExecutiveViewer) return;
    // Merge users
    const existingMap = new Map(users.map((u) => [u.name.toLowerCase(), u]));
    importedUsers.forEach((u) => {
      if (!existingMap.has(u.name.toLowerCase())) {
        existingMap.set(u.name.toLowerCase(), u);
      }
    });

    const nextUsers = Array.from(existingMap.values());
    setUsers(nextUsers);

    let nextAgendas: ScheduleAgenda[];
    if (mode === 'replace') {
      nextAgendas = importedAgendas;
    } else {
      // Replace agendas in the imported date range so re-importing a week updates cleanly without duplicates
      const importedDates = new Set(importedAgendas.map((a) => a.date));
      const keptOtherDates = agendas.filter((a) => !importedDates.has(a.date));
      nextAgendas = [...importedAgendas, ...keptOtherDates];
    }

    setAgendas(nextAgendas);
    pushAllSchedulesToCloud(nextAgendas, nextUsers);
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

  // 1. If not authenticated, render Login Page
  if (!user) {
    return (
      <GpsEnforcerGuard>
        {showSplash && (
          <SplashScreen
            onComplete={handleSplashComplete}
            user={null}
            targetThemeColor="#F8F9FD"
          />
        )}
        <PwaInstallPrompt readyToShow={!showSplash} />
        <LoginPage
          users={users}
          onLogin={handleLogin}
          onReplaySplash={() => setShowSplash(true)}
        />
      </GpsEnforcerGuard>
    );
  }

  // 2. If logged in as ADMIN and not in preview mode, render dedicated Admin Portal
  if (user.isAdmin && !adminPreviewMode) {
    return (
      <GpsEnforcerGuard>
        {showSplash && (
          <SplashScreen
            onComplete={handleSplashComplete}
            user={user}
            targetThemeColor="#FFFFFF"
          />
        )}
        <PwaInstallPrompt readyToShow={!showSplash} />
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
            onOpenLiveMaps={() => setShowLiveMapsModal(true)}
          />
        </Suspense>
        <LiveStoreMapsModal
          isOpen={showLiveMapsModal}
          onClose={() => setShowLiveMapsModal(false)}
          currentUser={user}
          users={users}
          agendas={agendas}
          selectedDate={selectedDate}
          onSelectAgenda={handleSelectAgenda}
        />
      </GpsEnforcerGuard>
    );
  }

  // 3. User View (Field Staff View or Admin in Preview Mode)
  return (
    <GpsEnforcerGuard>
      {showSplash && (
        <SplashScreen
          onComplete={handleSplashComplete}
          user={user}
          targetThemeColor="#F8F9FD"
        />
      )}
      <PwaInstallPrompt readyToShow={!showSplash} />
      <PageTransitionLoader visible={isPageTransitioning} />
      <div className="h-screen w-full bg-[#F8F9FD] flex flex-col overflow-hidden relative select-none">
      {/* Admin / Executive Viewer Preview Floating Header */}
      {user.isAdmin && adminPreviewMode && (
        <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between text-xs shrink-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <Shield className="w-4 h-4 text-teal-400" />
            <span className="font-bold">
              {user.isExecutiveViewer
                ? 'Mode Pratinjau Tampilan User (Executive Viewer • Read-Only)'
                : 'Mode Pratinjau Tampilan User (Master Admin)'}
            </span>
            <span className="hidden sm:inline text-slate-400">
              — Anda sedang melihat aplikasi dari sudut pandang karyawan lapangan.
            </span>
          </div>

          <button
            onClick={() => setAdminPreviewMode(false)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>
              {user.isExecutiveViewer ? 'Kembali ke Portal Executive' : 'Kembali ke Portal Admin'}
            </span>
          </button>
        </div>
      )}

      {/* Main Content: Responsive Desktop or Native Mobile */}
      {mobileScreen === 'visit-form' && selectedAgenda ? (
        /* Full UI/UX FORM VISIT (KHUSUS AGENDA VISIT) - Full scrollable container */
        <div className="flex-1 w-full h-full overflow-y-auto bg-[#F8F9FD]">
          <Suspense fallback={<PageTransitionLoader visible={true} />}>
            <VisitReportForm
              agenda={selectedAgenda}
              allAgendas={agendas}
              onUpdateAgenda={handleUpdateAgenda}
              user={user}
              onBack={() => setMobileScreen(isMobileLayout ? 'detail' : 'main')}
            />
          </Suspense>
        </div>
      ) : isMobileLayout ? (
        /* Mobile Full-Screen Web App */
        <div className="flex-1 w-full max-w-md mx-auto min-h-screen bg-[#F8F9FD] flex flex-col relative">
          {mobileScreen === 'detail' && selectedAgenda ? (
            /* Halaman Detail Agenda */
            <AgendaDetailView
              agenda={selectedAgenda}
              allAgendas={agendas}
              onUpdateAgenda={handleUpdateAgenda}
              currentUser={user}
              onBack={() => setMobileScreen('main')}
              onOpenVisitForm={() => {
                setMobileScreen('visit-form');
              }}
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
                  onOpenNewAgenda={() => setShowNewAgendaModal(true)}
                  onOpenExcelUpload={user?.isAdmin ? () => setShowExcelUploadModal(true) : undefined}
                  onOpenLiveMaps={() => setShowLiveMapsModal(true)}
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
                  user={user}
                  agendas={agendas}
                  onBack={() => setMobileTab('home')}
                  onSelectAgenda={handleSelectAgenda}
                  onOpenNewAgenda={() => setShowNewAgendaModal(true)}
                  onOpenExcelUpload={user?.isAdmin ? () => setShowExcelUploadModal(true) : undefined}
                  initialDate={selectedDate}
                />
              )}

              {/* Section 3: Coverage Store & History Aktivitas */}
              {mobileTab === 'history' && (
                <HistoryView
                  user={user}
                  agendas={agendas}
                  users={users}
                  onBack={() => setMobileTab('home')}
                  onSelectAgenda={handleSelectAgenda}
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
        <div className="flex-1 min-h-0 w-full h-full overflow-hidden">
          <Suspense fallback={<PageTransitionLoader visible={true} />}>
            <DesktopDashboard
              user={user}
              agendas={agendas}
              selectedAgenda={selectedAgenda}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onSelectAgenda={handleSelectAgenda}
              onOpenNewAgenda={() => setShowNewAgendaModal(true)}
              onOpenExcelUpload={user?.isAdmin ? () => setShowExcelUploadModal(true) : undefined}
              onOpenLiveMaps={() => setShowLiveMapsModal(true)}
              onOpenVisitForm={(agenda) => {
                setSelectedAgenda(agenda);
                setMobileScreen('visit-form');
              }}
              onUpdateAgenda={handleUpdateAgenda}
              onDeleteAgenda={handleDeleteAgenda}
              onToggleComplete={(id) => {
                const target = agendas.find((a) => a.id === id);
                if (target) {
                  handleUpdateAgenda({ ...target, completed: !target.completed });
                }
              }}
              onLogout={handleLogout}
              onOpenAdminPortal={user.isAdmin ? () => setAdminPreviewMode(false) : undefined}
              onUpdateUser={handleUpdateUser}
              users={users}
            />
          </Suspense>
        </div>
      )}

      {/* New Agenda Creation Modal (Desktop & Mobile) */}
      {showNewAgendaModal && (
        <NewAgendaModal
          initialDate={selectedDate}
          onClose={() => setShowNewAgendaModal(false)}
          onAddAgenda={handleAddNewAgenda}
        />
      )}

      {/* Upload Schedule by Excel Modal (Desktop & Mobile - Admin Only) */}
      {showExcelUploadModal && user?.isAdmin && (
        <ExcelScheduleUploadModal
          existingUsers={users}
          currentAgendasCount={agendas.length}
          onClose={() => setShowExcelUploadModal(false)}
          onImportSuccess={(updatedUsers, newAgendas, mode, summaryMsg) => {
            handleImportExcel(updatedUsers, newAgendas, mode);
            alert(summaryMsg);
          }}
        />
      )}

      {/* Live Store Maps Modal (User & Admin Mode) */}
      <LiveStoreMapsModal
        isOpen={showLiveMapsModal}
        onClose={() => setShowLiveMapsModal(false)}
        currentUser={user}
        users={users}
        agendas={agendas}
        selectedDate={selectedDate}
        onSelectAgenda={handleSelectAgenda}
      />
    </div>
    </GpsEnforcerGuard>
  );
};

export default App;
