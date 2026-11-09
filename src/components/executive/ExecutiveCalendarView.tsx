import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Store,
  Users,
  CheckCircle2,
  FileText,
  ExternalLink,
  MapPin,
  Sparkles,
  Award,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { ScheduleAgenda, ScheduleCategory, User, VisitReportData } from '../../types';
import { getLocalDateYmd } from '../../utils/mapGeoUtils';
import { getMondayOfWeek, getFullWeekDays } from '../../services/scheduleExcelService';
import { resolveVisitedStoreReportData } from '../HistoryView';
import { getGDriveReportRegistryEntry, FMCU_REPORT_GDRIVE_FOLDER_URL } from '../../services/pdfGeneratorService';
import { findVerifiedGDriveReport, VerifiedGDriveReportMeta } from '../../services/gdriveReportLiveService';

interface ExecutiveCalendarViewProps {
  currentUser: User;
  agendas: ScheduleAgenda[];
  users: User[];
  cloudReports: (VisitReportData & { updatedAtMs?: number })[];
  onOpenReportPreview: (params: {
    reportData: VisitReportData;
    gdrivePdfUrl: string;
    gdriveEmbedUrl?: string;
    storeFolderName?: string;
    pdfFileName?: string;
    gdriveSavedDate?: string;
  }) => void;
}

