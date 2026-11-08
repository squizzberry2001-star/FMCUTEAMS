import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  FileSpreadsheet,
  Users,
  Eye,
  Store,
  Calendar,
  MapPin,
  Sparkles,
  Save,
  Check,
  FileText,
  Clock,
  Printer,
  X,
  Mic,
  MicOff,
  Brain,
  Wand2,
  RotateCw,
  Maximize2,
  ArrowRight,
  ShieldAlert,
  Sliders,
  CheckCheck,
  Home,
  ClipboardCheck,
  Info,
  Lock,
  Bot,
  Image as ImageIcon,
  Images,
  Cloud,
  WifiOff,
  Navigation,
  Star,
  Pencil
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ScheduleAgenda, User } from '../../types';
import {
  VisitReportData,
  StoreCrew,
  ObservationFinding,
  EvidencePhoto
} from '../../types/visitReport';
import { VisitPdfPreview } from './VisitPdfPreview';
import { PageTransitionLoader } from '../PageTransitionLoader';
import { DeveloperFooter } from '../DeveloperFooter';
import { HoldingTimeR23Modal } from './HoldingTimeR23Modal';
import { PhotoEditModal } from './PhotoEditModal';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { stitchTwoImagesVertically } from '../../services/pdfGeneratorService';
import { generateTaroObservationAnalysis } from '../../services/taroAiService';
import {
  findMasterStoreByCodeOrName,
  getStoresWithOwnership,
  getBestieByStoreCode
} from '../../data/masterStoresData';
import {
  performSilentActualCheckIn,
  performSilentActualCheckOut,
  subscribeSilentGpsUpdates,
  STRICT_STORE_RADIUS_METERS,
  getTrustedNow,
  formatTimeWib,
} from '../../services/actualAttendanceService';
import {
  fetchVisitReportFromCloud,
  pushVisitReportToCloud,
  subscribeToCrossDeviceVisit,
  saveVisitPhotosToIdb,
  loadVisitPhotosFromIdb,
} from '../../services/crossDeviceVisitSyncService';

interface VisitReportFormProps {
  agenda: ScheduleAgenda;
  allAgendas?: ScheduleAgenda[];
  onUpdateAgenda?: (updated: ScheduleAgenda) => void;
  user: User | null;
  onBack: () => void;
}

// ============================================================================
// AUTO-RESIZE TEXTAREA COMPONENT (Melebar / Memanjang Otomatis Sesuai Isi Text)
// ============================================================================
interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  minRows?: number;
}

const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
  value,
  onChange,
  minRows = 2,
  className = '',
  ...props
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minHeight = minRows * 22 + 18;
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minRows]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  useEffect(() => {
    window.addEventListener('resize', adjustHeight);
    return () => window.removeEventListener('resize', adjustHeight);
  }, [adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      rows={minRows}
      value={value}
      onChange={(e) => {
        if (onChange) onChange(e);
        adjustHeight();
      }}
      className={`overflow-hidden resize-none ${className}`}
      {...props}
    />
  );
};

// ============================================================================
// INDEXED-DB PHOTO STORAGE & GAS (GOOGLE APPS SCRIPT) GDRIVE AUTO-SYNC ENGINE
// ============================================================================
const IDB_NAME = 'fmcu_visit_gdrive_cache_db';
const savePhotosToIdb = saveVisitPhotosToIdb;
const loadPhotosFromIdb = loadVisitPhotosFromIdb;

// Default GAS WebApp Endpoint & Target GDrive Folder (1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a)
const FMCU_GDRIVE_FOLDER_ID = '1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a';
const FMCU_GDRIVE_FOLDER_URL =
  'https://drive.google.com/drive/u/3/folders/1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a';
const DEFAULT_GAS_GDRIVE_URL =
  'https://script.google.com/macros/s/AKfycbxSL7hmNr0oGgAR19o3KYR3AMSHD2b9tY3uZ196AS_XTzTA9Wv3OGxE_NZ6ZGUnDe_EeQ/exec';

const uploadPhotoToGasGDrive = async (params: {
  base64Data: string;
  filename: string;
  storeCode: string;
  storeName: string;
  visitorName: string;
  visitDate: string;
  section: string;
}): Promise<{ driveFileId: string; driveUrl: string; synced: boolean }> => {
  const gasUrl = DEFAULT_GAS_GDRIVE_URL;
  const driveFileId = `GDRIVE_${params.storeCode}_${Date.now()}`;
  const driveUrl = FMCU_GDRIVE_FOLDER_URL;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { driveFileId, driveUrl, synced: false };
  }

  try {
    await fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'uploadPhotoToGDrive',
        folderId: FMCU_GDRIVE_FOLDER_ID,
        folderUrl: FMCU_GDRIVE_FOLDER_URL,
        folderName: `FMCU_VISIT_${params.storeCode}_${params.storeName}`,
        filename: params.filename,
        mimeType: 'image/jpeg',
        storeCode: params.storeCode,
        storeName: params.storeName,
        visitorName: params.visitorName,
        visitDate: params.visitDate,
        section: params.section,
        base64: params.base64Data.replace(/^data:image\/\w+;base64,/, ''),
        timestamp: new Date().toISOString(),
      }),
    });
    return { driveFileId, driveUrl, synced: true };
  } catch (err) {
    console.warn('GAS GDrive background sync queued:', err);
    return { driveFileId, driveUrl, synced: false };
  }
};

// 5 Preset Temuan Resmi FMCU
const FINDING_PRESETS = [
  {
    id: 'preset-food-safety',
    label: 'Template: Produk / Bahan Baku Expired',
    category: 'Expired',
    temuan: 'Ditemukan produk/bahan baku yang telah melewati masa expired date pada chiller penyimpanan.',
    kondisiIdeal: 'Semua produk dan bahan baku yang tersimpan di chiller/area penyimpanan tidak ada yang melewati masa kadaluarsa (expired).',
    penyebab: 'Kurangnya ketelitian saat pengecekan rutin dan tidak dilakukan double check FEFO.',
    dampak: '• Berisiko menurunkan kualitas dan keamanan pangan.\n• Dapat menyebabkan produk tidak layak konsumsi.',
    tindakanPerbaikan: 'Memisahkan dan memusnahkan (waste) produk yang expired serta melakukan pengecekan FEFO setiap pergantian shift.',
    hasil: 'Akan dimonitoring pada visit berikutnya'
  },
  {
    id: 'preset-alat-takar',
    label: 'Template: Alat Takar / SOP Produksi',
    category: 'Tools',
    temuan: 'Penggunaan alat takar di bar station tidak sesuai dengan takaran standar SOP (menggunakan sendok manual non-standar).',
    kondisiIdeal: 'Penggunaan alat takar wajib sesuai standar dan ketentuan masing-masing produk agar takaran bahan konsisten.',
    penyebab: 'Kurangnya pengawasan terhadap penggunaan alat takar saat operasional.',
    dampak: '• Rasa dan kualitas produk menjadi tidak konsisten.\n• Berpotensi menyebabkan selisih HPP / pemborosan bahan baku.',
    tindakanPerbaikan: 'Mengganti alat takar sesuai standar yang ditetapkan dan melakukan briefing ulang kepada crew.',
    hasil: 'Akan dimonitoring pada visit berikutnya'
  },
  {
    id: 'preset-kebersihan',
    label: 'Template: Kebersihan & Sanitasi Area Toko',
    category: 'Lingkungan Store',
    temuan: 'Area sink dan kolong chiller kotor, berdebu tebal, serta terdapat genangan air yang tidak segera dikeringkan.',
    kondisiIdeal: 'Area toko dan fasilitas pendukung dalam kondisi bersih, kering, tidak berbau, serta lengkap sesuai standar QSC.',
    penyebab: 'Pembersihan berkala tidak dilakukan sesuai jadwal checklist kebersihan harian.',
    dampak: '• Menurunkan kenyamanan serta kepuasan pelanggan.\n• Berpotensi menjadi sumber kontaminasi silang.',
    tindakanPerbaikan: 'Melakukan pembersihan menyeluruh segera dan memperketat pengecekan checklist kebersihan per shift.',
    hasil: 'Akan dimonitoring pada visit berikutnya'
  },
  {
    id: 'preset-logbook',
    label: 'Template: Administrasi & Pengisian Logbook',
    category: 'Kelayakan',
    temuan: 'Logbook suhu chiller dan deep fryer tidak diisi secara aktual dan terlewat selama 2 hari operasional.',
    kondisiIdeal: 'Pengisian seluruh logbook operasional wajib dilakukan secara aktual dan konsisten setiap hari per shift.',
    penyebab: 'Kurangnya kedisiplinan crew dalam melakukan pencatatan rutin.',
    dampak: 'Menurunnya tingkat keterlacakan terhadap aktivitas atau kendala operasional mutu di toko.',
    tindakanPerbaikan: 'Store Head / Shift Leader melakukan briefing kembali dan verifikasi pengisian logbook setiap hari.',
    hasil: 'Akan dimonitoring pada visit berikutnya'
  },
  {
    id: 'preset-price-card',
    label: 'Template: Merchandising & Price Card',
    category: 'Equipment',
    temuan: 'Price card pada rak chiller minuman dan snack banyak yang hilang serta tidak sesuai harga tertera di POS.',
    kondisiIdeal: 'Seluruh price card pada rak dan chiller wajib terpasang lengkap dan sesuai harga aktif di POS.',
    penyebab: 'Kurangnya verifikasi saat pergantian periode promosi/harga baru.',
    dampak: 'Berpotensi menimbulkan keluhan pelanggan akibat ketidaksesuaian informasi harga.',
    tindakanPerbaikan: 'Mencetak dan memperbarui price card sesuai update harga terbaru.',
    hasil: 'Akan dimonitoring pada visit berikutnya'
  }
];

