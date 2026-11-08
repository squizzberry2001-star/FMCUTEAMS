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
  ArrowRight,
  Clock,
  MapPin,
  Store,
  GraduationCap,
  RefreshCw,
  X,
  Star,
  ChevronLeft,
  ChevronRight,
  Info,
  Building2,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';
import { ScheduleAgenda, ScheduleCategory, User } from '../../types';
import excelSeed from '../../data/excelScheduleSeed.json';
import { DeveloperFooter } from '../DeveloperFooter';
import { HoldingTimeR23Modal } from '../visit/HoldingTimeR23Modal';
import {
  HoldingTimeStandards,
  getActiveHoldingTimeStandards,
  saveHoldingTimeStandards,
  INITIAL_HOLDING_TIME_R23
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
  findMasterStoreByCodeOrName
} from '../../data/masterStoresData';
import {
  ParsedExcelScheduleSummary,
  parseScheduleExcelSheet,
  exportScheduleToTemplateExcel,
  exportMasterStoresToExcel
} from '../../services/scheduleExcelService';

interface AdminPortalProps {
  adminUser: User;
  agendas: ScheduleAgenda[];
  users: User[];
  onAddAgenda: (newAgenda: ScheduleAgenda) => void;
  onUpdateAgenda: (updated: ScheduleAgenda) => void;
  onDeleteAgenda: (id: string) => void;
  onImportExcel: (importedUsers: User[], importedAgendas: ScheduleAgenda[]) => void;
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
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'stores'
    | 'schedules'
    | 'import-excel'
    | 'users'
    | 'categories'
    | 'holding-time'
  >('dashboard');

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
  const [agendaPic, setAgendaPic] = useState(users[1]?.name || 'Septiana Indasari');
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
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
    },
    {
      id: 'NSO',
      label: 'NSO Opening',
      desc: 'New Store Opening & Re-Opening (Otomatis jika Col F/G mengandung NSO)',
      bg: 'bg-pink-50',
      text: 'text-pink-700',
    },
    {
      id: 'TRAINING',
      label: 'Training / SBS',
      desc: 'Pelatihan modul, SBS, Basic Training, Refreshment non-store (Lokasi FMCU)',
      bg: 'bg-purple-50',
      text: 'text-purple-700',
    },
    {
      id: 'MEETING',
      label: 'Meeting / Koordinasi',
      desc: 'Rapat operasional, town hall, briefing, koordinasi tim',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
    },
    {
      id: 'AUDIT',
      label: 'Audit SOP / Assessment',
      desc: 'Audit kepatuhan, kalibrasi, uji kompetensi',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
    },
    {
      id: 'WORK_PLAN',
      label: 'Weekly Work Plan',
      desc: 'Perencanaan kerja mingguan, penyusunan modul & evaluasi',
      bg: 'bg-teal-50',
      text: 'text-teal-700',
    },
    {
      id: 'OPERATION',
      label: 'Operations Duty',
      desc: 'Aktivitas operasional rutin FMCU',
      bg: 'bg-slate-50',
      text: 'text-slate-700',
    },
    {
      id: 'CUTI',
      label: 'Cuti Resmi',
      desc: 'Izin cuti resmi karyawan (Col F: Cuti)',
      bg: 'bg-rose-50',
      text: 'text-rose-700',
    },
    {
      id: 'OFF',
      label: 'Hari Libur / OFF',
      desc: 'Libur mingguan / Ganti Off / Auto-Off hari kosong dalam minggu jadwal',
      bg: 'bg-slate-100',
      text: 'text-slate-600',
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

  // Stores filtered for the Create/Edit Agenda Modal
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
  // HANDLERS FOR MASTER STORES & BESTIE OWNERSHIP
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
    if (!storeForm.code.trim() || !storeForm.name.trim()) return;

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

    // Update Bestie Ownership mapping
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

  // ============================================================================
  // AGENDA CREATE / EDIT HANDLERS
  // ============================================================================
  const handleOpenCreateModal = () => {
    setEditingAgenda(null);
    setAgendaTitle('');
    setAgendaPic(users[1]?.name || 'Septiana Indasari');
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
    if (!agendaTitle.trim()) return;

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
      colors: ['#00A389', '#38BDF8', '#4ADE80', '#F59E0B'],
    });
  };

  // ============================================================================
  // CORPORATE EXCEL IMPORT & EXPORT HANDLERS
  // ============================================================================
  const applyExcelSheetSelection = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const summary = parseScheduleExcelSheet(ws, sheetName, users);
    setLastParsedSummary(summary);
    onImportExcel(summary.updatedUsers, summary.agendas);
    setImportStatus(
      `Berhasil menerapkan sheet "${sheetName}": ${summary.stats.totalRows} jadwal (${summary.stats.visitCount} Visit Store, ${summary.stats.nsoCount} NSO, ${summary.stats.nonStoreAgendaCount} Agenda Non-Store, ${summary.stats.offCount} Off, ${summary.stats.cutiCount} Cuti) untuk ${summary.stats.matchedUsersCount} personil!`
    );
    confetti({
      particleCount: 75,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00A389', '#38BDF8', '#4ADE80', '#F59E0B'],
    });
  };

  const applyAllExcelSheets = (wb: XLSX.WorkBook) => {
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

    onImportExcel(workingUsers, combinedAgendas);
    setImportStatus(
      `Berhasil mengimpor seluruh ${wb.SheetNames.length} sheet (${combinedAgendas.length} total jadwal, ${totalVisit} Visit Store cocok dengan Master Toko) untuk ${workingUsers.filter((u) => !u.isAdmin).length} karyawan!`
    );
    confetti({
      particleCount: 85,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00A389', '#38BDF8', '#4ADE80', '#F59E0B'],
    });
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
          const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
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
    const seedUsers = excelSeed.users as User[];
    const seedAgendas = excelSeed.agendas as ScheduleAgenda[];
    onImportExcel(seedUsers, seedAgendas);
    setImportStatus(
      `Sinkronisasi Sukses! ${seedAgendas.length} jadwal dan ${seedUsers.length} karyawan dari 'TEMPLET EXCEL JADWAL.xlsx' berhasil dimuat ke database.`
    );
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00A389', '#38BDF8', '#4ADE80', '#F59E0B'],
    });
  };

  // Holding Time (R23) Upload & Reset Handlers
  const handleHoldingFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // Filtered Agendas
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

  return (
    <div className="min-h-screen bg-[#F4F6FB] flex flex-col select-none text-slate-800">
      {/* 1. Master Top Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 pt-[max(0.875rem,env(safe-area-inset-top,14px))] pb-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00A389] to-[#00705E] flex items-center justify-center text-white shadow-pill-teal font-black text-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-900 tracking-tight">
                FMCU TEAMS
              </span>
              <span className="text-[10px] font-extrabold text-[#00A389] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 uppercase">
                Admin Control Hub
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Master Data 610 Toko • 531 Kepemilikan Bestie • Aturan Excel Jadwal
            </p>
          </div>
        </div>

        {/* Right Admin Profile & Switch View */}
        <div className="flex items-center gap-3">
          {onReplaySplash && (
            <button
              onClick={onReplaySplash}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all active:scale-95"
              title="Putar ulang animasi splash FMCU TEAMS"
            >
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>Animasi Splash</span>
            </button>
          )}

          {onOpenLiveMaps && (
            <button
              onClick={onOpenLiveMaps}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#00A389] to-[#007F6B] hover:from-[#008F78] hover:to-[#006B5A] text-white text-xs font-extrabold transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Buka Live Maps Admin (Pinpoint User, Pinpoint Toko, Radius & Rute)"
            >
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Live Maps & Radar</span>
              <span className="sm:hidden">Maps</span>
            </button>
          )}

          <button
            onClick={onSwitchToUserView}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all active:scale-95"
            title="Pratinjau tampilan sisi user / karyawan"
          >
            <Eye className="w-4 h-4 text-teal-600" />
            <span className="hidden sm:inline">Lihat Tampilan Sisi User</span>
            <span className="sm:hidden">Sisi User</span>
          </button>

          <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
            <img
              src={
                adminUser.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
              }
              alt={adminUser.name}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-teal-200"
            />
            <div className="hidden md:block text-left">
              <span className="block text-xs font-extrabold text-slate-900 leading-tight">
                {adminUser.name}
              </span>
              <span className="block text-[10px] text-teal-700 font-bold leading-tight">
                Super Admin
              </span>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Keluar dari Portal Admin"
            className="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Admin Navigation Sub-Header */}
      <nav className="bg-white border-b border-slate-200/80 px-6 py-2.5 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {[
              { id: 'dashboard', label: 'Ringkasan & Analitik', icon: LayoutDashboard },
              {
                id: 'stores',
                label: `Master Toko (${allStoresWithOwnership.length})`,
                icon: Store,
                badge: `${bestieAssignments.length} Kepemilikan`,
              },
              { id: 'schedules', label: `Kelola Jadwal (${agendas.length})`, icon: CalendarIcon },
              {
                id: 'import-excel',
                label: 'Baca & Export Excel',
                icon: FileSpreadsheet,
                badge: '7 Kolom Resmi',
              },
              {
                id: 'holding-time',
                label: 'Standar Holding Time (R23)',
                icon: Clock,
                badge: 'R23 QC',
              },
              {
                id: 'users',
                label: `Akun Karyawan (${users.filter((u) => !u.isAdmin).length})`,
                icon: Users,
              },
              { id: 'categories', label: 'Kategori Agenda', icon: Tag },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#00A389] to-[#00826D] text-white shadow-pill-teal scale-102'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                        isActive ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Create Agenda Button */}
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-slate-900 text-white text-xs font-extrabold shadow-sm hover:bg-slate-800 transition-all flex-shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-teal-400 stroke-[3]" />
            <span>+ Buat Agenda Baru</span>
          </button>
        </div>
      </nav>

      {/* 3. Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* =====================================================================
            TAB 1: DASHBOARD & ANALYTICS
            ===================================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Master Toko & Kepemilikan */}
              <div
                onClick={() => setActiveTab('stores')}
                className="bg-white rounded-3xl p-5 shadow-soft-card border border-slate-200/80 flex items-center justify-between cursor-pointer hover:border-teal-300 transition-all"
              >
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Master Data Toko FMI
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">
                    {allStoresWithOwnership.length} Cabang
                  </h3>
                  <span className="text-xs font-bold text-amber-600 mt-1 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    <span>{bestieAssignments.length} Toko Kepemilikan Bestie</span>
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Store className="w-6 h-6" />
                </div>
              </div>

              {/* Card 2: Total Karyawan */}
              <div
                onClick={() => setActiveTab('users')}
                className="bg-white rounded-3xl p-5 shadow-soft-card border border-slate-200/80 flex items-center justify-between cursor-pointer hover:border-teal-300 transition-all"
              >
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Total Karyawan Terdaftar
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">
                    {users.filter((u) => !u.isAdmin).length} Pegawai
                  </h3>
                  <span className="text-xs font-semibold text-emerald-600 mt-1 block">
                    Password Default: 0000
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              {/* Card 3: Total Agenda */}
              <div
                onClick={() => setActiveTab('schedules')}
                className="bg-white rounded-3xl p-5 shadow-soft-card border border-slate-200/80 flex items-center justify-between cursor-pointer hover:border-teal-300 transition-all"
              >
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Total Seluruh Agenda
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">
                    {agendas.length} Jadwal
                  </h3>
                  <span className="text-xs font-semibold text-teal-600 mt-1 block">
                    {agendas.filter((a) => a.category === 'VISIT').length} Jadwal Visit Store
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <CalendarIcon className="w-6 h-6" />
                </div>
              </div>

              {/* Card 4: Kategori Training & Meeting */}
              <div className="bg-white rounded-3xl p-5 shadow-soft-card border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Training, NSO & Meeting
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">
                    {
                      agendas.filter(
                        (a) =>
                          a.category === 'TRAINING' ||
                          a.category === 'MEETING' ||
                          a.category === 'NSO'
                      ).length
                    }{' '}
                    Kegiatan
                  </h3>
                  <span className="text-xs font-semibold text-purple-600 mt-1 block">
                    SBS, NSO & Koordinasi FMCU
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Banner Master Toko & Excel Sync */}
            <div className="bg-gradient-to-r from-[#00A389] via-[#00826D] to-[#0A564A] rounded-3xl p-6 text-white shadow-pill-teal flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-wider">
                    Master Data Terintegrasi
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400/25 text-amber-200 border border-amber-300/30 text-[10px] font-black uppercase">
                    ★ 610 Master Toko & 531 Kepemilikan Bestie
                  </span>
                </div>
                <h2 className="text-lg font-black tracking-tight">
                  Sistem Baca & Export Excel Jadwal Resmi FMCU (7 Kolom)
                </h2>
                <p className="text-xs text-white/85 max-w-2xl mt-1 leading-relaxed">
                  Mendukung deteksi otomatis multi-poin (1. 2.), pemisahan multi-toko (&amp;), pencocokan 610 Master Toko &amp; Kepemilikan Bestie, pemisahan ketat Visit Store vs NSO/FMCU, serta pengisian otomatis hari libur (Auto-OFF).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setActiveTab('stores')}
                  className="px-4 py-2.5 rounded-2xl bg-white text-teal-900 text-xs font-black shadow-md hover:bg-teal-50 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Store className="w-4 h-4 text-[#00A389]" />
                  <span>Buka 610 Master Toko</span>
                </button>
                <button
                  onClick={() => exportScheduleToTemplateExcel(agendas, users, 'ALL')}
                  className="px-4 py-2.5 rounded-2xl bg-emerald-950/50 border border-white/25 text-white text-xs font-extrabold hover:bg-emerald-950/70 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-300" />
                  <span>Export Template Jadwal (.xlsx)</span>
                </button>
                <button
                  onClick={() => setActiveTab('import-excel')}
                  className="px-4 py-2.5 rounded-2xl bg-black/25 text-white text-xs font-extrabold hover:bg-black/35 transition-all cursor-pointer"
                >
                  Impor Excel
                </button>
              </div>
            </div>

            {/* Recent Agendas Overview Table */}
            <div className="bg-white rounded-3xl p-6 shadow-soft-card border border-slate-200/80">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Daftar Agenda Terkini (Live)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Data agenda langsung terhubung dengan 610 Master Toko dan otomatis terlihat oleh masing-masing karyawan
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('schedules')}
                  className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                >
                  <span>Lihat Semua ({agendas.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">Karyawan (PIC)</th>
                      <th className="py-3 px-4">Judul Agenda</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4">Tanggal & Waktu</th>
                      <th className="py-3 px-4">Lokasi / Kode Toko</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {agendas.slice(0, 8).map((agenda) => (
                      <tr key={agenda.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-teal-50 text-teal-700 font-extrabold flex items-center justify-center text-[10px]">
                            {agenda.pic.charAt(0)}
                          </div>
                          <span>{agenda.pic}</span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800 max-w-xs truncate">
                          {agenda.title}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
                            {agenda.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-600">
                          {agenda.date} • {agenda.time} WIB
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 truncate max-w-[200px]">
                          {agenda.storeCode ? (
                            <span className="font-mono font-black text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded mr-1.5 text-[10px]">
                              {agenda.storeCode}
                            </span>
                          ) : null}
                          {agenda.location}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(agenda)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                              title="Edit Agenda"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteAgenda(agenda.id)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                              title="Hapus Agenda"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 2: MASTER DATA TOKO (610) & TOKO KEPEMILIKAN BESTIE (531)
            ===================================================================== */}
        {activeTab === 'stores' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-3xl p-5 shadow-soft-card border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Total Master Toko
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">
                    {allStoresWithOwnership.length} Toko
                  </h3>
                  <span className="text-xs font-semibold text-teal-600 mt-1 block">
                    CVS, FamiSuper & Housing
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Store className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-soft-card border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Toko Kepemilikan Bestie
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">
                    {bestieAssignments.length} Toko
                  </h3>
                  <span className="text-xs font-bold text-amber-600 mt-1 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    <span>Bestie In Charge Terpetakan</span>
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Star className="w-6 h-6 fill-amber-400" />
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-soft-card border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Personil Bestie Pemilik
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">
                    {bestieOwnerStats.length} Bestie
                  </h3>
                  <span className="text-xs font-semibold text-emerald-600 mt-1 block">
                    PIC Kepemilikan Toko Aktif
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-soft-card border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Cakupan Manajemen
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">
                    {uniqueRmList.length} RM • {uniqueAmCount} AM
                  </h3>
                  <span className="text-xs font-semibold text-blue-600 mt-1 block">
                    Regional & Area Manager
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Status Toast */}
            {storeActionStatus && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{storeActionStatus}</span>
                </div>
                <button
                  onClick={() => setStoreActionStatus(null)}
                  className="text-emerald-700 hover:text-emerald-900 font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Master Filter & Action Bar */}
            <div className="bg-white rounded-3xl p-5 shadow-soft-card border border-slate-200/80 space-y-4">
              {/* Top Row: Scope Toggle Pills + Action Buttons */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                {/* Scope Filter Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider mr-1">
                    Filter Scope:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStoreScopeFilter('ALL');
                      setStorePage(1);
                    }}
                    className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                      storeScopeFilter === 'ALL'
                        ? 'bg-gradient-to-r from-[#00A389] to-[#00826D] text-white shadow-pill-teal'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                    className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                      storeScopeFilter === 'OWNED'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                        : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>Toko Kepemilikan Bestie ({bestieAssignments.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStoreScopeFilter('UNOWNED');
                      setStorePage(1);
                    }}
                    className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold transition-all cursor-pointer ${
                      storeScopeFilter === 'UNOWNED'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Belum Dipetakan (
                    {allStoresWithOwnership.filter((s) => !s.ownerBestieName).length})
                  </button>
                </div>

                {/* Live Sync & Export Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncBestieSheet}
                    disabled={isSyncingBestieSheet}
                    className="px-3.5 py-2 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-teal-600 ${
                        isSyncingBestieSheet ? 'animate-spin' : ''
                      }`}
                    />
                    <span>Sync Google Sheet Kepemilikan</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportMasterStoresToExcel}
                    className="px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-pill-teal transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Excel Toko & Kepemilikan</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenAddStoreModal}
                    className="px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-teal-400 stroke-[3]" />
                    <span>+ Tambah Toko</span>
                  </button>
                </div>
              </div>

              {/* Bottom Row: Search Input & Dropdown Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Search Input */}
                <div className="relative md:col-span-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Cari kode (3013), nama toko, SH, AM, Bestie..."
                    value={storeSearchQuery}
                    onChange={(e) => {
                      setStoreSearchQuery(e.target.value);
                      setStorePage(1);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-teal-400"
                  />
                </div>

                {/* Filter by Bestie In Charge */}
                <select
                  value={selectedBestieFilter}
                  onChange={(e) => {
                    setSelectedBestieFilter(e.target.value);
                    setStorePage(1);
                  }}
                  className="px-3.5 py-2 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs font-extrabold text-amber-900 outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="ALL">
                    ★ Semua Bestie In Charge ({bestieOwnerStats.length} Personil)
                  </option>
                  {bestieOwnerStats.map((b) => (
                    <option key={b.name} value={b.name}>
                      ★ {b.name} ({b.count} Toko Kepemilikan)
                    </option>
                  ))}
                </select>

                {/* Filter by Regional Manager */}
                <select
                  value={selectedRmFilter}
                  onChange={(e) => {
                    setSelectedRmFilter(e.target.value);
                    setStorePage(1);
                  }}
                  className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-400"
                >
                  <option value="ALL">Semua Regional Manager ({uniqueRmList.length} RM)</option>
                  {uniqueRmList.map((rm) => (
                    <option key={rm} value={rm}>
                      RM: {rm}
                    </option>
                  ))}
                </select>

                {/* Filter by Store Type */}
                <select
                  value={selectedStoreTypeFilter}
                  onChange={(e) => {
                    setSelectedStoreTypeFilter(e.target.value);
                    setStorePage(1);
                  }}
                  className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-400"
                >
                  <option value="ALL">Semua Tipe Toko (CVS / FamiSuper / Housing)</option>
                  <option value="CVS">CVS (Convenience Store)</option>
                  <option value="FamiSuper">FamiSuper</option>
                  <option value="Housing">Housing</option>
                </select>
              </div>
            </div>

            {/* Master Stores Table */}
            <div className="bg-white rounded-3xl shadow-soft-card border border-slate-200/80 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-700">
                    Menampilkan {paginatedStores.length} dari {filteredStores.length} toko
                  </span>
                  {selectedBestieFilter !== 'ALL' && (
                    <span className="text-[11px] font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                      ★ Milik Bestie: {selectedBestieFilter}
                    </span>
                  )}
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={storePage <= 1}
                    onClick={() => setStorePage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-extrabold text-slate-600">
                    Hal {Math.min(storePage, totalStorePages)} / {totalStorePages}
                  </span>
                  <button
                    type="button"
                    disabled={storePage >= totalStorePages}
                    onClick={() => setStorePage((p) => Math.min(totalStorePages, p + 1))}
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto no-scrollbar max-h-[640px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100 text-slate-600 font-black uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">Kode & Tipe</th>
                      <th className="py-3 px-4">Nama Cabang & Kota</th>
                      <th className="py-3 px-4">★ Toko Kepemilikan (Bestie)</th>
                      <th className="py-3 px-4">Store Head & Kontak</th>
                      <th className="py-3 px-4">Area & Regional Manager</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {paginatedStores.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Tidak ada data toko yang cocok dengan filter pencarian.
                        </td>
                      </tr>
                    ) : (
                      paginatedStores.map((st) => (
                        <tr key={st.code} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-slate-900 text-teal-300">
                                {st.code}
                              </span>
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                  st.type === 'FamiSuper'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : st.type === 'Housing'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-teal-50 text-teal-700 border-teal-200'
                                }`}
                              >
                                {st.type || 'CVS'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 max-w-[260px]">
                            <div className="font-extrabold text-slate-900 truncate">
                              {st.name}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                              <span className="font-bold text-slate-700">{st.city}</span>
                              {st.address ? ` • ${st.address}` : ''}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {st.ownerBestieName ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300/80 text-[11px] font-extrabold">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                                <span>{st.ownerBestieName}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Belum ada kepemilikan
                              </span>
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
                              AM: <span className="text-teal-700">{st.areaManager || '-'}</span>
                            </div>
                            <div className="text-[10.5px] font-semibold text-slate-500 truncate">
                              RM: {st.regionalManager || '-'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleQuickScheduleStoreVisit(st)}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10.5px] font-extrabold transition flex items-center gap-1 cursor-pointer"
                                title="Jadwalkan Visit ke Toko Ini"
                              >
                                <CalendarIcon className="w-3 h-3" />
                                <span>Jadwalkan</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditStoreModal(st)}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                                title="Edit Master Toko & Kepemilikan"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 3: MASTER SCHEDULE MANAGEMENT
            ===================================================================== */}
        {activeTab === 'schedules' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Filter & Search Bar */}
            <div className="bg-white rounded-3xl p-5 shadow-soft-card border border-slate-200/80 flex flex-col lg:flex-row items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative w-full lg:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari agenda, kode toko, karyawan, lokasi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-teal-400"
                />
              </div>

              {/* Filters & Export Excel Button */}
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-400"
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
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-400 max-w-[200px]"
                >
                  <option value="ALL">
                    Semua Karyawan ({users.filter((u) => !u.isAdmin).length})
                  </option>
                  {users
                    .filter((u) => !u.isAdmin)
                    .map((u) => (
                      <option key={u.id || u.name} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    exportScheduleToTemplateExcel(agendas, users, selectedUserFilter)
                  }
                  className="px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                  title="Export ke format Templete Jadwal.xlsx (7 Kolom Resmi)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    Export Excel{' '}
                    {selectedUserFilter === 'ALL' ? '(Semua)' : `(${selectedUserFilter})`}
                  </span>
                </button>

                <button
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2 rounded-2xl bg-[#00A389] text-white text-xs font-extrabold shadow-pill-teal hover:brightness-105 active:scale-95 transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ Buat Agenda</span>
                </button>
              </div>
            </div>

            {/* Schedule Table */}
            <div className="bg-white rounded-3xl shadow-soft-card border border-slate-200/80 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  Menampilkan {filteredAgendas.length} agenda kerja
                </span>
                <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full">
                  Terintegrasi 610 Master Toko & Kepemilikan Bestie
                </span>
              </div>

              <div className="overflow-x-auto no-scrollbar max-h-[600px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100 text-slate-600 font-black uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">Karyawan (PIC)</th>
                      <th className="py-3 px-4">Judul Agenda</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4">Tanggal & Waktu</th>
                      <th className="py-3 px-4">Lokasi / Master Toko</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredAgendas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Tidak ada agenda yang cocok dengan filter atau pencarian.
                        </td>
                      </tr>
                    ) : (
                      filteredAgendas.map((agenda) => (
                        <tr key={agenda.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-teal-50 text-teal-700 font-extrabold flex items-center justify-center text-[10px]">
                              {agenda.pic.charAt(0)}
                            </div>
                            <span className="truncate max-w-[150px]">{agenda.pic}</span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800 max-w-xs break-words">
                            {agenda.title}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                                agenda.category === 'VISIT'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : agenda.category === 'NSO'
                                  ? 'bg-pink-50 text-pink-700 border-pink-200'
                                  : agenda.category === 'OFF' || agenda.category === 'CUTI'
                                  ? 'bg-slate-100 text-slate-600 border-slate-200'
                                  : 'bg-teal-50 text-teal-700 border-teal-100'
                              }`}
                            >
                              {agenda.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-600">
                            {agenda.date} • {agenda.time}
                            {agenda.endTime ? `–${agenda.endTime}` : ''} WIB
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 max-w-[220px]">
                            <div className="truncate">
                              {agenda.storeCode && (
                                <span className="font-mono font-black text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-teal-300 mr-1.5">
                                  {agenda.storeCode}
                                </span>
                              )}
                              <span>{agenda.location}</span>
                            </div>
                            {agenda.areaManager && (
                              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                AM: {agenda.areaManager} • RM: {agenda.regionalManager || '-'}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditModal(agenda)}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                                title="Edit Agenda"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeleteAgenda(agenda.id)}
                                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                                title="Hapus Agenda"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 4: ATURAN BACA & EXPORT EXCEL JADWAL ("TEMPLETE JADWAL.XLSX")
            ===================================================================== */}
        {activeTab === 'import-excel' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-8 shadow-soft-card border border-slate-200/80 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] uppercase">
                        Aturan Korporat FMCU
                      </span>
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">
                        Impor & Export File Excel Jadwal (7 Kolom Resmi)
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Format Kolom A–G: <strong>Nama, Start Date, Start Time, End Date, End Time, Description, Location</strong>
                    </p>
                  </div>
                </div>

                {/* Export Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportScheduleToTemplateExcel(agendas, users, 'ALL')}
                    className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#00A389] to-[#00826D] text-white text-xs font-black shadow-pill-teal hover:brightness-105 transition flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Jadwal ke Template Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={exportMasterStoresToExcel}
                    className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition flex items-center gap-2 cursor-pointer"
                  >
                    <Store className="w-4 h-4 text-teal-400" />
                    <span>Export 610 Master Toko (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Status Message */}
              {importStatus && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{importStatus}</span>
                  </div>
                  <button
                    onClick={() => setImportStatus(null)}
                    className="text-emerald-700 hover:text-emerald-900 font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Multi-Sheet Selector if Workbook is Loaded */}
              {uploadedWorkbook && uploadedWorkbook.SheetNames.length > 0 && (
                <div className="p-5 rounded-2xl bg-teal-50/70 border border-teal-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 block">
                        File Terdeteksi: {uploadedFileName}
                      </span>
                      <h4 className="text-sm font-black text-slate-900">
                        Pilih Sheet Minggu Jadwal ({uploadedWorkbook.SheetNames.length} Sheet Tersedia)
                      </h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={selectedSheetName}
                        onChange={(e) => {
                          setSelectedSheetName(e.target.value);
                          applyExcelSheetSelection(uploadedWorkbook, e.target.value);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-white border border-teal-300 text-xs font-extrabold text-slate-800 outline-none"
                      >
                        {uploadedWorkbook.SheetNames.map((sName) => (
                          <option key={sName} value={sName}>
                            Sheet: {sName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          applyExcelSheetSelection(uploadedWorkbook, selectedSheetName)
                        }
                        className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-extrabold transition cursor-pointer"
                      >
                        Terapkan Sheet Ini
                      </button>
                      {uploadedWorkbook.SheetNames.length > 1 && (
                        <button
                          type="button"
                          onClick={() => applyAllExcelSheets(uploadedWorkbook)}
                          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition cursor-pointer"
                        >
                          Gabungkan Semua Sheet ({uploadedWorkbook.SheetNames.length})
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Extracted Schedule Summary Dashboard */}
              {lastParsedSummary && (
                <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200/90 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Ringkasan Hasil Ekstraksi — {lastParsedSummary.sheetName}
                    </h4>
                    <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      {lastParsedSummary.stats.matchedStoresCount} Master Toko Cocok Otomatis
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        Total Item Jadwal
                      </span>
                      <span className="text-lg font-black text-slate-900 mt-0.5 block">
                        {lastParsedSummary.stats.totalRows}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase block">
                        Visit Store Resmi
                      </span>
                      <span className="text-lg font-black text-emerald-800 mt-0.5 block">
                        {lastParsedSummary.stats.visitCount} Toko
                      </span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-pink-50/70 border border-pink-200">
                      <span className="text-[10px] font-bold text-pink-700 uppercase block">
                        NSO / Reopening
                      </span>
                      <span className="text-lg font-black text-pink-800 mt-0.5 block">
                        {lastParsedSummary.stats.nsoCount} NSO
                      </span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200">
                      <span className="text-[10px] font-bold text-blue-700 uppercase block">
                        Agenda Non-Store
                      </span>
                      <span className="text-lg font-black text-blue-800 mt-0.5 block">
                        {lastParsedSummary.stats.nonStoreAgendaCount} Agenda
                      </span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-600 uppercase block">
                        Libur (OFF) & Cuti
                      </span>
                      <span className="text-lg font-black text-slate-800 mt-0.5 block">
                        {lastParsedSummary.stats.offCount} Off • {lastParsedSummary.stats.cutiCount} Cuti
                      </span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200">
                      <span className="text-[10px] font-bold text-teal-700 uppercase block">
                        Personil Terjadwal
                      </span>
                      <span className="text-lg font-black text-teal-900 mt-0.5 block">
                        {lastParsedSummary.stats.matchedUsersCount} Orang
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Drag and Drop Zone */}
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
                className={`border-3 border-dashed rounded-3xl p-10 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/50 scale-101'
                    : 'border-slate-300 bg-slate-50/60 hover:bg-slate-100/60'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-16 h-16 rounded-3xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-base font-extrabold text-slate-800">
                  Tarik & Letakkan File "Templete Jadwal.xlsx" di sini, atau Klik untuk Memilih
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Format file yang didukung: .xlsx, .xls (Otomatis menerapkan Aturan Baca Excel FMCU &amp; pencocokan 610 Master Toko)
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Official Rules Reference Card */}
              <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                  <Info className="w-4 h-4 text-teal-600" />
                  <span>Aturan Resmi Baca & Export Excel Jadwal FMCU</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11.5px] text-slate-600 leading-relaxed">
                  <div className="p-3 rounded-2xl bg-white border border-slate-200/70">
                    <strong className="text-slate-900 block mb-1">
                      1. Deteksi Ketat Visit Store vs Non-Visit:
                    </strong>
                    Hanya diklasifikasikan sebagai <strong>VISIT STORE</strong> apabila Kolom F (Description) memuat kata <code>Visit</code>, <code>Visit Store</code>, atau <code>Refreshment QSC</code>, <strong>DAN</strong> Kolom G (Location) <strong>bukan</strong> <code>NSO</code> serta <strong>bukan</strong> <code>FMCU</code>.
                  </div>
                  <div className="p-3 rounded-2xl bg-white border border-slate-200/70">
                    <strong className="text-slate-900 block mb-1">
                      2. Multi-Poin (1. 2.) & Pemisahan Multi-Toko (&amp;):
                    </strong>
                    Jika Kolom F memiliki poin bernomor (<code>1. ... 2. ...</code>) atau Kolom G memisahkan beberapa toko dengan simbol <code>&amp;</code> (misal: <code>Cipete &amp; Bulungan</code>), sistem otomatis memecah menjadi item jadwal terpisah per toko!
                  </div>
                  <div className="p-3 rounded-2xl bg-white border border-slate-200/70">
                    <strong className="text-slate-900 block mb-1">
                      3. Pencocokan Otomatis 610 Master Toko & Kepemilikan:
                    </strong>
                    Nama lokasi di Kolom G dicocokkan ke <strong>610 Master Toko</strong> (termasuk alias seperti <code>BDG RIAU → 3006 LL RE MARTADINATA</code>) untuk mengisi Kode Toko, Store Head, AM, RM, dan Bestie In Charge.
                  </div>
                  <div className="p-3 rounded-2xl bg-white border border-slate-200/70">
                    <strong className="text-slate-900 block mb-1">
                      4. Auto-OFF Hari Kosong & Cuti:
                    </strong>
                    Jika Kolom F berisi <code>Cuti</code> atau <code>Off / Ganti Off</code>, otomatis tercatat sebagai Cuti/Libur. Tanggal dalam minggu tersebut yang tidak tercantum di Kolom B otomatis diisi sebagai <code>WEEKEND / OFF</code> atau <code>HARI LIBUR / OFF</code>.
                  </div>
                </div>
              </div>

              {/* Quick 1-Click Sync Button */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    Gunakan Data Template Bawaan (Default Seed)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    File "TEMPLET EXCEL JADWAL.xlsx" (582 Jadwal & 36 Akun Pegawai) telah disiapkan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSyncPreBundledExcel}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#00A389] to-[#00826D] text-white text-xs font-black shadow-pill-teal hover:brightness-105 active:scale-95 transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Sinkronisasi Ulang Template Excel Bawaan</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 5: STANDAR HOLDING TIME R23 MANAGEMENT
            ===================================================================== */}
        {activeTab === 'holding-time' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-8 shadow-soft-card border border-slate-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 font-black text-[10px] uppercase border border-emerald-500/20">
                        {holdingStandards.revision}
                      </span>
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">
                        {holdingStandards.title}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      No. Dokumen:{' '}
                      <span className="font-bold text-slate-700">{holdingStandards.version}</span> •
                      Berlaku:{' '}
                      <span className="font-bold text-slate-700">
                        {holdingStandards.effectiveDateFormatted}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowR23PreviewModal(true)}
                    className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-black text-white text-xs font-black shadow-sm transition flex items-center gap-2 cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-emerald-400" />
                    <span>Pratinjau Standar R23</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => holdingFileInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-pill-teal transition flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Unggah File Baru (.pdf / .json)</span>
                  </button>
                  <input
                    ref={holdingFileInputRef}
                    type="file"
                    accept=".pdf,.json,.xlsx"
                    className="hidden"
                    onChange={handleHoldingFileUpload}
                  />
                </div>
              </div>

              {holdingUploadStatus && (
                <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{holdingUploadStatus}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHoldingUploadStatus(null)}
                    className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Kategori
                  </span>
                  <span className="text-xl font-black text-slate-900 mt-1 block">
                    {holdingStandards.categories.length} Kategori
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Fryer, Steamer, Oden, dll
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Produk Terdaftar
                  </span>
                  <span className="text-xl font-black text-slate-900 mt-1 block">
                    {holdingStandards.categories.reduce((a, c) => a + c.items.length, 0)} Produk
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Lengkap spesifikasi holding
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Divisi Pengesah
                  </span>
                  <span className="text-sm font-black text-slate-900 mt-1 block truncate">
                    {holdingStandards.department}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate block">
                    Disetujui: {holdingStandards.approvedBy}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Aturan Food Safety
                  </span>
                  <span className="text-xl font-black text-slate-900 mt-1 block">
                    {holdingStandards.generalRules.length} Ketentuan
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Wajib timer digital & exp date
                  </span>
                </div>
              </div>

              <div className="pt-5 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-800">Reset Standar Holding Time</h4>
                  <p className="text-[11px] text-slate-400">
                    Kembalikan dataset ke versi original STD/FMI/PD-QC/001/R23
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetHoldingStandards}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Default R23</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 6: USERS MANAGEMENT
            ===================================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 shadow-soft-card border border-slate-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-teal-600" />
                    <span>
                      Daftar Akun Pegawai & Kepemilikan Toko (
                      {users.filter((u) => !u.isAdmin).length} Karyawan)
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Semua akun terhubung dengan jadwal Excel & daftar Toko Kepemilikan Bestie (Password default:{' '}
                    <strong className="text-slate-700">0000</strong>)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                    Total: {users.filter((u) => !u.isAdmin).length} Akun Aktif
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {users
                  .filter((u) => !u.isAdmin)
                  .map((u, idx) => {
                    const userAgendasCount = agendas.filter((a) => a.pic === u.name).length;
                    const ownedCount = getStoresWithOwnership(u.name).filter(
                      (s) => s.isOwnedByBestie
                    ).length;
                    return (
                      <div
                        key={u.id || idx}
                        className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex items-start gap-3.5 hover:bg-white hover:shadow-soft-sm transition-all"
                      >
                        <img
                          src={
                            u.avatar ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name.replace(
                              /\s+/g,
                              ''
                            )}`
                          }
                          alt={u.name}
                          className="w-11 h-11 rounded-full object-cover ring-2 ring-teal-200 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-extrabold text-slate-900 truncate">
                            {u.name}
                          </h4>
                          <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                              {userAgendasCount} Jadwal
                            </span>
                            {ownedCount > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBestieFilter(u.name);
                                  setStoreScopeFilter('OWNED');
                                  setActiveTab('stores');
                                }}
                                className="text-[10px] font-extrabold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1 cursor-pointer"
                              >
                                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-500" />
                                <span>{ownedCount} Toko Miliknya</span>
                              </button>
                            )}
                            <span className="text-[10px] font-semibold text-slate-400">
                              Sandi: {u.password || '0000'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 7: CATEGORIES MANAGEMENT
            ===================================================================== */}
        {activeTab === 'categories' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 shadow-soft-card border border-slate-200/80">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-teal-600" />
                    <span>Master Kategori Agenda FMCU</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Kategori digunakan untuk klasifikasi agenda kerja, pembedaan warna badge, dan pemicu form khusus (VISIT).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoriesList.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-start gap-3"
                  >
                    <div
                      className={`px-3 py-1.5 rounded-xl font-black text-xs ${cat.bg} ${cat.text} flex-shrink-0`}
                    >
                      {cat.id}
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900">{cat.label}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{cat.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DeveloperFooter className="pt-8 pb-4 text-center" />
      </main>

      {/* =====================================================================
          MODAL 1: BUAT / EDIT AGENDA KERJA (DENGAN PEMILIH MASTER TOKO & KEPEMILIKAN)
          ===================================================================== */}
      {showAgendaModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white rounded-[32px] shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Plus className="w-4 h-4 stroke-[3]" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingAgenda ? 'Edit Agenda Kerja' : 'Buat Agenda Kerja Baru (Admin)'}
                </h3>
              </div>
              <button
                onClick={() => setShowAgendaModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAgenda} className="space-y-3.5">
              {/* Pilih Karyawan (PIC) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Ditugaskan Kepada (Karyawan PIC) *
                  </label>
                  <select
                    value={agendaPic}
                    onChange={(e) => setAgendaPic(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    {users
                      .filter((u) => !u.isAdmin)
                      .map((u) => (
                        <option key={u.id || u.name} value={u.name}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Kategori Agenda */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Kategori Agenda *
                  </label>
                  <select
                    value={agendaCategory}
                    onChange={(e) => setAgendaCategory(e.target.value as ScheduleCategory)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    {categoriesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} - {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PEMILIH TOKO FAMILYMART (MUNCUL SAAT VISIT / NSO) */}
              {(agendaCategory === 'VISIT' || agendaCategory === 'NSO') && (
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/90 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-[11px] font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Pilih Cabang Toko FamilyMart</span>
                    </label>

                    {/* Scope Toggle: Semua Master Toko vs Milik Bestie Ini */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setModalStoreScope('ALL')}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold transition cursor-pointer ${
                          modalStoreScope === 'ALL'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        Semua Master Toko ({allStoresWithOwnership.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalStoreScope('OWNED')}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer ${
                          modalStoreScope === 'OWNED'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-white text-amber-800 border border-amber-300'
                        }`}
                      >
                        <Star className="w-2.5 h-2.5 fill-current" />
                        <span>Milik {agendaPic.split(' ')[0]} ({ownedByCurrentPicCount})</span>
                      </button>
                    </div>
                  </div>

                  {/* Quick filter input + Select */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Ketik kode / nama toko..."
                      value={modalStoreSearch}
                      onChange={(e) => setModalStoreSearch(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <select
                      value={agendaStoreCode}
                      onChange={(e) => handleSelectStoreInAgendaModal(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-extrabold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400"
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

              {/* Judul Agenda */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Judul Agenda *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Audit & Store Visit - Cabang BDG DAGO"
                  value={agendaTitle}
                  onChange={(e) => setAgendaTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              {/* Tanggal & Waktu */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    value={agendaDate}
                    onChange={(e) => setAgendaDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    required
                    value={agendaTime}
                    onChange={(e) => setAgendaTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    required
                    value={agendaEndTime}
                    onChange={(e) => setAgendaEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>

              {/* Lokasi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Lokasi Toko / Tempat
                </label>
                <input
                  type="text"
                  placeholder="Contoh: BDG DAGO (3013) - BANDUNG"
                  value={agendaLocation}
                  onChange={(e) => setAgendaLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Instruksi Kerja / Catatan Admin
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan detail untuk karyawan yang bertugas..."
                  value={agendaDescription}
                  onChange={(e) => setAgendaDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00A389] to-[#00826D] text-white text-xs font-black shadow-pill-teal hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                >
                  {editingAgenda ? 'Simpan Perubahan Agenda' : 'Terbitkan Agenda ke Sisi User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: TAMBAH / EDIT MASTER TOKO & KEPEMILIKAN BESTIE
          ===================================================================== */}
      {showStoreModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingStore
                    ? `Edit Master Toko ${editingStore.name} (${editingStore.code})`
                    : 'Tambah Master Toko FamilyMart Baru'}
                </h3>
              </div>
              <button
                onClick={() => setShowStoreModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
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
                    placeholder="Contoh: 3013"
                    value={storeForm.code}
                    onChange={(e) => setStoreForm({ ...storeForm, code: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Nama Toko *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: BDG DAGO"
                    value={storeForm.name}
                    onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Tipe Toko *
                  </label>
                  <select
                    value={storeForm.type}
                    onChange={(e) => setStoreForm({ ...storeForm, type: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  >
                    <option value="CVS">CVS</option>
                    <option value="FamiSuper">FamiSuper</option>
                    <option value="Housing">Housing</option>
                  </select>
                </div>
              </div>

              {/* Kepemilikan Bestie In Charge & Kota */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-amber-800 uppercase mb-1">
                    ★ Bestie In Charge (Kepemilikan Toko)
                  </label>
                  <input
                    type="text"
                    list="bestie-owners-datalist"
                    placeholder="Pilih atau ketik nama Bestie..."
                    value={storeForm.ownerBestieName}
                    onChange={(e) =>
                      setStoreForm({ ...storeForm, ownerBestieName: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-amber-50/70 border border-amber-300 rounded-xl text-xs font-extrabold text-amber-950"
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
                    placeholder="Contoh: BANDUNG / JAKARTA SELATAN"
                    value={storeForm.city}
                    onChange={(e) => setStoreForm({ ...storeForm, city: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Store Head, AM, RM */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Store Head (SH)
                  </label>
                  <input
                    type="text"
                    placeholder="Nama Store Head"
                    value={storeForm.storeHead}
                    onChange={(e) => setStoreForm({ ...storeForm, storeHead: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Area Manager (AM)
                  </label>
                  <input
                    type="text"
                    placeholder="Nama Area Manager"
                    value={storeForm.areaManager}
                    onChange={(e) => setStoreForm({ ...storeForm, areaManager: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Regional Manager (RM)
                  </label>
                  <input
                    type="text"
                    placeholder="Nama Regional Manager"
                    value={storeForm.regionalManager}
                    onChange={(e) =>
                      setStoreForm({ ...storeForm, regionalManager: e.target.value })
                    }
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
                  />
                </div>
              </div>

              {/* Email & Telepon & GPS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Email Toko
                  </label>
                  <input
                    type="email"
                    placeholder="store@familymartindonesia.com"
                    value={storeForm.email}
                    onChange={(e) => setStoreForm({ ...storeForm, email: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
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
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900"
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
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              {/* Alamat */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Alamat Lengkap Toko
                </label>
                <textarea
                  rows={2}
                  placeholder="Alamat lengkap cabang..."
                  value={storeForm.address}
                  onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00A389] to-[#00826D] text-white text-xs font-black shadow-pill-teal hover:brightness-105 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Master Data Toko & Kepemilikan</span>
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
