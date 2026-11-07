import React, { useState } from 'react';
import { X, Calendar, Clock, MapPin, User as UserIcon, Tag, Check, Sparkles } from 'lucide-react';
import { ScheduleAgenda, ScheduleCategory } from '../types';

interface NewAgendaModalProps {
  initialDate?: string;
  onClose: () => void;
  onAddAgenda: (newAgenda: ScheduleAgenda) => void;
}

export const NewAgendaModal: React.FC<NewAgendaModalProps> = ({
  initialDate,
  onClose,
  onAddAgenda,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ScheduleCategory>('VISIT');
  const [date, setDate] = useState(
    initialDate || new Date().toISOString().split('T')[0]
  );
  const [time, setTime] = useState('09:00');
  const [location, setLocation] = useState('');
  const [pic, setPic] = useState('Sarah Jenkins');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'MEDIUM' | 'HIGH'>('NORMAL');

  const categories: { id: ScheduleCategory; label: string; bg: string; text: string }[] = [
    { id: 'VISIT', label: 'Store Visit', bg: 'bg-[#FFF0F3]', text: 'text-[#E55B7C]' },
    { id: 'NSO', label: 'NSO Opening', bg: 'bg-[#EBF7FF]', text: 'text-[#3E7BFA]' },
    { id: 'AUDIT', label: 'Audit SOP', bg: 'bg-[#FFF8E6]', text: 'text-[#C98A00]' },
    { id: 'MEETING', label: 'Coord Meeting', bg: 'bg-[#EAF8F2]', text: 'text-[#20A894]' },
    { id: 'TRAINING', label: 'Staff Training', bg: 'bg-[#F2EEFF]', text: 'text-[#845EC2]' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newAgenda: ScheduleAgenda = {
      id: `sch-${Date.now()}`,
      title: title.trim(),
      category,
      date,
      time,
      location: location.trim() || 'Cabang Store FMCU',
      pic: pic.trim() || 'Sarah Jenkins',
      description: description.trim() || 'Agenda operasional FMCU TEAMS yang ditugaskan.',
      tags: [category, priority === 'HIGH' ? 'Prioritas Tinggi' : 'FMCU Teams'],
      completed: false,
      priority,
      createdBy: 'Admin FMCU',
    };

    onAddAgenda(newAgenda);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-teal-50 text-[#2BB3A0] flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">Buat Schedule Agenda Baru</h3>
              <p className="text-xs text-slate-400">Jadwalkan agenda kerja admin untuk tim lapangan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Judul Agenda *
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Audit Fasilitas Toko Dago"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white"
            />
          </div>

          {/* Category Chips */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Kategori Agenda
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                    category === c.id
                      ? `${c.bg} ${c.text} border-current shadow-sm scale-105`
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Tanggal</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Waktu</span>
              </label>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
          </div>

          {/* Location & PIC */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Lokasi Toko</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Cabang Dago No. 124"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>PIC / Petugas</span>
              </label>
              <input
                type="text"
                placeholder="Nama PIC"
                value={pic}
                onChange={(e) => setPic(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Catatan / Instruksi
            </label>
            <textarea
              rows={2}
              placeholder="Catatan detail untuk tim yang bertugas..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white text-xs font-extrabold shadow-pill-teal hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Simpan & Terbitkan Agenda</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
