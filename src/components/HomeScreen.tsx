import React, { useState } from 'react';
import { Bell, LayoutGrid, CalendarDays, Plus, ClipboardList, User as UserIcon } from 'lucide-react';
import { ScheduleAgenda, User } from '../types';
import { CalendarStrip } from './CalendarStrip';
import { ScheduleCard } from './ScheduleCard';

interface HomeScreenProps {
  user?: User | null;
  agendas: ScheduleAgenda[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onSelectAgenda?: (agenda: ScheduleAgenda) => void;
  onOpenNewAgenda: () => void;
  onToggleComplete: (id: string, e: React.MouseEvent) => void;
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

  // Menentukan nama hari ini dalam Bahasa Indonesia
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const currentDayName = dayNames[new Date().getDay()];

  // Mengambil nama depan user yang login
  const rawName = user?.name || 'Sarah Jenkins';
  const cleanName = rawName.replace(/^Dr\.\s*/i, '').trim();
  const firstName = cleanName.split(' ')[0] || 'User';

  // Filter agenda berdasarkan tanggal atau tab periode
  const displayedAgendas = agendas.filter((item) => {
    if (selectedPeriod === 'Today') {
      return item.date === selectedDate;
    }
    if (selectedPeriod === 'Week') {
      return true; // Tampilkan agenda minggu ini
    }
    return true; // Bulan ini
  });

  return (
    <div className="flex flex-col h-full bg-[#F8F9FD] relative select-none w-full max-w-xl mx-auto">
      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 sm:px-6 pt-6 pb-28">
        {/* Top Header: Your Daily Schedule & Greeting */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-[26px] font-extrabold text-slate-900 leading-[1.15] tracking-tight">
              Your Daily<br />Schedule
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Selamat {currentDayName}, {firstName}! 👋
            </p>
          </div>

          <button
            onClick={() => alert(`Notifikasi: Ada ${displayedAgendas.length} agenda terjadwal untuk hari ini.`)}
            className="w-11 h-11 rounded-full bg-[#EAF8F2] flex items-center justify-center text-[#2BB3A0] shadow-soft-sm hover:scale-105 active:scale-95 transition-all relative flex-shrink-0"
          >
            <Bell className="w-5 h-5" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#2BB3A0] absolute top-2.5 right-2.5 border-2 border-white ring-2 ring-[#EAF8F2]" />
          </button>
        </div>

        {/* Section 1 Item 2: Horizontal Calendar Strip (Senin s/d Minggu Actual Dates) */}
        <div className="mb-5">
          <CalendarStrip selectedDate={selectedDate} onSelectDate={onSelectDate} />
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
                  {period === 'Today' ? 'Hari Ini' : period === 'Week' ? 'Minggu Ini' : 'Bulan Ini'}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#4E80EE] rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Section 1 Item 3: List Schedule Agenda yang dibuat admin */}
        <div className="space-y-3">
          {displayedAgendas.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-card">
              <p className="text-slate-400 text-xs font-medium">
                Belum ada schedule agenda yang dibuat admin untuk tanggal ini ({selectedDate}).
              </p>
              <button
                onClick={onOpenNewAgenda}
                className="mt-3 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white text-xs font-bold shadow-pill-teal hover:brightness-105"
              >
                + Tambah Schedule Agenda
              </button>
            </div>
          ) : (
            displayedAgendas.map((agenda) => (
              <ScheduleCard
                key={agenda.id}
                agenda={agenda}
                onClick={onSelectAgenda}
                onToggleComplete={onToggleComplete}
              />
            ))
          )}
        </div>
      </div>

      {/* Floating Bottom Navigation Bar */}
      <div className="fixed sm:sticky bottom-0 left-0 right-0 max-w-xl mx-auto px-5 pb-5 pt-2 bg-gradient-to-t from-[#F8F9FD] via-[#F8F9FD]/95 to-transparent pointer-events-none z-30">
        <div className="w-full bg-white/95 backdrop-blur-md rounded-[32px] px-5 py-3 shadow-dock flex items-center justify-between border border-white/60 pointer-events-auto">
          {/* Home / Daily Schedule */}
          <button
            onClick={() => setActiveNavTab && setActiveNavTab('home')}
            className={`p-2 transition-all ${
              activeNavTab === 'home' ? 'text-[#3E74FF]' : 'text-slate-300 hover:text-slate-500'
            }`}
          >
            <LayoutGrid className="w-5 h-5 stroke-[2.2]" />
          </button>

          {/* Calendar / Schedule (Section 2) */}
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
            onClick={onOpenNewAgenda}
            className="w-12 h-12 -mt-6 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white flex items-center justify-center shadow-pill-teal hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* Coverage Store / History (Section 3) */}
          <button
            onClick={() => {
              if (onOpenHistory) onOpenHistory();
              else if (setActiveNavTab) setActiveNavTab('history');
            }}
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
