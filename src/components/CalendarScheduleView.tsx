import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Search,
  X,
  Users,
} from 'lucide-react';
import { ScheduleAgenda, User } from '../types';
import { DeveloperFooter } from './DeveloperFooter';
import { isSamePersonName } from '../data/masterStoresData';

interface CalendarScheduleViewProps {
  user?: User | null;
  agendas: ScheduleAgenda[];
  onBack: () => void;
  onSelectAgenda?: (agenda: ScheduleAgenda) => void;
  onToggleComplete?: (id: string, e: React.MouseEvent) => void;
  onOpenNewAgenda?: () => void;
  onOpenExcelUpload?: () => void;
}

export const CalendarScheduleView: React.FC<CalendarScheduleViewProps> = ({
  user,
  agendas,
  onBack,
  onSelectAgenda,
  onOpenNewAgenda,
}) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // Tab: 'selected' (Tanggal Ini) | 'allTeam' (Semua Tim - menggantikan Sebelum & Sesudah)
  const [timelineTab, setTimelineTab] = useState<'selected' | 'allTeam'>('selected');
  const [nameFilter, setNameFilter] = useState<string>('');
  const [selectedPersonDropdown, setSelectedPersonDropdown] = useState<string>('ALL');

  const fullName = user?.name || '';
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Hitung hari pertama bulan & total hari (Senin = 0 ... Minggu = 6)
  const firstDayIndex = new Date(year, month, 1).getDay();
  const startDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}`;
  }, []);

  // Kumpulan tanggal yang punya agenda
  const agendaDateSet = useMemo(() => new Set(agendas.map((a) => a.date)), [agendas]);

  // Daftar seluruh nama tim unik terurut A-Z untuk fitur Filter by Nama
  const allTeamNamesAZ = useMemo(() => {
    const names = Array.from(
      new Set(agendas.map((a) => (a.pic || '').trim()).filter(Boolean))
    );
    return names.sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' }));
  }, [agendas]);

  // Semua agenda pada tanggal terpilih, diurutkan A-Z berdasarkan nama tim (pic)
  const allTeamAgendasOnDate = useMemo(() => {
    return agendas
      .filter((a) => a.date === selectedDateStr)
      .sort(
        (a, b) =>
          (a.pic || '').localeCompare(b.pic || '', 'id', { sensitivity: 'base' }) ||
          (a.time || '').localeCompare(b.time || '')
      );
  }, [agendas, selectedDateStr]);

  // Agenda Tanggal Ini (milik user aktif jika bukan admin, atau semua pada tanggal ini jika user tidak memiliki jadwal spesifik)
  const mySelectedDayAgendas = useMemo(() => {
    if (!fullName || user?.isAdmin) {
      return allTeamAgendasOnDate;
    }
    const mine = allTeamAgendasOnDate.filter(
      (a) =>
        isSamePersonName(a.pic, fullName) ||
        a.pic.toLowerCase().includes(fullName.toLowerCase()) ||
        fullName.toLowerCase().includes(a.pic.toLowerCase())
    );
    return mine.length > 0 ? mine : allTeamAgendasOnDate;
  }, [allTeamAgendasOnDate, fullName, user?.isAdmin]);

  // List aktif sesuai tab ('selected' vs 'allTeam') + Filter by Nama + Urut A-Z Nama Tim
  const displayedAgendas = useMemo(() => {
    const baseList = timelineTab === 'allTeam' ? allTeamAgendasOnDate : mySelectedDayAgendas;
    const q = nameFilter.trim().toLowerCase();

    return baseList
      .filter((item) => {
        if (selectedPersonDropdown !== 'ALL') {
          if (!isSamePersonName(item.pic, selectedPersonDropdown) && item.pic !== selectedPersonDropdown) {
            return false;
          }
        }
        if (q) {
          const matchPic = (item.pic || '').toLowerCase().includes(q);
          const matchTitle = (item.title || '').toLowerCase().includes(q);
          const matchLoc = (item.location || '').toLowerCase().includes(q);
          return matchPic || matchTitle || matchLoc;
        }
        return true;
      })
      .sort(
        (a, b) =>
          (a.pic || '').localeCompare(b.pic || '', 'id', { sensitivity: 'base' }) ||
          (a.time || '').localeCompare(b.time || '')
      );
  }, [timelineTab, allTeamAgendasOnDate, mySelectedDayAgendas, nameFilter, selectedPersonDropdown]);

  return (
    <div className="flex flex-col h-full bg-[#F8F9FD] overflow-y-auto no-scrollbar px-5 sm:px-6 pt-[max(1.5rem,env(safe-area-inset-top,24px))] pb-28 max-w-xl mx-auto w-full select-none">
      {/* Header Section 2 */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full iphone-glass-icon-btn flex items-center justify-center text-black active:scale-95 transition-transform cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.4]" />
        </button>
        <div className="text-center">
          <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">
            FMCU Master Schedule
          </span>
          <h2 className="text-lg font-black text-slate-800">Jadwal Agenda Kerja</h2>
        </div>
        <div className="w-10 h-10 rounded-full iphone-glass-icon-btn text-black flex items-center justify-center">
          <CalendarIcon className="w-5 h-5 stroke-[2.2]" />
        </div>
      </div>

      {/* Kalender Bulanan */}
      <div className="bg-white rounded-3xl p-5 shadow-soft-card mb-4 border border-slate-100">
        {/* Month Selector Bar */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base">
              {monthNames[month]} {year}
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">
              Pilih tanggal untuk melihat jadwal
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevMonth}
              className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of Week Header (Senin s/d Minggu) */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((dayName, idx) => (
            <span key={idx} className="text-[11px] font-bold text-slate-400 py-1">
              {dayName}
            </span>
          ))}
        </div>

        {/* Calendar Dates Grid */}
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {Array.from({ length: startDay }).map((_, i) => (
            <div key={`empty-${i}`} className="py-2" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dayMonthStr = String(month + 1).padStart(2, '0');
            const dayNumStr = String(dayNum).padStart(2, '0');
            const dateStr = `${year}-${dayMonthStr}-${dayNumStr}`;

            const isSelected = dateStr === selectedDateStr;
            const hasAgenda = agendaDateSet.has(dateStr);
            const isToday = dateStr === todayStr;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDateStr(dateStr)}
                className={`relative py-2.5 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#FF7E98] to-[#FF5376] text-white font-bold shadow-pill-coral scale-105 z-10'
                    : isToday
                    ? 'bg-teal-50 text-teal-800 font-bold border border-teal-200'
                    : 'text-slate-700 font-semibold hover:bg-slate-50'
                }`}
              >
                <span className="text-xs">{dayNum}</span>
                {hasAgenda && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                      isSelected ? 'bg-white' : 'bg-[#2BB3A0]'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Filter: Tanggal Ini & Semua Tim (Tombol Sebelum & Sesudah Dihapuskan) */}
      <div className="flex items-center gap-2 mb-2.5 bg-slate-100/80 p-1 rounded-2xl">
        <button
          type="button"
          onClick={() => setTimelineTab('selected')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            timelineTab === 'selected' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'
          }`}
        >
          Tanggal Ini ({mySelectedDayAgendas.length})
        </button>
        <button
          type="button"
          onClick={() => setTimelineTab('allTeam')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            timelineTab === 'allTeam' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'
          }`}
        >
          Semua Tim ({allTeamAgendasOnDate.length})
        </button>
      </div>

      {/* Fitur Filter by Nama (Minimalist Search + Pilihan Nama A-Z) */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Filter nama tim atau agenda..."
            className="w-full bg-white/90 border border-slate-200/80 rounded-xl pl-8 pr-7 py-1.5 text-[11px] font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-teal-500 transition-all"
          />
          {nameFilter && (
            <button
              type="button"
              onClick={() => setNameFilter('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="relative shrink-0">
          <Users className="w-3.5 h-3.5 text-teal-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={selectedPersonDropdown}
            onChange={(e) => setSelectedPersonDropdown(e.target.value)}
            className="bg-white/90 border border-slate-200/80 rounded-xl pl-7 pr-6 py-1.5 text-[11px] font-bold text-slate-700 outline-none focus:border-teal-500 cursor-pointer max-w-[145px] truncate"
            title="Filter berdasarkan Nama Tim (A-Z)"
          >
            <option value="ALL">Semua Nama (A-Z)</option>
            {allTeamNamesAZ.map((personName) => (
              <option key={personName} value={personName}>
                {personName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Minimalist Text List (Nama Kecil Bold, Di Bawahnya Agendanya Thin Kecil - Bukan Card) */}
      <div className="px-1">
        {displayedAgendas.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-slate-400 text-[11px] font-light">
              Tidak ada jadwal yang cocok pada tanggal {selectedDateStr}.
            </p>
            {onOpenNewAgenda && (
              <button
                type="button"
                onClick={onOpenNewAgenda}
                className="mt-2.5 px-3.5 py-1.5 rounded-full bg-[#2BB3A0] text-white text-[11px] font-bold shadow-xs cursor-pointer"
              >
                + Buat Agenda Tanggal Ini
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-200/60">
            {displayedAgendas.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectAgenda && onSelectAgenda(item)}
                className="w-full text-left py-2 px-1 hover:bg-slate-100/60 active:bg-slate-100 transition-colors flex items-start justify-between gap-2 cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  {/* Nama Kecil Bold */}
                  <p className="text-[11px] font-bold text-slate-900 leading-tight truncate">
                    {item.pic}
                  </p>
                  {/* Di Bawahnya Agendanya Thin Kecil */}
                  <p className="text-[11px] font-light text-slate-600 leading-snug mt-0.5 truncate">
                    {item.title}
                    {item.location &&
                    item.location !== 'OFF / LIBUR' &&
                    !item.title.toLowerCase().includes(item.location.toLowerCase())
                      ? ` — ${item.location}`
                      : ''}
                  </p>
                </div>

                <span className="text-[9px] font-light text-slate-400 shrink-0 tabular-nums pt-0.5">
                  {item.category === 'OFF' ? 'OFF' : item.time}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Minimalist Page Footer */}
      <DeveloperFooter />
    </div>
  );
};
