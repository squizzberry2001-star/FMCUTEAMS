import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Store,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  ExternalLink,
  ChevronRight,
  X,
  Mail,
  Phone,
  Radio,
  MapPin,
  ChevronLeft,
} from 'lucide-react';
import { ScheduleAgenda, ScheduleCategory, User, VisitReportData } from '../../types';
import { StoreWithOwnership, isSamePersonName } from '../../data/masterStoresData';
import { UserLivePresence } from '../../services/userLivePresenceService';
import { getLocalDateYmd } from '../../utils/mapGeoUtils';
import { getMondayOfWeek, getFullWeekDays } from '../../services/scheduleExcelService';
import { resolveVisitedStoreReportData } from '../HistoryView';
import { getGDriveReportRegistryEntry } from '../../services/pdfGeneratorService';
import { findVerifiedGDriveReport, verifiedItemToMeta, VerifiedGDriveReportMeta } from '../../services/gdriveReportLiveService';
import {
  GDRIVE_VERIFIED_REPORTS,
  GDriveVerifiedReportItem,
  getVerifiedGDriveReports,
} from '../../data/gdriveVerifiedReportsData';

interface ExecutiveTeamViewProps {
  currentUser: User;
  users: User[];
  agendas: ScheduleAgenda[];
  stores: StoreWithOwnership[];
  livePresences: UserLivePresence[];
  cloudReports: (VisitReportData & { updatedAtMs?: number })[];
  onOpenReportPreview: (params: {
    reportData: VisitReportData;
    gdrivePdfUrl: string;
    gdriveEmbedUrl?: string;
    storeFolderName?: string;
    pdfFileName?: string;
    gdriveSavedDate?: string;
  }) => void;
}

