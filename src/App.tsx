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
  getDeletedAgendaIds,
  markAgendaDeletedLocally,
} from './services/cloudScheduleSyncService';
import { fetchAllVisitReportsFromCloud } from './services/crossDeviceVisitSyncService';
import {
  initSilentBackgroundPositioning,
  hydrateAgendasWithLocalAttendance,
  flushOfflineAttendanceQueue,
} from './services/actualAttendanceService';
import { exportScheduleToTemplateExcel } from './services/scheduleExcelService';
import { isSamePersonName } from './data/masterStoresData';
import {
  startLivePresenceHeartbeat,
  stopLivePresenceHeartbeat,
} from './services/userLivePresenceService';
import {
  fetchOnlineUserPasswords,
  mergeUsersWithOnlinePasswords,
  USER_PASSWORD_SYNC_EVENT,
  FMCU_USERS_STORAGE_KEY,
} from './services/userAuthSyncService';
import { Shield, ArrowLeft } from 'lucide-react';
import { GpsEnforcerGuard } from './components/common/GpsEnforcerGuard';

// Code-split heavy components to make initial splash & login load instantly on mobile
const AdminPortal = lazy(() =>
  import('./components/admin/AdminPortal').then((m) => ({ default: m.AdminPortal }))
);
const ExecutivePortal = lazy(() =>
  import('./components/executive/ExecutivePortal').then((m) => ({ default: m.ExecutivePortal }))
);
const DesktopDashboard = lazy(() =>
  import('./components/DesktopDashboard').then((m) => ({ default: m.DesktopDashboard }))
);
const VisitReportForm = lazy(() =>
  import('./components/visit/VisitReportForm').then((m) => ({ default: m.VisitReportForm }))
);

