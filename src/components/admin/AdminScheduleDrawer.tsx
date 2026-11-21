import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Calendar,
  Clock,
  Store,
  User as UserIcon,
  Search,
  Plus,
  Check,
  MapPin,
  FileText,
  Layers,
} from 'lucide-react';
import { ScheduleAgenda, ScheduleCategory, User } from '../../types';
import { MasterStore } from '../../data/masterStoresData';
import { formatLocalYmd } from './adminTypes';

interface AdminScheduleDrawerProps {
  isOpen: boolean;
  editingAgenda: ScheduleAgenda | null;
  defaultDate?: string;
  users: User[];
  masterStores: MasterStore[];
  onClose: () => void;
  onSaveSingle: (agenda: ScheduleAgenda, isEdit: boolean) => void;
  onSaveBatch: (agendas: ScheduleAgenda[]) => void;
}

const CATEGORIES: { value: ScheduleCategory; label: string; dot: string }[] = [
  { value: 'VISIT', label: 'Visit Toko', dot: 'bg-emerald-500' },
  { value: 'NSO', label: 'NSO', dot: 'bg-amber-500' },
  { value: 'MEETING', label: 'Meeting', dot: 'bg-blue-500' },
  { value: 'TRAINING', label: 'Training', dot: 'bg-cyan-500' },
  { value: 'AUDIT', label: 'Audit', dot: 'bg-violet-500' },
  { value: 'OPERATION', label: 'Operasional', dot: 'bg-teal-500' },
  { value: 'WORK_PLAN', label: 'Work Plan', dot: 'bg-indigo-500' },
  { value: 'CUTI', label: 'Cuti / Izin', dot: 'bg-rose-500' },
  { value: 'OFF', label: 'Off / Libur', dot: 'bg-slate-400' },
];

