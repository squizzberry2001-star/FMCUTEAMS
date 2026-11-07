import React from 'react';

interface CalendarStripProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
}

export const getCurrentWeekDays = () => {
  const now = new Date();
  const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  // Distance to Monday (if Sunday, distance is -6; if Monday, distance is 0)
  const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  
  const monday = new Date(now);
  monday.setDate(now.getDate() + distanceToMonday);

  const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const fullDayLabels = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
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

export const CalendarStrip: React.FC<CalendarStripProps> = ({ selectedDate, onSelectDate }) => {
  const weekDays = getCurrentWeekDays();

  return (
    <div className="flex items-center justify-between gap-1.5 overflow-x-auto py-2 no-scrollbar">
      {weekDays.map((item) => {
        const isSelected = item.dateString === selectedDate;
        return (
          <button
            key={item.dateString}
            onClick={() => onSelectDate(item.dateString)}
            className={`flex flex-col items-center justify-center transition-all duration-300 flex-1 min-w-[42px] ${
              isSelected
                ? 'py-3.5 rounded-full bg-gradient-to-b from-[#FF7E98] to-[#FF5376] text-white shadow-pill-coral transform -translate-y-0.5'
                : 'py-3 rounded-full bg-white/90 hover:bg-white text-slate-400 hover:text-slate-600 shadow-soft-sm'
            }`}
          >
            <span className={`text-base font-bold leading-tight ${isSelected ? 'text-white' : 'text-slate-800'}`}>
              {item.num}
            </span>
            <span className={`text-[10px] font-semibold mt-0.5 ${isSelected ? 'text-white/95' : 'text-slate-400'}`}>
              {item.label}
            </span>
            {item.isToday && !isSelected && (
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1" />
            )}
          </button>
        );
      })}
    </div>
  );
};
