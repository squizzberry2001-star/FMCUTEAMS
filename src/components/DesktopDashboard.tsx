import React, { useState } from 'react';
import {
  Bell,
  Search,
  Plus,
  LayoutGrid,
  Calendar as CalendarIcon,
  Pill,
  Activity,
  CheckCircle2,
  Settings,
  LogOut,
  ChevronRight,
  TrendingUp,
  Clock,
  Sparkles,
  ClipboardList
} from 'lucide-react';
import { Medicine, User } from '../types';
import { CalendarStrip } from './CalendarStrip';
import { MedicineCard } from './MedicineCard';
import { MeglitinidesHero3D, ParacetamolHero3D } from './3d-icons/Illustrations';

interface DesktopDashboardProps {
  user: User;
  medicines: Medicine[];
  selectedMedicine: Medicine;
  onSelectMedicine: (med: Medicine) => void;
  onOpenNewReminder: () => void;
  onEditSchedule: (med: Medicine) => void;
  onRemoveMedicine: (id: string) => void;
  onToggleTaken: (id: string, e?: React.MouseEvent) => void;
  onLogout: () => void;
}

export const DesktopDashboard: React.FC<DesktopDashboardProps> = ({
  user,
  medicines,
  selectedMedicine,
  onSelectMedicine,
  onOpenNewReminder,
  onEditSchedule,
  onRemoveMedicine,
  onToggleTaken,
  onLogout,
}) => {
  const [selectedDay, setSelectedDay] = useState(5);
  const [selectedPeriod, setSelectedPeriod] = useState<'Today' | 'Week' | 'Month'>('Today');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenu, setActiveMenu] = useState('dashboard');

  const filteredMedicines = medicines.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.cause.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const takenCount = medicines.filter((m) => m.takenToday).length;
  const totalCount = medicines.length;
  const progressPercent = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  return (
    <div className="flex h-screen w-full bg-[#F8F9FD] overflow-hidden">
      {/* 1. Left Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-slate-100 flex flex-col justify-between p-6 z-20 flex-shrink-0">
        <div>
          {/* Logo & App Brand */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#32C2AD] to-[#20A894] flex items-center justify-center text-white shadow-pill-teal">
              <Pill className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-xs font-bold text-teal-600 tracking-wider uppercase">FMCU TEAMS</span>
              <h2 className="text-base font-extrabold text-slate-800 leading-tight">MedReminder</h2>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="space-y-1.5">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
              { id: 'schedule', label: 'Schedule', icon: CalendarIcon },
              { id: 'cabinet', label: 'Medicine Cabinet', icon: Pill },
              { id: 'history', label: 'Dose History', icon: ClipboardList },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveMenu(item.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#EAF8F2] text-[#2BB3A0] shadow-sm'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Quick Adherence Info Box */}
          <div className="mt-8 bg-gradient-to-br from-slate-50 via-teal-50/40 to-slate-50 rounded-2xl p-4 border border-teal-100/60">
            <div className="flex items-center gap-2 text-teal-700 font-bold text-xs mb-1">
              <Sparkles className="w-4 h-4 text-teal-500" />
              <span>Daily Adherence</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              {takenCount} of {totalCount} medications taken today.
            </p>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-400 to-teal-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* User Card & Logout */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
              alt={user.name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-teal-100"
            />
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-800 truncate">{user.name}</h4>
              <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Log Out"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* 2. Main Middle Area: Header, Stats, Calendar, Medicine List */}
      <main className="flex-1 overflow-y-auto px-8 py-7">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-4 mb-7">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Your Medicines Reminder
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Keep your daily treatment on track and stay healthy.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search medicine or cause..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white border border-slate-200/80 rounded-full pl-10 pr-4 py-2 text-xs font-medium text-slate-800 outline-none focus:border-teal-500 w-60 transition-all"
              />
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => alert("All medicines are scheduled accurately for today!")}
              className="w-10 h-10 rounded-full bg-[#EAF8F2] flex items-center justify-center text-[#2BB3A0] shadow-soft-sm hover:scale-105 active:scale-95 transition-all relative"
            >
              <Bell className="w-5 h-5" />
              <span className="w-2 h-2 rounded-full bg-[#2BB3A0] absolute top-2 right-2 border-2 border-white ring-2 ring-[#EAF8F2]" />
            </button>

            {/* Add New Reminder Button */}
            <button
              onClick={onOpenNewReminder}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white text-xs font-bold shadow-pill-teal hover:brightness-105 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Reminder</span>
            </button>
          </div>
        </div>

        {/* 3 Top Summary Stat Cards */}
        <div className="grid grid-cols-3 gap-5 mb-7">
          {/* Card 1: Doses Today */}
          <div className="bg-white rounded-[26px] p-5 shadow-soft-card flex items-center justify-between border border-transparent hover:border-teal-100 transition-all">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Today's Adherence
              </span>
              <h3 className="text-2xl font-black text-slate-800 mt-1">
                {takenCount} of {totalCount} Doses
              </h3>
              <p className="text-xs text-teal-600 font-semibold mt-1">
                {progressPercent}% completed today
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#EAF8F2] text-[#2BB3A0] flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
          </div>

          {/* Card 2: Active Prescriptions */}
          <div className="bg-white rounded-[26px] p-5 shadow-soft-card flex items-center justify-between border border-transparent hover:border-orange-100 transition-all">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Prescriptions
              </span>
              <h3 className="text-2xl font-black text-slate-800 mt-1">
                {medicines.length} Medicines
              </h3>
              <p className="text-xs text-orange-500 font-semibold mt-1">
                Active reminders running
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#FFF4ED] text-[#FF9E79] flex items-center justify-center">
              <Pill className="w-7 h-7" />
            </div>
          </div>

          {/* Card 3: Next Scheduled */}
          <div className="bg-white rounded-[26px] p-5 shadow-soft-card flex items-center justify-between border border-transparent hover:border-pink-100 transition-all">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Upcoming Dose
              </span>
              <h3 className="text-2xl font-black text-slate-800 mt-1">
                After Dinner
              </h3>
              <p className="text-xs text-pink-500 font-semibold mt-1">
                2 medicines scheduled
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#FFEAF0] text-[#FF6B8B] flex items-center justify-center">
              <Clock className="w-7 h-7" />
            </div>
          </div>
        </div>

        {/* Calendar Strip Container */}
        <div className="bg-white rounded-[28px] p-5 shadow-soft-card mb-7">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-bold text-slate-800">November 2026</h3>
            <span className="text-xs font-semibold text-teal-600 bg-teal-50 px-3 py-1 rounded-full">
              Today: Sunday, Nov 5
            </span>
          </div>
          <CalendarStrip selectedDay={selectedDay} onSelectDay={setSelectedDay} />
        </div>

        {/* Period Filter Tabs: Today / Week / Month */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-6 px-1">
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

          <span className="text-xs text-slate-400 font-medium">
            Showing {filteredMedicines.length} reminders
          </span>
        </div>

        {/* Medicines List */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
          {filteredMedicines.map((med) => (
            <div
              key={med.id}
              className={`transition-all ${
                selectedMedicine.id === med.id ? 'ring-2 ring-teal-400 rounded-[28px]' : ''
              }`}
            >
              <MedicineCard
                medicine={med}
                onClick={onSelectMedicine}
                onToggleTaken={onToggleTaken}
              />
            </div>
          ))}
        </div>
      </main>

      {/* 3. Right Sidebar Detail Pane */}
      <aside className="w-96 bg-white border-l border-slate-100 flex flex-col justify-between p-7 overflow-y-auto z-20 flex-shrink-0">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Selected Medicine
            </span>
            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to remove ${selectedMedicine.name}?`)) {
                  onRemoveMedicine(selectedMedicine.id);
                }
              }}
              className="px-4 py-1 rounded-full bg-gradient-to-r from-[#FF7E98] to-[#FF5376] text-white text-xs font-bold shadow-pill-coral hover:brightness-105 active:scale-95 transition-all"
            >
              Remove
            </button>
          </div>

          {/* 3D Hero Illustration */}
          <div className="relative flex flex-col items-center justify-center py-4 bg-gradient-to-b from-slate-50 to-transparent rounded-3xl mb-5">
            <div className="absolute w-44 h-44 bg-gradient-to-tr from-teal-100/40 via-yellow-100/30 to-pink-100/40 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 transition-transform duration-500 hover:scale-105">
              {selectedMedicine.name.toLowerCase().includes('meglitinide') ? (
                <MeglitinidesHero3D className="w-44 h-44 drop-shadow-md" />
              ) : (
                <ParacetamolHero3D className="w-44 h-44 drop-shadow-md" />
              )}
            </div>
          </div>

          {/* Title & Description */}
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {selectedMedicine.name}
          </h2>
          <p className="text-xs text-slate-400 font-normal leading-relaxed mt-2">
            {selectedMedicine.description ||
              'They bind to an ATP-dependent (KATP) channel on the cell membrane of pancreatic beta cells move manner to sulfonylureas but have a weaker affinity.'}
          </p>

          {/* Timing Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {selectedMedicine.times.map((t, idx) => {
              const lower = t.toLowerCase();
              const isBreakfast = lower.includes('breakfast');
              return (
                <span
                  key={idx}
                  className={`px-3 py-1 rounded-full text-xs font-medium tracking-wide ${
                    isBreakfast ? 'bg-[#FFF0E7] text-[#FF9E79]' : 'bg-[#EAF8F2] text-[#2BB3A0]'
                  }`}
                >
                  {t}
                </span>
              );
            })}
          </div>

          {/* 2x2 Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="bg-[#F8FAFC] rounded-2xl p-3 flex items-center gap-3 border border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-[#EAF8F2] flex items-center justify-center text-[#2BB3A0] flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-medium leading-none">
                  Amount
                </span>
                <span className="block text-xs font-bold text-slate-800 mt-1">
                  {selectedMedicine.amount}
                </span>
              </div>
            </div>

            <div className="bg-[#F8FAFC] rounded-2xl p-3 flex items-center gap-3 border border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-[#FFF4ED] flex items-center justify-center text-[#FF9E79] flex-shrink-0">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-medium leading-none">
                  This Month
                </span>
                <span className="block text-xs font-bold text-slate-800 mt-1">
                  {selectedMedicine.thisMonthProgress}
                </span>
              </div>
            </div>

            <div className="bg-[#F8FAFC] rounded-2xl p-3 flex items-center gap-3 border border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-[#FFEAF0] flex items-center justify-center text-[#FF6B8B] flex-shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-medium leading-none">
                  Cause
                </span>
                <span className="block text-xs font-bold text-slate-800 mt-1">
                  {selectedMedicine.cause}
                </span>
              </div>
            </div>

            <div className="bg-[#F8FAFC] rounded-2xl p-3 flex items-center gap-3 border border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-[#EEF3FF] flex items-center justify-center text-[#5C7CFA] flex-shrink-0">
                <Pill className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-medium leading-none">
                  Cap Size
                </span>
                <span className="block text-xs font-bold text-slate-800 mt-1">
                  {selectedMedicine.capSize}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-8 space-y-2.5">
          <button
            onClick={() => onToggleTaken(selectedMedicine.id)}
            className={`w-full py-3 rounded-full font-bold text-xs tracking-wide transition-all duration-300 flex items-center justify-center gap-2 ${
              selectedMedicine.takenToday
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {selectedMedicine.takenToday ? 'Dose Taken Today (Undo)' : 'Mark as Taken Today'}
          </button>

          <button
            onClick={() => onEditSchedule(selectedMedicine)}
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white font-bold text-sm shadow-pill-teal hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <span>Edit Schedule</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </div>
  );
};
