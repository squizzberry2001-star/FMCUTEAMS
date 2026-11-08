import React from 'react';

interface CalendarStripProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  baseDate?: string; // Optional reference date for week navigation
}

export const getCurrentWeekDays = (referenceDateStr?: string) => {
  const base = referenceDateStr ? new Date(referenceDateStr + 'T12:00:00') : new Date();
  const currentDay = base.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  // Distance to Monday (if Sunday, distance is -6; if Monday, distance is 0)
  const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  
  const monday = new Date(base);
  monday.setDate(base.getDate() + distanceToMonday);

  const now = new Date();
  const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const fullDayLabels = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    days.push({
      dateObj: d,
      dateString: dateStr,
      num: d.getDate(),
      label: dayLabels[i],
      fullLabel: fullDayLabels[i],
      isToday: d.toDateString() === now.toDateString(),
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

  return (
    <div className="flex items-center justify-between gap-1.5 overflow-x-auto py-2 no-scrollbar">
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
            className={`flex flex-col items-center justify-center transition-all duration-300 flex-1 min-w-[42px] ${
              isSelected
                ? 'py-3.5 rounded-full bg-gradient-to-b from-[#FF7E98] to-[#FF5376] text-white shadow-pill-coral transform -translate-y-0.5'
                : item.isToday
                ? 'py-3 rounded-full bg-white text-slate-800'
                : 'py-3 rounded-full bg-white/90 hover:bg-white text-slate-400 hover:text-slate-600 shadow-soft-sm'
            }`}
          >
            <span
              className={`text-base leading-tight ${
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
              className={`text-[10px] mt-0.5 ${
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
