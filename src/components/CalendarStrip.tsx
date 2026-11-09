import React, { useEffect, useRef, useMemo } from 'react';
import { getMondayOfWeek } from '../services/scheduleExcelService';

export interface CalendarFocusTrigger {
  mode: 'today' | 'week';
  ts: number;
}

interface CalendarStripProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  baseDate?: string; // Optional reference date
  focusTrigger?: CalendarFocusTrigger;
}

export interface CalendarDayItem {
  dateObj: Date;
  dateString: string;
  num: number;
  label: string;
  fullLabel: string;
  dayName?: string;
  monthShort?: string;
  isToday: boolean;
  isWeekend?: boolean;
  isCurrentSunday?: boolean;
  isActualWeek?: boolean;
  isActualWeekStart?: boolean;
}

const formatYmd = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Multi-week scrollable days generator:
 * Generates ~8 weeks of date pills (3 weeks before base Monday, current week, and 4 weeks after).
 * This enables fluid horizontal scrolling across weeks while auto-centering on the selected date.
 */
export const getScrollableCalendarDays = (referenceDateStr?: string): {
  days: CalendarDayItem[];
  isEightPillsActualWeek: boolean;
} => {
  const now = new Date();
  const actualDayOfWeek = now.getDay();
  const isActualSunday = actualDayOfWeek === 0;
  const todayStr = formatYmd(now);

  const baseRef = referenceDateStr || todayStr;
  const baseMonday = getMondayOfWeek(baseRef);
  const runningMondayDate = new Date(baseMonday + 'T00:00:00');

  // Start of actual week:
  const isViewingCurrent = !referenceDateStr || referenceDateStr === todayStr || getMondayOfWeek(todayStr) === baseMonday;
  const actualWeekStartDate = new Date(runningMondayDate);
  if (isActualSunday && isViewingCurrent) {
    actualWeekStartDate.setDate(runningMondayDate.getDate() - 1);
  }
  const actualWeekStartStr = formatYmd(actualWeekStartDate);

  const actualWeekEndDate = new Date(runningMondayDate);
  actualWeekEndDate.setDate(runningMondayDate.getDate() + 6);
  const actualWeekEndStr = formatYmd(actualWeekEndDate);

  // Range: 21 days before actualWeekStartDate through 28 days after actualWeekEndDate
  const startRange = new Date(actualWeekStartDate);
  startRange.setDate(actualWeekStartDate.getDate() - 21);

  const endRange = new Date(actualWeekEndDate);
  endRange.setDate(actualWeekEndDate.getDate() + 28);

  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const jsDayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const jsFullDayLabels = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const jsDayNames = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

  const days: CalendarDayItem[] = [];
  const cursor = new Date(startRange);

  while (cursor <= endRange) {
    const d = new Date(cursor);
    const dateStr = formatYmd(d);
    const dow = d.getDay();
    const isActualWeek = dateStr >= actualWeekStartStr && dateStr <= actualWeekEndStr;

    days.push({
      dateObj: d,
      dateString: dateStr,
      num: d.getDate(),
      label: jsDayLabels[dow],
      fullLabel: jsFullDayLabels[dow],
      dayName: jsDayNames[dow],
      monthShort: shortMonths[d.getMonth()],
      isToday: dateStr === todayStr,
      isWeekend: dow === 0 || dow === 6,
      isCurrentSunday: isActualSunday && dateStr === todayStr,
      isActualWeek,
      isActualWeekStart: dateStr === actualWeekStartStr,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    days,
    isEightPillsActualWeek: isActualSunday && isViewingCurrent,
  };
};

// Backwards compatibility for SplashScreen or other single-week consumers
export const getCurrentWeekDays = (referenceDateStr?: string): CalendarDayItem[] => {
  return getScrollableCalendarDays(referenceDateStr).days.filter((d) => d.isActualWeek);
};

export const CalendarStrip: React.FC<CalendarStripProps> = ({
  selectedDate,
  onSelectDate,
  baseDate,
  focusTrigger,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Multi-week horizontal scrollable days (centered on active/selected date)
  const { days, isEightPillsActualWeek } = useMemo(
    () => getScrollableCalendarDays(baseDate),
    [baseDate]
  );

  // Helper untuk memastikan tanggal terpilih atau aktual dalam fokus
  const focusOnDatePill = (smooth: boolean, preferSelected: boolean = true) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let targetEl: HTMLElement | null = null;
    if (preferSelected && selectedDate) {
      targetEl = container.querySelector(`[data-date="${selectedDate}"]`) as HTMLElement | null;
    }
    if (!targetEl) {
      targetEl = container.querySelector('[data-splash-target="actual-date-pill"]') as HTMLElement | null;
    }
    if (!targetEl) {
      targetEl = container.querySelector('[data-actual-week-start="true"]') as HTMLElement | null;
    }

    if (targetEl) {
      const targetLeft = targetEl.offsetLeft - (container.clientWidth - targetEl.clientWidth) / 2;
      const scrollPos = Math.max(0, targetLeft);
      if (smooth) {
        container.scrollTo({ left: scrollPos, behavior: 'smooth' });
      } else {
        container.scrollLeft = scrollPos;
      }
    }
  };

  useEffect(() => {
    focusOnDatePill(false);
    const rafId = window.requestAnimationFrame(() => focusOnDatePill(false));
    const timerId = window.setTimeout(() => focusOnDatePill(false), 80);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    if (!focusTrigger) return;
    focusOnDatePill(true, focusTrigger.mode === 'today');
  }, [focusTrigger]);

  useEffect(() => {
    focusOnDatePill(true, true);
  }, [selectedDate]);

  return (
    <div
      ref={scrollContainerRef}
      className={`flex items-center overflow-x-auto py-2 no-scrollbar scroll-smooth w-full select-none snap-x snap-mandatory ${
        isEightPillsActualWeek ? 'gap-1 sm:gap-1.5' : 'gap-1.5'
      }`}
    >
      {days.map((item) => {
        const isSelected = item.dateString === selectedDate;
        return (
          <button
            key={item.dateString}
            type="button"
            data-date={item.dateString}
            data-actual-week-start={item.isActualWeekStart ? 'true' : undefined}
            data-splash-target={item.isToday ? 'actual-date-pill' : undefined}
            data-selected-date-pill={isSelected ? 'true' : undefined}
            onClick={() => onSelectDate(item.dateString)}
            style={
              isSelected
                ? item.isToday
                  ? {
                      boxShadow:
                        'inset 0 0 0 1.5px rgba(255, 255, 255, 0.92), 0 10px 25px -4px rgba(255, 107, 139, 0.45)',
                    }
                  : undefined
                : item.isToday
                ? {
                    boxShadow:
                      'inset 0 0 0 1.25px #2BB3A0, 0 2px 6px -1px rgba(30, 41, 59, 0.04)',
                  }
                : undefined
            }
            className={`flex flex-col items-center justify-center transition-all duration-300 shrink-0 snap-start ${
              isEightPillsActualWeek
                ? 'w-[calc((100%-28px)/8)] min-w-[38px] sm:min-w-[42px] px-0.5 sm:px-1'
                : 'w-[calc((100%-36px)/7)] min-w-[42px] sm:min-w-[46px]'
            } ${
              isSelected
                ? 'py-3 sm:py-3.5 rounded-full bg-gradient-to-b from-[#FF7E98] to-[#FF5376] text-white shadow-pill-coral transform -translate-y-0.5'
                : item.isToday
                ? 'py-2.5 sm:py-3 rounded-full bg-white text-slate-800'
                : item.isActualWeek
                ? 'py-2.5 sm:py-3 rounded-full bg-white/95 hover:bg-white text-slate-500 hover:text-slate-700 shadow-soft-sm'
                : 'py-2.5 sm:py-3 rounded-full bg-white/70 hover:bg-white text-slate-400 hover:text-slate-600'
            }`}
          >
            <span
              className={`${
                isEightPillsActualWeek ? 'text-sm sm:text-base' : 'text-base'
              } leading-tight ${
                isSelected
                  ? 'font-bold text-white'
                  : item.isToday
                  ? 'font-extrabold text-teal-700'
                  : 'font-bold text-slate-800'
              }`}
            >
              {item.num}
            </span>
            <span
              className={`text-[9px] sm:text-[10px] mt-0.5 ${
                isSelected
                  ? 'font-semibold text-white/95'
                  : item.isToday
                  ? 'font-bold text-teal-600'
                  : 'font-semibold text-slate-400'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
