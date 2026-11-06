import React from 'react';
import { ChevronLeft, Calendar as CalendarIcon, CheckCircle2, Clock } from 'lucide-react';
import { Medicine } from '../types';

interface CalendarScheduleViewProps {
  medicines: Medicine[];
  onBack: () => void;
  onSelectMedicine: (med: Medicine) => void;
}

export const CalendarScheduleView: React.FC<CalendarScheduleViewProps> = ({
  medicines,
  onBack,
  onSelectMedicine,
}) => {
  return (
    <div className="flex flex-col h-full bg-[#F8F9FD] overflow-y-auto no-scrollbar px-6 pt-6 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-700 shadow-soft-sm active:scale-95"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-extrabold text-slate-800">Medication Schedule</h2>
        <div className="w-10 h-10 rounded-full bg-[#EAF8F2] text-[#2BB3A0] flex items-center justify-center">
          <CalendarIcon className="w-5 h-5" />
        </div>
      </div>

      {/* Month Card */}
      <div className="bg-white rounded-3xl p-5 shadow-soft-card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-sm">November 2026</h3>
          <span className="text-xs font-bold text-teal-600 bg-teal-50 px-3 py-1 rounded-full">Week 45</span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <span key={i} className="text-[11px] font-bold text-slate-400 py-1">{d}</span>
          ))}
          {/* Days */}
          {[1, 2, 3, 4].map((d) => (
            <div key={d} className="py-2 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50">{d}</div>
          ))}
          {/* Active day 5 */}
          <div className="py-2 text-xs font-bold text-white bg-gradient-to-b from-[#FF7E98] to-[#FF587A] rounded-xl shadow-pill-coral">
            5
          </div>
          {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map((d) => (
            <div key={d} className="py-2 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50">{d}</div>
          ))}
        </div>
      </div>

      {/* Timeline Schedule for Today */}
      <h3 className="text-sm font-bold text-slate-800 mb-3 px-1">Today's Timeline</h3>
      <div className="space-y-3">
        {medicines.map((med, index) => (
          <div
            key={med.id}
            onClick={() => onSelectMedicine(med)}
            className="bg-white rounded-2xl p-4 shadow-soft-card flex items-center justify-between cursor-pointer hover:border-teal-200 border border-transparent transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-teal-600 font-bold text-xs">
                {index === 0 ? '08:00' : index === 1 ? '13:00' : '20:00'}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">{med.name}</h4>
                <p className="text-[11px] text-slate-400">{med.strength} • {med.times.join(', ')}</p>
              </div>
            </div>
            <div>
              {med.takenToday ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Taken
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                  <Clock className="w-3.5 h-3.5" /> Pending
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
