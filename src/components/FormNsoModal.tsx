import React, { useState } from 'react';
import { X, Check, Building2, Calendar, User, Percent, MapPin } from 'lucide-react';
import { NsoProject, EncryptedPhotoItem } from '../types';
import { EncryptedPhotoUploader } from './EncryptedPhotoUploader';

interface FormNsoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (project: Omit<NsoProject, 'id' | 'createdAt'>) => void;
  currentUser?: { name: string };
}

export const FormNsoModal: React.FC<FormNsoModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentUser,
}) => {
  const [storeCode, setStoreCode] = useState('');
  const [storeName, setStoreName] = useState('');
  const [city, setCity] = useState('Bandung');
  const [picNso, setPicNso] = useState(currentUser?.name || 'Dimas Wicaksono');
  const [targetOpeningDate, setTargetOpeningDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });

  const [checklist, setChecklist] = useState({
    civilFitout: false,
    electricalMe: false,
    itPosNetwork: false,
    shelvesSignage: false,
    inventoryStock: false,
    manpowerReady: false,
    licensesPermits: true,
  });

  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<EncryptedPhotoItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Hitung otomatis progres % dari checklist
  const totalItems = Object.keys(checklist).length;
  const completedItems = Object.values(checklist).filter(Boolean).length;
  const calculatedProgress = Math.round((completedItems / totalItems) * 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;

    setIsSubmitting(true);
    await onSubmit({
      storeCode: storeCode || `NSO-${Date.now().toString().slice(-4)}`,
      storeName,
      city,
      picNso,
      targetOpeningDate,
      progressPercent: calculatedProgress,
      checklist,
      notes,
      photos,
      status: calculatedProgress >= 90 ? 'READY_TO_OPEN' : calculatedProgress >= 40 ? 'FIT_OUT' : 'PLANNING',
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-[36px] shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200 border border-slate-100 max-h-[92vh] overflow-y-auto no-scrollbar">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 absolute top-5 right-5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF7E98] to-[#FF5376] flex items-center justify-center text-white shadow-pill-coral flex-shrink-0">
            <Building2 className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                Form NSO (New Store Opening)
              </h2>
              <span className="text-[10px] font-bold text-pink-700 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200">
                Proyek Toko Baru
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Pantau kesiapan pembukaan toko baru & upload progres foto terenkripsi ke Drive.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Progress Indicator Card */}
          <div className="bg-gradient-to-br from-slate-50 via-teal-50/30 to-slate-50 rounded-2xl p-4 border border-teal-100/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-teal-600" />
                <span>Kesiapan Pembukaan Toko</span>
              </span>
              <span className="text-sm font-black text-teal-600">{calculatedProgress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-400 to-teal-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${calculatedProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">
              {completedItems} dari {totalItems} item kesiapan terpenuhi.
            </p>
          </div>

          {/* Nama Toko & Kode Toko */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-teal-600" />
                <span>Nama Proyek Toko Baru</span>
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Contoh: NSO Bandung Timur Soekarno Hatta"
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1">
                Kode Toko NSO
              </label>
              <input
                type="text"
                value={storeCode}
                onChange={(e) => setStoreCode(e.target.value)}
                placeholder="Contoh: BDO-024"
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>

          {/* Kota, PIC & Target Launching */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-orange-500" />
                <span>Kota / Wilayah</span>
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>PIC NSO</span>
              </label>
              <input
                type="text"
                required
                value={picNso}
                onChange={(e) => setPicNso(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                <span>Target Grand Opening</span>
              </label>
              <input
                type="date"
                required
                value={targetOpeningDate}
                onChange={(e) => setTargetOpeningDate(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>

          {/* Checklist Kesiapan Toko Baru */}
          <div>
            <label className="block text-xs text-slate-700 font-bold mb-2">
              Checklist Kesiapan Pembukaan
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
              {[
                { key: 'civilFitout', label: '1. Pengerjaan Fisik & Fit-Out Selesai' },
                { key: 'electricalMe', label: '2. Kelistrikan, Penerangan & AC Berfungsi' },
                { key: 'itPosNetwork', label: '3. Jaringan IT, Kasir POS & CCTV Online' },
                { key: 'shelvesSignage', label: '4. Rak Gondola & Signboard Terpasang' },
                { key: 'inventoryStock', label: '5. Stocking Barang Awal Siap' },
                { key: 'manpowerReady', label: '6. Tim Toko & Training Staff Siap' },
                { key: 'licensesPermits', label: '7. Izin Operasional & Legalitas Lengkap' },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={(checklist as any)[item.key]}
                    onChange={(e) =>
                      setChecklist({
                        ...checklist,
                        [item.key]: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500 border-slate-300"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Catatan Progres */}
          <div>
            <label className="block text-xs text-slate-700 font-bold mb-1">
              Catatan Progres Lapangan
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tuliskan status progres renovasi atau kendala perizinan..."
              className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl p-3 text-xs font-medium text-slate-800 outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          {/* Upload Foto Dokumentasi NSO Terenkripsi */}
          <div className="pt-1">
            <EncryptedPhotoUploader photos={photos} onChange={setPhotos} />
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-7 py-3 rounded-full bg-gradient-to-r from-[#FF7E98] to-[#FF5376] text-white font-bold text-xs shadow-pill-coral hover:brightness-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{isSubmitting ? 'Menyimpan & Mengenkripsi...' : 'Simpan Proyek NSO'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
