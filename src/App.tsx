import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Medicine, User } from './types';
import { initialMedicines } from './data/mockData';
import { HomeScreen } from './components/HomeScreen';
import { DetailView } from './components/DetailView';
import { NewReminderView } from './components/NewReminderView';
import { CalendarScheduleView } from './components/CalendarScheduleView';
import { HistoryView } from './components/HistoryView';
import { ProfileView } from './components/ProfileView';
import { DesktopDashboard } from './components/DesktopDashboard';
import { EditScheduleModal } from './components/EditScheduleModal';
import { LoginPage } from './components/LoginPage';
import { Smartphone, Monitor, X } from 'lucide-react';

export const App: React.FC = () => {
  // 1. Data State with LocalStorage persistence
  const [medicines, setMedicines] = useState<Medicine[]>(() => {
    const saved = localStorage.getItem('fmcu_medicines');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return initialMedicines;
  });

  const [selectedMedicine, setSelectedMedicine] = useState<Medicine>(() => {
    return initialMedicines[2] || initialMedicines[0];
  });

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
      name: 'Dr. Sarah Jenkins',
      email: 'sarah.j@fmcuteams.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    };
  });

  // Mobile navigation active tab
  const [mobileTab, setMobileTab] = useState<'home' | 'calendar' | 'history' | 'profile'>('home');
  // Mobile sub-screens: null (shows tab), 'detail', 'new-reminder'
  const [mobileScreen, setMobileScreen] = useState<'main' | 'detail' | 'new-reminder'>('main');

  // Desktop modals
  const [showDesktopNewReminderModal, setShowDesktopNewReminderModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);

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
    localStorage.setItem('fmcu_medicines', JSON.stringify(medicines));
  }, [medicines]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('fmcu_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('fmcu_user');
    }
  }, [user]);

  // Handlers
  const handleSelectMedicine = (med: Medicine) => {
    setSelectedMedicine(med);
    setMobileScreen('detail');
  };

  const handleAddMedicine = (newMedData: Omit<Medicine, 'id'>) => {
    const newMed: Medicine = {
      ...newMedData,
      id: `med-${Date.now()}`,
    };
    const updated = [newMed, ...medicines];
    setMedicines(updated);
    setSelectedMedicine(newMed);
    setShowDesktopNewReminderModal(false);
    setMobileScreen('main');
    setMobileTab('home');

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#2BB3A0', '#FF6B8B', '#FFB085', '#5C86FA'],
    });
  };

  const handleRemoveMedicine = (id: string) => {
    const filtered = medicines.filter((m) => m.id !== id);
    setMedicines(filtered);
    if (selectedMedicine.id === id && filtered.length > 0) {
      setSelectedMedicine(filtered[0]);
    }
    setMobileScreen('main');
  };

  const handleSaveSchedule = (updated: Medicine) => {
    setMedicines((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    if (selectedMedicine.id === updated.id) {
      setSelectedMedicine(updated);
    }
    setEditingMedicine(null);
  };

  const handleToggleTaken = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMedicines((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const updated = !m.takenToday;
          if (updated) {
            confetti({
              particleCount: 40,
              spread: 50,
              origin: { y: 0.7 },
              colors: ['#2BB3A0', '#4ADE80', '#FF6B8B', '#FFD12E'],
            });
          }
          return {
            ...m,
            takenToday: updated,
            thisMonthProgress: updated
              ? `${Math.min(31, (parseInt(m.thisMonthProgress) || 0) + 1)}/31 taken`
              : m.thisMonthProgress,
          };
        }
        return m;
      })
    );

    if (selectedMedicine.id === id) {
      setSelectedMedicine((prev) => ({
        ...prev,
        takenToday: !prev.takenToday,
      }));
    }
  };

  const handleLogout = () => {
    setUser(null);
  };

  // Determine effective display layout: mobile or desktop
  const isMobileLayout =
    layoutMode === 'mobile' || (layoutMode === 'auto' && isMobileViewport);

  // If user is not authenticated, show real Login / Register page
  if (!user) {
    return (
      <LoginPage
        onLogin={(loggedInUser) => setUser(loggedInUser)}
        onContinueAsGuest={() => {
          setUser({
            name: 'Guest Patient',
            email: 'patient@fmcuteams.com',
            avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          });
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
            <span>Desktop App</span>
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
            <span>Mobile App</span>
          </button>
        </div>
      </div>

      {/* Main Content: Responsive Desktop or Native Mobile */}
      {isMobileLayout ? (
        /* Mobile Full-Screen Web App (No simulated hardware frame!) */
        <div className="flex-1 w-full max-w-md mx-auto min-h-screen bg-[#F8F9FD] flex flex-col relative">
          {mobileScreen === 'detail' ? (
            <DetailView
              medicine={selectedMedicine}
              onBack={() => setMobileScreen('main')}
              onRemove={handleRemoveMedicine}
              onToggleTaken={handleToggleTaken}
              onEditSchedule={(med) => setEditingMedicine(med)}
            />
          ) : mobileScreen === 'new-reminder' ? (
            <NewReminderView
              onBack={() => setMobileScreen('main')}
              onAddMedicine={handleAddMedicine}
            />
          ) : (
            <>
              {mobileTab === 'home' && (
                <HomeScreen
                  medicines={medicines}
                  onSelectMedicine={handleSelectMedicine}
                  onOpenNewReminder={() => setMobileScreen('new-reminder')}
                  onToggleTaken={handleToggleTaken}
                  onOpenCalendar={() => setMobileTab('calendar')}
                  onOpenHistory={() => setMobileTab('history')}
                  onOpenProfile={() => setMobileTab('profile')}
                  activeNavTab={mobileTab}
                  setActiveNavTab={(tab) => setMobileTab(tab as any)}
                />
              )}
              {mobileTab === 'calendar' && (
                <CalendarScheduleView
                  medicines={medicines}
                  onBack={() => setMobileTab('home')}
                  onSelectMedicine={handleSelectMedicine}
                />
              )}
              {mobileTab === 'history' && (
                <HistoryView
                  medicines={medicines}
                  onBack={() => setMobileTab('home')}
                />
              )}
              {mobileTab === 'profile' && (
                <ProfileView
                  user={user}
                  medicinesCount={medicines.length}
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
          medicines={medicines}
          selectedMedicine={selectedMedicine}
          onSelectMedicine={handleSelectMedicine}
          onOpenNewReminder={() => setShowDesktopNewReminderModal(true)}
          onEditSchedule={(med) => setEditingMedicine(med)}
          onRemoveMedicine={handleRemoveMedicine}
          onToggleTaken={handleToggleTaken}
          onLogout={handleLogout}
        />
      )}

      {/* Desktop Modal: Add New Reminder */}
      {showDesktopNewReminderModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-md h-[720px] bg-white rounded-[38px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowDesktopNewReminderModal(false)}
              className="absolute top-5 right-5 z-20 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <NewReminderView
              onBack={() => setShowDesktopNewReminderModal(false)}
              onAddMedicine={handleAddMedicine}
            />
          </div>
        </div>
      )}

      {/* Edit Schedule Modal (Works for both Mobile & Desktop) */}
      {editingMedicine && (
        <EditScheduleModal
          medicine={editingMedicine}
          onClose={() => setEditingMedicine(null)}
          onSave={handleSaveSchedule}
        />
      )}
    </div>
  );
};

export default App;