export const AdminScheduleDrawer: React.FC<AdminScheduleDrawerProps> = ({
  isOpen,
  editingAgenda,
  defaultDate,
  users,
  masterStores,
  onClose,
  onSaveSingle,
  onSaveBatch,
}) => {
  const isEdit = Boolean(editingAgenda);

  const staffUsers = useMemo(
    () =>
      users
        .filter((u) => !u.isAdmin && !u.isExecutiveViewer)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  const [category, setCategory] = useState<ScheduleCategory>('VISIT');
  const [title, setTitle] = useState('');
  const [pic, setPic] = useState('');
  const [date, setDate] = useState(defaultDate || formatLocalYmd());
  const [multiDateMode, setMultiDateMode] = useState(false);
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [datePickerInput, setDatePickerInput] = useState('');
  const [time, setTime] = useState('08:30');
  const [endTime, setEndTime] = useState('17:00');
  const [storeQuery, setStoreQuery] = useState('');
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [selectedStore, setSelectedStore] = useState<MasterStore | null>(null);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const storeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setMultiDateMode(false);
    setExtraDates([]);
    setDatePickerInput('');
    setShowStoreDropdown(false);

    if (editingAgenda) {
      setCategory(editingAgenda.category || 'VISIT');
      setTitle(editingAgenda.title || '');
      setPic(editingAgenda.pic || staffUsers[0]?.name || '');
      setDate(editingAgenda.date || formatLocalYmd());
      setTime(editingAgenda.time || '08:30');
      setEndTime(editingAgenda.endTime || '17:00');
      setLocation(editingAgenda.location || '');
      setDescription(editingAgenda.description || '');

      const matched = editingAgenda.storeCode
        ? masterStores.find(
            (s) => s.code.toUpperCase() === String(editingAgenda.storeCode).toUpperCase()
          ) || null
        : null;
      setSelectedStore(matched);
      setStoreQuery(matched ? `${matched.code} — ${matched.name}` : editingAgenda.storeName || '');
    } else {
      setCategory('VISIT');
      setTitle('');
      setPic(staffUsers[0]?.name || users[0]?.name || '');
      setDate(defaultDate || formatLocalYmd());
      setTime('08:30');
      setEndTime('17:00');
      setSelectedStore(null);
      setStoreQuery('');
      setLocation('');
      setDescription('');
    }
  }, [isOpen, editingAgenda, defaultDate, staffUsers, users, masterStores]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(e.target as Node)) {
        setShowStoreDropdown(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filteredStores = useMemo(() => {
    const q = storeQuery.trim().toLowerCase();
    if (!q) return masterStores.slice(0, 25);
    return masterStores
      .filter(
        (s) =>
          s.code.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          (s.city || '').toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [masterStores, storeQuery]);

  const handleSelectStore = (st: MasterStore) => {
    setSelectedStore(st);
    setStoreQuery(`${st.code} — ${st.name}`);
    setLocation(`${st.name} (${st.city || st.address || st.code})`);
    setShowStoreDropdown(false);

    // Auto-populate clean title if empty or auto-generated
    const trimmed = title.trim();
    if (
      !trimmed ||
      trimmed.startsWith('Visit Toko ') ||
      trimmed.startsWith('NSO ') ||
      trimmed.startsWith('Audit ')
    ) {
      if (category === 'NSO') {
        setTitle(`NSO ${st.name}`);
      } else if (category === 'AUDIT') {
        setTitle(`Audit ${st.name}`);
      } else {
        setTitle(`Visit Toko ${st.name}`);
      }
    }
  };

  const handleClearStore = () => {
    setSelectedStore(null);
    setStoreQuery('');
  };

  const handleAddExtraDate = () => {
    if (!datePickerInput) return;
    if (datePickerInput === date || extraDates.includes(datePickerInput)) {
      setDatePickerInput('');
      return;
    }
    setExtraDates((prev) => [...prev, datePickerInput].sort());
    setDatePickerInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!pic.trim()) {
      setErrorMsg('Pilih Personil (PIC) terlebih dahulu.');
      return;
    }
    if (!date) {
      setErrorMsg('Tanggal pelaksanaan wajib diisi.');
      return;
    }

    const resolvedTitle =
      title.trim() ||
      (category === 'OFF'
        ? 'Off / Libur'
        : category === 'CUTI'
        ? 'Cuti'
        : selectedStore
        ? `${category === 'NSO' ? 'NSO' : 'Visit Toko'} ${selectedStore.name}`
        : `${CATEGORIES.find((c) => c.value === category)?.label || category}`);

    const resolvedLocation =
      location.trim() ||
      (selectedStore
        ? `${selectedStore.name} (${selectedStore.city || selectedStore.code})`
        : category === 'OFF' || category === 'CUTI'
        ? '-'
        : 'Head Office / Area');

    const buildAgenda = (targetDate: string, suffix = ''): ScheduleAgenda => ({
      ...(editingAgenda || {}),
      id: editingAgenda?.id || `ag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${suffix}`,
      title: resolvedTitle,
      date: targetDate,
      time: time || '08:30',
      endDate: targetDate,
      endTime: endTime || '17:00',
      category,
      location: resolvedLocation,
      pic: pic.trim(),
      description: description.trim() || undefined,
      storeCode: selectedStore?.code || editingAgenda?.storeCode,
      storeName: selectedStore?.name || editingAgenda?.storeName,
      storeType: selectedStore?.type || editingAgenda?.storeType,
      storeHead: selectedStore?.storeHead || editingAgenda?.storeHead,
      areaManager: selectedStore?.areaManager || editingAgenda?.areaManager,
      regionalManager: selectedStore?.regionalManager || editingAgenda?.regionalManager,
      storeEmail: selectedStore?.email || editingAgenda?.storeEmail,
      tags: [category],
      createdBy: editingAgenda?.createdBy || 'Admin FMCU',
    });

    if (isEdit || !multiDateMode || extraDates.length === 0) {
      onSaveSingle(buildAgenda(date), isEdit);
    } else {
      const allDates = [date, ...extraDates];
      const batch = allDates.map((d, idx) => buildAgenda(d, `_${idx}`));
      onSaveBatch(batch);
    }
  };

  if (!isOpen) return null;

  const isStoreRelevant =
    category === 'VISIT' ||
    category === 'NSO' ||
    category === 'AUDIT' ||
    category === 'OPERATION' ||
    category === 'TRAINING';

  return (
    <div className="fixed inset-0 z-50 flex justify-end items-end sm:items-stretch">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/35 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative z-10 w-full sm:max-w-[460px] bg-white h-[92vh] sm:h-full rounded-t-2xl sm:rounded-none sm:border-l border-slate-200 flex flex-col shadow-2xl admin-sheet-up sm:admin-drawer-right overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {isEdit ? 'Edit Jadwal Agenda' : 'Buat Jadwal Baru'}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isEdit
                ? 'Perubahan otomatis tersinkronisasi ke Cloud & aplikasi user.'
                : 'Buat 1 jadwal cepat atau jadwal berulang beberapa tanggal sekaligus.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form id="admin-schedule-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto admin-sheet-scroll px-5 py-4 space-y-4">
          {errorMsg && (
            <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Category Picker */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Kategori Kegiatan
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => {
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : c.dot}`} />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PIC Selector */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Personil (PIC)
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={pic}
                onChange={(e) => setPic(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:border-slate-900 transition"
              >
                <option value="">-- Pilih Personil --</option>
                {staffUsers.map((u) => (
                  <option key={u.email || u.name} value={u.name}>
                    {u.name} {u.role ? `(${u.role})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Store Autocomplete (Relevant categories) */}
          {isStoreRelevant && (
            <div ref={storeDropdownRef} className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Pilih Toko (Master Store)
                </label>
                {selectedStore && (
                  <button
                    type="button"
                    onClick={handleClearStore}
                    className="text-[11px] text-slate-400 hover:text-rose-600 font-medium cursor-pointer"
                  >
                    Hapus pilihan
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={storeQuery}
                  onFocus={() => setShowStoreDropdown(true)}
                  onChange={(e) => {
                    setStoreQuery(e.target.value);
                    setShowStoreDropdown(true);
                  }}
                  placeholder="Ketik kode (0001) atau nama toko..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition"
                />
              </div>

              {selectedStore && (
                <div className="mt-1.5 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="font-semibold text-slate-800">#{selectedStore.code}</span>
                    {' • '}
                    <span>{selectedStore.type}</span>
                    {selectedStore.city ? ` • ${selectedStore.city}` : ''}
                    {selectedStore.areaManager ? ` • AM: ${selectedStore.areaManager}` : ''}
                  </div>
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                </div>
              )}

              {showStoreDropdown && (
                <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto admin-sheet-scroll bg-white border border-slate-200 rounded-xl shadow-lg z-30 divide-y divide-slate-100">
                  {filteredStores.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-slate-400">
                      Toko tidak ditemukan di Master Store.
                    </div>
                  ) : (
                    filteredStores.map((st) => (
                      <button
                        key={st.code}
                        type="button"
                        onClick={() => handleSelectStore(st)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2 transition cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 truncate">
                            <span className="font-mono text-emerald-700 mr-1.5">#{st.code}</span>
                            {st.name}
                          </div>
                          <div className="text-[10.5px] text-slate-500 truncate">
                            {st.type} • {st.city || '-'} {st.storeHead ? `• SH: ${st.storeHead}` : ''}
                          </div>
                        </div>
                        <Store className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Judul Agenda
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                category === 'VISIT'
                  ? 'Contoh: Visit Toko Bulungan'
                  : category === 'NSO'
                  ? 'Contoh: NSO Toko Kemang Baru'
                  : 'Tulis nama kegiatan...'
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition"
            />
          </div>

          {/* Date & Multi-Date Flexibility */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Tanggal & Waktu
              </label>
              {!isEdit && (
                <button
                  type="button"
                  onClick={() => setMultiDateMode((v) => !v)}
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                    multiDateMode
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>{multiDateMode ? 'Mode Banyak Tanggal Aktif' : '+ Banyak Tanggal'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="relative col-span-3 sm:col-span-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full pl-8 pr-2 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 tabular-nums focus:outline-none focus:border-slate-900"
                />
              </div>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full pl-8 pr-2 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 tabular-nums focus:outline-none focus:border-slate-900"
                />
              </div>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full pl-8 pr-2 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 tabular-nums focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            {!isEdit && multiDateMode && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-[11px] text-slate-600 font-medium">
                  Tambahkan tanggal lain untuk menduplikasi jadwal ini otomatis:
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="date"
                      value={datePickerInput}
                      onChange={(e) => setDatePickerInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs tabular-nums"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddExtraDate}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                </div>
                {extraDates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {extraDates.map((d) => (
                      <span
                        key={d}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-mono text-slate-700"
                      >
                        {d}
                        <button
                          type="button"
                          onClick={() => setExtraDates((prev) => prev.filter((x) => x !== d))}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Lokasi / Keterangan Tempat
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Nama toko, kota, atau Head Office..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Catatan / Instruksi (Opsional)
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Fokus pengecekan, instruksi khusus untuk tim..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition resize-none"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/70 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            form="admin-schedule-form"
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>
              {isEdit
                ? 'Simpan Perubahan'
                : multiDateMode && extraDates.length > 0
                ? `Simpan ${extraDates.length + 1} Jadwal`
                : 'Simpan Jadwal'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
