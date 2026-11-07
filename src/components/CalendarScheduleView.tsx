import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Plus,
  MapPin,
  Tag,
  ArrowRight
} from 'lucide-react';
import { ScheduleAgenda } from '../types';

interface CalendarScheduleViewProps {
  agendas: ScheduleAgenda[];
  onBack: () => void;
  onSelectAgenda?: (agenda: ScheduleAgenda) => void;
  onToggleComplete?: (id: string, e: React.MouseEvent) => void;
  onOpenNewAgenda?: () => void;
}

export const CalendarScheduleView: React.FC<CalendarScheduleViewProps> = ({
  agendas,
  onBack,
  onSelectAgenda,
  onToggleComplete,
  onOpenNewAgenda,
}) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [timelineTab, setTimelineTab] = useState<'selected' | 'past' | 'upcoming'>('selected');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Hitung hari pertama bulan & total hari
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  // Convert so Monday is 0: Sunday becomes 6, Monday becomes 0
  const startDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Kumpulan tanggal yang punya agenda
  const agendaDateSet = new Set(agendas.map((a) => a.date));

  // Filter agenda untuk tanggal terpilih
  const selectedDayAgendas = agendas.filter((a) => a.date === selectedDateStr);

  // Agenda Sebelum (Past) & Mendatang (Upcoming)
  const todayStr = new Date().toISOString().split('T')[0];
  const pastAgendas = agendas.filter((a) => a.date < selectedDateStr).slice(0, 5);
  const upcomingAgendas = agendas.filter((a) => a.date > selectedDateStr).slice(0, 5);

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'VISIT': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'NSO': return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'MEETING': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'AUDIT': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-purple-50 text-purple-700 border-purple-200';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F9FD] overflow-y-auto no-scrollbar px-5 sm:px-6 pt-6 pb-28 max-w-xl mx-auto w-full">
      {/* Header Section 2: Ganti title sesuaikan namanya */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-700 shadow-soft-sm active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">
            FMCU Master Schedule
          </span>
          <h2 className="text-lg font-black text-slate-800">Jadwal Agenda Kerja</h2>
        </div>
        <div className="w-10 h-10 rounded-full bg-[#EAF8F2] text-[#2BB3A0] flex items-center justify-center shadow-soft-sm">
          <CalendarIcon className="w-5 h-5" />
        </div>
      </div>

      {/* Kalender Penuh Berfungsi Penuh */}
      <div className="bg-white rounded-3xl p-5 shadow-soft-card mb-5 border border-slate-100">
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
              className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors"
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
          {/* Empty prefix cells */}
          {Array.from({ length: startDay }).map((_, i) => (
            <div key={`empty-${i}`} className="py-2" />
          ))}

          {/* Actual days in month */}
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
                className={`relative py-2.5 rounded-2xl flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#FF7E98] to-[#FF5376] text-white font-bold shadow-pill-coral scale-105 z-10'
                    : isToday
                    ? 'bg-teal-50 text-teal-800 font-bold border border-teal-200'
                    : 'text-slate-700 font-semibold hover:bg-slate-50'
                }`}
              >
                <span className="text-xs">{dayNum}</span>
                {/* Dot marker if has agenda */}
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

      {/* Tab Filter Timeline: Tanggal Terpilih / Sebelum / Sesudah */}
      <div className="flex items-center gap-2 mb-3 bg-slate-100/80 p-1 rounded-2xl">
        <button
          onClick={() => setTimelineTab('selected')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
            timelineTab === 'selected' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'
          }`}
        >
          Tanggal Ini ({selectedDayAgendas.length})
        </button>
        <button
          onClick={() => setTimelineTab('past')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
            timelineTab === 'past' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'
          }`}
        >
          Sebelum ({pastAgendas.length})
        </button>
        <button
          onClick={() => setTimelineTab('upcoming')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
            timelineTab === 'upcoming' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'
          }`}
        >
          Setelah ({upcomingAgendas.length})
        </button>
      </div>

      {/* Timeline Agenda Items List */}
      <div className="space-y-2.5">
        {timelineTab === 'selected' && (
          <>
            {selectedDayAgendas.length === 0 ? (
              <div className="bg-white rounded-3xl p-6 text-center shadow-soft-card border border-slate-100">
                <p className="text-slate-400 text-xs font-medium">
                  Tidak ada agenda kerja pada tanggal {selectedDateStr}.
                </p>
                {onOpenNewAgenda && (
                  <button
                    onClick={onOpenNewAgenda}
                    className="mt-3 px-4 py-2 rounded-full bg-[#2BB3A0] text-white text-xs font-bold shadow-pill-teal"
                  >
                    + Buat Agenda Tanggal Ini
                  </button>
                )}
              </div>
            ) : (
              selectedDayAgendas.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectAgenda && onSelectAgenda(item)}
                  className="bg-white rounded-2xl p-4 shadow-soft-card border border-slate-100 flex items-center justify-between cursor-pointer hover:border-teal-200 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex flex-col items-center justify-center text-teal-600 flex-shrink-0">
                      <span className="text-[10px] font-bold text-slate-400">{item.category}</span>
                      <span className="text-xs font-extrabold text-slate-800">{item.time}</span>
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 truncate">{item.title}</h4>
                      <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span>{item.location}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 text-slate-300">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Tab Sebelum (Past Agendas) */}
        {timelineTab === 'past' && (
          <div className="space-y-2">
            {pastAgendas.length === 0 ? (
              <div className="bg-white rounded-3xl p-5 text-center text-slate-400 text-xs">
                Tidak ada agenda sebelum tanggal ini.
              </div>
            ) : (
              pastAgendas.map((item) => (
                <div key={item.id} className="bg-white/80 rounded-2xl p-3.5 shadow-soft-sm flex items-center justify-between border border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400">{item.date} • {item.time}</span>
                    <h5 className="text-xs font-bold text-slate-700 mt-0.5">{item.title}</h5>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {item.category}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab Setelah (Upcoming Agendas) */}
        {timelineTab === 'upcoming' && (
          <div className="space-y-2">
            {upcomingAgendas.length === 0 ? (
              <div className="bg-white rounded-3xl p-5 text-center text-slate-400 text-xs">
                Tidak ada agenda setelah tanggal ini.
              </div>
            ) : (
              upcomingAgendas.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl p-3.5 shadow-soft-sm flex items-center justify-between border border-teal-50">
                  <div>
                    <span className="text-[10px] font-bold text-teal-600">{item.date} • {item.time}</span>
                    <h5 className="text-xs font-bold text-slate-800 mt-0.5">{item.title}</h5>
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                    Mendatang
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
