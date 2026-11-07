import React, { useState } from 'react';
import { X, Check, Calendar, Clock, MapPin, User, FileText, Tag } from 'lucide-react';
import { FmcuAgenda, AgendaType } from '../types';

interface FormAgendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (agenda: Omit<FmcuAgenda, 'id'>) => void;
  currentUser?: { name: string };
}

export const FormAgendaModal: React.FC<FormAgendaModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentUser,
}) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<AgendaType>('VISIT');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('09:00');
  const [location, setLocation] = useState('');
  const [pic, setPic] = useState(currentUser?.name || 'Sarah Jenkins');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title,
      type,
      date,
      time,
      location: location || 'Toko Cabang FMCU',
      pic: pic || 'FMCU Team',
      description,
      status: 'SCHEDULED',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-lg bg-white rounded-[36px] shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200 border border-slate-100 max-h-[90vh] overflow-y-auto no-scrollbar">
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
            <Calendar className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">
              Tambah Agenda FMCU
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Jadwalkan visit, NSO opening, audit, atau meeting tim.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Judul Agenda */}
          <div>
            <label className="block text-xs text-slate-700 font-bold mb-1">
              Judul Kegiatan / Agenda
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Audit & Kunjungan Cabang Dago"
              className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          {/* Tipe Agenda */}
          <div>
            <label className="block text-xs text-slate-700 font-bold mb-2">
              Kategori Agenda
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {(['VISIT', 'NSO', 'MEETING', 'INSPECTION', 'TRAINING'] as AgendaType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-2 rounded-xl text-[11px] font-bold transition-all ${
                    type === t
                      ? 'bg-[#2BB3A0] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Tanggal & Waktu */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                <span>Tanggal</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Waktu Pelaksanaan</span>
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>

          {/* Lokasi & PIC */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-orange-500" />
                <span>Lokasi / Toko</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Contoh: Jl. Dago No. 124"
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-700 font-bold mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Penanggung Jawab (PIC)</span>
              </label>
              <input
                type="text"
                value={pic}
                onChange={(e) => setPic(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>

          {/* Deskripsi */}
          <div>
            <label className="block text-xs text-slate-700 font-bold mb-1">
              Catatan / Deskripsi Agenda
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Rincian tujuan atau persiapan khusus..."
              className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl p-3 text-xs font-medium text-slate-800 outline-none focus:border-teal-500 transition-colors"
            />
          </div>

          {/* Submit */}
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
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white font-bold text-xs shadow-pill-teal hover:brightness-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Jadwalkan Agenda</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
