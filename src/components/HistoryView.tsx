import React, { useMemo, useState, useEffect } from 'react';
import {
  ChevronLeft,
  Store,
  CheckCircle2,
  TrendingUp,
  Clock,
  Calendar,
  Search,
  UserCheck,
  Building2,
  FileText,
  ExternalLink,
  Cloud,
  Download,
  Trophy,
} from 'lucide-react';
import { DeveloperFooter } from './DeveloperFooter';
import { LeaderboardTopVisit } from './LeaderboardTopVisit';
import { ScheduleAgenda, User } from '../types';
import { VisitReportData } from '../types/visitReport';
import {
  getStoresWithOwnership,
  isSamePersonName,
  findMasterStoreByCodeOrName,
} from '../data/masterStoresData';
import { resolveAgendaGeoPoints } from '../utils/mapGeoUtils';
import {
  getGDriveReportRegistryEntry,
  FMCU_REPORT_GDRIVE_FOLDER_URL,
  generatePdfDoc,
  toGDriveEmbedPreviewUrl,
} from '../services/pdfGeneratorService';
import {
  syncMobileStatusBarTheme,
  APP_THEME_COLOR_LIGHT,
  APP_THEME_COLOR_DARK,
} from '../utils/themeUtils';

interface HistoryViewProps {
  user?: User | null;
  agendas?: ScheduleAgenda[];
  users?: User[];
  onSelectAgenda?: (agenda: ScheduleAgenda) => void;
  onBack: () => void;
}

/**
 * Resolve or construct complete VisitReportData + GDrive metadata so clicking "Lihat Laporan"
 * immediately renders the store's PDF report directly inside the web page.
 */
