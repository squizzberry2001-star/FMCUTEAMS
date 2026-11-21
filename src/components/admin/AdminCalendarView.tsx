import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit3,
  Trash2,
  Eye,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { ScheduleAgenda, VisitReportData } from '../../types';
import {
  ClassifiedAgenda,
  formatDisplayDateShort,
  formatLocalYmd,
} from './adminTypes';

interface AdminCalendarViewProps {
  classifiedAgendas: ClassifiedAgenda[];
  todayYmd: string;
  onCreateOnDate: (dateYmd: string) => void;
  onEditAgenda: (agenda: ScheduleAgenda) => void;
  onDeleteAgenda: (agenda: ScheduleAgenda) => void;
  onPreviewReport: (report: VisitReportData) => void;
}

const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const WEEKDAYS_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export const AdminCalendarView: React.FC<AdminCalendarViewProps> = ({
  classifiedAgendas,
  todayYmd,
  onCreateOnDate,
  onEditAgenda,
  onDeleteAgenda,
  onPreviewReport,
}) => {
  const [cursorMonth, setCursorMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string>(todayYmd);
  const [picFilter, setPicFilter] = useState<string>('ALL');

  const uniquePics = useMemo(() => {
    const set = new Set<string>();
    classifiedAgendas.forEach((c) => {
      if (c.agenda.pic) set.add(c.agenda.pic.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [classifiedAgendas]);

  const filteredAgendas = useMemo(() => {
    if (picFilter === 'ALL') return classifiedAgendas;
    return classifiedAgendas.filter((c) => c.agenda.pic.trim() === picFilter);
  }, [classifiedAgendas, picFilter]);

  const byDateMap = useMemo(() => {
    const map = new Map<string, ClassifiedAgenda[]>();
    for (const item of filteredAgendas) {
      const d = item.agenda.date;
      if (!d) continue;
      const arr = map.get(d);
      if (arr) arr.push(item);
      else map.set(d, [item]);
    }
    return map;
  }, [filteredAgendas]);

  const matrix = useMemo(() => {
    const year = cursorMonth.getFullYear();
    const month = cursorMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);

    let startDow = first.getDay(); // 0=Sun..6=Sat
    startDow = startDow === 0 ? 7 : startDow;

    const cells: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];

    const prevLast = new Date(year, month, 0).getDate();
    for (let i = startDow - 1; i > 0; i--) {
      const d = prevLast - i + 1;
      cells.push({
        dateStr: formatLocalYmd(new Date(year, month - 1, d)),
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    for (let d = 1; d <= last.getDate(); d++) {
      cells.push({
        dateStr: formatLocalYmd(new Date(year, month, d)),
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    const rem = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= rem; d++) {
      cells.push({
        dateStr: formatLocalYmd(new Date(year, month + 1, d)),
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [cursorMonth]);

  const selectedDayItems = useMemo(() => {
    return (byDateMap.get(selectedDate) || []).sort((a, b) =>
      (a.agenda.time || '').localeCompare(b.agenda.time || '')
    );
  }, [byDateMap, selectedDate]);

  const monthStats = useMemo(() => {
    const prefix = `${cursorMonth.getFullYear()}-${String(cursorMonth.getMonth() + 1).padStart(2, '0')}`;
    let total = 0;
    let visit = 0;
    let nso = 0;
    for (const item of filteredAgendas) {
      if (!item.agenda.date?.startsWith(prefix)) continue;
      total++;
      if (item.kind === 'VISIT') visit++;
      if (item.kind === 'NSO') nso++;
    }
    return { total, visit, nso };
  }, [filteredAgendas, cursorMonth]);

  const goPrevMonth = () =>
    setCursorMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goNextMonth = () =>
    setCursorMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => {
    const now = new Date();
    setCursorMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayYmd);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-3 h-full min-h-0 admin-view-enter">
      {/* Left: Crisp Calendar Grid Sheet */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl flex flex-col min-h-0 overflow-hidden">
        {/* Calendar Toolbar */}
        <div className="px-3.5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-white">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={goPrevMonth}
                className="p-1.5 hover:bg-slate-50 text-slate-600 cursor-pointer"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-x border-slate-200 cursor-pointer"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={goNextMonth}
                className="p-1.5 hover:bg-slate-50 text-slate-600 cursor-pointer"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-sm font-bold text-slate-900">
              {MONTH_NAMES_ID[cursorMonth.getMonth()]} {cursorMonth.getFullYear()}
            </h3>

            <span className="hidden sm:inline-flex items-center gap-2 text-[11px] text-slate-500 ml-2">
              <span>
                <strong className="text-slate-800 tabular-nums">{monthStats.total}</strong> agenda
              </span>
              <span>•</span>
              <span>
                <strong className="text-emerald-700 tabular-nums">{monthStats.visit}</strong> visit
              </span>
              {monthStats.nso > 0 && (
                <>
                  <span>•</span>
                  <span>
                    <strong className="text-amber-600 tabular-nums">{monthStats.nso}</strong> NSO
                  </span>
                </>
              )}
            </span>
          </div>

          <select
            value={picFilter}
            onChange={(e) => setPicFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:border-slate-900 max-w-[180px]"
          >
            <option value="ALL">Semua Personil ({uniquePics.length})</option>
            {uniquePics.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Weekday Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {WEEKDAYS_ID.map((w, idx) => (
            <div
              key={w}
              className={`py-2 text-center border-r last:border-r-0 border-slate-200/70 ${
                idx >= 5 ? 'text-slate-400' : ''
              }`}
            >
              {w}
            </div>
          ))}
        </div>

        {/* Calendar Cells */}
        <div className="grid grid-cols-7 flex-1 auto-rows-fr overflow-y-auto admin-sheet-scroll">
          {matrix.map((cell) => {
            const items = byDateMap.get(cell.dateStr) || [];
            const isToday = cell.dateStr === todayYmd;
            const isSelected = cell.dateStr === selectedDate;
            const visitCount = items.filter((i) => i.kind === 'VISIT').length;
            const nsoCount = items.filter((i) => i.kind === 'NSO').length;
            const otherCount = items.length - visitCount - nsoCount;

            return (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => setSelectedDate(cell.dateStr)}
                className={`min-h-[68px] sm:min-h-[86px] p-1.5 border-r border-b border-slate-100 text-left flex flex-col transition cursor-pointer relative ${
                  !cell.isCurrentMonth ? 'bg-slate-50/50 text-slate-400' : 'bg-white text-slate-800'
                } ${
                  isSelected
                    ? 'ring-2 ring-inset ring-slate-900 bg-slate-50/80 z-10'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`w-6 h-6 rounded-md text-xs font-semibold flex items-center justify-center tabular-nums ${
                      isToday
                        ? 'bg-emerald-600 text-white font-bold'
                        : isSelected
                        ? 'bg-slate-900 text-white'
                        : ''
                    }`}
                  >
                    {cell.dayNum}
                  </span>
                  {items.length > 0 && (
                    <span className="text-[10px] font-mono font-semibold text-slate-400 tabular-nums">
                      {items.length}
                    </span>
                  )}
                </div>

                {/* Compact Desktop Chips */}
                <div className="hidden sm:flex flex-col gap-0.5 mt-1 w-full overflow-hidden">
                  {items.slice(0, 2).map((it) => (
                    <div
                      key={it.agenda.id}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate border ${it.badge.bg} ${it.badge.color} ${it.badge.border}`}
                    >
                      {it.agenda.storeName || it.agenda.title}
                    </div>
                  ))}
                  {items.length > 2 && (
                    <div className="text-[10px] font-semibold text-slate-400 px-1">
                      +{items.length - 2} lainnya
                    </div>
                  )}
                </div>

                {/* Compact Mobile Dots */}
                {items.length > 0 && (
                  <div className="flex sm:hidden items-center gap-1 mt-auto pt-1">
                    {visitCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    {nsoCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                    {otherCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Selected Date Agenda Sheet Panel */}
      <div className="w-full lg:w-[360px] xl:w-[400px] bg-white border border-slate-200 rounded-xl flex flex-col min-h-[260px] lg:min-h-0 overflow-hidden shrink-0">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 bg-white">
          <div>
            <div className="text-xs font-bold text-slate-900">
              {formatDisplayDateShort(selectedDate)}
              {selectedDate === todayYmd && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                  Hari Ini
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
              {selectedDayItems.length} agenda terjadwal
            </div>
          </div>

          <button
            type="button"
            onClick={() => onCreateOnDate(selectedDate)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto admin-sheet-scroll divide-y divide-slate-100">
          {selectedDayItems.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <p className="text-xs font-medium text-slate-500">
                Belum ada agenda pada tanggal ini.
              </p>
              <button
                type="button"
                onClick={() => onCreateOnDate(selectedDate)}
                className="mt-2.5 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Jadwalkan Sekarang</span>
              </button>
            </div>
          ) : (
            selectedDayItems.map((item) => {
              const ag = item.agenda;
              return (
                <div key={ag.id} className="px-4 py-3 hover:bg-slate-50/70 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${item.badge.bg} ${item.badge.color} ${item.badge.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${item.badge.dot}`} />
                          {item.badge.shortLabel}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-mono text-slate-500">
                          <Clock className="w-3 h-3" />
                          {ag.time || '08:30'}–{ag.endTime || '17:00'}
                        </span>
                        <span className={`text-[10px] font-semibold ${item.status.color}`}>
                          • {item.status.label}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-slate-900 mt-1 truncate">
                        {ag.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        <strong className="text-slate-700 font-medium">{ag.pic}</strong>
                        {' • '}
                        {ag.storeCode ? `#${ag.storeCode} ` : ''}
                        {ag.storeName || ag.location || '-'}
                      </div>
                      {ag.kendala && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-rose-600 font-medium">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span className="truncate">{ag.kendala}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      {item.report && (
                        <button
                          type="button"
                          onClick={() => onPreviewReport(item.report!)}
                          className="p-1.5 rounded-md text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                          title="Preview Laporan"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEditAgenda(ag)}
                        className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        title="Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteAgenda(ag)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
