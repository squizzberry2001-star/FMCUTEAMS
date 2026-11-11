import React, { useState } from 'react';
import {
  AlertTriangle,
  X,
  Send,
  CheckCircle2,
  Trash2,
  Store,
  MapPin,
  Clock,
  User,
  ShieldAlert,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { ScheduleAgenda, User as UserType } from '../../types';
import { formatTimeWibStr } from '../../services/userLivePresenceService';

export interface KendalaAgendaModalProps {
  isOpen: boolean;
  agenda: ScheduleAgenda;
  currentUser?: UserType | null;
  onClose: () => void;
  onSaveKendala: (updatedAgenda: ScheduleAgenda) => void;
}

export const KENDALA_CATEGORIES = [
  {
    id: 'TOKO_TUTUP',
    label: 'Toko Tutup / Renovasi',
    icon: '🚪',
    defaultText: 'Toko dalam keadaan tutup / sedang renovasi saat kunjungan.',
  },
  {
    id: 'AKSES_LOKASI',
    label: 'Akses / Cuaca / Lalu Lintas',
    icon: '🚧',
    defaultText: 'Terkendala akses menuju lokasi (banjir, macet parah, atau cuaca ekstrem).',
  },
  {
    id: 'STORE_HEAD_ABSEN',
    label: 'Store Head / PIC Absen',
    icon: '👤',
    defaultText: 'Store Head atau penanggung jawab toko tidak berada di tempat.',
  },
  {
    id: 'SISTEM_JARINGAN',
    label: 'Sistem / Jaringan Offline',
    icon: '📶',
    defaultText: 'Kendala pada sistem POS / server toko atau jaringan komunikasi offline.',
  },
  {
    id: 'DARURAT_OPERASIONAL',
    label: 'Darurat Operasional Toko',
    icon: '⚠️',
    defaultText: 'Terjadi situasi darurat operasional mendadak di area toko.',
  },
  {
    id: 'LAINNYA',
    label: 'Kendala Lainnya',
    icon: '📝',
    defaultText: '',
  },
];

export const KendalaAgendaModal: React.FC<KendalaAgendaModalProps> = ({
  isOpen,
  agenda,
  currentUser,
  onClose,
  onSaveKendala,
}) => {
  if (!isOpen) return null;

  const [selectedCategory, setSelectedCategory] = useState<string>(
    agenda.kendalaCategory || 'TOKO_TUTUP'
  );
  const [kendalaText, setKendalaText] = useState<string>(agenda.kendala || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSelectCategory = (catId: string, defaultText: string) => {
    setSelectedCategory(catId);
    if (!kendalaText.trim() && defaultText) {
      setKendalaText(defaultText);
    }
  };

  const handleSave = () => {
    const trimmed = kendalaText.trim();
    if (!trimmed) {
      alert('Mohon tuliskan rincian kendala terlebih dahulu.');
      return;
    }

    const updated: ScheduleAgenda = {
      ...agenda,
      kendala: trimmed,
      kendalaCategory: selectedCategory || 'LAINNYA',
      kendalaReportedAt: new Date().toISOString(),
      kendalaReportedBy: currentUser?.name || agenda.pic || 'Field Staff',
    };

    onSaveKendala(updated);
    onClose();
  };

  const handleRemoveKendala = () => {
    const updated: ScheduleAgenda = {
      ...agenda,
      kendala: undefined,
      kendalaCategory: undefined,
      kendalaReportedAt: undefined,
      kendalaReportedBy: undefined,
    };
    onSaveKendala(updated);
    onClose();
  };

  const handleShareToWhatsApp = () => {
    const categoryObj = KENDALA_CATEGORIES.find((c) => c.id === selectedCategory);
    const categoryLabel = categoryObj ? `${categoryObj.icon} ${categoryObj.label}` : 'Kendala Lapangan';
    const reporter = currentUser?.name || agenda.pic || 'Field Staff';
    const nowWib = formatTimeWibStr(Date.now());

    const message = [
      `⚠️ *LAPORAN KENDALA LAPANGAN FMCU*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🏢 *Agenda*: ${agenda.title}`,
      `📍 *Lokasi*: ${agenda.location}`,
      `👤 *PIC*: ${reporter}`,
      `📅 *Jadwal*: ${agenda.date} pukul ${agenda.time} WIB`,
      `⏰ *Waktu Lapor*: ${nowWib}`,
      `🏷️ *Kategori*: ${categoryLabel}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📝 *Rincian Kendala*:`,
      kendalaText.trim() || '(Belum ada rincian kendala)',
      `━━━━━━━━━━━━━━━━━━━━`,
      `_Tercatat otomatis di FMCU Teams System_`,
    ].join('\n');

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div
        className="w-full max-w-lg bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md shrink-0 border border-white/20">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/25 px-2 py-0.5 rounded-full leading-none">
                  Lapor Kendala
                </span>
                <span className="text-[10px] text-amber-100 font-semibold">
                  {agenda.category}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-black truncate mt-0.5">
                {agenda.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer shrink-0 active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Agenda Info Quick Card */}
          <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200/80 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase text-amber-800 block">
                Lokasi &amp; PIC Terjadwal
              </span>
              <p className="text-xs font-bold text-slate-800 truncate mt-0.5">
                {agenda.location}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {agenda.date} • {agenda.time} WIB • PIC: <strong>{agenda.pic}</strong>
              </p>
            </div>
            {agenda.kendala && (
              <span className="px-2 py-1 rounded-xl bg-amber-200/80 text-amber-900 text-[10px] font-black shrink-0">
                Sudah Ada Kendala
              </span>
            )}
          </div>

          {/* Quick Category Select */}
          <div>
            <label className="block text-[11px] font-black uppercase text-slate-600 mb-2 tracking-wider">
              Pilih Kategori Kendala:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {KENDALA_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat.id, cat.defaultText)}
                    className={`p-2.5 rounded-2xl border text-left transition cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-amber-50 border-amber-400 text-amber-950 font-black shadow-xs ring-1 ring-amber-400'
                        : 'bg-slate-50 hover:bg-white border-slate-200/80 text-slate-700 font-bold'
                    }`}
                  >
                    <span className="text-base shrink-0">{cat.icon}</span>
                    <span className="text-[11px] leading-tight truncate">
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Textarea Detail Kendala */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-black uppercase text-slate-600 tracking-wider">
                Rincian Kendala di Lapangan:
              </label>
              <span className="text-[10px] text-slate-400 font-bold">
                {kendalaText.length} karakter
              </span>
            </div>
            <textarea
              rows={4}
              value={kendalaText}
              onChange={(e) => setKendalaText(e.target.value)}
              placeholder="Jelaskan kendala apa yang terjadi di toko/lokasi..."
              className="w-full p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition"
            />
          </div>

          {/* WhatsApp Quick Forward Button */}
          <button
            type="button"
            onClick={handleShareToWhatsApp}
            className="w-full py-2.5 px-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 font-black text-xs flex items-center justify-center gap-2 border border-emerald-200 transition active:scale-95 cursor-pointer shadow-2xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Kirim Rincian Kendala ke WhatsApp Group / Koordinator</span>
          </button>

          {/* Delete Kendala Confirmation if already set */}
          {agenda.kendala && (
            <div className="pt-2 border-t border-slate-100">
              {showDeleteConfirm ? (
                <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-rose-800">
                    Hapus catatan kendala ini?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2.5 py-1 rounded-xl bg-white text-slate-700 text-xs font-bold border border-slate-200 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveKendala}
                      className="px-2.5 py-1 rounded-xl bg-rose-600 text-white text-xs font-black cursor-pointer shadow-2xs"
                    >
                      Ya, Hapus
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-2 text-rose-600 hover:text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Selesaikan / Hapus Kendala dari Agenda</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-black text-xs border border-slate-200 transition active:scale-95 cursor-pointer"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-[2] py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105 text-white font-black text-xs shadow-md transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Simpan Laporan Kendala</span>
          </button>
        </div>
      </div>
    </div>
  );
};