export const App: React.FC = () => {
  // 1. Master State for Users (Admin + 36 User dari Excel dengan password NIK/0000)
  const [users, setUsers] = useState<User[]>(() => {
    try {
      localStorage.removeItem('fmcu_users_v2');
      const saved = localStorage.getItem(FMCU_USERS_STORAGE_KEY) || localStorage.getItem('fmcu_users_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const seedMap = new Map(
            initialUsers.map((u) => [u.name.toLowerCase().replace(/\([^)]+\)\s*/g, '').trim(), u])
          );
          return parsed.map((u: User) => {
            const cleanName = u.name.toLowerCase().replace(/\([^)]+\)\s*/g, '').trim();
            const seedUser = seedMap.get(cleanName);
            if (seedUser && seedUser.nik && seedUser.password && seedUser.password !== '0000') {
              if (!u.password || u.password === '0000') {
                return { ...u, password: seedUser.password, nik: seedUser.nik };
              }
            }
            if (seedUser && seedUser.nik && !u.nik) {
              return { ...u, nik: seedUser.nik };
            }
            return u;
          });
        }
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
    import('./components/executive/ExecutivePortal');
    import('./components/DesktopDashboard');
    import('./components/visit/VisitReportForm');
  }, []);

  // Save master users to localStorage safely
  useEffect(() => {
    try {
      localStorage.setItem(FMCU_USERS_STORAGE_KEY, JSON.stringify(users));
      localStorage.setItem('fmcu_users_v5', JSON.stringify(users));
    } catch (e) {
      console.warn('localStorage users quota warning:', e);
    }
  }, [users]);

  // Listen to password update events (from ProfileView or cross-tab broadcast)
  useEffect(() => {
    const handlePasswordUpdated = (e: any) => {
      const detail = e.detail;
      if (!detail?.userName || !detail?.newPassword) return;
      const targetName = detail.userName.toLowerCase().replace(/\([^)]+\)\s*/g, '').trim();
      setUsers((prev) =>
        prev.map((u) => {
          const uName = u.name.toLowerCase().replace(/\([^)]+\)\s*/g, '').trim();
          return uName === targetName ? { ...u, password: detail.newPassword, nik: u.nik || detail.newPassword } : u;
        })
      );
      setUser((curr) => {
        if (!curr) return null;
        const currName = curr.name.toLowerCase().replace(/\([^)]+\)\s*/g, '').trim();
        if (currName === targetName) {
          const updated = { ...curr, password: detail.newPassword, nik: curr.nik || detail.newPassword };
          try {
            localStorage.setItem('fmcu_user_session_v3', JSON.stringify(updated));
          } catch {
            // ignore
          }
          return updated;
        }
        return curr;
      });
    };

    window.addEventListener(USER_PASSWORD_SYNC_EVENT, handlePasswordUpdated);
    return () => {
      window.removeEventListener(USER_PASSWORD_SYNC_EVENT, handlePasswordUpdated);
    };
  }, []);

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
      const [cloudAgendas, cloudReports, rawCloudPasswords] = await Promise.all([
        fetchSchedulesFromCloud(),
        fetchAllVisitReportsFromCloud(true).catch(() => null),
        fetchOnlineUserPasswords().catch(() => ({} as Record<string, string>)),
      ]);
      const cloudPasswords: Record<string, string> = (rawCloudPasswords as Record<string, string>) || {};

      // Cross-device online password sync
      if (cloudPasswords && Object.keys(cloudPasswords).length > 0) {
        setUsers((prev) => {
          const { updatedList, hasChanges } = mergeUsersWithOnlinePasswords(prev, cloudPasswords);
          return hasChanges ? updatedList : prev;
        });
        setUser((prevUser) => {
          if (!prevUser) return null;
          const cleanName = prevUser.name.toLowerCase().replace(/\([^)]+\)\s*/g, '').trim();
          const onlinePass = cloudPasswords[cleanName] || (prevUser.id ? cloudPasswords[String(prevUser.id)] : undefined);
          if (onlinePass && onlinePass !== prevUser.password) {
            const next = { ...prevUser, password: onlinePass, nik: prevUser.nik || onlinePass };
            try {
              localStorage.setItem('fmcu_user_session_v3', JSON.stringify(next));
            } catch {
              // ignore
            }
            return next;
          }
          return prevUser;
        });
      }

      // Cache cloud reports to localStorage so that all components instantly have updated reports
      if (cloudReports && Array.isArray(cloudReports) && cloudReports.length > 0) {
        for (const rep of cloudReports) {
          const repKey = `fmcu_visit_report_${rep.agendaId || rep.id}`;
          try {
            const existingRaw = localStorage.getItem(repKey);
            if (existingRaw) {
              const existingParsed = JSON.parse(existingRaw);
              const localMs = Number(existingParsed.updatedAtMs || 0);
              const remoteMs = Number(rep.updatedAtMs || 0);
              // Do NOT overwrite if local copy has fresher unsynced changes!
              if (localMs > remoteMs) continue;
            }
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

        const deletedIds = getDeletedAgendaIds();
        const filteredCloud = hydratedCloud.filter((a) => !deletedIds.has(String(a.id)));
        const cloudIdSet = new Set(filteredCloud.map((a) => a.id));

        setAgendas((prev) => {
          // Cloud is the master cross-device source of truth!
          // NEVER resurrect missing cloud items (sch-). ONLY keep un-synced local drafts (draft-, local-) that are not deleted!
          const unsyncedLocal = prev.filter(
            (a) =>
              !cloudIdSet.has(a.id) &&
              !deletedIds.has(String(a.id)) &&
              (a.id.startsWith('local-') || a.id.startsWith('draft-'))
          );
          const merged = unsyncedLocal.length > 0 ? [...unsyncedLocal, ...filteredCloud] : filteredCloud;

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

    // 2. Poll every 5 seconds when tab is active so changes from other devices appear online
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        syncSchedulesFromCloud();
      }
    }, 5000);

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
      } else if (e.key === 'fmcu_deleted_agenda_ids_v5' && e.newValue) {
        try {
          const arr = JSON.parse(e.newValue);
          if (Array.isArray(arr)) {
            const delSet = new Set(arr.map(String));
            setAgendas((prev) => prev.filter((a) => !delSet.has(String(a.id))));
          }
        } catch {}
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('online', syncSchedulesFromCloud);

    // BroadcastChannel handler for 0ms same-device sync
    const unsubBroadcast = subscribeToLocalSync((payload: any) => {
      if (payload && payload.type === 'SCHEDULE_DELETED' && payload.agendaId) {
        const delId = String(payload.agendaId);
        markAgendaDeletedLocally(delId);
        setAgendas((prev) => prev.filter((a) => String(a.id) !== delId));
      }
      syncSchedulesFromCloud();
    });

    // Custom window event listener for 0ms cross-component sync
    const handleScheduleDeletedEvent = (e: any) => {
      const delId = String(e?.detail?.agendaId);
      if (delId) {
        markAgendaDeletedLocally(delId);
        setAgendas((prev) => prev.filter((a) => String(a.id) !== delId));
      }
    };
    window.addEventListener('fmcu:schedule:deleted', handleScheduleDeletedEvent);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('online', syncSchedulesFromCloud);
      window.removeEventListener('fmcu:schedule:deleted', handleScheduleDeletedEvent);
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

  // Realtime Live Presence & GPS Heartbeat (Hanya aktif saat user sedang membuka web)
  useEffect(() => {
    if (user) {
      startLivePresenceHeartbeat(user);
    } else {
      stopLivePresenceHeartbeat();
    }
    return () => {
      stopLivePresenceHeartbeat();
    };
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

  // Guard: Form visit HANYA boleh dibuka oleh personel yang dijadwalkan
  useEffect(() => {
    if (mobileScreen === 'visit-form' && selectedAgenda) {
      const picName = (selectedAgenda.pic || '').trim();
      const currentName = (user?.name || '').trim();
      const isAssigned =
        !picName ||
        (currentName &&
          (isSamePersonName(picName, currentName) ||
            picName.toLowerCase().includes(currentName.toLowerCase()) ||
            currentName.toLowerCase().includes(picName.toLowerCase())));

      if (!isAssigned) {
        alert(
          `Akses Ditolak: Form visit hanya dapat dibuka oleh personel yang dijadwalkan (${picName}).`
        );
        setMobileScreen('main');
      }
    }
  }, [mobileScreen, selectedAgenda, user?.name]);

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
    const cleanId = String(id);
    markAgendaDeletedLocally(cleanId);
    setAgendas((prev) => prev.filter((a) => String(a.id) !== cleanId));
    if (selectedAgenda && String(selectedAgenda.id) === cleanId) {
      setSelectedAgenda(null);
    }
    try {
      const raw = localStorage.getItem('fmcu_agendas_master_v6');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((a: any) => String(a.id) !== cleanId);
          localStorage.setItem('fmcu_agendas_master_v6', JSON.stringify(cleaned));
        }
      }
    } catch {}
    deleteAgendaFromCloud(cleanId);
  };

  const handleToggleComplete = (id: string) => {
    if (user?.isExecutiveViewer) return;
    const target = agendas.find((a) => a.id === id);
    if (target) {
      handleUpdateAgenda({ ...target, completed: !target.completed });
    }
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

  // 2. If logged in as EXECUTIVE VIEWER and not in preview mode, render dedicated Executive Portal
  if ((user.isExecutiveViewer || user.accessLevel === 'EXECUTIVE_VIEWER') && !adminPreviewMode) {
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
          <ExecutivePortal
            executiveUser={user}
            agendas={agendas}
            users={users}
            onLogout={handleLogout}
            onSwitchToUserView={() => setAdminPreviewMode(true)}
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

  // 3. If logged in as ADMIN and not in preview mode, render dedicated Admin Portal
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
        /* Full UI/UX FORM VISIT (KHUSUS AGENDA VISIT) */
        <div className="flex-1 w-full h-full bg-[#F8F9FD] flex flex-col overflow-hidden">
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
        /* Mobile & Tablet Adaptive Full-Screen Web App */
        <div className="flex-1 w-full max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto min-h-screen bg-[#F8F9FD] flex flex-col relative transition-all duration-300 overflow-x-hidden">
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
                  onOpenNewAgenda={user?.isAdmin ? () => setShowNewAgendaModal(true) : undefined}
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
                  onOpenNewAgenda={user?.isAdmin ? () => setShowNewAgendaModal(true) : undefined}
                  onOpenExcelUpload={user?.isAdmin ? () => setShowExcelUploadModal(true) : undefined}
                  onToggleComplete={handleToggleComplete}
                  onDeleteAgenda={user?.isAdmin ? handleDeleteAgenda : undefined}
                  onExportExcel={(person) => exportScheduleToTemplateExcel(agendas, users, person || 'ALL')}
                  initialDate={selectedDate}
                  isReadOnly={Boolean(user?.isExecutiveViewer || user?.accessLevel === 'EXECUTIVE_VIEWER')}
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
              onOpenNewAgenda={user?.isAdmin ? () => setShowNewAgendaModal(true) : undefined}
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

      {/* New Agenda Creation Modal (Admin Only) */}
      {showNewAgendaModal && user?.isAdmin && (
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
