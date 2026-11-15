import { MasterStore, getMasterStores, findMasterStoreByCodeOrName, isSamePersonName } from '../data/masterStoresData';
import { ScheduleAgenda, User } from '../types';
import { matchStoreFromLocationPart } from '../services/scheduleExcelService';
import { UserLivePresence, getLocalActivePresences } from '../services/userLivePresenceService';

// Singleton promise to load Leaflet 1.9.4 from CDN without bloating bundle
let leafletLoadPromise: Promise<any> | null = null;

export function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if ((window as any).L) {
    return Promise.resolve((window as any).L);
  }
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve) => {
    // 1. Inject Leaflet CSS if not present
    if (!document.getElementById('leaflet-cdn-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-cdn-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // 2. Inject Leaflet JS
    const existingScript = document.getElementById('leaflet-cdn-js') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve((window as any).L));
      existingScript.addEventListener('error', () => resolve(null));
      return;
    }

    const script = document.createElement('script');
    script.id = 'leaflet-cdn-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve((window as any).L);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return leafletLoadPromise;
}

export interface StoreScheduleItem {
  id?: string;
  pic?: string;
  title?: string;
  date?: string;
  time?: string;
  category?: string;
}

export interface StoreGeoPoint {
  code: string;
  name: string;
  type: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  altitude: number; // meters above sea level (mdpl)
  storeHead: string;
  areaManager: string;
  regionalManager: string;
  agendaId?: string;
  agendaTitle?: string;
  agendaDate?: string;
  agendaTime?: string;
  agendaPic?: string;
  agendaCategory?: string;
  routeOrder?: number;
  schedules?: StoreScheduleItem[];
}

/**
 * Standardized Indonesian local date YYYY-MM-DD
 * Eliminates UTC midnight offset anomalies where UTC is yesterday during 00:00 - 06:59 WIB.
 */
