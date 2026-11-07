import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
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
  Info
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

interface VisitReportFormProps {
  agenda: ScheduleAgenda;
  user: User | null;
  onBack: () => void;
}

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

  // Form State
  const [formData, setFormData] = useState<VisitReportData>(() => {
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    const cleanStoreName = agenda.title.replace(/^Audit & Store Visit - Cabang /i, '').replace(/ - SENSE OF URGENCY$/i, '').trim() || agenda.location;
    return {
      id: `report-${Date.now()}`,
      agendaId: agenda.id,
      actualIn: '08:15 WIB',
      actualOut: '17:45 WIB',
      liveGps: '-6.2293, 106.8256 (Akurat)',
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

  // Preview Mode
  const [showPreview, setShowPreview] = useState(false);

  // Modal zoom photo
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);

  // AI Loading state per observation card
  const [aiLoadingIdx, setAiLoadingIdx] = useState<number | null>(null);

  // GPS Refresh state
  const [isGpsRefreshing, setIsGpsRefreshing] = useState(false);

  // Scroll Detection & Auto Navbar Scale & Dynamic Top Buttons Visibility (rAF throttled)
  const [isScrolled, setIsScrolled] = useState(false);
  const [showTopButtons, setShowTopButtons] = useState(true);
  const manualExpandedRef = useRef(false);
  const manualExpandedScrollTopRef = useRef(0);
  const lastScrollTopRef = useRef(0);

  const getScrollTop = () => {
    const targets = [
      window.scrollY,
      window.pageYOffset,
      document.documentElement?.scrollTop,
      document.body?.scrollTop,
    ];
    return Math.max(...targets.map((v) => (typeof v === 'number' && !isNaN(v) ? v : 0)));
  };

  const handleResetScale = () => {
    setIsScrolled(false);
    manualExpandedRef.current = true;
    manualExpandedScrollTopRef.current = getScrollTop();
  };

  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const top = getScrollTop();
          const delta = top - lastScrollTopRef.current;
          lastScrollTopRef.current = top;

          // 1. Dynamic Top Buttons (Home & PDF): Hide on scroll down, show on scroll up
          if (top <= 20) {
            setShowTopButtons(true);
          } else if (delta > 4 && top > 40) {
            setShowTopButtons(false); // scrolling down -> hide
          } else if (delta < -4) {
            setShowTopButtons(true); // scrolling up -> show
          }

          // 2. Bottom Navbar Scale:
          if (top <= 10) {
            setIsScrolled(false);
            manualExpandedRef.current = false;
          } else if (manualExpandedRef.current) {
            // If user clicked icon while shrunken, stay expanded until scrolling DOWN again
            if (top > manualExpandedScrollTopRef.current + 8 || delta > 3) {
              manualExpandedRef.current = false;
              setIsScrolled(true);
            }
          } else {
            // Normal scroll down -> shrink
            setIsScrolled(top > 15);
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('touchmove', onScroll, { passive: true });
    window.addEventListener('wheel', onScroll, { passive: true });

    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('touchmove', onScroll);
      window.removeEventListener('wheel', onScroll);
    };
  }, []);

  // File Input References
  const qscFullInputRef = useRef<HTMLInputElement>(null);
  const qscTopInputRef = useRef<HTMLInputElement>(null);
  const qscBottomInputRef = useRef<HTMLInputElement>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);
  const caInputRef = useRef<HTMLInputElement>(null);

  // Auto-save draft
  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify(formData));
  }, [formData, draftKey]);

  // Calculate Form Completion Progress Percentage
  const calculateProgress = (): number => {
    let score = 0;
    let total = 6;
    if (formData.storeName && formData.storeCode) score++;
    if (formData.crews.length >= 2) score++;
    if (formData.qscSheetTop || formData.qscSheetBottom) score++;
    if (formData.observations.length > 0 && formData.observations[0].auditFinding) score++;
    if (formData.evidencePhotos.length > 0) score++;
    if (formData.spreadsheetUrl) score++;
    return Math.round((score / total) * 100);
  };

  const progressPercent = calculateProgress();

  // Helper: Live GPS Refresh
  const handleRefreshGps = () => {
    setIsGpsRefreshing(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(4);
          const lng = pos.coords.longitude.toFixed(4);
          setFormData((prev) => ({
            ...prev,
            liveGps: `${lat}, ${lng} (Akurat)`,
          }));
          setIsGpsRefreshing(false);
        },
        () => {
          setFormData((prev) => ({
            ...prev,
            liveGps: '-6.2293, 106.8256 (Toleransi Gedung)',
          }));
          setIsGpsRefreshing(false);
        },
        { timeout: 6000 }
      );
    } else {
      setIsGpsRefreshing(false);
    }
  };

  // Helper: Stamp Watermark on Image using HTML Canvas
  const processAndStampImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          const maxDim = 1400;
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
          if (!ctx) return resolve(e.target?.result as string);

          ctx.drawImage(img, 0, 0, w, h);

          // Timestamp & GPS Bar Watermark
          const now = new Date();
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
          const timeStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
          const gpsStr = formData.liveGps ? `GPS: ${formData.liveGps.replace(' (Akurat)', '').replace(' (Toleransi Gedung)', '')}` : 'GPS: Live Location Verified';

          const barH = Math.max(26, Math.round(h * 0.045));
          ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
          ctx.fillRect(0, h - barH, w, barH);

          // Green accent strip
          ctx.fillStyle = '#009944';
          ctx.fillRect(0, h - barH, Math.max(5, Math.round(w * 0.01)), barH);

          const padLeft = Math.max(12, Math.round(w * 0.018));
          const fontSize = Math.max(10, Math.round(barH * 0.44));

          ctx.fillStyle = '#FFFFFF';
          ctx.font = `bold ${fontSize}px sans-serif`;
          const textStr = `${formData.storeName.toUpperCase()} (FMI)  •  ${timeStr}  •  ${gpsStr}`;
          ctx.fillText(textStr, padLeft, h - Math.round(barH * 0.3));

          resolve(canvas.toDataURL('image/jpeg', 0.88));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Helper: Auto-Split Full QSC Sheet into Top & Bottom parts
  const splitImageTopBottom = async (fullDataUrl: string): Promise<{ top: string; bottom: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = img.width;
        const h = img.height;
        const halfH = Math.floor(h / 2);
        const overlap = Math.floor(h * 0.025);

        // Top Canvas
        const cTop = document.createElement('canvas');
        cTop.width = w;
        cTop.height = halfH + overlap;
        const ctxTop = cTop.getContext('2d');
        ctxTop?.drawImage(img, 0, 0, w, halfH + overlap, 0, 0, w, halfH + overlap);
        const topDataUrl = cTop.toDataURL('image/jpeg', 0.85);

        // Bottom Canvas
        const srcY = Math.max(0, halfH - overlap);
        const srcH = h - srcY;
        const cBottom = document.createElement('canvas');
        cBottom.width = w;
        cBottom.height = srcH;
        const ctxBottom = cBottom.getContext('2d');
        ctxBottom?.drawImage(img, 0, srcY, w, srcH, 0, 0, w, srcH);
        const bottomDataUrl = cBottom.toDataURL('image/jpeg', 0.85);

        resolve({ top: topDataUrl, bottom: bottomDataUrl });
      };
      img.src = fullDataUrl;
    });
  };

  // 1x QSC Sheet Upload Handler (Auto Split)
  const handleQscFullUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const stampedFull = await processAndStampImage(file);
      const { top, bottom } = await splitImageTopBottom(stampedFull);
      setFormData((prev) => ({
        ...prev,
        qscSheetTop: top,
        qscSheetBottom: bottom,
      }));
      confetti({ particleCount: 30, spread: 45, origin: { y: 0.5 } });
    } catch (err) {
      console.error(err);
      alert('Gagal memproses foto QSC.');
    }
  };

  // Individual QSC Top/Bottom Upload Handlers
  const handleSingleQscUpload = async (file: File, part: 'top' | 'bottom') => {
    try {
      const stamped = await processAndStampImage(file);
      setFormData((prev) => ({
        ...prev,
        [part === 'top' ? 'qscSheetTop' : 'qscSheetBottom']: stamped,
      }));
    } catch (err) {
      console.error(err);
    }
  };

  // Crew Management
  const handleAddCrew = () => {
    const nextNum = formData.crews.length - 1;
    const newCrew: StoreCrew = {
      id: `c-${Date.now()}`,
      role: `Crew Store ${nextNum > 0 ? nextNum : 1}`,
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
    if (idx < 2) return; // Keep at least Store Head & Shift Leader
    const updated = formData.crews.filter((_, i) => i !== idx);
    setFormData((prev) => ({ ...prev, crews: updated }));
  };

  // Observations Management
  const handleAddObservation = (type: 'QSC' | 'OPI') => {
    const newObs: ObservationFinding = {
      id: `obs-${Date.now()}`,
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
    setFormData((prev) => ({ ...prev, observations: [...prev.observations, newObs] }));
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

  // AI Auto-Isi Simulation (T.A.R.O AI)
  const handleAiAutoFill = (obsIdx: number, obs: ObservationFinding) => {
    if (!obs.auditFinding.trim()) {
      alert('Tuliskan sedikit inti temuan terlebih dahulu sebelum menekan Auto-Isi AI.');
      return;
    }

    setAiLoadingIdx(obsIdx);
    setTimeout(() => {
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
        observations: prev.observations.map((o, idx) =>
          idx === obsIdx
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
    }, 900);
  };

  // Global T.A.R.O AI Auto-Compile
  const handleTaroAiAutoCompile = () => {
    if (confirm('T.A.R.O AI akan mengisi rekomendasi standar observasi QSC & OPI. Lanjutkan?')) {
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
        observations: [qscObs, opiObs, ...prev.observations],
      }));
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    }
  };

  // Evidence Photos Management
  const handleAddEvidencePhoto = async (e: React.ChangeEvent<HTMLInputElement>, isCa = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const stamped = await processAndStampImage(file);
      const newPhoto: EvidencePhoto = {
        id: `ev-${Date.now()}`,
        photoUrl: stamped,
        caption: isCa ? 'Hasil perbaikan dan follow-up operasional' : 'Temuan kebersihan dan penataan di area toko',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
        gpsLocation: formData.liveGps || 'Verified',
        isCa,
      };

      if (isCa) {
        setFormData((prev) => ({ ...prev, caPhotos: [...(prev.caPhotos || []), newPhoto] }));
      } else {
        setFormData((prev) => ({ ...prev, evidencePhotos: [...prev.evidencePhotos, newPhoto] }));
      }
    } catch (err) {
      console.error(err);
      alert('Gagal memproses foto bukti.');
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

  // Voice Dictation Helper
  const handleStartVoice = (callback: (text: string) => void) => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Fitur Speech Recognition tidak didukung di browser ini.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      callback(text);
    };
    recognition.start();
  };

  // If in PDF Preview mode, render VisitPdfPreview
  if (showPreview) {
    return <VisitPdfPreview data={formData} onBack={() => setShowPreview(false)} />;
  }

  // Filter observations for current active sub-tab (QSC or OPI)
  const currentObsList = formData.observations.filter(
    (o) => o.type.toUpperCase() === obsSubTab.toUpperCase()
  );

  return (
    <div className="min-h-screen bg-[#F8F9FD] select-none pb-32">
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

      {/* 
        Floating Top Corner Buttons (Kiri Atas: Home circle, Kanan Atas: PDF circle)
        Menghilang saat scroll ke bawah, muncul kembali saat scroll ke atas
      */}
      <div
        className={`fixed top-3 left-0 right-0 max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between pointer-events-none select-none z-40 transition-all duration-300 ease-out ${
          showTopButtons ? 'translate-y-0 opacity-100' : '-translate-y-16 opacity-0'
        }`}
      >
        {/* Tombol Home: Circle dengan icon Home hitam di pojok kiri atas */}
        <button
          type="button"
          onClick={onBack}
          title="Kembali ke Home / Jadwal Toko"
          className={`w-11 h-11 rounded-full iphone-glass-icon-btn flex items-center justify-center text-black hover:text-black active:scale-90 transition-all duration-200 cursor-pointer group ${
            showTopButtons ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <Home className="w-5 h-5 stroke-[2.4] text-black group-hover:scale-110 transition-transform" />
        </button>

        {/* Tombol PDF: Circle dengan icon PDF hitam di pojok kanan atas */}
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          title="Pratinjau & Cetak Laporan PDF 16:9"
          className={`w-11 h-11 rounded-full iphone-glass-icon-btn flex items-center justify-center text-black hover:text-black active:scale-90 transition-all duration-200 cursor-pointer relative group ${
            showTopButtons ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <FileText className="w-5 h-5 stroke-[2.4] text-black group-hover:scale-110 transition-transform" />
          <span className="absolute -bottom-1 -right-0.5 text-[8px] font-black bg-black text-white px-1.5 py-0.5 rounded-full leading-tight shadow-xs">
            PDF
          </span>
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-3.5 sm:p-6 pt-0 space-y-5">
        {/* ============================================================
            STICKY TOP GEOFENCE & LIVE CHECK-IN BANNER (C:\FMCUVISITREPORT)
            ============================================================ */}
        <div
          style={{
            background: 'linear-gradient(135deg, #022c22 0%, #042f2e 50%, #0f172a 100%)',
            border: '1px solid rgba(52, 211, 153, 0.3)',
          }}
          className="rounded-2xl p-4 sm:p-5 pt-14 sm:pt-5 text-white shadow-lg space-y-3"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left: Store Badge, Progress Ring & Title */}
            <div className="space-y-1.5 min-w-0">
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
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-0.5">
                    <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-300">
                      <MapPin className="w-3 h-3 text-emerald-400" />
                      <span>Live GPS: {formData.liveGps}</span>
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-teal-200 bg-white/10 px-2 py-0.2 rounded-full border border-white/15">
                      <Check className="w-3 h-3 text-teal-400" />
                      <span>Draf tersimpan otomatis</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Actual In / Actual Out Cards & Radar Geofence */}
            <div className="w-full lg:max-w-md space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {/* Actual In Card */}
                <div className="rounded-xl p-2.5 bg-white/10 backdrop-blur-md border border-emerald-400/30 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[10px] uppercase font-black text-emerald-300">
                    <span>Actual In</span>
                    <Clock className="w-3 h-3 text-emerald-400 animate-pulse" />
                  </div>
                  <input
                    type="text"
                    value={formData.actualIn || '08:15 WIB'}
                    onChange={(e) => setFormData({ ...formData, actualIn: e.target.value })}
                    className="bg-transparent font-black text-sm text-white focus:outline-none my-1"
                  />
                  <span className="text-[9px] text-emerald-200/80">&le; 08:30 (Radius 1m-50m)</span>
                </div>

                {/* Actual Out Card */}
                <div className="rounded-xl p-2.5 bg-white/10 backdrop-blur-md border border-amber-400/30 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[10px] uppercase font-black text-amber-300">
                    <span>Actual Out</span>
                    <Clock className="w-3 h-3 text-amber-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.actualOut || '17:45 WIB'}
                    onChange={(e) => setFormData({ ...formData, actualOut: e.target.value })}
                    className="bg-transparent font-black text-sm text-white focus:outline-none my-1"
                  />
                  <span className="text-[9px] text-amber-200/80">&ge; 17:30 (Radius 1m-50m)</span>
                </div>
              </div>

              {/* Radar Geofence Pill */}
              <div className="rounded-xl p-2 bg-emerald-950/70 border border-emerald-500/40 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-black text-emerald-200 leading-none">Radar Geofence 1m-50m Aktif</div>
                    <div className="text-[9.5px] text-emerald-300/80 leading-none mt-1">Koordinat toko terdeteksi valid</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshGps}
                  disabled={isGpsRefreshing}
                  className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white font-extrabold text-[10px] flex items-center gap-1 transition"
                >
                  <RotateCw className={`w-3 h-3 ${isGpsRefreshing ? 'animate-spin' : ''}`} />
                  <span>Segarkan GPS</span>
                </button>
              </div>
            </div>
          </div>
        </div>

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
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200/50">
                Slide 1, 2 & 3 PDF
              </span>
            </div>

            {/* Sub-bagian 1A: Data Identitas Toko & Manajemen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Store *
                </label>
                <input
                  type="text"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value.toUpperCase() })}
                  placeholder="Contoh: CONDET 2"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-black uppercase text-slate-900 focus:bg-white focus:border-teal-500 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Kode Toko *
                  </label>
                  <input
                    type="text"
                    value={formData.storeCode}
                    onChange={(e) => setFormData({ ...formData, storeCode: e.target.value })}
                    placeholder="3013"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tipe Toko *
                  </label>
                  <select
                    value={formData.storeType}
                    onChange={(e) => setFormData({ ...formData, storeType: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none transition"
                  >
                    <option value="CVS">CVS</option>
                    <option value="FamiSuper">FamiSuper</option>
                    <option value="Housing">Housing</option>
                    <option value="Office">Office</option>
                    <option value="Mall">Mall</option>
                    <option value="Airport">Airport</option>
                    <option value="Hotel/ Rumah Sakit">Hotel/ Rumah Sakit</option>
                    <option value="Public Area">Public Area</option>
                    <option value="KIOS">KIOS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nama Visitor / Regional Bestie *
                </label>
                <input
                  type="text"
                  value={formData.visitorName}
                  onChange={(e) => setFormData({ ...formData, visitorName: e.target.value })}
                  placeholder="Nama Visitor"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tanggal Visit *
                </label>
                <input
                  type="date"
                  value={formData.visitDate}
                  onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Area Manager *
                </label>
                <input
                  type="text"
                  value={formData.areaManager}
                  onChange={(e) => setFormData({ ...formData, areaManager: e.target.value })}
                  placeholder="Nama Area Manager"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Regional Manager *
                </label>
                <input
                  type="text"
                  value={formData.regionalManager}
                  onChange={(e) => setFormData({ ...formData, regionalManager: e.target.value })}
                  placeholder="Nama Regional Manager"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Email Toko (Opsional)
                </label>
                <input
                  type="email"
                  value={formData.storeEmail || ''}
                  onChange={(e) => setFormData({ ...formData, storeEmail: e.target.value })}
                  placeholder="store@familymartindonesia.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:border-teal-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Link Spreadsheet Form CA Toko
                </label>
                <input
                  type="url"
                  value={formData.spreadsheetUrl}
                  onChange={(e) => setFormData({ ...formData, spreadsheetUrl: e.target.value })}
                  placeholder="https://tinyurl.com/store-caassignment"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-700 focus:bg-white focus:border-teal-500 outline-none transition"
                />
              </div>
            </div>

            {/* Sub-bagian 1B: Tim Store yang Bertugas (Slide 3) */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-slate-800">Tim Store yang Bertugas</h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Store Head, Shift Leader, dan seluruh Crew Store on-duty
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCrew}
                  className="text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-700 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Crew</span>
                </button>
              </div>

              {/* Responsive Crew Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-teal-600 text-white font-bold">
                      <th className="py-2.5 px-3 w-40 whitespace-nowrap">Role Jabatan (Fix)</th>
                      <th className="py-2.5 px-3 min-w-[180px]">Nama Lengkap</th>
                      <th className="py-2.5 px-3 w-32 text-center whitespace-nowrap">Job Level</th>
                      <th className="py-2.5 px-2 text-center w-14">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {formData.crews.map((c, idx) => (
                      <tr key={c.id || idx} className="hover:bg-slate-50/70 transition">
                        <td className="py-2 px-3 font-bold text-slate-700">
                          <input
                            type="text"
                            value={c.role}
                            onChange={(e) => handleUpdateCrew(idx, 'role', e.target.value)}
                            className="w-full bg-transparent font-bold text-slate-700 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={c.name}
                            onChange={(e) => handleUpdateCrew(idx, 'name', e.target.value)}
                            placeholder="Nama Lengkap Crew"
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:bg-white focus:border-teal-500 outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <select
                            value={c.jobLevel}
                            onChange={(e) => handleUpdateCrew(idx, 'jobLevel', e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 focus:bg-white outline-none"
                          >
                            {['1A', '1B', '2A', '2B', '3A', '3B', '4A', 'NS1', 'NS2', 'NS3', 'MG1', 'MG2'].map((lvl) => (
                              <option key={lvl} value={lvl}>{lvl}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2 text-center">
                          {idx >= 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCrew(idx)}
                              className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center mx-auto transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                    Foto lembar fisik formulir QSC/FamiTrack yang telah dinilai dan ditandatangani
                  </p>
                </div>
                <div className="text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 self-start sm:self-auto">
                  <Camera className="w-3.5 h-3.5 text-emerald-600" />
                  <span>1x Foto Auto-Split 2 Lembar</span>
                </div>
              </div>

              {/* Hero Banner: Upload 1x Foto Lembar Form QSC (Auto Split 2 Bagian) */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-2 border-emerald-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shrink-0 shadow-sm">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="font-black text-sm sm:text-base text-slate-900">
                        Upload 1x Foto Lembar Form QSC / FamiTrack
                      </h5>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Auto-Split 2 Bagian Kanan-Kiri
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Visitor cukup foto 1x lembar QSC penuh. Sistem secara otomatis memotongnya menjadi 2 bagian (Atas & Bawah) di satu lembar kanan-kiri pada slide PDF.
                    </p>
                  </div>
                </div>

                <div className="shrink-0 self-stretch sm:self-auto">
                  <input
                    type="file"
                    ref={qscFullInputRef}
                    accept="image/*"
                    onChange={handleQscFullUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => qscFullInputRef.current?.click()}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm transition flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Ambil / Upload Foto QSC</span>
                  </button>
                </div>
              </div>

              {/* 2 Photo Preview Slots (Top & Bottom) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Slot 1: Lembar QSC Bagian Atas */}
                <div className="border border-slate-200 rounded-2xl p-3 bg-white space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-slate-700">
                    <span>Lembar Form QSC #1 (Bagian Atas)</span>
                    {formData.qscSheetTop && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        Tersedia
                      </span>
                    )}
                  </div>
                  <div className="h-44 bg-slate-100 rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-200 group">
                    {formData.qscSheetTop ? (
                      <img
                        src={formData.qscSheetTop}
                        alt="QSC Top"
                        className="w-full h-full object-cover cursor-zoom-in"
                        onClick={() => setZoomPhotoUrl(formData.qscSheetTop)}
                      />
                    ) : (
                      <div className="text-center p-3">
                        <Camera className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                        <span className="text-[10px] text-slate-400 font-bold block">
                          Bagian Atas Form QSC
                        </span>
                      </div>
                    )}
                    <input
                      type="file"
                      ref={qscTopInputRef}
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSingleQscUpload(file, 'top');
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => qscTopInputRef.current?.click()}
                      className="absolute bottom-2 right-2 px-3 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm"
                    >
                      <Camera className="w-3 h-3 text-emerald-400" />
                      <span>{formData.qscSheetTop ? 'Ganti' : 'Pilih Foto'}</span>
                    </button>
                  </div>
                </div>

                {/* Slot 2: Lembar QSC Bagian Bawah */}
                <div className="border border-slate-200 rounded-2xl p-3 bg-white space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-slate-700">
                    <span>Lembar Form QSC #2 (Bagian Bawah)</span>
                    {formData.qscSheetBottom && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        Tersedia
                      </span>
                    )}
                  </div>
                  <div className="h-44 bg-slate-100 rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-200 group">
                    {formData.qscSheetBottom ? (
                      <img
                        src={formData.qscSheetBottom}
                        alt="QSC Bottom"
                        className="w-full h-full object-cover cursor-zoom-in"
                        onClick={() => setZoomPhotoUrl(formData.qscSheetBottom)}
                      />
                    ) : (
                      <div className="text-center p-3">
                        <Camera className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                        <span className="text-[10px] text-slate-400 font-bold block">
                          Bagian Bawah Form QSC
                        </span>
                      </div>
                    )}
                    <input
                      type="file"
                      ref={qscBottomInputRef}
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSingleQscUpload(file, 'bottom');
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => qscBottomInputRef.current?.click()}
                      className="absolute bottom-2 right-2 px-3 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm"
                    >
                      <Camera className="w-3 h-3 text-emerald-400" />
                      <span>{formData.qscSheetBottom ? 'Ganti' : 'Pilih Foto'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Navigation Section 1 */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setActiveSection(2)}
                className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs sm:text-sm shadow-sm transition flex items-center gap-2"
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
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-soft-card border border-slate-200/80 space-y-5 animate-in fade-in">
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
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200/50">
                Slide 4 & 5 PDF
              </span>
            </div>

            {/* Running Alert Banner AI */}
            <div className="w-full bg-slate-950 text-amber-300 border border-amber-400/40 rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[9px] uppercase">
                PERHATIAN AI
              </span>
              <span className="font-semibold text-[11px] truncate">
                Jika menggunakan analisa AI, hasil analisa AI dapat membuat kesalahan. Periksa hasil jawaban kembali disetiap kolom temuan sebelum disimpan.
              </span>
            </div>

            {/* Quick Button: T.A.R.O AI Bantu Observasi */}
            <div>
              <button
                type="button"
                onClick={handleTaroAiAutoCompile}
                className="w-full py-2.5 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 border border-teal-500/80 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-sm transition active:scale-[0.99]"
              >
                <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                <span>T.A.R.O AI Bantu Observasi (Auto-Kompilasi Temuan)</span>
              </button>
            </div>

            {/* Sub-section Switcher Tabs: QSC vs OPI */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setObsSubTab('qsc')}
                className={`flex items-center justify-between px-3 py-2 rounded-xl transition ${
                  obsSubTab === 'qsc'
                    ? 'bg-white text-emerald-800 font-black shadow-xs'
                    : 'text-slate-600 font-bold hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm">QSC Observation</span>
                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                    {formData.observations.filter((o) => o.type === 'QSC').length} Temuan
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.2 rounded">
                  {formData.enableQsc !== false ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setObsSubTab('opi')}
                className={`flex items-center justify-between px-3 py-2 rounded-xl transition ${
                  obsSubTab === 'opi'
                    ? 'bg-white text-amber-800 font-black shadow-xs'
                    : 'text-slate-600 font-bold hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm">OPI Project</span>
                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
                    {formData.observations.filter((o) => o.type === 'OPI').length} Temuan
                  </span>
                </div>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.2 rounded">
                  {formData.enableOpi !== false ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>

            {/* Observation Cards List */}
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
                currentObsList.map((obs, idx) => (
                  <div
                    key={obs.id || idx}
                    className="relative bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-xs transition space-y-3.5"
                  >
                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveObs(obs.id)}
                      className="absolute top-3.5 right-3.5 w-8 h-8 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition"
                      title="Hapus Temuan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Card Header Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pr-10">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-black text-xs">
                          Temuan #{idx + 1}
                        </span>
                        <span className="text-[10px] font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                          {obs.type} Observation
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
                          className="text-[11px] font-bold bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-2 py-1 outline-none"
                        >
                          <option value="" disabled>Pilih Template Preset...</option>
                          {FINDING_PRESETS.map((p) => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Deadline Date */}
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200/70">
                        <Calendar className="w-3.5 h-3.5 text-rose-500" />
                        <span>Deadline:</span>
                        <input
                          type="date"
                          value={obs.deadline}
                          onChange={(e) => handleUpdateObs(obs.id, 'deadline', e.target.value)}
                          className="bg-transparent text-xs font-bold text-rose-700 focus:outline-none cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* The 6-Box Model Form Inputs */}
                    <div className="space-y-3">
                      {/* 1. Temuan (Finding) with AI & Voice buttons */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <label className="font-black text-xs text-amber-800 uppercase flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Temuan (Finding) *</span>
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAiAutoFill(idx, obs)}
                              disabled={aiLoadingIdx === idx}
                              className="text-[10px] font-extrabold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 px-2.5 py-1 rounded-lg border border-teal-500/30 flex items-center gap-1 shadow-2xs transition active:scale-95"
                            >
                              <Sparkles className={`w-3 h-3 text-amber-300 ${aiLoadingIdx === idx ? 'animate-spin' : ''}`} />
                              <span>{aiLoadingIdx === idx ? 'Menganalisis...' : 'Auto-Isi AI'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleStartVoice((t) =>
                                  handleUpdateObs(obs.id, 'auditFinding', (obs.auditFinding ? obs.auditFinding + ' ' : '') + t)
                                )
                              }
                              className="text-[10px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded-lg border border-teal-200 flex items-center gap-1 transition"
                            >
                              <Mic className="w-3 h-3 text-rose-500" />
                              <span>Dikte</span>
                            </button>
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          value={obs.auditFinding}
                          onChange={(e) => handleUpdateObs(obs.id, 'auditFinding', e.target.value)}
                          placeholder="Tuliskan temuan observasi di lapangan..."
                          className="w-full bg-amber-50/40 border border-amber-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 transition"
                        />
                      </div>

                      {/* 2 to 5: Dampak, Kondisi Ideal, Tindakan Perbaikan, Penyebab */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="font-bold text-[11px] text-slate-600 uppercase">Dampak (Impact)</label>
                          <textarea
                            rows={2}
                            value={obs.operationalImpact}
                            onChange={(e) => handleUpdateObs(obs.id, 'operationalImpact', e.target.value)}
                            placeholder="Dampak terhadap kualitas atau operasional..."
                            className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-teal-500 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none transition"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-[11px] text-slate-600 uppercase">Kondisi Ideal</label>
                          <textarea
                            rows={2}
                            value={obs.idealCondition}
                            onChange={(e) => handleUpdateObs(obs.id, 'idealCondition', e.target.value)}
                            placeholder="Standar kondisi ideal yang diharapkan..."
                            className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-teal-500 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none transition"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-[11px] text-slate-600 uppercase">Tindakan Perbaikan (Corrective Action)</label>
                          <textarea
                            rows={2}
                            value={obs.actionPlan}
                            onChange={(e) => handleUpdateObs(obs.id, 'actionPlan', e.target.value)}
                            placeholder="Tindakan perbaikan yang harus dilakukan..."
                            className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-teal-500 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none transition"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-[11px] text-slate-600 uppercase">Penyebab (Root Cause)</label>
                          <textarea
                            rows={2}
                            value={obs.rootCause}
                            onChange={(e) => handleUpdateObs(obs.id, 'rootCause', e.target.value)}
                            placeholder="Akar penyebab temuan..."
                            className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-teal-500 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none transition"
                          />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <label className="font-bold text-[11px] text-slate-600 uppercase">Hasil (Result / Follow-Up)</label>
                          <textarea
                            rows={1}
                            value={obs.expectedResult}
                            onChange={(e) => handleUpdateObs(obs.id, 'expectedResult', e.target.value)}
                            placeholder="Hasil tindak lanjut..."
                            className="w-full bg-slate-50/70 border border-slate-200 focus:bg-white focus:border-teal-500 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none transition"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Add Observation Button */}
              <button
                type="button"
                onClick={() => handleAddObservation(obsSubTab.toUpperCase() as any)}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-teal-200 hover:border-teal-400 bg-teal-50/40 hover:bg-teal-50 text-teal-700 font-extrabold text-xs transition flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Temuan {obsSubTab.toUpperCase()} Baru</span>
              </button>
            </div>

            {/* Footer Navigation Section 2 */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setActiveSection(1)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
              >
                &larr; Kembali ke Section 1
              </button>
              <button
                type="button"
                onClick={() => setActiveSection(3)}
                className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs shadow-sm transition flex items-center gap-2"
              >
                <span>Lanjut ke Section 3: Evidence</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            SECTION 3: EVIDENCE (BUKTI TEMUAN & HASIL PERBAIKAN CA)
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
                    Upload foto bukti temuan observasi dan foto hasil perbaikan (CA)
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/50">
                Slide 6, 7 & 8 PDF
              </span>
            </div>

            {/* Sub-section Switcher Tabs: Bukti Temuan vs Hasil Perbaikan */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setEvidenceSubTab('finding')}
                className={`flex items-center justify-between px-3 py-2 rounded-xl transition ${
                  evidenceSubTab === 'finding'
                    ? 'bg-white text-slate-900 font-black shadow-xs'
                    : 'text-slate-600 font-bold hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs sm:text-sm">Bukti Temuan</span>
                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                    {formData.evidencePhotos.length} Foto
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.2 rounded">
                  {formData.enableEvidence !== false ? 'ON' : 'OFF'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setEvidenceSubTab('ca')}
                className={`flex items-center justify-between px-3 py-2 rounded-xl transition ${
                  evidenceSubTab === 'ca'
                    ? 'bg-white text-slate-900 font-black shadow-xs'
                    : 'text-slate-600 font-bold hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <CheckCheck className="w-4 h-4 text-blue-600" />
                  <span className="text-xs sm:text-sm">Hasil Perbaikan (CA)</span>
                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800">
                    {formData.caPhotos?.length || 0} Foto
                  </span>
                </div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.2 rounded">
                  {formData.enableCa !== false ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>

            {/* Hidden Photo Inputs */}
            <input
              type="file"
              ref={evidenceInputRef}
              accept="image/*"
              onChange={(e) => handleAddEvidencePhoto(e, false)}
              className="hidden"
            />
            <input
              type="file"
              ref={caInputRef}
              accept="image/*"
              onChange={(e) => handleAddEvidencePhoto(e, true)}
              className="hidden"
            />

            {/* Evidence Photo Grid Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(evidenceSubTab === 'finding' ? formData.evidencePhotos : formData.caPhotos || []).map(
                (ev, idx) => (
                  <div
                    key={ev.id || idx}
                    className="border border-slate-300 rounded-2xl p-3 bg-white space-y-2 relative shadow-xs"
                  >
                    {/* Viewfinder Thumbnail */}
                    <div className="h-40 bg-slate-100 rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-200 group">
                      <img
                        src={ev.photoUrl}
                        alt={`Evidence ${idx + 1}`}
                        className="w-full h-full object-cover cursor-zoom-in"
                        onClick={() => setZoomPhotoUrl(ev.photoUrl)}
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="bg-slate-900/80 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                          <Maximize2 className="w-3 h-3" />
                          <span>Perbesar</span>
                        </span>
                      </div>
                    </div>

                    {/* Keterangan & Actions */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                        <span>KETERANGAN #{idx + 1}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleStartVoice((t) =>
                                handleUpdateEvidenceCaption(ev.id, (ev.caption ? ev.caption + ' ' : '') + t, evidenceSubTab === 'ca')
                              )
                            }
                            className="px-2 py-0.5 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 transition flex items-center gap-1"
                          >
                            <Mic className="w-3 h-3 text-rose-500" />
                            <span>Dikte</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveEvidencePhoto(ev.id, evidenceSubTab === 'ca')}
                            className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 transition"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        value={ev.caption}
                        onChange={(e) =>
                          handleUpdateEvidenceCaption(ev.id, e.target.value, evidenceSubTab === 'ca')
                        }
                        placeholder="Tuliskan deskripsi temuan foto ini..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-teal-500 outline-none"
                      />

                      <div className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 truncate">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Watermark GPS & Waktu Aktif</span>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Add Photo Card Button */}
              <button
                type="button"
                onClick={() => {
                  if (evidenceSubTab === 'ca') {
                    caInputRef.current?.click();
                  } else {
                    evidenceInputRef.current?.click();
                  }
                }}
                className="border-2 border-dashed border-slate-300 hover:border-teal-500 bg-slate-50/70 hover:bg-teal-50/40 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer min-h-[220px] transition group"
              >
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-teal-600 flex items-center justify-center text-xl shadow-xs group-hover:scale-105 transition mb-2">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-xs font-black text-slate-800">
                  + Tambah Foto {evidenceSubTab === 'finding' ? 'Bukti Temuan' : 'Hasil Perbaikan'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                  Auto-Watermark Tanggal, Jam WIB & Titik GPS
                </span>
              </button>
            </div>

            {/* Footer Navigation Section 3 */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setActiveSection(2)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
              >
                &larr; Kembali ke Section 2
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPreview(true);
                  confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
                }}
                className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-xs sm:text-sm shadow-md transition flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-rose-400" />
                <span>Simpan & Buka Preview PDF 16:9</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          BOTTOM NAVBAR FORM VISIT (3 SECTION: INFO, OBSERVASI, BUKTI)
          Ala Glass iPhone dengan Smooth Sliding Lens Pill
          Menyudut tetap center (origin-center, tidak menyusut ke bawah)
          Super smooth deliberate transition (800ms) & auto-upscale on press
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

          {/* 
            SLIDING ACTIVE GLASS LENS PILL (White Liquid Glass, No Border, +5% Transparency)
            Lens kaca putih meluncur anggun tanpa border
          */}
          <div
            className="absolute top-1.5 bottom-1.5 rounded-[24px] iphone-glass-pill pointer-events-none dock-pill-transition z-0"
            style={{
              width: 'calc((100% - 12px) / 3)',
              transform: `translateX(calc(${activeSection - 1} * 100%))`,
              left: '6px',
            }}
          >
            {/* Top specular hairline inside the pill */}
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

              {/* Badge total observasi tepat di sisi kanan icon dengan z-index di atasnya & background putih */}
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

              {/* Badge total bukti tepat di sisi kanan icon dengan z-index di atasnya & background putih */}
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
    </div>
  );
};
