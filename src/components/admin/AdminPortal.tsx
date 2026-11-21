import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table2,
  Calendar as CalendarIcon,
  FileText,
  Radio,
  Store,
  BarChart3,
  MapPin,
  LogOut,
  Eye,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Trash2,
} from 'lucide-react';
import { ScheduleAgenda, User, VisitReportData } from '../../types';
import { HoldingTimeR23Modal } from '../visit/HoldingTimeR23Modal';
import { ExecutiveReportPreviewModal } from '../executive/ExecutiveReportPreviewModal';
import { ExcelScheduleUploadModal } from '../ExcelScheduleUploadModal';
import { fetchAllVisitReportsFromCloud } from '../../services/crossDeviceVisitSyncService';
import {
  UserLivePresence,
  fetchLiveUserPresencesFromCloud,
  subscribeToLivePresences,
  filterActiveRadarUsers,
} from '../../services/userLivePresenceService';
import {
  MasterStore,
  MasterStoreMetadata,
  getMasterStores,
  getMasterStoreMetadata,
  hydrateMasterStoresFromIdb,
  saveMasterStoresDurable,
  subscribeMasterStoresUpdate,
} from '../../data/masterStoresData';
import { GDRIVE_VERIFIED_REPORTS } from '../../data/gdriveVerifiedReportsData';
import {
  fetchMasterStoresFromCloud,
  flushPendingSchedulesQueue,
  getPendingSchedulesQueue,
  type CloudSyncResult,
} from '../../services/cloudScheduleSyncService';
import {
  AdminNavTab,
  ActivityKind,
  ClassifiedAgenda,
  UnifiedWebReport,
  classifyAgendaItem,
  buildUnifiedWebReports,
  formatLocalYmd,
  formatDisplayDateShort,
} from './adminTypes';
import { AdminAgendaSheetView } from './AdminAgendaSheetView';
import { AdminCalendarView } from './AdminCalendarView';
import { AdminReportsSheetView } from './AdminReportsSheetView';
import { AdminLiveMonitorView } from './AdminLiveMonitorView';
import { AdminMasterStoreView } from './AdminMasterStoreView';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { AdminScheduleDrawer } from './AdminScheduleDrawer';

export { classifyAgendaItem };
export type { ActivityKind, ClassifiedAgenda };

interface AdminPortalProps {
  adminUser: User;
  agendas: ScheduleAgenda[];
  users: User[];
  onAddAgenda: (newAgenda: ScheduleAgenda) => void;
  onUpdateAgenda: (updated: ScheduleAgenda) => void;
  onDeleteAgenda: (id: string) => void;
  onImportExcel: (
    importedUsers: User[],
    importedAgendas: ScheduleAgenda[],
    mode?: 'merge' | 'replace'
  ) => Promise<CloudSyncResult> | CloudSyncResult | void;
  onSwitchToUserView: () => void;
  onLogout: () => void;
  onAddUser?: (newUser: User) => void;
  onResetUserPassword?: (userName: string) => void;
  onReplaySplash?: () => void;
  onOpenLiveMaps?: () => void;
}

const NAV_ITEMS: Array<{
  id: AdminNavTab;
  label: string;
  mobileLabel: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'agenda',
    label: 'Agenda & Jadwal',
    mobileLabel: 'Agenda',
    subtitle: 'Lembar jadwal terintegrasi, buat jadwal & import Excel',
    icon: Table2,
  },
  {
    id: 'calendar',
    label: 'Kalender',
    mobileLabel: 'Kalender',
    subtitle: 'Matriks jadwal bulanan & penjadwalan per tanggal',
    icon: CalendarIcon,
  },
  {
    id: 'reports',
    label: 'Laporan',
    mobileLabel: 'Laporan',
    subtitle: 'Semua laporan Visit & NSO langsung di web & export Excel',
    icon: FileText,
  },
  {
    id: 'monitoring',
    label: 'Tim & Live',
    mobileLabel: 'Live',
    subtitle: 'Pantau aktivitas user, GPS realtime & kelola akun tim',
    icon: Radio,
  },
  {
    id: 'stores',
    label: 'Master Store',
    mobileLabel: 'Toko',
    subtitle: 'Database toko FamilyMart & update via PDF atau Excel',
    icon: Store,
  },
  {
    id: 'analytics',
    label: 'Analitik',
    mobileLabel: 'Analitik',
    subtitle: 'Ringkasan performa kunjungan, kepatuhan & sebaran toko',
    icon: BarChart3,
  },
];

