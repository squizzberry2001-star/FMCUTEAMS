import React, { useState } from 'react';
import {
  Bell,
  Search,
  Plus,
  LayoutGrid,
  Calendar as CalendarIcon,
  Store,
  Building2,
  CheckCircle2,
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  FileSpreadsheet,
  TrendingUp,
  Clock,
  Sparkles,
  ClipboardList,
  MapPin,
  Camera,
  User as UserIcon,
  Shield,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { ScheduleAgenda, User } from '../types';
import { CalendarStrip, CalendarFocusTrigger } from './CalendarStrip';
import { DeveloperFooter } from './DeveloperFooter';
import { ScheduleCard } from './ScheduleCard';
import { isSamePersonName } from '../data/masterStoresData';
import {
  getMondayOfWeek,
  getFullWeekDays,
  formatWeekRangeDisplay,
} from '../services/scheduleExcelService';

interface DesktopDashboardProps {
  user: User;
  agendas: ScheduleAgenda[];
  selectedAgenda?: ScheduleAgenda | null;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onSelectAgenda: (agenda: ScheduleAgenda) => void;
  onOpenNewAgenda: () => void;
  onOpenExcelUpload?: () => void;
  onOpenLiveMaps?: () => void;
  onOpenVisitForm?: (agenda: ScheduleAgenda) => void;
  onToggleComplete?: (id: string, e?: React.MouseEvent) => void;
  onLogout: () => void;
  onOpenAdminPortal?: () => void;
}

export const DesktopDashboard: React.FC<DesktopDashboardProps> = ({
  user,
  agendas,
  selectedAgenda,
  selectedDate,
  onSelectDate,
  onSelectAgenda,
  onOpenNewAgenda,
  onOpenExcelUpload,
  onOpenLiveMaps,
  onOpenVisitForm,
  onLogout,
  onOpenAdminPortal,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'Today' | 'Week' | 'AllTeam'>('Today');
  const [calendarFocus, setCalendarFocus] = useState<CalendarFocusTrigger>({
    mode: 'today',
    ts: Date.now(),
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenu, setActiveMenu] = useState('dashboard');

  // Waktu sapaan berdasarkan jam aktual (Pagi, Siang, Sore, Malam)
  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 11) return 'Pagi';
    if (hour >= 11 && hour < 15) return 'Siang';
    if (hour >= 15 && hour < 18) return 'Sore';
    return 'Malam';
  };

  const fullName = user.name || 'Sarah Jenkins';

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const now = new Date();
  const currentMonthYear = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  // Reference Monday for active week view (Default: Monday of running week)
  const [currentWeekMonday, setCurrentWeekMonday] = useState<string>(() => getMondayOfWeek());

  const handlePrevWeek = () => {
    const dt = new Date(currentWeekMonday + 'T12:00:00');
    dt.setDate(dt.getDate() - 7);
    const prevMon = getMondayOfWeek(dt.toISOString().split('T')[0]);
    setCurrentWeekMonday(prevMon);
    onSelectDate(prevMon);
  };

  const handleNextWeek = () => {
    const dt = new Date(currentWeekMonday + 'T12:00:00');
    dt.setDate(dt.getDate() + 7);
    const nextMon = getMondayOfWeek(dt.toISOString().split('T')[0]);
    setCurrentWeekMonday(nextMon);
    onSelectDate(nextMon);
  };

  const activeWeekDays = getFullWeekDays(currentWeekMonday);
  const weekStartStr = activeWeekDays[0]?.dateStr || currentWeekMonday;
  const weekEndStr = activeWeekDays[activeWeekDays.length - 1]?.dateStr || currentWeekMonday;
  const isCurrentRunningWeek = currentWeekMonday === getMondayOfWeek();

  const getTodayYmd = () => {
    const dt = new Date();
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
      dt.getDate()
    ).padStart(2, '0')}`;
  };

  const handleSelectPeriodTab = (period: 'Today' | 'Week' | 'AllTeam') => {
    setSelectedPeriod(period);
    const todayStr = getTodayYmd();
    if (period === 'Today') {
      onSelectDate(todayStr);
      setCalendarFocus({ mode: 'today', ts: Date.now() });
    } else if (period === 'Week') {
      setCalendarFocus({ mode: 'week', ts: Date.now() });
    }
  };

  const filteredAgendas = agendas.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.pic.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    const isMyAgenda =
      !item.pic ||
      isSamePersonName(item.pic, fullName) ||
      item.pic.toLowerCase().includes(fullName.toLowerCase());

    if (selectedPeriod === 'Today') {
      return isMyAgenda && item.date === selectedDate;
    }
    if (selectedPeriod === 'Week') {
      return isMyAgenda && item.date >= weekStartStr && item.date <= weekEndStr;
    }
    // 'AllTeam'
    return item.date === selectedDate;
  });

  const completedCount = agendas.filter((a) => a.completed).length;
  const totalCount = agendas.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="flex h-screen w-full bg-[#F8F9FD] overflow-hidden">
      {/* 1. Left Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-slate-100 flex flex-col justify-between p-6 z-20 flex-shrink-0">
        <div>
          {/* Logo & App Brand */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#32C2AD] to-[#20A894] flex items-center justify-center text-white shadow-pill-teal font-extrabold text-sm">
              F
            </div>
            <div>
              <span className="text-[10px] font-bold text-teal-600 tracking-wider uppercase block">
                FMCU TEAMS
              </span>
              <h2 className="text-base font-extrabold text-slate-800 leading-tight">
                Operations Portal
              </h2>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="space-y-1.5">
            {[
              { id: 'dashboard', label: 'Daily Schedule', icon: LayoutGrid },
              { id: 'schedule', label: 'Master Kalender', icon: CalendarIcon },
              { id: 'coverage', label: 'Coverage Store', icon: Store },
              { id: 'history', label: 'History Aktivitas', icon: ClipboardList },
              { id: 'settings', label: 'Pengaturan', icon: Settings },
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

            {/* Admin Return Shortcut */}
            {user.isAdmin && onOpenAdminPortal && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenAdminPortal}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-sm hover:brightness-105 active:scale-95 transition-all text-xs font-bold"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span>Portal Admin FMCU</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </nav>

          {/* Coverage Summary Box */}
          <div className="mt-8 bg-gradient-to-br from-slate-50 via-teal-50/40 to-slate-50 rounded-2xl p-4 border border-teal-100/60">
            <div className="flex items-center justify-between text-teal-700 font-bold text-xs mb-1">
              <span className="flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" />
                <span>Coverage Store</span>
              </span>
              <span className="text-xs font-black">94.8%</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              28 dari 30 toko telah selesai dikunjungi bulan ini.
            </p>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-400 to-teal-600 h-2 rounded-full transition-all duration-500 w-[94.8%]"
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

      {/* 2. Main Middle Area: Header, Stats, Calendar, Schedule List */}
      <main className="flex-1 overflow-y-auto px-8 py-7">
        {/* Section 1 Item 1: Top Header Revamp (Your Daily Schedule + Greeting) */}
        <div className="flex items-center justify-between gap-4 mb-7">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Your Weekly Schedule
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Selamat {getTimeGreeting()}, {fullName}! 👋
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari agenda atau lokasi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white border border-slate-200/80 rounded-full pl-10 pr-4 py-2 text-xs font-medium text-slate-800 outline-none focus:border-teal-500 w-60 transition-all"
              />
            </div>

            {/* Live Maps Button */}
            {onOpenLiveMaps && (
              <button
                type="button"
                onClick={onOpenLiveMaps}
                className="w-10 h-10 rounded-full bg-[#EAF8F2] flex items-center justify-center text-teal-700 shadow-soft-sm hover:scale-105 active:scale-95 transition-all relative cursor-pointer"
                title="Buka Live Maps Pinpoint & Rute Toko"
              >
                <MapPin className="w-5 h-5" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-2 right-2 border-2 border-white ring-2 ring-[#EAF8F2]" />
              </button>
            )}

            {/* Notification Bell */}
            <button
              onClick={() => alert(`Notifikasi: Ada ${filteredAgendas.length} agenda terjadwal.`)}
              className="w-10 h-10 rounded-full bg-[#EAF8F2] flex items-center justify-center text-[#2BB3A0] shadow-soft-sm hover:scale-105 active:scale-95 transition-all relative"
            >
              <Bell className="w-5 h-5" />
              <span className="w-2 h-2 rounded-full bg-[#2BB3A0] absolute top-2 right-2 border-2 border-white ring-2 ring-[#EAF8F2]" />
            </button>

            {/* Action Buttons: Upload Schedule by Excel (Admin Only) & Create New Schedule */}
            <div className="flex items-center gap-2">
              {user?.isAdmin && onOpenExcelUpload && (
                <button
                  type="button"
                  onClick={onOpenExcelUpload}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white hover:bg-slate-50 text-teal-700 border border-teal-300/80 text-xs font-black shadow-soft-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  title="Upload Schedule by Excel (Auto Extract)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Upload Jadwal (Excel)</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenNewAgenda}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white text-xs font-bold shadow-pill-teal hover:brightness-105 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Buat Schedule</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Top Summary Stat Cards */}
        <div className="grid grid-cols-3 gap-5 mb-7">
          {/* Card 1: Coverage Store */}
          <div className="bg-white rounded-[26px] p-5 shadow-soft-card flex items-center justify-between border border-transparent hover:border-teal-100 transition-all">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Coverage Store
              </span>
              <h3 className="text-2xl font-black text-slate-800 mt-1">
                94.8% Toko
              </h3>
              <p className="text-xs text-teal-600 font-semibold mt-1">
                28 dari 30 target cabang
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#EAF8F2] text-[#2BB3A0] flex items-center justify-center">
              <Store className="w-7 h-7" />
            </div>
          </div>

          {/* Card 2: Total Agenda Hari Ini */}
          <div className="bg-white rounded-[26px] p-5 shadow-soft-card flex items-center justify-between border border-transparent hover:border-orange-100 transition-all">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Agenda Terjadwal
              </span>
              <h3 className="text-2xl font-black text-slate-800 mt-1">
                {agendas.length} Kegiatan
              </h3>
              <p className="text-xs text-orange-500 font-semibold mt-1">
                {completedCount} kegiatan selesai
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#FFF4ED] text-[#FF9E79] flex items-center justify-center">
              <CalendarIcon className="w-7 h-7" />
            </div>
          </div>

          {/* Card 3: Upcoming Next */}
          <div className="bg-white rounded-[26px] p-5 shadow-soft-card flex items-center justify-between border border-transparent hover:border-pink-100 transition-all">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Kegiatan Berikutnya
              </span>
              <h3 className="text-2xl font-black text-slate-800 mt-1">
                13:30 WIB
              </h3>
              <p className="text-xs text-pink-500 font-semibold mt-1">
                NSO Walkthrough Bandung Timur
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#FFEAF0] text-[#FF6B8B] flex items-center justify-center">
              <Clock className="w-7 h-7" />
            </div>
          </div>
        </div>

        {/* Section 1 Item 2: Horizontal Calendar Strip */}
        <div className="bg-white rounded-[28px] p-5 shadow-soft-card mb-7">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-bold text-slate-800">Kalender Mingguan</h3>
            <span className="text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200/80 flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-teal-600" />
              <span>{currentMonthYear}</span>
            </span>
          </div>
          <CalendarStrip
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            baseDate={currentWeekMonday}
            focusTrigger={calendarFocus}
          />
        </div>

        {/* Period Filter Tabs (Hari Ini, Minggu Ini, Semua Tim) */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-6 px-1">
            {(['Today', 'Week', 'AllTeam'] as const).map((period) => {
              const isActive = selectedPeriod === period;
              return (
                <button
                  key={period}
                  type="button"
                  onClick={() => handleSelectPeriodTab(period)}
                  className="relative pb-1.5 transition-colors cursor-pointer"
                >
                  <span
                    className={`text-sm font-bold transition-colors ${
                      isActive ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {period === 'Today' ? 'Hari Ini' : period === 'Week' ? 'Minggu Ini' : 'Semua Tim'}
                  </span>
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#4E80EE] rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Sub Section "Semua Agenda" Week Navigator Controls (Tombol Kiri-Kanan) */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 shadow-xs">
              <button
                type="button"
                onClick={handlePrevWeek}
                className="w-7 h-7 rounded-xl bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center transition shadow-xs cursor-pointer active:scale-95"
                title="Lihat Minggu Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-2 text-xs font-black text-slate-800 flex items-center gap-1.5">
                <span>{formatWeekRangeDisplay(currentWeekMonday)}</span>
                {isCurrentRunningWeek && (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                    Minggu Berjalan
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleNextWeek}
                className="w-7 h-7 rounded-xl bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center transition shadow-xs cursor-pointer active:scale-95"
                title="Lihat Minggu Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
              {filteredAgendas.length} agenda
            </span>
          </div>
        </div>

        {/* Section 1 Item 3: List Schedule Agenda Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
          {filteredAgendas.length === 0 ? (
            <div className="col-span-full py-10 text-center bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-card">
              <p className="text-slate-400 text-xs font-medium">
                Belum ada schedule agenda untuk {selectedPeriod === 'Today' ? `tanggal ${selectedDate}` : `minggu ${formatWeekRangeDisplay(currentWeekMonday)}`}.
              </p>
              <div className="mt-3 flex items-center justify-center gap-2.5">
                {user?.isAdmin && onOpenExcelUpload && (
                  <button
                    type="button"
                    onClick={onOpenExcelUpload}
                    className="px-4 py-2.5 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Upload Jadwal (Excel)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenNewAgenda}
                  className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white text-xs font-bold shadow-pill-teal cursor-pointer"
                >
                  + Buat Schedule Sekarang
                </button>
              </div>
            </div>
          ) : (
            filteredAgendas.map((agenda) => (
              <div
                key={agenda.id}
                className={`transition-all ${
                  selectedAgenda?.id === agenda.id ? 'ring-2 ring-teal-400 rounded-[28px]' : ''
                }`}
              >
                <ScheduleCard
                  agenda={agenda}
                  onClick={onSelectAgenda}
                />
              </div>
            ))
          )}
        </div>
      </main>

      {/* 3. Right Sidebar Inspector Pane */}
      <aside className="w-96 bg-white border-l border-slate-100 flex flex-col justify-between p-7 overflow-y-auto z-20 flex-shrink-0">
        {selectedAgenda ? (
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Detail Agenda Terpilih
              </span>
              <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                {selectedAgenda.category}
              </span>
            </div>

            {/* Title & Description */}
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {selectedAgenda.title}
            </h2>

            <p className="text-xs text-slate-400 font-normal leading-relaxed mt-2">
              {selectedAgenda.description || 'Tidak ada catatan tambahan untuk agenda ini.'}
            </p>

            {/* Details Badges */}
            <div className="space-y-2 mt-5">
              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F8FAFC] border border-slate-100">
                <Clock className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <div className="text-xs font-bold text-slate-700">
                  {selectedAgenda.date} • {selectedAgenda.time} WIB
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F8FAFC] border border-slate-100">
                <MapPin className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <div className="text-xs font-bold text-slate-700 truncate">
                  {selectedAgenda.location}
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#F8FAFC] border border-slate-100">
                <UserIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="text-xs font-bold text-slate-700">
                  PIC: {selectedAgenda.pic}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap items-center gap-2 mt-5">
              {selectedAgenda.tags.map((t, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-full text-xs font-medium tracking-wide bg-teal-50 text-teal-700 border border-teal-100"
                >
                  {t}
                </span>
              ))}
            </div>

            {/* Khusus Agenda Visit Button (Hanya jika milik user) */}
            {selectedAgenda.category === 'VISIT' && (
              Boolean(user.isAdmin) || isSamePersonName(selectedAgenda.pic, user.name) ? (
                <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-teal-200">
                  <span className="text-[10px] font-black text-teal-800 uppercase tracking-wider block mb-1">
                    Agenda Visit Anda
                  </span>
                  <p className="text-xs text-slate-600 mb-3">
                    Buka formulir inspeksi toko, input QSC FamiTrack, data crew, observasi, dan bukti foto.
                  </p>
                  <button
                    onClick={() => onOpenVisitForm && onOpenVisitForm(selectedAgenda)}
                    className="w-full py-2.5 rounded-xl bg-[#00A389] text-white text-xs font-extrabold shadow-pill-teal hover:brightness-105 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Buka Form Visit Report</span>
                  </button>
                </div>
              ) : (
                <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-slate-400 shrink-0" />
                  <p className="text-xs font-bold text-slate-600">
                    Form visit ini ditugaskan kepada <span className="text-teal-700">{selectedAgenda.pic}</span>. Tombol buka form hanya tersedia untuk akun yang bersangkutan.
                  </p>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">Detail Agenda</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
              Pilih salah satu agenda di daftar untuk melihat detail informasi operasional.
            </p>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="mt-8 space-y-2.5">
          <button
            onClick={onOpenNewAgenda}
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white font-bold text-sm shadow-pill-teal hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <span>+ Buat Agenda Baru (Admin)</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          <DeveloperFooter className="pt-4 pb-1 text-center" />
        </div>
      </aside>
    </div>
  );
};
