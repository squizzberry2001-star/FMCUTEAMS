import React from 'react';
import { MoreVertical, Check, Store, Building2, ClipboardCheck, Users, GraduationCap, Clock, MapPin } from 'lucide-react';
import { ScheduleAgenda, ScheduleCategory } from '../types';

interface ScheduleCardProps {
  agenda: ScheduleAgenda;
  onClick?: (agenda: ScheduleAgenda) => void;
  onToggleComplete?: (id: string, e: React.MouseEvent) => void;
  onOpenMenu?: (agenda: ScheduleAgenda, e: React.MouseEvent) => void;
}

export const ScheduleCard: React.FC<ScheduleCardProps> = ({
  agenda,
  onClick,
  onToggleComplete,
  onOpenMenu,
}) => {
  const renderCategoryIcon = (category: ScheduleCategory) => {
    switch (category) {
      case 'VISIT':
        return (
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#32C2AD] to-[#20A894] flex items-center justify-center text-white shadow-pill-teal">
            <Store className="w-6 h-6 stroke-[2.2]" />
          </div>
        );
      case 'NSO':
        return (
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF7E98] to-[#FF5376] flex items-center justify-center text-white shadow-pill-coral">
            <Building2 className="w-6 h-6 stroke-[2.2]" />
          </div>
        );
      case 'AUDIT':
        return (
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FBBF24] to-[#F59E0B] flex items-center justify-center text-white shadow-sm">
            <ClipboardCheck className="w-6 h-6 stroke-[2.2]" />
          </div>
        );
      case 'MEETING':
        return (
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#60A5FA] to-[#3B82F6] flex items-center justify-center text-white shadow-pill-blue">
            <Users className="w-6 h-6 stroke-[2.2]" />
          </div>
        );
      case 'TRAINING':
      default:
        return (
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#A855F7] to-[#8B5CF6] flex items-center justify-center text-white shadow-sm">
            <GraduationCap className="w-6 h-6 stroke-[2.2]" />
          </div>
        );
    }
  };

  const getTagStyle = (tag: string, index: number) => {
    if (index === 0) return 'bg-[#EAF8F2] text-[#2BB3A0]';
    if (index === 1) return 'bg-[#FFF0E7] text-[#FF9E79]';
    return 'bg-[#EEF3FF] text-[#5C7CFA]';
  };

  return (
    <div
      onClick={() => onClick && onClick(agenda)}
      className={`group relative bg-white rounded-[26px] p-3.5 sm:p-4 transition-all duration-300 hover:shadow-soft-md cursor-pointer border border-transparent hover:border-teal-100/60 shadow-soft-card flex items-center justify-between gap-3 ${
        agenda.completed ? 'opacity-85 bg-slate-50/80' : ''
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Category Icon Container */}
        <div className="relative flex-shrink-0 group-hover:scale-105 transition-transform">
          {renderCategoryIcon(agenda.category)}
          {agenda.completed && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#2BB3A0] text-white flex items-center justify-center shadow-sm">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
          )}
        </div>

        {/* Text Info */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
              {agenda.category}
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              {agenda.time} WIB
            </span>
          </div>

          <h4 className={`font-bold text-[13px] leading-snug line-clamp-1 mt-0.5 group-hover:text-teal-700 transition-colors ${
            agenda.completed ? 'text-slate-500 line-through' : 'text-slate-800'
          }`}>
            {agenda.title}
          </h4>

          <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate flex items-center gap-1">
            <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <span className="truncate">{agenda.location}</span>
          </p>

          {/* Time & Category Tags */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {agenda.tags.map((tag, idx) => (
              <span
                key={idx}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${getTagStyle(tag, idx)}`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Actions: Menu & Complete Check */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {onToggleComplete && (
          <button
            title={agenda.completed ? "Tandai belum selesai" : "Tandai selesai"}
            onClick={(e) => onToggleComplete(agenda.id, e)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              agenda.completed
                ? 'bg-teal-50 text-teal-600'
                : 'text-slate-300 hover:text-teal-600 hover:bg-teal-50'
            }`}
          >
            <Check className={`w-4 h-4 ${agenda.completed ? 'stroke-[2.5]' : ''}`} />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenMenu) onOpenMenu(agenda, e);
          }}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
