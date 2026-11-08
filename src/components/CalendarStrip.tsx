import React, { useEffect, useRef, useMemo } from 'react';

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

export const getCurrentWeekDays = (referenceDateStr?: string): CalendarDayItem[] => {
  const now = new Date();
  const actualDayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const isActualSunday = actualDayOfWeek === 0;
  const todayStr = formatYmd(now);

  // Find Monday of running week:
  // If actual day is Sunday, running week shifts to next Monday (now + 1 day)
  const mondayOffset = actualDayOfWeek === 0 ? 1 : 1 - actualDayOfWeek;
  const runningMondayDate = new Date(now);
  runningMondayDate.setDate(now.getDate() + mondayOffset);
  const runningMondayStr = formatYmd(runningMondayDate);

  let targetMonday: Date;
  if (!referenceDateStr) {
    targetMonday = new Date(runningMondayDate);
  } else {
    const ref = new Date(referenceDateStr + 'T12:00:00');
    if (isNaN(ref.getTime())) {
      targetMonday = new Date(runningMondayDate);
    } else {
      const refDay = ref.getDay();
      const distToMon = refDay === 0 ? (ref.toDateString() === now.toDateString() ? 1 : -6) : 1 - refDay;
      targetMonday = new Date(ref);
      targetMonday.setDate(ref.getDate() + distToMon);
    }
  }

  const targetMondayStr = formatYmd(targetMonday);
  const isTargetRunningPeriod =
    targetMondayStr === runningMondayStr || (isActualSunday && referenceDateStr === todayStr);

  const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const fullDayLabels = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const dayNames = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];

  const days: CalendarDayItem[] = [];

  // RULE 1: JIKA MASIH HARI MINGGU MAKA PILL AUTO JADI 8 (1 PILL TGL MINGGU BERJALAN DAN 7 PILL MINGGU DEPAN)
  if (isActualSunday && isTargetRunningPeriod) {
    const sundayObj = new Date(now);
    days.push({
      dateObj: sundayObj,
      dateString: todayStr,
      num: sundayObj.getDate(),
      label: 'Min',
      fullLabel: 'Minggu',
      dayName: 'MINGGU',
      isToday: true,
      isWeekend: true,
      isCurrentSunday: true,
      isActualWeek: true,
      isActualWeekStart: true,
    });
  }

  // 7 Hari (Senin s/d Minggu depan / minggu terpilih)
  for (let i = 0; i < 7; i++) {
    const d = new Date(targetMonday);
    d.setDate(targetMonday.getDate() + i);
    const dateStr = formatYmd(d);
    days.push({
      dateObj: d,
      dateString: dateStr,
      num: d.getDate(),
      label: dayLabels[i],
      fullLabel: fullDayLabels[i],
      dayName: dayNames[i],
      isToday: dateStr === todayStr,
      isWeekend: i === 5 || i === 6,
      isActualWeek: isTargetRunningPeriod,
      isActualWeekStart: !isActualSunday && isTargetRunningPeriod && i === 0,
    });
  }

  return days;
};

/**
 * Generate multi-week scrollable days (2 weeks before actual week + Actual Week + 3 weeks after)
 * so user can horizontally scroll across weeks while opening directly focused on Actual Week.
 */
export const getScrollableCalendarDays = (): {
  days: CalendarDayItem[];
  isEightPillsActualWeek: boolean;
} => {
  const now = new Date();
  const actualDayOfWeek = now.getDay();
  const isActualSunday = actualDayOfWeek === 0;
  const todayStr = formatYmd(now);

  const mondayOffset = actualDayOfWeek === 0 ? 1 : 1 - actualDayOfWeek;
  const runningMondayDate = new Date(now);
  runningMondayDate.setDate(now.getDate() + mondayOffset);

  // Start of actual week:
  // If today is Sunday, actual week starts from Today (Sunday) + 7 days next week = 8 pills.
  // If today is Mon-Sat, actual week starts from runningMondayDate = 7 pills.
  const actualWeekStartDate = new Date(runningMondayDate);
  if (isActualSunday) {
    actualWeekStartDate.setDate(runningMondayDate.getDate() - 1);
  }
  const actualWeekStartStr = formatYmd(actualWeekStartDate);

  const actualWeekEndDate = new Date(runningMondayDate);
  actualWeekEndDate.setDate(runningMondayDate.getDate() + 6);
  const actualWeekEndStr = formatYmd(actualWeekEndDate);

  // Range: 14 days before actualWeekStartDate through 21 days after actualWeekEndDate
  const startRange = new Date(actualWeekStartDate);
  startRange.setDate(actualWeekStartDate.getDate() - 14);

  const endRange = new Date(actualWeekEndDate);
  endRange.setDate(actualWeekEndDate.getDate() + 21);

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
    isEightPillsActualWeek: isActualSunday,
  };
};

export const CalendarStrip: React.FC<CalendarStripProps> = ({
  selectedDate,
  onSelectDate,
  focusTrigger,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { days, isEightPillsActualWeek } = useMemo(() => getScrollableCalendarDays(), []);

  // Helper to scroll container so Actual Week (or Actual Date) is in focus
  const focusOnActualWeek = (smooth: boolean) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const targetEl = container.querySelector('[data-actual-week-start="true"]') as HTMLElement | null;
    if (targetEl) {
      const targetLeft = Math.max(0, targetEl.offsetLeft - 2);
      if (smooth) {
        container.scrollTo({ left: targetLeft, behavior: 'smooth' });
      } else {
        container.scrollLeft = targetLeft;
      }
    }
  };

  // 1. On initial mount: immediately position scroll at Actual Running Week
  useEffect(() => {
    focusOnActualWeek(false);
    const rafId = window.requestAnimationFrame(() => focusOnActualWeek(false));
    const timerId = window.setTimeout(() => focusOnActualWeek(false), 80);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
    };
  }, []);

  // 2. When user clicks "Hari Ini" or "Minggu Ini": smooth scroll back to Actual Week / Actual Date
  useEffect(() => {
    if (!focusTrigger) return;
    focusOnActualWeek(true);
  }, [focusTrigger]);

  return (
    <div
      ref={scrollContainerRef}
      className={`flex items-center overflow-x-auto py-2 no-scrollbar scroll-smooth snap-x snap-mandatory ${
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
                ? 'w-[calc((100%-28px)/8)] min-w-[36px] sm:min-w-[42px] px-0.5 sm:px-1'
                : 'w-[calc((100%-36px)/7)] min-w-[42px] sm:min-w-[46px]'
            } ${
              isSelected
                ? 'py-3 sm:py-3.5 rounded-full bg-gradient-to-b from-[#FF7E98] to-[#FF5376] text-white shadow-pill-coral transform -translate-y-0.5'
                : item.isToday
                ? 'py-2.5 sm:py-3 rounded-full bg-white text-slate-800'
                : item.isActualWeek
                ? 'py-2.5 sm:py-3 rounded-full bg-white/95 hover:bg-white text-slate-500 hover:text-slate-700 shadow-soft-sm'
                : 'py-2.5 sm:py-3 rounded-full bg-white/65 hover:bg-white text-slate-400 hover:text-slate-600'
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
