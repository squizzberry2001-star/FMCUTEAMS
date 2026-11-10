import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Calendar as CalendarIcon,
  Store,
  Users,
  Clock,
  Search,
  Download,
  LogOut,
  Eye,
  Sparkles,
  Compass,
  Star,
  Building2,
  Lock,
  ChevronLeft,
  ChevronRight,
  Info,
  Layers,
  Thermometer,
} from 'lucide-react';
import { ScheduleAgenda, User, VisitReportData } from '../../types';
import { DeveloperFooter } from '../DeveloperFooter';
import { HoldingTimeR23Modal } from '../visit/HoldingTimeR23Modal';
import { EmployeeStoriesBar } from '../EmployeeStoriesBar';
import { ExecutiveDashboardView } from './ExecutiveDashboardView';
import { ExecutiveCalendarView } from './ExecutiveCalendarView';
import { ExecutiveTeamView } from './ExecutiveTeamView';
import { ExecutiveReportPreviewModal } from './ExecutiveReportPreviewModal';
import { fetchAllVisitReportsFromCloud } from '../../services/crossDeviceVisitSyncService';
import {
  HoldingTimeStandards,
  getActiveHoldingTimeStandards,
} from '../../data/holdingTimeR23';
import {
  StoreWithOwnership,
  getStoresWithOwnership,
  getBestieInChargeAssignments,
} from '../../data/masterStoresData';
import { exportMasterStoresToExcel } from '../../services/scheduleExcelService';
import {
  UserLivePresence,
  fetchLiveUserPresencesFromCloud,
  subscribeToLivePresences,
} from '../../services/userLivePresenceService';

export interface ExecutivePortalProps {
  executiveUser: User;
  agendas: ScheduleAgenda[];
  users: User[];
  onLogout: () => void;
  onSwitchToUserView?: () => void;
  onReplaySplash?: () => void;
  onOpenLiveMaps?: () => void;
}

type ExecutiveTab = 'dashboard' | 'schedules' | 'stores' | 'users' | 'holding-time';

