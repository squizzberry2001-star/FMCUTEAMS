import React from 'react';
import { MoreVertical, Check } from 'lucide-react';
import { Medicine } from '../types';
import { CapsuleIcon3D, BottleIcon3D, SyringeIcon3D, BlisterIcon3D } from './3d-icons/Illustrations';

interface MedicineCardProps {
  medicine: Medicine;
  onClick: (medicine: Medicine) => void;
  onToggleTaken?: (id: string, e: React.MouseEvent) => void;
  onOpenMenu?: (medicine: Medicine, e: React.MouseEvent) => void;
}

export const MedicineCard: React.FC<MedicineCardProps> = ({
  medicine,
  onClick,
  onToggleTaken,
  onOpenMenu,
}) => {
  const renderIcon = () => {
    switch (medicine.type) {
      case 'bottle':
        return <BottleIcon3D className="w-12 h-12" />;
      case 'syringe':
        return <SyringeIcon3D className="w-12 h-12" />;
      case 'tablet':
        return <BlisterIcon3D className="w-12 h-12" />;
      case 'capsule':
      default:
        return <CapsuleIcon3D className="w-12 h-12" />;
    }
  };

  const getTagStyle = (tag: string) => {
    const lower = tag.toLowerCase();
    if (lower.includes('breakfast')) {
      return 'bg-[#EAF8F2] text-[#2BB3A0]';
    }
    if (lower.includes('dinner')) {
      return 'bg-[#FFF0E7] text-[#FF9E79]';
    }
    if (lower.includes('lunch')) {
      return 'bg-[#FFEAF0] text-[#FF6B8B]';
    }
    return 'bg-[#EEF3FF] text-[#5C7CFA]';
  };

  return (
    <div
      onClick={() => onClick(medicine)}
      className={`group relative bg-white rounded-[26px] p-3.5 sm:p-4 transition-all duration-300 hover:shadow-soft-md cursor-pointer border border-transparent hover:border-teal-100/60 shadow-soft-card flex items-center justify-between gap-3 ${
        medicine.takenToday ? 'opacity-85 bg-slate-50/80' : ''
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {/* 3D Icon Container with soft background */}
        <div className="relative flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/60 flex items-center justify-center p-1 group-hover:scale-105 transition-transform">
          {renderIcon()}
          {medicine.takenToday && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#2BB3A0] text-white flex items-center justify-center shadow-sm">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
          )}
        </div>

        {/* Text Info */}
        <div className="min-w-0">
          <h4 className="font-bold text-slate-800 text-[15px] leading-tight truncate group-hover:text-teal-700 transition-colors">
            {medicine.name}
          </h4>
          <p className="text-[12px] text-slate-400 font-medium mt-0.5">
            {medicine.strength}, {medicine.dosageForm}
          </p>

          {/* Time tags */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {medicine.times.map((time, idx) => (
              <span
                key={idx}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${getTagStyle(time)}`}
              >
                {time}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Actions: Menu & Quick Take Check */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {onToggleTaken && (
          <button
            title={medicine.takenToday ? "Dose taken today" : "Mark as taken"}
            onClick={(e) => onToggleTaken(medicine.id, e)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              medicine.takenToday
                ? 'bg-teal-50 text-teal-600'
                : 'text-slate-300 hover:text-teal-600 hover:bg-teal-50'
            }`}
          >
            <Check className={`w-4 h-4 ${medicine.takenToday ? 'stroke-[2.5]' : ''}`} />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenMenu) onOpenMenu(medicine, e);
          }}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
