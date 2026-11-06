import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Medicine, User } from './types';
import { initialMedicines } from './data/mockData';
import { ViewNavbar, AppViewMode } from './components/ViewNavbar';
import { ShowcaseView } from './components/ShowcaseView';
import { DesktopDashboard } from './components/DesktopDashboard';
import { SingleMobileView } from './components/SingleMobileView';
import { LoginPage } from './components/LoginPage';
import { NewReminderView } from './components/NewReminderView';
import { X } from 'lucide-react';

export const App: React.FC = () => {
  // Load state with localStorage fallback
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
    // Default to Meglitinides as in the photo
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
      name: 'Sarah Jenkins',
      email: 'sarah.j@fmcuteams.com',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    };
  });

  const [viewMode, setViewMode] = useState<AppViewMode>('showcase');
  const [showDesktopNewReminderModal, setShowDesktopNewReminderModal] = useState(false);

  // Sync to local storage
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
  };

  const handleRemoveMedicine = (id: string) => {
    const filtered = medicines.filter((m) => m.id !== id);
    setMedicines(filtered);
    if (selectedMedicine.id === id && filtered.length > 0) {
      setSelectedMedicine(filtered[0]);
    }
  };

  const handleToggleTaken = (id: string) => {
    setMedicines((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const updated = !m.takenToday;
          return {
            ...m,
            takenToday: updated,
            thisMonthProgress: updated
              ? `${Math.min(31, parseInt(m.thisMonthProgress) + 1 || 1)}/31 taken`
              : m.thisMonthProgress,
          };
        }
        return m;
      })
    );

    // Update selected medicine as well if matching
    if (selectedMedicine.id === id) {
      setSelectedMedicine((prev) => ({
        ...prev,
        takenToday: !prev.takenToday,
      }));
    }
  };

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    setViewMode('showcase');
  };

  const handleLogout = () => {
    setUser(null);
    setViewMode('login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FD]">
      {/* Top Controls Navbar */}
      <ViewNavbar
        currentMode={viewMode}
        onSetMode={setViewMode}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main View Display */}
      <div className="flex-1 flex flex-col relative">
        {viewMode === 'login' && (
          <LoginPage
            onLogin={handleLogin}
            onContinueAsGuest={() => {
              setUser({
                name: 'Guest User',
                email: 'guest@fmcuteams.com',
                avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
              });
              setViewMode('showcase');
            }}
          />
        )}

        {viewMode === 'showcase' && (
          <ShowcaseView
            medicines={medicines}
            selectedMedicine={selectedMedicine}
            onSelectMedicine={handleSelectMedicine}
            onAddMedicine={handleAddMedicine}
            onRemoveMedicine={handleRemoveMedicine}
            onToggleTaken={handleToggleTaken}
            onOpenMobileView={() => setViewMode('mobile')}
          />
        )}

        {viewMode === 'desktop' && (
          <DesktopDashboard
            user={
              user || {
                name: 'Sarah Jenkins',
                email: 'sarah.j@fmcuteams.com',
                avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
              }
            }
            medicines={medicines}
            selectedMedicine={selectedMedicine}
            onSelectMedicine={handleSelectMedicine}
            onOpenNewReminder={() => setShowDesktopNewReminderModal(true)}
            onRemoveMedicine={handleRemoveMedicine}
            onToggleTaken={handleToggleTaken}
            onLogout={handleLogout}
            onSwitchToMobileShowcase={() => setViewMode('showcase')}
          />
        )}

        {viewMode === 'mobile' && (
          <SingleMobileView
            medicines={medicines}
            selectedMedicine={selectedMedicine}
            onSelectMedicine={handleSelectMedicine}
            onAddMedicine={handleAddMedicine}
            onRemoveMedicine={handleRemoveMedicine}
            onToggleTaken={handleToggleTaken}
          />
        )}
      </div>

      {/* Modal for New Reminder when in Desktop mode */}
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
              onAddMedicine={(newMed) => {
                handleAddMedicine(newMed);
                confetti({
                  particleCount: 40,
                  spread: 60,
                  origin: { y: 0.6 },
                });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
