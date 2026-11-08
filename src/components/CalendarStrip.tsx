import React from 'react';

interface CalendarStripProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  baseDate?: string; // Optional reference date for week navigation
}

export interface CalendarDayItem {
  dateObj: Date;
  dateString: string;
  num: number;
  label: string;
  fullLabel: string;
  dayName?: string;
  isToday: boolean;
  isWeekend?: boolean;
  isCurrentSunday?: boolean;
}

export const getCurrentWeekDays = (referenceDateStr?: string): CalendarDayItem[] => {
  const now = new Date();
  const actualDayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const isActualSunday = actualDayOfWeek === 0;

  const yyyyNow = now.getFullYear();
  const mmNow = String(now.getMonth() + 1).padStart(2, '0');
  const ddNow = String(now.getDate()).padStart(2, '0');
  const todayStr = `${yyyyNow}-${mmNow}-${ddNow}`;

  // Find Monday of running week:
  // If actual day is Sunday, running week shifts to next Monday (now + 1 day)
  const mondayOffset = actualDayOfWeek === 0 ? 1 : 1 - actualDayOfWeek;
  const runningMondayDate = new Date(now);
  runningMondayDate.setDate(now.getDate() + mondayOffset);
  const runningMondayStr = `${runningMondayDate.getFullYear()}-${String(
    runningMondayDate.getMonth() + 1
  ).padStart(2, '0')}-${String(runningMondayDate.getDate()).padStart(2, '0')}`;

  // Determine target Monday based on referenceDateStr:
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

  const targetMondayStr = `${targetMonday.getFullYear()}-${String(
    targetMonday.getMonth() + 1
  ).padStart(2, '0')}-${String(targetMonday.getDate()).padStart(2, '0')}`;
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
    });
  }

  // 7 Hari (Senin s/d Minggu depan / minggu terpilih)
  for (let i = 0; i < 7; i++) {
    const d = new Date(targetMonday);
    d.setDate(targetMonday.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    days.push({
      dateObj: d,
      dateString: dateStr,
      num: d.getDate(),
      label: dayLabels[i],
      fullLabel: fullDayLabels[i],
      dayName: dayNames[i],
      isToday: dateStr === todayStr,
      isWeekend: i === 5 || i === 6,
    });
  }

  return days;
};

export const CalendarStrip: React.FC<CalendarStripProps> = ({
  selectedDate,
  onSelectDate,
  baseDate,
}) => {
  const weekDays = getCurrentWeekDays(baseDate || selectedDate);
  const isEightPills = weekDays.length === 8;

  return (
    <div
      className={`flex items-center justify-between overflow-x-auto py-2 no-scrollbar ${
        isEightPills ? 'gap-1 sm:gap-1.5' : 'gap-1.5'
      }`}
    >
      {weekDays.map((item) => {
        const isSelected = item.dateString === selectedDate;
        return (
          <button
            key={item.dateString}
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
            className={`flex flex-col items-center justify-center transition-all duration-300 flex-1 ${
              isEightPills ? 'min-w-[36px] sm:min-w-[42px] px-0.5 sm:px-1' : 'min-w-[42px]'
            } ${
              isSelected
                ? 'py-3 sm:py-3.5 rounded-full bg-gradient-to-b from-[#FF7E98] to-[#FF5376] text-white shadow-pill-coral transform -translate-y-0.5'
                : item.isToday
                ? 'py-2.5 sm:py-3 rounded-full bg-white text-slate-800'
                : 'py-2.5 sm:py-3 rounded-full bg-white/90 hover:bg-white text-slate-400 hover:text-slate-600 shadow-soft-sm'
            }`}
          >
            <span
              className={`${isEightPills ? 'text-sm sm:text-base' : 'text-base'} leading-tight ${
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

