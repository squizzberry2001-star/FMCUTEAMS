import React, { useState } from 'react';
import {
  ClipboardCheck,
  Plus,
  Store,
  Calendar,
  User,
  CheckCircle2,
  Lock,
  ChevronRight,
  Camera,
  Search
} from 'lucide-react';
import { VisitReport, EncryptedPhotoItem } from '../types';

interface FmcuVisitViewProps {
  visits: VisitReport[];
  onOpenNewVisit: () => void;
  onSelectPhoto: (photo: EncryptedPhotoItem) => void;
}

export const FmcuVisitView: React.FC<FmcuVisitViewProps> = ({
  visits,
  onOpenNewVisit,
  onSelectPhoto,
}) => {
  const [selectedVisit, setSelectedVisit] = useState<VisitReport | null>(visits[0] || null);
  const [search, setSearch] = useState('');

  const filteredVisits = visits.filter(
    (v) =>
      v.storeName.toLowerCase().includes(search.toLowerCase()) ||
      v.visitorName.toLowerCase().includes(search.toLowerCase()) ||
      v.purpose.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-[#F8F9FD]">
      {/* List Column */}
      <div className="w-full lg:w-96 border-r border-slate-200/60 bg-white flex flex-col p-5 overflow-y-auto no-scrollbar flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">
              Audit Lapangan
            </span>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">
              Laporan Visit Toko
            </h2>
          </div>
          <button
            onClick={onOpenNewVisit}
            className="w-9 h-9 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white flex items-center justify-center shadow-pill-teal hover:scale-105 active:scale-95 transition-all"
            title="Buat Laporan Visit Baru"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari toko / visitor..."
            className="w-full bg-[#F8FAFC] border border-slate-200/70 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-teal-500"
          />
        </div>

        {/* Visit Cards List */}
        <div className="space-y-2.5">
          {filteredVisits.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Belum ada laporan visit ditemukan.
            </div>
          ) : (
            filteredVisits.map((v) => {
              const isSelected = selectedVisit?.id === v.id;
              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVisit(v)}
                  className={`p-3.5 rounded-2xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-teal-50/50 border-teal-300 shadow-sm'
                      : 'bg-[#F8FAFC] hover:bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-slate-800 text-xs truncate">
                      {v.storeName}
                    </h4>
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-100/70 px-2 py-0.5 rounded-full flex-shrink-0">
                      {v.visitDate}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                    {v.purpose}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/40 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1 font-semibold text-slate-600">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{v.visitorName}</span>
                    </span>

                    <span className="flex items-center gap-1 font-bold text-teal-600">
                      <Camera className="w-3 h-3" />
                      <span>{v.photos.length} Foto</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Detail Column */}
      <div className="flex-1 p-6 lg:p-8 overflow-y-auto no-scrollbar">
        {selectedVisit ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Store Header Card */}
            <div className="bg-white rounded-[28px] p-6 shadow-soft-card border border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                      {selectedVisit.storeCode || 'VISIT'}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Tanggal: {selectedVisit.visitDate}
                    </span>
                  </div>
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight mt-1">
                    {selectedVisit.storeName}
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right sm:block hidden">
                    <span className="block text-[11px] text-slate-400 font-medium">Auditor / Visitor</span>
                    <span className="block text-xs font-bold text-slate-700">{selectedVisit.visitorName}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4">
                <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Tujuan Kunjungan
                </span>
                <p className="text-xs font-bold text-slate-700">{selectedVisit.purpose}</p>
              </div>
            </div>

            {/* Checklist Results Card */}
            <div className="bg-white rounded-[28px] p-6 shadow-soft-card border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-3">
                Hasil Checklist Standar Toko
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { label: 'Kebersihan & Kerapihan Area Toko', status: selectedVisit.checklists.cleanliness },
                  { label: 'Display & Visual Merchandising', status: selectedVisit.checklists.displayVm },
                  { label: 'Ketersediaan Stok & Planogram', status: selectedVisit.checklists.stockAvailability },
                  { label: 'Kesiapan Kasir & IT POS', status: selectedVisit.checklists.cashierIt },
                  { label: 'Standar SOP & Hospitality Staff', status: selectedVisit.checklists.sopCompliance },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#F8FAFC] flex items-center justify-between border border-slate-100"
                  >
                    <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" /> OK
                    </span>
                  </div>
                ))}
              </div>

              {/* Notes & Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
                    Catatan Temuan
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {selectedVisit.notes || 'Tidak ada catatan temuan.'}
                  </p>
                </div>

                <div className="bg-teal-50/50 p-4 rounded-2xl border border-teal-100">
                  <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block mb-1">
                    Tindakan Perbaikan (*Action Items*)
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {selectedVisit.actionItems || 'Semua standar telah terpenuhi.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Photo Documentation Gallery (Decrypted in Browser) */}
            <div className="bg-white rounded-[28px] p-6 shadow-soft-card border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-teal-600" />
                  <h3 className="text-sm font-bold text-slate-800">
                    Dokumentasi Foto Visit ({selectedVisit.photos.length})
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1 rounded-full">
                  <Lock className="w-3 h-3 text-teal-600" />
                  <span>Google Drive Encrypted</span>
                </span>
              </div>

              {selectedVisit.photos.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Belum ada foto dokumentasi untuk kunjungan ini.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {selectedVisit.photos.map((photo) => (
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
                        <span className="text-[9px] text-teal-300 font-normal">Klik untuk perbesar</span>
                      </div>
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5 text-teal-400" />
                        <span>AES-256</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">
            Pilih laporan visit untuk melihat detail.
          </div>
        )}
      </div>
    </div>
  );
};