export const ExecutiveCalendarView: React.FC<ExecutiveCalendarViewProps> = ({
  currentUser,
  agendas,
  users,
  cloudReports,
  onOpenReportPreview,
}) => {
  const todayYmd = useMemo(() => getLocalDateYmd(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayYmd);
  const [selectedMonthOffset, setSelectedMonthOffset] = useState<number>(0);
  const [selectedPicFilter, setSelectedPicFilter] = useState<string>('ALL');
  const [activeListTab, setActiveListTab] = useState<'SELECTED_DAY' | 'WEEK' | 'MONTH'>('SELECTED_DAY');

  // Compute viewing month
  const { currentYear, currentMonth, monthName, daysInMonth, startDayOfWeek } = useMemo(() => {
    const base = new Date();
    base.setMonth(base.getMonth() + selectedMonthOffset);
    const yr = base.getFullYear();
    const mo = base.getMonth(); // 0-indexed

    const name = base.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const daysCount = new Date(yr, mo + 1, 0).getDate();

    // In JS: 0=Sun, 1=Mon, ..., 6=Sat. Convert to Monday=0, ..., Sunday=6
    const firstDayJs = new Date(yr, mo, 1).getDay();
    const startMon0 = (firstDayJs + 6) % 7;

    return {
      currentYear: yr,
      currentMonth: mo,
      monthName: name,
      daysInMonth: daysCount,
      startDayOfWeek: startMon0,
    };
  }, [selectedMonthOffset]);

  // Unique PICs list
  const uniquePics = useMemo(() => {
    const set = new Set<string>();
    agendas.forEach((a) => {
      if (a.pic) set.add(a.pic);
    });
    return Array.from(set).sort();
  }, [agendas]);

  // Agendas filtered by PIC
  const picFilteredAgendas = useMemo(() => {
    if (selectedPicFilter === 'ALL') return agendas;
    return agendas.filter((a) => a.pic === selectedPicFilter);
  }, [agendas, selectedPicFilter]);

  // Agendas map grouped by Date YYYY-MM-DD
  const agendasByDate = useMemo(() => {
    const map = new Map<string, ScheduleAgenda[]>();
    picFilteredAgendas.forEach((a) => {
      if (!map.has(a.date)) map.set(a.date, []);
      map.get(a.date)!.push(a);
    });
    return map;
  }, [picFilteredAgendas]);

  // Calendar cells generation (with blank padding for Monday alignment)
  const calendarCells = useMemo(() => {
    const cells: { dayNum: number | null; dateStr: string; agendas: ScheduleAgenda[] }[] = [];

    // Leading blanks
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push({ dayNum: null, dateStr: '', agendas: [] });
    }

    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(currentMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${currentYear}-${mm}-${dd}`;
      const dayAgendas = agendasByDate.get(dateStr) || [];
      cells.push({ dayNum: d, dateStr, agendas: dayAgendas });
    }

    return cells;
  }, [startDayOfWeek, daysInMonth, currentMonth, currentYear, agendasByDate]);

  // Filter agendas for Card 2 (Klasifikasi Agenda)
  const card2Agendas = useMemo(() => {
    const currentMonday = getMondayOfWeek(todayYmd);
    const weekDays = new Set(getFullWeekDays(currentMonday).map((d) => d.dateStr));
    const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    if (activeListTab === 'SELECTED_DAY') {
      return picFilteredAgendas.filter((a) => a.date === selectedDate);
    }
    if (activeListTab === 'WEEK') {
      return picFilteredAgendas.filter((a) => weekDays.has(a.date));
    }
    return picFilteredAgendas.filter((a) => (a.date || '').startsWith(currentMonthPrefix));
  }, [
    activeListTab,
    selectedDate,
    picFilteredAgendas,
    todayYmd,
    currentYear,
    currentMonth,
  ]);

  // Card 2 classification counts
  const card2Stats = useMemo(() => {
    const total = card2Agendas.length;
    const visits = card2Agendas.filter(
      (a) => a.category === 'VISIT' || a.category === 'NSO' || Boolean(a.storeCode)
    ).length;
    const nonVisits = total - visits;
    const uniquePersonnel = new Set(card2Agendas.map((a) => a.pic)).size;

    return { total, visits, nonVisits, uniquePersonnel };
  }, [card2Agendas]);

  const handlePreviewReport = (agenda: ScheduleAgenda) => {
    const verified = findVerifiedGDriveReport({
      storeCode: agenda.storeCode,
      storeName: agenda.storeName || agenda.location,
      pic: agenda.pic,
      agendaId: agenda.id,
      visitDate: agenda.date,
      cloudReports,
    });

    if (!verified) return;

    onOpenReportPreview({
      reportData: verified.reportData,
      gdrivePdfUrl: verified.gdrivePdfUrl,
      gdriveEmbedUrl: verified.gdriveEmbedUrl,
      storeFolderName: verified.storeFolderName,
      pdfFileName: verified.pdfFileName,
      gdriveSavedDate: verified.gdriveSavedDate,
    });
  };

  const dayHeaders = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  return (
    <div className="space-y-6">
      {/* =========================================================================
          CARD 1: KALENDER PENUH (FULL MONTH INTERACTIVE CALENDAR)
          ========================================================================= */}
      <div className="bg-white rounded-[32px] p-5 sm:p-7 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-6 rounded-full bg-[#3A657C]" />
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Card 1: Kalender Penuh Bulanan
              </h2>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Tampilan Kalender 1 Bulan Penuh • Klik Tanggal untuk Membuka Agenda
            </p>
          </div>

          {/* Month Navigation & Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedPicFilter}
              onChange={(e) => setSelectedPicFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="ALL">Semua Personel ({uniquePics.length})</option>
              {uniquePics.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setSelectedMonthOffset((v) => v - 1)}
                className="w-7 h-7 rounded-xl bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 text-xs font-black text-slate-800 capitalize min-w-[120px] text-center">
                {monthName}
              </span>

              <button
                type="button"
                onClick={() => setSelectedMonthOffset((v) => v + 1)}
                className="w-7 h-7 rounded-xl bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center transition cursor-pointer"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {selectedMonthOffset !== 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedMonthOffset(0);
                  setSelectedDate(todayYmd);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold cursor-pointer"
              >
                Bulan Ini
              </button>
            )}
          </div>
        </div>

        {/* Calendar Grid Header */}
        <div className="pt-5">
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center">
            {dayHeaders.map((dh, idx) => (
              <div
                key={dh}
                className={`py-2 text-[11px] sm:text-xs font-black uppercase tracking-wider ${
                  idx >= 5 ? 'text-rose-500' : 'text-slate-500'
                }`}
              >
                {dh}
              </div>
            ))}
          </div>

          {/* Calendar Month Cells */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarCells.map((cell, idx) => {
              if (cell.dayNum === null) {
                return (
                  <div
                    key={`blank-${idx}`}
                    className="min-h-[72px] sm:min-h-[88px] bg-slate-50/50 rounded-2xl border border-transparent"
                  />
                );
              }

              const isToday = cell.dateStr === todayYmd;
              const isSelected = cell.dateStr === selectedDate;
              const hasVisits = cell.agendas.some(
                (a) => a.category === 'VISIT' || a.category === 'NSO' || Boolean(a.storeCode)
              );
              const hasOff = cell.agendas.some((a) => a.category === 'OFF' || a.category === 'CUTI');

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => {
                    setSelectedDate(cell.dateStr);
                    setActiveListTab('SELECTED_DAY');
                  }}
                  className={`min-h-[72px] sm:min-h-[88px] p-1.5 sm:p-2 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-emerald-50/90 border-[#10B981] shadow-xs ring-2 ring-[#10B981]/30'
                      : isToday
                      ? 'bg-amber-50/50 border-amber-300'
                      : cell.agendas.length > 0
                      ? 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs'
                      : 'bg-[#FAFAFA] hover:bg-slate-100 border-slate-200/50 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs sm:text-sm font-black ${
                        isSelected
                          ? 'text-emerald-950 font-black'
                          : isToday
                          ? 'text-amber-800'
                          : 'text-slate-800'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    {isToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    )}
                  </div>

                  {cell.agendas.length > 0 ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        {hasVisits && (
                          <span
                            className="w-2 h-2 rounded-full bg-emerald-500"
                            title="Ada Kunjungan Toko"
                          />
                        )}
                        {hasOff && (
                          <span
                            className="w-2 h-2 rounded-full bg-slate-400"
                            title="Ada Libur / Off"
                          />
                        )}
                        {cell.agendas.some(
                          (a) => a.category === 'TRAINING' || a.category === 'MEETING'
                        ) && (
                          <span
                            className="w-2 h-2 rounded-full bg-indigo-500"
                            title="Ada Training / Meeting"
                          />
                        )}
                      </div>

                      <span
                        className={`text-[9px] sm:text-[10px] font-extrabold block truncate ${
                          isSelected ? 'text-emerald-800' : 'text-slate-500'
                        }`}
                      >
                        {cell.agendas.length} Agenda
                      </span>
                    </div>
                  ) : (
                    <span className="text-[9px] text-slate-300 font-semibold">•</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend Guide */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-slate-500">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Store Visit / NSO
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                Training / Meeting
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                Libur / Cuti
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Hari Ini
              </span>
            </div>

            <span>
              Tanggal Terpilih: <strong className="text-slate-800">{selectedDate}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CARD 2: KLASIFIKASI AGENDA HARI INI DAN MINGGU INI
          ========================================================================= */}
      <div className="bg-white rounded-[32px] p-5 sm:p-7 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-6 rounded-full bg-[#10B981]" />
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Card 2: Klasifikasi Agenda Hari Ini &amp; Minggu Ini
              </h2>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Detail Agenda Terjadwal Lengkap dengan Pratinjau Laporan Kunjungan Toko
            </p>
          </div>

          {/* Tab Switcher: Hari Ini vs Minggu Ini vs Bulan Ini */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveListTab('SELECTED_DAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeListTab === 'SELECTED_DAY'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {selectedDate === todayYmd ? 'Hari Ini' : selectedDate}
            </button>
            <button
              type="button"
              onClick={() => setActiveListTab('WEEK')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeListTab === 'WEEK'
                  ? 'bg-[#3A657C] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Minggu Ini
            </button>
            <button
              type="button"
              onClick={() => setActiveListTab('MONTH')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeListTab === 'MONTH'
                  ? 'bg-[#3A657C] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bulan Ini
            </button>
          </div>
        </div>

        {/* Quick Stat Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 pb-4">
          <div className="p-3 bg-[#F8FAFC] rounded-2xl border border-slate-200">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
              Total Agenda
            </span>
            <span className="text-xl font-black text-slate-900 mt-0.5 block">
              {card2Stats.total}
            </span>
          </div>

          <div className="p-3 bg-[#ECFDF5] rounded-2xl border border-emerald-200">
            <span className="text-[10px] font-extrabold uppercase text-emerald-700 block tracking-wider">
              Store Visit
            </span>
            <span className="text-xl font-black text-emerald-900 mt-0.5 block">
              {card2Stats.visits}
            </span>
          </div>

          <div className="p-3 bg-[#EFF6FF] rounded-2xl border border-blue-200">
            <span className="text-[10px] font-extrabold uppercase text-blue-700 block tracking-wider">
              Non-Kunjungan
            </span>
            <span className="text-xl font-black text-blue-900 mt-0.5 block">
              {card2Stats.nonVisits}
            </span>
          </div>

          <div className="p-3 bg-[#FAF5FF] rounded-2xl border border-purple-200">
            <span className="text-[10px] font-extrabold uppercase text-purple-700 block tracking-wider">
              Personel Aktif
            </span>
            <span className="text-xl font-black text-purple-900 mt-0.5 block">
              {card2Stats.uniquePersonnel}
            </span>
          </div>
        </div>

        {/* Super Minimalist Agenda List: Nama Personel & Text Kecil Tipis Agendanya */}
        <div className="divide-y divide-slate-100 pt-2">
          {card2Agendas.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/70 rounded-2xl border border-slate-100 text-slate-400 text-xs font-semibold">
              Tidak ada agenda untuk periode atau filter yang dipilih.
            </div>
          ) : (
            card2Agendas.map((item) => {
              const isVisit =
                item.category === 'VISIT' || item.category === 'NSO' || Boolean(item.storeCode);
              const meta = getCategoryBadgeMeta(item.category);
              const verifiedReport = isVisit
                ? findVerifiedGDriveReport({
                    storeCode: item.storeCode,
                    storeName: item.storeName || item.location,
                    pic: item.pic,
                    agendaId: item.id,
                    visitDate: item.date,
                    cloudReports,
                  })
                : null;

              return (
                <div
                  key={item.id}
                  className="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/70 transition-colors rounded-xl"
                >
                  <div className="min-w-0 flex-1">
                    {/* Primary: Nama Personel */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 tracking-tight">
                        {item.pic}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold ${meta.pillBg} ${meta.pillText}`}
                      >
                        {meta.label}
                      </span>

                      {item.storeCode && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200/70 text-slate-600">
                          #{item.storeCode}
                        </span>
                      )}
                    </div>

                    {/* Text Kecil Tipis Agendanya */}
                    <p className="text-[11px] font-normal text-slate-400 mt-0.5 truncate tracking-normal">
                      <span className="text-slate-600 font-medium">{item.title}</span>
                      {' • '}
                      <span>{item.date}</span>
                      {' • '}
                      <span>{item.time || '08:30'} WIB</span>
                      {item.location && item.location !== 'OFF / LIBUR' && (
                        <>
                          {' • '}
                          <span className="text-slate-400">{item.location}</span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Actions: Preview Laporan for Verified GDrive Report (ONLY IF EXISTS IN GDRIVE) */}
                  {verifiedReport && (
                    <div className="shrink-0 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenReportPreview({
                            reportData: verifiedReport.reportData,
                            gdrivePdfUrl: verifiedReport.gdrivePdfUrl,
                            gdriveEmbedUrl: verifiedReport.gdriveEmbedUrl,
                            storeFolderName: verifiedReport.storeFolderName,
                            pdfFileName: verifiedReport.pdfFileName,
                            gdriveSavedDate: verifiedReport.gdriveSavedDate,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-200/80 text-emerald-800 text-[11px] font-bold flex items-center gap-1.5 transition shadow-2xs active:scale-95 cursor-pointer"
                        title="Buka pratinjau dokumen laporan PDF dari Google Drive"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Preview Laporan</span>
                        <ExternalLink className="w-3 h-3 text-emerald-600" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

function getCategoryBadgeMeta(category: ScheduleCategory): {
  label: string;
  pillBg: string;
  pillText: string;
} {
  switch (category) {
    case 'VISIT':
      return {
        label: 'Store Visit',
        pillBg: 'bg-emerald-50 border border-emerald-200',
        pillText: 'text-emerald-800',
      };
    case 'NSO':
      return {
        label: 'NSO Opening',
        pillBg: 'bg-sky-50 border border-sky-200',
        pillText: 'text-sky-800',
      };
    case 'AUDIT':
      return {
        label: 'Audit SOP / QSC',
        pillBg: 'bg-amber-50 border border-amber-200',
        pillText: 'text-amber-800',
      };
    case 'TRAINING':
      return {
        label: 'Training / SBS',
        pillBg: 'bg-indigo-50 border border-indigo-200',
        pillText: 'text-indigo-800',
      };
    case 'MEETING':
      return {
        label: 'Meeting',
        pillBg: 'bg-blue-50 border border-blue-200',
        pillText: 'text-blue-800',
      };
    case 'WORK_PLAN':
      return {
        label: 'Work Plan',
        pillBg: 'bg-teal-50 border border-teal-200',
        pillText: 'text-teal-800',
      };
    case 'OPERATION':
      return {
        label: 'Operation',
        pillBg: 'bg-slate-100 border border-slate-200',
        pillText: 'text-slate-800',
      };
    case 'CUTI':
      return {
        label: 'Cuti',
        pillBg: 'bg-rose-50 border border-rose-200',
        pillText: 'text-rose-800',
      };
    case 'OFF':
      return {
        label: 'Libur (OFF)',
        pillBg: 'bg-slate-100 border border-slate-200',
        pillText: 'text-slate-600',
      };
    default:
      return {
        label: 'Agenda',
        pillBg: 'bg-slate-100',
        pillText: 'text-slate-700',
      };
  }
}