export const VisitReportForm: React.FC<VisitReportFormProps> = ({
  agenda,
  allAgendas = [],
  onUpdateAgenda,
  user,
  onBack,
}) => {
  const draftKey = `fmcu_visit_report_${agenda.id}`;

  const getCurrentWibTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
  };

  // Form State
  const [formData, setFormData] = useState<VisitReportData>(() => {
    const cleanStoreName =
      agenda.storeName ||
      agenda.title
        .replace(/^Audit & Store Visit - Cabang /i, '')
        .replace(/ - SENSE OF URGENCY$/i, '')
        .trim() ||
      agenda.location;
    const matchedMasterStore =
      findMasterStoreByCodeOrName(agenda.storeCode) ||
      findMasterStoreByCodeOrName(cleanStoreName) ||
      findMasterStoreByCodeOrName(agenda.location);

    const resolvedStoreName = matchedMasterStore?.name || cleanStoreName;
    const resolvedStoreCode = agenda.storeCode || matchedMasterStore?.code || '3013';
    const resolvedStoreType = agenda.storeType || matchedMasterStore?.type || 'CVS';
    const resolvedStoreHead = agenda.storeHead || matchedMasterStore?.storeHead || 'Sutris Ismawan';
    const resolvedAreaManager = agenda.areaManager || matchedMasterStore?.areaManager || 'Hadi Ilman';
    const resolvedRegionalManager =
      agenda.regionalManager || matchedMasterStore?.regionalManager || 'Novy Rusnani';
    const resolvedStoreEmail =
      agenda.storeEmail ||
      matchedMasterStore?.email ||
      `store.${resolvedStoreName.toLowerCase().replace(/\s+/g, '')}@familymartindonesia.com`;

    const savedGps = localStorage.getItem('fmcu_live_gps') || '-6.2293, 106.8256';
    const initialInTime = agenda.actualIn || '';
    const initialOutTime = agenda.actualOut || '';

    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          actualIn: agenda.actualIn || parsed.actualIn || initialInTime,
          actualOut: agenda.actualOut || parsed.actualOut || initialOutTime,
          actualInSubmitted: Boolean(agenda.actualIn || parsed.actualIn),
          visitorName: user?.name || agenda.pic || parsed.visitorName || 'Marisa Giselina',
          storeName: parsed.storeName || resolvedStoreName,
          storeCode: parsed.storeCode || resolvedStoreCode,
          storeType: parsed.storeType || resolvedStoreType,
          storeHead: parsed.storeHead || resolvedStoreHead,
          areaManager: parsed.areaManager || resolvedAreaManager,
          regionalManager: parsed.regionalManager || resolvedRegionalManager,
          storeEmail: parsed.storeEmail || resolvedStoreEmail,
        };
      } catch (e) {
        console.error(e);
      }
    }

    return {
      id: `report-${Date.now()}`,
      agendaId: agenda.id,
      actualIn: initialInTime,
      actualOut: initialOutTime,
      liveGps: savedGps,
      actualInSubmitted: Boolean(agenda.actualIn),
      isManualCheckIn: false,
      storeFrontPhoto: '',
      visitorName: user?.name || agenda.pic || 'Marisa Giselina',
      storeName: resolvedStoreName,
      storeCode: resolvedStoreCode,
      storeType: resolvedStoreType,
      storeHead: resolvedStoreHead,
      visitDate: agenda.date || new Date().toISOString().split('T')[0],
      areaManager: resolvedAreaManager,
      regionalManager: resolvedRegionalManager,
      storeEmail: resolvedStoreEmail,
      qscSheetPhoto: '',
      qscSheetTop: '',
      qscSheetBottom: '',
      gasSyncStatus: 'idle',
      crews: [
        { id: 'c-1', role: 'Store Head', name: resolvedStoreHead, jobLevel: '' },
        { id: 'c-2', role: 'Shift Leader', name: '', jobLevel: '' },
        { id: 'c-3', role: 'Crew Store 1', name: '', jobLevel: '' },
        { id: 'c-4', role: 'Crew Store 2', name: '', jobLevel: '' },
      ],
      enableQsc: true,
      enableOpi: true,
      observations: [],
      enableEvidence: true,
      enableCa: true,
      evidencePhotos: [],
      caPhotos: [],
      spreadsheetUrl: 'https://tinyurl.com/store-caassignment',
      assignmentNotes: 'Harap segera lakukan tindakan perbaikan (Corrective Action) sebelum batas waktu deadline yang ditentukan.',
      status: 'DRAFT',
    };
  });

  // Master Store & Bestie Ownership Quick Picker State in Visit Form
  const [showStorePickerBar, setShowStorePickerBar] = useState(false);
  const [storePickerScope, setStorePickerScope] = useState<'ALL' | 'OWNED'>('ALL');
  const [storePickerSearch, setStorePickerSearch] = useState('');

  const pickableStoresForVisitor = React.useMemo(() => {
    const visitor = formData.visitorName || user?.name || agenda.pic;
    const all = getStoresWithOwnership(visitor);
    const q = storePickerSearch.trim().toLowerCase();
    return all
      .filter((s) => {
        if (storePickerScope === 'OWNED' && !s.isOwnedByBestie) return false;
        if (!q) return true;
        return (
          s.code.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.isOwnedByBestie !== b.isOwnedByBestie) return a.isOwnedByBestie ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [formData.visitorName, user?.name, agenda.pic, storePickerScope, storePickerSearch]);

  const currentStoreBestieOwner = React.useMemo(
    () => getBestieByStoreCode(formData.storeCode),
    [formData.storeCode]
  );

  const handleApplyMasterStore = (storeCode: string) => {
    const found = findMasterStoreByCodeOrName(storeCode);
    if (!found) return;
    const updatedCrews = [...formData.crews];
    if (updatedCrews[0] && found.storeHead) {
      updatedCrews[0].name = found.storeHead;
    }
    setFormData((prev) => ({
      ...prev,
      storeCode: found.code,
      storeName: found.name,
      storeType: found.type || 'CVS',
      storeHead: found.storeHead || prev.storeHead,
      areaManager: found.areaManager || prev.areaManager,
      regionalManager: found.regionalManager || prev.regionalManager,
      storeEmail: found.email || prev.storeEmail,
      crews: updatedCrews,
    }));
    setShowStorePickerBar(false);
  };

  // Step Nav: 1 (General Info & QSC), 2 (Observation), 3 (Evidence)
  const [activeSection, setActiveSection] = useState<number>(1);
  const sectionScrollPosRef = useRef<Record<number, number>>({ 1: 0, 2: 0, 3: 0 });

  const handleSwitchSection = (nextSection: number) => {
    // Simpan posisi scroll section saat ini
    const currentScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    sectionScrollPosRef.current[activeSection] = currentScrollY;

    setActiveSection(nextSection);

    if (nextSection === 1) {
      // SECTION 1 form visit selalu start dari top page
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      // Section Observasi & Bukti mempertahankan posisi scroll terakhir
      const savedY = sectionScrollPosRef.current[nextSection] || 0;
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedY, behavior: 'instant' });
      });
    }
  };

  // Sub-section tabs
  const [obsSubTab, setObsSubTab] = useState<'qsc' | 'opi'>('qsc');
  const [evidenceSubTab, setEvidenceSubTab] = useState<'finding' | 'ca'>('finding');

  // Active Observation Card Index for Quick Jump without scrolling
  const [activeObsIdx, setActiveObsIdx] = useState<number>(0);
  const obsCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Preview Mode
  const [showPreview, setShowPreview] = useState(false);

  // Only show Transition Loader if a heavy render takes >200ms (never forced on fast section changes)
  const [isSectionTransitioning] = React.useTransition();
  const hasMountedSectionRef = useRef(false);

  useEffect(() => {
    if (!hasMountedSectionRef.current) {
      hasMountedSectionRef.current = true;
      return;
    }
    // Scroll handling is smoothly controlled by handleSwitchSection
  }, [showPreview]);

  // Modal zoom photo with Tap & Swipe + Description di Atas Foto
  const [zoomModalState, setZoomModalState] = useState<{
    isOpen: boolean;
    currentIndex: number;
    photos: EvidencePhoto[];
    isCa: boolean;
  }>({
    isOpen: false,
    currentIndex: 0,
    photos: [],
    isCa: false,
  });

  // Modal Edit Foto State
  const [editingPhotoState, setEditingPhotoState] = useState<{
    photoId: string;
    index: number;
    isCa: boolean;
    photoUrl: string;
    caption: string;
    rotation: number;
    originalPhoto: EvidencePhoto;
  } | null>(null);
  const editPhotoFileInputRef = useRef<HTMLInputElement>(null);

  // Swipe detection refs
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);

  const [showR23Modal, setShowR23Modal] = useState(false);

  // AI Loading state per observation card & Global compile
  const [aiLoadingIdx, setAiLoadingIdx] = useState<number | null>(null);
  const [isAiCompiling, setIsAiCompiling] = useState(false);

  // Automatic System GPS (1-50m Radius) & Offline Auto-Detection State
  const [isGpsRefreshing, setIsGpsRefreshing] = useState(false);
  const [liveDistanceMeters, setLiveDistanceMeters] = useState<number | undefined>(
    agenda.silentAudit?.inDistanceToStoreMeters
  );
  const [isWithin50mRadius, setIsWithin50mRadius] = useState<boolean>(() => {
    const dist = agenda.silentAudit?.inDistanceToStoreMeters;
    return dist !== undefined && dist >= 0 && dist <= STRICT_STORE_RADIUS_METERS;
  });
  const [isOfflineOrWeakSignal, setIsOfflineOrWeakSignal] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' && !navigator.onLine;
  });
  // Popup HANYA muncul jika sistem mendeteksi kondisi Offline (!navigator.onLine)
  const [showCheckInPopup, setShowCheckInPopup] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' && !navigator.onLine;
  });
  const [systemDetectedTimeStr, setSystemDetectedTimeStr] = useState<string>(() =>
    formatTimeWib(getTrustedNow().now)
  );

  // Upload status feedback
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);

  // Active Voice Dictation state
  const [activeVoiceKey, setActiveVoiceKey] = useState<string | null>(null);
  const activeRecognitionRef = useRef<any>(null);

  // Cross-Device Real-time Sync Timestamp Ref
  const lastSyncTimestampRef = useRef<number>((formData as any).updatedAtMs || 0);

  // Restore heavy photos from IndexedDB on mount & Cross-Device Real-time Hydration
  useEffect(() => {
    let mounted = true;

    // 1. Instant local restore from IndexedDB
    loadPhotosFromIdb(draftKey).then((cached) => {
      if (mounted && cached) {
        setFormData((prev) => ({
          ...prev,
          storeFrontPhoto: cached.storeFrontPhoto || prev.storeFrontPhoto,
          qscSheetPhoto: cached.qscSheetPhoto || cached.qscSheetTop || cached.qscSheetBottom || prev.qscSheetPhoto,
          qscSheetTop: cached.qscSheetTop || prev.qscSheetTop,
          qscSheetBottom: cached.qscSheetBottom || prev.qscSheetBottom,
          evidencePhotos:
            Array.isArray(cached.evidencePhotos) && cached.evidencePhotos.length > 0
              ? cached.evidencePhotos
              : prev.evidencePhotos,
          caPhotos:
            Array.isArray(cached.caPhotos) && cached.caPhotos.length > 0
              ? cached.caPhotos
              : prev.caPhotos,
        }));
      }
    });

    // 2. Fetch latest data from Cloud Vault (Cross-Device Continuity: Mobile -> Desktop)
    fetchVisitReportFromCloud(agenda.id, true).then((cloudReport) => {
      if (!mounted || !cloudReport) return;

      const remoteMs = cloudReport.updatedAtMs || 0;
      const localMs = lastSyncTimestampRef.current;

      const hasCloudData =
        (Array.isArray(cloudReport.observations) && cloudReport.observations.length > 0) ||
        (Array.isArray(cloudReport.evidencePhotos) && cloudReport.evidencePhotos.length > 0) ||
        Boolean(cloudReport.qscSheetPhoto || cloudReport.qscSheetTop || cloudReport.qscSheetBottom);

      if (remoteMs > localMs || hasCloudData) {
        lastSyncTimestampRef.current = remoteMs || Date.now();
        setFormData((prev) => ({
          ...prev,
          ...cloudReport,
          crews: Array.isArray(cloudReport.crews) && cloudReport.crews.length > 0 ? cloudReport.crews : prev.crews,
          observations: Array.isArray(cloudReport.observations) ? cloudReport.observations : prev.observations,
          evidencePhotos: Array.isArray(cloudReport.evidencePhotos) ? cloudReport.evidencePhotos : prev.evidencePhotos,
          caPhotos: Array.isArray(cloudReport.caPhotos) ? cloudReport.caPhotos : prev.caPhotos,
          storeFrontPhoto: cloudReport.storeFrontPhoto || prev.storeFrontPhoto,
          qscSheetPhoto: cloudReport.qscSheetPhoto || prev.qscSheetPhoto,
          qscSheetTop: cloudReport.qscSheetTop || prev.qscSheetTop,
          qscSheetBottom: cloudReport.qscSheetBottom || prev.qscSheetBottom,
          gasSyncStatus: 'synced',
        }));

        savePhotosToIdb(draftKey, {
          storeFrontPhoto: cloudReport.storeFrontPhoto,
          qscSheetPhoto: cloudReport.qscSheetPhoto,
          qscSheetTop: cloudReport.qscSheetTop,
          qscSheetBottom: cloudReport.qscSheetBottom,
          evidencePhotos: cloudReport.evidencePhotos,
          caPhotos: cloudReport.caPhotos,
        });
      }
    });

    // 3. Subscribe to Real-Time Cross-Device updates (0ms BroadcastChannel + 6s Cloud Heartbeat)
    const unsubscribeSync = subscribeToCrossDeviceVisit(
      agenda.id,
      () => lastSyncTimestampRef.current,
      (remoteReport) => {
        if (!mounted || !remoteReport) return;
        lastSyncTimestampRef.current = remoteReport.updatedAtMs || Date.now();
        setFormData((prev) => ({
          ...prev,
          ...remoteReport,
          crews: Array.isArray(remoteReport.crews) && remoteReport.crews.length > 0 ? remoteReport.crews : prev.crews,
          observations: Array.isArray(remoteReport.observations) ? remoteReport.observations : prev.observations,
          evidencePhotos: Array.isArray(remoteReport.evidencePhotos) ? remoteReport.evidencePhotos : prev.evidencePhotos,
          caPhotos: Array.isArray(remoteReport.caPhotos) ? remoteReport.caPhotos : prev.caPhotos,
          storeFrontPhoto: remoteReport.storeFrontPhoto || prev.storeFrontPhoto,
          qscSheetPhoto: remoteReport.qscSheetPhoto || prev.qscSheetPhoto,
          qscSheetTop: remoteReport.qscSheetTop || prev.qscSheetTop,
          qscSheetBottom: remoteReport.qscSheetBottom || prev.qscSheetBottom,
          gasSyncStatus: 'synced',
        }));

        savePhotosToIdb(draftKey, {
          storeFrontPhoto: remoteReport.storeFrontPhoto,
          qscSheetPhoto: remoteReport.qscSheetPhoto,
          qscSheetTop: remoteReport.qscSheetTop,
          qscSheetBottom: remoteReport.qscSheetBottom,
          evidencePhotos: remoteReport.evidencePhotos,
          caPhotos: remoteReport.caPhotos,
        });
      },
      6000
    );

    return () => {
      mounted = false;
      unsubscribeSync();
    };
  }, [agenda.id, draftKey]);

  // Monitor Online / Offline & Automatic System 1-50m Geofence Attendance
  useEffect(() => {
    const handleOnline = () => {
      setIsOfflineOrWeakSignal(false);
      setShowCheckInPopup(false);
      setFormData((prev) => ({
        ...prev,
        gasSyncStatus: prev.gasSyncStatus === 'offline-queued' ? 'synced' : prev.gasSyncStatus,
      }));
    };
    const handleOffline = () => {
      setIsOfflineOrWeakSignal(true);
      setSystemDetectedTimeStr(formatTimeWib(getTrustedNow().now));
      setShowCheckInPopup(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Automatic System Actual IN Recording (ONLY when user GPS is 1-50m from Store Coordinates)
  useEffect(() => {
    let active = true;
    const list = allAgendas.length > 0 ? allAgendas : [agenda];

    const evaluateAutoAttendance = async () => {
      const res = await performSilentActualCheckIn(agenda, list);
      if (!active) return;

      if (res.distanceMeters !== undefined) {
        setLiveDistanceMeters(res.distanceMeters);
      }
      setIsWithin50mRadius(res.withinRadius50m);
      setSystemDetectedTimeStr(formatTimeWib(getTrustedNow().now));

      if (res.recorded && res.withinRadius50m) {
        if (res.autoClosedPrevStore && onUpdateAgenda) {
          onUpdateAgenda(res.autoClosedPrevStore);
        }
        if (onUpdateAgenda) {
          onUpdateAgenda(res.updatedTarget);
        }
        setFormData((prev) => ({
          ...prev,
          actualIn: prev.actualIn || res.updatedTarget.actualIn || formatTimeWib(getTrustedNow().now),
          actualInSubmitted: true,
        }));
      }
    };

    evaluateAutoAttendance();

    const unsubscribe = subscribeSilentGpsUpdates(() => {
      evaluateAutoAttendance();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [agenda.id]);

  // Automatic System Actual OUT Recording when opening PDF Preview / finishing report (ONLY if within 1-50m)
  useEffect(() => {
    if (!showPreview) return;
    let active = true;
    const list = allAgendas.length > 0 ? allAgendas : [agenda];

    performSilentActualCheckOut(agenda, list).then((res) => {
      if (!active) return;
      if (res.distanceMeters !== undefined) {
        setLiveDistanceMeters(res.distanceMeters);
      }
      setIsWithin50mRadius(res.withinRadius50m);
      if (res.recorded && res.withinRadius50m) {
        if (onUpdateAgenda) {
          onUpdateAgenda(res.updatedTarget);
        }
        setFormData((prev) => ({
          ...prev,
          actualIn: prev.actualIn || res.updatedTarget.actualIn || '',
          actualOut: res.updatedTarget.actualOut || formatTimeWib(getTrustedNow().now),
          actualInSubmitted: true,
        }));
      }
    });

    return () => {
      active = false;
    };
  }, [showPreview]);

  // Scroll Detection for Smooth Floating Action Buttons & Top Navbar Auto-Hide
  const [isScrolled, setIsScrolled] = useState(false);
  const [showTopNavbar, setShowTopNavbar] = useState(true);
  const formScrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollYRef = useRef(0);
  const scrollDeltaAccRef = useRef(0);
  const manualExpandedRef = useRef(false);
  const manualExpandedScrollTopRef = useRef(0);

  const getScrollTop = () => {
    return Math.max(
      window.scrollY || 0,
      window.pageYOffset || 0,
      document.documentElement?.scrollTop || 0,
      document.body?.scrollTop || 0,
      formScrollContainerRef.current?.scrollTop || 0
    );
  };

  const handleResetScale = () => {
    setIsScrolled(false);
    setShowTopNavbar(true);
    manualExpandedRef.current = true;
    manualExpandedScrollTopRef.current = getScrollTop();
  };

  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = getScrollTop();
          const delta = currentY - lastScrollYRef.current;
          lastScrollYRef.current = currentY;

          // 1. Di paling atas halaman (<= 25px): reset
          if (currentY <= 25) {
            setShowTopNavbar(true);
            setIsScrolled(false);
            scrollDeltaAccRef.current = 0;
            manualExpandedRef.current = false;
            ticking = false;
            return;
          }

          // 2. Akumulasi delta untuk menyaring getaran micro touch / rubber-banding
          if ((delta > 0 && scrollDeltaAccRef.current < 0) || (delta < 0 && scrollDeltaAccRef.current > 0)) {
            scrollDeltaAccRef.current = delta;
          } else {
            scrollDeltaAccRef.current += delta;
          }

          // 3. Jika user menekan tombol bottom navbar saat mengecil -> pertahankan
          if (manualExpandedRef.current) {
            if (currentY > manualExpandedScrollTopRef.current + 16 || delta > 6) {
              manualExpandedRef.current = false;
              setShowTopNavbar(false);
              setIsScrolled((prev) => (prev ? prev : true));
            }
          }
          // 4. Scroll ke BAWAH: sembunyikan top navbar & action buttons
          else if (scrollDeltaAccRef.current > 35 && currentY > 60) {
            setShowTopNavbar(false);
            setIsScrolled((prev) => (prev ? prev : true));
          }
          // 5. Scroll ke ATAS: tampilkan kembali top navbar & action buttons
          else if (scrollDeltaAccRef.current < -16) {
            setShowTopNavbar(true);
            setIsScrolled((prev) => (!prev ? prev : false));
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    const container = formScrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', onScroll, { passive: true });
    }
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('touchmove', onScroll, { passive: true });
    window.addEventListener('wheel', onScroll, { passive: true });

    onScroll();

    return () => {
      if (container) {
        container.removeEventListener('scroll', onScroll);
      }
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('touchmove', onScroll);
      window.removeEventListener('wheel', onScroll);
    };
  }, []);

  // File Input References
  const qscSingleInputRef = useRef<HTMLInputElement>(null);
  const evidenceCameraInputRef = useRef<HTMLInputElement>(null);
  const evidenceGalleryInputRef = useRef<HTMLInputElement>(null);

  // Safe Auto-save draft + Real-time Cross-Device Cloud Sync
  useEffect(() => {
    // 1. Save full photos to IndexedDB (unlimited capacity)
    savePhotosToIdb(draftKey, {
      storeFrontPhoto: formData.storeFrontPhoto,
      qscSheetPhoto: formData.qscSheetPhoto,
      qscSheetTop: formData.qscSheetTop,
      qscSheetBottom: formData.qscSheetBottom,
      evidencePhotos: formData.evidencePhotos,
      caPhotos: formData.caPhotos,
    });

    // 2. Save formData to localStorage with safe fallback if quota is exceeded
    try {
      localStorage.setItem(draftKey, JSON.stringify(formData));
    } catch {
      try {
        const lightCopy: VisitReportData = {
          ...formData,
          storeFrontPhoto: formData.storeFrontPhoto ? '__IDB__' : '',
          qscSheetPhoto: formData.qscSheetPhoto ? '__IDB__' : '',
          qscSheetTop: formData.qscSheetTop ? '__IDB__' : '',
          qscSheetBottom: formData.qscSheetBottom ? '__IDB__' : '',
          evidencePhotos: formData.evidencePhotos.map((p) => ({ ...p, photoUrl: '' })),
          caPhotos: (formData.caPhotos || []).map((p) => ({ ...p, photoUrl: '' })),
        };
        localStorage.setItem(draftKey, JSON.stringify(lightCopy));
      } catch (innerErr) {
        console.warn('LocalStorage quota full, using IndexedDB:', innerErr);
      }
    }

    // 3. Debounced Cloud Push (1.8s) for Cross-Device Continuity (Mobile <-> Desktop)
    const syncTimer = setTimeout(() => {
      lastSyncTimestampRef.current = Date.now();
      pushVisitReportToCloud(formData).then((ok) => {
        if (ok) {
          setFormData((prev) => ({
            ...prev,
            gasSyncStatus: 'synced',
            lastSyncedAt: getCurrentWibTime(),
          }));
        }
      });
    }, 1800);

    return () => clearTimeout(syncTimer);
  }, [formData, draftKey]);

  // Calculate Form Completion Progress Percentage
  const calculateProgress = (): number => {
    let score = 0;
    const total = 6;
    if (formData.storeName && formData.storeCode) score++;
    if (formData.crews.length >= 2) score++;
    if (formData.qscSheetPhoto || formData.qscSheetTop || formData.qscSheetBottom) score++;
    if (formData.observations.length > 0 && formData.observations[0].auditFinding) score++;
    if (formData.evidencePhotos.length > 0) score++;
    if (formData.spreadsheetUrl) score++;
    return Math.round((score / total) * 100);
  };

  const progressPercent = calculateProgress();

  // Helper: Refresh Automatic System Geofence Check (1-50m Radius)
  const handleRefreshGps = async () => {
    setIsGpsRefreshing(true);
    try {
      const list = allAgendas.length > 0 ? allAgendas : [agenda];
      const res = await performSilentActualCheckIn(agenda, list);
      if (res.distanceMeters !== undefined) {
        setLiveDistanceMeters(res.distanceMeters);
      }
      setIsWithin50mRadius(res.withinRadius50m);
      setSystemDetectedTimeStr(formatTimeWib(getTrustedNow().now));

      if (res.recorded && res.withinRadius50m) {
        if (res.autoClosedPrevStore && onUpdateAgenda) {
          onUpdateAgenda(res.autoClosedPrevStore);
        }
        if (onUpdateAgenda) {
          onUpdateAgenda(res.updatedTarget);
        }
        setFormData((prev) => ({
          ...prev,
          actualIn: prev.actualIn || res.updatedTarget.actualIn || formatTimeWib(getTrustedNow().now),
          actualInSubmitted: true,
        }));
      }
    } finally {
      setIsGpsRefreshing(false);
    }
  };

  // Confirm Offline System Auto-Detected Attendance (Zero Free-Text Input, 1-50m Radius Verified)
  const handleConfirmOfflineSystemAttendance = async () => {
    setSystemDetectedTimeStr(formatTimeWib(getTrustedNow().now));
    try {
      const list = allAgendas.length > 0 ? allAgendas : [agenda];
      const res = await performSilentActualCheckIn(agenda, list);
      if (res.distanceMeters !== undefined) {
        setLiveDistanceMeters(res.distanceMeters);
      }
      setIsWithin50mRadius(res.withinRadius50m);

      if (res.recorded && res.withinRadius50m) {
        if (res.autoClosedPrevStore && onUpdateAgenda) {
          onUpdateAgenda(res.autoClosedPrevStore);
        }
        if (onUpdateAgenda) {
          onUpdateAgenda(res.updatedTarget);
        }
        setFormData((prev) => ({
          ...prev,
          actualIn: prev.actualIn || res.updatedTarget.actualIn || formatTimeWib(getTrustedNow().now),
          actualInSubmitted: true,
          isManualCheckIn: false,
        }));
      }
    } catch {
      // Silent catch
    } finally {
      setShowCheckInPopup(false);
    }
  };

  // Helper: Resize & Compress Image Clean (Tanpa Watermark untuk rawPhotoUrl)
  const compressImageClean = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      const cleanup = () => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {}
      };

      img.onload = () => {
        try {
          let w = img.naturalWidth || img.width || 1200;
          let h = img.naturalHeight || img.height || 900;
          const maxDim = 1024;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            cleanup();
            return reject(new Error('Canvas context unavailable'));
          }

          ctx.drawImage(img, 0, 0, w, h);
          const cleanUrl = canvas.toDataURL('image/jpeg', 0.78);
          cleanup();
          resolve(cleanUrl);
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      img.onerror = () => {
        cleanup();
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (typeof ev.target?.result === 'string') {
            resolve(ev.target.result);
          } else {
            reject(new Error('Gagal membaca file gambar'));
          }
        };
        reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
        reader.readAsDataURL(file);
      };

      img.src = objectUrl;
    });
  };

  // Helper: Stamp Floating Minimalist Timestamp Watermark TANPA Background Bar (NO fillRect)
  const stampMinimalistTimestamp = async (cleanBase64Url: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const w = img.naturalWidth || img.width || 1200;
          const h = img.naturalHeight || img.height || 900;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(cleanBase64Url);

          ctx.drawImage(img, 0, 0, w, h);

          // Timestamp & Verified Store Info Minimalist Floating Text (No Black Box)
          const now = new Date();
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
          const timeStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
          const statusStr = 'Check-In Verified';
          const textStr = `${(formData.storeName || 'STORE').toUpperCase()} (${formData.storeCode || '-'})  •  ${timeStr}  •  ${statusStr}`;

          const fontSize = Math.max(11, Math.round(h * 0.024));
          const padX = Math.max(14, Math.round(w * 0.022));
          const padY = Math.max(16, Math.round(h * 0.028));

          ctx.save();
          ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
          ctx.shadowBlur = Math.max(4, Math.round(fontSize * 0.45));
          ctx.shadowOffsetX = 1.5;
          ctx.shadowOffsetY = 1.5;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(textStr, padX, h - padY);
          ctx.restore();

          resolve(canvas.toDataURL('image/jpeg', 0.78));
        } catch (err) {
          console.warn('stampMinimalistTimestamp error:', err);
          resolve(cleanBase64Url);
        }
      };
      img.onerror = () => resolve(cleanBase64Url);
      img.src = cleanBase64Url;
    });
  };

  // Helper: Process and return both Clean (Raw) and Minimalist Stamped versions
  const processAndStampImage = async (file: File): Promise<{ stamped: string; raw: string }> => {
    const raw = await compressImageClean(file);
    const stamped = await stampMinimalistTimestamp(raw);
    return { stamped, raw };
  };

  // Helper: Auto-split a single full QSC sheet image into Top and Bottom halves (50% / 50%)
  const splitImageIntoTopAndBottom = (
    base64Url: string
  ): Promise<{ top: string; bottom: string }> => {
    return new Promise((resolve) => {
      if (!base64Url || !base64Url.startsWith('data:image')) {
        resolve({ top: '', bottom: '' });
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;

          // Split horizontal tepat di tengah 50%/50% dengan overlap tipis 1.5% untuk kontinuitas baris tabel
          const halfH = Math.floor(h / 2);
          const overlap = Math.min(Math.floor(h * 0.015), 25);

          // Top Canvas
          const topCanvas = document.createElement('canvas');
          topCanvas.width = w;
          topCanvas.height = halfH + overlap;
          const topCtx = topCanvas.getContext('2d');
          if (topCtx) {
            topCtx.drawImage(
              img,
              0, 0, w, halfH + overlap, // source
              0, 0, w, halfH + overlap  // destination
            );
          }

          // Bottom Canvas
          const bottomCanvas = document.createElement('canvas');
          bottomCanvas.width = w;
          const sy = Math.max(0, halfH - overlap);
          const sh = h - sy;
          bottomCanvas.height = sh;
          const bottomCtx = bottomCanvas.getContext('2d');
          if (bottomCtx) {
            bottomCtx.drawImage(
              img,
              0, sy, w, sh, // source
              0, 0, w, sh  // destination
            );
          }

          const topBase64 = topCanvas.toDataURL('image/jpeg', 0.80);
          const bottomBase64 = bottomCanvas.toDataURL('image/jpeg', 0.80);

          resolve({ top: topBase64, bottom: bottomBase64 });
        } catch (err) {
          console.warn('splitImageIntoTopAndBottom error:', err);
          resolve({ top: base64Url, bottom: base64Url });
        }
      };
      img.onerror = () => {
        resolve({ top: base64Url, bottom: base64Url });
      };
      img.src = base64Url;
    });
  };

  // 1x Single QSC Sheet Upload Handler with Auto Split into Top and Bottom halves
  const handleSingleQscUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsUploadingPhoto(true);
    setUploadStatusMsg('Menyimpan Lembar QSC & Membagi Otomatis (Auto-Split Atas/Bawah)...');

    try {
      const { stamped: fullStamped } = await processAndStampImage(file);
      const { top: topSplit, bottom: bottomSplit } = await splitImageIntoTopAndBottom(fullStamped);

      const nextReport: VisitReportData = {
        ...formData,
        qscSheetPhoto: fullStamped,
        qscSheetTop: topSplit,
        qscSheetBottom: bottomSplit,
        gasSyncStatus: 'syncing',
      };
      setFormData(nextReport);
      lastSyncTimestampRef.current = Date.now();
      pushVisitReportToCloud(nextReport);

      // Async upload full photo to Google Drive
      uploadPhotoToGasGDrive({
        base64Data: fullStamped,
        filename: `LEMBAR_QSC_${formData.storeCode}_${formData.visitDate}.jpg`,
        storeCode: formData.storeCode,
        storeName: formData.storeName,
        visitorName: formData.visitorName,
        visitDate: formData.visitDate,
        section: 'QSC_SHEET',
      }).then((uploadRes) => {
        setFormData((prev) => ({
          ...prev,
          qscDriveUrl: uploadRes.driveUrl,
          qscTopDriveUrl: uploadRes.driveUrl,
          qscBottomDriveUrl: uploadRes.driveUrl,
          gasSyncStatus: uploadRes.synced ? 'synced' : 'offline-queued',
          lastSyncedAt: getCurrentWibTime(),
        }));
      }).catch(console.warn);

      setUploadStatusMsg('Foto Lembar QSC berhasil diunggah & otomatis di-split!');
      setTimeout(() => setUploadStatusMsg(null), 3500);
      confetti({ zIndex: 9999999, particleCount: 35, spread: 50, origin: { y: 0.5 } });
    } catch (err) {
      console.error('QSC Upload & Auto-Split Error:', err);
      setUploadStatusMsg('Gagal memproses gambar. Silakan coba foto lainnya.');
      setTimeout(() => setUploadStatusMsg(null), 3500);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDeleteQsc = () => {
    if (confirm('Hapus foto lembar QSC ini?')) {
      setFormData((prev) => {
        const nextReport = {
          ...prev,
          qscSheetPhoto: '',
          qscSheetTop: '',
          qscSheetBottom: '',
          qscDriveUrl: '',
          qscTopDriveUrl: '',
          qscBottomDriveUrl: '',
        };
        lastSyncTimestampRef.current = Date.now();
        pushVisitReportToCloud(nextReport);
        return nextReport;
      });
    }
  };

  // Crew Management
  const handleAddCrew = () => {
    const nextNum = Math.max(1, formData.crews.length - 1);
    const newCrew: StoreCrew = {
      id: `c-${Date.now()}`,
      role: `Crew Store ${nextNum}`,
      name: '',
      jobLevel: '',
    };
    setFormData((prev) => ({ ...prev, crews: [...prev.crews, newCrew] }));
  };

  const handleUpdateCrew = (idx: number, field: keyof StoreCrew, val: string) => {
    const updated = [...formData.crews];
    updated[idx] = { ...updated[idx], [field]: val };
    setFormData((prev) => ({ ...prev, crews: updated }));
  };

  const handleRemoveCrew = (idx: number) => {
    if (idx < 2) return; // Keep Store Head & Shift Leader
    const updated = formData.crews.filter((_, i) => i !== idx);
    setFormData((prev) => ({ ...prev, crews: updated }));
  };

  // Observations Management
  const handleAddObservation = (type: 'QSC' | 'OPI') => {
    const newId = `obs-${Date.now()}`;
    const newObs: ObservationFinding = {
      id: newId,
      type,
      category: type === 'QSC' ? 'Lingkungan Store' : 'OPI Project',
      title: type === 'QSC' ? 'Temuan QSC Baru' : 'Temuan OPI Project',
      auditFinding: '',
      operationalImpact: '',
      idealCondition: '',
      actionPlan: '',
      rootCause: '',
      expectedResult: 'Akan dimonitoring pada visit berikutnya',
      deadline: agenda.date || new Date().toISOString().split('T')[0],
      status: 'OPEN',
    };

    setFormData((prev) => {
      const updated = [...prev.observations, newObs];
      const nextReport = { ...prev, observations: updated };
      lastSyncTimestampRef.current = Date.now();
      pushVisitReportToCloud(nextReport);
      const filtered = updated.filter((o) => o.type.toUpperCase() === type);
      setTimeout(() => {
        setActiveObsIdx(Math.max(0, filtered.length - 1));
        const el = obsCardRefs.current[newId];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 80);
      return nextReport;
    });
  };

  const handleJumpToObsCard = (targetIdx: number, obsList: ObservationFinding[]) => {
    if (obsList.length === 0) return;
    const boundedIdx = Math.max(0, Math.min(targetIdx, obsList.length - 1));
    setActiveObsIdx(boundedIdx);
    const targetObs = obsList[boundedIdx];
    if (targetObs) {
      const el = obsCardRefs.current[targetObs.id];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleUpdateObs = (id: string, field: keyof ObservationFinding, val: string) => {
    setFormData((prev) => ({
      ...prev,
      observations: prev.observations.map((o) => (o.id === id ? { ...o, [field]: val } : o)),
    }));
  };

  const handleRemoveObs = (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus kartu temuan ini?')) {
      setFormData((prev) => {
        const nextReport = {
          ...prev,
          observations: prev.observations.filter((o) => o.id !== id),
        };
        lastSyncTimestampRef.current = Date.now();
        pushVisitReportToCloud(nextReport);
        return nextReport;
      });
      setActiveObsIdx((prevIdx) => Math.max(0, prevIdx - 1));
    }
  };

  // Apply Preset Template to an Observation Card
  const handleApplyPreset = (obsId: string, presetId: string) => {
    const preset = FINDING_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setFormData((prev) => {
      const nextReport = {
        ...prev,
        observations: prev.observations.map((o) =>
          o.id === obsId
            ? {
                ...o,
                category: preset.category,
                auditFinding: preset.temuan,
                idealCondition: preset.kondisiIdeal,
                rootCause: preset.penyebab,
                operationalImpact: preset.dampak,
                actionPlan: preset.tindakanPerbaikan,
                expectedResult: preset.hasil,
              }
            : o
        ),
      };
      lastSyncTimestampRef.current = Date.now();
      pushVisitReportToCloud(nextReport);
      return nextReport;
    });
  };

  // AI Auto-Isi (T.A.R.O AI) MURNI Menggunakan Hasil Analisa API Key
  // Aturan Wajib: Jika kolom temuan belum diisi, AI TIDAK memproses
  const handleAiAutoFill = async (obsIdx: number, obs: ObservationFinding) => {
    const sourceText = obs.auditFinding?.trim() || '';

    if (!sourceText) {
      alert('Kolom temuan wajib diisi terlebih dahulu sebelum AI dapat menganalisa.');
      return;
    }

    setAiLoadingIdx(obsIdx);

    try {
      const aiResult = await generateTaroObservationAnalysis(
        sourceText,
        (obs.type?.toUpperCase() === 'OPI' ? 'OPI' : 'QSC') as 'QSC' | 'OPI'
      );

      if (aiResult) {
        setFormData((prev) => ({
          ...prev,
          observations: prev.observations.map((o) =>
            o.id === obs.id
              ? {
                  ...o,
                  category: aiResult.category || o.category,
                  idealCondition: aiResult.idealCondition,
                  operationalImpact: aiResult.operationalImpact,
                  rootCause: aiResult.rootCause,
                  actionPlan: aiResult.actionPlan,
                  expectedResult: aiResult.expectedResult,
                }
              : o
          ),
        }));

        confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
      } else {
        alert('Analisa AI gagal mendapatkan respon dari API Key. Silakan periksa koneksi internet atau coba beberapa saat lagi.');
      }
    } catch (err) {
      console.warn('TARO AI online analysis failed:', err);
      alert('Analisa AI gagal menghubungi server. Silakan periksa koneksi internet Anda.');
    } finally {
      setAiLoadingIdx(null);
    }
  };

  // Global T.A.R.O AI Auto-Compile: HANYA MENGGUNAKAN HASIL ANALISA API KEY DARI DESKRIPSI FOTO SECTION BUKTI
  const handleTaroAiAutoCompile = async () => {
    const validEvidences = formData.evidencePhotos.filter(
      (p) => p.caption && p.caption.trim().length > 0
    );

    if (validEvidences.length === 0) {
      alert(
        'Belum ada deskripsi foto di Section Bukti. Tambahkan foto & tuliskan deskripsi temuan di Section Bukti terlebih dahulu agar TARO AI dapat menganalisanya.'
      );
      return;
    }

    setIsAiCompiling(true);

    try {
      const newObservations: ObservationFinding[] = [];

      for (let i = 0; i < validEvidences.length; i++) {
        const ev = validEvidences[i];
        const aiResult = await generateTaroObservationAnalysis(ev.caption.trim(), 'QSC');

        if (aiResult) {
          newObservations.push({
            id: `obs-${Date.now()}-${i}`,
            type: 'QSC',
            category: aiResult.category || 'Food Safety',
            title: ev.caption.trim().slice(0, 45) || `Temuan Bukti #${i + 1}`,
            auditFinding: ev.caption.trim(),
            idealCondition: aiResult.idealCondition,
            operationalImpact: aiResult.operationalImpact,
            rootCause: aiResult.rootCause,
            actionPlan: aiResult.actionPlan,
            expectedResult: aiResult.expectedResult,
            deadline: agenda.date || new Date().toISOString().split('T')[0],
            status: 'OPEN',
          });
        }
      }

      if (newObservations.length > 0) {
        setFormData((prev) => ({
          ...prev,
          enableQsc: true,
          observations: [...newObservations, ...prev.observations],
        }));
        confetti({ particleCount: 45, spread: 60, origin: { y: 0.6 } });
      } else {
        alert('Analisa AI gagal mendapatkan respon dari API Key. Silakan periksa koneksi internet atau coba kembali.');
      }
    } catch (err) {
      console.error('TARO AI Analysis Error:', err);
      alert('Terjadi kendala saat menganalisa foto bukti dengan TARO AI.');
    } finally {
      setIsAiCompiling(false);
    }
  };

  // Evidence Photos Management (Instant Attach First + Local Storage + Background GDrive Sync)
  const handleAddEvidencePhoto = async (e: React.ChangeEvent<HTMLInputElement>, isCa = false) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files: File[] = Array.from(fileList);
    e.target.value = '';

    try {
      const createdPhotos: EvidencePhoto[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { stamped } = await processAndStampImage(file);
        const photoId = `ev-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`;

        createdPhotos.push({
          id: photoId,
          photoUrl: stamped,
          caption: '', // DEFAULT KOSONG SESUAI PERMINTAAN USER!
          timestamp: getCurrentWibTime(),
          gpsLocation: formData.liveGps || 'Verified',
          isCa,
        });
      }

      // 1. INSTANT ATTACH KE FORM DATA & IMMEDIATE CROSS-DEVICE SYNC
      const nextReport: VisitReportData = {
        ...formData,
        ...(isCa
          ? { caPhotos: [...(formData.caPhotos || []), ...createdPhotos] }
          : { evidencePhotos: [...formData.evidencePhotos, ...createdPhotos] }),
      };
      setFormData(nextReport);
      lastSyncTimestampRef.current = Date.now();
      pushVisitReportToCloud(nextReport);

      setUploadStatusMsg(`${createdPhotos.length} foto berhasil ter-attach ke form visit & tersinkron!`);
      setTimeout(() => setUploadStatusMsg(null), 3000);
      confetti({ particleCount: 25, spread: 45, origin: { y: 0.6 } });

      // 2. BACKGROUND SYNC KE GDRIVE SECARA ASINKRON (FIRST LOCAL STORAGE JIKA GAGAL/OFFLINE)
      (async () => {
        try {
          for (let i = 0; i < createdPhotos.length; i++) {
            const p = createdPhotos[i];
            const filename = `${isCa ? 'CA' : 'EVIDENCE'}_${formData.storeCode}_${formData.visitDate}_${Date.now()}_${i + 1}.jpg`;
            const gdriveRes = await uploadPhotoToGasGDrive({
              base64Data: p.photoUrl,
              filename,
              storeCode: formData.storeCode,
              storeName: formData.storeName,
              visitorName: formData.visitorName,
              visitDate: formData.visitDate,
              section: isCa ? 'CORRECTIVE_ACTION' : 'EVIDENCE_FINDING',
            });

            if (gdriveRes.synced) {
              if (isCa) {
                setFormData((prev) => ({
                  ...prev,
                  caPhotos: prev.caPhotos?.map((cp) =>
                    cp.id === p.id
                      ? { ...cp, driveFileId: gdriveRes.driveFileId, driveUrl: gdriveRes.driveUrl }
                      : cp
                  ),
                  gasSyncStatus: 'synced',
                  lastSyncedAt: getCurrentWibTime(),
                }));
              } else {
                setFormData((prev) => ({
                  ...prev,
                  evidencePhotos: prev.evidencePhotos.map((ep) =>
                    ep.id === p.id
                      ? { ...ep, driveFileId: gdriveRes.driveFileId, driveUrl: gdriveRes.driveUrl }
                      : ep
                  ),
                  gasSyncStatus: 'synced',
                  lastSyncedAt: getCurrentWibTime(),
                }));
              }
            }
          }
        } catch (bgErr) {
          console.warn('Background GDrive sync queued (saved in local storage):', bgErr);
        }
      })();
    } catch (err) {
      console.error('Evidence Photo Attach Error:', err);
      setUploadStatusMsg('Gagal memproses beberapa gambar.');
      setTimeout(() => setUploadStatusMsg(null), 3000);
    }
  };

  const handleUpdateEvidenceCaption = (id: string, caption: string, isCa = false) => {
    if (isCa) {
      setFormData((prev) => ({
        ...prev,
        caPhotos: prev.caPhotos?.map((p) => (p.id === id ? { ...p, caption } : p)),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        evidencePhotos: prev.evidencePhotos.map((p) => (p.id === id ? { ...p, caption } : p)),
      }));
    }
  };

  const handleRemoveEvidencePhoto = (id: string, isCa = false) => {
    setFormData((prev) => {
      const nextReport: VisitReportData = {
        ...prev,
        ...(isCa
          ? { caPhotos: (prev.caPhotos || []).filter((p) => p.id !== id) }
          : { evidencePhotos: prev.evidencePhotos.filter((p) => p.id !== id) }),
      };
      lastSyncTimestampRef.current = Date.now();
      pushVisitReportToCloud(nextReport);
      return nextReport;
    });
  };

  // Helper to rotate image base64 on client canvas
  const rotateImageBase64 = (base64Url: string, degrees: number): Promise<string> => {
    return new Promise((resolve) => {
      if (degrees % 360 === 0) return resolve(base64Url);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const rad = (degrees * Math.PI) / 180;
        const is90or270 = Math.abs(degrees) % 180 === 90;
        canvas.width = is90or270 ? img.height : img.width;
        canvas.height = is90or270 ? img.width : img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64Url);
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        resolve(canvas.toDataURL('image/jpeg', 0.90));
      };
      img.onerror = () => resolve(base64Url);
      img.src = base64Url;
    });
  };

  const handleOpenEditPhotoModal = (photo: EvidencePhoto, index: number, isCa: boolean) => {
    setEditingPhotoState({
      photoId: photo.id,
      index,
      isCa,
      photoUrl: photo.rawPhotoUrl || photo.photoUrl,
      caption: photo.caption || '',
      rotation: 0,
      originalPhoto: photo,
    });
  };

  const handleRotateEditingPhoto = () => {
    setEditingPhotoState((prev) => {
      if (!prev) return null;
      return { ...prev, rotation: (prev.rotation + 90) % 360 };
    });
  };

  const handleReplaceEditingPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingPhotoState) return;
    e.target.value = '';
    try {
      const { stamped, raw } = await processAndStampImage(file);
      setEditingPhotoState((prev) =>
        prev
          ? {
              ...prev,
              photoUrl: stamped,
              originalPhoto: {
                ...prev.originalPhoto,
                rawPhotoUrl: raw,
                photoUrl: stamped,
              },
              rotation: 0,
            }
          : null
      );
    } catch (err) {
      console.warn('Gagal memproses foto baru:', err);
    }
  };

  const handleSavePhotoFromModal = async (updated: { photoUrl: string; caption: string }) => {
    if (!editingPhotoState) return;

    // updated.photoUrl adalah foto bersih hasil editan (crop/markup/rotate) tanpa watermark
    const rawClean = updated.photoUrl;
    const stamped = await stampMinimalistTimestamp(rawClean);

    if (editingPhotoState.isCa) {
      setFormData((prev) => {
        const nextReport: VisitReportData = {
          ...prev,
          caPhotos: (prev.caPhotos || []).map((p) =>
            p.id === editingPhotoState.photoId
              ? { ...p, photoUrl: stamped, caption: updated.caption }
              : p
          ),
        };
        lastSyncTimestampRef.current = Date.now();
        pushVisitReportToCloud(nextReport);
        return nextReport;
      });
    } else {
      setFormData((prev) => {
        const nextReport: VisitReportData = {
          ...prev,
          evidencePhotos: prev.evidencePhotos.map((p) =>
            p.id === editingPhotoState.photoId
              ? { ...p, photoUrl: stamped, caption: updated.caption }
              : p
          ),
        };
        lastSyncTimestampRef.current = Date.now();
        pushVisitReportToCloud(nextReport);
        return nextReport;
      });
    }

    // Also update zoom modal state if open
    setZoomModalState((prev) => {
      if (!prev.isOpen) return prev;
      return {
        ...prev,
        photos: prev.photos.map((p) =>
          p.id === editingPhotoState.photoId
            ? { ...p, photoUrl: stamped, rawPhotoUrl: rawClean, caption: updated.caption }
            : p
        ),
      };
    });

    setEditingPhotoState(null);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
  };

  const handleOpenZoomPhoto = (idx: number, isCa: boolean) => {
    const list = isCa ? (formData.caPhotos || []) : formData.evidencePhotos;
    setZoomModalState({
      isOpen: true,
      currentIndex: idx,
      photos: list,
      isCa,
    });
  };

  const handleOpenSinglePhotoZoom = (url: string, title: string) => {
    setZoomModalState({
      isOpen: true,
      currentIndex: 0,
      photos: [
        {
          id: 'single-preview',
          photoUrl: url,
          caption: title,
          timestamp: formData.visitDate || '',
          gpsLocation: formData.storeName || '',
        },
      ],
      isCa: false,
    });
  };

  const handleCloseZoomModal = () => {
    setZoomModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const handlePrevZoomPhoto = () => {
    setZoomModalState((prev) => {
      if (!prev.isOpen || prev.photos.length <= 1) return prev;
      const nextIdx = prev.currentIndex > 0 ? prev.currentIndex - 1 : prev.photos.length - 1;
      return { ...prev, currentIndex: nextIdx };
    });
  };

  const handleNextZoomPhoto = () => {
    setZoomModalState((prev) => {
      if (!prev.isOpen || prev.photos.length <= 1) return prev;
      const nextIdx = prev.currentIndex < prev.photos.length - 1 ? prev.currentIndex + 1 : 0;
      return { ...prev, currentIndex: nextIdx };
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        handleNextZoomPhoto();
      } else {
        handlePrevZoomPhoto();
      }
    }
  };

  // Keyboard navigation for Zoom Modal
  useEffect(() => {
    if (!zoomModalState.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevZoomPhoto();
      } else if (e.key === 'ArrowRight') {
        handleNextZoomPhoto();
      } else if (e.key === 'Escape') {
        handleCloseZoomModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomModalState.isOpen]);

  // Functional Voice Dictation Helper (Active Toggle + Indonesian Speech Recognition + Fallback)
  const handleToggleVoiceDictation = (voiceKey: string, currentVal: string, onAppend: (newText: string) => void) => {
    // If already listening on this key, stop it
    if (activeVoiceKey === voiceKey && activeRecognitionRef.current) {
      try {
        activeRecognitionRef.current.stop();
      } catch {
        // ignore
      }
      setActiveVoiceKey(null);
      return;
    }

    // Stop any previous session
    if (activeRecognitionRef.current) {
      try {
        activeRecognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Fallback interactive prompt when browser WebView blocks Speech API
      const manualVoiceText = window.prompt(
        'Mikrofon Browser memerlukan input langsung. Ketik atau gunakan mikrofon keyboard HP Anda untuk dikte cepat:',
        ''
      );
      if (manualVoiceText && manualVoiceText.trim()) {
        const merged = (currentVal ? currentVal.trim() + ' ' : '') + manualVoiceText.trim();
        onAppend(merged);
      }
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      activeRecognitionRef.current = recognition;
      recognition.lang = 'id-ID';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setActiveVoiceKey(voiceKey);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results || [])
          .map((r: any) => r[0]?.transcript || '')
          .join(' ')
          .trim();
        if (transcript) {
          const merged = (currentVal ? currentVal.trim() + ' ' : '') + transcript;
          onAppend(merged);
        }
      };

      recognition.onerror = () => {
        setActiveVoiceKey(null);
        const fallbackText = window.prompt(
          'Izin mikrofon tidak tersedia di perangkat ini. Gunakan tombol mikrofon pada keyboard Anda di bawah ini:',
          ''
        );
        if (fallbackText && fallbackText.trim()) {
          const merged = (currentVal ? currentVal.trim() + ' ' : '') + fallbackText.trim();
          onAppend(merged);
        }
      };

      recognition.onend = () => {
        setActiveVoiceKey(null);
      };

      recognition.start();
    } catch {
      setActiveVoiceKey(null);
    }
  };

  // If in PDF Preview mode, render VisitPdfPreview
  if (showPreview) {
    return (
      <>
        <PageTransitionLoader visible={isSectionTransitioning} />
        <VisitPdfPreview data={formData} onBack={() => setShowPreview(false)} />
      </>
    );
  }

  // Filter observations for current active sub-tab (QSC or OPI)
  const currentObsList = formData.observations.filter(
    (o) => o.type.toUpperCase() === obsSubTab.toUpperCase()
  );
  const isCurrentObsSubTabEnabled =
    obsSubTab === 'qsc' ? formData.enableQsc !== false : formData.enableOpi !== false;

  return (
    <div
      ref={formScrollContainerRef}
      className="flex flex-col min-h-screen bg-[#F8F9FD] select-none px-4 sm:px-6 pt-20 pb-36 max-w-6xl mx-auto w-full relative"
    >
      {/* Section / Sub-Tab Blur + Silhouette + Mini "FMCU....." Bouncing Loader */}
      <PageTransitionLoader visible={isSectionTransitioning} />
      {/* =====================================================================
          OFFLINE SYSTEM AUTO-DETECTION POPUP
          - HANYA muncul jika terdeteksi Offline oleh sistem (!navigator.onLine)
          - TIDAK ADA input free-text / manual time picker (100% Detect by System)
          - Record Actual hanya terekam jika radius GPS user 1-50m dari koordinat toko
          ===================================================================== */}
      {showCheckInPopup && isOfflineOrWeakSignal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md shrink-0">
                  <WifiOff className="w-6 h-6" />
                </div>
                <div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                    Terdeteksi Offline oleh Sistem
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                    Deteksi Otomatis IN / OUT
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckInPopup(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Toko Tujuan:</span>
                <span className="font-black text-slate-900">
                  {formData.storeName} ({formData.storeCode})
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Visitor:</span>
                <span className="font-bold text-teal-700">{formData.visitorName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Validasi Radius Toko (1–50m):</span>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                    isWithin50mRadius
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}
                >
                  {isWithin50mRadius
                    ? `Terverifikasi (${liveDistanceMeters ?? 0}m ≤ 50m)`
                    : liveDistanceMeters !== undefined
                    ? `Di Luar Radius (${liveDistanceMeters}m > 50m)`
                    : 'Menunggu Sensor Radius 1–50m'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/90 text-[11px] font-bold text-amber-900 leading-relaxed">
              Perangkat terdeteksi sedang <strong>Offline</strong>. Seluruh perekaman <strong>Actual IN / OUT</strong> dikunci dan dideteksi otomatis oleh sistem (tanpa input manual) apabila posisi berada dalam <strong>radius 1–50m</strong> dari titik koordinat toko.
            </div>

            {/* Read-Only System-Detected Timestamps (No Free-Text / No Manual Time Input) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                <span className="text-[10px] font-black text-emerald-800 uppercase block">
                  Actual IN (By System)
                </span>
                <span className="text-sm font-black text-slate-900 block mt-1">
                  {formData.actualIn ||
                    (isWithin50mRadius ? systemDetectedTimeStr : 'Menunggu Radius 1–50m')}
                </span>
                <span className="text-[9.5px] text-emerald-700 font-semibold block mt-0.5">
                  Terkunci Otomatis Sistem
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200">
                <span className="text-[10px] font-black text-amber-800 uppercase block">
                  Actual OUT (By System)
                </span>
                <span className="text-sm font-black text-slate-900 block mt-1">
                  {formData.actualOut || 'Otomatis Saat Selesai'}
                </span>
                <span className="text-[9.5px] text-amber-700 font-semibold block mt-0.5">
                  Radius 1–50m Koordinat Toko
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmOfflineSystemAttendance}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-black text-xs sm:text-sm shadow-lg transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>LANJUTKAN DENGAN DETEKSI OTOMATIS SISTEM</span>
            </button>
          </div>
        </div>
      )}

      {/* Zoom Photo Lightbox Modal with Tap & Swipe Navigation + Description di ATAS Foto */}
      {zoomModalState.isOpen && zoomModalState.photos[zoomModalState.currentIndex] && (() => {
        const activePhoto = zoomModalState.photos[zoomModalState.currentIndex];
        return (
          <div
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-5 animate-in fade-in select-none"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* TOP BAR & PHOTO DESCRIPTION (DI ATAS FOTO) */}
            <div className="w-full max-w-4xl z-10 flex flex-col gap-2 shrink-0">
              {/* Header: Photo Counter & Close */}
              <div className="flex items-center justify-between text-white pb-1">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-xs font-black">
                    Foto {zoomModalState.currentIndex + 1} dari {zoomModalState.photos.length}
                  </span>
                  <span className="text-xs font-bold text-slate-300">
                    {zoomModalState.isCa ? 'Hasil Perbaikan (CA)' : 'Bukti Temuan Operasional'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenEditPhotoModal(
                        activePhoto,
                        zoomModalState.currentIndex,
                        zoomModalState.isCa
                      );
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-extrabold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                    title="Edit Foto Ini"
                  >
                    <Pencil className="w-3.5 h-3.5 text-teal-300" />
                    <span className="hidden sm:inline">Edit Foto</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseZoomModal}
                    className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold transition active:scale-95 cursor-pointer"
                    title="Tutup (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Description Card directly ABOVE the photo */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/20 text-white shadow-2xl">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-teal-300 mb-1">
                  <span>Deskripsi Temuan Lapangan</span>
                  <span className="text-slate-400 font-semibold">
                    {activePhoto.timestamp || ''} • {activePhoto.gpsLocation || 'GPS Verified'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-100 leading-snug break-words">
                  {activePhoto.caption || 'Tidak ada deskripsi untuk foto ini.'}
                </p>
              </div>
            </div>

            {/* CENTER: IMAGE VIEWER WITH TAP NAVIGATION & TOUCH SWIPE */}
            <div className="relative flex-1 w-full max-w-4xl flex items-center justify-center min-h-0 my-2">
              {/* Left Tap Zone & Chevron */}
              {zoomModalState.photos.length > 1 && (
                <button
                  type="button"
                  onClick={handlePrevZoomPhoto}
                  className="absolute left-2 sm:left-4 z-20 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center transition active:scale-90 border border-white/20 shadow-xl cursor-pointer"
                  title="Foto Sebelumnya (Geser Kiri / Panah Kiri)"
                >
                  <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
                </button>
              )}

              {/* Main Image */}
              <div className="w-full h-full flex items-center justify-center p-1 sm:p-3 overflow-hidden">
                <img
                  src={activePhoto.photoUrl}
                  alt={`Evidence ${zoomModalState.currentIndex + 1}`}
                  className="max-w-full max-h-[58vh] sm:max-h-[64vh] object-contain rounded-2xl shadow-2xl transition-all duration-200"
                />
              </div>

              {/* Right Tap Zone & Chevron */}
              {zoomModalState.photos.length > 1 && (
                <button
                  type="button"
                  onClick={handleNextZoomPhoto}
                  className="absolute right-2 sm:right-4 z-20 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center transition active:scale-90 border border-white/20 shadow-xl cursor-pointer"
                  title="Foto Berikutnya (Geser Kanan / Panah Kanan)"
                >
                  <ChevronRight className="w-6 h-6 stroke-[2.5]" />
                </button>
              )}
            </div>

            {/* BOTTOM DOTS INDICATOR & QUICK THUMBNAILS */}
            <div className="w-full max-w-xl flex items-center justify-center gap-1.5 py-1 shrink-0">
              {zoomModalState.photos.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={() => setZoomModalState((prev) => ({ ...prev, currentIndex: dotIdx }))}
                  className={`transition-all rounded-full cursor-pointer ${
                    dotIdx === zoomModalState.currentIndex
                      ? 'w-7 h-2 bg-teal-400'
                      : 'w-2 h-2 bg-white/40 hover:bg-white/70'
                  }`}
                  title={`Pindah ke foto ${dotIdx + 1}`}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Full-Screen Photo Edit Modal (Crop, Markup / Tandai, Rotate, & Caption) */}
      {editingPhotoState && (
        <ErrorBoundary
          fallbackTitle="Editor Foto Mengalami Gangguan"
          onReset={() => setEditingPhotoState(null)}
        >
          <PhotoEditModal
            photo={editingPhotoState.originalPhoto}
            index={editingPhotoState.index}
            isCa={editingPhotoState.isCa}
            onSave={handleSavePhotoFromModal}
            onClose={() => setEditingPhotoState(null)}
          />
        </ErrorBoundary>
      )}

      {/* Live Toast Notification for GAS GDrive Photo Upload */}
      {uploadStatusMsg && (
        <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-xl border border-teal-400/40 flex items-center gap-3 text-xs font-bold animate-in fade-in">
          {isUploadingPhoto ? (
            <RotateCw className="w-4 h-4 text-teal-400 animate-spin shrink-0" />
          ) : (
            <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="flex-1">{uploadStatusMsg}</span>
        </div>
      )}

      {/* Top Navbar: Floating Apple Liquid Glass Header (Auto-Hide on Scroll Down, Fluid 60fps GPU Composited) */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 bg-transparent pointer-events-none select-none transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
          showTopNavbar
            ? 'translate-y-0 opacity-100'
            : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="px-4 sm:px-6 pt-[max(0.6rem,env(safe-area-inset-top,12px))] pb-2 max-w-6xl mx-auto w-full flex items-center justify-between select-none">
          {/* Tombol Back: Authentic Floating Liquid Glass Round Button */}
          <button
            type="button"
            onClick={onBack}
            title="Kembali ke Beranda"
            className="w-11 h-11 rounded-full iphone-glass-icon-btn flex items-center justify-center text-slate-800 hover:text-black active:scale-95 transition-transform duration-150 shadow-lg cursor-pointer shrink-0 pointer-events-auto border border-white/60"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Tengah: Floating Liquid Glass Title Capsule */}
          <div className="iphone-glass-mini-dock px-3.5 sm:px-4 py-1.5 rounded-full shadow-lg border border-white/50 text-center min-w-0 max-w-[210px] sm:max-w-xs truncate pointer-events-auto">
            <span className="text-[9px] font-black text-teal-800 uppercase tracking-wider flex items-center justify-center gap-1 leading-none">
              <Cloud className="w-2.5 h-2.5 text-emerald-600 inline shrink-0" />
              <span>Realtime Cross-Device</span>
            </span>
            <h2 className="text-xs sm:text-sm font-black text-slate-900 leading-tight truncate mt-0.5">
              {formData.storeName ? formData.storeName : 'Audit Toko FMCU'}
            </h2>
          </div>

          {/* Right Floating Dock: HT/R23 & PDF Buttons in Authentic Liquid Glass */}
          <div className="iphone-glass-mini-dock flex items-center gap-1 p-1 rounded-full shadow-lg shrink-0 pointer-events-auto border border-white/50">
            {/* Tombol HT (Besar di atas) & R23 (Kecil di bawah) */}
            <button
              type="button"
              onClick={() => setShowR23Modal(true)}
              title="Standar Holding Time Resmi (STD/FMI/PD-QC/001/R23)"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-emerald-500/15 text-emerald-950 flex flex-col items-center justify-center active:scale-95 transition-transform duration-150 cursor-pointer group"
            >
              <span className="text-[11px] sm:text-xs font-black tracking-tight leading-none text-emerald-950 group-hover:text-emerald-800">
                HT
              </span>
              <span className="text-[7.5px] sm:text-[8px] font-black tracking-tighter leading-none text-emerald-700 group-hover:text-emerald-900 mt-[1.5px]">
                R23
              </span>
            </button>

            {/* Separator Hairline Kaca */}
            <div className="w-[1px] h-5 bg-black/10 shrink-0" />

            {/* Tombol PDF: Icon + Title PDF Kecil di bawahnya */}
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              title="Pratinjau & Cetak Laporan PDF"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-black/5 flex flex-col items-center justify-center text-slate-800 active:scale-95 transition-transform duration-150 cursor-pointer group"
            >
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.3] text-slate-800 group-hover:text-black" />
              <span className="text-[7px] sm:text-[7.5px] font-black tracking-wider leading-none text-slate-700 group-hover:text-black mt-[1.5px]">
                PDF
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-5">
        {/* ============================================================
            TOP GEOFENCE & ACTUAL IN/OUT BANNER
            HANYA MUNCUL DI SECTION 1 (INFO) & TANPA TEXT LIVE GPS KOORDINAT
            ============================================================ */}
        {activeSection === 1 && (
          <div
            style={{
              background: 'linear-gradient(135deg, #022c22 0%, #042f2e 50%, #0f172a 100%)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
            }}
            className="rounded-2xl p-4 sm:p-5 text-white shadow-lg space-y-3"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left: Store Badge, Progress Ring & Title */}
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Audit Toko FMCU
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-teal-200 border border-white/15">
                    Kode Toko: {formData.storeCode || '3013'}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-slate-300">
                    Tipe: {formData.storeType}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Progress Ring */}
                  <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
                    <svg className="w-11 h-11 -rotate-90">
                      <circle cx="22" cy="22" r="17" stroke="rgba(255,255,255,0.15)" strokeWidth="4" fill="transparent" />
                      <circle
                        cx="22"
                        cy="22"
                        r="17"
                        stroke="#34d399"
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray="106.8"
                        strokeDashoffset={106.8 - (106.8 * progressPercent) / 100}
                        className="transition-all duration-500"
                      />
                    </svg>
                    <span className="absolute text-[10px] font-black text-white">{progressPercent}%</span>
                  </div>

                  <div>
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
                      FMCU Visit Store Report — {formData.storeName.toUpperCase()}
                    </h2>
                    {/* Live GPS Koordinat Text disembunyikan sesuai instruksi */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 mt-1">
                      <span className="flex items-center gap-1 text-[10.5px] font-bold text-teal-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15">
                        <Cloud className="w-3 h-3 text-emerald-400" />
                        <span>Auto-Sync GDrive (GAS) Aktif</span>
                      </span>
                      <span className="flex items-center gap-1 text-[10.5px] font-bold text-emerald-200 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                        <span>Otomatis Sistem (Radius 1–50m)</span>
                      </span>
                      {isOfflineOrWeakSignal && (
                        <span className="flex items-center gap-1 text-[10.5px] font-bold text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                          <WifiOff className="w-3 h-3 text-amber-300" />
                          <span>Offline Auto-Detect</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Read-Only Automatic System Actual In / Actual Out Cards (Strictly 1-50m Radius) */}
              <div className="w-full lg:max-w-md space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* Read-Only System Auto Actual In Card */}
                  <div className="rounded-xl p-2.5 bg-white/10 border border-emerald-400/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] uppercase font-black text-emerald-300">
                      <span>Actual In (Auto)</span>
                      <Clock className="w-3 h-3 text-emerald-400 animate-pulse" />
                    </div>
                    <div className="font-black text-sm text-white my-1 truncate">
                      {formData.actualIn ||
                        (isWithin50mRadius ? systemDetectedTimeStr : 'Menunggu Radius 1–50m')}
                    </div>
                    <span className="text-[9px] text-emerald-200/80">
                      {formData.actualIn || isWithin50mRadius
                        ? 'Terekam Otomatis (Radius 1–50m)'
                        : 'Wajib Radius 1–50m Koordinat Toko'}
                    </span>
                  </div>

                  {/* Read-Only System Auto Actual Out Card */}
                  <div className="rounded-xl p-2.5 bg-white/10 border border-amber-400/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[10px] uppercase font-black text-amber-300">
                      <span>Actual Out (Auto)</span>
                      <Clock className="w-3 h-3 text-amber-400" />
                    </div>
                    <div className="font-black text-sm text-white my-1 truncate">
                      {formData.actualOut || 'Otomatis Saat Selesai'}
                    </div>
                    <span className="text-[9px] text-amber-200/80">
                      Terekam Otomatis (Radius 1–50m)
                    </span>
                  </div>
                </div>

                {/* Automatic Geofence 1-50m Status Bar (No Manual IN/OUT Button) */}
                <div className="rounded-xl p-2 bg-emerald-950/70 border border-emerald-500/40 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isWithin50mRadius || Boolean(formData.actualIn)
                          ? 'bg-emerald-400 animate-ping'
                          : 'bg-amber-400 animate-pulse'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] font-black text-emerald-200 leading-none truncate">
                        {isWithin50mRadius || Boolean(formData.actualIn)
                          ? 'Posisi Terverifikasi Dalam Radius 1–50m Toko'
                          : liveDistanceMeters !== undefined
                          ? `Posisi Di Luar Radius 1–50m Toko (${liveDistanceMeters}m)`
                          : 'Sistem Mendeteksi Radius 1–50m Koordinat Toko'}
                      </div>
                      <div className="text-[9.5px] text-emerald-300/80 leading-none mt-1 truncate">
                        {formData.actualIn
                          ? `Otomatis Sistem: IN ${formData.actualIn}${
                              formData.actualOut ? ` • OUT ${formData.actualOut}` : ''
                            }`
                          : 'Actual IN/OUT otomatis terekam saat berada 1–50m di toko'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleRefreshGps}
                      disabled={isGpsRefreshing}
                      className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition cursor-pointer"
                      title="Segarkan Deteksi Sistem (Radius 1–50m)"
                    >
                      <RotateCw className={`w-3 h-3 ${isGpsRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            SECTION 1: GENERAL INFO & QSC (GABUNGAN SLIDE 1, 2 & 3)
            ============================================================ */}
        {activeSection === 1 && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-soft-card border border-slate-200/80 space-y-6 animate-in fade-in">
            <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-slate-900">
                  General Info & QSC
                </h3>
                {currentStoreBestieOwner && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-extrabold">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                    <span>Kepemilikan: {currentStoreBestieOwner}</span>
                  </span>
                )}
              </div>

              {Boolean(user?.isAdmin) && (
                <button
                  type="button"
                  onClick={() => setShowStorePickerBar((v) => !v)}
                  className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[11px] font-extrabold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Store className="w-3.5 h-3.5 text-teal-600" />
                  <span>{showStorePickerBar ? 'Tutup Pemilih Toko' : 'Pilih dari 610 Master Toko'}</span>
                </button>
              )}
            </div>

            {Boolean(user?.isAdmin) && showStorePickerBar && (
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2.5 animate-in fade-in">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-emerald-900 uppercase">
                    Database 610 Master Toko & Kepemilikan Bestie
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStorePickerScope('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                        storePickerScope === 'ALL'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      Semua Master Toko (610)
                    </button>
                    <button
                      type="button"
                      onClick={() => setStorePickerScope('OWNED')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer ${
                        storePickerScope === 'OWNED'
                          ? 'bg-amber-500 text-white'
                          : 'bg-white text-amber-800 border border-amber-300'
                      }`}
                    >
                      <Star className="w-2.5 h-2.5 fill-current" />
                      <span>Toko Kepemilikan Saya</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Cari kode toko (3013) atau nama cabang..."
                    value={storePickerSearch}
                    onChange={(e) => setStorePickerSearch(e.target.value)}
                    className="w-full h-10 bg-white border border-emerald-200 rounded-xl px-3 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <select
                    value={formData.storeCode}
                    onChange={(e) => handleApplyMasterStore(e.target.value)}
                    className="w-full h-10 bg-white border border-emerald-200 rounded-xl px-3 text-xs font-extrabold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">
                      -- Pilih dari {pickableStoresForVisitor.length} Toko --
                    </option>
                    {pickableStoresForVisitor.map((st) => (
                      <option key={st.code} value={st.code}>
                        {st.isOwnedByBestie ? '★ ' : ''}
                        {st.code} - {st.name} ({st.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Sub-bagian 1A: Data Identitas Toko & Manajemen (Simetris 100% di Mobile & Terkunci untuk 4 Field Utama) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 1. Nama Store (LOCKED / TIDAK BISA DI-EDIT) */}
              <div className="min-w-0">
                <label className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase mb-1.5">
                  <span>Nama Store *</span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" /> Terkunci
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.storeName}
                    readOnly
                    disabled
                    className="w-full h-11 bg-slate-100/90 border border-slate-200 rounded-xl px-3.5 text-xs font-black uppercase text-slate-600 cursor-not-allowed select-none outline-none"
                  />
                </div>
              </div>

              {/* 2. Kode Toko & Tipe Toko (LOCKED / TIDAK BISA DI-EDIT) */}
              <div className="grid grid-cols-2 gap-2.5 min-w-0">
                <div className="min-w-0">
                  <label className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase mb-1.5">
                    <span>Kode Toko</span>
                    <Lock className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    value={formData.storeCode}
                    readOnly
                    disabled
                    className="w-full h-11 bg-slate-100/90 border border-slate-200 rounded-xl px-3 text-xs font-mono font-black text-slate-600 cursor-not-allowed select-none outline-none"
                  />
                </div>
                <div className="min-w-0">
                  <label className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase mb-1.5">
                    <span>Tipe Toko</span>
                    <Lock className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    value={formData.storeType}
                    readOnly
                    disabled
                    className="w-full h-11 bg-slate-100/90 border border-slate-200 rounded-xl px-3 text-xs font-black text-slate-600 cursor-not-allowed select-none outline-none"
                  />
                </div>
              </div>

              {/* 3. Nama Visitor (LOCKED / TIDAK BISA DI-EDIT) */}
              <div className="min-w-0">
                <label className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase mb-1.5">
                  <span>Nama Visitor *</span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" /> Terkunci
                  </span>
                </label>
                <input
                  type="text"
                  value={formData.visitorName}
                  readOnly
                  disabled
                  className="w-full h-11 bg-slate-100/90 border border-slate-200 rounded-xl px-3.5 text-xs font-bold text-slate-600 cursor-not-allowed select-none outline-none"
                />
              </div>

              {/* 4. Tanggal Visit */}
              <div className="min-w-0 w-full">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Tanggal Visit *
                </label>
                <div className="relative w-full min-w-0 flex items-center">
                  <input
                    type="date"
                    value={formData.visitDate}
                    onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                    style={{ minHeight: '44px' }}
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none transition text-left cursor-pointer flex items-center [color-scheme:light]"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* 5. Store Head */}
              <div className="min-w-0">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Store Head *
                </label>
                <input
                  type="text"
                  value={formData.storeHead}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updatedCrews = [...formData.crews];
                    if (updatedCrews[0]) updatedCrews[0].name = val;
                    setFormData({ ...formData, storeHead: val, crews: updatedCrews });
                  }}
                  placeholder="Nama Store Head"
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none transition"
                />
              </div>

              {/* 6. Area Manager */}
              <div className="min-w-0">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Area Manager *
                </label>
                <input
                  type="text"
                  value={formData.areaManager}
                  onChange={(e) => setFormData({ ...formData, areaManager: e.target.value })}
                  placeholder="Nama Area Manager"
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none transition"
                />
              </div>

              {/* 7. Regional Manager */}
              <div className="min-w-0">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Regional Manager *
                </label>
                <input
                  type="text"
                  value={formData.regionalManager}
                  onChange={(e) => setFormData({ ...formData, regionalManager: e.target.value })}
                  placeholder="Nama Regional Manager"
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none transition"
                />
              </div>

              {/* 8. Email Toko */}
              <div className="min-w-0">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Email Toko (Opsional)
                </label>
                <input
                  type="email"
                  value={formData.storeEmail || ''}
                  onChange={(e) => setFormData({ ...formData, storeEmail: e.target.value })}
                  placeholder="store@familymartindonesia.com"
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3.5 text-xs font-medium text-slate-900 focus:bg-white focus:border-teal-500 outline-none transition"
                />
              </div>

              {/* 9. Link Spreadsheet Form CA Toko */}
              <div className="min-w-0">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Link Spreadsheet Form CA Toko
                </label>
                <input
                  type="url"
                  value={formData.spreadsheetUrl}
                  onChange={(e) => setFormData({ ...formData, spreadsheetUrl: e.target.value })}
                  placeholder="https://tinyurl.com/store-caassignment"
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3.5 text-xs font-mono text-slate-700 focus:bg-white focus:border-teal-500 outline-none transition"
                />
              </div>
            </div>

            {/* Sub-bagian 1B: Tim Store yang Bertugas (Zero-Swipe Mobile Card Layout — Tanpa Geser Tabel) */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div>
                <h4 className="font-black text-sm text-slate-800">Tim Store yang Bertugas</h4>
                <p className="text-[11px] text-slate-400 font-medium">
                  Store Head (Auto-fill), Shift Leader, dan seluruh Crew Store on-duty
                </p>
              </div>

              {/* Zero-Swipe Responsive Crew Grid/List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {formData.crews.map((c, idx) => {
                  const isCoreLeader = idx < 2;
                  return (
                    <div
                      key={c.id || idx}
                      className="bg-slate-50/90 border border-slate-200/90 hover:border-teal-300 rounded-2xl p-3 space-y-2 transition"
                    >
                      {/* Top Row: Role Badge & Delete Button */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-6 h-6 rounded-lg bg-teal-600 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          {isCoreLeader ? (
                            <span className="text-xs font-black text-teal-900 bg-teal-100/80 border border-teal-200 px-2.5 py-0.5 rounded-lg truncate">
                              {c.role}
                            </span>
                          ) : (
                            <input
                              type="text"
                              value={c.role}
                              onChange={(e) => handleUpdateCrew(idx, 'role', e.target.value)}
                              className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-extrabold text-slate-700 focus:border-teal-500 outline-none w-full max-w-[150px]"
                              placeholder="Jabatan Crew"
                            />
                          )}
                        </div>

                        {idx >= 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCrew(idx)}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 flex items-center justify-center transition shrink-0 cursor-pointer"
                            title="Hapus Crew"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Bottom Row: Full Name Fill & Level Selector Side-by-Side (Tanpa Swipe) */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            value={c.name}
                            onChange={(e) => handleUpdateCrew(idx, 'name', e.target.value)}
                            placeholder="Ketik Nama Lengkap..."
                            className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs font-bold text-slate-900 focus:border-teal-500 outline-none transition"
                          />
                        </div>
                        <div className="w-[104px] shrink-0">
                          <div className="relative">
                            <select
                              value={c.jobLevel}
                              onChange={(e) => handleUpdateCrew(idx, 'jobLevel', e.target.value)}
                              className="w-full h-10 bg-teal-50 border border-teal-200 rounded-xl px-2.5 text-xs font-black text-teal-900 focus:bg-white focus:border-teal-500 outline-none cursor-pointer"
                              title="Pilih Job Level"
                            >
                              <option value="">-- Level --</option>
                              {['1A', 'NS3', 'NS2', 'NS1', 'MG3', 'MG2', 'MG1', 'OJT'].map(
                                (lvl) => (
                                  <option key={lvl} value={lvl}>
                                    Lvl: {lvl}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tombol Tambah Crew Pindah Posisi Tepat di Bawah Card Crew */}
              <button
                type="button"
                onClick={handleAddCrew}
                className="w-full py-2.5 rounded-2xl border-2 border-dashed border-teal-300 hover:border-teal-500 bg-teal-50/60 hover:bg-teal-100/70 text-teal-800 font-extrabold text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] shadow-2xs"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Tambah Crew Store yang Bertugas</span>
              </button>
            </div>

            {/* Sub-bagian 1C: Evidence Form QSC / FamiTrack Result (Slide 2 PDF) */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-black text-sm text-slate-800">
                    Evidence Form QSC / FamiTrack Result
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Upload 1 foto fisik formulir QSC/FamiTrack. Sistem akan otomatis membagi (auto-split) foto menjadi Lembar Bagian Atas &amp; Bagian Bawah.
                  </p>
                </div>
                <div className="text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                  <span>1x Upload &amp; Auto Split</span>
                </div>
              </div>

              {/* Hidden File Input for Single QSC Sheet Upload */}
              <input
                type="file"
                ref={qscSingleInputRef}
                accept="image/*"
                onChange={handleSingleQscUpload}
                className="hidden"
              />

              {/* Single Main Upload & Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={isUploadingPhoto}
                  onClick={() => qscSingleInputRef.current?.click()}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs sm:text-sm shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>
                    {formData.qscSheetPhoto || formData.qscSheetTop
                      ? 'Ganti / Upload Ulang Foto Lembar QSC'
                      : 'Upload Foto Lembar QSC (Auto Split)'}
                  </span>
                </button>

                {(formData.qscSheetPhoto || formData.qscSheetTop || formData.qscSheetBottom) && (
                  <button
                    type="button"
                    onClick={handleDeleteQsc}
                    className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 font-bold text-xs border border-rose-200 transition flex items-center gap-1.5 cursor-pointer"
                    title="Hapus foto lembar QSC"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Hapus Foto</span>
                  </button>
                )}
              </div>

              {/* 2 Auto-Split Result Cards (Bagian Atas & Bagian Bawah) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Slot 1: Lembar QSC Bagian Atas */}
                <div className="border border-slate-200 rounded-2xl p-3.5 sm:p-4 bg-white space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-black text-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Lembar QSC #1 (Bagian Atas)</span>
                    </div>
                    {formData.qscSheetTop ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Auto-Split Siap
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        Belum Diunggah
                      </span>
                    )}
                  </div>

                  <div className="h-52 sm:h-64 bg-slate-100 rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-200 group">
                    {formData.qscSheetTop ? (
                      <>
                        <img
                          src={formData.qscSheetTop}
                          alt="Lembar QSC Bagian Atas"
                          className="w-full h-full object-contain cursor-zoom-in"
                          onClick={() =>
                            handleOpenSinglePhotoZoom(formData.qscSheetTop, 'Lembar QSC Bagian Atas (Auto Split)')
                          }
                        />
                        <div
                          className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none select-none"
                        >
                          <span className="bg-slate-900/85 text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                            <Maximize2 className="w-3.5 h-3.5 text-teal-300" />
                            <span>Perbesar Bagian Atas</span>
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-4 space-y-1.5">
                        <div className="w-10 h-10 rounded-xl bg-slate-200/80 text-slate-400 flex items-center justify-center mx-auto">
                          <Camera className="w-5 h-5" />
                        </div>
                        <span className="text-xs text-slate-600 font-bold block">
                          Lembar Bagian Atas
                        </span>
                        <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                          Otomatis terisi dari hasil auto-split foto lembar QSC
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Slot 2: Lembar QSC Bagian Bawah */}
                <div className="border border-slate-200 rounded-2xl p-3.5 sm:p-4 bg-white space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-black text-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                      <span>Lembar QSC #2 (Bagian Bawah)</span>
                    </div>
                    {formData.qscSheetBottom ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Auto-Split Siap
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        Belum Diunggah
                      </span>
                    )}
                  </div>

                  <div className="h-52 sm:h-64 bg-slate-100 rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-200 group">
                    {formData.qscSheetBottom ? (
                      <>
                        <img
                          src={formData.qscSheetBottom}
                          alt="Lembar QSC Bagian Bawah"
                          className="w-full h-full object-contain cursor-zoom-in"
                          onClick={() =>
                            handleOpenSinglePhotoZoom(formData.qscSheetBottom, 'Lembar QSC Bagian Bawah (Auto Split)')
                          }
                        />
                        <div
                          className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none select-none"
                        >
                          <span className="bg-slate-900/85 text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                            <Maximize2 className="w-3.5 h-3.5 text-teal-300" />
                            <span>Perbesar Bagian Bawah</span>
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-4 space-y-1.5">
                        <div className="w-10 h-10 rounded-xl bg-slate-200/80 text-slate-400 flex items-center justify-center mx-auto">
                          <Camera className="w-5 h-5" />
                        </div>
                        <span className="text-xs text-slate-600 font-bold block">
                          Lembar Bagian Bawah
                        </span>
                        <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                          Otomatis terisi dari hasil auto-split foto lembar QSC
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Navigation Section 1 */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => handleSwitchSection(2)}
                className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs sm:text-sm shadow-sm transition flex items-center gap-2 cursor-pointer"
              >
                <span>Lanjut ke Section 2: Observation (OPI & QSC)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            SECTION 2: OBSERVATION (OPI PROJECT & QSC OBSERVATION)
            ============================================================ */}
        {activeSection === 2 && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-soft-card border border-slate-200/80 space-y-4 animate-in fade-in">
            {/* Header Section 2 */}
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-black text-base sm:text-lg text-slate-900">
                Observation
              </h3>
            </div>

            {/* 2. Running Text Marquee Banner: PERHATIAN AI (Single Repeat Running) */}
            <div className="w-full bg-slate-950 text-amber-300 border border-amber-400/40 rounded-xl px-3 py-2 flex items-center gap-2.5 text-xs overflow-hidden shadow-xs">
              <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[9px] uppercase tracking-wider z-10 shadow-xs">
                PERHATIAN AI
              </span>
              <div className="flex-1 overflow-hidden relative">
                <div className="animate-marquee font-semibold text-[11px] text-amber-300">
                  <span className="mx-4">
                    ⚠️ Hasil analisa AI dapat membuat kesalahan. Periksa kembali jawaban di setiap kolom temuan sebelum disimpan. Pastikan setiap tindakan perbaikan (CA) dan deadline telah sesuai kesepakatan bersama tim toko.
                  </span>
                  <span className="mx-4" aria-hidden="true">
                    ⚠️ Hasil analisa AI dapat membuat kesalahan. Periksa kembali jawaban di setiap kolom temuan sebelum disimpan. Pastikan setiap tindakan perbaikan (CA) dan deadline telah sesuai kesepakatan bersama tim toko.
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Compact T.A.R.O AI Assistant Button */}
            <button
              type="button"
              disabled={isAiCompiling}
              onClick={handleTaroAiAutoCompile}
              className={`w-full py-2 px-3 sm:px-3.5 rounded-xl border text-white shadow-xs transition active:scale-[0.99] flex items-center justify-between gap-2.5 cursor-pointer group ${
                isAiCompiling
                  ? 'bg-slate-950 border-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.3)]'
                  : 'bg-slate-900 hover:bg-slate-800 border-teal-500/30'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 relative ${
                  isAiCompiling ? 'bg-teal-500/30 border-teal-400 text-teal-200' : 'bg-teal-500/20 border-teal-400/30 text-teal-300'
                }`}>
                  <Bot className={`w-4 h-4 stroke-[2.2] ${isAiCompiling ? 'animate-bounce' : ''}`} />
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs text-white tracking-tight truncate">
                      T.A.R.O AI Assistant
                    </span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 border border-teal-400/20">
                      R23 Rules
                    </span>
                  </div>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold text-teal-300 group-hover:text-teal-200">
                <Wand2 className={`w-3.5 h-3.5 text-teal-400 ${isAiCompiling ? 'animate-spin' : ''}`} />
                <span className="hidden xs:inline">{isAiCompiling ? 'Menganalisa Bukti...' : 'Auto-Kompilasi'}</span>
              </div>
            </button>

            {/* Scanning Animation when isAiCompiling */}
            {isAiCompiling && (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-950/90 via-slate-900/95 to-emerald-950/90 border border-teal-500/40 p-3.5 text-white shadow-md animate-in fade-in duration-300">
                <div className="flex items-center gap-3 relative z-10">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-teal-300 animate-spin" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-xs text-teal-200">
                        T.A.R.O AI Menganalisa Foto Bukti...
                      </h4>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    </div>
                    <p className="text-[10px] text-teal-100/80 truncate">
                      Mengekstrak deskripsi foto dari Section Bukti & merumuskan 6-Box Model R23...
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Sub-Section Switcher: QSC & OPI with Proper ON/OFF Switch & Circle Number Badge */}
            <div className="grid grid-cols-2 gap-2.5 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/90">
              {/* QSC Sub-Section Tab */}
              <div
                onClick={() => {
                  setObsSubTab('qsc');
                  setActiveObsIdx(0);
                }}
                className={`flex items-center justify-between px-3 sm:px-4 py-2.5 rounded-xl transition cursor-pointer ${
                  obsSubTab === 'qsc'
                    ? 'bg-white text-emerald-950 shadow-sm border border-emerald-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-black text-xs sm:text-sm truncate">QSC</span>
                  {/* Circle Number Badge Only */}
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                      obsSubTab === 'qsc'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {formData.observations.filter((o) => o.type === 'QSC').length}
                  </span>
                </div>

                {/* Interactive ON/OFF Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.enableQsc !== false}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFormData((prev) => ({ ...prev, enableQsc: !(prev.enableQsc !== false) }));
                  }}
                  title="Aktifkan / Nonaktifkan Halaman QSC"
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formData.enableQsc !== false ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center text-[8px] font-black ${
                      formData.enableQsc !== false
                        ? 'translate-x-5 text-emerald-700'
                        : 'translate-x-0 text-slate-400'
                    }`}
                  >
                    {formData.enableQsc !== false ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              {/* OPI Sub-Section Tab */}
              <div
                onClick={() => {
                  setObsSubTab('opi');
                  setActiveObsIdx(0);
                }}
                className={`flex items-center justify-between px-3 sm:px-4 py-2.5 rounded-xl transition cursor-pointer ${
                  obsSubTab === 'opi'
                    ? 'bg-white text-amber-950 shadow-sm border border-amber-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-black text-xs sm:text-sm truncate">OPI</span>
                  {/* Circle Number Badge Only */}
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                      obsSubTab === 'opi'
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {formData.observations.filter((o) => o.type === 'OPI').length}
                  </span>
                </div>

                {/* Interactive ON/OFF Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.enableOpi !== false}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFormData((prev) => ({ ...prev, enableOpi: !(prev.enableOpi !== false) }));
                  }}
                  title="Aktifkan / Nonaktifkan Halaman OPI"
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formData.enableOpi !== false ? 'bg-amber-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center text-[8px] font-black ${
                      formData.enableOpi !== false
                        ? 'translate-x-5 text-amber-700'
                        : 'translate-x-0 text-slate-400'
                    }`}
                  >
                    {formData.enableOpi !== false ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            </div>

            {/* 7A. Horizontal Elongated Quick-Jump Bar (Tanpa Text Total) */}
            {isCurrentObsSubTabEnabled && (
              <div className="w-full overflow-x-auto no-scrollbar py-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0 pl-1">
                  Temuan:
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {currentObsList.map((obs, idx) => {
                    const isActiveCard = activeObsIdx === idx;
                    return (
                      <button
                        key={obs.id || idx}
                        type="button"
                        onClick={() => handleJumpToObsCard(idx, currentObsList)}
                        className={`px-3 py-1 h-7 rounded-lg text-xs font-black transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer shrink-0 ${
                          isActiveCard
                            ? 'bg-teal-600 text-white shadow-xs scale-[1.02]'
                            : 'bg-white border border-slate-200 text-slate-700 hover:border-teal-400 hover:text-teal-700'
                        }`}
                        title={`Lompat ke Temuan #${idx + 1}`}
                      >
                        <span>Temuan #{idx + 1}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => handleAddObservation(obsSubTab.toUpperCase() as 'QSC' | 'OPI')}
                    className="px-2.5 py-1 h-7 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-600 hover:text-white text-xs font-black flex items-center gap-1 transition cursor-pointer shrink-0"
                    title="Tambah Kartu Temuan Baru"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Baru</span>
                  </button>
                </div>
              </div>
            )}

            {/* Observation Cards List (or Disabled State if Switch is OFF) */}
            {!isCurrentObsSubTabEnabled ? (
              <div className="py-10 px-4 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-200/80 text-slate-500 flex items-center justify-center mx-auto">
                  <Sliders className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-slate-700">
                  Sub-Section {obsSubTab.toUpperCase()} Dinonaktifkan (OFF)
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Geser switch <strong>ON</strong> pada tab <strong>{obsSubTab.toUpperCase()}</strong> di atas jika Anda ingin mengaktifkan halaman ini dan menambahkan temuan observasi.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      [obsSubTab === 'qsc' ? 'enableQsc' : 'enableOpi']: true,
                    }))
                  }
                  className="mt-2 px-4 py-2 rounded-xl bg-teal-600 text-white font-extrabold text-xs shadow-xs hover:bg-teal-700 transition cursor-pointer"
                >
                  Aktifkan {obsSubTab.toUpperCase()} Sekarang (ON)
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {currentObsList.length === 0 ? (
                  <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-500">
                      Belum ada temuan observasi {obsSubTab.toUpperCase()}.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleAddObservation(obsSubTab.toUpperCase() as any)}
                      className="mt-2 text-xs font-bold text-teal-700 hover:underline"
                    >
                      + Tambah Temuan {obsSubTab.toUpperCase()}
                    </button>
                  </div>
                ) : (
                  currentObsList.map((obs, idx) => {
                    const isListeningFinding = activeVoiceKey === `${obs.id}-auditFinding`;
                    return (
                      <div
                        key={obs.id || idx}
                        ref={(el) => {
                          obsCardRefs.current[obs.id] = el;
                        }}
                        onClick={() => setActiveObsIdx(idx)}
                        className={`relative bg-white border rounded-2xl p-4 sm:p-5 shadow-xs transition space-y-3.5 ${
                          activeObsIdx === idx
                            ? 'border-teal-400 ring-2 ring-teal-500/10'
                            : 'border-slate-200/90 hover:border-slate-300'
                        }`}
                      >
                        {/* Card Header Bar: Tombol Delete 100% SEJAJAR dengan Badge Nomor Temuan */}
                        <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
                          {/* Sisi Kiri: Badge Nomor Temuan, Tipe, & Deadline */}
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-xs shadow-2xs shrink-0">
                              Temuan #{idx + 1}
                            </span>
                            <span className="text-[10px] font-extrabold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 shrink-0">
                              {obs.type}
                            </span>

                            {/* Deadline Date */}
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200/70 shrink-0">
                              <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span className="hidden xs:inline">Deadline:</span>
                              <input
                                type="date"
                                value={obs.deadline}
                                onChange={(e) => handleUpdateObs(obs.id, 'deadline', e.target.value)}
                                className="bg-transparent text-[11px] font-bold text-rose-700 focus:outline-none cursor-pointer w-[115px]"
                              />
                            </div>
                          </div>

                          {/* Sisi Kanan: Tombol Delete Sejajar Horisontal Sempurna */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveObs(obs.id);
                            }}
                            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition cursor-pointer shrink-0 self-center"
                            title="Hapus Temuan Ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* 5 & 6. The 6-Box Model Form Inputs with Equal Aligned Auto-Isi AI + Dikte & Auto-Expanding Boxes */}
                        <div className="space-y-3">
                          {/* Box 1: Temuan (Finding) with Equal-Size Aligned Auto-Isi AI & Active Dikte */}
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label className="font-black text-xs text-amber-800 uppercase flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Temuan (Finding) *</span>
                              </label>

                              {/* Equal & Aligned Buttons: Auto-Isi AI & Dikte */}
                              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                                <button
                                  type="button"
                                  onClick={() => handleAiAutoFill(idx, obs)}
                                  disabled={aiLoadingIdx === idx || !obs.auditFinding?.trim()}
                                  className={`h-8 px-3 rounded-xl font-extrabold text-[11px] flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-95 ${
                                    !obs.auditFinding?.trim()
                                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                                      : 'text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 border border-teal-500/30 cursor-pointer'
                                  }`}
                                  title={
                                    !obs.auditFinding?.trim()
                                      ? 'Isi kolom temuan terlebih dahulu untuk menggunakan AI'
                                      : 'Analisa Temuan dengan AI'
                                  }
                                >
                                  <Wand2 className={`w-3.5 h-3.5 ${!obs.auditFinding?.trim() ? 'text-slate-400' : 'text-amber-300'} shrink-0 ${aiLoadingIdx === idx ? 'animate-spin' : ''}`} />
                                  <span>{aiLoadingIdx === idx ? 'Analisa AI...' : 'Auto-Isi AI'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleVoiceDictation(
                                      `${obs.id}-auditFinding`,
                                      obs.auditFinding,
                                      (val) => handleUpdateObs(obs.id, 'auditFinding', val)
                                    )
                                  }
                                  className={`h-8 px-3 rounded-xl font-extrabold text-[11px] border flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer ${
                                    isListeningFinding
                                      ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                                      : 'bg-teal-50 hover:bg-teal-100 text-teal-900 border-teal-200'
                                  }`}
                                >
                                  {isListeningFinding ? (
                                    <>
                                      <MicOff className="w-3.5 h-3.5 text-white shrink-0" />
                                      <span>Stop Dikte</span>
                                    </>
                                  ) : (
                                    <>
                                      <Mic className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                      <span>Dikte Suara</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            <AutoResizeTextarea
                              minRows={2}
                              value={obs.auditFinding}
                              onChange={(e) => handleUpdateObs(obs.id, 'auditFinding', e.target.value)}
                              placeholder="Tuliskan temuan observasi di lapangan (atau klik Dikte Suara)..."
                              className="w-full bg-amber-50/40 border border-amber-300 rounded-xl p-2.5 text-[11.6px] font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 transition leading-[1.45]"
                            />
                          </div>

                          {/* Boxes 2 to 6: Auto-Expanding Textareas */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="font-bold text-[11px] text-slate-600 uppercase">
                                  Dampak (Impact)
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleVoiceDictation(
                                      `${obs.id}-operationalImpact`,
                                      obs.operationalImpact,
                                      (val) => handleUpdateObs(obs.id, 'operationalImpact', val)
                                    )
                                  }
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition cursor-pointer ${
                                    activeVoiceKey === `${obs.id}-operationalImpact`
                                      ? 'bg-rose-600 text-white animate-pulse'
                                      : 'text-teal-700 hover:bg-teal-50'
                                  }`}
                                >
                                  <Mic className="w-2.5 h-2.5 text-rose-500" />
                                  <span>{activeVoiceKey === `${obs.id}-operationalImpact` ? 'Mendengarkan...' : 'Dikte'}</span>
                                </button>
                              </div>
                              <AutoResizeTextarea
                                minRows={2}
                                value={obs.operationalImpact}
                                onChange={(e) => handleUpdateObs(obs.id, 'operationalImpact', e.target.value)}
                                placeholder="Dampak terhadap kualitas atau operasional..."
                                className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-teal-500 rounded-xl p-2.5 text-[11.6px] text-slate-800 focus:outline-none transition leading-[1.45]"
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="font-bold text-[11px] text-slate-600 uppercase">
                                  Kondisi Ideal
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleVoiceDictation(
                                      `${obs.id}-idealCondition`,
                                      obs.idealCondition,
                                      (val) => handleUpdateObs(obs.id, 'idealCondition', val)
                                    )
                                  }
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition cursor-pointer ${
                                    activeVoiceKey === `${obs.id}-idealCondition`
                                      ? 'bg-rose-600 text-white animate-pulse'
                                      : 'text-teal-700 hover:bg-teal-50'
                                  }`}
                                >
                                  <Mic className="w-2.5 h-2.5 text-rose-500" />
                                  <span>{activeVoiceKey === `${obs.id}-idealCondition` ? 'Mendengarkan...' : 'Dikte'}</span>
                                </button>
                              </div>
                              <AutoResizeTextarea
                                minRows={2}
                                value={obs.idealCondition}
                                onChange={(e) => handleUpdateObs(obs.id, 'idealCondition', e.target.value)}
                                placeholder="Standar kondisi ideal yang diharapkan..."
                                className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-teal-500 rounded-xl p-2.5 text-[11.6px] text-slate-800 focus:outline-none transition leading-[1.45]"
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="font-bold text-[11px] text-slate-600 uppercase">
                                  Tindakan Perbaikan (Corrective Action)
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleVoiceDictation(
                                      `${obs.id}-actionPlan`,
                                      obs.actionPlan,
                                      (val) => handleUpdateObs(obs.id, 'actionPlan', val)
                                    )
                                  }
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition cursor-pointer ${
                                    activeVoiceKey === `${obs.id}-actionPlan`
                                      ? 'bg-rose-600 text-white animate-pulse'
                                      : 'text-teal-700 hover:bg-teal-50'
                                  }`}
                                >
                                  <Mic className="w-2.5 h-2.5 text-rose-500" />
                                  <span>{activeVoiceKey === `${obs.id}-actionPlan` ? 'Mendengarkan...' : 'Dikte'}</span>
                                </button>
                              </div>
                              <AutoResizeTextarea
                                minRows={2}
                                value={obs.actionPlan}
                                onChange={(e) => handleUpdateObs(obs.id, 'actionPlan', e.target.value)}
                                placeholder="Tindakan perbaikan yang harus dilakukan..."
                                className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-teal-500 rounded-xl p-2.5 text-[11.6px] text-slate-800 focus:outline-none transition leading-[1.45]"
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="font-bold text-[11px] text-slate-600 uppercase">
                                  Penyebab (Root Cause)
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleVoiceDictation(
                                      `${obs.id}-rootCause`,
                                      obs.rootCause,
                                      (val) => handleUpdateObs(obs.id, 'rootCause', val)
                                    )
                                  }
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition cursor-pointer ${
                                    activeVoiceKey === `${obs.id}-rootCause`
                                      ? 'bg-rose-600 text-white animate-pulse'
                                      : 'text-teal-700 hover:bg-teal-50'
                                  }`}
                                >
                                  <Mic className="w-2.5 h-2.5 text-rose-500" />
                                  <span>{activeVoiceKey === `${obs.id}-rootCause` ? 'Mendengarkan...' : 'Dikte'}</span>
                                </button>
                              </div>
                              <AutoResizeTextarea
                                minRows={2}
                                value={obs.rootCause}
                                onChange={(e) => handleUpdateObs(obs.id, 'rootCause', e.target.value)}
                                placeholder="Akar penyebab temuan..."
                                className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-teal-500 rounded-xl p-2.5 text-[11.6px] text-slate-800 focus:outline-none transition leading-[1.45]"
                              />
                            </div>

                            <div className="space-y-1 md:col-span-2">
                              <label className="font-bold text-[11px] text-slate-600 uppercase">
                                Hasil (Result / Follow-Up)
                              </label>
                              <AutoResizeTextarea
                                minRows={1}
                                value={obs.expectedResult}
                                onChange={(e) => handleUpdateObs(obs.id, 'expectedResult', e.target.value)}
                                placeholder="Hasil tindak lanjut..."
                                className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-teal-500 rounded-xl p-2.5 text-[11.6px] text-slate-800 focus:outline-none transition leading-[1.45]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Add Observation Button */}
                <button
                  type="button"
                  onClick={() => handleAddObservation(obsSubTab.toUpperCase() as any)}
                  className="w-full py-3 rounded-2xl border-2 border-dashed border-teal-200 hover:border-teal-400 bg-teal-50/40 hover:bg-teal-50 text-teal-700 font-extrabold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Temuan {obsSubTab.toUpperCase()} Baru</span>
                </button>
              </div>
            )}

            {/* Footer Navigation Section 2 */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleSwitchSection(1)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                &larr; Kembali ke Section 1
              </button>
              <button
                type="button"
                onClick={() => handleSwitchSection(3)}
                className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs shadow-sm transition flex items-center gap-2 cursor-pointer"
              >
                <span>Lanjut ke Section 3: Evidence</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            SECTION 3: EVIDENCE (BUKTI TEMUAN & HASIL PERBAIKAN CA)
            TANPA BANNER ACTUAL IN/OUT
            ============================================================ */}
        {activeSection === 3 && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-soft-card border border-slate-200/80 space-y-5 animate-in fade-in">
            {/* Header Section 3 */}
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-black text-base sm:text-lg text-slate-900">
                Evidence
              </h3>
            </div>

            {/* Sub-section Switcher Tabs: Bukti Temuan vs Hasil Perbaikan */}
            <div className="grid grid-cols-2 gap-2.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
              <div
                onClick={() => setEvidenceSubTab('finding')}
                className={`flex items-center justify-between px-3 sm:px-4 py-2.5 rounded-xl transition cursor-pointer ${
                  evidenceSubTab === 'finding'
                    ? 'bg-white text-slate-900 font-black shadow-xs border border-emerald-200/80'
                    : 'text-slate-600 font-bold hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Camera className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs sm:text-sm truncate">Bukti Temuan</span>
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                    {formData.evidencePhotos.length}
                  </span>
                </div>
              </div>

              <div
                onClick={() => setEvidenceSubTab('ca')}
                className={`flex items-center justify-between px-3 sm:px-4 py-2.5 rounded-xl transition cursor-pointer ${
                  evidenceSubTab === 'ca'
                    ? 'bg-white text-slate-900 font-black shadow-xs border border-blue-200/80'
                    : 'text-slate-600 font-bold hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs sm:text-sm truncate">Hasil Perbaikan (CA)</span>
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                    {formData.caPhotos?.length || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Hidden Photo Inputs for Camera Capture & Gallery Picker */}
            <input
              type="file"
              ref={evidenceCameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={(e) => handleAddEvidencePhoto(e, evidenceSubTab === 'ca')}
              className="hidden"
            />
            <input
              type="file"
              ref={evidenceGalleryInputRef}
              accept="image/*"
              multiple
              onChange={(e) => handleAddEvidencePhoto(e, evidenceSubTab === 'ca')}
              className="hidden"
            />

            {/* Evidence Photo Grid Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(evidenceSubTab === 'finding' ? formData.evidencePhotos : formData.caPhotos || []).map(
                (ev, idx) => (
                  <div
                    key={ev.id || idx}
                    className="border border-slate-200 rounded-2xl p-3 bg-white space-y-2.5 relative shadow-xs"
                  >
                    {/* Viewfinder Thumbnail with Blurry Ambient Fill & Natural Aspect Ratio */}
                    <div className="h-44 bg-slate-950 rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-200/90 group shadow-inner">
                      {/* Tombol Icon Pencil di Kiri Atas Foto untuk Edit Foto & Keterangan (1x Klik Responsif) */}
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleOpenEditPhotoModal(ev, idx, evidenceSubTab === 'ca');
                        }}
                        className="absolute top-2 left-2 z-30 w-9 h-9 rounded-full bg-slate-900/85 hover:bg-black text-white flex items-center justify-center shadow-lg backdrop-blur-md transition active:scale-90 cursor-pointer border border-white/40 touch-manipulation"
                        title="Edit Foto (Potong, Beri Tanda, Putar 90°, Keterangan)"
                      >
                        <Pencil className="w-4 h-4 text-teal-300 pointer-events-none" />
                      </button>

                      {/* Badge Index Foto di Kanan Atas */}
                      <span className="absolute top-2 right-2 z-20 text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-900/70 backdrop-blur-xs text-white border border-white/20 pointer-events-none select-none">
                        #{idx + 1}
                      </span>

                      {/* Blurry Ambient Background Layer (Fills canvas sides seamlessly without stretching distortions) */}
                      <img
                        src={ev.photoUrl}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-55 pointer-events-none select-none"
                      />

                      {/* Sharp Natural Aspect Ratio Photo Centered */}
                      <img
                        src={ev.photoUrl}
                        alt={`Evidence ${idx + 1}`}
                        className="relative z-10 max-w-full max-h-full object-contain cursor-zoom-in select-none drop-shadow-md"
                        onClick={() => handleOpenZoomPhoto(idx, evidenceSubTab === 'ca')}
                      />
                      {/* Desktop Hover Overlay (pointer-events-none so it NEVER blocks mobile taps) */}
                      <div
                        className="absolute inset-0 z-20 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none select-none"
                      >
                        <span className="bg-slate-900/85 text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                          <Maximize2 className="w-3.5 h-3.5 text-teal-300" />
                          <span>Perbesar (Tap / Swipe)</span>
                        </span>
                      </div>
                    </div>

                    {/* Keterangan & Actions */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                        <span>KETERANGAN FOTO #{idx + 1}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleVoiceDictation(
                                `ev-${ev.id}`,
                                ev.caption,
                                (val) => handleUpdateEvidenceCaption(ev.id, val, evidenceSubTab === 'ca')
                              )
                            }
                            className={`px-2 py-0.5 rounded-md font-bold transition flex items-center gap-1 cursor-pointer ${
                              activeVoiceKey === `ev-${ev.id}`
                                ? 'bg-rose-600 text-white animate-pulse'
                                : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                            }`}
                          >
                            <Mic className="w-3 h-3 text-rose-500" />
                            <span>{activeVoiceKey === `ev-${ev.id}` ? 'Stop' : 'Dikte'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveEvidencePhoto(ev.id, evidenceSubTab === 'ca')}
                            className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>

                      <AutoResizeTextarea
                        minRows={2}
                        value={ev.caption}
                        onChange={(e) =>
                          handleUpdateEvidenceCaption(ev.id, e.target.value, evidenceSubTab === 'ca')
                        }
                        placeholder="Tuliskan deskripsi temuan foto ini..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[11.6px] text-slate-800 focus:bg-white focus:border-teal-500 outline-none leading-[1.45]"
                      />

                      <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1 truncate">
                          <Cloud className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Tersimpan di GDrive (GAS)</span>
                        </span>
                        <span className="text-[9px] text-emerald-600 shrink-0">{ev.timestamp}</span>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Add Photo Card Placeholder */}
              <div className="border-2 border-dashed border-slate-300 bg-slate-50/70 rounded-2xl p-5 flex flex-col items-center justify-center text-center min-h-[220px] space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-teal-600 flex items-center justify-center shadow-xs">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-800 block">
                    Tambah Foto {evidenceSubTab === 'finding' ? 'Bukti Temuan' : 'Hasil Perbaikan (CA)'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                    Auto-Watermark & Auto-Upload Google Drive (GAS)
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => evidenceCameraInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Kamera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => evidenceGalleryInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Galeri</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Navigation Section 3 */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleSwitchSection(2)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                &larr; Kembali ke Section 2
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPreview(true);
                  confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
                }}
                className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-xs sm:text-sm shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-rose-400" />
                <span>Simpan & Buka Preview PDF 16:9</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Minimalist Page Footer */}
        <DeveloperFooter className="pt-8 pb-6 text-center" />
      </div>

      {/* =====================================================================
          FLOATING QUICK ACTIONS (POJOK KANAN BAWAH TEPAT DI ATAS NAVBAR)
          - Section 2 (Observasi): Tombol + & Navigasi Cepat Antar Card Temuan (Liquid Glass)
          - Section 3 (Bukti): Tombol Icon Camera & Gallery (Liquid Glass)
          Auto-Hide saat Scroll Down (Menciut instant lalu menghilang)
          Auto-Appear saat Scroll Up
          ===================================================================== */}
      {activeSection === 2 && isCurrentObsSubTabEnabled && (
        <div
          className={`fixed bottom-24 right-4 sm:right-6 z-40 flex items-center gap-2 select-none transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
            isScrolled
              ? 'translate-y-28 pointer-events-none'
              : 'translate-y-0 pointer-events-auto'
          }`}
        >
          {/* Quick Prev / Next Card Navigation Pill with Liquid Glass */}
          {currentObsList.length > 0 && (
            <div className="h-11 px-2.5 rounded-full iphone-glass-mini-dock text-slate-800 shadow-lg flex items-center gap-1 border border-white/40">
              <button
                type="button"
                onClick={() => handleJumpToObsCard(activeObsIdx - 1, currentObsList)}
                disabled={activeObsIdx <= 0}
                className="w-7 h-7 rounded-full hover:bg-black/10 disabled:opacity-30 flex items-center justify-center active:scale-95 transition-transform duration-150 cursor-pointer"
                title="Temuan Sebelumnya"
              >
                <ChevronUp className="w-4 h-4 stroke-[2.4]" />
              </button>
              <span className="text-[11px] font-black px-1.5 tracking-tight text-teal-800">
                #{Math.min(activeObsIdx + 1, currentObsList.length)}/{currentObsList.length}
              </span>
              <button
                type="button"
                onClick={() => handleJumpToObsCard(activeObsIdx + 1, currentObsList)}
                disabled={activeObsIdx >= currentObsList.length - 1}
                className="w-7 h-7 rounded-full hover:bg-black/10 disabled:opacity-30 flex items-center justify-center active:scale-95 transition-transform duration-150 cursor-pointer"
                title="Temuan Berikutnya"
              >
                <ChevronDown className="w-4 h-4 stroke-[2.4]" />
              </button>
            </div>
          )}

          {/* Tombol + Tambah Card Temuan Cepat with Liquid Glass */}
          <button
            type="button"
            onClick={() => handleAddObservation(obsSubTab.toUpperCase() as 'QSC' | 'OPI')}
            title={`Tambah Temuan ${obsSubTab.toUpperCase()} Baru`}
            className="w-11 h-11 rounded-full iphone-glass-icon-btn flex items-center justify-center text-teal-800 hover:text-teal-950 active:scale-95 transition-transform duration-150 shadow-lg cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[2.8]" />
          </button>
        </div>
      )}

      {activeSection === 3 && (
        <div
          className={`fixed bottom-24 right-4 sm:right-6 z-40 flex items-center gap-2.5 select-none transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
            isScrolled
              ? 'translate-y-28 pointer-events-none'
              : 'translate-y-0 pointer-events-auto'
          }`}
        >
          {/* Button Icon Gallery with Liquid Glass */}
          <button
            type="button"
            onClick={() => evidenceGalleryInputRef.current?.click()}
            title="Pilih Foto dari Galeri"
            className="w-12 h-12 rounded-full iphone-glass-icon-btn flex items-center justify-center text-slate-800 hover:text-black active:scale-95 transition-transform duration-150 shadow-lg cursor-pointer"
          >
            <ImageIcon className="w-5 h-5 stroke-[2.2]" />
          </button>

          {/* Button Icon Camera with Liquid Glass */}
          <button
            type="button"
            onClick={() => evidenceCameraInputRef.current?.click()}
            title="Ambil Foto dengan Kamera"
            className="w-12 h-12 rounded-full iphone-glass-icon-btn flex items-center justify-center text-teal-700 hover:text-teal-900 active:scale-95 transition-transform duration-150 shadow-lg cursor-pointer"
          >
            <Camera className="w-5 h-5 stroke-[2.4]" />
          </button>
        </div>
      )}

      {/* ============================================================
          BOTTOM NAVBAR FORM VISIT (3 SECTION: INFO, OBSERVASI, BUKTI)
          Ala Glass iPhone dengan Smooth Sliding Lens Pill
          ============================================================ */}
      <div className="fixed bottom-3.5 sm:bottom-4 left-0 right-0 mx-auto flex justify-center pointer-events-none z-40 select-none px-4">
        <div
          onClick={handleResetScale}
          style={{
            transform: isScrolled ? 'scale(0.86)' : 'scale(1)',
          }}
          className={`w-full max-w-md flex items-center pointer-events-auto dock-transition origin-center relative overflow-hidden select-none p-1.5 rounded-[36px] ${
            isScrolled ? 'iphone-glass-dock-scrolled shadow-xl' : 'iphone-glass-dock shadow-2xl'
          }`}
        >
          {/* Top Specular Hairline Reflection */}
          <div className="pointer-events-none absolute inset-x-6 top-0 h-[0.5px] bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-50 z-0" />

          {/* Ambient Bottom Refraction Rim */}
          <div className="pointer-events-none absolute inset-x-10 bottom-0 h-[0.5px] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-30 z-0" />

          {/* SLIDING ACTIVE GLASS LENS PILL */}
          <div
            className="absolute top-1.5 bottom-1.5 rounded-[24px] iphone-glass-pill pointer-events-none dock-pill-transition z-0"
            style={{
              width: 'calc((100% - 12px) / 3)',
              transform: `translateX(calc(${activeSection - 1} * 100%))`,
              left: '6px',
            }}
          >
            <div className="pointer-events-none absolute inset-x-2.5 top-0 h-[0.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-60" />
            <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-gradient-to-b from-white/40 via-transparent to-white/10" />
          </div>

          {/* Section 1 = INFO */}
          <button
            type="button"
            onPointerDown={handleResetScale}
            onClick={() => {
              handleSwitchSection(1);
              handleResetScale();
            }}
            className="relative z-10 flex-1 rounded-[24px] flex flex-col items-center justify-center dock-btn-transition active:scale-90 group cursor-pointer focus:outline-none py-2 sm:py-2.5 px-1.5 gap-1"
          >
            <div className="relative flex items-center justify-center">
              <Store
                className={`w-5 h-5 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.35,1)] ${
                  activeSection === 1
                    ? 'scale-115 text-black stroke-[2.5] -translate-y-0.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]'
                    : 'scale-100 stroke-[2] text-black/70 group-hover:text-black group-hover:scale-105'
                }`}
              />
            </div>
            <span
              className={`tracking-tight leading-none uppercase text-[10px] transition-all duration-300 ${
                activeSection === 1
                  ? 'text-black font-black scale-[1.03]'
                  : 'text-black/70 font-bold group-hover:text-black'
              }`}
            >
              INFO
            </span>
          </button>

          {/* Section 2 = Observasi */}
          <button
            type="button"
            onPointerDown={handleResetScale}
            onClick={() => {
              handleSwitchSection(2);
              handleResetScale();
            }}
            className="relative z-10 flex-1 rounded-[24px] flex flex-col items-center justify-center dock-btn-transition active:scale-90 group cursor-pointer focus:outline-none py-2 sm:py-2.5 px-1.5 gap-1"
          >
            <div className="relative flex items-center justify-center">
              <ClipboardCheck
                className={`w-5 h-5 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.35,1)] ${
                  activeSection === 2
                    ? 'scale-115 text-black stroke-[2.5] -translate-y-0.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]'
                    : 'scale-100 stroke-[2] text-black/70 group-hover:text-black group-hover:scale-105'
                }`}
              />

              {formData.observations.length > 0 && (
                <span className="absolute -top-1.5 -right-2.5 z-20 text-[9px] font-black bg-white text-teal-800 px-1.5 py-0.2 rounded-full shadow-sm border border-slate-200/90 leading-none">
                  {formData.observations.length}
                </span>
              )}
            </div>
            <span
              className={`tracking-tight leading-none text-[10px] transition-all duration-300 ${
                activeSection === 2
                  ? 'text-black font-black scale-[1.03]'
                  : 'text-black/70 font-bold group-hover:text-black'
              }`}
            >
              Observasi
            </span>
          </button>

          {/* Section 3 = BUKTI */}
          <button
            type="button"
            onPointerDown={handleResetScale}
            onClick={() => {
              handleSwitchSection(3);
              handleResetScale();
            }}
            className="relative z-10 flex-1 rounded-[24px] flex flex-col items-center justify-center dock-btn-transition active:scale-90 group cursor-pointer focus:outline-none py-2 sm:py-2.5 px-1.5 gap-1"
          >
            <div className="relative flex items-center justify-center">
              <Camera
                className={`w-5 h-5 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.35,1)] ${
                  activeSection === 3
                    ? 'scale-115 text-black stroke-[2.5] -translate-y-0.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.25)]'
                    : 'scale-100 stroke-[2] text-black/70 group-hover:text-black group-hover:scale-105'
                }`}
              />

              {formData.evidencePhotos.length + (formData.caPhotos?.length || 0) > 0 && (
                <span className="absolute -top-1.5 -right-2.5 z-20 text-[9px] font-black bg-white text-amber-700 px-1.5 py-0.2 rounded-full shadow-sm border border-slate-200/90 leading-none">
                  {formData.evidencePhotos.length + (formData.caPhotos?.length || 0)}
                </span>
              )}
            </div>
            <span
              className={`tracking-tight leading-none uppercase text-[10px] transition-all duration-300 ${
                activeSection === 3
                  ? 'text-black font-black scale-[1.03]'
                  : 'text-black/70 font-bold group-hover:text-black'
              }`}
            >
              BUKTI
            </span>
          </button>
        </div>
      </div>

      {/* Modal Standar Holding Time R23 */}
      <HoldingTimeR23Modal
        isOpen={showR23Modal}
        onClose={() => setShowR23Modal(false)}
      />
    </div>
  );
};
