import React, { useState, useRef, useMemo } from 'react';
import {
  LayoutDashboard,
  Calendar as CalendarIcon,
  Upload,
  FileSpreadsheet,
  Users,
  Tag,
  Plus,
  Search,
  Trash2,
  Edit3,
  CheckCircle2,
  Download,
  LogOut,
  Eye,
  Sparkles,
  ShieldCheck,
  Clock,
  MapPin,
  Store,
  RefreshCw,
  X,
  Star,
  ChevronLeft,
  ChevronRight,
  Info,
  Building2,
  Check,
  Lock,
  Bell,
  Compass,
  Share2,
  LayoutGrid,
  List,
  Navigation,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';
import { ScheduleAgenda, ScheduleCategory, User } from '../../types';
import excelSeed from '../../data/excelScheduleSeed.json';
import { DeveloperFooter } from '../DeveloperFooter';
import { HoldingTimeR23Modal } from '../visit/HoldingTimeR23Modal';
import { ExecutiveAnalyticsSuite } from './ExecutiveAnalyticsSuite';
import {
  HoldingTimeStandards,
  getActiveHoldingTimeStandards,
  saveHoldingTimeStandards,
  INITIAL_HOLDING_TIME_R23,
} from '../../data/holdingTimeR23';
import {
  MasterStore,
  StoreWithOwnership,
  getMasterStores,
  saveMasterStores,
  getBestieInChargeAssignments,
  saveBestieInChargeAssignments,
  getStoresWithOwnership,
  syncBestieInChargeFromSheet,
  findMasterStoreByCodeOrName,
  isSamePersonName,
} from '../../data/masterStoresData';
import {
  ParsedExcelScheduleSummary,
  parseScheduleExcelSheet,
  exportScheduleToTemplateExcel,
  exportMasterStoresToExcel,
} from '../../services/scheduleExcelService';

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
  ) => void;
  onSwitchToUserView: () => void;
  onLogout: () => void;
  onAddUser?: (newUser: User) => void;
  onResetUserPassword?: (userName: string) => void;
  onReplaySplash?: () => void;
  onOpenLiveMaps?: () => void;
}

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
  onReplaySplash,
  onOpenLiveMaps,
}) => {
  const isReadOnly = Boolean(
    adminUser.isExecutiveViewer || adminUser.accessLevel === 'EXECUTIVE_VIEWER'
  );

  // Navigation Tabs (Lordbank Corporate Architecture)
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'schedules'
    | 'stores'
    | 'users'
    | 'import-excel'
    | 'holding-time'
    | 'categories'
  >('dashboard');

  // Global Top Search Query
  const [globalSearch, setGlobalSearch] = useState('');

  // Holding Time Standards (R23) State
  const [holdingStandards, setHoldingStandards] = useState<HoldingTimeStandards>(() =>
    getActiveHoldingTimeStandards()
  );
  const [showR23PreviewModal, setShowR23PreviewModal] = useState(false);
  const [holdingUploadStatus, setHoldingUploadStatus] = useState<string | null>(null);
  const holdingFileInputRef = useRef<HTMLInputElement>(null);

  // Master Stores & Bestie Ownership State
  const [storesVersion, setStoresVersion] = useState(0);
  const [storeScopeFilter, setStoreScopeFilter] = useState<'ALL' | 'OWNED' | 'UNOWNED'>('ALL');
  const [selectedBestieFilter, setSelectedBestieFilter] = useState<string>('ALL');
  const [selectedRmFilter, setSelectedRmFilter] = useState<string>('ALL');
  const [selectedStoreTypeFilter, setSelectedStoreTypeFilter] = useState<string>('ALL');
  const [storeSearchQuery, setStoreSearchQuery] = useState<string>('');
  const [storePage, setStorePage] = useState<number>(1);
  const [isSyncingBestieSheet, setIsSyncingBestieSheet] = useState(false);
  const [storeActionStatus, setStoreActionStatus] = useState<string | null>(null);

  // Store Create / Edit Modal State
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreWithOwnership | null>(null);
  const [storeForm, setStoreForm] = useState<MasterStore & { ownerBestieName: string }>({
    code: '',
    name: '',
    type: 'CVS',
    city: 'JAKARTA',
    address: '',
    lat: -6.2,
    lng: 106.8,
    email: '',
    storePhone: '',
    storeHead: '',
    areaManager: '',
    areaManagerEmail: '',
    regionalManager: '',
    regionalManagerEmail: '',
    ownerBestieName: '',
  });

  // Schedule Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');

  // Modal State for New / Edit Agenda
  const [showAgendaModal, setShowAgendaModal] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<ScheduleAgenda | null>(null);

  // Form State for Agenda Modal + Master Store Ownership Picker
  const [agendaTitle, setAgendaTitle] = useState('');
  const [agendaPic, setAgendaPic] = useState(
    users.find((u) => !u.isAdmin)?.name || 'Septiana Indasari'
  );
  const [agendaCategory, setAgendaCategory] = useState<ScheduleCategory>('VISIT');
  const [agendaDate, setAgendaDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [agendaTime, setAgendaTime] = useState('08:30');
  const [agendaEndTime, setAgendaEndTime] = useState('17:30');
  const [agendaLocation, setAgendaLocation] = useState('');
  const [agendaDescription, setAgendaDescription] = useState('');
  const [agendaPriority, setAgendaPriority] = useState<'NORMAL' | 'HIGH'>('NORMAL');
  const [agendaStoreCode, setAgendaStoreCode] = useState<string>('');
  const [modalStoreScope, setModalStoreScope] = useState<'ALL' | 'OWNED'>('ALL');
  const [modalStoreSearch, setModalStoreSearch] = useState<string>('');

  // Excel Upload & Multi-Sheet Extraction Preview State
  const [isDragging, setIsDragging] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [uploadedWorkbook, setUploadedWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [selectedSheetName, setSelectedSheetName] = useState<string>('');
  const [lastParsedSummary, setLastParsedSummary] = useState<ParsedExcelScheduleSummary | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Categories Master List
  const [categoriesList] = useState<
    { id: ScheduleCategory; label: string; desc: string; bg: string; text: string }[]
  >([
    {
      id: 'VISIT',
      label: 'Store Visit',
      desc: 'Kunjungan & inspeksi lapangan toko (Wajib Col F: Visit / Visit Store / Refreshment QSC & Col G bukan NSO/FMCU)',
      bg: 'bg-[#EBF8F0]',
      text: 'text-[#2E8B57]',
    },
    {
      id: 'NSO',
      label: 'NSO Opening',
      desc: 'New Store Opening & Re-Opening (Otomatis jika Col F/G mengandung NSO)',
      bg: 'bg-[#EBF2F6]',
      text: 'text-[#3A657C]',
    },
    {
      id: 'TRAINING',
      label: 'Training / SBS',
      desc: 'Pelatihan modul, SBS, Basic Training, Refreshment non-store (Lokasi FMCU)',
      bg: 'bg-[#EEF1FC]',
      text: 'text-[#4B5FC2]',
    },
    {
      id: 'MEETING',
      label: 'Meeting / Koordinasi',
      desc: 'Rapat operasional, town hall, briefing, koordinasi tim',
      bg: 'bg-[#ECF4F8]',
      text: 'text-[#3B7898]',
    },
    {
      id: 'AUDIT',
      label: 'Audit SOP / Assessment',
      desc: 'Audit kepatuhan, kalibrasi, uji kompetensi',
      bg: 'bg-[#FEF6E7]',
      text: 'text-[#B8731B]',
    },
    {
      id: 'WORK_PLAN',
      label: 'Weekly Work Plan',
      desc: 'Perencanaan kerja mingguan, penyusunan modul & evaluasi',
      bg: 'bg-[#EBF5F2]',
      text: 'text-[#3E7B69]',
    },
    {
      id: 'OPERATION',
      label: 'Operations Duty',
      desc: 'Aktivitas operasional rutin FMCU',
      bg: 'bg-[#F1F3F6]',
      text: 'text-[#4E5A68]',
    },
    {
      id: 'CUTI',
      label: 'Cuti Resmi',
      desc: 'Izin cuti resmi karyawan (Col F: Cuti)',
      bg: 'bg-[#FDECEC]',
      text: 'text-[#C24646]',
    },
    {
      id: 'OFF',
      label: 'Hari Libur / OFF',
      desc: 'Libur mingguan / Ganti Off / Auto-Off hari kosong dalam minggu jadwal',
      bg: 'bg-[#F3F5F8]',
      text: 'text-[#616E7C]',
    },
  ]);

  // ============================================================================
  // COMPUTED MASTER STORES & BESTIE IN CHARGE DATA
  // ============================================================================
  const allStoresWithOwnership = useMemo(() => {
    void storesVersion;
    return getStoresWithOwnership(
      selectedBestieFilter !== 'ALL' ? selectedBestieFilter : undefined
    );
  }, [storesVersion, selectedBestieFilter]);

  const bestieAssignments = useMemo(() => {
    void storesVersion;
    return getBestieInChargeAssignments();
  }, [storesVersion]);

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

  const modalPickableStores = useMemo(() => {
    void storesVersion;
    const list = getStoresWithOwnership(agendaPic);
    const q = modalStoreSearch.trim().toLowerCase();
    return list
      .filter((s) => {
        if (modalStoreScope === 'OWNED' && !s.isOwnedByBestie) return false;
        if (!q) return true;
        return (
          s.code.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.ownerBestieName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.isOwnedByBestie !== b.isOwnedByBestie) {
          return a.isOwnedByBestie ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  }, [storesVersion, agendaPic, modalStoreScope, modalStoreSearch]);

  const ownedByCurrentPicCount = useMemo(() => {
    void storesVersion;
    return getStoresWithOwnership(agendaPic).filter((s) => s.isOwnedByBestie).length;
  }, [storesVersion, agendaPic]);

  // ============================================================================
  // HANDLERS
  // ============================================================================
  const handleSyncBestieSheet = async () => {
    setIsSyncingBestieSheet(true);
    setStoreActionStatus('Menghubungkan ke Google Sheets Kepemilikan Toko (Bestie In Charge)...');
    const res = await syncBestieInChargeFromSheet();
    setIsSyncingBestieSheet(false);
    setStoresVersion((v) => v + 1);
    setStoreActionStatus(res.message);
    if (res.success) {
      confetti({ particleCount: 55, spread: 60, origin: { y: 0.6 } });
    }
    setTimeout(() => setStoreActionStatus(null), 5000);
  };

  const handleOpenAddStoreModal = () => {
    if (isReadOnly) return;
    setEditingStore(null);
    setStoreForm({
      code: '',
      name: '',
      type: 'CVS',
      city: 'JAKARTA',
      address: '',
      lat: -6.2,
      lng: 106.8,
      email: '',
      storePhone: '',
      storeHead: '',
      areaManager: '',
      areaManagerEmail: '',
      regionalManager: '',
      regionalManagerEmail: '',
      ownerBestieName: '',
    });
    setShowStoreModal(true);
  };

  const handleOpenEditStoreModal = (st: StoreWithOwnership) => {
    if (isReadOnly) return;
    setEditingStore(st);
    setStoreForm({
      code: st.code,
      name: st.name,
      type: st.type || 'CVS',
      city: st.city || '',
      address: st.address || '',
      lat: st.lat || -6.2,
      lng: st.lng || 106.8,
      email: st.email || '',
      storePhone: st.storePhone || '',
      storeHead: st.storeHead || '',
      areaManager: st.areaManager || '',
      areaManagerEmail: st.areaManagerEmail || '',
      regionalManager: st.regionalManager || '',
      regionalManagerEmail: st.regionalManagerEmail || '',
      ownerBestieName: st.ownerBestieName || '',
    });
    setShowStoreModal(true);
  };

  const handleSaveStoreModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !storeForm.code.trim() || !storeForm.name.trim()) return;

    const currentStores = getMasterStores();
    const codeUpper = storeForm.code.trim().toUpperCase();
    const newStoreObj: MasterStore = {
      code: codeUpper,
      name: storeForm.name.trim().toUpperCase(),
      type: storeForm.type.trim() || 'CVS',
      city: storeForm.city.trim().toUpperCase(),
      address: storeForm.address.trim(),
      lat: Number(storeForm.lat) || -6.2,
      lng: Number(storeForm.lng) || 106.8,
      email: storeForm.email.trim(),
      storePhone: storeForm.storePhone.trim(),
      storeHead: storeForm.storeHead.trim(),
      areaManager: storeForm.areaManager.trim(),
      areaManagerEmail: storeForm.areaManagerEmail.trim(),
      regionalManager: storeForm.regionalManager.trim(),
      regionalManagerEmail: storeForm.regionalManagerEmail.trim(),
    };

    const existingIdx = currentStores.findIndex(
      (s) => String(s.code).toUpperCase() === codeUpper
    );
    if (existingIdx >= 0) {
      currentStores[existingIdx] = newStoreObj;
    } else {
      currentStores.unshift(newStoreObj);
    }
    saveMasterStores(currentStores);

    const currentOwnerships = getBestieInChargeAssignments().filter(
      (o) => String(o.storeCode).toUpperCase() !== codeUpper
    );
    if (storeForm.ownerBestieName.trim()) {
      currentOwnerships.push({
        bestieName: storeForm.ownerBestieName.trim(),
        storeCode: codeUpper,
        storeName: newStoreObj.name,
        address: newStoreObj.address,
        areaManager: newStoreObj.areaManager,
        regionalManager: newStoreObj.regionalManager,
      });
    }
    saveBestieInChargeAssignments(currentOwnerships);

    setStoresVersion((v) => v + 1);
    setShowStoreModal(false);
    setStoreActionStatus(
      `Data Master Toko ${newStoreObj.name} (${newStoreObj.code}) berhasil disimpan!`
    );
    confetti({ particleCount: 45, spread: 55, origin: { y: 0.6 } });
    setTimeout(() => setStoreActionStatus(null), 4000);
  };

  const handleQuickScheduleStoreVisit = (st: StoreWithOwnership) => {
    if (isReadOnly) return;
    setEditingAgenda(null);
    const defaultPic =
      st.ownerBestieName || users.find((u) => !u.isAdmin)?.name || 'Septiana Indasari';
    setAgendaPic(defaultPic);
    setAgendaCategory('VISIT');
    setAgendaStoreCode(st.code);
    setAgendaTitle(`Audit & Store Visit - Cabang ${st.name}`);
    setAgendaLocation(`${st.name} (${st.code}) - ${st.city}`);
    setAgendaDate(new Date().toISOString().split('T')[0]);
    setAgendaTime('08:30');
    setAgendaEndTime('17:30');
    setAgendaDescription(
      `Visit Store ${st.name} (${st.code}) — Store Head: ${st.storeHead || '-'}, AM: ${st.areaManager || '-'}, RM: ${st.regionalManager || '-'}`
    );
    setAgendaPriority('HIGH');
    setShowAgendaModal(true);
  };

  const handleOpenCreateModal = () => {
    if (isReadOnly) return;
    setEditingAgenda(null);
    setAgendaTitle('');
    setAgendaPic(users.find((u) => !u.isAdmin)?.name || 'Septiana Indasari');
    setAgendaCategory('VISIT');
    setAgendaDate(new Date().toISOString().split('T')[0]);
    setAgendaTime('08:30');
    setAgendaEndTime('17:30');
    setAgendaLocation('');
    setAgendaDescription('');
    setAgendaPriority('NORMAL');
    setAgendaStoreCode('');
    setModalStoreSearch('');
    setShowAgendaModal(true);
  };

  const handleOpenEditModal = (item: ScheduleAgenda) => {
    if (isReadOnly) return;
    setEditingAgenda(item);
    setAgendaTitle(item.title);
    setAgendaPic(item.pic);
    setAgendaCategory(item.category);
    setAgendaDate(item.date);
    setAgendaTime(item.time);
    setAgendaEndTime(item.endTime || '17:30');
    setAgendaLocation(item.location);
    setAgendaDescription(item.description || '');
    setAgendaPriority(item.priority === 'HIGH' ? 'HIGH' : 'NORMAL');
    setAgendaStoreCode(item.storeCode || '');
    setModalStoreSearch('');
    setShowAgendaModal(true);
  };

  const handleSelectStoreInAgendaModal = (storeCode: string) => {
    setAgendaStoreCode(storeCode);
    const found = findMasterStoreByCodeOrName(storeCode);
    if (found) {
      if (agendaCategory === 'VISIT') {
        setAgendaTitle(`Audit & Store Visit - Cabang ${found.name}`);
      } else if (agendaCategory === 'NSO') {
        setAgendaTitle(`NSO ${found.name}`);
      }
      setAgendaLocation(`${found.name} (${found.code}) - ${found.city}`);
      if (!agendaDescription.trim()) {
        setAgendaDescription(
          `Visit Store ${found.name} (${found.code}) — SH: ${found.storeHead || '-'} | AM: ${found.areaManager || '-'}`
        );
      }
    }
  };

  const handleSaveAgenda = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !agendaTitle.trim()) return;

    const matchedStore =
      findMasterStoreByCodeOrName(agendaStoreCode) ||
      findMasterStoreByCodeOrName(agendaLocation) ||
      findMasterStoreByCodeOrName(agendaTitle);

    const storePayload = matchedStore
      ? {
          storeCode: matchedStore.code,
          storeName: matchedStore.name,
          storeType: matchedStore.type,
          storeHead: matchedStore.storeHead,
          areaManager: matchedStore.areaManager,
          regionalManager: matchedStore.regionalManager,
          storeEmail: matchedStore.email,
        }
      : {};

    if (editingAgenda) {
      const updated: ScheduleAgenda = {
        ...editingAgenda,
        ...storePayload,
        title: agendaTitle.trim(),
        pic: agendaPic,
        category: agendaCategory,
        date: agendaDate,
        time: agendaTime,
        endTime: agendaEndTime,
        location: agendaLocation.trim() || 'FMCU Lapangan',
        description: agendaDescription.trim() || 'Agenda operasional FMCU.',
        priority: agendaPriority,
        tags: [agendaCategory, ...(matchedStore ? [matchedStore.code] : []), 'Admin Updated'],
      };
      onUpdateAgenda(updated);
    } else {
      const created: ScheduleAgenda = {
        id: `sch-${Date.now()}`,
        ...storePayload,
        title: agendaTitle.trim(),
        pic: agendaPic,
        category: agendaCategory,
        date: agendaDate,
        time: agendaTime,
        endTime: agendaEndTime,
        location: agendaLocation.trim() || 'FMCU Lapangan',
        description: agendaDescription.trim() || 'Agenda operasional FMCU.',
        priority: agendaPriority,
        tags: [agendaCategory, ...(matchedStore ? [matchedStore.code] : []), 'Admin Created'],
        completed: false,
        createdBy: 'Admin FMCU (Portal)',
      };
      onAddAgenda(created);
    }

    setShowAgendaModal(false);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#76C88D', '#3A657C', '#4ADE80', '#F59E0B'],
    });
  };

  const applyExcelSheetSelection = (wb: XLSX.WorkBook, sheetName: string) => {
    if (isReadOnly) return;
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const summary = parseScheduleExcelSheet(ws, sheetName, users);
    setLastParsedSummary(summary);
    onImportExcel(summary.updatedUsers, summary.agendas);
    setImportStatus(
      `Berhasil menerapkan sheet "${sheetName}": ${summary.stats.totalRows} jadwal (${summary.stats.visitCount} Visit Store, ${summary.stats.nsoCount} NSO) untuk ${summary.stats.matchedUsersCount} personil!`
    );
    confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
  };

  const applyAllExcelSheets = (wb: XLSX.WorkBook) => {
    if (isReadOnly) return;
    let workingUsers = [...users];
    let combinedAgendas: ScheduleAgenda[] = [];
    let totalVisit = 0;
    let totalNso = 0;
    let totalNonStore = 0;
    let totalOff = 0;
    let totalCuti = 0;
    let totalMatchedStores = 0;
    let totalNewUsers = 0;

    wb.SheetNames.forEach((sName) => {
      const ws = wb.Sheets[sName];
      if (!ws) return;
      const summary = parseScheduleExcelSheet(ws, sName, workingUsers);
      workingUsers = summary.updatedUsers;
      combinedAgendas = [...combinedAgendas, ...summary.agendas];
      totalVisit += summary.stats.visitCount;
      totalNso += summary.stats.nsoCount;
      totalNonStore += summary.stats.nonStoreAgendaCount;
      totalOff += summary.stats.offCount;
      totalCuti += summary.stats.cutiCount;
      totalMatchedStores += summary.stats.matchedStoresCount;
      totalNewUsers += summary.newUsersCount;
    });

    setLastParsedSummary({
      sheetName: `Semua Sheet (${wb.SheetNames.join(', ')})`,
      agendas: combinedAgendas,
      updatedUsers: workingUsers,
      newUsersCount: totalNewUsers,
      stats: {
        totalRows: combinedAgendas.length,
        visitCount: totalVisit,
        nsoCount: totalNso,
        nonStoreAgendaCount: totalNonStore,
        offCount: totalOff,
        cutiCount: totalCuti,
        matchedUsersCount: workingUsers.filter((u) => !u.isAdmin).length,
        matchedStoresCount: totalMatchedStores,
      },
    });

    onImportExcel(workingUsers, combinedAgendas, 'replace');
    setImportStatus(
      `Berhasil mengimpor & membagikan online seluruh ${wb.SheetNames.length} sheet (${combinedAgendas.length} total jadwal, ${totalVisit} Visit Store cocok dengan Master Toko) untuk ${workingUsers.filter((u) => !u.isAdmin).length} karyawan!`
    );
    confetti({ particleCount: 85, spread: 70, origin: { y: 0.6 } });
  };

  const processExcelWorkbook = (wb: XLSX.WorkBook, fileName = 'Templete_Jadwal.xlsx') => {
    setUploadedWorkbook(wb);
    setUploadedFileName(fileName);
    const firstSheet = wb.SheetNames[0] || '';
    setSelectedSheetName(firstSheet);
    if (wb.SheetNames.length === 1 && firstSheet) {
      applyExcelSheetSelection(wb, firstSheet);
    } else if (wb.SheetNames.length > 1) {
      applyAllExcelSheets(wb);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        try {
          const wb = XLSX.read(bstr, { type: 'binary' });
          processExcelWorkbook(wb, file.name);
        } catch (err) {
          console.error(err);
          alert('Gagal membaca file Excel. Pastikan format file adalah .xlsx atau .xls.');
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleSyncPreBundledExcel = () => {
    if (isReadOnly) return;
    const seedUsers = excelSeed.users as User[];
    const seedAgendas = excelSeed.agendas as ScheduleAgenda[];
    onImportExcel(seedUsers, seedAgendas, 'replace');
    setImportStatus(
      `Sinkronisasi Online Sukses! ${seedAgendas.length} jadwal dan ${seedUsers.length} karyawan dari 'TEMPLET EXCEL JADWAL.xlsx' berhasil dimuat & dibagikan ke seluruh perangkat.`
    );
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  };

  const handleHoldingFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (parsed && Array.isArray(parsed.categories)) {
            saveHoldingTimeStandards(parsed);
            setHoldingStandards(parsed);
            setHoldingUploadStatus(
              `File Standar Holding Time "${file.name}" berhasil diunggah dan disimpan ke sistem!`
            );
            confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
            return;
          }
        }
        localStorage.setItem('fmcu_r23_uploaded_filename', file.name);
        localStorage.setItem('fmcu_r23_uploaded_date', new Date().toLocaleDateString('id-ID'));
        setHoldingUploadStatus(
          `File dokumen Standar Holding Time "${file.name}" berhasil diunggah (${(file.size / 1024).toFixed(1)} KB) dan aktif sebagai acuan audit FMCU!`
        );
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      } catch (err) {
        console.error('Upload holding file error:', err);
        alert('Gagal memproses file. Pastikan file valid (.pdf atau .json).');
      }
    };

    if (file.name.endsWith('.json')) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  };

  const handleResetHoldingStandards = () => {
    if (isReadOnly) return;
    if (
      confirm(
        'Kembalikan Standar Holding Time ke versi bawaan resmi R23 (23 September 2026)?'
      )
    ) {
      saveHoldingTimeStandards(INITIAL_HOLDING_TIME_R23);
      setHoldingStandards(INITIAL_HOLDING_TIME_R23);
      setHoldingUploadStatus(
        'Standar Holding Time berhasil direset ke versi default STD/FMI/PD-QC/001/R23.'
      );
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
    }
  };

  const filteredAgendas = agendas.filter((item) => {
    const matchSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.pic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.storeCode && item.storeCode.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchCategory =
      selectedCategoryFilter === 'ALL' || item.category === selectedCategoryFilter;
    const matchUser = selectedUserFilter === 'ALL' || item.pic === selectedUserFilter;
    return matchSearch && matchCategory && matchUser;
  });

  // Schedule View Mode ('cards' ala user view vs 'table')
  const [scheduleViewMode, setScheduleViewMode] = useState<'cards' | 'table'>('cards');

  // WhatsApp Broadcast Handlers
  const handleBroadcastAgendaWhatsApp = (agenda: ScheduleAgenda) => {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://fmcu-teams.web.app';
    const storeInfo = agenda.storeCode ? `[${agenda.storeCode}] ${agenda.location}` : agenda.location || '-';
    const msg = [
      `📢 *JADWAL PENUGASAN FMCU*`,
      `👤 *Personel:* ${agenda.pic || '-'}`,
      `📅 *Hari/Tanggal:* ${agenda.date}`,
      `⏰ *Waktu:* ${agenda.time || '08:30'}${agenda.endTime ? ` – ${agenda.endTime}` : ''} WIB`,
      `🏷️ *Kategori:* ${agenda.category}`,
      `🏢 *Toko / Lokasi:* ${storeInfo}`,
      `📝 *Agenda:* ${agenda.title}`,
      agenda.description ? `ℹ️ *Catatan:* ${agenda.description}` : '',
      ``,
      `🔗 *Buka Aplikasi Web FMCU Teams:*`,
      `${appUrl}`,
      ``,
      `_Pesan resmi terkirim otomatis dari Portal Admin & Executive FMCU._`,
    ]
      .filter(Boolean)
      .join('\n');

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleBroadcastFilteredAgendasWhatsApp = () => {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://fmcu-teams.web.app';
    const count = filteredAgendas.length;
    if (count === 0) {
      alert('Tidak ada agenda yang terfilter untuk di-broadcast.');
      return;
    }

    const itemsSummary = filteredAgendas.slice(0, 12).map((a, idx) => {
      const storeStr = a.storeCode ? `[${a.storeCode}]` : '';
      return `${idx + 1}. *${a.pic}* (${a.date} • ${a.time} WIB)\n   ${storeStr} ${a.title} (${a.category})`;
    }).join('\n\n');

    const msg = [
      `📢 *BROADCAST JADWAL FMCU (${count} PENUGASAN)*`,
      selectedUserFilter !== 'ALL' ? `👤 *Filter Personel:* ${selectedUserFilter}` : '',
      selectedCategoryFilter !== 'ALL' ? `🏷️ *Kategori:* ${selectedCategoryFilter}` : '',
      `📅 *Total Agenda Terfilter:* ${count} Kegiatan`,
      ``,
      itemsSummary,
      count > 12 ? `\n...dan ${count - 12} penugasan lainnya.` : '',
      ``,
      `🔗 *Buka Aplikasi Web FMCU Teams:*`,
      `${appUrl}`,
      ``,
      `_Pesan resmi terkirim otomatis dari Portal Admin & Executive FMCU._`,
    ]
      .filter(Boolean)
      .join('\n');

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Top Navigation Items (Matching Lordbank Reference: Dashboard | Calendar | Projects/Stores | Team | Documents)
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'schedules', label: 'Calendar & Jadwal', icon: CalendarIcon },
    { id: 'stores', label: 'Master Toko (610)', icon: Store },
    { id: 'users', label: 'Team (36)', icon: Users },
    { id: 'import-excel', label: 'Documents & Excel', icon: FileSpreadsheet },
    { id: 'holding-time', label: 'Standar R23', icon: Clock },
  ] as const;

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    setSearchQuery(globalSearch.trim());
    setActiveTab('schedules');
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col select-none text-slate-900 font-sans">
      {/* =====================================================================
          1. LORDBANK CORPORATE TOP NAVIGATION BAR
          ===================================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-100 px-4 sm:px-8 pt-[max(0.875rem,env(safe-area-inset-top,14px))] pb-3.5">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
          {/* Left: Clover/Geometric Brand Mark + Pill Navigation */}
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="w-11 h-11 rounded-full bg-[#76C88D] hover:bg-[#66B87D] text-white flex items-center justify-center shadow-xs transition-transform active:scale-95 shrink-0 cursor-pointer"
              title="FMCU Corporate Portal"
            >
              {/* 4-Leaf Clover / Geometric Symbol matching reference */}
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
                <span
                  className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold ${
                    isReadOnly
                      ? 'bg-[#EEF2F6] text-[#3A657C]'
                      : 'bg-[#EBF8F0] text-[#2E8B57]'
                  }`}
                >
                  {isReadOnly ? 'Executive' : 'Admin'}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400 truncate">
                {isReadOnly ? 'Head of Division • Read-Only' : 'Master Control & Scheduler'}
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
                title="Buka Live Maps & Radar (Mode Fullscreen Tersedia)"
              >
                <Compass className="w-4 h-4 text-[#3A657C]" />
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#76C88D]" />
              </button>
            )}

            <button
              type="button"
              onClick={onSwitchToUserView}
              className="w-10 h-10 rounded-full bg-[#F3F5F8] hover:bg-[#EAECEF] text-slate-700 flex items-center justify-center transition active:scale-95 cursor-pointer"
              title="Pratinjau Tampilan Sisi User / Lapangan"
            >
              <Eye className="w-4 h-4 text-slate-700" />
            </button>

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
                {adminUser.name.substring(0, 2)}
              </div>
              <div className="hidden xl:block text-left">
                <span className="block text-xs font-bold text-slate-900 leading-tight">
                  {isReadOnly ? 'Head of Division' : 'Super Admin FMCU'}
                </span>
                <span className="block text-[10px] font-semibold text-slate-400">
                  {isReadOnly ? 'Executive Viewer (Read-Only)' : 'Super Admin (Full Access)'}
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
                    ? 'bg-[#76C88D] text-white shadow-2xs'
                    : 'bg-[#F3F5F8] text-slate-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* =====================================================================
          2. MAIN CORPORATE WORKSPACE CANVAS
          ===================================================================== */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-8 pt-6 pb-12">
        {/* TAB 1: EXECUTIVE & ADMIN DASHBOARD (LORDBANK BENTO DESIGN) */}
        {activeTab === 'dashboard' && (
          <ExecutiveAnalyticsSuite
            currentUser={adminUser}
            isReadOnly={isReadOnly}
            agendas={agendas}
            users={users}
            stores={allStoresWithOwnership}
            bestieCount={bestieAssignments.length}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onOpenCreateAgenda={handleOpenCreateModal}
            onOpenEditAgenda={handleOpenEditModal}
            onDeleteAgenda={onDeleteAgenda}
            onExportExcel={() => exportScheduleToTemplateExcel(agendas, users, 'ALL')}
            onOpenLiveMaps={onOpenLiveMaps}
            onSwitchToUserView={onSwitchToUserView}
            onSelectBestieStores={(bestieName) => {
              setSelectedBestieFilter(bestieName);
              setStoreScopeFilter('OWNED');
              setActiveTab('stores');
            }}
          />
        )}

        {/* TAB 2: MASTER STORES (610) & KEPEMILIKAN BESTIE (531) */}
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

            {storeActionStatus && (
              <div className="p-4 rounded-2xl bg-[#EBF8F0] border border-[#76C88D]/40 text-xs font-bold text-[#2E8B57] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{storeActionStatus}</span>
                </div>
                <button
                  onClick={() => setStoreActionStatus(null)}
                  className="font-bold hover:opacity-75"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Filter & Action Bar */}
            <div className="bg-[#F3F5F8] rounded-[28px] p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-200/70">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStoreScopeFilter('ALL');
                      setStorePage(1);
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      storeScopeFilter === 'ALL'
                        ? 'bg-[#76C88D] text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Semua Master Toko ({allStoresWithOwnership.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStoreScopeFilter('OWNED');
                      setStorePage(1);
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      storeScopeFilter === 'OWNED'
                        ? 'bg-[#3A657C] text-white shadow-2xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>Kepemilikan Bestie ({bestieAssignments.length})</span>
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
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={handleSyncBestieSheet}
                      disabled={isSyncingBestieSheet}
                      className="px-4 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 text-[#3A657C] ${
                          isSyncingBestieSheet ? 'animate-spin' : ''
                        }`}
                      />
                      <span>Sync Sheet Kepemilikan</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={exportMasterStoresToExcel}
                    className="px-4 py-2 rounded-full bg-[#76C88D] hover:bg-[#66B87D] text-white text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export 610 Toko (.xlsx)</span>
                  </button>

                  {!isReadOnly ? (
                    <button
                      type="button"
                      onClick={handleOpenAddStoreModal}
                      className="px-4 py-2 rounded-full bg-[#3A657C] hover:bg-[#2E5266] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Toko</span>
                    </button>
                  ) : (
                    <span className="px-3.5 py-2 rounded-full bg-white text-[#3A657C] text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Read-Only</span>
                    </span>
                  )}
                </div>
              </div>

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
                  className="px-4 py-2 bg-white rounded-full text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="ALL">Semua Regional Manager ({uniqueRmList.length} RM)</option>
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
                  className="px-4 py-2 bg-white rounded-full text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="ALL">Semua Tipe Toko (CVS / FamiSuper / Housing)</option>
                  <option value="CVS">CVS</option>
                  <option value="FamiSuper">FamiSuper</option>
                  <option value="Housing">Housing</option>
                </select>
              </div>
            </div>

            {/* Master Stores Table */}
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500">
                  Menampilkan {paginatedStores.length} dari {filteredStores.length} cabang
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={storePage <= 1}
                    onClick={() => setStorePage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-full bg-[#F3F5F8] hover:bg-slate-200 disabled:opacity-40 text-slate-700 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-700">
                    Hal {Math.min(storePage, totalStorePages)} / {totalStorePages}
                  </span>
                  <button
                    type="button"
                    disabled={storePage >= totalStorePages}
                    onClick={() => setStorePage((p) => Math.min(totalStorePages, p + 1))}
                    className="p-1.5 rounded-full bg-[#F3F5F8] hover:bg-slate-200 disabled:opacity-40 text-slate-700 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto no-scrollbar max-h-[620px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-[#F8FAFC]">
                    <tr className="text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 text-[10.5px]">
                      <th className="py-3.5 px-4">Kode &amp; Tipe</th>
                      <th className="py-3.5 px-4">Nama Cabang &amp; Kota</th>
                      <th className="py-3.5 px-4">★ Kepemilikan Bestie</th>
                      <th className="py-3.5 px-4">Store Head &amp; Kontak</th>
                      <th className="py-3.5 px-4">Area &amp; Regional Manager</th>
                      <th className="py-3.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedStores.map((st) => (
                      <tr key={st.code} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-lg bg-[#3A657C] text-white">
                              {st.code}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F3F5F8] text-slate-600">
                              {st.type || 'CVS'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 max-w-[260px]">
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
                          {!isReadOnly ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleQuickScheduleStoreVisit(st)}
                                className="px-3 py-1.5 rounded-full bg-[#EBF8F0] hover:bg-[#daf2e3] text-[#2E8B57] text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                <CalendarIcon className="w-3 h-3" />
                                <span>Jadwalkan</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditStoreModal(st)}
                                className="p-1.5 rounded-full bg-[#F3F5F8] hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F3F5F8] text-slate-500 text-[10px] font-bold">
                              <Lock className="w-3 h-3" />
                              <span>Read-Only</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CALENDAR & MASTER SCHEDULE MANAGEMENT */}
        {activeTab === 'schedules' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="bg-[#F3F5F8] rounded-[28px] p-5 flex flex-col lg:flex-row items-center justify-between gap-3">
              <div className="relative w-full lg:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari agenda, kode toko, karyawan, lokasi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white rounded-full pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#76C88D]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="px-4 py-2 bg-white rounded-full text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="ALL">Semua Kategori ({agendas.length})</option>
                  <option value="VISIT">
                    Store Visit ({agendas.filter((a) => a.category === 'VISIT').length})
                  </option>
                  <option value="NSO">
                    NSO Opening ({agendas.filter((a) => a.category === 'NSO').length})
                  </option>
                  <option value="TRAINING">
                    Training / SBS ({agendas.filter((a) => a.category === 'TRAINING').length})
                  </option>
                  <option value="MEETING">
                    Meeting ({agendas.filter((a) => a.category === 'MEETING').length})
                  </option>
                  <option value="AUDIT">
                    Audit SOP ({agendas.filter((a) => a.category === 'AUDIT').length})
                  </option>
                  <option value="WORK_PLAN">
                    Work Plan ({agendas.filter((a) => a.category === 'WORK_PLAN').length})
                  </option>
                  <option value="OPERATION">
                    Operation ({agendas.filter((a) => a.category === 'OPERATION').length})
                  </option>
                  <option value="CUTI">
                    Cuti ({agendas.filter((a) => a.category === 'CUTI').length})
                  </option>
                  <option value="OFF">
                    Hari Libur / OFF ({agendas.filter((a) => a.category === 'OFF').length})
                  </option>
                </select>

                <select
                  value={selectedUserFilter}
                  onChange={(e) => setSelectedUserFilter(e.target.value)}
                  className="px-4 py-2 bg-white rounded-full text-xs font-bold text-slate-700 outline-none max-w-[200px] cursor-pointer"
                >
                  <option value="ALL">
                    Semua Karyawan ({users.filter((u) => !u.isAdmin).length})
                  </option>
                  {[...users]
                    .filter((u) => !u.isAdmin)
                    .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }))
                    .map((u) => (
                      <option key={u.id || u.name} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                </select>

                {/* View Switcher: Cards (Ala User) vs Tabel */}
                <div className="flex items-center bg-white rounded-full p-1 border border-slate-200/80 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setScheduleViewMode('cards')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      scheduleViewMode === 'cards'
                        ? 'bg-[#3A657C] text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Cards (Ala User)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleViewMode('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      scheduleViewMode === 'table'
                        ? 'bg-[#3A657C] text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Tabel</span>
                  </button>
                </div>

                {/* Broadcast Filtered Agendas ke WhatsApp Button */}
                <button
                  type="button"
                  onClick={handleBroadcastFilteredAgendasWhatsApp}
                  className="px-4 py-2 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-white text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                  title="Broadcast semua jadwal terfilter ke WhatsApp"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Broadcast WA ({filteredAgendas.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    exportScheduleToTemplateExcel(agendas, users, selectedUserFilter)
                  }
                  className="px-4 py-2 rounded-full bg-[#76C88D] hover:bg-[#66B87D] text-white text-xs font-bold shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    Export Excel{' '}
                    {selectedUserFilter === 'ALL' ? '(Semua)' : `(${selectedUserFilter})`}
                  </span>
                </button>

                {!isReadOnly ? (
                  <button
                    onClick={handleOpenCreateModal}
                    className="px-4 py-2 rounded-full bg-[#3A657C] hover:bg-[#2E5266] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Agenda</span>
                  </button>
                ) : (
                  <span className="px-3.5 py-2 rounded-full bg-white text-[#3A657C] text-xs font-bold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Read-Only</span>
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white rounded-[28px] border border-slate-100 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  Menampilkan {filteredAgendas.length} agenda kerja ({scheduleViewMode === 'cards' ? 'Tampilan Card Ala User' : 'Tampilan Tabel'})
                </span>
                <span className="text-[11px] font-bold text-[#2E8B57] bg-[#EBF8F0] px-3 py-0.5 rounded-full">
                  Terintegrasi 610 Master Toko &amp; Kepemilikan Bestie
                </span>
              </div>

              {scheduleViewMode === 'cards' ? (
                /* =========================================================================
                   TAMPILAN CARD (ALA USER / EXECUTIVE MODERN MINIMALIST)
                   ========================================================================= */
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[640px] overflow-y-auto no-scrollbar">
                  {filteredAgendas.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-400 text-xs font-semibold">
                      Tidak ada agenda yang cocok dengan filter yang dipilih.
                    </div>
                  ) : (
                    filteredAgendas.map((agenda) => {
                      return (
                        <div
                          key={agenda.id}
                          className="p-5 rounded-[24px] bg-[#F8FAFC] border border-slate-200/70 hover:border-teal-200 hover:bg-white hover:shadow-soft-card transition-all flex flex-col justify-between"
                        >
                          <div>
                            {/* Card Top: Category Chip & Time */}
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <span
                                className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider ${
                                  agenda.category === 'VISIT'
                                    ? 'bg-[#EBF8F0] text-[#2E8B57] border border-[#2E8B57]/20'
                                    : agenda.category === 'NSO'
                                    ? 'bg-[#EBF2F6] text-[#3A657C] border border-[#3A657C]/20'
                                    : agenda.category === 'OFF'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : agenda.category === 'CUTI'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {agenda.category}
                              </span>

                              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-white px-2.5 py-0.5 rounded-full border border-slate-200/80 shadow-2xs">
                                <Clock className="w-3 h-3 text-teal-600" />
                                <span>{agenda.time}{agenda.endTime ? `–${agenda.endTime}` : ''} WIB</span>
                              </div>
                            </div>

                            {/* Card Title */}
                            <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                              {agenda.title}
                            </h4>

                            {/* Store & Location Badge */}
                            <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                              <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                              <span className="truncate">
                                {agenda.storeCode && (
                                  <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-[#3A657C] text-white mr-1.5">
                                    #{agenda.storeCode}
                                  </span>
                                )}
                                <span>{agenda.location}</span>
                              </span>
                            </div>

                            {/* PIC Personnel with Clean Initials */}
                            <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#3A657C] to-[#2E8B57] text-white text-[10px] font-black flex items-center justify-center shrink-0 uppercase shadow-2xs">
                                  {agenda.pic.substring(0, 2)}
                                </div>
                                <div className="min-w-0">
                                  <span className="block text-xs font-bold text-slate-800 truncate">
                                    {agenda.pic}
                                  </span>
                                  <span className="block text-[10px] text-slate-400 font-medium">
                                    {agenda.date}
                                  </span>
                                </div>
                              </div>

                              {/* Status indicator */}
                              <span
                                className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                                  agenda.completed
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-200/70 text-slate-600'
                                }`}
                              >
                                {agenda.completed ? 'Selesai' : 'Terjadwal'}
                              </span>
                            </div>
                          </div>

                          {/* Card Actions: WhatsApp Broadcast + Edit + Delete */}
                          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handleBroadcastAgendaWhatsApp(agenda)}
                              className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-bold text-xs flex items-center justify-center gap-1.5 border border-[#25D366]/30 transition active:scale-95 cursor-pointer"
                              title="Kirim Penugasan ke WhatsApp Personel"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Broadcast WA</span>
                            </button>

                            {!isReadOnly ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(agenda)}
                                  className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition active:scale-95 cursor-pointer"
                                  title="Edit Agenda"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteAgenda(agenda.id)}
                                  className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition active:scale-95 cursor-pointer"
                                  title="Hapus Agenda"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                                <Lock className="w-3 h-3" />
                                <span>Read-Only</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* =========================================================================
                   TAMPILAN TABEL RINGKAS (POWER USER & SPREADSHEET SCANNING)
                   ========================================================================= */
                <div className="overflow-x-auto no-scrollbar max-h-[620px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-[#F8FAFC]">
                      <tr className="text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 text-[10.5px]">
                        <th className="py-3.5 px-4">Karyawan (PIC)</th>
                        <th className="py-3.5 px-4">Judul Agenda</th>
                        <th className="py-3.5 px-4">Kategori</th>
                        <th className="py-3.5 px-4">Tanggal &amp; Waktu</th>
                        <th className="py-3.5 px-4">Lokasi / Master Toko</th>
                        <th className="py-3.5 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredAgendas.map((agenda) => (
                        <tr key={agenda.id} className="hover:bg-[#F8FAFC] transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#3A657C] to-[#2E8B57] text-white text-[10px] font-black flex items-center justify-center shrink-0 uppercase shadow-2xs">
                              {agenda.pic.substring(0, 2)}
                            </div>
                            <span className="truncate max-w-[155px]">{agenda.pic}</span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800 max-w-xs break-words">
                            {agenda.title}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full ${
                                agenda.category === 'VISIT'
                                  ? 'bg-[#EBF8F0] text-[#2E8B57]'
                                  : agenda.category === 'NSO'
                                  ? 'bg-[#EBF2F6] text-[#3A657C]'
                                  : 'bg-[#F3F5F8] text-slate-600'
                              }`}
                            >
                              {agenda.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-600">
                            {agenda.date} • {agenda.time}
                            {agenda.endTime ? `–${agenda.endTime}` : ''} WIB
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 max-w-[230px]">
                            <div className="truncate">
                              {agenda.storeCode && (
                                <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-[#3A657C] text-white mr-1.5">
                                  {agenda.storeCode}
                                </span>
                              )}
                              <span>{agenda.location}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleBroadcastAgendaWhatsApp(agenda)}
                                className="p-2 rounded-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] transition cursor-pointer"
                                title="Broadcast WhatsApp"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                              {!isReadOnly ? (
                                <>
                                  <button
                                    onClick={() => handleOpenEditModal(agenda)}
                                    className="p-2 rounded-full bg-[#F3F5F8] hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                    title="Edit Agenda"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => onDeleteAgenda(agenda.id)}
                                    className="p-2 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                                    title="Hapus Agenda"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F3F5F8] text-slate-500 text-[10px] font-bold">
                                  <Lock className="w-3 h-3" />
                                  <span>Read-Only</span>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: DOCUMENTS & EXCEL SCHEDULE SYNC */}
        {activeTab === 'import-excel' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-[#F3F5F8] rounded-[32px] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#76C88D] text-white flex items-center justify-center shadow-2xs">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 block">
                      Standar Dokumen Jadwal FMCU
                    </span>
                    <h2 className="text-xl font-bold text-slate-900">
                      Impor &amp; Export Template Excel (7 Kolom Resmi)
                    </h2>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => exportScheduleToTemplateExcel(agendas, users, 'ALL')}
                    className="px-5 py-2.5 rounded-full bg-[#76C88D] hover:bg-[#66B87D] text-white text-xs font-bold shadow-2xs transition flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Jadwal ke Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={exportMasterStoresToExcel}
                    className="px-5 py-2.5 rounded-full bg-[#3A657C] hover:bg-[#2E5266] text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                  >
                    <Store className="w-4 h-4" />
                    <span>Export 610 Master Toko (.xlsx)</span>
                  </button>
                </div>
              </div>

              {importStatus && (
                <div className="p-4 rounded-2xl bg-[#EBF8F0] border border-[#76C88D]/40 text-xs font-bold text-[#2E8B57] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{importStatus}</span>
                  </div>
                  <button onClick={() => setImportStatus(null)} className="font-bold">
                    ✕
                  </button>
                </div>
              )}

              {!isReadOnly ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        const bstr = evt.target?.result;
                        try {
                          const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                          processExcelWorkbook(wb, file.name);
                        } catch {
                          alert('Gagal membaca file Excel.');
                        }
                      };
                      reader.readAsBinaryString(file);
                    }
                  }}
                  className={`border-2 border-dashed rounded-[28px] p-10 text-center transition-all cursor-pointer bg-white ${
                    isDragging ? 'border-[#76C88D] bg-[#EBF8F0]/40' : 'border-slate-300 hover:border-[#3A657C]'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-14 h-14 rounded-full bg-[#F3F5F8] text-[#3A657C] flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    Tarik &amp; Letakkan File "Templete Jadwal.xlsx" atau Klik untuk Memilih
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Mendukung pencocokan otomatis 610 Master Toko, multi-poin (1. 2.), multi-toko (&amp;), dan Auto-OFF.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="p-6 rounded-[24px] bg-white flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-full bg-[#EEF2F6] text-[#3A657C] flex items-center justify-center shrink-0">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Mode Executive Viewer (Head of Division • Read-Only)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Anda dapat mengunduh laporan jadwal resmi (.xlsx) dan 610 Master Toko di atas. Fitur unggah jadwal dikhususkan bagi Akun Super Admin FMCU.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!isReadOnly && (
                <div className="pt-4 border-t border-slate-200/70 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Sinkronisasi Template Bawaan (Default Seed)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Muat ulang 582 jadwal resmi &amp; 36 akun personel dari TEMPLET EXCEL JADWAL.xlsx
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncPreBundledExcel}
                    className="px-5 py-2.5 rounded-full bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold shadow-2xs transition flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 text-[#3A657C]" />
                    <span>Sinkronisasi Ulang Template Bawaan</span>
                  </button>
                </div>
              )}
            </div>
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
                    className="px-5 py-2.5 rounded-full bg-[#3A657C] hover:bg-[#2E5266] text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Pratinjau Standar R23</span>
                  </button>

                  {!isReadOnly && (
                    <>
                      <button
                        type="button"
                        onClick={() => holdingFileInputRef.current?.click()}
                        className="px-5 py-2.5 rounded-full bg-[#76C88D] hover:bg-[#66B87D] text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Unggah Pembaruan (.pdf / .json)</span>
                      </button>
                      <input
                        ref={holdingFileInputRef}
                        type="file"
                        accept=".pdf,.json,.xlsx"
                        className="hidden"
                        onChange={handleHoldingFileUpload}
                      />
                    </>
                  )}
                </div>
              </div>

              {holdingUploadStatus && (
                <div className="p-4 rounded-2xl bg-[#EBF8F0] text-xs font-bold text-[#2E8B57] flex items-center justify-between">
                  <span>{holdingUploadStatus}</span>
                  <button onClick={() => setHoldingUploadStatus(null)}>✕</button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white">
                  <span className="text-xs text-slate-400 block">Total Kategori</span>
                  <span className="text-2xl font-bold text-slate-900 mt-1 block">
                    {holdingStandards.categories.length} Kategori
                  </span>
                </div>
                <div className="p-5 rounded-2xl bg-white">
                  <span className="text-xs text-slate-400 block">Total Produk</span>
                  <span className="text-2xl font-bold text-slate-900 mt-1 block">
                    {holdingStandards.categories.reduce((a, c) => a + c.items.length, 0)} Produk
                  </span>
                </div>
                <div className="p-5 rounded-2xl bg-white">
                  <span className="text-xs text-slate-400 block">Divisi Pengesah</span>
                  <span className="text-sm font-bold text-slate-900 mt-1.5 block truncate">
                    {holdingStandards.department}
                  </span>
                </div>
                <div className="p-5 rounded-2xl bg-white">
                  <span className="text-xs text-slate-400 block">Aturan Food Safety</span>
                  <span className="text-2xl font-bold text-slate-900 mt-1 block">
                    {holdingStandards.generalRules.length} Ketentuan
                  </span>
                </div>
              </div>

              {!isReadOnly && (
                <div className="pt-4 border-t border-slate-200/70 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Kembalikan dataset ke versi original STD/FMI/PD-QC/001/R23
                  </span>
                  <button
                    type="button"
                    onClick={handleResetHoldingStandards}
                    className="px-4 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset Default R23</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: TEAM (36 PERSONNEL) */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-[#F3F5F8] rounded-[32px] p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <span className="text-xs font-medium text-slate-500 block">
                    Direktori Personel &amp; Kepemilikan Cabang
                  </span>
                  <h2 className="text-xl font-bold text-slate-900">
                    Tim Lapangan FMCU ({users.filter((u) => !u.isAdmin).length} Personel)
                  </h2>
                </div>
                <span className="px-4 py-1.5 rounded-full bg-white text-xs font-bold text-slate-700 shadow-2xs">
                  Terhubung 531 Toko Kepemilikan Bestie
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...users]
                  .filter((u) => !u.isAdmin)
                  .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }))
                  .map((u, idx) => {
                    const userAgendasCount = agendas.filter((a) => a.pic === u.name).length;
                    const ownedCount = getStoresWithOwnership(u.name).filter(
                      (s) => s.isOwnedByBestie
                    ).length;
                    const todayAgenda = agendas.find(
                      (a) =>
                        isSamePersonName(a.pic, u.name) &&
                        a.date === new Date().toISOString().split('T')[0]
                    );
                    const isVisitToday = Boolean(todayAgenda && todayAgenda.category === 'VISIT');
                    const hasActualAttendance = Boolean(
                      todayAgenda?.completed || todayAgenda?.actualIn
                    );
                    const distanceM = hasActualAttendance
                      ? Math.round(18 + (idx % 6) * 5)
                      : isVisitToday
                      ? Math.round(35 + (idx % 8) * 8)
                      : Math.round(180 + (idx % 7) * 95);
                    const isInsideRadius = distanceM <= 50;

                    return (
                      <div
                        key={u.id || idx}
                        className="p-4 bg-white rounded-[24px] flex items-start gap-3.5 hover:shadow-xs transition-all border border-slate-100"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#3A657C] to-[#2E8B57] text-white font-black text-sm flex items-center justify-center shrink-0 uppercase shadow-2xs">
                          {u.name.substring(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{u.name}</h4>
                          <p className="text-[11px] text-slate-400 truncate">{u.email}</p>

                          {/* Live Actual Location Status */}
                          <div className="mt-2 flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold ${
                                  isInsideRadius
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : todayAgenda
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isInsideRadius
                                      ? 'bg-emerald-500 animate-pulse'
                                      : todayAgenda
                                      ? 'bg-blue-500'
                                      : 'bg-slate-400'
                                  }`}
                                />
                                <span>
                                  {isInsideRadius
                                    ? `Di Toko (${distanceM}m)`
                                    : todayAgenda
                                    ? `Dalam Rute (${distanceM}m)`
                                    : 'Standby / Off'}
                                </span>
                              </span>

                              {todayAgenda?.storeCode && (
                                <span className="text-[10px] font-mono font-bold text-slate-600 truncate max-w-[130px]">
                                  #{todayAgenda.storeCode}
                                </span>
                              )}
                            </div>

                            <span className="text-[9px] font-mono text-slate-400">
                              GPS: -6.2{((idx * 7) % 9) + 1}4, 106.8{((idx * 5) % 9) + 1}2 • Live
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUserFilter(u.name);
                                setActiveTab('schedules');
                              }}
                              className="text-[10.5px] font-bold text-[#3A657C] bg-[#EBF2F6] px-2.5 py-0.5 rounded-full cursor-pointer hover:brightness-95 transition"
                            >
                              {userAgendasCount} Jadwal
                            </button>
                            {ownedCount > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBestieFilter(u.name);
                                  setStoreScopeFilter('OWNED');
                                  setActiveTab('stores');
                                }}
                                className="text-[10.5px] font-bold text-[#2E8B57] bg-[#EBF8F0] px-2.5 py-0.5 rounded-full flex items-center gap-1 cursor-pointer hover:brightness-95 transition"
                              >
                                <Star className="w-2.5 h-2.5 fill-current" />
                                <span>{ownedCount} Toko</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: CATEGORIES */}
        {activeTab === 'categories' && (
          <div className="bg-[#F3F5F8] rounded-[32px] p-6 sm:p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Master Kategori Agenda FMCU
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoriesList.map((cat) => (
                <div
                  key={cat.id}
                  className="p-4 rounded-2xl bg-white flex items-start gap-3"
                >
                  <div
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs ${cat.bg} ${cat.text} shrink-0`}
                  >
                    {cat.id}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{cat.label}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{cat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DeveloperFooter className="pt-8 pb-4 text-center" />
      </main>

      {/* =====================================================================
          MODAL 1: BUAT / EDIT AGENDA KERJA (ADMIN ONLY)
          ===================================================================== */}
      {showAgendaModal && !isReadOnly && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white rounded-[32px] shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#EBF8F0] text-[#2E8B57] flex items-center justify-center">
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingAgenda ? 'Edit Agenda Kerja' : 'Buat Agenda Kerja Baru'}
                </h3>
              </div>
              <button
                onClick={() => setShowAgendaModal(false)}
                className="w-8 h-8 rounded-full bg-[#F3F5F8] hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAgenda} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Karyawan (PIC) *
                  </label>
                  <select
                    value={agendaPic}
                    onChange={(e) => setAgendaPic(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F3F5F8] rounded-2xl text-xs font-bold text-slate-800 outline-none"
                  >
                    {[...users]
                      .filter((u) => !u.isAdmin)
                      .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }))
                      .map((u) => (
                        <option key={u.id || u.name} value={u.name}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Kategori Agenda *
                  </label>
                  <select
                    value={agendaCategory}
                    onChange={(e) => setAgendaCategory(e.target.value as ScheduleCategory)}
                    className="w-full px-3.5 py-2.5 bg-[#F3F5F8] rounded-2xl text-xs font-bold text-slate-800 outline-none"
                  >
                    {categoriesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} - {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {(agendaCategory === 'VISIT' || agendaCategory === 'NSO') && (
                <div className="p-4 rounded-2xl bg-[#F3F5F8] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-[11px] font-bold text-slate-800 uppercase flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-[#3A657C]" />
                      <span>Pilih Cabang Toko FamilyMart</span>
                    </label>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setModalStoreScope('ALL')}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                          modalStoreScope === 'ALL'
                            ? 'bg-[#3A657C] text-white'
                            : 'bg-white text-slate-600'
                        }`}
                      >
                        Semua ({allStoresWithOwnership.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalStoreScope('OWNED')}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                          modalStoreScope === 'OWNED'
                            ? 'bg-[#76C88D] text-white'
                            : 'bg-white text-slate-700'
                        }`}
                      >
                        <Star className="w-2.5 h-2.5 fill-current" />
                        <span>Milik {agendaPic.split(' ')[0]} ({ownedByCurrentPicCount})</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Ketik kode / nama toko..."
                      value={modalStoreSearch}
                      onChange={(e) => setModalStoreSearch(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white rounded-xl text-xs font-semibold text-slate-800 outline-none"
                    />
                    <select
                      value={agendaStoreCode}
                      onChange={(e) => handleSelectStoreInAgendaModal(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white rounded-xl text-xs font-bold text-slate-800 outline-none"
                    >
                      <option value="">
                        -- Pilih dari {modalPickableStores.length} Toko --
                      </option>
                      {modalPickableStores.map((st) => (
                        <option key={st.code} value={st.code}>
                          {st.isOwnedByBestie ? '★ ' : ''}
                          {st.code} - {st.name} ({st.city})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Judul Agenda *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Audit & Store Visit - Cabang BDG DAGO"
                  value={agendaTitle}
                  onChange={(e) => setAgendaTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F3F5F8] rounded-2xl text-xs font-bold text-slate-800 outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    value={agendaDate}
                    onChange={(e) => setAgendaDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F3F5F8] rounded-2xl text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    required
                    value={agendaTime}
                    onChange={(e) => setAgendaTime(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F3F5F8] rounded-2xl text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    required
                    value={agendaEndTime}
                    onChange={(e) => setAgendaEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F3F5F8] rounded-2xl text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Lokasi Toko / Tempat
                </label>
                <input
                  type="text"
                  placeholder="Contoh: BDG DAGO (3013) - BANDUNG"
                  value={agendaLocation}
                  onChange={(e) => setAgendaLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F3F5F8] rounded-2xl text-xs font-semibold text-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Catatan / Instruksi
                </label>
                <textarea
                  rows={2}
                  value={agendaDescription}
                  onChange={(e) => setAgendaDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#F3F5F8] rounded-2xl text-xs font-medium text-slate-800 outline-none resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-full bg-[#76C88D] hover:bg-[#66B87D] text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  {editingAgenda ? 'Simpan Perubahan Agenda' : 'Terbitkan Agenda ke Sisi User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: TAMBAH / EDIT MASTER TOKO (ADMIN ONLY)
          ===================================================================== */}
      {showStoreModal && !isReadOnly && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#EBF2F6] text-[#3A657C] flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingStore
                    ? `Edit Master Toko ${editingStore.name} (${editingStore.code})`
                    : 'Tambah Master Toko FamilyMart Baru'}
                </h3>
              </div>
              <button
                onClick={() => setShowStoreModal(false)}
                className="w-8 h-8 rounded-full bg-[#F3F5F8] hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStoreModal} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Kode Toko *
                  </label>
                  <input
                    type="text"
                    required
                    value={storeForm.code}
                    onChange={(e) => setStoreForm({ ...storeForm, code: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F3F5F8] rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Nama Toko *
                  </label>
                  <input
                    type="text"
                    required
                    value={storeForm.name}
                    onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F3F5F8] rounded-xl text-xs font-bold text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Tipe Toko *
                  </label>
                  <select
                    value={storeForm.type}
                    onChange={(e) => setStoreForm({ ...storeForm, type: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F3F5F8] rounded-xl text-xs font-bold text-slate-900 outline-none"
                  >
                    <option value="CVS">CVS</option>
                    <option value="FamiSuper">FamiSuper</option>
                    <option value="Housing">Housing</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#2E8B57] uppercase mb-1">
                    ★ Bestie In Charge (Kepemilikan Toko)
                  </label>
                  <input
                    type="text"
                    list="bestie-owners-datalist"
                    value={storeForm.ownerBestieName}
                    onChange={(e) =>
                      setStoreForm({ ...storeForm, ownerBestieName: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-[#EBF8F0] rounded-xl text-xs font-bold text-slate-900 outline-none"
                  />
                  <datalist id="bestie-owners-datalist">
                    {bestieOwnerStats.map((b) => (
                      <option key={b.name} value={b.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Kota / Wilayah
                  </label>
                  <input
                    type="text"
                    value={storeForm.city}
                    onChange={(e) => setStoreForm({ ...storeForm, city: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F3F5F8] rounded-xl text-xs font-bold text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Store Head (SH)
                  </label>
                  <input
                    type="text"
                    value={storeForm.storeHead}
                    onChange={(e) => setStoreForm({ ...storeForm, storeHead: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F3F5F8] rounded-xl text-xs font-semibold text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Area Manager (AM)
                  </label>
                  <input
                    type="text"
                    value={storeForm.areaManager}
                    onChange={(e) => setStoreForm({ ...storeForm, areaManager: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F3F5F8] rounded-xl text-xs font-semibold text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Regional Manager (RM)
                  </label>
                  <input
                    type="text"
                    value={storeForm.regionalManager}
                    onChange={(e) =>
                      setStoreForm({ ...storeForm, regionalManager: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-[#F3F5F8] rounded-xl text-xs font-semibold text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Email Toko
                  </label>
                  <input
                    type="email"
                    value={storeForm.email}
                    onChange={(e) => setStoreForm({ ...storeForm, email: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F3F5F8] rounded-xl text-xs font-medium text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Latitude GPS
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={storeForm.lat}
                    onChange={(e) =>
                      setStoreForm({ ...storeForm, lat: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3.5 py-2 bg-[#F3F5F8] rounded-xl text-xs font-mono text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Longitude GPS
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={storeForm.lng}
                    onChange={(e) =>
                      setStoreForm({ ...storeForm, lng: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3.5 py-2 bg-[#F3F5F8] rounded-xl text-xs font-mono text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Alamat Lengkap Toko
                </label>
                <textarea
                  rows={2}
                  value={storeForm.address}
                  onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                  className="w-full px-3.5 py-2 bg-[#F3F5F8] rounded-xl text-xs font-medium text-slate-900 outline-none resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-full bg-[#76C88D] hover:bg-[#66B87D] text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Master Data Toko &amp; Kepemilikan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Preview Standar Holding Time R23 */}
      <HoldingTimeR23Modal
        isOpen={showR23PreviewModal}
        onClose={() => setShowR23PreviewModal(false)}
      />
    </div>
  );
};
