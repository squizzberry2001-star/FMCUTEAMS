import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Plus,
  CheckCircle2,
  AlertCircle,
  Tag,
  ClipboardCheck,
  Building2,
  CalendarDays
} from 'lucide-react';
import { FmcuAgenda, AgendaType } from '../types';

interface FmcuAgendaViewProps {
  agendas: FmcuAgenda[];
  onOpenNewAgenda: () => void;
  onOpenNewVisit: () => void;
  onOpenNewNso: () => void;
  onToggleStatus: (id: string) => void;
}

export const FmcuAgendaView: React.FC<FmcuAgendaViewProps> = ({
  agendas,
  onOpenNewAgenda,
  onOpenNewVisit,
  onOpenNewNso,
  onToggleStatus,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredAgendas = agendas.filter((item) => {
    if (filterType === 'ALL') return true;
    return item.type === filterType;
  });

  const getTypeStyle = (type: AgendaType) => {
    switch (type) {
      case 'VISIT':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'NSO':
        return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'MEETING':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'INSPECTION':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'TRAINING':
      default:
        return 'bg-purple-50 text-purple-700 border-purple-200';
    }
  };

  return (
    <div className="flex-1 p-5 sm:p-7 overflow-y-auto no-scrollbar max-w-6xl mx-auto w-full">
      {/* Top Banner Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">
            Jadwal & Agenda Lapangan
          </span>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            Agenda Kegiatan FMCU
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Kelola jadwal visit audit, timeline NSO toko baru, dan agenda koordinasi tim.
          </p>
        </div>

        {/* 3 Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenNewVisit}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs font-bold transition-all"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>+ Form Visit</span>
          </button>

          <button
            onClick={onOpenNewNso}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 text-xs font-bold transition-all"
          >
            <Building2 className="w-4 h-4" />
            <span>+ Form NSO</span>
          </button>

          <button
            onClick={onOpenNewAgenda}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white text-xs font-bold shadow-pill-teal hover:brightness-105 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Tambah Agenda</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
        {[
          { key: 'ALL', label: 'Semua Agenda' },
          { key: 'VISIT', label: 'Store Visit' },
          { key: 'NSO', label: 'Proyek NSO' },
          { key: 'MEETING', label: 'Meeting' },
          { key: 'INSPECTION', label: 'Inspeksi' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterType(tab.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex-shrink-0 ${
              filterType === tab.key
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white hover:bg-slate-100 text-slate-500 border border-slate-200/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Agenda Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAgendas.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-slate-200/60 p-6">
            <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 text-xs font-medium">Tidak ada agenda untuk kategori ini.</p>
          </div>
        ) : (
          filteredAgendas.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-[26px] p-5 shadow-soft-card border border-slate-100/80 flex flex-col justify-between hover:shadow-soft-md transition-all group"
            >
              <div>
                {/* Header Type and Status */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getTypeStyle(item.type)}`}>
                    {item.type}
                  </span>

                  <button
                    onClick={() => onToggleStatus(item.id)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                      item.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : item.status === 'IN_PROGRESS'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.status}
                  </button>
                </div>

                <h3 className="font-extrabold text-slate-800 text-sm leading-snug group-hover:text-teal-700 transition-colors">
                  {item.title}
                </h3>

                <p className="text-xs text-slate-400 font-medium mt-1.5 leading-relaxed line-clamp-2">
                  {item.description || 'Tidak ada catatan tambahan.'}
                </p>

                {/* Details */}
                <div className="space-y-1.5 mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    <span>{item.date}</span>
                    <span className="text-slate-300">•</span>
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>{item.time} WIB</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-orange-500" />
                    <span className="truncate">{item.location}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>PIC: {item.pic}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Action */}
              <div className="mt-4 pt-3 flex items-center justify-end">
                <button
                  onClick={() => onToggleStatus(item.id)}
                  className="text-xs font-bold text-teal-600 hover:text-teal-700 transition-colors flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{item.status === 'COMPLETED' ? 'Selesai' : 'Tandai Selesai'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
