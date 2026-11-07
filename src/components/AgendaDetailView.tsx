import React from 'react';
import {
  ChevronLeft,
  Calendar,
  Clock,
  MapPin,
  User as UserIcon,
  Share2,
  Camera,
  Store,
  Building2,
  ClipboardCheck,
  Users,
  GraduationCap,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { ScheduleAgenda, ScheduleCategory } from '../types';

interface AgendaDetailViewProps {
  agenda: ScheduleAgenda;
  onBack: () => void;
  onOpenVisitForm?: () => void;
}

export const AgendaDetailView: React.FC<AgendaDetailViewProps> = ({
  agenda,
  onBack,
  onOpenVisitForm,
}) => {
  const renderCategoryIcon = (category: ScheduleCategory) => {
    switch (category) {
      case 'VISIT':
        return (
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#32C2AD] to-[#20A894] flex items-center justify-center text-white shadow-pill-teal">
            <Store className="w-8 h-8 stroke-[2.2]" />
          </div>
        );
      case 'NSO':
        return (
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#FF7E98] to-[#FF5376] flex items-center justify-center text-white shadow-pill-coral">
            <Building2 className="w-8 h-8 stroke-[2.2]" />
          </div>
        );
      case 'AUDIT':
        return (
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#FBBF24] to-[#F59E0B] flex items-center justify-center text-white shadow-sm">
            <ClipboardCheck className="w-8 h-8 stroke-[2.2]" />
          </div>
        );
      case 'MEETING':
        return (
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#60A5FA] to-[#3B82F6] flex items-center justify-center text-white shadow-pill-blue">
            <Users className="w-8 h-8 stroke-[2.2]" />
          </div>
        );
      case 'TRAINING':
      default:
        return (
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#A855F7] to-[#8B5CF6] flex items-center justify-center text-white shadow-sm">
            <GraduationCap className="w-8 h-8 stroke-[2.2]" />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#F8F9FD] select-none">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-5 pt-[max(1.5rem,env(safe-area-inset-top,24px))] pb-3.5 flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full iphone-glass-icon-btn flex items-center justify-center text-slate-700 active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Detail Agenda FMCU
        </span>

        <button
          onClick={() => {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(`${agenda.title} - ${agenda.date} ${agenda.time} WIB di ${agenda.location}`);
              alert('Informasi agenda disalin ke clipboard!');
            }
          }}
          className="w-10 h-10 rounded-full iphone-glass-icon-btn flex items-center justify-center text-slate-600 active:scale-95 transition-transform"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 sm:px-6 py-6 space-y-5 pb-24">
        {/* Hero Card */}
        <div className="relative bg-white rounded-[32px] p-6 shadow-soft-card border border-slate-100 overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-teal-100/30 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start gap-4">
            {renderCategoryIcon(agenda.category)}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                  {agenda.category}
                </span>
                {agenda.priority === 'HIGH' && (
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                    Prioritas Tinggi
                  </span>
                )}
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  Admin Managed
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 leading-snug">
                {agenda.title}
              </h2>
            </div>
          </div>
        </div>

        {/* Operational Schedule Info */}
        <div className="bg-white rounded-[28px] p-5 shadow-soft-card border border-slate-100 space-y-3.5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Informasi Operasional
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {/* Tanggal */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                <span className="text-[10px] font-bold uppercase">Tanggal</span>
              </div>
              <p className="text-xs font-bold text-slate-800">{agenda.date}</p>
            </div>

            {/* Waktu */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[10px] font-bold uppercase">Waktu</span>
              </div>
              <p className="text-xs font-bold text-slate-800">{agenda.time} WIB</p>
            </div>
          </div>

          {/* Lokasi Toko */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Lokasi Toko / Cabang
              </span>
              <p className="text-xs font-bold text-slate-800 mt-0.5">{agenda.location}</p>
            </div>
          </div>

          {/* PIC / Petugas Lapangan */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Penanggung Jawab (PIC)
              </span>
              <p className="text-xs font-bold text-slate-800 mt-0.5">{agenda.pic}</p>
              <span className="text-[10px] text-slate-400">Dibuat oleh: {agenda.createdBy || 'Admin FMCU'}</span>
            </div>
          </div>
        </div>

        {/* Instruksi & Catatan Kerja */}
        <div className="bg-white rounded-[28px] p-5 shadow-soft-card border border-slate-100 space-y-2.5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Instruksi & Catatan Detail
          </h3>
          <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
            {agenda.description || 'Tidak ada catatan tambahan untuk agenda ini.'}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {agenda.tags.map((tag, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-100"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* KHUSUS AGENDA VISIT: Tombol BUKA FORM VISIT */}
        {agenda.category === 'VISIT' && (
          <div className="bg-gradient-to-br from-emerald-500/10 via-teal-50 to-white rounded-[28px] p-5 border-2 border-emerald-500/30 shadow-soft-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#00A389] text-white flex items-center justify-center font-black text-xs">
                  FM
                </div>
                <span className="text-xs font-black text-slate-900 tracking-tight">
                  FMCU Visit Store Report
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Khusus Agenda Visit
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Buka formulir inspeksi toko, input lembar QSC/FamiTrack, data store crew, observasi temuan OPI & QSC, serta unggah bukti foto lapangan.
            </p>
            <button
              onClick={onOpenVisitForm}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00A389] to-[#00826D] text-white text-xs font-extrabold shadow-pill-teal hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" />
              <span>BUKA FORM VISIT REPORT</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
