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

export const getCurrentWeekDays = (referenceDateStr?: string): CalendarDayItem[] => {
  const now = new Date();
  const todayStr = formatYmd(now);

  // Ambil hari Senin minggu aktual (Senin s/d Minggu)
  const baseMon = getMondayOfWeek(referenceDateStr || todayStr);
  const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const fullDayLabels = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const dayNames = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  const days: CalendarDayItem[] = [];

  // Tepat 7 hari: Senin hingga Minggu minggu aktual
  for (let i = 0; i < 7; i++) {
    const d = new Date(baseMon + 'T00:00:00');
    d.setDate(d.getDate() + i);
    const dateStr = formatYmd(d);

    days.push({
      dateObj: d,
      dateString: dateStr,
      num: d.getDate(),
      label: dayLabels[i],
      fullLabel: fullDayLabels[i],
      dayName: dayNames[i],
      monthShort: shortMonths[d.getMonth()],
      isToday: dateStr === todayStr,
      isWeekend: i === 5 || i === 6,
      isActualWeek: true,
      isActualWeekStart: i === 0,
    });
  }

  return days;
};

export const CalendarStrip: React.FC<CalendarStripProps> = ({
  selectedDate,
  onSelectDate,
  baseDate,
  focusTrigger,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Tepat 7 hari minggu aktual dari Senin hingga Minggu
  const days = useMemo(() => getCurrentWeekDays(baseDate), [baseDate]);

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
      className="flex items-center justify-between py-2 no-scrollbar scroll-smooth gap-1 sm:gap-1.5 w-full select-none"
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
            className={`flex flex-col items-center justify-center transition-all duration-300 flex-1 min-w-0 ${
              isSelected
                ? 'py-3 sm:py-3.5 rounded-full bg-gradient-to-b from-[#FF7E98] to-[#FF5376] text-white shadow-pill-coral transform -translate-y-0.5'
                : item.isToday
                ? 'py-2.5 sm:py-3 rounded-full bg-white text-slate-800'
                : 'py-2.5 sm:py-3 rounded-full bg-white/95 hover:bg-white text-slate-500 hover:text-slate-700 shadow-soft-sm'
            }`}
          >
            <span
              className={`text-sm sm:text-base leading-tight ${
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
