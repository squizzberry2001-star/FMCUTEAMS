import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  User as UserIcon,
  Check,
  Sparkles,
  Store,
  Star
} from 'lucide-react';
import { ScheduleAgenda, ScheduleCategory } from '../types';
import {
  getStoresWithOwnership,
  findMasterStoreByCodeOrName
} from '../data/masterStoresData';

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
  const [time, setTime] = useState('08:30');
  const [location, setLocation] = useState('');
  const [pic, setPic] = useState('Septiana Indasari');
  const [description, setDescription] = useState('');
  const [priority] = useState<'NORMAL' | 'MEDIUM' | 'HIGH'>('HIGH');
  const [selectedStoreCode, setSelectedStoreCode] = useState('');
  const [storeScope, setStoreScope] = useState<'ALL' | 'OWNED'>('ALL');
  const [storeSearch, setStoreSearch] = useState('');

  const categories: { id: ScheduleCategory; label: string; bg: string; text: string }[] = [
    { id: 'VISIT', label: 'Store Visit', bg: 'bg-[#FFF0F3]', text: 'text-[#E55B7C]' },
    { id: 'NSO', label: 'NSO Opening', bg: 'bg-[#EBF7FF]', text: 'text-[#3E7BFA]' },
    { id: 'AUDIT', label: 'Audit SOP', bg: 'bg-[#FFF8E6]', text: 'text-[#C98A00]' },
    { id: 'MEETING', label: 'Coord Meeting', bg: 'bg-[#EAF8F2]', text: 'text-[#20A894]' },
    { id: 'TRAINING', label: 'Staff Training', bg: 'bg-[#F2EEFF]', text: 'text-[#845EC2]' },
  ];

  const pickableStores = useMemo(() => {
    const all = getStoresWithOwnership(pic);
    const q = storeSearch.trim().toLowerCase();
    return all
      .filter((s) => {
        if (storeScope === 'OWNED' && !s.isOwnedByBestie) return false;
        if (!q) return true;
        return (
          s.code.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.isOwnedByBestie !== b.isOwnedByBestie) return a.isOwnedByBestie ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [pic, storeScope, storeSearch]);

  const handleSelectStore = (code: string) => {
    setSelectedStoreCode(code);
    const st = findMasterStoreByCodeOrName(code);
    if (st) {
      setTitle(
        category === 'NSO'
          ? `NSO ${st.name}`
          : `Audit & Store Visit - Cabang ${st.name}`
      );
      setLocation(`${st.name} (${st.code}) - ${st.city}`);
      if (!description.trim()) {
        setDescription(
          `Visit Store ${st.name} (${st.code}) — SH: ${st.storeHead || '-'}, AM: ${st.areaManager || '-'}`
        );
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const matchedStore =
      findMasterStoreByCodeOrName(selectedStoreCode) ||
      findMasterStoreByCodeOrName(location) ||
      findMasterStoreByCodeOrName(title);

    const newAgenda: ScheduleAgenda = {
      id: `sch-${Date.now()}`,
      title: title.trim(),
      category,
      date,
      time,
      location: location.trim() || 'Cabang Store FMCU',
      pic: pic.trim() || 'Septiana Indasari',
      description: description.trim() || 'Agenda operasional FMCU TEAMS yang ditugaskan.',
      storeCode: matchedStore?.code,
      storeName: matchedStore?.name,
      storeType: matchedStore?.type,
      storeHead: matchedStore?.storeHead,
      areaManager: matchedStore?.areaManager,
      regionalManager: matchedStore?.regionalManager,
      storeEmail: matchedStore?.email,
      tags: [category, ...(matchedStore ? [matchedStore.code] : []), 'FMCU Teams'],
      completed: false,
      priority,
      createdBy: 'Admin FMCU',
    };

    onAddAgenda(newAgenda);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-teal-50 text-[#2BB3A0] flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800">Buat Schedule Agenda Baru</h3>
              <p className="text-xs text-slate-400">Terhubung 610 Master Toko & Kepemilikan Bestie</p>
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

          {/* Master Store Picker when VISIT or NSO */}
          {(category === 'VISIT' || category === 'NSO') && (
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black text-emerald-900 uppercase flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Pilih Master Toko FamilyMart</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setStoreScope('ALL')}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                      storeScope === 'ALL'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    Semua (610)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStoreScope('OWNED')}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1 ${
                      storeScope === 'OWNED'
                        ? 'bg-amber-500 text-white'
                        : 'bg-white text-amber-800 border border-amber-300'
                    }`}
                  >
                    <Star className="w-2.5 h-2.5 fill-current" />
                    <span>Kepemilikan PIC</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Cari kode / nama cabang..."
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                />
                <select
                  value={selectedStoreCode}
                  onChange={(e) => handleSelectStore(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-extrabold text-slate-800 outline-none"
                >
                  <option value="">-- Pilih dari {pickableStores.length} Toko --</option>
                  {pickableStores.map((st) => (
                    <option key={st.code} value={st.code}>
                      {st.isOwnedByBestie ? '★ ' : ''}
                      {st.code} - {st.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Judul Agenda *
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Audit & Store Visit - Cabang BDG DAGO"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white"
            />
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
                placeholder="Contoh: BDG DAGO (3013)"
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
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white text-xs font-extrabold shadow-pill-teal hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
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
