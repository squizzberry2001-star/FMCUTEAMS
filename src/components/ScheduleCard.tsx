import React from 'react';
import {
  Store,
  Building2,
  ClipboardCheck,
  Users,
  GraduationCap,
  MapPin,
  ChevronRight,
  Calendar,
  Clock,
  User as UserIcon,
} from 'lucide-react';
import { ScheduleAgenda, ScheduleCategory } from '../types';

interface ScheduleCardProps {
  agenda: ScheduleAgenda;
  onClick?: (agenda: ScheduleAgenda) => void;
  onOpenMenu?: (agenda: ScheduleAgenda, e: React.MouseEvent) => void;
}

const SHORT_DAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const SHORT_MONTHS_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

function formatAgendaDateLabel(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  const dayName = SHORT_DAYS_ID[dt.getDay()] || '';
  const monthName = SHORT_MONTHS_ID[m - 1] || '';
  return `${dayName}, ${String(d).padStart(2, '0')} ${monthName} ${y}`;
}

export const ScheduleCard: React.FC<ScheduleCardProps> = ({
  agenda,
  onClick,
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
    if (tag.toLowerCase().includes('prioritas') || tag.toLowerCase().includes('urgent')) {
      return 'bg-rose-50 text-rose-700 border border-rose-200/70';
    }
    if (index === 0) return 'bg-[#EAF8F2] text-[#2BB3A0] border border-teal-100';
    if (index === 1) return 'bg-[#FFF0E7] text-[#FF9E79] border border-orange-100';
    return 'bg-[#EEF3FF] text-[#5C7CFA] border border-blue-100';
  };

  return (
    <div
      onClick={() => onClick && onClick(agenda)}
      className="group relative bg-white rounded-[26px] p-3.5 sm:p-4 transition-all duration-300 hover:shadow-soft-md cursor-pointer border border-transparent hover:border-teal-100/60 shadow-soft-card flex items-start justify-between gap-3"
    >
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        {/* Category Icon Container */}
        <div className="relative flex-shrink-0 group-hover:scale-105 transition-transform mt-0.5">
          {renderCategoryIcon(agenda.category)}
        </div>

        {/* Text Info */}
        <div className="min-w-0 flex-1">
          {/* Date & Time Header */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80 flex-shrink-0">
              <Calendar className="w-2.5 h-2.5 text-teal-600" />
              <span>{formatAgendaDateLabel(agenda.date)}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100 flex-shrink-0">
              <Clock className="w-2.5 h-2.5 text-teal-600" />
              <span>
                {agenda.time}
                {agenda.endTime ? ` - ${agenda.endTime}` : ''} WIB
              </span>
            </span>
            {agenda.actualIn && (
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 flex-shrink-0">
                <span>IN: {agenda.actualIn.replace(/\s*WIB$/i, '')}</span>
                {agenda.actualOut ? (
                  <span>• OUT: {agenda.actualOut.replace(/\s*WIB$/i, '')}</span>
                ) : null}
              </span>
            )}
          </div>

          {/* Judul Agenda Lengkap (ditampilkan penuh tanpa terpotong) */}
          <h4 className="font-bold text-[13px] sm:text-sm leading-snug break-words mt-1.5 text-slate-900 group-hover:text-teal-700 transition-colors">
            {agenda.title}
          </h4>

          {/* Detail Nama PIC & Lokasi */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1 font-bold text-slate-700 max-w-full">
              <UserIcon className="w-3 h-3 text-teal-600 flex-shrink-0" />
              <span className="truncate">{agenda.pic || '-'}</span>
            </span>
            <span className="text-slate-500 font-medium truncate flex items-center gap-1 min-w-0">
              <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="truncate">{agenda.location}</span>
            </span>
          </div>

          {/* Badge Kecil Menyamping (Category, Prioritas Tinggi, dan Tags) */}
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar py-0.5">
            {/* Category Pill */}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200/60 flex-shrink-0">
              {agenda.category}
            </span>

            {/* Prioritas Tinggi Badge (Menyamping) */}
            {agenda.priority === 'HIGH' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200/70 flex-shrink-0">
                Prioritas Tinggi
              </span>
            )}

            {/* Tags Lainnya Menyamping */}
            {agenda.tags
              .filter((tag) => tag !== agenda.category && tag !== 'Prioritas Tinggi')
              .map((tag, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide flex-shrink-0 ${getTagStyle(tag, idx)}`}
                >
                  {tag}
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* Right Indicator: Chevron to detail view */}
      <div className="flex items-center gap-1 flex-shrink-0 mt-2 text-slate-300 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all">
        <ChevronRight className="w-4 h-4" />
      </div>
    </div>
  );
};
