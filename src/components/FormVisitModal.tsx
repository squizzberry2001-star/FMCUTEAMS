import React, { useState } from 'react';
import { X, Check, ClipboardCheck, Store, User, Calendar, FileText, Lock } from 'lucide-react';
import { VisitReport, EncryptedPhotoItem } from '../types';
import { EncryptedPhotoUploader } from './EncryptedPhotoUploader';

interface FormVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (report: Omit<VisitReport, 'id' | 'createdAt'>) => void;
  currentUser?: { name: string };
}

export const FormVisitModal: React.FC<FormVisitModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentUser,
}) => {
  const [storeName, setStoreName] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [visitorName, setVisitorName] = useState(currentUser?.name || 'Sarah Jenkins');
  const [purpose, setPurpose] = useState('Audit Rutin & Visual Merchandising');
  const [checklists, setChecklists] = useState({
    cleanliness: true,
    displayVm: true,
    stockAvailability: true,
    cashierIt: true,
    sopCompliance: true,
  });
  const [notes, setNotes] = useState('');
  const [actionItems, setActionItems] = useState('');
  const [photos, setPhotos] = useState<EncryptedPhotoItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;

    setIsSubmitting(true);
    await onSubmit({
      storeName,
      storeCode,
      visitDate,
      visitorName,
      purpose,
      checklists,
      notes,
      actionItems,
      photos,
      status: 'SUBMITTED',
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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#32C2AD] to-[#20A894] flex items-center justify-center text-white shadow-pill-teal flex-shrink-0">
            <ClipboardCheck className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                Form Laporan Visit Toko
              </h2>
              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                FMCU Operasional
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Input hasil inspeksi lapangan dengan enkripsi foto ke Google Drive bersama.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Toko & Kode Toko */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1 flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-teal-600" />
                <span>Nama Toko / Cabang</span>
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Contoh: Toko Bandung Dago"
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1">
                Kode Toko (Opsional)
              </label>
              <input
                type="text"
                value={storeCode}
                onChange={(e) => setStoreCode(e.target.value)}
                placeholder="Contoh: BDO-001"
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>

          {/* Visitor & Tanggal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Nama Visitor / Auditor</span>
              </label>
              <input
                type="text"
                required
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span>Tanggal Visit</span>
              </label>
              <input
                type="date"
                required
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>

          {/* Tujuan Kunjungan */}
          <div>
            <label className="block text-xs text-slate-700 font-bold mb-1">
              Tujuan Kunjungan
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Contoh: Audit Rutin & Cek Kesiapan Display"
              className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          {/* Checklist Observasi */}
          <div>
            <label className="block text-xs text-slate-700 font-bold mb-2">
              Checklist Standar FMCU
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
              {[
                { key: 'cleanliness', label: 'Kebersihan & Kerapihan Area Toko' },
                { key: 'displayVm', label: 'Display & Visual Merchandising Sesuai SOP' },
                { key: 'stockAvailability', label: 'Ketersediaan Stok & Planogram' },
                { key: 'cashierIt', label: 'Kesiapan Kasir & Perangkat POS' },
                { key: 'sopCompliance', label: 'Kepatuhan Seragam & Hospitality Staff' },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={(checklists as any)[item.key]}
                    onChange={(e) =>
                      setChecklists({
                        ...checklists,
                        [item.key]: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Catatan & Action Items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1">
                Catatan & Temuan Lapangan
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tuliskan temuan atau kendala yang diamati..."
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl p-3 text-xs font-medium text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1">
                Tindakan Perbaikan (*Action Items*)
              </label>
              <textarea
                rows={2}
                value={actionItems}
                onChange={(e) => setActionItems(e.target.value)}
                placeholder="Tindakan yang perlu diselesaikan toko..."
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl p-3 text-xs font-medium text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>

          {/* Multi-Photo Upload Terenkripsi */}
          <div className="pt-2">
            <EncryptedPhotoUploader photos={photos} onChange={setPhotos} />
          </div>

          {/* Submit Actions */}
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
              className="px-7 py-3 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white font-bold text-xs shadow-pill-teal hover:brightness-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{isSubmitting ? 'Menyimpan & Mengenkripsi...' : 'Simpan Laporan Visit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
