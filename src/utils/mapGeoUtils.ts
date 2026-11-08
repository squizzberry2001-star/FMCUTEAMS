import { MasterStore, getMasterStores, findMasterStoreByCodeOrName, isSamePersonName } from '../data/masterStoresData';
import { ScheduleAgenda, User } from '../types';
import { matchStoreFromLocationPart } from '../services/scheduleExcelService';

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
 * Resolve one or more StoreGeoPoints from a ScheduleAgenda
 */
export function resolveAgendaGeoPoints(
  agenda: ScheduleAgenda,
  allStores?: MasterStore[]
): StoreGeoPoint[] {
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

  // 1. Direct storeCode or storeName on agenda
  if (agenda.storeCode) {
    const found = findMasterStoreByCodeOrName(agenda.storeCode);
    if (found) addStore(found);
  }
  if (results.length === 0 && agenda.storeName) {
    const found = findMasterStoreByCodeOrName(agenda.storeName);
    if (found) addStore(found);
  }

  // 2. Parse location string (supports '&' separator for multi-store schedules)
  if (results.length === 0 && agenda.location) {
    const parts = agenda.location.split(/\s*(?:&|\bdan\b|\/|,)\s*/i).filter(Boolean);
    for (const part of parts) {
      const { store } = matchStoreFromLocationPart(part, stores);
      if (store) {
        addStore(store);
      } else {
        const fallback = findMasterStoreByCodeOrName(part);
        if (fallback) addStore(fallback);
      }
    }
  }

  // 3. Parse agenda title if still empty
  if (results.length === 0 && agenda.title) {
    const { store } = matchStoreFromLocationPart(agenda.title, stores);
    if (store) {
      addStore(store);
    } else {
      const fallback = findMasterStoreByCodeOrName(agenda.title);
      if (fallback) addStore(fallback);
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
}

/**
 * Compute simulated/live field positions of users for Admin Map Monitoring
 */
export function buildAdminUserPinpoints(
  users: User[],
  scheduledPoints: StoreGeoPoint[],
  radiusMeters: number
): UserPinpoint[] {
  const result: UserPinpoint[] = [];
  const nonAdminUsers = users.filter((u) => !u.isAdmin);

  nonAdminUsers.forEach((u, idx) => {
    // Find first scheduled store for this user
    const userStore = scheduledPoints.find((p) => isSamePersonName(p.agendaPic, u.name));
    if (!userStore) return;

    // Deterministic slight offset around the target store (some inside radius, some en-route)
    const seed = Math.sin((idx + 1) * 97.13);
    const angle = ((idx * 137.5) % 360) * (Math.PI / 180);
    // Distance between 45m and 380m
    const distMeters = Math.round(45 + Math.abs(seed) * 280);
    const dLat = (distMeters * Math.cos(angle)) / 111320;
    const dLng = (distMeters * Math.sin(angle)) / (111320 * Math.cos((userStore.lat * Math.PI) / 180));

    const uLat = userStore.lat + dLat;
    const uLng = userStore.lng + dLng;

    result.push({
      userName: u.name,
      role: u.role || 'FMCU Field Specialist',
      lat: uLat,
      lng: uLng,
      altitude: userStore.altitude,
      targetStoreCode: userStore.code,
      targetStoreName: userStore.name,
      distanceToStoreMeters: distMeters,
      isInsideRadius: distMeters <= radiusMeters,
    });
  });

  return result;
}
