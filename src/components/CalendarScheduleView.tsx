import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Search,
  X,
  Users,
  Tag,
} from 'lucide-react';
import { ScheduleAgenda, User, SCHEDULE_CATEGORY_OPTIONS } from '../types';
import { DeveloperFooter } from './DeveloperFooter';
import { isSamePersonName } from '../data/masterStoresData';
import { getMondayOfWeek } from '../services/scheduleExcelService';

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

  // Tab: 'selected' (Tanggal Ini) | 'allTeam' (Semua Tim) | 'fullWeek' (1 Minggu Penuh)
  const [timelineTab, setTimelineTab] = useState<'selected' | 'allTeam' | 'fullWeek'>('selected');
  const [nameFilter, setNameFilter] = useState<string>('');
  const [selectedPersonDropdown, setSelectedPersonDropdown] = useState<string>('ALL');
  const [selectedCategoryDropdown, setSelectedCategoryDropdown] = useState<string>('ALL');

  const fullName = user?.name || '';
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const shortMonthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  const shortDayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const formatShortDayDate = (dateYmd: string) => {
    const dt = new Date(dateYmd + 'T00:00:00');
    if (isNaN(dt.getTime())) return dateYmd;
    const dayLabel = shortDayNames[dt.getDay()];
    const dd = String(dt.getDate()).padStart(2, '0');
    const mon = shortMonthNames[dt.getMonth()];
    return `${dayLabel}, ${dd} ${mon}`;
  };

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

  // Rentang 1 Minggu Penuh (Senin s/d Minggu) berdasarkan tanggal yang dipilih
  // Jika tanggal terpilih berada di hari Minggu & minggu kalender berjalan kosong, otomatis gunakan minggu aktif berikutnya
  const { weekStartStr, weekEndStr } = useMemo(() => {
    const toYmd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;

    const selDate = new Date(selectedDateStr + 'T00:00:00');
    const day = selDate.getDay(); // 0 = Min, 1 = Sen, ...
    const diffToMon = day === 0 ? -6 : 1 - day;
    const calMon = new Date(selDate);
    calMon.setDate(selDate.getDate() + diffToMon);
    const calSun = new Date(calMon);
    calSun.setDate(calMon.getDate() + 6);

    const calStart = toYmd(calMon);
    const calEnd = toYmd(calSun);

    const hasInCalWeek = agendas.some((a) => a.date >= calStart && a.date <= calEnd);
    if (hasInCalWeek) {
      return { weekStartStr: calStart, weekEndStr: calEnd };
    }

    // Fallback ke aturan minggu berjalan (getMondayOfWeek)
    const fallbackMonStr = getMondayOfWeek(selectedDateStr);
    const fbMon = new Date(fallbackMonStr + 'T00:00:00');
    const fbSun = new Date(fbMon);
    fbSun.setDate(fbMon.getDate() + 6);
    const fbEnd = toYmd(fbSun);

    const hasInFbWeek = agendas.some((a) => a.date >= fallbackMonStr && a.date <= fbEnd);
    if (hasInFbWeek) {
      return { weekStartStr: fallbackMonStr, weekEndStr: fbEnd };
    }

    return { weekStartStr: calStart, weekEndStr: calEnd };
  }, [selectedDateStr, agendas]);

  // Semua agenda dalam 1 Minggu Penuh (Senin s/d Minggu)
  const fullWeekAgendas = useMemo(() => {
    return agendas
      .filter((a) => a.date >= weekStartStr && a.date <= weekEndStr)
      .sort(
        (a, b) =>
          (a.pic || '').localeCompare(b.pic || '', 'id', { sensitivity: 'base' }) ||
          (a.date || '').localeCompare(b.date || '') ||
          (a.time || '').localeCompare(b.time || '')
      );
  }, [agendas, weekStartStr, weekEndStr]);

  // List aktif sesuai tab ('selected' | 'allTeam' | 'fullWeek') + Filter by Nama + Urut A-Z Nama Tim
  const displayedAgendas = useMemo(() => {
    const baseList =
      timelineTab === 'fullWeek'
        ? fullWeekAgendas
        : timelineTab === 'allTeam'
        ? allTeamAgendasOnDate
        : mySelectedDayAgendas;
    const q = nameFilter.trim().toLowerCase();

    return baseList
      .filter((item) => {
        if (selectedPersonDropdown !== 'ALL') {
          if (!isSamePersonName(item.pic, selectedPersonDropdown) && item.pic !== selectedPersonDropdown) {
            return false;
          }
        }
        if (selectedCategoryDropdown !== 'ALL') {
          if (item.category !== selectedCategoryDropdown) {
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
          (a.date || '').localeCompare(b.date || '') ||
          (a.time || '').localeCompare(b.time || '')
      );
  }, [timelineTab, fullWeekAgendas, allTeamAgendasOnDate, mySelectedDayAgendas, nameFilter, selectedPersonDropdown, selectedCategoryDropdown]);

  // Pengelompokan per Nama Tim (A-Z) khusus untuk tampilan 1 Minggu Penuh:
  // Visual Nama di atas, lalu di bawahnya semua agendanya dalam 1 minggu berurutan sampai bawah
  const groupedFullWeekByPerson = useMemo(() => {
    const groupsMap = new Map<string, ScheduleAgenda[]>();
    for (const item of displayedAgendas) {
      const picName = (item.pic || 'Tanpa Nama').trim();
      if (!groupsMap.has(picName)) {
        groupsMap.set(picName, []);
      }
      groupsMap.get(picName)!.push(item);
    }

    return Array.from(groupsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'id', { sensitivity: 'base' }))
      .map(([picName, items]) => ({
        picName,
        items: items.sort(
          (x, y) =>
            (x.date || '').localeCompare(y.date || '') ||
            (x.time || '').localeCompare(y.time || '')
        ),
      }));
  }, [displayedAgendas]);

  return (
    <div className="flex flex-col h-full bg-[#F8F9FD] overflow-y-auto no-scrollbar px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-28 max-w-7xl mx-auto w-full select-none">
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
          <h2 className="text-lg lg:text-xl font-black text-slate-800">Jadwal Agenda Kerja</h2>
        </div>
        <div className="w-10 h-10 rounded-full iphone-glass-icon-btn text-black flex items-center justify-center">
          <CalendarIcon className="w-5 h-5 stroke-[2.2]" />
        </div>
      </div>

      {/* Responsive Content Grid: Mobile (1 Col Stack) vs Desktop (2 Col Expansive) */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: Monthly Calendar Card */}
        <div className="w-full lg:w-[380px] xl:w-[420px] lg:shrink-0">
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
            const isInActiveFullWeek =
              timelineTab === 'fullWeek' && dateStr >= weekStartStr && dateStr <= weekEndStr;
            const hasAgenda = agendaDateSet.has(dateStr);
            const isToday = dateStr === todayStr;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDateStr(dateStr)}
                className={`relative py-2.5 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#FF7E98] to-[#FF5376] text-white font-bold shadow-pill-coral scale-105 z-10'
                    : isInActiveFullWeek
                    ? 'bg-teal-50/90 text-teal-900 font-bold border border-teal-200/80'
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
    </div>

    {/* Right Column: Timeline & Agenda List Card */}
    <div className="w-full lg:flex-1 min-w-0 bg-white rounded-3xl p-4 sm:p-5 shadow-soft-card border border-slate-100">
      {/* Tab Filter: Tanggal Ini, Semua Tim, & 1 Minggu Penuh */}
      <div className="flex items-center gap-1.5 mb-2.5 bg-slate-100/80 p-1 rounded-2xl">
        <button
          type="button"
          onClick={() => setTimelineTab('selected')}
          className={`flex-1 py-1.5 px-1 text-[11px] font-bold rounded-xl transition-all cursor-pointer truncate ${
            timelineTab === 'selected' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'
          }`}
        >
          Tanggal Ini ({mySelectedDayAgendas.length})
        </button>
        <button
          type="button"
          onClick={() => setTimelineTab('allTeam')}
          className={`flex-1 py-1.5 px-1 text-[11px] font-bold rounded-xl transition-all cursor-pointer truncate ${
            timelineTab === 'allTeam' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'
          }`}
        >
          Semua Tim ({allTeamAgendasOnDate.length})
        </button>
        <button
          type="button"
          onClick={() => setTimelineTab('fullWeek')}
          className={`flex-1 py-1.5 px-1 text-[11px] font-bold rounded-xl transition-all cursor-pointer truncate ${
            timelineTab === 'fullWeek' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'
          }`}
        >
          1 Minggu ({fullWeekAgendas.length})
        </button>
      </div>

      {/* Info rentang tanggal saat tab 1 Minggu Penuh aktif */}
      {timelineTab === 'fullWeek' && (
        <div className="flex items-center justify-between px-1.5 mb-2">
          <span className="text-[10px] font-bold text-teal-700">
            Jadwal 1 Minggu Penuh: {formatShortDayDate(weekStartStr)} – {formatShortDayDate(weekEndStr)}
          </span>
          <span className="text-[10px] font-light text-slate-500">
            {groupedFullWeekByPerson.length} personel
          </span>
        </div>
      )}

      {/* Fitur Filter (Search + Dropdown Kategori Sejajar + Dropdown Nama Tim) */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Cari agenda atau nama..."
            className="w-full bg-white/95 border border-slate-200/90 rounded-xl pl-8 pr-7 py-1.5 text-[11px] font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-teal-500 shadow-2xs transition-all"
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

        {/* Filter Kategori (Sejajar dengan Textbox Search) */}
        <div className="relative shrink-0 max-w-[130px] sm:max-w-[145px]">
          <Tag className="w-3 h-3 text-teal-600 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={selectedCategoryDropdown}
            onChange={(e) => setSelectedCategoryDropdown(e.target.value)}
            className="w-full bg-white/95 border border-slate-200/90 rounded-xl pl-6 pr-5 py-1.5 text-[10.5px] font-bold text-slate-700 outline-none focus:border-teal-500 cursor-pointer truncate shadow-2xs"
            title="Filter berdasarkan Kategori Agenda"
          >
            <option value="ALL" className="text-[10.5px] font-semibold text-slate-800 py-1">Semua Kategori</option>
            {SCHEDULE_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="text-[10.5px] font-medium text-slate-800 py-1">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Nama Tim */}
        <div className="relative shrink-0 max-w-[115px] sm:max-w-[130px]">
          <Users className="w-3 h-3 text-teal-600 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={selectedPersonDropdown}
            onChange={(e) => setSelectedPersonDropdown(e.target.value)}
            className="w-full bg-white/95 border border-slate-200/90 rounded-xl pl-6 pr-5 py-1.5 text-[10.5px] font-bold text-slate-700 outline-none focus:border-teal-500 cursor-pointer truncate shadow-2xs"
            title="Filter berdasarkan Nama Tim (A-Z)"
          >
            <option value="ALL" className="text-[10.5px] font-semibold text-slate-800 py-1">Semua Nama</option>
            {allTeamNamesAZ.map((personName) => (
              <option key={personName} value={personName} className="text-[10.5px] font-medium text-slate-800 py-1">
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
              {timelineTab === 'fullWeek'
                ? `Tidak ada jadwal yang cocok pada minggu ${formatShortDayDate(weekStartStr)} – ${formatShortDayDate(weekEndStr)}.`
                : `Tidak ada jadwal yang cocok pada tanggal ${selectedDateStr}.`}
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
        ) : timelineTab === 'fullWeek' ? (
          /* Tampilan 1 Minggu Penuh: Visual Nama Kecil Bold, lalu dilanjut di bawahnya semua agendanya dalam 1 minggu sampai bawah */
          <div className="divide-y divide-slate-200/70">
            {groupedFullWeekByPerson.map((group) => (
              <div key={group.picName} className="py-2.5 px-1">
                {/* Visual Nama Kecil Bold */}
                <p className="text-[11px] font-bold text-slate-900 leading-tight mb-1">
                  {group.picName}
                </p>

                {/* Di bawahnya semua agendanya dalam satu minggu penuh */}
                <div className="space-y-0.5 pl-2 border-l border-slate-200/80">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectAgenda && onSelectAgenda(item)}
                      className="w-full text-left py-1 px-1.5 rounded-lg hover:bg-slate-100/70 active:bg-slate-100 transition-colors flex items-start justify-between gap-2 cursor-pointer"
                    >
                      <p className="text-[11px] font-light text-slate-600 leading-snug min-w-0 flex-1">
                        <span className="font-normal text-slate-500">
                          {formatShortDayDate(item.date)} •{' '}
                        </span>
                        <span>
                          {item.title}
                          {item.location &&
                          item.location !== 'OFF / LIBUR' &&
                          !item.title.toLowerCase().includes(item.location.toLowerCase())
                            ? ` — ${item.location}`
                            : ''}
                        </span>
                      </p>

                      <span className="text-[9px] font-light text-slate-400 shrink-0 tabular-nums pt-0.5">
                        {item.category === 'OFF' ? 'OFF' : item.time}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
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
    </div>
  </div>

      {/* Minimalist Page Footer */}
      <DeveloperFooter />
    </div>
  );
};