export const AdminPortal: React.FC<AdminPortalProps> = ({
  adminUser,
  agendas,
  users,
  onAddAgenda,
  onUpdateAgenda,
  onDeleteAgenda,
  onImportExcel,
  onSwitchToUserView,
  onLogout,
  onAddUser,
  onResetUserPassword,
  onOpenLiveMaps,
}) => {
  const [activeTab, setActiveTab] = useState<AdminNavTab>('agenda');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Integrated Data States
  const [masterStores, setMasterStores] = useState<MasterStore[]>(() => getMasterStores());
  const [masterStoreMeta, setMasterStoreMeta] = useState<MasterStoreMetadata | null>(() =>
    getMasterStoreMetadata()
  );
  const [cloudReports, setCloudReports] = useState<(VisitReportData & { updatedAtMs?: number })[]>(
    []
  );
  const [livePresences, setLivePresences] = useState<UserLivePresence[]>([]);
  const [isRefreshingReports, setIsRefreshingReports] = useState(false);
  const [isRefreshingLive, setIsRefreshingLive] = useState(false);

  // Schedule Sync Queue & Feedback
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(
    () => getPendingSchedulesQueue()?.agendas?.length || 0
  );
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    ok: boolean;
    title: string;
    detail: string;
  } | null>(null);

  // Modals & Drawers
  const [isScheduleDrawerOpen, setIsScheduleDrawerOpen] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<ScheduleAgenda | null>(null);
  const [drawerDefaultDate, setDrawerDefaultDate] = useState<string>(() => formatLocalYmd());
  const [deletingAgenda, setDeletingAgenda] = useState<ScheduleAgenda | null>(null);
  const [showScheduleUploadModal, setShowScheduleUploadModal] = useState(false);
  const [showHoldingTimeModal, setShowHoldingTimeModal] = useState(false);
  const [previewModalState, setPreviewModalState] = useState<{
    reportData: VisitReportData;
    gdrivePdfUrl?: string;
    gdriveEmbedUrl?: string;
    storeFolderName?: string;
    pdfFileName?: string;
    gdriveSavedDate?: string;
  } | null>(null);

  const todayYmd = useMemo(() => formatLocalYmd(), []);

  // 1. Hydrate Master Stores (IndexedDB + Cloud D1 + Cross-tab Broadcast)
  useEffect(() => {
    let active = true;
    hydrateMasterStoresFromIdb().then((res) => {
      if (!active) return;
      if (res.stores.length > 0) setMasterStores(res.stores);
      if (res.meta) setMasterStoreMeta(res.meta);
    });

    fetchMasterStoresFromCloud()
      .then(async (remote) => {
        if (!active || !remote || remote.stores.length === 0) return;
        const localMeta = getMasterStoreMetadata();
        const remoteVer = remote.meta?.version || 0;
        const localVer = localMeta?.version || 0;
        if (remoteVer > localVer || (!localMeta && remote.meta)) {
          const saved = await saveMasterStoresDurable(remote.stores, {
            ...(remote.meta || {}),
            totalStores: remote.stores.length,
            cloudSynced: true,
          });
          if (active) {
            setMasterStores(remote.stores);
            setMasterStoreMeta(saved);
          }
        }
      })
      .catch(() => {});

    const unsub = subscribeMasterStoresUpdate((stores, meta) => {
      if (!active) return;
      if (stores.length > 0) setMasterStores(stores);
      if (meta) setMasterStoreMeta(meta);
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  // 2. Load Cloud Visit Reports (D1 + GAS)
  const refreshCloudReports = useCallback(async () => {
    setIsRefreshingReports(true);
    try {
      const data = await fetchAllVisitReportsFromCloud();
      if (Array.isArray(data)) setCloudReports(data);
    } catch {
      // keep existing
    } finally {
      setIsRefreshingReports(false);
    }
  }, []);

  useEffect(() => {
    refreshCloudReports();
    const timer = setInterval(refreshCloudReports, 45_000);
    return () => clearInterval(timer);
  }, [refreshCloudReports]);

  // 3. Realtime User Live GPS Presence (15s poll + BroadcastChannel)
  const refreshLivePresences = useCallback(async () => {
    setIsRefreshingLive(true);
    try {
      const list = await fetchLiveUserPresencesFromCloud();
      if (Array.isArray(list)) setLivePresences(list);
    } catch {
      // keep existing
    } finally {
      setIsRefreshingLive(false);
    }
  }, []);

  useEffect(() => {
    refreshLivePresences();
    const unsub = subscribeToLivePresences((updated) => {
      setLivePresences(updated);
    });
    const timer = setInterval(refreshLivePresences, 15_000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [refreshLivePresences]);

  // 4. Pending schedule sync tracker
  useEffect(() => {
    const syncQueueCheck = () => {
      const q = getPendingSchedulesQueue();
      setPendingSyncCount(q?.d1Pending ? q.agendas.length : 0);
    };
    syncQueueCheck();
    const timer = setInterval(syncQueueCheck, 5_000);
    return () => clearInterval(timer);
  }, [agendas.length]);

  // Report lookup map for Agenda classification
  const reportMap = useMemo(() => {
    const map = new Map<string, VisitReportData>();
    for (const r of cloudReports) {
      if (r.agendaId) map.set(r.agendaId, r);
      if (r.storeCode && r.visitDate) {
        map.set(`${String(r.storeCode).toUpperCase()}_${r.visitDate}`, r);
      }
    }
    return map;
  }, [cloudReports]);

  const classifiedAgendas = useMemo(
    () => agendas.map((ag) => classifyAgendaItem(ag, reportMap)),
    [agendas, reportMap]
  );

  const todayClassifiedAgendas = useMemo(
    () => classifiedAgendas.filter((c) => c.agenda.date === todayYmd),
    [classifiedAgendas, todayYmd]
  );

  const unifiedReports = useMemo(
    () => buildUnifiedWebReports(cloudReports, GDRIVE_VERIFIED_REPORTS),
    [cloudReports]
  );

  const activeRadarCount = useMemo(
    () => filterActiveRadarUsers(livePresences).length,
    [livePresences]
  );

  // Handlers
  const handleOpenCreateSchedule = (defaultDate?: string) => {
    setEditingAgenda(null);
    setDrawerDefaultDate(defaultDate || todayYmd);
    setIsScheduleDrawerOpen(true);
  };

  const handleOpenEditSchedule = (agenda: ScheduleAgenda) => {
    setEditingAgenda(agenda);
    setDrawerDefaultDate(agenda.date || todayYmd);
    setIsScheduleDrawerOpen(true);
  };

  const handleDuplicateAgenda = (agenda: ScheduleAgenda) => {
    const copy: ScheduleAgenda = {
      ...agenda,
      id: `ag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      completed: false,
      actualIn: undefined,
      actualOut: undefined,
      actualInIso: undefined,
      actualOutIso: undefined,
      silentAudit: undefined,
      kendala: undefined,
    };
    onAddAgenda(copy);
    setSyncFeedback({
      ok: true,
      title: `Jadwal "${agenda.title}" diduplikasi`,
      detail: `Tersimpan untuk ${agenda.pic} (${agenda.date})`,
    });
  };

  const handleSaveSingleSchedule = (saved: ScheduleAgenda, isEdit: boolean) => {
    if (isEdit) {
      onUpdateAgenda(saved);
    } else {
      onAddAgenda(saved);
    }
    setIsScheduleDrawerOpen(false);
    setEditingAgenda(null);
    setSyncFeedback({
      ok: true,
      title: isEdit ? 'Jadwal diperbarui' : 'Jadwal baru ditambahkan',
      detail: `${saved.title} • ${saved.pic} (${saved.date})`,
    });
  };

  const handleSaveBatchSchedule = async (batch: ScheduleAgenda[]) => {
    setIsScheduleDrawerOpen(false);
    setEditingAgenda(null);
    const res = await onImportExcel(users, batch, 'merge');
    const ok = !res || (typeof res === 'object' && res.ok);
    setSyncFeedback({
      ok,
      title: `${batch.length} jadwal berhasil dibuat sekaligus`,
      detail: ok
        ? 'Tersinkronisasi otomatis ke Cloudflare D1.'
        : 'Tersimpan lokal, antrean cloud berjalan otomatis.',
    });
  };

  const handleRetryScheduleSync = async () => {
    if (isRetryingSync) return;
    setIsRetryingSync(true);
    try {
      const res = await flushPendingSchedulesQueue();
      if (res && res.ok && !res.queuedOffline) {
        setPendingSyncCount(0);
        setSyncFeedback({
          ok: true,
          title: `Antrean tersinkronisasi (${res.syncedCount} agenda)`,
          detail: `D1: ${res.d1Synced ? 'OK' : 'Pending'} • GAS: ${res.gasSynced ? 'OK' : 'Latar'}`,
        });
      }
    } finally {
      setIsRetryingSync(false);
    }
  };

  const handlePreviewVisitReport = (report: VisitReportData) => {
    setPreviewModalState({
      reportData: report,
      gdrivePdfUrl: (report as any).pdfUrl || (report as any).driveUrl || report.spreadsheetUrl,
      gdriveEmbedUrl: (report as any).gdriveEmbedUrl,
    });
  };

  const handlePreviewUnifiedReport = (rep: UnifiedWebReport) => {
    setPreviewModalState({
      reportData: rep.reportData,
      gdrivePdfUrl: rep.gdriveViewUrl,
      gdriveEmbedUrl: rep.gdriveEmbedUrl,
      storeFolderName: rep.folderName,
      pdfFileName: rep.fileName,
      gdriveSavedDate: rep.gdriveSavedDate,
    });
  };

  const activeNavMeta = NAV_ITEMS.find((n) => n.id === activeTab) || NAV_ITEMS[0];

  // Primary 5 mobile bottom nav items (Analytics accessible via Mobile Menu drawer cleanly)
  const mobileBottomNavIds: AdminNavTab[] = ['agenda', 'calendar', 'reports', 'monitoring', 'stores'];

  return (
    <div className="h-[100dvh] w-full bg-[#F8FAFC] text-slate-800 flex overflow-hidden font-sans">
      {/* ====================================================================
          DESKTOP COLLAPSIBLE SAAS SIDEBAR
          ==================================================================== */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-slate-200 shrink-0 transition-all duration-200 ease-out ${
          sidebarCollapsed ? 'w-[64px]' : 'w-[228px]'
        }`}
      >
        {/* Brand Header */}
        <div className="h-[52px] px-3.5 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
              FM
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-slate-900 leading-tight truncate">
                  FMCU Admin
                </div>
                <div className="text-[10px] text-slate-400 leading-tight truncate">
                  Workspace Operasional
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
            title={sidebarCollapsed ? 'Perluas Sidebar' : 'Kecilkan Sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto admin-sheet-scroll">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            const badgeCount =
              item.id === 'monitoring' && activeRadarCount > 0
                ? activeRadarCount
                : item.id === 'agenda'
                ? agendas.length
                : item.id === 'reports'
                ? unifiedReports.length
                : item.id === 'stores'
                ? masterStores.length
                : null;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active
                        ? 'text-emerald-400'
                        : item.id === 'monitoring' && activeRadarCount > 0
                        ? 'text-emerald-600'
                        : 'text-slate-400'
                    }`}
                  />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!sidebarCollapsed && badgeCount !== null && (
                  <span
                    className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-md tabular-nums ${
                      item.id === 'monitoring' && activeRadarCount > 0
                        ? active
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-emerald-50 text-emerald-700'
                        : active
                        ? 'bg-white/15 text-slate-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Utility Links (No Duplication) */}
        <div className="p-2 border-t border-slate-200 space-y-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowHoldingTimeModal(true)}
            title={sidebarCollapsed ? 'Standar Holding Time R23' : undefined}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Holding Time R23</span>}
          </button>

          <button
            type="button"
            onClick={onSwitchToUserView}
            title={sidebarCollapsed ? 'Tampilan Staff' : undefined}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
          >
            <Eye className="w-4 h-4 text-slate-400 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Tampilan Staff</span>}
          </button>

          <button
            type="button"
            onClick={onLogout}
            title={sidebarCollapsed ? 'Keluar' : undefined}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Keluar</span>}
          </button>
        </div>
      </aside>

      {/* ====================================================================
          MAIN RIGHT COLUMN (TOP UTILITY BAR + EDGE-TO-EDGE WORKSPACE)
          ==================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Minimalist Top Utility Bar (48px mobile / 52px desktop) */}
        <header className="h-12 lg:h-[52px] bg-white border-b border-slate-200 px-3 sm:px-5 flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="lg:hidden w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
              FM
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900 truncate leading-tight">
                  {activeNavMeta.label}
                </h1>
                <span className="hidden md:inline-block text-[11px] font-mono text-slate-400">
                  • {formatDisplayDateShort(todayYmd)}
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-500 truncate leading-tight">
                {activeNavMeta.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Single Clean Live Maps Trigger */}
            {onOpenLiveMaps && (
              <button
                type="button"
                onClick={onOpenLiveMaps}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition active:scale-[0.98] cursor-pointer"
                title="Buka Peta Tracking User & Pinpoint Toko Live"
              >
                <span className="relative flex h-2 w-2">
                  {activeRadarCount > 0 && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      activeRadarCount > 0 ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                </span>
                <MapPin className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden xs:inline sm:inline">Live Maps</span>
                {activeRadarCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold tabular-nums">
                    {activeRadarCount}
                  </span>
                )}
              </button>
            )}

            {/* Admin Chip (Desktop) */}
            <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center">
                {(adminUser?.name || 'AD').slice(0, 2).toUpperCase()}
              </div>
              <div className="text-xs font-semibold text-slate-700 max-w-[120px] truncate">
                {adminUser?.name || 'Admin'}
              </div>
            </div>

            {/* Mobile Menu Drawer Button */}
            <button
              type="button"
              onClick={() => setShowMobileMenu(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              aria-label="Menu Admin"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Active View Workspace Canvas (edge-to-edge on mobile to maximize data viewport) */}
        <main className="flex-1 min-h-0 overflow-hidden p-0 md:p-4 pb-[58px] lg:pb-4">
          {activeTab === 'agenda' && (
            <AdminAgendaSheetView
              classifiedAgendas={classifiedAgendas}
              agendas={agendas}
              users={users}
              todayYmd={todayYmd}
              pendingSyncCount={pendingSyncCount}
              isRetryingSync={isRetryingSync}
              syncFeedback={syncFeedback}
              onDismissFeedback={() => setSyncFeedback(null)}
              onRetrySync={handleRetryScheduleSync}
              onOpenCreate={handleOpenCreateSchedule}
              onOpenEdit={handleOpenEditSchedule}
              onDuplicateAgenda={handleDuplicateAgenda}
              onDeleteAgenda={(ag) => setDeletingAgenda(ag)}
              onOpenUploadExcel={() => setShowScheduleUploadModal(true)}
              onPreviewReport={handlePreviewVisitReport}
            />
          )}

          {activeTab === 'calendar' && (
            <AdminCalendarView
              classifiedAgendas={classifiedAgendas}
              todayYmd={todayYmd}
              onCreateOnDate={handleOpenCreateSchedule}
              onEditAgenda={handleOpenEditSchedule}
              onDeleteAgenda={(ag) => setDeletingAgenda(ag)}
              onPreviewReport={handlePreviewVisitReport}
            />
          )}

          {activeTab === 'reports' && (
            <AdminReportsSheetView
              reports={unifiedReports}
              todayYmd={todayYmd}
              isRefreshing={isRefreshingReports}
              onRefresh={refreshCloudReports}
              onPreviewWebReport={handlePreviewUnifiedReport}
            />
          )}

          {activeTab === 'monitoring' && (
            <AdminLiveMonitorView
              users={users}
              livePresences={livePresences}
              todayClassifiedAgendas={todayClassifiedAgendas}
              todayYmd={todayYmd}
              isRefreshing={isRefreshingLive}
              onRefresh={refreshLivePresences}
              onOpenLiveMaps={onOpenLiveMaps}
              onPreviewReport={handlePreviewVisitReport}
              onAddUser={onAddUser}
              onResetUserPassword={onResetUserPassword}
            />
          )}

          {activeTab === 'stores' && (
            <AdminMasterStoreView
              masterStores={masterStores}
              masterStoreMeta={masterStoreMeta}
              adminName={adminUser?.name || 'Admin FMCU'}
              onMasterStoresUpdated={(stores, meta) => {
                setMasterStores(stores);
                setMasterStoreMeta(meta);
              }}
            />
          )}

          {activeTab === 'analytics' && (
            <AdminAnalyticsView
              classifiedAgendas={classifiedAgendas}
              unifiedReports={unifiedReports}
              users={users}
              masterStores={masterStores}
              todayYmd={todayYmd}
            />
          )}
        </main>
      </div>

      {/* ====================================================================
          MOBILE FIXED BOTTOM NAVIGATION BAR (5 ERGONOMIC TABS)
          ==================================================================== */}
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1.5 pt-1 pb-[max(6px,env(safe-area-inset-bottom))] grid grid-cols-5 gap-0.5">
        {mobileBottomNavIds.map((id) => {
          const item = NAV_ITEMS.find((n) => n.id === id)!;
          const Icon = item.icon;
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`relative flex flex-col items-center justify-center py-1.5 rounded-xl transition cursor-pointer ${
                active ? 'text-slate-900 bg-slate-100/90 font-semibold' : 'text-slate-400'
              }`}
            >
              <div className="relative">
                <Icon className={`w-4 h-4 ${active ? 'text-slate-900' : 'text-slate-400'}`} />
                {id === 'monitoring' && activeRadarCount > 0 && (
                  <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                )}
              </div>
              <span className="text-[10px] mt-0.5 leading-none">{item.mobileLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* ====================================================================
          MOBILE SECONDARY MENU DRAWER (Analitik, Holding Time, Staff View, Logout)
          ==================================================================== */}
      {showMobileMenu && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            onClick={() => setShowMobileMenu(false)}
          />
          <div className="relative z-10 w-[270px] max-w-[85vw] bg-white h-full border-l border-slate-200 flex flex-col shadow-2xl admin-drawer-right">
            <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {adminUser?.name || 'Admin FMCU'}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{adminUser?.email}</div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileMenu(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 space-y-1 flex-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('analytics');
                  setShowMobileMenu(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Analitik & Performa Tim</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMenu(false);
                  setShowHoldingTimeModal(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-slate-500" />
                <span>Standar Holding Time R23</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMenu(false);
                  onSwitchToUserView();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <Eye className="w-4 h-4 text-slate-500" />
                <span>Beralih ke Tampilan Staff</span>
              </button>
            </div>

            <div className="p-2.5 border-t border-slate-200">
              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar Akun</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          GLOBAL MODALS & DRAWERS
          ==================================================================== */}
      <AdminScheduleDrawer
        isOpen={isScheduleDrawerOpen}
        editingAgenda={editingAgenda}
        defaultDate={drawerDefaultDate}
        users={users}
        masterStores={masterStores}
        onClose={() => {
          setIsScheduleDrawerOpen(false);
          setEditingAgenda(null);
        }}
        onSaveSingle={handleSaveSingleSchedule}
        onSaveBatch={handleSaveBatchSchedule}
      />

      {showScheduleUploadModal && (
        <ExcelScheduleUploadModal
          existingUsers={users}
          currentAgendasCount={agendas.length}
          onClose={() => setShowScheduleUploadModal(false)}
          onImportSuccess={async (updatedUsers, newAgendas, mode) => {
            const res = await onImportExcel(updatedUsers, newAgendas, mode);
            if (res && typeof res === 'object' && 'ok' in res) {
              setSyncFeedback({
                ok: res.ok && !res.queuedOffline,
                title:
                  res.ok && !res.queuedOffline
                    ? `Berhasil import & sinkronisasi ${newAgendas.length} agenda`
                    : `Tersimpan lokal (${newAgendas.length} agenda), sinkronisasi tertunda`,
                detail: `D1: ${res.d1Synced ? 'OK' : 'Pending'} • GAS: ${
                  res.gasSynced ? 'OK' : 'Latar'
                }`,
              });
            }
            return res;
          }}
        />
      )}

      {deletingAgenda && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={() => setDeletingAgenda(null)}
          />
          <div className="relative z-10 w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-5 shadow-xl space-y-3 admin-sheet-up">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Hapus Jadwal Agenda?</h3>
                <p className="text-[11px] text-slate-500">Tindakan ini akan disinkronkan ke cloud.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2">
              <strong className="text-slate-900">{deletingAgenda.title}</strong>
              <br />
              {deletingAgenda.pic} • {deletingAgenda.date}
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingAgenda(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteAgenda(deletingAgenda.id);
                  setDeletingAgenda(null);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {previewModalState && (
        <ExecutiveReportPreviewModal
          isOpen={Boolean(previewModalState)}
          reportData={previewModalState.reportData}
          gdrivePdfUrl={previewModalState.gdrivePdfUrl}
          gdriveEmbedUrl={previewModalState.gdriveEmbedUrl}
          storeFolderName={previewModalState.storeFolderName}
          pdfFileName={previewModalState.pdfFileName}
          gdriveSavedDate={previewModalState.gdriveSavedDate}
          onClose={() => setPreviewModalState(null)}
        />
      )}

      {showHoldingTimeModal && (
        <HoldingTimeR23Modal
          isOpen={showHoldingTimeModal}
          onClose={() => setShowHoldingTimeModal(false)}
        />
      )}
    </div>
  );
};
