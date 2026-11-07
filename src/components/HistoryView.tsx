import React from 'react';
import { ChevronLeft, Store, CheckCircle2, TrendingUp, MapPin, Building2, Clock } from 'lucide-react';
import { DeveloperFooter } from './DeveloperFooter';

interface HistoryViewProps {
  onBack: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onBack }) => {
  const activityLogs = [
    {
      storeName: 'Toko Bandung Dago',
      activity: 'Audit Rutin & Visual Merchandising',
      time: 'Hari ini, 09:45 WIB',
      inspector: 'Sarah Jenkins',
      status: 'Visit Selesai',
      statusColor: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
    },
    {
      storeName: 'NSO Bandung Timur',
      activity: 'Walkthrough Kesiapan Fisik & ME',
      time: 'Kemarin, 14:20 WIB',
      inspector: 'Dimas Wicaksono',
      status: 'Fit-Out 85% OK',
      statusColor: 'text-teal-700 bg-teal-50 border border-teal-200',
    },
    {
      storeName: 'Toko Sukajadi',
      activity: 'Inspeksi Kebersihan & Kepatuhan SOP',
      time: 'Nov 6, 11:15 WIB',
      inspector: 'Rian Pratama',
      status: 'Audit Terverifikasi',
      statusColor: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
    },
    {
      storeName: 'Cabang Riau Bandung',
      activity: 'Briefing Pelayanan & Hospitality',
      time: 'Nov 5, 16:30 WIB',
      inspector: 'Sarah Jenkins',
      status: 'Briefing Selesai',
      statusColor: 'text-blue-700 bg-blue-50 border border-blue-200',
    },
    {
      storeName: 'Toko Buah Batu',
      activity: 'Verifikasi Planogram & Stocking',
      time: 'Nov 4, 13:00 WIB',
      inspector: 'Aan Bagus',
      status: 'SOP Dipenuhi',
      statusColor: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
    },
  ];

  return (
    <div className="flex flex-col h-full bg-[#F8F9FD] overflow-y-auto no-scrollbar px-5 sm:px-6 pt-[max(1.5rem,env(safe-area-inset-top,24px))] pb-28 max-w-xl mx-auto w-full">
      {/* Header Section 3: Typography Coverage Store */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full iphone-glass-icon-btn flex items-center justify-center text-black active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.4]" />
        </button>
        <div className="text-center">
          <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">
            Monitoring Jaringan Toko
          </span>
          <h2 className="text-lg font-black text-slate-800">Coverage Store</h2>
        </div>
        <div className="w-10 h-10 rounded-full iphone-glass-icon-btn text-black flex items-center justify-center">
          <Store className="w-5 h-5 stroke-[2.2]" />
        </div>
      </div>

      {/* Stats Summary Card (Mempertahankan layout asli, typography Coverage Store) */}
      <div className="bg-gradient-to-br from-[#2BB3A0] to-[#169888] rounded-3xl p-6 text-white shadow-pill-teal mb-6 relative overflow-hidden">
        {/* Ambient decorative circle */}
        <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-teal-100 uppercase tracking-wider block">
            Target Store Coverage
          </span>
          <span className="text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Target 90%</span>
          </span>
        </div>

        <h3 className="text-4xl font-black mt-1">94.8%</h3>

        <p className="text-xs text-teal-100/90 mt-2 leading-relaxed">
          Pencapaian target kunjungan toko bulan ini. 28 dari 30 target cabang FMCU telah berhasil dikunjungi dan diaudit.
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-black/15 rounded-full h-2 mt-4 overflow-hidden">
          <div className="bg-white h-2 rounded-full w-[94.8%]" />
        </div>
      </div>

      {/* History Aktivitas Section */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-bold text-slate-800">History Aktivitas</h3>
        <span className="text-[11px] font-semibold text-slate-400">
          5 Kunjungan Terakhir
        </span>
      </div>

      <div className="space-y-3">
        {activityLogs.map((log, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-4 shadow-soft-card border border-slate-100/80 flex items-center justify-between gap-3 hover:shadow-soft-md transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
                <Store className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-800 truncate">{log.storeName}</h4>
                <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                  {log.activity}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{log.time}</span>
                  <span>•</span>
                  <span>{log.inspector}</span>
                </p>
              </div>
            </div>

            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${log.statusColor}`}>
              {log.status}
            </span>
          </div>
        ))}
      </div>

      {/* Minimalist Page Footer */}
      <DeveloperFooter />
    </div>
  );
};
