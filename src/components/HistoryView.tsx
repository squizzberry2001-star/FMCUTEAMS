import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  Store,
  CheckCircle2,
  TrendingUp,
  Clock,
  Calendar,
  MapPin,
  Search,
  UserCheck,
  Building2,
} from 'lucide-react';
import { DeveloperFooter } from './DeveloperFooter';
import { ScheduleAgenda, User } from '../types';
import {
  getStoresWithOwnership,
  isSamePersonName,
} from '../data/masterStoresData';
import { resolveAgendaGeoPoints } from '../utils/mapGeoUtils';

interface HistoryViewProps {
  user?: User | null;
  agendas?: ScheduleAgenda[];
  onSelectAgenda?: (agenda: ScheduleAgenda) => void;
  onBack: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  user,
  agendas = [],
  onSelectAgenda,
  onBack,
}) => {
  const [storeFilter, setStoreFilter] = useState<'all' | 'covered' | 'pending'>('all');
  const [storeSearch, setStoreSearch] = useState('');

  const currentUserName = user?.name || '';

  // 1. Ambil data seluruh toko dan cek apakah user memiliki toko sendiri (Bestie In Charge)
  const allStoresWithOwnership = useMemo(
    () => getStoresWithOwnership(currentUserName),
    [currentUserName]
  );

  const myOwnedStores = useMemo(
    () => allStoresWithOwnership.filter((s) => s.isOwnedByBestie),
    [allStoresWithOwnership]
  );

  const hasOwnStores = myOwnedStores.length > 0;

  // Target toko yang dihitung:
  // - Jika user memiliki toko -> HANYA toko milik user sendiri
  // - Jika user TIDAK memiliki toko -> SEMUA toko jaringan FMCU
  const targetStores = hasOwnStores ? myOwnedStores : allStoresWithOwnership;

  // 2. Filter History Schedule HANYA milik user sendiri
  const myScheduleHistory = useMemo(() => {
    if (!currentUserName) return [];
    return agendas
      .filter((a) => isSamePersonName(a.pic, currentUserName))
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.time || '').localeCompare(a.time || '');
      });
  }, [agendas, currentUserName]);

  // 3. Hitung status coverage toko
  const coverageAnalysis = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    // Kumpulkan kode toko yang sudah dikunjungi / dijadwalkan
    const coveredCodes = new Set<string>();
    const coveredNames = new Set<string>();

    // Cek dari localStorage draft/saved visit reports
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('fmcu_visit_report_draft_v2_')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (!hasOwnStores || isSamePersonName(parsed?.visitorName, currentUserName)) {
                if (parsed?.storeCode) coveredCodes.add(String(parsed.storeCode).toUpperCase());
                if (parsed?.storeName) coveredNames.add(String(parsed.storeName).toUpperCase());
              }
            }
          }
        }
      } catch {
        // ignore storage error
      }
    }

    // Cek dari daftar agenda (milik sendiri jika punya toko, atau semua agenda jika menampilkan semua toko)
    const relevantAgendas = hasOwnStores ? myScheduleHistory : agendas;
    relevantAgendas.forEach((ag) => {
      if (ag.category === 'OFF' || ag.category === 'CUTI') return;
      if (ag.storeCode) coveredCodes.add(String(ag.storeCode).toUpperCase());
      if (ag.storeName) coveredNames.add(String(ag.storeName).toUpperCase());

      const pts = resolveAgendaGeoPoints(ag);
      pts.forEach((p) => {
        coveredCodes.add(String(p.code).toUpperCase());
        coveredNames.add(String(p.name).toUpperCase());
      });
    });

    const storeStatuses = targetStores.map((st) => {
      const codeUp = String(st.code).toUpperCase();
      const nameUp = String(st.name).toUpperCase();
      const isCovered = coveredCodes.has(codeUp) || coveredNames.has(nameUp);

      // Cari tanggal jadwal terakhir/terdekat untuk toko ini
      const matchedAgenda = relevantAgendas.find(
        (ag) =>
          String(ag.storeCode || '').toUpperCase() === codeUp ||
          String(ag.location || '').toUpperCase().includes(nameUp) ||
          String(ag.title || '').toUpperCase().includes(nameUp)
      );

      const isCompletedVisit =
        Boolean(matchedAgenda?.completed) ||
        Boolean(matchedAgenda && matchedAgenda.date <= todayStr);

      return {
        store: st,
        isCovered,
        isCompletedVisit,
        lastAgenda: matchedAgenda || null,
      };
    });

    const coveredCount = storeStatuses.filter((s) => s.isCovered).length;
    const totalCount = Math.max(1, targetStores.length);
    const rawPercentage = (coveredCount / totalCount) * 100;
    const displayPercentage = Number(rawPercentage.toFixed(1));

    return {
      storeStatuses,
      coveredCount,
      totalCount: targetStores.length,
      displayPercentage,
    };
  }, [targetStores, hasOwnStores, myScheduleHistory, agendas, currentUserName]);

  // Filter daftar toko milik user
  const filteredStoreStatuses = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    return coverageAnalysis.storeStatuses.filter((item) => {
      if (storeFilter === 'covered' && !item.isCovered) return false;
      if (storeFilter === 'pending' && item.isCovered) return false;
      if (!q) return true;
      return (
        item.store.code.toLowerCase().includes(q) ||
        item.store.name.toLowerCase().includes(q) ||
        item.store.city.toLowerCase().includes(q)
      );
    });
  }, [coverageAnalysis.storeStatuses, storeFilter, storeSearch]);

  const todayStr = new Date().toISOString().split('T')[0];

  const getCategoryBadge = (cat: string, dateStr: string, completed?: boolean) => {
    if (completed || (cat === 'VISIT' && dateStr < todayStr)) {
      return {
        label: 'Visit Selesai',
        className: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
      };
    }
    if (dateStr === todayStr) {
      return {
        label: 'Hari Ini',
        className: 'text-teal-700 bg-teal-50 border border-teal-200',
      };
    }
    if (cat === 'VISIT') {
      return {
        label: 'Terjadwal Visit',
        className: 'text-blue-700 bg-blue-50 border border-blue-200',
      };
    }
    return {
      label: cat,
      className: 'text-slate-700 bg-slate-100 border border-slate-200',
    };
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F9FD] overflow-y-auto no-scrollbar px-5 sm:px-6 pt-[max(1.5rem,env(safe-area-inset-top,24px))] pb-28 max-w-xl mx-auto w-full select-none">
      {/* Header Section 3: Coverage Store */}
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-full iphone-glass-icon-btn flex items-center justify-center text-black active:scale-95 transition-transform cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.4]" />
        </button>
        <div className="text-center">
          <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">
            {hasOwnStores ? 'Kepemilikan Toko Anda' : 'Monitoring Seluruh Jaringan'}
          </span>
          <h2 className="text-lg font-black text-slate-800">Coverage Store</h2>
        </div>
        <div className="w-10 h-10 rounded-full iphone-glass-icon-btn text-black flex items-center justify-center">
          <Store className="w-5 h-5 stroke-[2.2]" />
        </div>
      </div>

      {/* Main Coverage Summary Card */}
      <div className="bg-gradient-to-br from-[#2BB3A0] to-[#169888] rounded-3xl p-5 sm:p-6 text-white shadow-pill-teal mb-5 relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-extrabold text-teal-100 uppercase tracking-wider flex items-center gap-1.5">
            {hasOwnStores ? (
              <>
                <UserCheck className="w-3.5 h-3.5" />
                <span>Status Coverage Toko Milik Saya</span>
              </>
            ) : (
              <>
                <Building2 className="w-3.5 h-3.5" />
                <span>Persentase Semua Toko FMCU</span>
              </>
            )}
          </span>
          <span className="text-[10px] font-extrabold bg-white/20 px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
            <TrendingUp className="w-3 h-3" />
            <span>
              {coverageAnalysis.coveredCount}/{coverageAnalysis.totalCount} Toko
            </span>
          </span>
        </div>

        <div className="flex items-baseline gap-2.5 mt-1">
          <h3 className="text-4xl font-black tabular-nums">
            {coverageAnalysis.displayPercentage}%
          </h3>
          <span className="text-xs font-bold text-teal-100">
            {hasOwnStores ? `(${currentUserName})` : '(Seluruh Toko)'}
          </span>
        </div>

        <p className="text-xs text-teal-50/95 mt-2 leading-relaxed">
          {hasOwnStores
            ? `Menampilkan status coverage khusus untuk ${coverageAnalysis.totalCount} toko milik Anda. Tercatat ${coverageAnalysis.coveredCount} toko telah masuk dalam cakupan jadwal/kunjungan.`
            : `Akun Anda tidak memiliki penugasan toko spesifik. Menampilkan persentase coverage dari seluruh ${coverageAnalysis.totalCount} toko jaringan FMCU.`}
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-black/15 rounded-full h-2.5 mt-4 overflow-hidden">
          <div
            className="bg-white h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(4, coverageAnalysis.displayPercentage))}%` }}
          />
        </div>
      </div>

      {/* Daftar Status Coverage Toko Milik User (Jika User Memiliki Toko) */}
      {hasOwnStores && (
        <div className="bg-white rounded-3xl p-4 shadow-soft-card border border-slate-100 mb-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Daftar Toko Milik Anda ({myOwnedStores.length})
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                Status coverage khusus toko di bawah tanggung jawab Anda
              </p>
            </div>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setStoreFilter('all')}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  storeFilter === 'all' ? 'bg-white text-teal-700 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Semua ({coverageAnalysis.totalCount})
              </button>
              <button
                type="button"
                onClick={() => setStoreFilter('covered')}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  storeFilter === 'covered' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Tercakup ({coverageAnalysis.coveredCount})
              </button>
              <button
                type="button"
                onClick={() => setStoreFilter('pending')}
                className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                  storeFilter === 'pending' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Belum ({coverageAnalysis.totalCount - coverageAnalysis.coveredCount})
              </button>
            </div>
          </div>

          {/* Search My Stores */}
          <div className="relative mb-2.5">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={storeSearch}
              onChange={(e) => setStoreSearch(e.target.value)}
              placeholder="Cari nama atau kode toko milik Anda..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-500"
            />
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 pr-0.5 no-scrollbar">
            {filteredStoreStatuses.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-4">
                Tidak ada toko yang sesuai filter.
              </p>
            ) : (
              filteredStoreStatuses.map(({ store, isCovered, lastAgenda }) => (
                <div
                  key={store.code}
                  className="p-2.5 rounded-2xl bg-slate-50/90 border border-slate-100 flex items-center justify-between gap-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-extrabold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                        #{store.code}
                      </span>
                      <h4 className="text-xs font-bold text-slate-800 truncate">
                        {store.name}
                      </h4>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {store.city} • SH: {store.storeHead || '-'}
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 ${
                      isCovered
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-200/70 text-slate-600'
                    }`}
                  >
                    {isCovered ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>{lastAgenda ? lastAgenda.date : 'Tercakup'}</span>
                      </>
                    ) : (
                      <span>Belum Visit</span>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* History Aktivitas Section (HANYA MENAMPILKAN HISTORY SCHEDULE MILIK SENDIRI) */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <h3 className="text-sm font-black text-slate-800">History Aktivitas Saya</h3>
          <p className="text-[10px] text-slate-400 font-medium">
            Menampilkan riwayat schedule milik {currentUserName || 'Anda'} sendiri
          </p>
        </div>
        <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
          {myScheduleHistory.length} Jadwal
        </span>
      </div>

      <div className="space-y-2.5">
        {myScheduleHistory.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center shadow-soft-card border border-slate-100">
            <p className="text-xs font-bold text-slate-500">
              Belum ada riwayat schedule untuk akun {currentUserName}.
            </p>
          </div>
        ) : (
          myScheduleHistory.map((item) => {
            const badge = getCategoryBadge(item.category, item.date, item.completed);
            return (
              <div
                key={item.id}
                onClick={() => onSelectAgenda && onSelectAgenda(item)}
                className="bg-white rounded-2xl p-3.5 shadow-soft-card border border-slate-100/80 flex items-center justify-between gap-3 hover:shadow-soft-md transition-all cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
                    <Store className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-extrabold text-slate-800 truncate">
                      {item.storeName || item.location || item.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-teal-600" />
                        {item.date}
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {item.time} WIB
                      </span>
                      <span>•</span>
                      <span className="font-bold text-teal-700">{item.pic}</span>
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Minimalist Page Footer */}
      <DeveloperFooter />
    </div>
  );
};
