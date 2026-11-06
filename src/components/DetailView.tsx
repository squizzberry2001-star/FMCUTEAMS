import React from 'react';
import { ChevronLeft, MoreVertical, CheckCircle2, Calendar, Activity, Pill, Check } from 'lucide-react';
import { Medicine } from '../types';
import { MeglitinidesHero3D, ParacetamolHero3D } from './3d-icons/Illustrations';

interface DetailViewProps {
  medicine: Medicine;
  onBack: () => void;
  onRemove: (id: string) => void;
  onEditSchedule?: (medicine: Medicine) => void;
  onToggleTaken?: (id: string) => void;
}

export const DetailView: React.FC<DetailViewProps> = ({
  medicine,
  onBack,
  onRemove,
  onEditSchedule,
  onToggleTaken,
}) => {
  const getTagStyle = (tag: string) => {
    const lower = tag.toLowerCase();
    if (lower.includes('breakfast')) {
      return 'bg-[#FFF0E7] text-[#FF9E79]';
    }
    if (lower.includes('dinner')) {
      return 'bg-[#EAF8F2] text-[#2BB3A0]';
    }
    if (lower.includes('lunch')) {
      return 'bg-[#FFEAF0] text-[#FF6B8B]';
    }
    return 'bg-[#EEF3FF] text-[#5C7CFA]';
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F9FD] overflow-y-auto no-scrollbar relative">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2 z-10">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-slate-700 shadow-soft-sm transition-transform active:scale-95"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <h3 className="font-bold text-slate-800 text-base">
          {medicine.name}
        </h3>

        <button className="w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-slate-700 shadow-soft-sm">
          <MoreVertical className="w-5 h-5 text-teal-600" />
        </button>
      </div>

      {/* 3D Hero Illustration Area */}
      <div className="relative flex flex-col items-center justify-center pt-2 pb-6 px-6">
        {/* Ambient Blur Behind Hero */}
        <div className="absolute w-52 h-52 bg-gradient-to-tr from-teal-100/50 via-amber-100/40 to-pink-100/50 rounded-full blur-2xl -z-0 pointer-events-none" />

        {/* 3D Illustration */}
        <div className="relative z-10 transition-transform duration-500 hover:scale-105">
          {medicine.name.toLowerCase().includes('meglitinide') ? (
            <MeglitinidesHero3D className="w-48 h-48 drop-shadow-md" />
          ) : (
            <ParacetamolHero3D className="w-48 h-48 drop-shadow-md" />
          )}
        </div>

        {/* Floating Remove Button on the right */}
        <div className="w-full flex justify-end pr-2 -mt-4 z-20">
          <button
            onClick={() => onRemove(medicine.id)}
            className="px-5 py-1.5 rounded-full bg-gradient-to-r from-[#FF7E98] to-[#FF5376] text-white text-xs font-semibold shadow-pill-coral hover:brightness-105 active:scale-95 transition-all"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Content Sheet / Card */}
      <div className="bg-white rounded-t-[36px] flex-1 px-6 pt-6 pb-8 shadow-soft-card flex flex-col justify-between">
        <div>
          {/* Title */}
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {medicine.name}
          </h2>

          {/* Description */}
          <p className="text-xs text-slate-400 font-normal leading-relaxed mt-2.5">
            {medicine.description ||
              'They bind to an ATP-dependent (KATP) channel on the cell membrane of pancreatic beta cells move manner to sulfonylureas but have a weaker affinity.'}
          </p>

          {/* Timing Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {medicine.times.map((t, i) => (
              <span
                key={i}
                className={`px-3 py-1 rounded-full text-xs font-medium tracking-wide ${getTagStyle(t)}`}
              >
                {t}
              </span>
            ))}
          </div>

          {/* 2x2 Info Grid */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            {/* Amount */}
            <div className="bg-[#F8FAFC] rounded-2xl p-3 flex items-center gap-3 border border-slate-100/80">
              <div className="w-9 h-9 rounded-xl bg-[#EAF8F2] flex items-center justify-center text-[#2BB3A0] flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-medium leading-none">
                  Amount
                </span>
                <span className="block text-xs font-bold text-slate-800 mt-1">
                  {medicine.amount}
                </span>
              </div>
            </div>

            {/* This Month */}
            <div className="bg-[#F8FAFC] rounded-2xl p-3 flex items-center gap-3 border border-slate-100/80">
              <div className="w-9 h-9 rounded-xl bg-[#FFF4ED] flex items-center justify-center text-[#FF9E79] flex-shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-medium leading-none">
                  This Month
                </span>
                <span className="block text-xs font-bold text-slate-800 mt-1">
                  {medicine.thisMonthProgress}
                </span>
              </div>
            </div>

            {/* Cause */}
            <div className="bg-[#F8FAFC] rounded-2xl p-3 flex items-center gap-3 border border-slate-100/80">
              <div className="w-9 h-9 rounded-xl bg-[#FFEAF0] flex items-center justify-center text-[#FF6B8B] flex-shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-medium leading-none">
                  Cause
                </span>
                <span className="block text-xs font-bold text-slate-800 mt-1">
                  {medicine.cause}
                </span>
              </div>
            </div>

            {/* Cap Size */}
            <div className="bg-[#F8FAFC] rounded-2xl p-3 flex items-center gap-3 border border-slate-100/80">
              <div className="w-9 h-9 rounded-xl bg-[#EEF3FF] flex items-center justify-center text-[#5C7CFA] flex-shrink-0">
                <Pill className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-medium leading-none">
                  Cap Size
                </span>
                <span className="block text-xs font-bold text-slate-800 mt-1">
                  {medicine.capSize}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button at Bottom */}
        <div className="mt-8 flex flex-col gap-2.5">
          {onToggleTaken && (
            <button
              onClick={() => onToggleTaken(medicine.id)}
              className={`w-full py-3 rounded-full font-semibold text-xs tracking-wide transition-all duration-300 flex items-center justify-center gap-2 ${
                medicine.takenToday
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              {medicine.takenToday ? 'Dose Taken Today (Click to Undo)' : 'Mark as Taken Today'}
            </button>
          )}

          <button
            onClick={() => onEditSchedule && onEditSchedule(medicine)}
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white font-semibold text-sm shadow-pill-teal hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center"
          >
            Edit Schedule
          </button>
        </div>
      </div>
    </div>
  );
};
