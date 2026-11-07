import React, { useState } from 'react';
import { Bell, LayoutGrid, CalendarDays, Plus, ClipboardList, User as UserIcon } from 'lucide-react';
import { Medicine } from '../types';
import { CalendarStrip } from './CalendarStrip';
import { MedicineCard } from './MedicineCard';

interface HomeScreenProps {
  medicines: Medicine[];
  onSelectMedicine: (medicine: Medicine) => void;
  onOpenNewReminder: () => void;
  onToggleTaken: (id: string, e: React.MouseEvent) => void;
  onOpenProfile?: () => void;
  onOpenCalendar?: () => void;
  activeNavTab?: string;
  setActiveNavTab?: (tab: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  medicines,
  onSelectMedicine,
  onOpenNewReminder,
  onToggleTaken,
  onOpenProfile,
  onOpenCalendar,
  activeNavTab = 'home',
  setActiveNavTab,
}) => {
  const [selectedDay, setSelectedDay] = useState(5);
  const [selectedPeriod, setSelectedPeriod] = useState<'Today' | 'Week' | 'Month'>('Today');

  // Filter medicines based on period tab
  const displayedMedicines = medicines.filter((med) => {
    if (selectedPeriod === 'Today') return true;
    if (selectedPeriod === 'Week') return med.frequency === 'Daily' || med.frequency === 'Every 2 Days';
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-[#F8F9FD] relative overflow-hidden select-none">
      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-7 pb-28">
        {/* Top Header: Title & Bell */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-[26px] font-extrabold text-slate-900 leading-[1.15] tracking-tight">
              Your Medicines<br />Reminder
            </h1>
          </div>

          <button
            onClick={() => alert("All medicines are scheduled accurately for today!")}
            className="w-11 h-11 rounded-full bg-[#EAF8F2] flex items-center justify-center text-[#2BB3A0] shadow-soft-sm hover:scale-105 active:scale-95 transition-all relative flex-shrink-0"
          >
            <Bell className="w-5 h-5" />
            <span className="w-2 h-2 rounded-full bg-[#2BB3A0] absolute top-2.5 right-2.5 border-2 border-white ring-2 ring-[#EAF8F2]" />
          </button>
        </div>

        {/* Horizontal Calendar Strip */}
        <div className="mb-5">
          <CalendarStrip selectedDay={selectedDay} onSelectDay={setSelectedDay} />
        </div>

        {/* Period Filter Tabs: Today / Week / Month */}
        <div className="flex items-center gap-6 mb-4 px-1">
          {(['Today', 'Week', 'Month'] as const).map((period) => {
            const isActive = selectedPeriod === period;
            return (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className="relative pb-1.5 transition-colors"
              >
                <span
                  className={`text-sm font-bold transition-colors ${
                    isActive ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {period}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#4E80EE] rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Medicines List */}
        <div className="space-y-3">
          {displayedMedicines.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-3xl p-6 border border-slate-100">
              <p className="text-slate-400 text-sm font-medium">No medicines scheduled for this period.</p>
              <button
                onClick={onOpenNewReminder}
                className="mt-3 px-4 py-2 rounded-full bg-[#2BB3A0] text-white text-xs font-bold"
              >
                + Add Medicine
              </button>
            </div>
          ) : (
            displayedMedicines.map((med) => (
              <MedicineCard
                key={med.id}
                medicine={med}
                onClick={onSelectMedicine}
                onToggleTaken={onToggleTaken}
              />
            ))
          )}
        </div>
      </div>

      {/* Floating Bottom Navigation Bar */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-2 bg-gradient-to-t from-[#F8F9FD] via-[#F8F9FD]/95 to-transparent pointer-events-none">
        <div className="w-full bg-white/95 backdrop-blur-md rounded-[32px] px-5 py-3 shadow-dock flex items-center justify-between border border-white/60 pointer-events-auto">
          {/* Home */}
          <button
            onClick={() => setActiveNavTab && setActiveNavTab('home')}
            className={`p-2 transition-all ${
              activeNavTab === 'home' ? 'text-[#3E74FF]' : 'text-slate-300 hover:text-slate-500'
            }`}
          >
            <LayoutGrid className="w-5 h-5 stroke-[2.2]" />
          </button>

          {/* Calendar / Schedule */}
          <button
            onClick={() => {
              if (onOpenCalendar) onOpenCalendar();
              else if (setActiveNavTab) setActiveNavTab('calendar');
            }}
            className={`p-2 transition-all ${
              activeNavTab === 'calendar' ? 'text-[#3E74FF]' : 'text-slate-300 hover:text-slate-500'
            }`}
          >
            <CalendarDays className="w-5 h-5 stroke-[2]" />
          </button>

          {/* Center FAB (+) */}
          <button
            onClick={onOpenNewReminder}
            className="w-12 h-12 -mt-6 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white flex items-center justify-center shadow-pill-teal hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* List / History */}
          <button
            onClick={() => setActiveNavTab && setActiveNavTab('history')}
            className={`p-2 transition-all ${
              activeNavTab === 'history' ? 'text-[#3E74FF]' : 'text-slate-300 hover:text-slate-500'
            }`}
          >
            <ClipboardList className="w-5 h-5 stroke-[2]" />
          </button>

          {/* Profile / User */}
          <button
            onClick={() => {
              if (onOpenProfile) onOpenProfile();
              else if (setActiveNavTab) setActiveNavTab('profile');
            }}
            className={`p-2 transition-all ${
              activeNavTab === 'profile' ? 'text-[#3E74FF]' : 'text-slate-300 hover:text-slate-500'
            }`}
          >
            <UserIcon className="w-5 h-5 stroke-[2]" />
          </button>
        </div>
      </div>
    </div>
  );
};
