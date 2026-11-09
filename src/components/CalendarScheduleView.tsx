import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Search,
  X,
  Users,
  Tag,
  Share2,
  Download,
  Plus,
  FileSpreadsheet,
  Edit3,
  Trash2,
  Lock,
  Shield,
  MapPin,
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
  onToggleComplete?: (id: string, e?: React.MouseEvent) => void;
  onOpenNewAgenda?: () => void;
  onOpenExcelUpload?: () => void;
  onEditAgenda?: (agenda: ScheduleAgenda) => void;
  onDeleteAgenda?: (id: string) => void;
  onExportExcel?: (selectedPerson?: string) => void;
  initialDate?: string;
  initialPersonFilter?: string;
  isReadOnly?: boolean;
}

export const CalendarScheduleView: React.FC<CalendarScheduleViewProps> = ({
  user,
  agendas,
  onBack,
  onSelectAgenda,
  onToggleComplete,
  onOpenNewAgenda,
  onOpenExcelUpload,
  onEditAgenda,
  onDeleteAgenda,
  onExportExcel,
  initialDate,
  initialPersonFilter,
  isReadOnly = false,
}) => {
  const [currentDate, setCurrentDate] = useState(() => (initialDate ? new Date(initialDate + 'T00:00:00') : new Date()));
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    if (initialDate) return initialDate;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // Tab: 'selected' (Tanggal Ini) | 'allTeam' (Semua Tim) | 'fullWeek' (1 Minggu Penuh)
  const [timelineTab, setTimelineTab] = useState<'selected' | 'allTeam' | 'fullWeek'>('selected');
  const [nameFilter, setNameFilter] = useState<string>('');
  const [selectedPersonDropdown, setSelectedPersonDropdown] = useState<string>(
    initialPersonFilter || 'ALL'
  );
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

  // Agenda Tanggal Ini (milik user aktif jika bukan admin/executive, atau semua pada tanggal ini jika admin/executive)
  const mySelectedDayAgendas = useMemo(() => {
    if (!fullName || user?.isAdmin || isReadOnly) {
      return allTeamAgendasOnDate;
    }
    const mine = allTeamAgendasOnDate.filter(
      (a) =>
        isSamePersonName(a.pic, fullName) ||
        a.pic.toLowerCase().includes(fullName.toLowerCase()) ||
        fullName.toLowerCase().includes(a.pic.toLowerCase())
    );
    return mine.length > 0 ? mine : allTeamAgendasOnDate;
  }, [allTeamAgendasOnDate, fullName, user?.isAdmin, isReadOnly]);

  // Rentang 1 Minggu Penuh (Senin s/d Minggu) berdasarkan tanggal yang dipilih
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

  // Pengelompokan per Nama Tim (A-Z) khusus untuk tampilan 1 Minggu Penuh
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

  // WhatsApp Broadcast Handlers
  const handleBroadcastAgendaWhatsApp = (agenda: ScheduleAgenda, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://fmcu-teams.web.app';
    const storeInfo = agenda.storeCode ? `[${agenda.storeCode}] ${agenda.location}` : agenda.location || '-';
    const msg = [
      `📢 *JADWAL PENUGASAN FMCU*`,
      `👤 *Personel:* ${agenda.pic || '-'}`,
      `📅 *Hari/Tanggal:* ${agenda.date}`,
      `⏰ *Waktu:* ${agenda.time || '08:30'}${agenda.endTime ? ` – ${agenda.endTime}` : ''} WIB`,
      `🏷️ *Kategori:* ${agenda.category}`,
      `🏢 *Toko / Lokasi:* ${storeInfo}`,
      `📝 *Agenda:* ${agenda.title}`,
      agenda.description ? `ℹ️ *Catatan:* ${agenda.description}` : '',
      ``,
      `🔗 *Buka Aplikasi Web FMCU Teams:*`,
      `${appUrl}`,
      ``,
      `_Pesan resmi terkirim otomatis dari FMCU Teams Master Schedule._`,
    ]
      .filter(Boolean)
      .join('\n');

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleBroadcastFilteredAgendasWhatsApp = () => {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://fmcu-teams.web.app';
    const count = displayedAgendas.length;
    if (count === 0) {
      alert('Tidak ada agenda yang terfilter untuk di-broadcast.');
      return;
    }

    const itemsSummary = displayedAgendas.slice(0, 15).map((a, idx) => {
      const storeStr = a.storeCode ? `[${a.storeCode}]` : '';
      return `${idx + 1}. *${a.pic}* (${a.date} • ${a.time} WIB)\n   ${storeStr} ${a.title} (${a.category})`;
    }).join('\n\n');

    const contextTitle =
      timelineTab === 'fullWeek'
        ? `Minggu ${formatShortDayDate(weekStartStr)} – ${formatShortDayDate(weekEndStr)}`
        : `Tanggal ${selectedDateStr}`;

    const msg = [
      `📢 *BROADCAST JADWAL FMCU (${count} PENUGASAN)*`,
      selectedPersonDropdown !== 'ALL' ? `👤 *Filter Personel:* ${selectedPersonDropdown}` : '',
      selectedCategoryDropdown !== 'ALL' ? `🏷️ *Kategori:* ${selectedCategoryDropdown}` : '',
      `📅 *Periode:* ${contextTitle}`,
      `📊 *Total Agenda Terfilter:* ${count} Kegiatan`,
      ``,
      itemsSummary,
      count > 15 ? `\n...dan ${count - 15} penugasan lainnya.` : '',
      ``,
      `🔗 *Buka Aplikasi Web FMCU Teams:*`,
      `${appUrl}`,
      ``,
      `_Pesan resmi terkirim otomatis dari FMCU Teams Master Schedule._`,
    ]
      .filter(Boolean)
      .join('\n');

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F9FD] overflow-y-auto overflow-x-hidden no-scrollbar px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-28 max-w-7xl mx-auto w-full select-none">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full iphone-glass-icon-btn flex items-center justify-center text-black active:scale-95 transition-transform cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.4]" />
        </button>
        <div className="text-center">
          <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">
            {isReadOnly
              ? 'Executive Viewer (Read-Only)'
              : user?.isAdmin
              ? 'Portal Admin FMCU'
              : 'FMCU Master Schedule'}
          </span>
          <h2 className="text-lg lg:text-xl font-black text-slate-800">Jadwal Agenda Kerja</h2>
        </div>
        <div className="w-10 h-10 rounded-full iphone-glass-icon-btn text-black flex items-center justify-center">
          <CalendarIcon className="w-5 h-5 stroke-[2.2]" />
        </div>
      </div>

      {/* Operational Toolbar (HANYA MUNCUL DI SISI ADMIN - DI SISI USER BIASA DIHILANGKAN TOTAL) */}
      {Boolean(user?.isAdmin) && (
        <div className="flex items-center justify-between flex-wrap gap-2.5 mb-4 bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-100 shadow-soft-card">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5 ${
                isReadOnly
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : user?.isAdmin
                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {isReadOnly ? (
                <Lock className="w-3 h-3 text-amber-600" />
              ) : user?.isAdmin ? (
                <Shield className="w-3 h-3 text-teal-600" />
              ) : (
                <CalendarIcon className="w-3 h-3 text-slate-500" />
              )}
              <span>
                {isReadOnly
                  ? 'Executive Viewer • Read-Only'
                  : user?.isAdmin
                  ? 'Portal Admin FMCU'
                  : 'Master Jadwal FMCU'}
              </span>
            </span>
            <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
              {displayedAgendas.length} agenda aktif
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Broadcast WA Rekap */}
            <button
              type="button"
              onClick={handleBroadcastFilteredAgendasWhatsApp}
              className="px-3 py-1.5 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-white text-[10.5px] font-bold shadow-2xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
              title="Broadcast agenda terfilter ke WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Broadcast WA ({displayedAgendas.length})</span>
            </button>

            {/* Export Excel */}
            {onExportExcel && (
              <button
                type="button"
                onClick={() => onExportExcel(selectedPersonDropdown)}
                className="px-3 py-1.5 rounded-full bg-[#76C88D] hover:bg-[#66B87D] text-white text-[10.5px] font-bold shadow-2xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                title="Download Jadwal ke Template Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>
            )}

            {/* Upload Excel (Admin Only) */}
            {user?.isAdmin && onOpenExcelUpload && (
              <button
                type="button"
                onClick={onOpenExcelUpload}
                className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-bold transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                title="Upload / Sinkronisasi Jadwal Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Upload Excel</span>
              </button>
            )}

            {/* Buat Agenda (Admin Only) */}
            {user?.isAdmin && onOpenNewAgenda && (
              <button
                type="button"
                onClick={onOpenNewAgenda}
                className="px-3 py-1.5 rounded-full bg-[#3A657C] hover:bg-[#2E5266] text-white text-[10.5px] font-bold shadow-2xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                title="Buat Agenda Baru"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Buat Agenda</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Responsive Content Grid: Mobile (1 Col Stack) vs Tablet/Desktop (2 Col Expansive) */}
      <div className="flex flex-col md:flex-row gap-5 lg:gap-6 items-start">
        {/* Left Column: Monthly Calendar Card */}
        <div className="w-full md:w-[320px] lg:w-[380px] xl:w-[420px] md:shrink-0">
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

        {/* Right Column: Timeline & Agenda List (Lega, Tanpa Container Background yang Sempit) */}
        <div className="w-full md:flex-1 min-w-0 space-y-3.5">
          {/* Header Controls: Tab Filter (Tanggal Ini, Semua Tim, 1 Minggu) & Search Filter */}
          <div className="bg-white rounded-3xl p-3.5 sm:p-4 shadow-soft-card border border-slate-100">
            {/* Tab Filter: Tanggal Ini, Semua Tim, & 1 Minggu Penuh */}
            <div className="flex items-center gap-1.5 mb-2.5 bg-slate-100/90 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setTimelineTab('selected')}
                className={`flex-1 py-2 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer truncate ${
                  timelineTab === 'selected' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Tanggal Ini ({mySelectedDayAgendas.length})
              </button>
              <button
                type="button"
                onClick={() => setTimelineTab('allTeam')}
                className={`flex-1 py-2 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer truncate ${
                  timelineTab === 'allTeam' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Semua Tim ({allTeamAgendasOnDate.length})
              </button>
              <button
                type="button"
                onClick={() => setTimelineTab('fullWeek')}
                className={`flex-1 py-2 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer truncate ${
                  timelineTab === 'fullWeek' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                1 Minggu ({fullWeekAgendas.length})
              </button>
            </div>

            {/* Info rentang tanggal saat tab 1 Minggu Penuh aktif */}
            {timelineTab === 'fullWeek' && (
              <div className="flex items-center justify-between px-1.5 mb-2">
                <span className="text-[10.5px] font-bold text-teal-700">
                  Jadwal 1 Minggu Penuh: {formatShortDayDate(weekStartStr)} – {formatShortDayDate(weekEndStr)}
                </span>
                <span className="text-[10px] font-medium text-slate-500">
                  {groupedFullWeekByPerson.length} personel
                </span>
              </div>
            )}

            {/* Fitur Filter (Search + Dropdown Kategori Sejajar + Dropdown Nama Tim) */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  placeholder="Cari agenda atau nama..."
                  className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl pl-8 pr-7 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-teal-500 focus:bg-white shadow-2xs transition-all"
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

              {/* Filter Kategori */}
              <div className="relative shrink-0 max-w-[130px] sm:max-w-[155px] md:max-w-[180px]">
                <Tag className="w-3 h-3 text-teal-600 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={selectedCategoryDropdown}
                  onChange={(e) => setSelectedCategoryDropdown(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl pl-6 pr-5 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-teal-500 focus:bg-white cursor-pointer truncate shadow-2xs"
                  title="Filter berdasarkan Kategori Agenda"
                >
                  <option value="ALL" className="text-xs font-semibold text-slate-800 py-1">Semua Kategori</option>
                  {SCHEDULE_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="text-xs font-medium text-slate-800 py-1">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Nama Tim */}
              <div className="relative shrink-0 max-w-[115px] sm:max-w-[140px] md:max-w-[165px]">
                <Users className="w-3 h-3 text-teal-600 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={selectedPersonDropdown}
                  onChange={(e) => setSelectedPersonDropdown(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl pl-6 pr-5 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-teal-500 focus:bg-white cursor-pointer truncate shadow-2xs"
                  title="Filter berdasarkan Nama Tim (A-Z)"
                >
                  <option value="ALL" className="text-xs font-semibold text-slate-800 py-1">Semua Nama</option>
                  {allTeamNamesAZ.map((personName) => (
                    <option key={personName} value={personName} className="text-xs font-medium text-slate-800 py-1">
                      {personName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Minimalist Agenda List (Lega, Tanpa Circle Check, Judul Penuh Tanpa Terpotong) */}
          <div>
            {displayedAgendas.length === 0 ? (
              <div className="py-10 text-center bg-white rounded-3xl p-6 border border-slate-100 shadow-soft-card">
                <p className="text-slate-400 text-xs font-medium">
                  {timelineTab === 'fullWeek'
                    ? `Tidak ada jadwal yang cocok pada minggu ${formatShortDayDate(weekStartStr)} – ${formatShortDayDate(weekEndStr)}.`
                    : `Tidak ada jadwal yang cocok pada tanggal ${selectedDateStr}.`}
                </p>
                {user?.isAdmin && onOpenNewAgenda && (
                  <button
                    type="button"
                    onClick={onOpenNewAgenda}
                    className="mt-3.5 px-4 py-2 rounded-full bg-[#2BB3A0] hover:bg-[#259b8b] text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Buat Agenda Tanggal Ini</span>
                  </button>
                )}
              </div>
            ) : timelineTab === 'fullWeek' ? (
              /* Tampilan 1 Minggu Penuh: Kartu per Personel yang rapi dan lega */
              <div className="space-y-4">
                {groupedFullWeekByPerson.map((group) => (
                  <div key={group.picName} className="bg-white rounded-3xl p-4 sm:p-5 shadow-soft-card border border-slate-100 space-y-3">
                    {/* Header Personel */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#32C2AD] to-[#20A894] text-white font-black text-xs flex items-center justify-center uppercase shadow-2xs">
                          {group.picName.substring(0, 2)}
                        </div>
                        <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">
                          {group.picName}
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200/60">
                        {group.items.length} agenda
                      </span>
                    </div>

                    {/* Di bawahnya semua agendanya dalam satu minggu penuh */}
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (onSelectAgenda) onSelectAgenda(item);
                            else if (onEditAgenda && !isReadOnly) onEditAgenda(item);
                          }}
                          className="w-full text-left p-3 sm:p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-100/90 active:bg-slate-100 border border-slate-200/60 transition-all flex items-start justify-between gap-3 cursor-pointer group"
                        >
                          <div className="min-w-0 flex-1">
                            {/* Tanggal & Waktu */}
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60">
                                {formatShortDayDate(item.date)}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200/70 tabular-nums">
                                {item.category === 'OFF' ? 'OFF' : `${item.time} WIB`}
                              </span>
                              {item.category && item.category !== 'OFF' && (
                                <span className="text-[9.5px] font-bold text-teal-700 bg-white px-1.5 py-0.5 rounded border border-teal-100">
                                  {item.category}
                                </span>
                              )}
                            </div>

                            {/* Judul Agenda Lengkap Tanpa Terpotong */}
                            <h4 className="text-xs sm:text-[13px] font-bold text-slate-800 leading-snug break-words group-hover:text-teal-700 transition-colors">
                              {item.title}
                            </h4>

                            {/* Lokasi Toko */}
                            {item.location &&
                            item.location !== 'OFF / LIBUR' &&
                            !item.title.toLowerCase().includes(item.location.toLowerCase()) ? (
                              <p className="text-[11px] text-slate-500 font-medium mt-1 flex items-center gap-1 break-words">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{item.location}</span>
                              </p>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-1 shrink-0 pt-0.5">
                            {/* WhatsApp Broadcast */}
                            <button
                              type="button"
                              onClick={(e) => handleBroadcastAgendaWhatsApp(item, e)}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                              title="Kirim Jadwal via WhatsApp"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit Button (Admin Only) */}
                            {user?.isAdmin && onEditAgenda && !isReadOnly && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditAgenda(item);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
                                title="Edit Agenda"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete Button (Admin Only) */}
                            {user?.isAdmin && onDeleteAgenda && !isReadOnly && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteAgenda(item.id);
                                }}
                                className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Hapus Agenda"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Tampilan Tanggal Ini / Semua Tim: Setiap agenda berupa kartu luas mandiri, tanpa container sempit */
              <div className="space-y-2.5">
                {displayedAgendas.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (onSelectAgenda) onSelectAgenda(item);
                      else if (onEditAgenda && !isReadOnly) onEditAgenda(item);
                    }}
                    className="w-full text-left p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-100 shadow-soft-card hover:shadow-soft-md hover:border-teal-200/60 active:scale-[0.99] transition-all flex items-start justify-between gap-3 cursor-pointer group"
                  >
                    <div className="min-w-0 flex-1">
                      {/* Row 1: Nama PIC, Badge Kategori, Waktu */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className="text-xs font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">
                          {item.pic}
                        </span>
                        {item.category && item.category !== 'OFF' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200/60">
                            {item.category}
                          </span>
                        ) : item.category === 'OFF' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/60">
                            OFF
                          </span>
                        ) : null}
                        <span className="text-[10.5px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60 tabular-nums">
                          {item.category === 'OFF' ? 'Libur' : `${item.time} WIB`}
                        </span>
                      </div>

                      {/* Row 2: Judul Agenda Lengkap (TIDAK TERPOTONG, lega dan nyaman dibaca) */}
                      <h4 className="text-[13px] sm:text-sm font-bold text-slate-800 leading-snug break-words group-hover:text-teal-700 transition-colors">
                        {item.title}
                      </h4>

                      {/* Row 3: Detail Lokasi Toko jika berbeda dari judul */}
                      {item.location &&
                      item.location !== 'OFF / LIBUR' &&
                      !item.title.toLowerCase().includes(item.location.toLowerCase()) ? (
                        <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1 break-words">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{item.location}</span>
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      {/* WhatsApp Broadcast */}
                      <button
                        type="button"
                        onClick={(e) => handleBroadcastAgendaWhatsApp(item, e)}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                        title="Kirim Jadwal via WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit Button (Admin Only) */}
                      {user?.isAdmin && onEditAgenda && !isReadOnly && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditAgenda(item);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Edit Agenda"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete Button (Admin Only) */}
                      {user?.isAdmin && onDeleteAgenda && !isReadOnly && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAgenda(item.id);
                          }}
                          className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Hapus Agenda"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Minimalist Page Footer */}
      <DeveloperFooter className="mt-auto pt-16 pb-8 text-center" />
    </div>
  );
};