export const ExecutivePortal: React.FC<ExecutivePortalProps> = ({
  executiveUser,
  agendas = [],
  users = [],
  onLogout,
  onSwitchToUserView,
  onReplaySplash,
  onOpenLiveMaps,
}) => {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<ExecutiveTab>('dashboard');

  // Top Search
  const [globalSearch, setGlobalSearch] = useState('');

  // Holding Time Standards (R23) State
  const [holdingStandards] = useState<HoldingTimeStandards>(() =>
    getActiveHoldingTimeStandards()
  );
  const [showR23PreviewModal, setShowR23PreviewModal] = useState(false);
  const [holdingSearch, setHoldingSearch] = useState('');

  // Master Stores & Bestie Ownership State
  const [storeScopeFilter, setStoreScopeFilter] = useState<'ALL' | 'OWNED' | 'UNOWNED'>('ALL');
  const [selectedBestieFilter, setSelectedBestieFilter] = useState<string>('ALL');
  const [selectedRmFilter, setSelectedRmFilter] = useState<string>('ALL');
  const [selectedStoreTypeFilter, setSelectedStoreTypeFilter] = useState<string>('ALL');
  const [storeSearchQuery, setStoreSearchQuery] = useState<string>('');
  const [storePage, setStorePage] = useState<number>(1);

  // Live Presences (Heartbeat from mobile staff)
  const [livePresences, setLivePresences] = useState<UserLivePresence[]>([]);

  useEffect(() => {
    fetchLiveUserPresencesFromCloud().then((res) => {
      if (Array.isArray(res)) setLivePresences(res);
    });

    const unsubscribe = subscribeToLivePresences((updated) => {
      setLivePresences(updated);
    });

    const pollInterval = setInterval(() => {
      if (!document.hidden) {
        fetchLiveUserPresencesFromCloud().then((res) => {
          if (Array.isArray(res)) setLivePresences(res);
        });
      }
    }, 25000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, []);

  // Cloud Visit Reports for In-Web Preview
  const [cloudReports, setCloudReports] = useState<(VisitReportData & { updatedAtMs?: number })[]>([]);
  const [executivePreviewReport, setExecutivePreviewReport] = useState<{
    reportData: VisitReportData;
    gdrivePdfUrl: string;
    gdriveEmbedUrl?: string;
    storeFolderName?: string;
    pdfFileName?: string;
    gdriveSavedDate?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const fetchReports = () => {
      fetchAllVisitReportsFromCloud(true).then((res) => {
        if (active && Array.isArray(res)) setCloudReports(res);
      });
    };

    fetchReports();
    const interval = setInterval(() => {
      if (!document.hidden) fetchReports();
    }, 15000);

    window.addEventListener('focus', fetchReports);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', fetchReports);
    };
  }, []);

  // Stores Data with Bestie Ownership
  const allStoresWithOwnership: StoreWithOwnership[] = useMemo(() => {
    return getStoresWithOwnership(
      selectedBestieFilter !== 'ALL' ? selectedBestieFilter : undefined
    );
  }, [selectedBestieFilter]);

  const bestieAssignments = useMemo(() => {
    return getBestieInChargeAssignments();
  }, []);

  const bestieOwnerStats = useMemo(() => {
    const counts = new Map<string, number>();
    bestieAssignments.forEach((a) => {
      if (a.bestieName) {
        counts.set(a.bestieName, (counts.get(a.bestieName) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [bestieAssignments]);

  const uniqueRmList = useMemo(() => {
    const set = new Set<string>();
    allStoresWithOwnership.forEach((s) => {
      if (s.regionalManager) set.add(s.regionalManager);
    });
    return Array.from(set).sort();
  }, [allStoresWithOwnership]);

  const uniqueAmCount = useMemo(() => {
    const set = new Set<string>();
    allStoresWithOwnership.forEach((s) => {
      if (s.areaManager) set.add(s.areaManager);
    });
    return set.size;
  }, [allStoresWithOwnership]);

  const filteredStores = useMemo(() => {
    const q = storeSearchQuery.trim().toLowerCase();
    return allStoresWithOwnership.filter((st) => {
      if (storeScopeFilter === 'OWNED' && !st.ownerBestieName) return false;
      if (storeScopeFilter === 'UNOWNED' && st.ownerBestieName) return false;
      if (
        selectedBestieFilter !== 'ALL' &&
        st.ownerBestieName.toLowerCase() !== selectedBestieFilter.toLowerCase()
      ) {
        return false;
      }
      if (selectedRmFilter !== 'ALL' && st.regionalManager !== selectedRmFilter) {
        return false;
      }
      if (
        selectedStoreTypeFilter !== 'ALL' &&
        st.type.toLowerCase() !== selectedStoreTypeFilter.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      return (
        st.code.toLowerCase().includes(q) ||
        st.name.toLowerCase().includes(q) ||
        st.city.toLowerCase().includes(q) ||
        st.address.toLowerCase().includes(q) ||
        st.storeHead.toLowerCase().includes(q) ||
        st.areaManager.toLowerCase().includes(q) ||
        st.regionalManager.toLowerCase().includes(q) ||
        st.ownerBestieName.toLowerCase().includes(q)
      );
    });
  }, [
    allStoresWithOwnership,
    storeScopeFilter,
    selectedBestieFilter,
    selectedRmFilter,
    selectedStoreTypeFilter,
    storeSearchQuery,
  ]);

  const STORES_PER_PAGE = 30;
  const totalStorePages = Math.max(1, Math.ceil(filteredStores.length / STORES_PER_PAGE));
  const paginatedStores = useMemo(() => {
    const safePage = Math.min(storePage, totalStorePages);
    const start = (safePage - 1) * STORES_PER_PAGE;
    return filteredStores.slice(start, start + STORES_PER_PAGE);
  }, [filteredStores, storePage, totalStorePages]);

  // Navigation Items
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'schedules', label: 'Calendar & Jadwal', icon: CalendarIcon },
    { id: 'stores', label: 'Master Toko (610)', icon: Store },
    { id: 'users', label: 'Team (36)', icon: Users },
    { id: 'holding-time', label: 'Standar R23', icon: Clock },
  ] as const;

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    setStoreSearchQuery(globalSearch.trim());
    setActiveTab('stores');
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col select-none text-slate-900 font-sans">
      {/* =====================================================================
          1. LORDBANK CORPORATE TOP NAVIGATION BAR (EXECUTIVE VIEW)
          ===================================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-100 px-4 sm:px-8 pt-[max(0.875rem,env(safe-area-inset-top,14px))] pb-3.5">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
          {/* Left: Clover Brand Mark + Pill Navigation */}
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="w-11 h-11 rounded-full bg-[#76C88D] hover:bg-[#66B87D] text-white flex items-center justify-center shadow-xs transition-transform active:scale-95 shrink-0 cursor-pointer"
              title="FMCU Executive Portal"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <circle cx="8.5" cy="8.5" r="3.2" />
                <circle cx="15.5" cy="8.5" r="3.2" />
                <circle cx="8.5" cy="15.5" r="3.2" />
                <circle cx="15.5" cy="15.5" r="3.2" />
              </svg>
            </button>

            {/* Desktop Pill Navigation */}
            <nav className="hidden lg:flex items-center gap-2 overflow-x-auto no-scrollbar">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-[#76C88D] text-white shadow-xs'
                        : 'bg-[#F3F5F8] text-slate-700 hover:bg-[#EAECEF]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Mobile Title & Role Pill */}
            <div className="lg:hidden min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900 truncate">FMCU Portal</span>
                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-[#EEF2F6] text-[#3A657C]">
                  Executive
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400 truncate">
                Head of Division • Read-Only
              </p>
            </div>
          </div>

          {/* Right: Search Input Pill + Icon Actions + Profile Avatar */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <form onSubmit={handleGlobalSearchSubmit} className="hidden md:block relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search agenda, toko, PIC..."
                className="w-48 xl:w-60 pl-9 pr-4 py-2 rounded-full bg-[#F3F5F8] focus:bg-white border border-transparent focus:border-slate-200 text-xs font-medium text-slate-800 outline-none transition-all"
              />
            </form>

            {onOpenLiveMaps && (
              <button
                type="button"
                onClick={onOpenLiveMaps}
                className="w-10 h-10 rounded-full bg-[#F3F5F8] hover:bg-[#EAECEF] text-slate-700 flex items-center justify-center transition active:scale-95 cursor-pointer relative"
                title="Buka Live Maps & Radar"
              >
                <Compass className="w-4 h-4 text-[#3A657C]" />
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#76C88D]" />
              </button>
            )}

            {onSwitchToUserView && (
              <button
                type="button"
                onClick={onSwitchToUserView}
                className="w-10 h-10 rounded-full bg-[#F3F5F8] hover:bg-[#EAECEF] text-slate-700 flex items-center justify-center transition active:scale-95 cursor-pointer"
                title="Pratinjau Tampilan Sisi User / Lapangan"
              >
                <Eye className="w-4 h-4 text-slate-700" />
              </button>
            )}

            {onReplaySplash && (
              <button
                type="button"
                onClick={onReplaySplash}
                className="hidden sm:flex w-10 h-10 rounded-full bg-[#F3F5F8] hover:bg-[#EAECEF] text-slate-700 items-center justify-center transition active:scale-95 cursor-pointer"
                title="Putar Ulang Splash Screen"
              >
                <Sparkles className="w-4 h-4 text-[#76C88D]" />
              </button>
            )}

            {/* User Profile Pill - Clean Minimalist Executive Initials */}
            <div className="flex items-center gap-2.5 pl-1">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#3A657C] to-[#2E8B57] text-white font-black text-xs flex items-center justify-center ring-2 ring-[#76C88D]/40 uppercase shadow-2xs shrink-0">
                {executiveUser.name.substring(0, 2)}
              </div>
              <div className="hidden xl:block text-left">
                <span className="block text-xs font-bold text-slate-900 leading-tight">
                  Head of Division
                </span>
                <span className="block text-[10.5px] font-medium text-slate-400">
                  Executive Viewer (Read-Only)
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="w-10 h-10 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition active:scale-95 cursor-pointer"
              title="Keluar dari Portal"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Horizontal Scrollable Pill Navigation */}
        <div className="lg:hidden flex items-center gap-2 overflow-x-auto no-scrollbar pt-3">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#76C88D] text-white shadow-xs'
                    : 'bg-[#F3F5F8] text-slate-700 hover:bg-[#EAECEF]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* =====================================================================
          2. MAIN TAB CONTENT AREA
          ===================================================================== */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* TAB 1: EXECUTIVE DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Live Stories Strip */}
            <div className="bg-[#F3F5F8] rounded-[32px] p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-[#FF2E93] to-[#FF8A00] animate-pulse" />
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 tracking-tight">
                    Live Employee Stories & Dokumentasi Lapangan
                  </h3>
                  <span className="text-[10px] font-bold text-teal-800 bg-white px-2.5 py-0.5 rounded-full border border-teal-200/80 shadow-2xs">
                    Aktif 24 Jam
                  </span>
                </div>
                <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
                  Monitoring foto, caption, dan interaksi lapangan seluruh tim
                </span>
              </div>
              <EmployeeStoriesBar currentUser={executiveUser} agendas={agendas} users={users} className="w-full" />
            </div>

            {/* Executive Dashboard View */}
            <ExecutiveDashboardView
              currentUser={executiveUser}
              agendas={agendas}
              users={users}
              stores={allStoresWithOwnership}
              livePresences={livePresences}
              cloudReports={cloudReports}
              onOpenLiveMaps={onOpenLiveMaps}
              onNavigateTab={(tab) => setActiveTab(tab as ExecutiveTab)}
              onOpenReportPreview={setExecutivePreviewReport}
            />
          </div>
        )}

        {/* TAB 2: CALENDAR & JADWAL */}
        {activeTab === 'schedules' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <ExecutiveCalendarView
              currentUser={executiveUser}
              agendas={agendas}
              users={users}
              cloudReports={cloudReports}
              onOpenReportPreview={setExecutivePreviewReport}
            />
          </div>
        )}

        {/* TAB 3: MASTER TOKO (610) & KEPEMILIKAN BESTIE (531) */}
        {activeTab === 'stores' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Summary Bento Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#F3F5F8] rounded-[26px] p-5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-500 block">
                    Master Data Toko FMI
                  </span>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1">
                    {allStoresWithOwnership.length} Cabang
                  </h3>
                  <span className="text-[11px] font-semibold text-[#3A657C] mt-1 block">
                    CVS, FamiSuper &amp; Housing
                  </span>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-white text-[#3A657C] flex items-center justify-center shadow-2xs">
                  <Store className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-[#F3F5F8] rounded-[26px] p-5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-500 block">
                    Toko Kepemilikan Bestie
                  </span>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1">
                    {bestieAssignments.length} Toko
                  </h3>
                  <span className="text-[11px] font-bold text-[#2E8B57] mt-1 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-[#76C88D] text-[#76C88D]" />
                    <span>Bestie In Charge Aktif</span>
                  </span>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-[#76C88D] text-white flex items-center justify-center shadow-2xs">
                  <Star className="w-5 h-5 fill-current" />
                </div>
              </div>

              <div className="bg-[#F3F5F8] rounded-[26px] p-5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-500 block">
                    Personel Bestie Pemilik
                  </span>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1">
                    {bestieOwnerStats.length} Bestie
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-500 mt-1 block">
                    PIC Kepemilikan Terpetakan
                  </span>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-white text-slate-800 flex items-center justify-center shadow-2xs">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-[#3A657C] rounded-[26px] p-5 text-white flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-white/75 block">
                    Cakupan Manajemen
                  </span>
                  <h3 className="text-2xl font-bold mt-1">
                    {uniqueRmList.length} RM • {uniqueAmCount} AM
                  </h3>
                  <span className="text-[11px] font-semibold text-[#76C88D] mt-1 block">
                    Regional &amp; Area Manager
                  </span>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-white/15 text-white flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Filter Pill Controls & Export */}
            <div className="bg-[#F3F5F8] rounded-[32px] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStoreScopeFilter('ALL');
                      setStorePage(1);
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      storeScopeFilter === 'ALL'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Semua Toko ({allStoresWithOwnership.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStoreScopeFilter('OWNED');
                      setStorePage(1);
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      storeScopeFilter === 'OWNED'
                        ? 'bg-[#76C88D] text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Bestie In Charge ({allStoresWithOwnership.filter((s) => s.ownerBestieName).length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStoreScopeFilter('UNOWNED');
                      setStorePage(1);
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      storeScopeFilter === 'UNOWNED'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Non-Bestie ({allStoresWithOwnership.filter((s) => !s.ownerBestieName).length})
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={exportMasterStoresToExcel}
                    className="px-4 py-2 rounded-full bg-[#76C88D] hover:bg-[#66B87D] text-white text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export 610 Toko (.xlsx)</span>
                  </button>

                  <span className="px-3.5 py-2 rounded-full bg-white text-[#3A657C] text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Executive Read-Only</span>
                  </span>
                </div>
              </div>

              {/* Search & Dropdown Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Cari kode (3013), nama toko, SH, AM, Bestie..."
                    value={storeSearchQuery}
                    onChange={(e) => {
                      setStoreSearchQuery(e.target.value);
                      setStorePage(1);
                    }}
                    className="w-full bg-white rounded-full pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#76C88D]"
                  />
                </div>

                <select
                  value={selectedBestieFilter}
                  onChange={(e) => {
                    setSelectedBestieFilter(e.target.value);
                    setStorePage(1);
                  }}
                  className="px-4 py-2 bg-white rounded-full text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="ALL">
                    ★ Semua Bestie In Charge ({bestieOwnerStats.length} Personil)
                  </option>
                  {bestieOwnerStats.map((b) => (
                    <option key={b.name} value={b.name}>
                      ★ {b.name} ({b.count} Toko)
                    </option>
                  ))}
                </select>

                <select
                  value={selectedRmFilter}
                  onChange={(e) => {
                    setSelectedRmFilter(e.target.value);
                    setStorePage(1);
                  }}
                  className="px-4 py-2 bg-white rounded-full text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="ALL">Semua RM ({uniqueRmList.length} Wilayah)</option>
                  {uniqueRmList.map((rm) => (
                    <option key={rm} value={rm}>
                      RM: {rm}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedStoreTypeFilter}
                  onChange={(e) => {
                    setSelectedStoreTypeFilter(e.target.value);
                    setStorePage(1);
                  }}
                  className="px-4 py-2 bg-white rounded-full text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="ALL">Semua Format Toko</option>
                  <option value="CVS">CVS (Convenience Store)</option>
                  <option value="FamiSuper">FamiSuper</option>
                  <option value="Housing">Housing</option>
                </select>
              </div>

              {/* Table of Stores */}
              <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#F8F9FA] border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4">Kode Toko</th>
                        <th className="py-3 px-4">Nama Toko &amp; Wilayah</th>
                        <th className="py-3 px-4">Kepemilikan Bestie</th>
                        <th className="py-3 px-4">Store Head (SH)</th>
                        <th className="py-3 px-4">Area &amp; Regional Manager</th>
                        <th className="py-3 px-4 text-right">Akses</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedStores.map((st) => (
                        <tr key={st.code} className="hover:bg-[#F9FAFC] transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg bg-[#F3F5F8] text-slate-800 border border-slate-200/60">
                              {st.code}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 truncate">{st.name}</div>
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              <span className="font-semibold text-slate-600">{st.city}</span>
                              {st.address ? ` • ${st.address}` : ''}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {st.ownerBestieName ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF8F0] text-[#2E8B57] text-[11px] font-bold">
                                <Star className="w-3 h-3 fill-[#76C88D] text-[#76C88D] shrink-0" />
                                <span>{st.ownerBestieName}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">Non-Bestie</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 max-w-[200px]">
                            <div className="font-bold text-slate-800 truncate">
                              SH: {st.storeHead || '-'}
                            </div>
                            <div className="text-[10.5px] text-slate-400 truncate">
                              {st.email || st.storePhone || '-'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 max-w-[220px]">
                            <div className="text-[11px] font-bold text-slate-800 truncate">
                              AM: <span className="text-[#3A657C]">{st.areaManager || '-'}</span>
                            </div>
                            <div className="text-[10.5px] font-medium text-slate-400 truncate">
                              RM: {st.regionalManager || '-'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F3F5F8] text-slate-500 text-[10px] font-bold">
                              <Lock className="w-3 h-3" />
                              <span>Read-Only</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500 bg-white">
                  <span>
                    Menampilkan {(storePage - 1) * STORES_PER_PAGE + 1}–
                    {Math.min(storePage * STORES_PER_PAGE, filteredStores.length)} dari {filteredStores.length} toko
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={storePage <= 1}
                      onClick={() => setStorePage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg bg-[#F3F5F8] hover:bg-slate-200 disabled:opacity-40 transition cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1 font-bold text-slate-800">
                      Halaman {storePage} / {totalStorePages}
                    </span>
                    <button
                      type="button"
                      disabled={storePage >= totalStorePages}
                      onClick={() => setStorePage((p) => Math.min(totalStorePages, p + 1))}
                      className="p-1.5 rounded-lg bg-[#F3F5F8] hover:bg-slate-200 disabled:opacity-40 transition cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: EXECUTIVE TEAM (36) VIEW */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <ExecutiveTeamView
              currentUser={executiveUser}
              users={users}
              agendas={agendas}
              stores={allStoresWithOwnership}
              livePresences={livePresences}
              cloudReports={cloudReports}
              onOpenReportPreview={(rep) => setExecutivePreviewReport(rep)}
            />
          </div>
        )}

        {/* TAB 5: STANDAR HOLDING TIME R23 */}
        {activeTab === 'holding-time' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-[#F3F5F8] rounded-[32px] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#3A657C] text-white flex items-center justify-center">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#2E8B57] uppercase">
                      {holdingStandards.revision} • {holdingStandards.version}
                    </span>
                    <h2 className="text-xl font-bold text-slate-900">
                      {holdingStandards.title}
                    </h2>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowR23PreviewModal(true)}
                    className="px-5 py-2.5 rounded-full bg-[#3A657C] hover:bg-[#2E5266] text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Pratinjau Dokumen Standar R23</span>
                  </button>

                  <span className="px-4 py-2.5 rounded-full bg-white text-[#3A657C] text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Executive Read-Only</span>
                  </span>
                </div>
              </div>

              {/* Meta Info Pill */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-white text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Departemen</span>
                  <span className="font-bold text-slate-800">{holdingStandards.department}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Diterbitkan</span>
                  <span className="font-bold text-slate-800">{holdingStandards.effectiveDateFormatted}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Status Regulasi</span>
                  <span className="font-bold text-emerald-700">Aktif &amp; Terverifikasi QA</span>
                </div>
              </div>

              {/* Search Bar for Holding Products */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari item produk (contoh: ayam katsu, sosis, pasta, susu)..."
                  value={holdingSearch}
                  onChange={(e) => setHoldingSearch(e.target.value)}
                  className="w-full bg-white rounded-2xl pl-11 pr-4 py-3 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#76C88D] shadow-2xs"
                />
              </div>

              {/* Product Categories Grid */}
              <div className="space-y-4">
                {holdingStandards.categories.map((cat) => {
                  const q = holdingSearch.trim().toLowerCase();
                  const matchingItems = cat.items.filter((item) => {
                    if (!q) return true;
                    return (
                      item.name.toLowerCase().includes(q) ||
                      (item.holding && item.holding.toLowerCase().includes(q)) ||
                      (item.cooking && item.cooking.toLowerCase().includes(q)) ||
                      (item.storage && item.storage.toLowerCase().includes(q))
                    );
                  });

                  if (matchingItems.length === 0) return null;

                  return (
                    <div key={cat.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-[#3A657C]" />
                          <h4 className="font-extrabold text-sm text-slate-900">{cat.name}</h4>
                          <span className="text-[10.5px] font-bold text-slate-400">
                            ({matchingItems.length} item)
                          </span>
                        </div>
                        {cat.machineTemp && (
                          <span className="px-3 py-1 rounded-full bg-[#EBF8F0] text-[#2E8B57] text-[10.5px] font-bold flex items-center gap-1">
                            <Thermometer className="w-3 h-3" />
                            <span>{cat.machineTemp}</span>
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {matchingItems.map((item, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-[#F8F9FA] border border-slate-100 text-xs space-y-1">
                            <div className="font-bold text-slate-900">{item.name}</div>
                            {item.holding && (
                              <div className="text-[11px] font-medium text-emerald-700">
                                <span className="text-slate-400">Holding:</span> {item.holding}
                              </div>
                            )}
                            {item.storage && (
                              <div className="text-[10.5px] text-slate-500">
                                <span className="text-slate-400">Penyimpanan:</span> {item.storage}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Developer Footer */}
      <DeveloperFooter />

      {/* Modal Preview Standar Holding Time R23 */}
      <HoldingTimeR23Modal
        isOpen={showR23PreviewModal}
        onClose={() => setShowR23PreviewModal(false)}
      />

      {/* Executive Report In-Web PDF Preview Modal */}
      <ExecutiveReportPreviewModal
        isOpen={Boolean(executivePreviewReport)}
        onClose={() => setExecutivePreviewReport(null)}
        reportData={executivePreviewReport?.reportData || null}
        gdrivePdfUrl={executivePreviewReport?.gdrivePdfUrl}
        gdriveEmbedUrl={executivePreviewReport?.gdriveEmbedUrl}
        storeFolderName={executivePreviewReport?.storeFolderName}
        pdfFileName={executivePreviewReport?.pdfFileName}
        gdriveSavedDate={executivePreviewReport?.gdriveSavedDate}
      />
    </div>
  );
};
