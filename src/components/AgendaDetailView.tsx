import React from 'react';
import {
  ChevronLeft,
  Calendar,
  Clock,
  MapPin,
  User as UserIcon,
  Tag,
  CheckCircle2,
  Check,
  Share2,
  FileText,
  Camera,
  Store,
  Building2,
  ClipboardCheck,
  Users,
  GraduationCap,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ScheduleAgenda, ScheduleCategory } from '../types';

interface AgendaDetailViewProps {
  agenda: ScheduleAgenda;
  onBack: () => void;
  onToggleComplete: (id: string, e?: React.MouseEvent) => void;
}

export const AgendaDetailView: React.FC<AgendaDetailViewProps> = ({
  agenda,
  onBack,
  onToggleComplete,
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

  const handleToggle = (e: React.MouseEvent) => {
    onToggleComplete(agenda.id, e);
    if (!agenda.completed) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#2BB3A0', '#4ADE80', '#FF6B8B', '#FFD12E'],
      });
    }
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#F8F9FD] select-none">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors active:scale-95"
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
              alert('Link jadwal agenda disalin ke clipboard!');
            }
          }}
          className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
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
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                  {agenda.category}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  agenda.completed
                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                    : 'text-amber-700 bg-amber-50 border border-amber-200'
                }`}>
                  {agenda.completed ? 'Selesai Dilaksanakan' : 'Menunggu Pelaksanaan'}
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 leading-snug">
                {agenda.title}
              </h2>
            </div>
          </div>

          {/* Quick Complete Switch Button */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Status Penyelesaian:</span>
            <button
              onClick={handleToggle}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                agenda.completed
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-700'
              }`}
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{agenda.completed ? 'Agenda Selesai' : 'Tandai Selesai'}</span>
            </button>
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

        {/* Action Link: Form Visit / NSO */}
        <div className="bg-gradient-to-br from-teal-50 to-white rounded-[28px] p-5 border border-teal-100 shadow-soft-card space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-extrabold text-slate-800">
              Form Lapangan FMCU (Visit & NSO)
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Unggah foto dokumentasi toko dan input laporan hasil inspeksi langsung ke sistem.
          </p>
          <button
            onClick={() => alert(`Membuka Form untuk: ${agenda.title}\n(Terkoneksi ke Google Drive & Apps Script)`)}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white text-xs font-bold shadow-pill-teal hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" />
            <span>Buka Form Dokumentasi & Foto</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
