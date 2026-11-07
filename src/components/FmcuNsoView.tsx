import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Calendar,
  User,
  CheckCircle2,
  Lock,
  Camera,
  Percent,
  MapPin,
  Clock,
  Sparkles
} from 'lucide-react';
import { NsoProject, EncryptedPhotoItem } from '../types';

interface FmcuNsoViewProps {
  nsoProjects: NsoProject[];
  onOpenNewNso: () => void;
  onSelectPhoto: (photo: EncryptedPhotoItem) => void;
}

export const FmcuNsoView: React.FC<FmcuNsoViewProps> = ({
  nsoProjects,
  onOpenNewNso,
  onSelectPhoto,
}) => {
  const [selectedProject, setSelectedProject] = useState<NsoProject | null>(nsoProjects[0] || null);

  const getStatusBadge = (status: NsoProject['status']) => {
    switch (status) {
      case 'READY_TO_OPEN':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'FIT_OUT':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'STOCKING':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'PLANNING':
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-[#F8F9FD]">
      {/* Project List */}
      <div className="w-full lg:w-96 border-r border-slate-200/60 bg-white flex flex-col p-5 overflow-y-auto no-scrollbar flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[10px] font-bold text-pink-600 uppercase tracking-wider block">
              Ekspansi Toko
            </span>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">
              Proyek NSO Toko Baru
            </h2>
          </div>
          <button
            onClick={onOpenNewNso}
            className="w-9 h-9 rounded-full bg-gradient-to-r from-[#FF7E98] to-[#FF5376] text-white flex items-center justify-center shadow-pill-coral hover:scale-105 active:scale-95 transition-all"
            title="Tambah Proyek NSO Baru"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Project Cards */}
        <div className="space-y-3">
          {nsoProjects.map((proj) => {
            const isSelected = selectedProject?.id === proj.id;
            return (
              <div
                key={proj.id}
                onClick={() => setSelectedProject(proj)}
                className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-pink-50/40 border-pink-300 shadow-sm'
                    : 'bg-[#F8FAFC] hover:bg-slate-50 border-slate-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200">
                    {proj.storeCode}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(proj.status)}`}>
                    {proj.status}
                  </span>
                </div>

                <h4 className="font-bold text-slate-800 text-xs mt-2 truncate">
                  {proj.storeName}
                </h4>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mt-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>{proj.city}</span>
                  <span>•</span>
                  <span>Target: {proj.targetOpeningDate}</span>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className="text-slate-500">Kesiapan</span>
                    <span className="text-pink-600">{proj.progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-pink-400 to-pink-600 h-1.5 rounded-full"
                      style={{ width: `${proj.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Project Detail */}
      <div className="flex-1 p-6 lg:p-8 overflow-y-auto no-scrollbar">
        {selectedProject ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white rounded-[28px] p-6 shadow-soft-card border border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-pink-600 bg-pink-50 px-2.5 py-0.5 rounded-full border border-pink-200">
                      {selectedProject.storeCode}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Target Launching: {selectedProject.targetOpeningDate}
                    </span>
                  </div>
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight mt-1">
                    {selectedProject.storeName}
                  </h1>
                </div>

                <div className="text-right">
                  <span className="block text-[11px] text-slate-400 font-medium">PIC NSO Proyek</span>
                  <span className="block text-xs font-bold text-slate-700">{selectedProject.picNso}</span>
                </div>
              </div>

              {/* Progress Banner */}
              <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl p-4 text-white shadow-pill-coral">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-pink-100 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Status Kesiapan Fisik & Operasional</span>
                  </span>
                  <span className="text-xl font-black">{selectedProject.progressPercent}% Selesai</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-white h-2 rounded-full transition-all duration-300"
                    style={{ width: `${selectedProject.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Checklist 7 Pilar NSO */}
            <div className="bg-white rounded-[28px] p-6 shadow-soft-card border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-3">
                7 Pilar Kesiapan NSO FMCU
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { label: 'Pekerjaan Fisik & Fit-Out Bangunan', ok: selectedProject.checklist.civilFitout },
                  { label: 'Kelistrikan, AC & Pencahayaan ME', ok: selectedProject.checklist.electricalMe },
                  { label: 'Jaringan IT, POS Kasir & CCTV', ok: selectedProject.checklist.itPosNetwork },
                  { label: 'Rak Gondola, Display & Signboard', ok: selectedProject.checklist.shelvesSignage },
                  { label: 'Stocking Barang Awal Toko', ok: selectedProject.checklist.inventoryStock },
                  { label: 'Kesiapan Tim Kasir & Staff Toko', ok: selectedProject.checklist.manpowerReady },
                  { label: 'Perizinan Operasional & Legalitas', ok: selectedProject.checklist.licensesPermits },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#F8FAFC] flex items-center justify-between border border-slate-100"
                  >
                    <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                    {item.ok ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Siap
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        <Clock className="w-3.5 h-3.5" /> Proses
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {selectedProject.notes && (
                <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Catatan Progres NSO
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {selectedProject.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Photo Gallery Progress NSO */}
            <div className="bg-white rounded-[28px] p-6 shadow-soft-card border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-pink-600" />
                  <h3 className="text-sm font-bold text-slate-800">
                    Dokumentasi Foto Progres NSO ({selectedProject.photos.length})
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-200 px-2.5 py-1 rounded-full">
                  <Lock className="w-3 h-3 text-pink-600" />
                  <span>Google Drive Encrypted</span>
                </span>
              </div>

              {selectedProject.photos.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Belum ada foto progres untuk proyek NSO ini.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {selectedProject.photos.map((photo) => (
                    <div
                      key={photo.id}
                      onClick={() => onSelectPhoto(photo)}
                      className="group relative rounded-2xl overflow-hidden aspect-video bg-slate-100 cursor-pointer shadow-soft-sm hover:scale-[1.02] transition-transform"
                    >
                      <img
                        src={photo.previewUrl}
                        alt={photo.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-end text-white text-[11px] font-bold">
                        <span className="truncate">{photo.caption || photo.name}</span>
                        <span className="text-[9px] text-pink-300 font-normal">Klik untuk perbesar</span>
                      </div>
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5 text-pink-400" />
                        <span>AES-256</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