export function getLocalDateYmd(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Compute realistic topographic altitude (meters above sea level / mdpl)
 * based on store city & latitude/longitude in Indonesia.
 */
export function computeStoreAltitude(lat: number, lng: number, city = '', code = ''): number {
  const c = (city || '').toLowerCase();
  // Deterministic fine variation from store code / coordinates
  const hashSeed = Math.abs(Math.sin(lat * 123.45 + lng * 678.9 + (parseInt(code, 36) || 0)));
  const fineOffset = Math.round((hashSeed - 0.5) * 8);

  if (c.includes('bandung') || c.includes('cimahi')) {
    // Bandung basin ~680m to 765m mdpl
    const base = lat < -6.92 ? 682 : lat > -6.88 ? 748 : 712;
    return Math.max(650, base + fineOffset);
  }
  if (c.includes('bogor')) {
    return Math.max(180, 245 + fineOffset * 2);
  }
  if (c.includes('depok')) {
    return Math.max(55, 78 + fineOffset);
  }
  if (c.includes('malang') || c.includes('batu')) {
    return Math.max(420, 476 + fineOffset * 2);
  }
  if (c.includes('yogyakarta') || c.includes('sleman') || c.includes('bantul')) {
    return Math.max(95, 134 + fineOffset);
  }
  if (c.includes('jakarta utara')) {
    return Math.max(3, 6 + Math.round(hashSeed * 4));
  }
  if (c.includes('jakarta selatan')) {
    return Math.max(22, 38 + fineOffset);
  }
  if (c.includes('jakarta timur') || c.includes('bekasi')) {
    return Math.max(14, 24 + fineOffset);
  }
  if (c.includes('jakarta barat') || c.includes('jakarta pusat')) {
    return Math.max(7, 14 + Math.round(hashSeed * 6));
  }
  if (c.includes('tangerang')) {
    return Math.max(12, 22 + fineOffset);
  }
  if (c.includes('surabaya') || c.includes('sidoarjo') || c.includes('gresik')) {
    return Math.max(4, 9 + Math.round(hashSeed * 6));
  }
  if (c.includes('bali') || c.includes('denpasar') || c.includes('badung')) {
    return Math.max(8, 28 + fineOffset);
  }

  // Fallback by latitude (further south in West Java/Jakarta = higher elevation)
  if (lat < -6.8) return 710 + fineOffset;
  if (lat < -6.5) return 195 + fineOffset;
  if (lat < -6.3) return 52 + fineOffset;
  return Math.max(5, 16 + fineOffset);
}

/**
 * Convert MasterStore to StoreGeoPoint with guaranteed valid lat, lng, and altitude.
 */
export function toStoreGeoPoint(store: MasterStore, extra?: Partial<StoreGeoPoint>): StoreGeoPoint {
  const lat = Number(store.lat || store.latitude || -6.2088);
  const lng = Number(store.lng || store.longitude || 106.8456);
  const altitude = computeStoreAltitude(lat, lng, store.city, store.code);

  return {
    code: store.code,
    name: store.name,
    type: store.type || 'CVS',
    city: store.city || 'Jakarta',
    address: store.address || '-',
    lat,
    lng,
    altitude,
    storeHead: store.storeHead || '-',
    areaManager: store.areaManager || '-',
    regionalManager: store.regionalManager || '-',
    ...extra,
  };
}

/**
 * Known FMCU Office / Training Center coordinates when an agenda is at an office hub
 */
const FMCU_HUB_LOCATIONS: Record<string, { name: string; city: string; address: string; lat: number; lng: number }> = {
  'TANJUNG DUREN': {
    name: 'FMCU Training Center Tanjung Duren',
    city: 'Jakarta Barat',
    address: 'Jl. Tanjung Duren Raya, Grogol Petamburan, Jakarta Barat',
    lat: -6.17382,
    lng: 106.78654,
  },
  'BULUNGAN': {
    name: 'Town Hall FMCU Bulungan',
    city: 'Jakarta Selatan',
    address: 'Jl. Raya Bulungan No. 18, Kebayoran Baru, Jakarta Selatan',
    lat: -6.24276,
    lng: 106.79613,
  },
  'ROOS': {
    name: 'FMCU Office ROOS Tebet',
    city: 'Jakarta Selatan',
    address: 'Jl. KH. Abdullah Syafei / Roos, Tebet, Jakarta Selatan',
    lat: -6.22554,
    lng: 106.85518,
  },
};

/**
 * Returns true if an agenda represents non-store activities:
 * OFF, CUTI, SAKIT, LIBUR, IZIN, STANDBY, etc.
 * Agenda jenis ini BUKAN kunjungan toko dan TIDAK BOLEH dipetakan ke toko fisik manapun di peta.
 */
export function isNonStoreAgenda(agenda?: Partial<ScheduleAgenda> | null): boolean {
  if (!agenda) return true;
  const cat = (agenda.category || '').toUpperCase();
  if (cat === 'OFF' || cat === 'CUTI' || cat === 'SAKIT' || cat === 'LIBUR' || cat === 'IZIN') {
    return true;
  }
  const title = (agenda.title || '').toUpperCase().trim();
  const loc = (agenda.location || '').toUpperCase().trim();

  // Pola eksplisit non-store
  const nonStoreRegex = /\b(OFF|LIBUR|CUTI|SAKIT|IZIN|WEEKEND|STANDBY|WFH|DAY\s+OFF)\b/i;
  const hasStoreKeyword =
    title.includes('VISIT') ||
    loc.includes('VISIT') ||
    title.includes('TOKO') ||
    loc.includes('TOKO') ||
    title.includes('STORE') ||
    loc.includes('STORE') ||
    title.includes('NSO') ||
    loc.includes('NSO');

  if (
    (!agenda.storeCode || agenda.storeCode === 'STORE') &&
    (nonStoreRegex.test(title) || nonStoreRegex.test(loc)) &&
    !hasStoreKeyword
  ) {
    return true;
  }

  // Jika lokasi hanya strip atau off
  if (!agenda.storeCode && (!loc || loc === '-' || loc === 'OFF / LIBUR' || loc === 'OFF')) {
    if (cat !== 'VISIT' && cat !== 'NSO' && cat !== 'AUDIT') {
      return true;
    }
  }

  return false;
}

/**
 * Resolve one or more StoreGeoPoints from a ScheduleAgenda
 */
export function resolveAgendaGeoPoints(
  agenda: ScheduleAgenda,
  allStores?: MasterStore[]
): StoreGeoPoint[] {
  if (!agenda || isNonStoreAgenda(agenda)) {
    return [];
  }
  const stores = allStores || getMasterStores();
  const results: StoreGeoPoint[] = [];
  const seenCodes = new Set<string>();

  const addStore = (st: MasterStore) => {
    if (!st || seenCodes.has(st.code)) return;
    seenCodes.add(st.code);
    results.push(
      toStoreGeoPoint(st, {
        agendaId: agenda.id,
        agendaTitle: agenda.title,
        agendaDate: agenda.date,
        agendaTime: agenda.time,
        agendaPic: agenda.pic,
        agendaCategory: agenda.category,
      })
    );
  };

  // 1. Direct storeCode or storeName on agenda (hanya jika valid dan bukan placeholder 'STORE')
  if (agenda.storeCode && agenda.storeCode !== 'STORE') {
    const found = findMasterStoreByCodeOrName(agenda.storeCode);
    if (found) addStore(found);
  }
  if (results.length === 0 && agenda.storeName) {
    const found = findMasterStoreByCodeOrName(agenda.storeName);
    if (found) addStore(found);
  }

  // 2. Parse location string (supports '&' separator for multi-store schedules)
  if (results.length === 0 && agenda.location) {
    const locClean = agenda.location.trim();
    if (
      locClean &&
      !/^(off|libur|cuti|sakit|izin|weekend|standby|wfh)(\s*[\/\-]\s*|$)/i.test(locClean)
    ) {
      const parts = locClean.split(/\s*(?:&|\bdan\b|\/|,)\s*/i).filter(Boolean);
      for (const part of parts) {
        if (/^(off|libur|cuti|sakit|izin|weekend|standby|wfh|home|ho|office)$/i.test(part.trim())) {
          continue;
        }
        const { store } = matchStoreFromLocationPart(part, stores);
        if (store) {
          addStore(store);
        } else {
          const fallback = findMasterStoreByCodeOrName(part);
          if (fallback) addStore(fallback);
        }
      }
    }
  }

  // 3. Parse agenda title if still empty
  if (results.length === 0 && agenda.title) {
    const titleClean = agenda.title.trim();
    if (
      titleClean &&
      !/^(off|libur|cuti|sakit|izin|weekend|standby|wfh)(\s*[\/\-]\s*|$)/i.test(titleClean)
    ) {
      const { store } = matchStoreFromLocationPart(agenda.title, stores);
      if (store) {
        addStore(store);
      } else {
        const fallback = findMasterStoreByCodeOrName(agenda.title);
        if (fallback) addStore(fallback);
      }
    }
  }

  return results;
}

/**
 * Resolve single primary geo point for any agenda (falls back to FMCU Hub if office/training agenda)
 */
export function resolvePrimaryAgendaGeoPoint(
  agenda: ScheduleAgenda,
  allStores?: MasterStore[]
): StoreGeoPoint {
  const matched = resolveAgendaGeoPoints(agenda, allStores);
  if (matched.length > 0) return matched[0];

  const locUpper = `${agenda.location || ''} ${agenda.title || ''}`.toUpperCase();
  for (const [key, hub] of Object.entries(FMCU_HUB_LOCATIONS)) {
    if (locUpper.includes(key)) {
      return {
        code: 'FMCU',
        name: hub.name,
        type: 'Office / Hub',
        city: hub.city,
        address: hub.address,
        lat: hub.lat,
        lng: hub.lng,
        altitude: computeStoreAltitude(hub.lat, hub.lng, hub.city, 'FMCU'),
        storeHead: '-',
        areaManager: '-',
        regionalManager: '-',
        agendaId: agenda.id,
        agendaTitle: agenda.title,
        agendaDate: agenda.date,
        agendaTime: agenda.time,
        agendaPic: agenda.pic,
        agendaCategory: agenda.category,
      };
    }
  }

  // Default fallback to Town Hall Bulungan
  const def = FMCU_HUB_LOCATIONS['BULUNGAN'];
  return {
    code: 'FMCU',
    name: agenda.location || def.name,
    type: 'Lokasi Agenda',
    city: def.city,
    address: agenda.location || def.address,
    lat: def.lat,
    lng: def.lng,
    altitude: computeStoreAltitude(def.lat, def.lng, def.city, 'FMCU'),
    storeHead: '-',
    areaManager: '-',
    regionalManager: '-',
    agendaId: agenda.id,
    agendaTitle: agenda.title,
    agendaDate: agenda.date,
    agendaTime: agenda.time,
    agendaPic: agenda.pic,
    agendaCategory: agenda.category,
  };
}

/**
 * Calculate Haversine distance in kilometers between two coordinates
 */
export function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface UserPinpoint {
  userName: string;
  role: string;
  lat: number;
  lng: number;
  altitude: number;
  targetStoreCode: string;
  targetStoreName: string;
  distanceToStoreMeters: number;
  isInsideRadius: boolean;
  gpsSource?: 'LIVE_DEVICE' | 'ATTENDANCE_CHECKIN' | 'VISIT_REPORT';
  gpsAccuracy?: number;
  capturedAt?: string;
  isRealGps: true;
  hasStoreVisitToday?: boolean;
  todayAgendaTitle?: string;
  todayAgendaCategory?: string;
}

/**
 * Parses raw GPS coordinate string e.g. "-6.2293, 106.8256" or "-6.22930, 106.82560 (Akurat)"
 */
function parseGpsCoordinate(raw: string | null | undefined): { lat: number; lng: number } | null {
  if (!raw || typeof raw !== 'string') return null;
  const clean = raw.replace(/\(.*?\)/g, '').trim();
  const parts = clean.split(',').map((p) => parseFloat(p.trim()));
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const [lat, lng] = parts;
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && (lat !== 0 || lng !== 0)) {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * Compute REAL field positions of users for Admin Map Monitoring.
 * ATURAN MUTLAK:
 * Pinpoint user HANYA MUNCUL DI MAPS JIKA USER SEDANG AKSES WEB DAN GPS MENYALA.
 * Jika tidak sedang akses web, maka TIDAK PERLU DITAMPILKAN SAMA SEKALI.
 * Seluruh fallback riwayat audit/check-in lama dan laporan masa lalu dihapus total.
 */
export function buildAdminUserPinpoints(
  users: User[],
  scheduledPoints: StoreGeoPoint[],
  radiusMeters: number,
  agendas: ScheduleAgenda[] = [],
  currentUser?: User | null,
  activePresences: UserLivePresence[] = getLocalActivePresences()
): UserPinpoint[] {
  const result: UserPinpoint[] = [];
  const nonAdminUsers = users.filter((u) => !u.isAdmin);
  const now = Date.now();
  const MAX_ONLINE_WINDOW_MS = 3 * 60 * 1000; // Maksimal 3 menit toleransi heartbeat akses web

  // 1. Cek koordinat GPS perangkat sesi aktif saat ini
  let localGpsStr: string | null = null;
  let localGpsTimestamp = 0;
  let activeSessionUserName: string | null = currentUser?.name || null;
  try {
    if (!activeSessionUserName) {
      const sessionRaw = localStorage.getItem('fmcu_user_session_v3');
      if (sessionRaw) {
        const parsed = JSON.parse(sessionRaw);
        activeSessionUserName = parsed.name || null;
      }
    }
    localGpsStr = localStorage.getItem('fmcu_live_gps');
    localGpsTimestamp = Number(localStorage.getItem('fmcu_live_gps_timestamp') || 0);
  } catch {
    // ignore
  }

  // 2. Map presensi live user yang masih segar (< 3 menit & GPS aktif)
  const presenceMap = new Map<string, UserLivePresence>();
  activePresences.forEach((p) => {
    if (
      p.isWebActive === true &&
      p.isGpsActive === true &&
      now - p.lastSeenMs < MAX_ONLINE_WINDOW_MS &&
      (p.lat !== 0 || p.lng !== 0)
    ) {
      presenceMap.set(p.userName.toLowerCase().trim(), p);
    }
  });

  nonAdminUsers.forEach((u) => {
    let realCoords: { lat: number; lng: number } | null = null;
    let gpsAccuracy: number | undefined = 15;
    let capturedAt: string | undefined;

    // A. Pengguna Saat Ini yang Sedang Membuka Web di Browser Ini
    if (
      activeSessionUserName &&
      isSamePersonName(activeSessionUserName, u.name) &&
      localGpsStr
    ) {
      // Pastikan GPS masih segar (diperbarui saat akses web aktif)
      const isFresh = localGpsTimestamp > 0 ? now - localGpsTimestamp < MAX_ONLINE_WINDOW_MS : true;
      if (isFresh) {
        const parsed = parseGpsCoordinate(localGpsStr);
        if (parsed) {
          realCoords = parsed;
          capturedAt = 'Online Sekarang (Web Aktif + GPS Menyala)';
        }
      }
    }

    // B. Pengguna Lain yang Sedang Membuka Web di Perangkat Lain (Live Heartbeat Cloud / Local)
    if (!realCoords) {
      const activeP = presenceMap.get(u.name.toLowerCase().trim());
      if (activeP) {
        realCoords = { lat: activeP.lat, lng: activeP.lng };
        gpsAccuracy = activeP.accuracyMeters || 15;
        capturedAt = 'Online Sekarang (Web Aktif + GPS Menyala)';
      }
    }

    // ATURAN MUTLAK: JIKA TIDAK SEDANG AKSES WEB ATAU GPS MATI -> JANGAN TAMPILKAN!
    if (!realCoords) {
      return;
    }

    // 1. Cari agenda user hari ini menggunakan local timezone YYYY-MM-DD
    const todayYmd = getLocalDateYmd();
    const userTodayAgendas = agendas.filter(
      (a) => isSamePersonName(a.pic, u.name) && a.date === todayYmd
    );

    // Prioritaskan agenda visit toko hari ini
    const todayVisitAgendas = userTodayAgendas.filter(
      (a) => a.category === 'VISIT' || a.category === 'NSO' || Boolean(a.storeCode)
    );

    // Agenda non-kunjungan hari ini (OFF, MEETING, TRAINING, OPERATION tanpa toko, dll)
    const todayNonVisitAgenda = userTodayAgendas.find(
      (a) => a.category !== 'VISIT' && a.category !== 'NSO' && !a.storeCode
    );

    // Cari titik koordinat toko HANYA dari agenda visit HARI INI
    let userStore: StoreGeoPoint | null = null;
    let activeVisitAgenda: ScheduleAgenda | null = null;

    if (todayVisitAgendas.length > 0) {
      // Jika ada lebih dari 1 visit hari ini, cari toko terdekat dari lokasi GPS aktual user
      let bestStore: StoreGeoPoint | null = null;
      let minDistance = Infinity;

      for (const ag of todayVisitAgendas) {
        // Coba cari di scheduledPoints yang sesuai dengan agenda PIC dan storeCode
        let stPoint = scheduledPoints.find(
          (p) =>
            (ag.storeCode && p.code.toUpperCase() === ag.storeCode.toUpperCase()) ||
            (p.agendaPic && isSamePersonName(p.agendaPic, u.name))
        );

        // Jika belum ada di scheduledPoints, resolve langsung dari master stores
        if (!stPoint && ag.storeCode) {
          const master = findMasterStoreByCodeOrName(ag.storeCode);
          if (master) {
            stPoint = toStoreGeoPoint(master, {
              agendaId: ag.id,
              agendaTitle: ag.title,
              agendaDate: ag.date,
              agendaTime: ag.time,
              agendaPic: ag.pic,
              agendaCategory: ag.category,
            });
          }
        }
        if (!stPoint && ag.location) {
          const master = findMasterStoreByCodeOrName(ag.location);
          if (master) {
            stPoint = toStoreGeoPoint(master, {
              agendaId: ag.id,
              agendaTitle: ag.title,
              agendaDate: ag.date,
              agendaTime: ag.time,
              agendaPic: ag.pic,
              agendaCategory: ag.category,
            });
          }
        }

        if (stPoint) {
          const d = calculateHaversineKm(realCoords.lat, realCoords.lng, stPoint.lat, stPoint.lng) * 1000;
          if (d < minDistance) {
            minDistance = d;
            bestStore = stPoint;
            activeVisitAgenda = ag;
          }
        }
      }

      userStore = bestStore;
    }

    const hasStoreVisitToday = Boolean(userStore);
    const distMeters = userStore
      ? Math.round(calculateHaversineKm(realCoords.lat, realCoords.lng, userStore.lat, userStore.lng) * 1000)
      : 0;

    let targetCode = '';
    let targetName = '';
    let agendaTitle = '';
    let agendaCategory = '';

    if (userStore) {
      targetCode = userStore.code;
      targetName = userStore.name;
      agendaTitle = activeVisitAgenda?.title || userStore.agendaTitle || userStore.name;
      agendaCategory = activeVisitAgenda?.category || userStore.agendaCategory || 'VISIT';
    } else if (todayNonVisitAgenda) {
      targetCode = '';
      targetName = todayNonVisitAgenda.title;
      agendaTitle = todayNonVisitAgenda.title;
      agendaCategory = todayNonVisitAgenda.category || 'STANDBY';
    } else {
      targetCode = '';
      targetName = 'Area Operasional FMCU';
      agendaTitle = 'Standby (Tidak Ada Kunjungan Hari Ini)';
      agendaCategory = 'STANDBY';
    }

    result.push({
      userName: u.name,
      role: u.role || 'FMCU Field Specialist',
      lat: realCoords.lat,
      lng: realCoords.lng,
      altitude: userStore?.altitude || 25,
      targetStoreCode: targetCode,
      targetStoreName: targetName,
      distanceToStoreMeters: distMeters,
      isInsideRadius: userStore ? distMeters <= radiusMeters : false,
      gpsSource: 'LIVE_DEVICE',
      gpsAccuracy,
      capturedAt,
      isRealGps: true,
      hasStoreVisitToday,
      todayAgendaTitle: agendaTitle,
      todayAgendaCategory: agendaCategory,
    });
  });

  return result;
}

/**
 * Determine whether a scheduled StoreGeoPoint represents an NSO (New Store Opening) agenda.
 */
export function isNsoGeoPoint(
  pt?: Pick<StoreGeoPoint, 'agendaCategory' | 'agendaTitle' | 'schedules'> | null
): boolean {
  if (!pt) return false;
  if (String(pt.agendaCategory || '').toUpperCase() === 'NSO') return true;
  if (
    Array.isArray(pt.schedules) &&
    pt.schedules.some((s) => String(s?.category || '').toUpperCase() === 'NSO')
  ) {
    return true;
  }
  const t = String(pt.agendaTitle || '').toLowerCase();
  return (
    /\bnso\b/.test(t) ||
    t.includes('new store opening') ||
    t.includes('grand opening') ||
    t.includes('soft opening')
  );
}

let _pinSvgCounter = 0;

/**
 * Distinct SVG pinpoint icon for Store points:
 * - NSO: Amber-Gold Shield/Star Pin with 4-point Sparkle icon + mini "NSO" ribbon
 * - VISIT: Emerald/Sky Teardrop Pin with Storefront icon
 */
export function createStorePinLeafletIcon(
  L: any,
  pt: Pick<StoreGeoPoint, 'agendaCategory' | 'agendaTitle' | 'schedules' | 'routeOrder'>,
  options: { isToday: boolean; showOrder?: boolean }
): any {
  const uid = ++_pinSvgCounter;
  const isNso = isNsoGeoPoint(pt);
  const isToday = options.isToday;
  const orderText =
    options.showOrder !== false && pt.routeOrder ? String(pt.routeOrder) : '';

  if (isNso) {
    const fillTop = isToday ? '#F59E0B' : '#F97316';
    const fillBottom = isToday ? '#B45309' : '#C2410C';
    const ringColor = isToday ? 'rgba(245, 158, 11, 0.34)' : 'rgba(249, 115, 22, 0.24)';

    const html = `
      <div style="position:relative;width:38px;height:44px;display:flex;align-items:flex-end;justify-content:center;cursor:pointer;">
        ${
          isToday
            ? `<div style="position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);width:22px;height:10px;border-radius:9999px;background:${ringColor};box-shadow:0 0 8px ${ringColor};pointer-events:none;"></div>`
            : ''
        }
        <svg width="36" height="42" viewBox="0 0 36 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 5px rgba(180,83,9,0.45));display:block;">
          <defs>
            <linearGradient id="nsoGrad-${uid}" x1="4" y1="2" x2="32" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="${fillTop}"/>
              <stop offset="100%" stop-color="${fillBottom}"/>
            </linearGradient>
          </defs>
          <!-- Hexagonal Shield / Crown Pin for NSO -->
          <path d="M18 2L31 8.5V20.5C31 28.5 23.8 35.8 18 40.5C12.2 35.8 5 28.5 5 20.5V8.5L18 2Z" fill="url(#nsoGrad-${uid})" stroke="#FFFFFF" stroke-width="2.2" stroke-linejoin="round"/>
          <!-- Sparkles / NSO Star Icon -->
          <path d="M18 10.5L19.9 15.6L25 17.5L19.9 19.4L18 24.5L16.1 19.4L11 17.5L16.1 15.6L18 10.5Z" fill="#FFFFFF"/>
          <circle cx="24.5" cy="11.5" r="1.4" fill="#FEF3C7"/>
        </svg>
        <span style="position:absolute;top:-3px;left:50%;transform:translateX(-50%);background:#78350F;color:#FEF3C7;font-size:7.5px;font-weight:900;letter-spacing:0.4px;padding:0.5px 4px;border-radius:9999px;border:1px solid #FDE68A;line-height:1.15;box-shadow:0 1px 3px rgba(0,0,0,0.28);pointer-events:none;">NSO</span>
        ${
          orderText
            ? `<span style="position:absolute;top:7px;right:-2px;min-width:14px;height:14px;padding:0 3px;border-radius:9999px;background:#0F172A;color:#FDE68A;font-size:8px;font-weight:900;display:flex;align-items:center;justify-content:center;border:1.5px solid #FFFFFF;line-height:1;pointer-events:none;">${orderText}</span>`
            : ''
        }
      </div>
    `;

    return L.divIcon({
      className: 'fmcu-nso-pin',
      html,
      iconSize: [38, 44],
      iconAnchor: [19, 42],
    });
  }

  // VISIT Store Pinpoint (Teardrop with Storefront SVG)
  const fillTop = isToday ? '#10B981' : '#0EA5E9';
  const fillBottom = isToday ? '#047857' : '#0369A1';
  const halo = isToday ? 'rgba(16, 185, 129, 0.34)' : 'rgba(14, 165, 233, 0.24)';

  const html = `
    <div style="position:relative;width:32px;height:40px;display:flex;align-items:flex-end;justify-content:center;cursor:pointer;">
      ${
        isToday
          ? `<div style="position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:18px;height:8px;border-radius:9999px;background:${halo};box-shadow:0 0 8px ${halo};pointer-events:none;"></div>`
          : ''
      }
      <svg width="30" height="38" viewBox="0 0 30 38" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 4px rgba(15,23,42,0.34));display:block;">
        <defs>
          <linearGradient id="visitGrad-${uid}" x1="3" y1="2" x2="27" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="${fillTop}"/>
            <stop offset="100%" stop-color="${fillBottom}"/>
          </linearGradient>
        </defs>
        <!-- Classic Teardrop Pin for Store Visit -->
        <path d="M15 2C8.37 2 3 7.37 3 14C3 22.8 15 36 15 36C15 36 27 22.8 27 14C27 7.37 21.63 2 15 2Z" fill="url(#visitGrad-${uid})" stroke="#FFFFFF" stroke-width="2.1"/>
        <!-- Crisp Storefront SVG Icon -->
        <path d="M9.5 12.2L10.3 9.8H19.7L20.5 12.2" stroke="#FFFFFF" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9.2 12.2H20.8V13.6C20.8 14.3 20.2 14.8 19.5 14.8C18.8 14.8 18.2 14.3 18.2 13.6C18.2 14.3 17.6 14.8 16.9 14.8C16.2 14.8 15.6 14.3 15.6 13.6C15.6 14.3 15 14.8 14.3 14.8C13.6 14.8 13 14.3 13 13.6C13 14.3 12.4 14.8 11.7 14.8C11 14.8 10.4 14.3 10.4 13.6V12.2H9.2Z" fill="#FFFFFF"/>
        <path d="M10.4 15.2V19.2H19.6V15.2" stroke="#FFFFFF" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="13.7" y="16.4" width="2.6" height="2.8" rx="0.4" fill="#FFFFFF"/>
      </svg>
      ${
        orderText
          ? `<span style="position:absolute;top:-2px;right:-2px;min-width:14px;height:14px;padding:0 3px;border-radius:9999px;background:#0F172A;color:#FFFFFF;font-size:8px;font-weight:900;display:flex;align-items:center;justify-content:center;border:1.5px solid #FFFFFF;line-height:1;pointer-events:none;">${orderText}</span>`
          : ''
      }
    </div>
  `;

  return L.divIcon({
    className: 'fmcu-visit-pin',
    html,
    iconSize: [32, 40],
    iconAnchor: [16, 38],
  });
}

/**
 * Distinct Circular GPS Avatar Badge for Personil (Admin Live User Pinpoint)
 */
export function createPersonilPinLeafletIcon(
  L: any,
  up: { userName: string; isInsideRadius: boolean; hasStoreVisitToday?: boolean }
): any {
  const firstName = String(up.userName || 'Tim').trim().split(/\s+/)[0] || 'Tim';
  const statusDot = !up.hasStoreVisitToday
    ? '#94A3B8'
    : up.isInsideRadius
    ? '#10B981'
    : '#F59E0B';

  const html = `
    <div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
      <div style="position:absolute;inset:-3px;border-radius:9999px;background:rgba(79,70,229,0.22);border:1px solid rgba(99,102,241,0.4);pointer-events:none;"></div>
      <div style="position:relative;width:30px;height:30px;border-radius:9999px;background:linear-gradient(135deg,#4F46E5,#312E81);border:2.4px solid #FFFFFF;box-shadow:0 3px 8px rgba(49,46,129,0.5);display:flex;align-items:center;justify-content:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="8" r="3.6" fill="#FFFFFF"/>
          <path d="M5.5 19.5C5.5 15.91 8.41 13 12 13C15.59 13 18.5 15.91 18.5 19.5" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/>
        </svg>
        <span style="position:absolute;top:-2px;right:-2px;width:9px;height:9px;border-radius:9999px;background:${statusDot};border:1.5px solid #FFFFFF;box-shadow:0 0 5px ${statusDot};"></span>
      </div>
      <div style="position:absolute;top:33px;left:50%;transform:translateX(-50%);background:#312E81;color:#E0E7FF;font-size:8.5px;font-weight:800;padding:1px 5px;border-radius:9999px;border:1px solid #818CF8;white-space:nowrap;box-shadow:0 2px 5px rgba(15,23,42,0.3);pointer-events:none;line-height:1.2;">${firstName}</div>
    </div>
  `;

  return L.divIcon({
    className: 'fmcu-personil-pin',
    html,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}
