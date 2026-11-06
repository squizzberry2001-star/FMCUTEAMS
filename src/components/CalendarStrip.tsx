import React from 'react';

interface CalendarStripProps {
  selectedDay: number;
  onSelectDay: (day: number) => void;
}

export const CalendarStrip: React.FC<CalendarStripProps> = ({ selectedDay, onSelectDay }) => {
  const days = [
    { num: 4, label: 'Sat' },
    { num: 5, label: 'Sun' },
    { num: 6, label: 'Mon' },
    { num: 7, label: 'Tue' },
    { num: 8, label: 'Wed' },
    { num: 9, label: 'Thu' },
  ];

  return (
    <div className="flex items-center justify-between gap-2 overflow-x-auto py-2 no-scrollbar">
      {days.map((item) => {
        const isSelected = item.num === selectedDay;
        return (
          <button
            key={item.num}
            onClick={() => onSelectDay(item.num)}
            className={`flex flex-col items-center justify-center transition-all duration-300 ${
              isSelected
                ? 'w-12 py-3.5 rounded-full bg-gradient-to-b from-[#FF7E98] to-[#FF587A] text-white shadow-pill-coral transform -translate-y-0.5'
                : 'w-11 py-3 rounded-full bg-white/80 hover:bg-white text-slate-400 hover:text-slate-600 shadow-soft-sm'
            }`}
          >
            <span className={`text-base font-bold leading-tight ${isSelected ? 'text-white' : 'text-slate-800'}`}>
              {item.num}
            </span>
            <span className={`text-[11px] font-medium mt-0.5 ${isSelected ? 'text-white/90' : 'text-slate-400'}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
