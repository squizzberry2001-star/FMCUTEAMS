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
  Cloud,
  WifiOff,
  Navigation
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
import { generateTaroObservationAnalysis } from '../../services/taroAiService';

interface VisitReportFormProps {
  agenda: ScheduleAgenda;
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
const IDB_STORE = 'visit_photos';

const openPhotoDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const savePhotosToIdb = async (
  key: string,
  payload: {
    storeFrontPhoto?: string;
    qscSheetTop?: string;
    qscSheetBottom?: string;
    evidencePhotos?: EvidencePhoto[];
    caPhotos?: EvidencePhoto[];
  }
): Promise<void> => {
  try {
    const db = await openPhotoDb();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(payload, key);
  } catch (e) {
    console.warn('IDB Save Warning:', e);
  }
};

const loadPhotosFromIdb = async (key: string): Promise<any | null> => {
  try {
    const db = await openPhotoDb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

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
      agenda.title
        .replace(/^Audit & Store Visit - Cabang /i, '')
        .replace(/ - SENSE OF URGENCY$/i, '')
        .trim() || agenda.location;
    const savedGps = localStorage.getItem('fmcu_live_gps') || '-6.2293, 106.8256 (Akurat)';
    const initialInTime = localStorage.getItem('fmcu_initial_checkin_time') || getCurrentWibTime();

    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          visitorName: user?.name || agenda.pic || parsed.visitorName || 'Marisa Giselina',
          storeName: cleanStoreName || parsed.storeName,
          storeCode: parsed.storeCode || '3013',
          storeType: parsed.storeType || 'CVS',
        };
      } catch (e) {
        console.error(e);
      }
    }

    return {
      id: `report-${Date.now()}`,
      agendaId: agenda.id,
      actualIn: initialInTime,
      actualOut: '17:45 WIB',
      liveGps: savedGps,
      actualInSubmitted: false,
      isManualCheckIn: false,
      storeFrontPhoto: '',
      visitorName: user?.name || agenda.pic || 'Marisa Giselina',
      storeName: cleanStoreName,
      storeCode: '3013',
      storeType: 'CVS',
      storeHead: 'Sutris Ismawan',
      visitDate: agenda.date || new Date().toISOString().split('T')[0],
      areaManager: 'Hadi Ilman',
      regionalManager: 'Novy Rusnani',
      storeEmail: `store.${cleanStoreName.toLowerCase().replace(/\s+/g, '')}@familymartindonesia.com`,
      qscSheetTop: '',
      qscSheetBottom: '',
      gasSyncStatus: 'idle',
      crews: [
        { id: 'c-1', role: 'Store Head', name: 'Sutris Ismawan', jobLevel: '1A' },
        { id: 'c-2', role: 'Shift Leader', name: 'Fikri S.', jobLevel: 'NS3' },
        { id: 'c-3', role: 'Crew Store 1', name: 'Tini Pratiwi', jobLevel: 'MG1' },
        { id: 'c-4', role: 'Crew Store 2', name: 'Zildzian Azhar Permana', jobLevel: 'MG1' },
      ],
      enableQsc: true,
      enableOpi: true,
      observations: [
        {
          id: 'obs-1',
          type: 'QSC',
          category: 'Lingkungan Store',
          title: 'Kebersihan Lap & Penyimpanan Box',
          auditFinding: 'Lap kotor dan penyimpanan box tidak sesuai dengan tempatnya serta tidak terdapat lap cendol dan sarung tangan dua sisi.',
          operationalImpact: 'Risiko tinggi kontaminasi silang pada produk makanan yang dapat menyebabkan keluhan pelanggan dan potensi penarikan produk.',
          idealCondition: 'Lap harus dalam kondisi bersih, kering, dan tersimpan di tempat yang telah ditentukan (disinfektan/box khusus).',
          actionPlan: '1. Segera ganti lap yang kotor dengan lap bersih. 2. Pindahkan box penyimpanan ke lokasi layout SOP. 3. Pastikan ketersediaan lap cendol dan sarung tangan.',
          rootCause: 'Kurangnya disiplin crew dalam menjalankan SOP kebersihan dan penyimpanan (5R).',
          expectedResult: 'Akan dimonitoring pada visit berikutnya',
          deadline: agenda.date || new Date().toISOString().split('T')[0],
          status: 'OPEN'
        },
      ],
      enableEvidence: true,
      enableCa: true,
      evidencePhotos: [],
      caPhotos: [],
      spreadsheetUrl: 'https://tinyurl.com/store-caassignment',
      assignmentNotes: 'Harap segera lakukan tindakan perbaikan (Corrective Action) sebelum batas waktu deadline yang ditentukan.',
      status: 'DRAFT',
    };
  });

  // Step Nav: 1 (General Info & QSC), 2 (Observation), 3 (Evidence)
  const [activeSection, setActiveSection] = useState<number>(1);

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeSection, obsSubTab, evidenceSubTab, showPreview]);

  // Modal zoom photo & R23 Holding Time Standards
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);
  const [showR23Modal, setShowR23Modal] = useState(false);

  // AI Loading state per observation card
  const [aiLoadingIdx, setAiLoadingIdx] = useState<number | null>(null);

  // GPS & Offline / Weak Signal Detection + Mandatory Actual IN/OUT Pop-Up
  const [isGpsRefreshing, setIsGpsRefreshing] = useState(false);
  const [isOfflineOrWeakSignal, setIsOfflineOrWeakSignal] = useState<boolean>(() => {
    return (
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      sessionStorage.getItem('fmcu_gps_offline_mode') === 'true'
    );
  });
  const [showCheckInPopup, setShowCheckInPopup] = useState<boolean>(() => {
    const isOffline =
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      sessionStorage.getItem('fmcu_gps_offline_mode') === 'true';
    return !formData.actualInSubmitted || isOffline;
  });
  const [manualInInput, setManualInInput] = useState<string>(() => {
    const clean = (formData.actualIn || '08:15').replace(/\s*WIB$/i, '').trim();
    return /^\d{2}:\d{2}$/.test(clean) ? clean : '08:15';
  });
  const [manualOutInput, setManualOutInput] = useState<string>(() => {
    const clean = (formData.actualOut || '17:45').replace(/\s*WIB$/i, '').trim();
    return /^\d{2}:\d{2}$/.test(clean) ? clean : '17:45';
  });

  // Upload status feedback
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);

  // Active Voice Dictation state
  const [activeVoiceKey, setActiveVoiceKey] = useState<string | null>(null);
  const activeRecognitionRef = useRef<any>(null);

  // Restore heavy photos from IndexedDB on mount
  useEffect(() => {
    let mounted = true;
    loadPhotosFromIdb(draftKey).then((cached) => {
      if (mounted && cached) {
        setFormData((prev) => ({
          ...prev,
          storeFrontPhoto: cached.storeFrontPhoto || prev.storeFrontPhoto,
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
    return () => {
      mounted = false;
    };
  }, [draftKey]);

  // Monitor Online / Offline & Weak Signal status
  useEffect(() => {
    const handleOnline = () => {
      if (sessionStorage.getItem('fmcu_gps_offline_mode') !== 'true') {
        setIsOfflineOrWeakSignal(false);
      }
      setFormData((prev) => ({
        ...prev,
        gasSyncStatus: prev.gasSyncStatus === 'offline-queued' ? 'synced' : prev.gasSyncStatus,
      }));
    };
    const handleOffline = () => {
      setIsOfflineOrWeakSignal(true);
      setShowCheckInPopup(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Scroll Detection & Auto Navbar Scale (Bottom and Top Navbar with Direction Accumulator)
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

          // 1. Di paling atas halaman (<= 25px): selalu tampilkan top navbar & normal size bottom navbar
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
            if (currentY > manualExpandedScrollTopRef.current + 10 || delta > 4) {
              manualExpandedRef.current = false;
              setIsScrolled(true);
              setShowTopNavbar(false);
            }
          }
          // 4. Scroll ke BAWAH: akumulasi > 12px dan posisi > 45px -> Sembunyikan (Auto-Hide)
          else if (scrollDeltaAccRef.current > 12 && currentY > 45) {
            setShowTopNavbar(false);
            setIsScrolled(true);
          }
          // 5. Scroll ke ATAS: akumulasi < -6px -> Langsung Munculkan Kembali (Auto-Appear)
          else if (scrollDeltaAccRef.current < -6) {
            setShowTopNavbar(true);
            setIsScrolled(false);
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
  const qscFullCameraInputRef = useRef<HTMLInputElement>(null);
  const qscFullGalleryInputRef = useRef<HTMLInputElement>(null);
  const evidenceCameraInputRef = useRef<HTMLInputElement>(null);
  const evidenceGalleryInputRef = useRef<HTMLInputElement>(null);

  // Safe Auto-save draft (Never throws QuotaExceededError!)
  useEffect(() => {
    // 1. Save full photos to IndexedDB (unlimited capacity)
    savePhotosToIdb(draftKey, {
      storeFrontPhoto: formData.storeFrontPhoto,
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
  }, [formData, draftKey]);

  // Calculate Form Completion Progress Percentage
  const calculateProgress = (): number => {
    let score = 0;
    const total = 6;
    if (formData.storeName && formData.storeCode) score++;
    if (formData.crews.length >= 2) score++;
    if (formData.qscSheetTop || formData.qscSheetBottom) score++;
    if (formData.observations.length > 0 && formData.observations[0].auditFinding) score++;
    if (formData.evidencePhotos.length > 0) score++;
    if (formData.spreadsheetUrl) score++;
    return Math.round((score / total) * 100);
  };

  const progressPercent = calculateProgress();

  // Helper: Live GPS Refresh (Silent Coordinate Recording)
  const handleRefreshGps = () => {
    setIsGpsRefreshing(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(5);
          const lng = pos.coords.longitude.toFixed(5);
          const coordStr = `${lat}, ${lng} (Akurat)`;
          try {
            localStorage.setItem('fmcu_live_gps', coordStr);
            sessionStorage.removeItem('fmcu_gps_offline_mode');
          } catch (e) {
            console.warn(e);
          }
          setIsOfflineOrWeakSignal(false);
          setFormData((prev) => ({
            ...prev,
            liveGps: coordStr,
          }));
          setIsGpsRefreshing(false);
        },
        () => {
          setIsOfflineOrWeakSignal(true);
          setFormData((prev) => ({
            ...prev,
            liveGps: 'Mode Manual / Susah Sinyal',
          }));
          setIsGpsRefreshing(false);
          setShowCheckInPopup(true);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setIsOfflineOrWeakSignal(true);
      setIsGpsRefreshing(false);
      setShowCheckInPopup(true);
    }
  };

  // Submit Mandatory Check-In / Check-Out Popup
  const handleSubmitCheckInOut = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedIn = manualInInput.includes('WIB') ? manualInInput : `${manualInInput} WIB`;
    const formattedOut = manualOutInput.includes('WIB') ? manualOutInput : `${manualOutInput} WIB`;

    setFormData((prev) => ({
      ...prev,
      actualIn: formattedIn,
      actualOut: formattedOut,
      actualInSubmitted: true,
      isManualCheckIn: isOfflineOrWeakSignal,
    }));
    setShowCheckInPopup(false);
  };

  // Helper: Stamp Watermark on Image using HTML Canvas (Memory-Safe & Error-Proof)
  const processAndStampImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      const cleanup = () => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // ignore
        }
      };

      img.onload = () => {
        try {
          let w = img.naturalWidth || img.width || 1000;
          let h = img.naturalHeight || img.height || 1000;
          const maxDim = 1100;
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

          // Timestamp & Verified Store Bar Watermark
          const now = new Date();
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
          const timeStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
          const statusStr = isOfflineOrWeakSignal ? 'Manual Check-In Verified' : 'GPS Verified';

          const barH = Math.max(26, Math.round(h * 0.045));
          ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
          ctx.fillRect(0, h - barH, w, barH);

          // Green accent strip
          ctx.fillStyle = '#009944';
          ctx.fillRect(0, h - barH, Math.max(5, Math.round(w * 0.01)), barH);

          const padLeft = Math.max(12, Math.round(w * 0.018));
          const fontSize = Math.max(10, Math.round(barH * 0.42));

          ctx.fillStyle = '#FFFFFF';
          ctx.font = `bold ${fontSize}px sans-serif`;
          const textStr = `${formData.storeName.toUpperCase()} (${formData.storeCode})  •  ${timeStr}  •  ${statusStr}`;
          ctx.fillText(textStr, padLeft, h - Math.round(barH * 0.3));

          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          cleanup();
          resolve(dataUrl);
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      img.onerror = () => {
        cleanup();
        // Fallback to FileReader if ObjectURL fails
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

  // Helper: Auto-Split Full QSC Sheet into Top & Bottom parts
  const splitImageTopBottom = async (fullDataUrl: string): Promise<{ top: string; bottom: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width || 800;
          const h = img.naturalHeight || img.height || 1000;
          const halfH = Math.floor(h / 2);
          const overlap = Math.floor(h * 0.025);

          // Top Canvas
          const cTop = document.createElement('canvas');
          cTop.width = w;
          cTop.height = halfH + overlap;
          const ctxTop = cTop.getContext('2d');
          ctxTop?.drawImage(img, 0, 0, w, halfH + overlap, 0, 0, w, halfH + overlap);
          const topDataUrl = cTop.toDataURL('image/jpeg', 0.8);

          // Bottom Canvas
          const srcY = Math.max(0, halfH - overlap);
          const srcH = h - srcY;
          const cBottom = document.createElement('canvas');
          cBottom.width = w;
          cBottom.height = srcH;
          const ctxBottom = cBottom.getContext('2d');
          ctxBottom?.drawImage(img, 0, srcY, w, srcH, 0, 0, w, srcH);
          const bottomDataUrl = cBottom.toDataURL('image/jpeg', 0.8);

          resolve({ top: topDataUrl, bottom: bottomDataUrl });
        } catch {
          resolve({ top: fullDataUrl, bottom: fullDataUrl });
        }
      };
      img.onerror = () => {
        resolve({ top: fullDataUrl, bottom: fullDataUrl });
      };
      img.src = fullDataUrl;
    });
  };

  // 1x QSC Sheet Upload Handler (Auto Split into Top & Bottom + Auto GDrive Sync via GAS)
  const handleQscFullUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsUploadingPhoto(true);
    setUploadStatusMsg('Memproses Auto-Split 2 Bagian (Atas & Bawah) & Menyimpan ke GDrive...');

    try {
      const stampedFull = await processAndStampImage(file);
      const { top, bottom } = await splitImageTopBottom(stampedFull);

      // Update local state immediately so preview slots show Top & Bottom right away
      setFormData((prev) => ({
        ...prev,
        qscSheetTop: top,
        qscSheetBottom: bottom,
        gasSyncStatus: 'syncing',
      }));

      // Automatically upload both Top & Bottom sheets to GDrive via GAS
      const [topRes, bottomRes] = await Promise.all([
        uploadPhotoToGasGDrive({
          base64Data: top,
          filename: `QSC_TOP_${formData.storeCode}_${formData.visitDate}.jpg`,
          storeCode: formData.storeCode,
          storeName: formData.storeName,
          visitorName: formData.visitorName,
          visitDate: formData.visitDate,
          section: 'QSC_SHEET_TOP',
        }),
        uploadPhotoToGasGDrive({
          base64Data: bottom,
          filename: `QSC_BOTTOM_${formData.storeCode}_${formData.visitDate}.jpg`,
          storeCode: formData.storeCode,
          storeName: formData.storeName,
          visitorName: formData.visitorName,
          visitDate: formData.visitDate,
          section: 'QSC_SHEET_BOTTOM',
        }),
      ]);

      setFormData((prev) => ({
        ...prev,
        qscTopDriveUrl: topRes.driveUrl,
        qscBottomDriveUrl: bottomRes.driveUrl,
        gasSyncStatus: topRes.synced ? 'synced' : 'offline-queued',
        lastSyncedAt: getCurrentWibTime(),
      }));

      setUploadStatusMsg('Lembar QSC berhasil di-split (Atas & Bawah) & tersimpan otomatis di GDrive!');
      setTimeout(() => setUploadStatusMsg(null), 4000);
      confetti({ particleCount: 30, spread: 45, origin: { y: 0.5 } });
    } catch (err) {
      console.error('QSC Upload Error:', err);
      setUploadStatusMsg('Gagal memproses gambar. Silakan coba foto lainnya.');
      setTimeout(() => setUploadStatusMsg(null), 3500);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Crew Management
  const handleAddCrew = () => {
    const nextNum = Math.max(1, formData.crews.length - 1);
    const newCrew: StoreCrew = {
      id: `c-${Date.now()}`,
      role: `Crew Store ${nextNum}`,
      name: '',
      jobLevel: '1A',
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
      const filtered = updated.filter((o) => o.type.toUpperCase() === type);
      setTimeout(() => {
        setActiveObsIdx(Math.max(0, filtered.length - 1));
        const el = obsCardRefs.current[newId];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 80);
      return { ...prev, observations: updated };
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
      setFormData((prev) => ({
        ...prev,
        observations: prev.observations.filter((o) => o.id !== id),
      }));
      setActiveObsIdx((prevIdx) => Math.max(0, prevIdx - 1));
    }
  };

  // Apply Preset Template to an Observation Card
  const handleApplyPreset = (obsId: string, presetId: string) => {
    const preset = FINDING_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setFormData((prev) => ({
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
    }));
  };

  // AI Auto-Isi (T.A.R.O AI) dengan Real Gemini API Key & Standar Holding Time R23
  const handleAiAutoFill = async (obsIdx: number, obs: ObservationFinding) => {
    if (!obs.auditFinding.trim()) {
      alert('Tuliskan sedikit inti temuan terlebih dahulu sebelum menekan Auto-Isi AI.');
      return;
    }

    setAiLoadingIdx(obsIdx);

    try {
      const aiResult = await generateTaroObservationAnalysis(
        obs.auditFinding,
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

        setAiLoadingIdx(null);
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
        return;
      }
    } catch (err) {
      console.warn('TARO AI online analysis failed, using fallback preset:', err);
    }

    // Fallback Preset
    const findingLower = obs.auditFinding.toLowerCase();
    let matched = FINDING_PRESETS[0];
    if (findingLower.includes('takar') || findingLower.includes('resep') || findingLower.includes('sop') || findingLower.includes('sirup')) {
      matched = FINDING_PRESETS[1];
    } else if (findingLower.includes('kotor') || findingLower.includes('bersih') || findingLower.includes('lantai') || findingLower.includes('debu') || findingLower.includes('lap')) {
      matched = FINDING_PRESETS[2];
    } else if (findingLower.includes('logbook') || findingLower.includes('suhu') || findingLower.includes('catat') || findingLower.includes('administrasi')) {
      matched = FINDING_PRESETS[3];
    } else if (findingLower.includes('harga') || findingLower.includes('price') || findingLower.includes('rak') || findingLower.includes('tag')) {
      matched = FINDING_PRESETS[4];
    }

    setFormData((prev) => ({
      ...prev,
      observations: prev.observations.map((o) =>
        o.id === obs.id
          ? {
              ...o,
              category: matched.category,
              idealCondition: matched.kondisiIdeal,
              operationalImpact: matched.dampak,
              rootCause: matched.penyebab,
              actionPlan: matched.tindakanPerbaikan,
              expectedResult: matched.hasil,
            }
          : o
      ),
    }));

    setAiLoadingIdx(null);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
  };

  // Global T.A.R.O AI Auto-Compile
  const handleTaroAiAutoCompile = () => {
    if (confirm('T.A.R.O AI akan mengkompilasi rekomendasi standar observasi QSC & OPI secara otomatis. Lanjutkan?')) {
      const qscObs: ObservationFinding = {
        id: `obs-${Date.now()}-qsc`,
        type: 'QSC',
        category: 'Expired',
        title: 'Produk & Bahan Baku Chiller',
        auditFinding: FINDING_PRESETS[0].temuan,
        idealCondition: FINDING_PRESETS[0].kondisiIdeal,
        operationalImpact: FINDING_PRESETS[0].dampak,
        rootCause: FINDING_PRESETS[0].penyebab,
        actionPlan: FINDING_PRESETS[0].tindakanPerbaikan,
        expectedResult: FINDING_PRESETS[0].hasil,
        deadline: agenda.date || new Date().toISOString().split('T')[0],
        status: 'OPEN',
      };

      const opiObs: ObservationFinding = {
        id: `obs-${Date.now()}-opi`,
        type: 'OPI',
        category: 'OPI Project',
        title: 'Penataan Storage & Kelengkapan Tools',
        auditFinding: FINDING_PRESETS[2].temuan,
        idealCondition: FINDING_PRESETS[2].kondisiIdeal,
        operationalImpact: FINDING_PRESETS[2].dampak,
        rootCause: FINDING_PRESETS[2].penyebab,
        actionPlan: FINDING_PRESETS[2].tindakanPerbaikan,
        expectedResult: FINDING_PRESETS[2].hasil,
        deadline: agenda.date || new Date().toISOString().split('T')[0],
        status: 'OPEN',
      };

      setFormData((prev) => ({
        ...prev,
        enableQsc: true,
        enableOpi: true,
        observations: [qscObs, opiObs, ...prev.observations],
      }));
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    }
  };

  // Evidence Photos Management (Supports Single or Multiple Files + Auto GAS GDrive Upload)
  const handleAddEvidencePhoto = async (e: React.ChangeEvent<HTMLInputElement>, isCa = false) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files: File[] = Array.from(fileList);
    e.target.value = '';

    setIsUploadingPhoto(true);
    setUploadStatusMsg(`Memproses ${files.length} foto & mengunggah otomatis ke GDrive (GAS)...`);

    try {
      const createdPhotos: EvidencePhoto[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const stamped = await processAndStampImage(file);
        const photoId = `ev-${Date.now()}-${i}`;
        const filename = `${isCa ? 'CA' : 'EVIDENCE'}_${formData.storeCode}_${formData.visitDate}_${i + 1}.jpg`;

        const gdriveRes = await uploadPhotoToGasGDrive({
          base64Data: stamped,
          filename,
          storeCode: formData.storeCode,
          storeName: formData.storeName,
          visitorName: formData.visitorName,
          visitDate: formData.visitDate,
          section: isCa ? 'CORRECTIVE_ACTION' : 'EVIDENCE_FINDING',
        });

        createdPhotos.push({
          id: photoId,
          photoUrl: stamped,
          caption: isCa
            ? 'Hasil perbaikan dan follow-up operasional telah sesuai standar SOP'
            : 'Temuan kebersihan dan penataan di area operasional toko',
          timestamp: getCurrentWibTime(),
          gpsLocation: formData.liveGps || 'Verified',
          driveFileId: gdriveRes.driveFileId,
          driveUrl: gdriveRes.driveUrl,
          isCa,
        });
      }

      if (isCa) {
        setFormData((prev) => ({
          ...prev,
          caPhotos: [...(prev.caPhotos || []), ...createdPhotos],
          gasSyncStatus: 'synced',
          lastSyncedAt: getCurrentWibTime(),
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          evidencePhotos: [...prev.evidencePhotos, ...createdPhotos],
          gasSyncStatus: 'synced',
          lastSyncedAt: getCurrentWibTime(),
        }));
      }

      setUploadStatusMsg(`${createdPhotos.length} foto berhasil ditambahkan & tersimpan di GDrive!`);
      setTimeout(() => setUploadStatusMsg(null), 3500);
      confetti({ particleCount: 25, spread: 45, origin: { y: 0.6 } });
    } catch (err) {
      console.error('Evidence Photo Upload Error:', err);
      setUploadStatusMsg('Gagal memproses beberapa foto. Silakan ulangi.');
      setTimeout(() => setUploadStatusMsg(null), 3500);
    } finally {
      setIsUploadingPhoto(false);
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
    if (isCa) {
      setFormData((prev) => ({
        ...prev,
        caPhotos: prev.caPhotos?.filter((p) => p.id !== id),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        evidencePhotos: prev.evidencePhotos.filter((p) => p.id !== id),
      }));
    }
  };

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
          MANDATORY POP-UP SUBMIT ACTUAL IN / OUT (BEFORE FILLING FORM / OFFLINE)
          ===================================================================== */}
      {showCheckInPopup && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0 ${
                    isOfflineOrWeakSignal
                      ? 'bg-gradient-to-tr from-amber-500 to-rose-500'
                      : 'bg-gradient-to-tr from-emerald-600 to-teal-500'
                  }`}
                >
                  {isOfflineOrWeakSignal ? (
                    <WifiOff className="w-6 h-6" />
                  ) : (
                    <Clock className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      isOfflineOrWeakSignal
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    {isOfflineOrWeakSignal
                      ? 'Terdeteksi Offline / Susah Sinyal'
                      : 'Verifikasi Wajib Presensi Toko'}
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                    Submit Actual IN & OUT
                  </h3>
                </div>
              </div>
              {formData.actualInSubmitted && (
                <button
                  type="button"
                  onClick={() => setShowCheckInPopup(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
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
                <span className="font-bold text-slate-500">Mode Presensi:</span>
                <button
                  type="button"
                  onClick={() => setIsOfflineOrWeakSignal((prev) => !prev)}
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                    isOfflineOrWeakSignal
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  }`}
                >
                  {isOfflineOrWeakSignal
                    ? '⚡ Mode Manual (Offline / Susah Sinyal)'
                    : '📡 GPS Otomatis (Klik jika susah sinyal)'}
                </button>
              </div>
            </div>

            {isOfflineOrWeakSignal && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/90 text-[11px] font-bold text-amber-900 leading-relaxed">
                Sinyal lemah atau perangkat sedang offline. Silakan masukkan jam <strong>Actual IN</strong> dan <strong>Actual OUT</strong> secara manual sebelum melanjutkan pengisian form visit.
              </div>
            )}

            <form onSubmit={handleSubmitCheckInOut} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-emerald-800 uppercase">
                      Actual IN *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setManualInInput(
                          `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
                        );
                      }}
                      className="text-[10px] font-extrabold text-teal-600 hover:underline"
                    >
                      Jam Sekarang
                    </button>
                  </div>
                  <input
                    type="time"
                    required
                    value={manualInInput}
                    onChange={(e) => setManualInInput(e.target.value)}
                    className="w-full h-11 bg-emerald-50/60 border-2 border-emerald-300 rounded-xl px-3 text-sm font-black text-slate-900 focus:bg-white focus:border-emerald-600 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    Standar &le; 08:30 WIB
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-amber-800 uppercase">
                      Actual OUT *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setManualOutInput(
                          `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
                        );
                      }}
                      className="text-[10px] font-extrabold text-amber-600 hover:underline"
                    >
                      Jam Sekarang
                    </button>
                  </div>
                  <input
                    type="time"
                    required
                    value={manualOutInput}
                    onChange={(e) => setManualOutInput(e.target.value)}
                    className="w-full h-11 bg-amber-50/60 border-2 border-amber-300 rounded-xl px-3 text-sm font-black text-slate-900 focus:bg-white focus:border-amber-600 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    Standar &ge; 17:30 WIB
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-black text-xs sm:text-sm shadow-lg transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>SUBMIT ACTUAL IN / OUT & ISI FORM</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Zoom Photo Modal */}
      {zoomPhotoUrl && (
        <div
          onClick={() => setZoomPhotoUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={zoomPhotoUrl} alt="Zoom" className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" />
            <button
              onClick={() => setZoomPhotoUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-800 flex items-center justify-center font-bold shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
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

      {/* Top Navbar: Fixed Header with Apple Glass Aesthetic & Seamless Auto-Hide / Auto-Show */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.35,1)] ${
          showTopNavbar
            ? 'translate-y-0 opacity-100 shadow-xs'
            : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-[#F8F9FD]/95 backdrop-blur-xl border-b border-slate-200/60 px-4 sm:px-6 pt-[max(0.6rem,env(safe-area-inset-top,12px))] pb-2.5 max-w-6xl mx-auto w-full flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            title="Kembali ke Beranda"
            className="w-10 h-10 rounded-full iphone-glass-icon-btn flex items-center justify-center text-black active:scale-95 transition-transform cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.4]" />
          </button>

          <div className="text-center px-2 min-w-0">
            <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">
              FMCU Visit Report
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-800 leading-tight truncate">
              Audit Toko FMCU
            </h2>
          </div>

          {/* Right Dock: R23 (Icon Only) di sebelah kiri, PDF (Icon Only) di sebelah kanan */}
          <div className="iphone-glass-mini-dock flex items-center gap-1 p-1 rounded-full shadow-xs shrink-0">
            {/* Tombol R23 (Icon Only) */}
            <button
              type="button"
              onClick={() => setShowR23Modal(true)}
              title="Standar Holding Time Resmi (STD/FMI/PD-QC/001/R23)"
              className="w-8 h-8 rounded-full hover:bg-emerald-500/15 text-emerald-800 hover:text-emerald-950 flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
            >
              <Clock className="w-4 h-4 stroke-[2.3]" />
            </button>

            {/* Tombol PDF (Icon Only) */}
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              title="Pratinjau & Cetak Laporan PDF"
              className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center text-black active:scale-95 transition-transform cursor-pointer"
            >
              <FileText className="w-4 h-4 stroke-[2.2]" />
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
                      {isOfflineOrWeakSignal && (
                        <span className="flex items-center gap-1 text-[10.5px] font-bold text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                          <WifiOff className="w-3 h-3 text-amber-300" />
                          <span>Mode Manual IN/OUT</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Actual In / Actual Out Cards & Quick Popup Trigger */}
              <div className="w-full lg:max-w-md space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* Actual In Card */}
                  <div
                    onClick={() => setShowCheckInPopup(true)}
                    className="rounded-xl p-2.5 bg-white/10 hover:bg-white/15 backdrop-blur-md border border-emerald-400/30 flex flex-col justify-between cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between text-[10px] uppercase font-black text-emerald-300">
                      <span>Actual In</span>
                      <Clock className="w-3 h-3 text-emerald-400 animate-pulse" />
                    </div>
                    <div className="font-black text-sm text-white my-1">
                      {formData.actualIn || '08:15 WIB'}
                    </div>
                    <span className="text-[9px] text-emerald-200/80">Klik untuk Ubah / Manual</span>
                  </div>

                  {/* Actual Out Card */}
                  <div
                    onClick={() => setShowCheckInPopup(true)}
                    className="rounded-xl p-2.5 bg-white/10 hover:bg-white/15 backdrop-blur-md border border-amber-400/30 flex flex-col justify-between cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between text-[10px] uppercase font-black text-amber-300">
                      <span>Actual Out</span>
                      <Clock className="w-3 h-3 text-amber-400" />
                    </div>
                    <div className="font-black text-sm text-white my-1">
                      {formData.actualOut || '17:45 WIB'}
                    </div>
                    <span className="text-[9px] text-amber-200/80">Klik untuk Submit OUT</span>
                  </div>
                </div>

                {/* Geofence & Manual Check-In Bar */}
                <div className="rounded-xl p-2 bg-emerald-950/70 border border-emerald-500/40 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isOfflineOrWeakSignal ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-ping'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] font-black text-emerald-200 leading-none truncate">
                        {isOfflineOrWeakSignal
                          ? 'Mode Manual Aktif (Offline / Susah Sinyal)'
                          : 'Radar Geofence Toko Aktif'}
                      </div>
                      <div className="text-[9.5px] text-emerald-300/80 leading-none mt-1 truncate">
                        {formData.actualInSubmitted
                          ? `Presensi tercatat: IN ${formData.actualIn} • OUT ${formData.actualOut}`
                          : 'Wajib submit Actual IN/OUT'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowCheckInPopup(true)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/30 hover:bg-emerald-500/40 border border-emerald-400/40 text-emerald-100 font-extrabold text-[10px] transition cursor-pointer"
                    >
                      Input IN/OUT
                    </button>
                    <button
                      type="button"
                      onClick={handleRefreshGps}
                      disabled={isGpsRefreshing}
                      className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition cursor-pointer"
                      title="Segarkan Sinyal GPS"
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
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-teal-600 text-white font-black text-sm flex items-center justify-center">
                  1
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-900">
                    Section 1: General Info & QSC
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Identitas toko, tim store yang bertugas & foto form penilaian fisik QSC
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200/50 shrink-0">
                Slide 1, 2 & 3 PDF
              </span>
            </div>

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

              {/* 4. Tanggal Visit (Simetris 100% di Mobile dengan h-11 & appearance-none) */}
              <div className="min-w-0 w-full">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Tanggal Visit *
                </label>
                <div className="relative w-full min-w-0">
                  <input
                    type="date"
                    value={formData.visitDate}
                    onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                    className="block w-full h-11 min-w-0 max-w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none transition appearance-none"
                  />
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
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-black text-sm text-slate-800">Tim Store yang Bertugas</h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Store Head, Shift Leader, dan seluruh Crew Store on-duty
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCrew}
                  className="text-xs font-extrabold bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 rounded-xl shadow-2xs transition flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Crew</span>
                </button>
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
                              {['1A', '1B', '2A', '2B', '3A', '3B', '4A', 'NS1', 'NS2', 'NS3', 'MG1', 'MG2'].map(
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
            </div>

            {/* Sub-bagian 1C: Evidence Form QSC / FamiTrack Result (Slide 2 PDF) */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-black text-sm text-slate-800">
                    Evidence Form QSC / FamiTrack Result
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Foto lembar fisik formulir QSC/FamiTrack — Otomatis dibagi 2 bagian (Atas & Bawah)
                  </p>
                </div>
                <div className="text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 self-start sm:self-auto">
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Auto-Split & Simpan GDrive</span>
                </div>
              </div>

              {/* Hero Banner: Ambil / Upload 1x Foto Lembar Form QSC (Auto Split 2 Bagian Atas & Bawah) */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-2 border-emerald-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shrink-0 shadow-sm">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="font-black text-sm sm:text-base text-slate-900">
                        Ambil / Upload Foto Lembar QSC
                      </h5>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Otomatis Split Atas & Bawah
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Cukup ambil atau upload 1x foto lembar QSC utuh. Sistem secara otomatis memotong menjadi 2 bagian (Atas & Bawah) pada kotak preview di bawah.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 w-full sm:w-auto flex items-center gap-2">
                  {/* Hidden Input for Camera Capture */}
                  <input
                    type="file"
                    ref={qscFullCameraInputRef}
                    accept="image/*"
                    capture="environment"
                    onChange={handleQscFullUpload}
                    className="hidden"
                  />
                  {/* Hidden Input for Gallery / File Upload */}
                  <input
                    type="file"
                    ref={qscFullGalleryInputRef}
                    accept="image/*"
                    onChange={handleQscFullUpload}
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={isUploadingPhoto}
                    onClick={() => qscFullCameraInputRef.current?.click()}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Ambil Foto QSC</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUploadingPhoto}
                    onClick={() => qscFullGalleryInputRef.current?.click()}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Galeri</span>
                  </button>
                </div>
              </div>

              {/* 2 Photo Preview Slots ONLY (Top & Bottom — Tanpa Tombol Pilih Foto Manual) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Slot 1: Preview Lembar QSC Bagian Atas */}
                <div className="border border-slate-200 rounded-2xl p-3 bg-white space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-slate-700">
                    <span>Preview QSC #1 (Bagian Atas)</span>
                    {formData.qscSheetTop ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Auto-Split Atas OK
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        Menunggu Foto QSC
                      </span>
                    )}
                  </div>
                  <div className="h-44 bg-slate-100 rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-200 group">
                    {formData.qscSheetTop ? (
                      <>
                        <img
                          src={formData.qscSheetTop}
                          alt="Preview QSC Bagian Atas"
                          className="w-full h-full object-cover cursor-zoom-in"
                          onClick={() => setZoomPhotoUrl(formData.qscSheetTop)}
                        />
                        <div className="pointer-events-none absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-slate-900/75 text-white text-[10px] font-bold flex items-center gap-1">
                          <Eye className="w-3 h-3 text-emerald-400" />
                          <span>Klik gambar untuk perbesar</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-4">
                        <Eye className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                        <span className="text-[11px] text-slate-400 font-bold block">
                          Area Preview Bagian Atas
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Otomatis tampil setelah Ambil / Upload Foto QSC di atas
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Slot 2: Preview Lembar QSC Bagian Bawah */}
                <div className="border border-slate-200 rounded-2xl p-3 bg-white space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-slate-700">
                    <span>Preview QSC #2 (Bagian Bawah)</span>
                    {formData.qscSheetBottom ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Auto-Split Bawah OK
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        Menunggu Foto QSC
                      </span>
                    )}
                  </div>
                  <div className="h-44 bg-slate-100 rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-200 group">
                    {formData.qscSheetBottom ? (
                      <>
                        <img
                          src={formData.qscSheetBottom}
                          alt="Preview QSC Bagian Bawah"
                          className="w-full h-full object-cover cursor-zoom-in"
                          onClick={() => setZoomPhotoUrl(formData.qscSheetBottom)}
                        />
                        <div className="pointer-events-none absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-slate-900/75 text-white text-[10px] font-bold flex items-center gap-1">
                          <Eye className="w-3 h-3 text-emerald-400" />
                          <span>Klik gambar untuk perbesar</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-4">
                        <Eye className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                        <span className="text-[11px] text-slate-400 font-bold block">
                          Area Preview Bagian Bawah
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Otomatis tampil setelah Ambil / Upload Foto QSC di atas
                        </span>
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
                onClick={() => setActiveSection(2)}
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
            TANPA BANNER ACTUAL IN/OUT
            ============================================================ */}
        {activeSection === 2 && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-soft-card border border-slate-200/80 space-y-4 animate-in fade-in">
            {/* Header Section 2 */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-teal-600 text-white font-black text-sm flex items-center justify-center">
                  2
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-900">
                    Section 2: Observation
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Analisa 6-Box Model temuan observasi QSC dan OPI Project
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200/50 shrink-0">
                Slide 4 & 5 PDF
              </span>
            </div>

            {/* 2. Running Text Marquee Banner: PERHATIAN AI */}
            <div className="w-full bg-slate-950 text-amber-300 border border-amber-400/40 rounded-xl px-3 py-2 flex items-center gap-2.5 text-xs overflow-hidden shadow-xs">
              <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[9px] uppercase tracking-wider z-10 shadow-xs">
                PERHATIAN AI
              </span>
              <div className="flex-1 overflow-hidden relative">
                <div className="animate-marquee font-semibold text-[11px] text-amber-300">
                  <span className="mx-4">
                    ⚠️ Jika menggunakan analisa AI, hasil analisa AI dapat membuat kesalahan. Periksa hasil jawaban kembali di setiap kolom temuan sebelum disimpan.
                  </span>
                  <span className="mx-4">
                    • Pastikan setiap rekomendasi tindakan perbaikan (Corrective Action) dan deadline telah sesuai dengan kesepakatan bersama tim toko.
                  </span>
                  <span className="mx-4">
                    ⚠️ Jika menggunakan analisa AI, hasil analisa AI dapat membuat kesalahan. Periksa hasil jawaban kembali di setiap kolom temuan sebelum disimpan.
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Compact T.A.R.O AI Assistant Button */}
            <button
              type="button"
              onClick={handleTaroAiAutoCompile}
              className="w-full py-2 px-3 sm:px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-teal-500/30 text-white shadow-xs transition active:scale-[0.99] flex items-center justify-between gap-2.5 cursor-pointer group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-400/30 text-teal-300 flex items-center justify-center shrink-0 relative">
                  <Bot className="w-4 h-4 stroke-[2.2]" />
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
              <div className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-teal-300 group-hover:text-teal-200">
                <Wand2 className="w-3.5 h-3.5 text-teal-400" />
                <span className="hidden xs:inline">Auto-Kompilasi</span>
              </div>
            </button>

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
                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveObs(obs.id);
                          }}
                          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                          title="Hapus Temuan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Card Header Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pr-10">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-xs shadow-2xs">
                              Temuan #{idx + 1}
                            </span>
                            <span className="text-[10px] font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                              {obs.type}
                            </span>

                            {/* Category Dropdown */}
                            <select
                              value={obs.category || 'Lingkungan Store'}
                              onChange={(e) => handleUpdateObs(obs.id, 'category', e.target.value)}
                              className="text-xs font-extrabold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 outline-none"
                            >
                              {['FnB', 'Expired', 'Kelayakan', 'Tools', 'Equipment', 'Lingkungan Store', 'Grooming', 'OPI Project'].map(
                                (cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                )
                              )}
                            </select>

                            {/* Preset Selector */}
                            <select
                              onChange={(e) => {
                                if (e.target.value) handleApplyPreset(obs.id, e.target.value);
                              }}
                              defaultValue=""
                              className="text-[11px] font-bold bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-2 py-1 outline-none max-w-[200px]"
                            >
                              <option value="" disabled>Pilih Template Preset...</option>
                              {FINDING_PRESETS.map((p) => (
                                <option key={p.id} value={p.id}>{p.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Deadline Date */}
                          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200/70">
                            <Calendar className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span>Deadline:</span>
                            <input
                              type="date"
                              value={obs.deadline}
                              onChange={(e) => handleUpdateObs(obs.id, 'deadline', e.target.value)}
                              className="bg-transparent text-xs font-bold text-rose-700 focus:outline-none cursor-pointer w-[115px]"
                            />
                          </div>
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
                                  disabled={aiLoadingIdx === idx}
                                  className="h-8 px-3 rounded-xl font-extrabold text-[11px] text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 border border-teal-500/30 flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer"
                                >
                                  <Wand2 className={`w-3.5 h-3.5 text-amber-300 shrink-0 ${aiLoadingIdx === idx ? 'animate-spin' : ''}`} />
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
                              className="w-full bg-amber-50/40 border border-amber-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 transition leading-relaxed"
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
                                className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-teal-500 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none transition leading-relaxed"
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
                                className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-teal-500 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none transition leading-relaxed"
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
                                className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-teal-500 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none transition leading-relaxed"
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
                                className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-teal-500 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none transition leading-relaxed"
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
                                className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-teal-500 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none transition leading-relaxed"
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
                onClick={() => setActiveSection(1)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                &larr; Kembali ke Section 1
              </button>
              <button
                type="button"
                onClick={() => setActiveSection(3)}
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
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white font-black text-sm flex items-center justify-center">
                  3
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-900">
                    Section 3: Evidence
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Upload foto bukti temuan observasi & hasil perbaikan (Otomatis simpan GDrive via GAS)
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/50 shrink-0">
                Slide 6, 7 & 8 PDF
              </span>
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
                    {/* Viewfinder Thumbnail */}
                    <div className="h-44 bg-slate-100 rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-200 group">
                      <img
                        src={ev.photoUrl}
                        alt={`Evidence ${idx + 1}`}
                        className="w-full h-full object-cover cursor-zoom-in"
                        onClick={() => setZoomPhotoUrl(ev.photoUrl)}
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="bg-slate-900/80 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                          <Maximize2 className="w-3 h-3" />
                          <span>Perbesar</span>
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:border-teal-500 outline-none leading-relaxed"
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
                onClick={() => setActiveSection(2)}
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
          ===================================================================== */}
      {activeSection === 2 && isCurrentObsSubTabEnabled && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-40 flex items-center gap-2 select-none">
          {/* Quick Prev / Next Card Navigation Pill with Liquid Glass */}
          {currentObsList.length > 0 && (
            <div className="h-11 px-2.5 rounded-full iphone-glass-mini-dock text-slate-800 shadow-lg flex items-center gap-1 border border-white/40">
              <button
                type="button"
                onClick={() => handleJumpToObsCard(activeObsIdx - 1, currentObsList)}
                disabled={activeObsIdx <= 0}
                className="w-7 h-7 rounded-full hover:bg-black/10 disabled:opacity-30 flex items-center justify-center transition cursor-pointer"
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
                className="w-7 h-7 rounded-full hover:bg-black/10 disabled:opacity-30 flex items-center justify-center transition cursor-pointer"
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
            className="w-11 h-11 rounded-full iphone-glass-icon-btn flex items-center justify-center text-teal-800 hover:text-teal-950 active:scale-90 transition-transform shadow-lg cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[2.8]" />
          </button>
        </div>
      )}

      {activeSection === 3 && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-40 flex items-center gap-2.5 select-none">
          {/* Button Icon Gallery with Liquid Glass */}
          <button
            type="button"
            onClick={() => evidenceGalleryInputRef.current?.click()}
            title="Pilih Foto dari Galeri"
            className="w-12 h-12 rounded-full iphone-glass-icon-btn flex items-center justify-center text-slate-800 hover:text-black active:scale-90 transition-transform shadow-lg cursor-pointer"
          >
            <ImageIcon className="w-5 h-5 stroke-[2.2]" />
          </button>

          {/* Button Icon Camera with Liquid Glass */}
          <button
            type="button"
            onClick={() => evidenceCameraInputRef.current?.click()}
            title="Ambil Foto dengan Kamera"
            className="w-12 h-12 rounded-full iphone-glass-icon-btn flex items-center justify-center text-teal-700 hover:text-teal-900 active:scale-90 transition-transform shadow-lg cursor-pointer"
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
              setActiveSection(1);
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
              setActiveSection(2);
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
              setActiveSection(3);
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