export const ExecutiveTeamView: React.FC<ExecutiveTeamViewProps> = ({
  currentUser,
  users,
  agendas,
  stores,
  livePresences,
  cloudReports,
  onOpenReportPreview,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalMainTab, setModalMainTab] = useState<'GDRIVE_REPORTS' | 'AGENDAS'>('GDRIVE_REPORTS');
  const [modalPeriodFilter, setModalPeriodFilter] = useState<'WEEK' | 'MONTH' | 'ALL'>('WEEK');
  const [modalCategoryFilter, setModalCategoryFilter] = useState<string>('ALL');
  const [modalMonthOffset, setModalMonthOffset] = useState<number>(0);

  const todayYmd = useMemo(() => getLocalDateYmd(), []);
  const fieldUsers = useMemo(() => users.filter((u) => !u.isAdmin), [users]);
  const allVerifiedReports = useMemo(() => getVerifiedGDriveReports(), []);

  // Map of online presences
  const now = Date.now();
  const onlinePresenceMap = useMemo(() => {
    const map = new Map<string, UserLivePresence>();
    livePresences.forEach((p) => {
      if (p.isWebActive && p.isGpsActive && now - p.lastSeenMs < 3 * 60 * 1000) {
        map.set(p.userName.toLowerCase().trim(), p);
      }
    });
    return map;
  }, [livePresences, now]);

  // Precomputed stats per user
  const userStatsMap = useMemo(() => {
    const currentMonthPrefix = todayYmd.slice(0, 7);
    const map = new Map<
      string,
      {
        totalVisitsThisMonth: number;
        ownedStoresCount: number;
        gdriveReportsCount: number;
        isOnline: boolean;
        currentCoords?: { lat: number; lng: number };
      }
    >();

    fieldUsers.forEach((u) => {
      const uNameNorm = u.name.toLowerCase().trim();
      const online = onlinePresenceMap.get(uNameNorm);

      const monthVisits = agendas.filter(
        (a) =>
          isSamePersonName(a.pic, u.name) &&
          (a.date || '').startsWith(currentMonthPrefix) &&
          (a.category === 'VISIT' || a.category === 'NSO' || Boolean(a.storeCode))
      ).length;

      const owned = stores.filter(
        (s) => s.ownerBestieName && isSamePersonName(s.ownerBestieName, u.name)
      ).length;

      const gdriveCount = allVerifiedReports.filter((r) =>
        isSamePersonName(r.personnelName, u.name)
      ).length;

      map.set(u.name, {
        totalVisitsThisMonth: monthVisits,
        ownedStoresCount: owned,
        gdriveReportsCount: gdriveCount,
        isOnline: Boolean(online),
        currentCoords: online ? { lat: online.lat, lng: online.lng } : undefined,
      });
    });

    return map;
  }, [fieldUsers, onlinePresenceMap, agendas, stores, todayYmd, allVerifiedReports]);

  // Filtered users by search
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return fieldUsers;
    return fieldUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    );
  }, [fieldUsers, searchQuery]);

  // Agendas for selected user in modal
  const selectedUserAgendas = useMemo(() => {
    if (!selectedUser) return [];

    const base = new Date();
    base.setMonth(base.getMonth() + modalMonthOffset);
    const yr = base.getFullYear();
    const mo = String(base.getMonth() + 1).padStart(2, '0');
    const monthPrefix = `${yr}-${mo}`;

    const currentMonday = getMondayOfWeek(todayYmd);
    const weekDays = new Set(getFullWeekDays(currentMonday).map((d) => d.dateStr));

    return agendas
      .filter((a) => isSamePersonName(a.pic, selectedUser.name))
      .filter((a) => {
        if (modalPeriodFilter === 'WEEK') return weekDays.has(a.date);
        if (modalPeriodFilter === 'MONTH') return (a.date || '').startsWith(monthPrefix);
        return true;
      })
      .filter((a) => {
        if (modalCategoryFilter === 'ALL') return true;
        if (modalCategoryFilter === 'VISIT')
          return a.category === 'VISIT' || a.category === 'NSO' || Boolean(a.storeCode);
        return a.category === modalCategoryFilter;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (b.time || '').localeCompare(a.time || '');
      });
  }, [selectedUser, agendas, modalPeriodFilter, modalMonthOffset, modalCategoryFilter, todayYmd]);

  // Verified GDrive reports for selected user in modal
  const selectedUserGdriveReports = useMemo(() => {
    if (!selectedUser) return [];
    return allVerifiedReports
      .filter((rep) => isSamePersonName(rep.personnelName, selectedUser.name))
      .sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  }, [selectedUser, allVerifiedReports]);

  const handlePreviewReport = (agenda: ScheduleAgenda) => {
    const verified = findVerifiedGDriveReport({
      storeCode: agenda.storeCode,
      storeName: agenda.storeName || agenda.location,
      pic: agenda.pic || selectedUser?.name,
      agendaId: agenda.id,
      visitDate: agenda.date,
      cloudReports,
    });

    if (!verified) return;

    onOpenReportPreview({
      reportData: verified.reportData,
      gdrivePdfUrl: verified.gdrivePdfUrl,
      gdriveEmbedUrl: verified.gdriveEmbedUrl,
      storeFolderName: verified.storeFolderName,
      pdfFileName: verified.pdfFileName,
      gdriveSavedDate: verified.gdriveSavedDate,
    });
  };

  const handlePreviewGdriveReport = (item: GDriveVerifiedReportItem) => {
    const meta = verifiedItemToMeta(item);
    onOpenReportPreview({
      reportData: meta.reportData,
      gdrivePdfUrl: meta.gdrivePdfUrl,
      gdriveEmbedUrl: meta.gdriveEmbedUrl,
      storeFolderName: meta.storeFolderName,
      pdfFileName: meta.pdfFileName,
      gdriveSavedDate: meta.gdriveSavedDate,
    });
  };

  const modalMonthLabel = useMemo(() => {
    const base = new Date();
    base.setMonth(base.getMonth() + modalMonthOffset);
    return base.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [modalMonthOffset]);

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TEAM DIRECTORY OVERVIEW HEADER & SEARCH
          ========================================================================= */}
      <div className="bg-white rounded-[32px] p-5 sm:p-7 border border-slate-200/90 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-6 rounded-full bg-[#3A657C]" />
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Direktori Tim Operasional FMCU
              </h2>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              33 Field Specialists • Klik Personel untuk Membuka Detail Agenda &amp; Laporan
            </p>
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama personel atau role..."
              className="w-full pl-8 pr-3 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#3A657C]"
            />
          </div>
        </div>

        {/* Personnel Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-5">
          {filteredUsers.map((u) => {
            const stats = userStatsMap.get(u.name) || {
              totalVisitsThisMonth: 0,
              ownedStoresCount: 0,
              gdriveReportsCount: 0,
              isOnline: false,
            };

            return (
              <button
                key={u.id || u.name}
                type="button"
                onClick={() => {
                  setSelectedUser(u);
                  setModalPeriodFilter('WEEK');
                  setModalCategoryFilter('ALL');
                  setModalMonthOffset(0);
                }}
                className="p-4 rounded-2xl bg-[#F8FAFC] hover:bg-white border border-slate-200/80 hover:border-slate-300 text-left transition cursor-pointer flex flex-col justify-between shadow-2xs group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#3A657C] to-[#2E8B57] text-white font-black text-sm flex items-center justify-center ring-2 ring-emerald-500/20 uppercase shadow-2xs shrink-0">
                        {u.avatar ? (
                          <img
                            src={u.avatar}
                            alt={u.name}
                            className="w-full h-full object-cover rounded-2xl"
                          />
                        ) : (
                          u.name.substring(0, 2)
                        )}
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-[#3A657C] transition truncate">
                          {u.name}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                          {u.role || 'Field Specialist FMCU'}
                        </p>
                      </div>
                    </div>

                    {stats.isOnline ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[9.5px] font-black shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Online
                      </span>
                    ) : (
                      <span className="text-[9.5px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                        Standby
                      </span>
                    )}
                  </div>

                  {/* Stat chips */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[10px]">
                    <div className="p-2 bg-white rounded-xl border border-slate-200/60">
                      <span className="text-slate-400 font-bold block">Laporan GDrive</span>
                      <span className={`text-xs font-black mt-0.5 block ${
                        stats.gdriveReportsCount > 0 ? 'text-emerald-700' : 'text-slate-500'
                      }`}>
                        {stats.gdriveReportsCount} Laporan
                      </span>
                    </div>

                    <div className="p-2 bg-white rounded-xl border border-slate-200/60">
                      <span className="text-slate-400 font-bold block">Toko Bestie</span>
                      <span className="text-xs font-black text-slate-800 mt-0.5 block">
                        {stats.ownedStoresCount} Toko
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-extrabold text-[#3A657C]">
                  <span>Lihat Detail Agenda &amp; Laporan</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          PERSONNEL DETAIL MODAL (DETAIL AGENDA BY FILTER MINGGU INI / BULAN INI)
          ========================================================================= */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[32px] p-5 sm:p-7 shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header: Person Profile */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#3A657C] to-[#2E8B57] text-white font-black text-lg flex items-center justify-center ring-4 ring-emerald-500/20 uppercase shadow-xs shrink-0">
                  {selectedUser.avatar ? (
                    <img
                      src={selectedUser.avatar}
                      alt={selectedUser.name}
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    selectedUser.name.substring(0, 2)
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                      {selectedUser.name}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                      {selectedUser.role || 'Field Operations'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                    {selectedUser.email || 'personel.fmcu@familymartindonesia.com'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Top View Selector: Laporan di GDrive vs Agenda Terjadwal */}
            <div className="pt-3 pb-2 flex items-center gap-2 border-b border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setModalMainTab('GDRIVE_REPORTS')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  modalMainTab === 'GDRIVE_REPORTS'
                    ? 'bg-[#10B981] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Laporan di GDrive ({selectedUserGdriveReports.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setModalMainTab('AGENDAS')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  modalMainTab === 'AGENDAS'
                    ? 'bg-[#3A657C] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Agenda Terjadwal ({selectedUserAgendas.length})</span>
              </button>
            </div>

            {modalMainTab === 'GDRIVE_REPORTS' ? (
              <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-2.5 pr-1">
                {selectedUserGdriveReports.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs font-semibold">
                    Belum ada dokumen laporan yang tersimpan di folder Google Drive personel ini.
                  </div>
                ) : (
                  selectedUserGdriveReports.map((rep) => (
                    <div
                      key={rep.id}
                      className="p-3.5 rounded-2xl bg-[#F8FAFC] hover:bg-white border border-slate-200/80 hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tight border ${
                              rep.format === 'PDF'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : rep.format === 'PPTX'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : rep.format === 'DOCX'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}
                          >
                            {rep.format}
                          </span>

                          <span
                            className={`text-[9.5px] font-black px-2 py-0.5 rounded-md ${
                              rep.category === 'NSO'
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {rep.category === 'NSO' ? 'NSO OPENING' : 'STORE VISIT'}
                          </span>

                          <h5 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                            {rep.storeName}
                          </h5>

                          {rep.storeCode && rep.storeCode !== 'STORE' && (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                              #{rep.storeCode}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                          File: <span className="text-slate-700 font-semibold">{rep.fileName}</span>
                        </p>

                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                          <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                            Tgl Kunjungan: {rep.visitDate}
                          </span>
                          {rep.subFolderName && (
                            <span className="text-slate-500">
                              Folder: {rep.subFolderName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handlePreviewGdriveReport(rep)}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#10B981] to-[#0D9488] hover:brightness-110 text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Preview Laporan</span>
                        </button>

                        <a
                          href={rep.gdriveViewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition cursor-pointer"
                          title="Buka langsung di Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <>
                {/* Filter Bar: Minggu Ini vs Bulan Ini vs Semua + Category Filters */}
                <div className="py-3.5 border-b border-slate-100 space-y-2.5 shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {/* Period Filter */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => setModalPeriodFilter('WEEK')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                          modalPeriodFilter === 'WEEK'
                            ? 'bg-[#3A657C] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Minggu Ini
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalPeriodFilter('MONTH')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                          modalPeriodFilter === 'MONTH'
                            ? 'bg-[#3A657C] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Bulan Ini
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalPeriodFilter('ALL')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                          modalPeriodFilter === 'ALL'
                            ? 'bg-[#3A657C] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Semua
                      </button>
                    </div>

                    {/* Month Picker if MONTH view */}
                    {modalPeriodFilter === 'MONTH' && (
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
                        <button
                          type="button"
                          onClick={() => setModalMonthOffset((v) => v - 1)}
                          className="w-6 h-6 rounded-lg bg-white text-slate-600 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2 text-xs font-black text-slate-800 capitalize">
                          {modalMonthLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => setModalMonthOffset((v) => v + 1)}
                          className="w-6 h-6 rounded-lg bg-white text-slate-600 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {(
                      [
                        { id: 'ALL', label: 'Semua Kategori' },
                        { id: 'VISIT', label: 'Store Visit' },
                        { id: 'TRAINING', label: 'Training' },
                        { id: 'MEETING', label: 'Meeting' },
                        { id: 'OFF', label: 'Libur (OFF)' },
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setModalCategoryFilter(c.id)}
                        className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold whitespace-nowrap transition cursor-pointer border ${
                          modalCategoryFilter === c.id
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modal Body: Personnel Agendas List */}
                <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-2.5 pr-1">
                  {selectedUserAgendas.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs font-semibold">
                      Tidak ada agenda untuk personel ini pada filter yang dipilih.
                    </div>
                  ) : (
                    selectedUserAgendas.map((item) => {
                      const isVisit =
                        item.category === 'VISIT' ||
                        item.category === 'NSO' ||
                        Boolean(item.storeCode);

                      const verifiedReport = isVisit
                        ? findVerifiedGDriveReport({
                            storeCode: item.storeCode,
                            storeName: item.storeName || item.location,
                            pic: item.pic || selectedUser.name,
                            agendaId: item.id,
                            visitDate: item.date,
                            cloudReports,
                          })
                        : null;

                      return (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-2xl bg-[#F8FAFC] hover:bg-white border border-slate-200/80 hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-200 text-slate-800">
                                {item.category || 'OPERATION'}
                              </span>
                              <h5 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                                {item.title}
                              </h5>
                              {item.storeCode && (
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                                  #{item.storeCode}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-semibold flex-wrap">
                              <span>
                                {item.date} • {item.time || '08:30'} WIB
                              </span>
                              {item.location && item.location !== 'OFF / LIBUR' && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-600 truncate max-w-[220px]">
                                    {item.location}
                                  </span>
                                </>
                              )}
                            </div>

                            {verifiedReport && verifiedReport.gdriveSavedDate && (
                              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold">
                                <span>GDrive: {verifiedReport.gdriveSavedDate}</span>
                              </div>
                            )}
                          </div>

                          {/* Preview Laporan Action (ONLY IF VERIFIED IN GDRIVE) */}
                          {isVisit && verifiedReport && (
                            <div className="shrink-0 self-end sm:self-center">
                              <button
                                type="button"
                                onClick={() => handlePreviewReport(item)}
                                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#10B981] to-[#0D9488] hover:brightness-110 text-white text-xs font-black flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                                title="Buka pratinjau dokumen laporan PDF dari Google Drive"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Preview Laporan</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500 shrink-0">
              <span>Total {selectedUserAgendas.length} agenda ditemukan</span>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