function resolveVisitedStoreReportData(params: {
  storeCode?: string;
  storeName?: string;
  agenda?: ScheduleAgenda | null;
  currentUserName?: string;
}): {
  reportData: VisitReportData;
  gdrivePdfUrl: string;
  gdriveEmbedUrl?: string;
} {
  const { storeCode, storeName, agenda, currentUserName } = params;

  const matchedMaster =
    findMasterStoreByCodeOrName(storeCode) ||
    findMasterStoreByCodeOrName(storeName) ||
    findMasterStoreByCodeOrName(agenda?.storeCode) ||
    findMasterStoreByCodeOrName(agenda?.storeName) ||
    findMasterStoreByCodeOrName(agenda?.location);

  const resolvedCode =
    storeCode || agenda?.storeCode || matchedMaster?.code || '3013';
  const resolvedName =
    storeName ||
    agenda?.storeName ||
    matchedMaster?.name ||
    (agenda?.location && agenda.location !== 'OFF / LIBUR' ? agenda.location : 'Toko FMCU');
  const resolvedType = agenda?.storeType || matchedMaster?.type || 'CVS';
  const resolvedHead = agenda?.storeHead || matchedMaster?.storeHead || 'Store Head';
  const resolvedAm = agenda?.areaManager || matchedMaster?.areaManager || 'Area Manager';
  const resolvedRm =
    agenda?.regionalManager || matchedMaster?.regionalManager || 'Regional Manager';
  const resolvedEmail =
    agenda?.storeEmail ||
    matchedMaster?.email ||
    `store.${resolvedName.toLowerCase().replace(/[^a-z0-9]/g, '')}@familymartindonesia.com`;
  const resolvedVisitor = agenda?.pic || currentUserName || 'Auditor FMCU';
  const resolvedDate = agenda?.date || new Date().toISOString().split('T')[0];

  const registryEntry = getGDriveReportRegistryEntry({
    storeCode: resolvedCode,
    storeName: resolvedName,
    agendaId: agenda?.id,
  });

  // 1. Check localStorage for saved VisitReportData by agenda.id or matching storeCode
  if (typeof window !== 'undefined') {
    try {
      if (agenda?.id) {
        const directRaw = localStorage.getItem(`fmcu_visit_report_${agenda.id}`);
        if (directRaw) {
          const parsed = JSON.parse(directRaw);
          if (parsed && parsed.storeName) {
            return {
              reportData: parsed,
              gdrivePdfUrl:
                registryEntry?.pdfUrl ||
                parsed.qscDriveUrl ||
                FMCU_REPORT_GDRIVE_FOLDER_URL,
              gdriveEmbedUrl: registryEntry?.gdriveEmbedUrl,
            };
          }
        }
      }

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('fmcu_visit_report_') ||
            key.startsWith('fmcu_visit_report_draft_v2_'))
        ) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            const codeMatch =
              String(parsed?.storeCode || '').toUpperCase() ===
              String(resolvedCode).toUpperCase();
            const nameMatch =
              String(parsed?.storeName || '').toUpperCase() ===
              String(resolvedName).toUpperCase();
            if (codeMatch || nameMatch) {
              return {
                reportData: parsed,
                gdrivePdfUrl:
                  registryEntry?.pdfUrl ||
                  parsed.qscDriveUrl ||
                  FMCU_REPORT_GDRIVE_FOLDER_URL,
                gdriveEmbedUrl: registryEntry?.gdriveEmbedUrl,
              };
            }
          }
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  // 2. Construct complete VisitReportData for historical store visit so PDF renders directly in web
  const fallbackReport: VisitReportData = {
    id: `report-hist-${resolvedCode}-${resolvedDate}`,
    agendaId: agenda?.id || `hist-${resolvedCode}`,
    actualIn: agenda?.actualIn || '08:30 WIB',
    actualOut: agenda?.actualOut || '17:30 WIB',
    liveGps: '-6.2293, 106.8256',
    actualInSubmitted: true,
    isManualCheckIn: false,
    storeFrontPhoto: '',
    visitorName: resolvedVisitor,
    storeName: resolvedName,
    storeCode: resolvedCode,
    storeType: resolvedType,
    storeHead: resolvedHead,
    visitDate: resolvedDate,
    areaManager: resolvedAm,
    regionalManager: resolvedRm,
    storeEmail: resolvedEmail,
    qscSheetPhoto: '',
    qscSheetTop: '',
    qscSheetBottom: '',
    gasSyncStatus: 'synced',
    crews: [
      { id: 'c-1', role: 'Store Head', name: resolvedHead, jobLevel: '1A' },
      { id: 'c-2', role: 'Shift Leader', name: 'Shift Leader On Duty', jobLevel: 'NS3' },
      { id: 'c-3', role: 'Crew Store 1', name: 'Crew Operasional 1', jobLevel: 'MG1' },
      { id: 'c-4', role: 'Crew Store 2', name: 'Crew Operasional 2', jobLevel: 'MG1' },
    ],
    enableQsc: true,
    enableOpi: true,
    observations: [
      {
        id: 'obs-hist-1',
        type: 'QSC',
        category: 'Lingkungan Store',
        auditFinding:
          agenda?.description ||
          `Pelaksanaan Audit QSC, pemeriksaan Holding Time R23, sanitasi area persiapan produk, serta verifikasi FEFO chiller pada Cabang ${resolvedName} (#${resolvedCode}).`,
        idealCondition:
          'Seluruh standar QSC, kebersihan area bar/chiller, serta pencatatan logbook suhu dan holding time R23 terpenuhi secara konsisten.',
        rootCause: 'Monitoring berkala dan pengawasan rutin pada saat pergantian shift operasional.',
        operationalImpact:
          '• Menjaga kualitas dan keamanan pangan (Food Safety) di cabang.\n• Meningkatkan kepuasan pelanggan dan kepatuhan SOP.',
        actionPlan:
          'Melakukan verifikasi checklist kebersihan harian dan briefing rutin kepada seluruh crew bertugas.',
        expectedResult: 'Akan dimonitoring pada visit berikutnya',
        deadline: resolvedDate,
        deadlineFormatted: resolvedDate,
      },
    ],
    enableEvidence: true,
    enableCa: true,
    evidencePhotos: [],
    caPhotos: [],
    spreadsheetUrl: 'https://tinyurl.com/store-caassignment',
    assignmentNotes:
      'Laporan hasil kunjungan toko tersimpan di Google Drive FMCU dan dipantau secara berkala.',
    status: 'SUBMITTED',
  };

  return {
    reportData: fallbackReport,
    gdrivePdfUrl: registryEntry?.pdfUrl || FMCU_REPORT_GDRIVE_FOLDER_URL,
    gdriveEmbedUrl: registryEntry?.gdriveEmbedUrl,
  };
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  user,
  agendas = [],
  users = [],
  onSelectAgenda,
  onBack,
}) => {
  const [activeCoverageTab, setActiveCoverageTab] = useState<'coverage' | 'leaderboard'>('coverage');
  const [storeFilter, setStoreFilter] = useState<'all' | 'covered' | 'pending'>('all');
  const [storeSearch, setStoreSearch] = useState('');

  // Direct In-Web GDrive PDF Viewer State
  const [activeReportViewer, setActiveReportViewer] = useState<{
    reportData: VisitReportData;
    gdrivePdfUrl: string;
    gdriveEmbedUrl?: string;
  } | null>(null);
  const [blobPdfUrl, setBlobPdfUrl] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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
  const targetStores = hasOwnStores ? myOwnedStores : allStoresWithOwnership;

  // 2. Filter History Schedule milik user sendiri (atau seluruh jadwal jika Admin/Executive)
  const myScheduleHistory = useMemo(() => {
    const source =
      user?.isAdmin || !currentUserName
        ? agendas
        : agendas.filter((a) => isSamePersonName(a.pic, currentUserName));

    return [...source].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.time || '').localeCompare(a.time || '');
    });
  }, [agendas, currentUserName, user?.isAdmin]);

  // 3. Hitung status coverage toko
  const coverageAnalysis = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    const coveredCodes = new Set<string>();
    const coveredNames = new Set<string>();

    // Cek dari localStorage saved visit reports
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.startsWith('fmcu_visit_report_') ||
              key.startsWith('fmcu_visit_report_draft_v2_'))
          ) {
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

      const matchedAgenda = relevantAgendas.find(
        (ag) =>
          String(ag.storeCode || '').toUpperCase() === codeUp ||
          String(ag.location || '').toUpperCase().includes(nameUp) ||
          String(ag.title || '').toUpperCase().includes(nameUp)
      );

      const isCompletedVisit =
        isCovered ||
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

  // Filter daftar toko
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
    if (completed || (cat === 'VISIT' && dateStr <= todayStr)) {
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

  // Synchronize mobile status bar & theme-color across preview modal and main coverage page
  useEffect(() => {
    if (activeReportViewer) {
      syncMobileStatusBarTheme(APP_THEME_COLOR_DARK, true);
    } else {
      syncMobileStatusBarTheme(APP_THEME_COLOR_LIGHT, false);
    }
    return () => {
      syncMobileStatusBarTheme(APP_THEME_COLOR_LIGHT, false);
    };
  }, [activeReportViewer]);

  // Ensure status bar is restored when unmounting HistoryView
  useEffect(() => {
    syncMobileStatusBarTheme(APP_THEME_COLOR_LIGHT, false);
    return () => {
      syncMobileStatusBarTheme(APP_THEME_COLOR_LIGHT, false);
    };
  }, []);

  const handleCloseReportViewer = () => {
    if (blobPdfUrl) {
      URL.revokeObjectURL(blobPdfUrl);
      setBlobPdfUrl(null);
    }
    setActiveReportViewer(null);
    syncMobileStatusBarTheme(APP_THEME_COLOR_LIGHT, false);
  };

  const handleBackToParent = () => {
    syncMobileStatusBarTheme(APP_THEME_COLOR_LIGHT, false);
    onBack();
  };

  // Effect to generate rendered PDF blob for in-web preview if direct GDrive embed isn't yet available
  useEffect(() => {
    if (!activeReportViewer) {
      if (blobPdfUrl) {
        URL.revokeObjectURL(blobPdfUrl);
        setBlobPdfUrl(null);
      }
      return;
    }

    if (activeReportViewer.gdriveEmbedUrl) {
      return;
    }

    let active = true;
    setIsGeneratingPdf(true);
    generatePdfDoc(activeReportViewer.reportData)
      .then((doc) => {
        if (!active) return;
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        setBlobPdfUrl(url);
        setIsGeneratingPdf(false);
      })
      .catch((err) => {
        console.warn('PDF blob generation error:', err);
        if (active) setIsGeneratingPdf(false);
      });

    return () => {
      active = false;
    };
  }, [activeReportViewer]);

  const handleOpenDirectPdfReport = (params: {
    storeCode?: string;
    storeName?: string;
    agenda?: ScheduleAgenda | null;
  }) => {
    const resolved = resolveVisitedStoreReportData({
      ...params,
      currentUserName,
    });
    setActiveReportViewer(resolved);
  };

  // ============================================================================
  // DIRECT IN-WEB GDRIVE PDF VIEWER (PREVIEW LANGSUNG DARI GDRIVE / PDF DOKUMEN)
  // ============================================================================
  if (activeReportViewer) {
    const pdfSrc =
      activeReportViewer.gdriveEmbedUrl ||
      blobPdfUrl ||
      activeReportViewer.gdrivePdfUrl;

    return (
      <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col">
        {/* Top GDrive Cloud PDF Banner */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleCloseReportViewer}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black">
                  <Cloud className="w-3 h-3" />
                  <span>Preview PDF Google Drive</span>
                </span>
                <span className="text-xs font-black text-white truncate">
                  Toko {activeReportViewer.reportData.storeName} (#{activeReportViewer.reportData.storeCode})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeReportViewer.reportData && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const doc = await generatePdfDoc(activeReportViewer.reportData);
                    doc.save(`Laporan_Visit_${activeReportViewer.reportData.storeCode}_${activeReportViewer.reportData.visitDate}.pdf`);
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh PDF</span>
              </button>
            )}

            <a
              href={activeReportViewer.gdrivePdfUrl || FMCU_REPORT_GDRIVE_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white text-[11px] font-extrabold flex items-center gap-1.5 transition shrink-0 shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka di Google Drive</span>
            </a>
          </div>
        </div>

        {/* Direct In-Web PDF Preview Frame */}
        <div className="flex-1 w-full bg-slate-900 p-2 sm:p-4 flex flex-col relative overflow-hidden">
          {isGeneratingPdf && !activeReportViewer.gdriveEmbedUrl ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold">Memuat preview PDF dari Google Drive...</p>
            </div>
          ) : (
            <iframe
              src={pdfSrc}
              title={`Preview PDF GDrive ${activeReportViewer.reportData.storeName}`}
              className="w-full flex-1 rounded-2xl border border-slate-700 bg-white shadow-2xl"
              allow="autoplay"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F8F9FD] overflow-y-auto no-scrollbar px-5 sm:px-6 pt-[max(1.5rem,env(safe-area-inset-top,24px))] pb-28 max-w-2xl mx-auto w-full select-none">
      {activeCoverageTab === 'coverage' ? (
        <>
          {/* Header Section 3: Coverage Store */}
          <div className="flex items-center justify-between mb-5">
            <button
              type="button"
              onClick={handleBackToParent}
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
            : `Menampilkan persentase coverage dari seluruh ${coverageAnalysis.totalCount} toko jaringan FMCU.`}
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-black/15 rounded-full h-2.5 mt-4 overflow-hidden">
          <div
            className="bg-white h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(4, coverageAnalysis.displayPercentage))}%` }}
          />
        </div>
      </div>

      {/* Daftar Status Coverage Toko + Tombol "Lihat Laporan" (Direct GDrive PDF di Web) */}
      <div className="bg-white rounded-3xl p-4 shadow-soft-card border border-slate-100 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              {hasOwnStores
                ? `Daftar Toko Milik Anda (${myOwnedStores.length})`
                : `Daftar Coverage Toko (${coverageAnalysis.totalCount})`}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              Toko yang sudah pernah di-visit dilengkapi tombol Lihat Laporan (PDF GDrive)
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
              Sudah Visit ({coverageAnalysis.coveredCount})
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

        {/* Search Stores */}
        <div className="relative mb-2.5">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={storeSearch}
            onChange={(e) => setStoreSearch(e.target.value)}
            placeholder="Cari nama atau kode toko..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-500"
          />
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2 pr-0.5 no-scrollbar">
          {filteredStoreStatuses.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-4">
              Tidak ada toko yang sesuai filter.
            </p>
          ) : (
            filteredStoreStatuses.slice(0, 80).map(({ store, isCovered, lastAgenda }) => (
              <div
                key={store.code}
                className="p-2.5 rounded-2xl bg-slate-50/90 border border-slate-100 flex items-center justify-between gap-2.5"
              >
                <div className="min-w-0 flex-1">
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
                    {lastAgenda ? ` • Visit: ${lastAgenda.date}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isCovered ? (
                    <>
                      <span className="hidden sm:inline-flex text-[10px] font-extrabold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Sudah Visit</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenDirectPdfReport({
                            storeCode: store.code,
                            storeName: store.name,
                            agenda: lastAgenda,
                          })
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00A389] to-[#0D9488] hover:brightness-105 text-white text-[10px] font-extrabold flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
                        title="Lihat Laporan PDF dari Google Drive langsung di Web"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Lihat Laporan</span>
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-slate-200/70 text-slate-600">
                      Belum Visit
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* History Toko yang Sudah Pernah Di-Visit & Aktivitas Saya */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <h3 className="text-sm font-black text-slate-800">
            History Kunjungan Toko &amp; Aktivitas
          </h3>
          <p className="text-[10px] text-slate-400 font-medium">
            Klik &ldquo;Lihat Laporan&rdquo; untuk menampilkan PDF laporan GDrive langsung di web
          </p>
        </div>
        <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
          {myScheduleHistory.length} Riwayat
        </span>
      </div>

      <div className="space-y-2.5">
        {myScheduleHistory.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center shadow-soft-card border border-slate-100">
            <p className="text-xs font-bold text-slate-500">
              Belum ada riwayat kunjungan toko untuk akun {currentUserName}.
            </p>
          </div>
        ) : (
          myScheduleHistory.map((item) => {
            const badge = getCategoryBadge(item.category, item.date, item.completed);
            const isVisitItem = item.category === 'VISIT';

            return (
              <div
                key={item.id}
                onClick={() => onSelectAgenda && onSelectAgenda(item)}
                className="bg-white rounded-2xl p-3.5 shadow-soft-card border border-slate-100/80 flex items-center justify-between gap-3 hover:shadow-soft-md transition-all cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
                    <Store className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-extrabold text-slate-800 truncate">
                        {item.storeName || item.location || item.title}
                      </h4>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
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
                        {item.actualIn
                          ? `IN ${item.actualIn}${item.actualOut ? ` - OUT ${item.actualOut}` : ''}`
                          : `${item.time} WIB`}
                      </span>
                      <span>•</span>
                      <span className="font-bold text-teal-700">{item.pic}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isVisitItem && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDirectPdfReport({
                          storeCode: item.storeCode,
                          storeName: item.storeName || item.location,
                          agenda: item,
                        });
                      }}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#00A389] to-[#0D9488] hover:brightness-105 text-white text-[10px] sm:text-[11px] font-extrabold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                      title="Lihat Laporan PDF dari Google Drive langsung di Web"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Lihat Laporan</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
        </>
      ) : (
        <LeaderboardTopVisit
          user={user}
          agendas={agendas}
          users={users}
          onBack={() => setActiveCoverageTab('coverage')}
        />
      )}

      {/* Minimalist Page Footer */}
      <DeveloperFooter />

      {/* ============================================================
          FLOATING APPLE LIQUID GLASS BOTTOM NAVBAR IN HALAMAN COVERAGE
          Ukuran diperpendek ramping (Compact & Short)
          ============================================================ */}
      <div className="fixed bottom-3 sm:bottom-3.5 left-0 right-0 mx-auto flex justify-center pointer-events-none z-40 select-none px-4">
        <div className="w-full max-w-[210px] sm:max-w-[225px] flex items-center pointer-events-auto origin-center relative overflow-hidden select-none p-1 rounded-[26px] iphone-glass-dock shadow-xl">
          {/* Top specular hairline */}
          <div className="pointer-events-none absolute inset-x-4 top-0 h-[0.5px] bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-50 z-0" />

          {/* Ambient bottom light refraction rim */}
          <div className="pointer-events-none absolute inset-x-6 bottom-0 h-[0.5px] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-30 z-0" />

          {/* Sliding Glass Lens Pill */}
          <div
            className="absolute top-1 bottom-1 rounded-[20px] iphone-glass-pill pointer-events-none dock-pill-transition z-0"
            style={{
              width: 'calc((100% - 8px) / 2)',
              transform: `translateX(calc(${activeCoverageTab === 'coverage' ? 0 : 1} * 100%))`,
              left: '4px',
            }}
          >
            <div className="pointer-events-none absolute inset-x-2 top-0 h-[0.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-60" />
            <div className="pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-b from-white/40 via-transparent to-white/10" />
          </div>

          {/* Tab 1: Coverage Store */}
          <button
            type="button"
            onClick={() => setActiveCoverageTab('coverage')}
            className="relative z-10 flex-1 rounded-[20px] flex items-center justify-center py-1.5 px-1.5 gap-1 dock-btn-transition active:scale-95 cursor-pointer focus:outline-none"
          >
            <Store
              className={`w-3.5 h-3.5 transition-all duration-300 ${
                activeCoverageTab === 'coverage'
                  ? 'text-teal-900 stroke-[2.4] scale-105'
                  : 'text-slate-600 stroke-[2]'
              }`}
            />
            <span
              className={`text-[11px] font-black transition-all ${
                activeCoverageTab === 'coverage' ? 'text-teal-950 font-black' : 'text-slate-600 font-bold'
              }`}
            >
              Coverage
            </span>
          </button>

          {/* Tab 2: Leaderboard Top Visit */}
          <button
            type="button"
            onClick={() => setActiveCoverageTab('leaderboard')}
            className="relative z-10 flex-1 rounded-[20px] flex items-center justify-center py-1.5 px-1.5 gap-1 dock-btn-transition active:scale-95 cursor-pointer focus:outline-none"
          >
            <Trophy
              className={`w-3.5 h-3.5 transition-all duration-300 ${
                activeCoverageTab === 'leaderboard'
                  ? 'text-purple-900 stroke-[2.4] scale-105'
                  : 'text-slate-600 stroke-[2]'
              }`}
            />
            <span
              className={`text-[11px] font-black transition-all ${
                activeCoverageTab === 'leaderboard' ? 'text-purple-950 font-black' : 'text-slate-600 font-bold'
              }`}
            >
              Top Visit
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
