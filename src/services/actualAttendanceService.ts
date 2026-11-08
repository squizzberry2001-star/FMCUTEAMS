import { ActualAttendanceSilentAudit, ScheduleAgenda } from '../types';
import { isSamePersonName } from '../data/masterStoresData';
import { resolvePrimaryAgendaGeoPoint } from '../utils/mapGeoUtils';
import { pushSingleAgendaToCloud } from './cloudScheduleSyncService';

// ============================================================================
// SILENT BACKGROUND ATTENDANCE & MULTI-STORE OFFLINE-FIRST ENGINE
// - Zero visible GPS prompts/labels on user UI (100% silent background telemetry)
// - Supports 08:30 - 17:30 working hours & multi-store visits (1 day 2+ stores)
// - Monotonic clock lock to prevent phone clock tampering while offline
// - Offline-first local storage + automatic background cloud sync when online
// ============================================================================

const ATTENDANCE_MAP_STORAGE_KEY = 'fmcu_actual_attendance_map_v1';
const OFFLINE_SYNC_QUEUE_KEY = 'fmcu_actual_attendance_offline_queue_v1';

interface SilentGpsSnapshot {
  lat: number;
  lng: number;
  accuracyMeters: number;
  capturedAtMs: number;
}

// Monotonic clock baseline initialized at module load
const bootWallTimeMs = Date.now();
const bootPerfTimeMs = typeof performance !== 'undefined' ? performance.now() : 0;
let trustedSatelliteOffsetMs = 0;

let latestSilentGps: SilentGpsSnapshot | null = null;
let watchId: number | null = null;

/**
 * Returns trusted current timestamp using monotonic clock to prevent offline manual time tampering
 */
export function getTrustedNow(): { now: Date; clockTamperDetected: boolean } {
  const wallNow = Date.now();
  if (typeof performance === 'undefined') {
    return { now: new Date(wallNow), clockTamperDetected: false };
  }

  const elapsedMs = performance.now() - bootPerfTimeMs;
  const monotonicNowMs = bootWallTimeMs + elapsedMs + trustedSatelliteOffsetMs;
  const driftMinutes = Math.abs(wallNow - monotonicNowMs) / 60000;

  // If device clock was manually shifted by more than 5 minutes while app was open
  if (driftMinutes > 5) {
    return {
      now: new Date(monotonicNowMs),
      clockTamperDetected: true,
    };
  }

  return {
    now: new Date(wallNow),
    clockTamperDetected: false,
  };
}

export function formatTimeWib(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} WIB`;
}

export function parseTimeWibToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const cleaned = timeStr.replace(/WIB/i, '').trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Haversine distance in meters between two coordinates
 */
export function computeDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Starts silent background geolocation listener (never shows any UI or error to user)
 */
export function initSilentBackgroundPositioning(): void {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

  const handlePosition = (pos: GeolocationPosition) => {
    latestSilentGps = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracyMeters: Math.round(pos.coords.accuracy || 25),
      capturedAtMs: Date.now(),
    };

    // Update monotonic satellite reference if valid
    if (pos.timestamp && Math.abs(pos.timestamp - Date.now()) < 3600000) {
      const expectedMonotonic = bootWallTimeMs + (performance.now() - bootPerfTimeMs);
      trustedSatelliteOffsetMs = pos.timestamp - expectedMonotonic;
    }

    try {
      localStorage.setItem(
        'fmcu_live_gps',
        `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`
      );
      sessionStorage.setItem('fmcu_gps_verified', 'true');
    } catch {
      // ignore storage errors
    }
  };

  try {
    navigator.geolocation.getCurrentPosition(
      handlePosition,
      () => {
        // Silent fail - never disturb user
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );

    if (watchId === null) {
      watchId = navigator.geolocation.watchPosition(
        handlePosition,
        () => {
          // Silent fail
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
      );
    }
  } catch {
    // Silent fail
  }
}

/**
 * Attempt a fast silent GPS read (max 1200ms) or return cached snapshot immediately
 */
async function acquireSilentGpsSnapshot(): Promise<SilentGpsSnapshot | null> {
  if (latestSilentGps && Date.now() - latestSilentGps.capturedAtMs < 120000) {
    return latestSilentGps;
  }
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return latestSilentGps;
  }

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(latestSilentGps);
      }
    }, 1200);

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          latestSilentGps = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyMeters: Math.round(pos.coords.accuracy || 25),
            capturedAtMs: Date.now(),
          };
          if (!settled) {
            settled = true;
            resolve(latestSilentGps);
          }
        },
        () => {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            resolve(latestSilentGps);
          }
        },
        { enableHighAccuracy: true, timeout: 1100, maximumAge: 90000 }
      );
    } catch {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        resolve(latestSilentGps);
      }
    }
  });
}

/**
 * Load locally persisted attendance map (by agenda.id)
 */
export function loadLocalAttendanceMap(): Record<
  string,
  {
    actualIn?: string;
    actualOut?: string;
    actualInIso?: string;
    actualOutIso?: string;
    completed?: boolean;
    silentAudit?: ActualAttendanceSilentAudit;
  }
> {
  try {
    const raw = localStorage.getItem(ATTENDANCE_MAP_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function saveLocalAttendanceEntry(
  agendaId: string,
  entry: {
    actualIn?: string;
    actualOut?: string;
    actualInIso?: string;
    actualOutIso?: string;
    completed?: boolean;
    silentAudit?: ActualAttendanceSilentAudit;
  }
): void {
  try {
    const map = loadLocalAttendanceMap();
    map[agendaId] = { ...(map[agendaId] || {}), ...entry };
    localStorage.setItem(ATTENDANCE_MAP_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

/**
 * Merge local offline/online attendance records into any agenda list
 */
export function hydrateAgendasWithLocalAttendance(
  agendas: ScheduleAgenda[]
): ScheduleAgenda[] {
  const map = loadLocalAttendanceMap();
  if (!map || Object.keys(map).length === 0) return agendas;

  return agendas.map((item) => {
    const local = map[item.id];
    if (!local) return item;
    return {
      ...item,
      actualIn: local.actualIn || item.actualIn,
      actualOut: local.actualOut || item.actualOut,
      actualInIso: local.actualInIso || item.actualInIso,
      actualOutIso: local.actualOutIso || item.actualOutIso,
      completed: local.completed !== undefined ? local.completed : item.completed,
      silentAudit: {
        ...(item.silentAudit || {}),
        ...(local.silentAudit || {}),
      },
    };
  });
}

/**
 * Queue an updated agenda for automatic cloud sync when signal/internet returns
 */
function enqueueOfflineAttendanceSync(updatedAgenda: ScheduleAgenda): void {
  try {
    const raw = localStorage.getItem(OFFLINE_SYNC_QUEUE_KEY);
    const queue: Record<string, ScheduleAgenda> = raw ? JSON.parse(raw) : {};
    queue[updatedAgenda.id] = updatedAgenda;
    localStorage.setItem(OFFLINE_SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

/**
 * Flush pending offline attendance records to Cloud Server
 */
export async function flushOfflineAttendanceQueue(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  try {
    const raw = localStorage.getItem(OFFLINE_SYNC_QUEUE_KEY);
    if (!raw) return;
    const queue: Record<string, ScheduleAgenda> = JSON.parse(raw) || {};
    const ids = Object.keys(queue);
    if (ids.length === 0) return;

    for (const id of ids) {
      const agenda = queue[id];
      const syncedAgenda: ScheduleAgenda = {
        ...agenda,
        silentAudit: {
          ...(agenda.silentAudit || {}),
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date().toISOString(),
        },
      };
      await pushSingleAgendaToCloud(syncedAgenda);
      saveLocalAttendanceEntry(id, {
        actualIn: syncedAgenda.actualIn,
        actualOut: syncedAgenda.actualOut,
        actualInIso: syncedAgenda.actualInIso,
        actualOutIso: syncedAgenda.actualOutIso,
        completed: syncedAgenda.completed,
        silentAudit: syncedAgenda.silentAudit,
      });
      delete queue[id];
    }

    localStorage.setItem(OFFLINE_SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // keep in queue for next retry
  }
}

/**
 * Compute daily multi-store context for a person on a specific date
 * Handles 1 day = 1 store OR 1 day = 2+ stores
 */
export function getDailyStoreSequenceInfo(
  targetAgenda: ScheduleAgenda,
  allAgendas: ScheduleAgenda[]
): {
  storeOrderIndex: number; // 1-based
  totalStoresToday: number;
  sameDayVisitAgendas: ScheduleAgenda[];
  previousStoreAgenda: ScheduleAgenda | null;
} {
  const sameDayVisitAgendas = allAgendas
    .filter(
      (a) =>
        a.date === targetAgenda.date &&
        a.category === 'VISIT' &&
        (isSamePersonName(a.pic, targetAgenda.pic) || a.pic === targetAgenda.pic)
    )
    .sort((a, b) => {
      // If one already has actualInIso, order by actualInIso first, then scheduled time, then id
      if (a.actualInIso && b.actualInIso) {
        return a.actualInIso.localeCompare(b.actualInIso);
      }
      if (a.actualInIso) return -1;
      if (b.actualInIso) return 1;
      return (
        (a.time || '08:30').localeCompare(b.time || '08:30') ||
        a.id.localeCompare(b.id)
      );
    });

  const idx = sameDayVisitAgendas.findIndex((a) => a.id === targetAgenda.id);
  const storeOrderIndex = idx >= 0 ? idx + 1 : 1;
  const totalStoresToday = Math.max(1, sameDayVisitAgendas.length);
  const previousStoreAgenda = idx > 0 ? sameDayVisitAgendas[idx - 1] : null;

  return {
    storeOrderIndex,
    totalStoresToday,
    sameDayVisitAgendas,
    previousStoreAgenda,
  };
}

/**
 * Record ACTUAL IN for a store visit agenda:
 * - Captures GPS silently in background & computes distance to store
 * - Checks 08:30 rule for Store #1, or calculates Transit Time from Store #1 if this is Store #2
 * - Auto-closes Store #1 Actual OUT if user forgot to press OUT at Store #1 before arriving at Store #2
 * - Works 100% offline with instant local persistence + automatic cloud sync
 */
export async function performSilentActualCheckIn(
  targetAgenda: ScheduleAgenda,
  allAgendas: ScheduleAgenda[],
  customTimeHHmm?: string
): Promise<{
  updatedTarget: ScheduleAgenda;
  autoClosedPrevStore?: ScheduleAgenda;
}> {
  const { now, clockTamperDetected } = getTrustedNow();
  const timeWib = customTimeHHmm
    ? customTimeHHmm.includes('WIB')
      ? customTimeHHmm
      : `${customTimeHHmm} WIB`
    : formatTimeWib(now);
  const nowIso = now.toISOString();
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  // 1. Silent GPS acquisition & distance to store
  const gps = await acquireSilentGpsSnapshot();
  const storePoint = resolvePrimaryAgendaGeoPoint(targetAgenda);
  let distanceToStore: number | undefined;
  let locationStatus: ActualAttendanceSilentAudit['inLocationStatus'] = 'SILENT_BG';

  if (gps) {
    distanceToStore = computeDistanceMeters(
      gps.lat,
      gps.lng,
      storePoint.lat,
      storePoint.lng
    );
    if (distanceToStore <= 150) {
      locationStatus = 'VERIFIED_AT_STORE';
    } else if (distanceToStore <= 350) {
      locationStatus = 'NEAR_STORE_INDOOR';
    } else {
      locationStatus = 'OUTSIDE_STORE_RADIUS';
    }
  }

  // 2. Multi-store daily sequence analysis (08:30 - 17:30 & 1 Day 2 Stores)
  const { storeOrderIndex, totalStoresToday, previousStoreAgenda } =
    getDailyStoreSequenceInfo(targetAgenda, allAgendas);

  let autoClosedPrevStore: ScheduleAgenda | undefined;
  let transitMinutesFromPrevStore: number | undefined;

  if (previousStoreAgenda && previousStoreAgenda.actualIn && !previousStoreAgenda.actualOut) {
    // User moved to Store #2 without pressing OUT on Store #1 -> Auto-close Store #1 so record is never missed
    const prevAudit: ActualAttendanceSilentAudit = {
      ...(previousStoreAgenda.silentAudit || {}),
      outLat: gps?.lat,
      outLng: gps?.lng,
      outAccuracyMeters: gps?.accuracyMeters,
      outTimingStatus: 'TRANSIT_TO_NEXT_STORE',
      recordedOfflineOut: isOffline,
      syncStatus: isOffline ? 'OFFLINE_QUEUED' : 'SYNCED',
      lastSyncedAt: isOffline ? undefined : nowIso,
    };
    autoClosedPrevStore = {
      ...previousStoreAgenda,
      actualOut: timeWib,
      actualOutIso: nowIso,
      completed: true,
      silentAudit: prevAudit,
    };
    saveLocalAttendanceEntry(autoClosedPrevStore.id, {
      actualIn: autoClosedPrevStore.actualIn,
      actualOut: autoClosedPrevStore.actualOut,
      actualInIso: autoClosedPrevStore.actualInIso,
      actualOutIso: autoClosedPrevStore.actualOutIso,
      completed: true,
      silentAudit: prevAudit,
    });
    if (isOffline) {
      enqueueOfflineAttendanceSync(autoClosedPrevStore);
    } else {
      pushSingleAgendaToCloud(autoClosedPrevStore);
    }
    transitMinutesFromPrevStore = 0;
  } else if (previousStoreAgenda?.actualOut) {
    const prevOutMin = parseTimeWibToMinutes(previousStoreAgenda.actualOut);
    const currInMin = parseTimeWibToMinutes(timeWib);
    if (prevOutMin !== null && currInMin !== null && currInMin >= prevOutMin) {
      transitMinutesFromPrevStore = currInMin - prevOutMin;
    }
  }

  // 3. Evaluate 08:30 Working Hours Rule
  // Store #1 uses 08:30 target; Store #2+ is a continuation visit after Store #1
  const inMinutes = parseTimeWibToMinutes(timeWib) ?? 8 * 60 + 30;
  const targetStartMinutes = 8 * 60 + 30; // 08:30
  let inTimingStatus: ActualAttendanceSilentAudit['inTimingStatus'] = 'ON_TIME';
  let lateMinutes = 0;

  if (storeOrderIndex > 1) {
    inTimingStatus = 'CONTINUATION_VISIT';
  } else if (inMinutes > targetStartMinutes) {
    inTimingStatus = 'LATE';
    lateMinutes = inMinutes - targetStartMinutes;
  }

  const nextAudit: ActualAttendanceSilentAudit = {
    ...(targetAgenda.silentAudit || {}),
    inLat: gps?.lat,
    inLng: gps?.lng,
    inAccuracyMeters: gps?.accuracyMeters,
    inDistanceToStoreMeters: distanceToStore,
    inLocationStatus: locationStatus,
    storeOrderIndex,
    totalStoresToday,
    transitMinutesFromPrevStore,
    inTimingStatus,
    lateMinutes: lateMinutes > 0 ? lateMinutes : undefined,
    clockTamperDetected: clockTamperDetected || targetAgenda.silentAudit?.clockTamperDetected,
    recordedOfflineIn: isOffline,
    syncStatus: isOffline ? 'OFFLINE_QUEUED' : 'SYNCED',
    lastSyncedAt: isOffline ? undefined : nowIso,
  };

  const updatedTarget: ScheduleAgenda = {
    ...targetAgenda,
    actualIn: timeWib,
    actualInIso: nowIso,
    silentAudit: nextAudit,
  };

  saveLocalAttendanceEntry(updatedTarget.id, {
    actualIn: updatedTarget.actualIn,
    actualInIso: updatedTarget.actualInIso,
    silentAudit: nextAudit,
  });

  if (isOffline) {
    enqueueOfflineAttendanceSync(updatedTarget);
  } else {
    pushSingleAgendaToCloud(updatedTarget);
  }

  return { updatedTarget, autoClosedPrevStore };
}

/**
 * Record ACTUAL OUT for a store visit agenda:
 * - Captures GPS silently in background & computes distance to store
 * - Checks whether this is Store #1 of a 2-store day (TRANSIT_TO_NEXT_STORE) or final store of the day (target >= 17:30)
 * - Works 100% offline with instant local persistence + automatic cloud sync
 */
export async function performSilentActualCheckOut(
  targetAgenda: ScheduleAgenda,
  allAgendas: ScheduleAgenda[],
  customTimeHHmm?: string
): Promise<ScheduleAgenda> {
  const { now, clockTamperDetected } = getTrustedNow();
  const timeWib = customTimeHHmm
    ? customTimeHHmm.includes('WIB')
      ? customTimeHHmm
      : `${customTimeHHmm} WIB`
    : formatTimeWib(now);
  const nowIso = now.toISOString();
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const gps = await acquireSilentGpsSnapshot();
  const storePoint = resolvePrimaryAgendaGeoPoint(targetAgenda);
  let distanceToStore: number | undefined;
  let locationStatus: ActualAttendanceSilentAudit['outLocationStatus'] = 'SILENT_BG';

  if (gps) {
    distanceToStore = computeDistanceMeters(
      gps.lat,
      gps.lng,
      storePoint.lat,
      storePoint.lng
    );
    if (distanceToStore <= 150) {
      locationStatus = 'VERIFIED_AT_STORE';
    } else if (distanceToStore <= 350) {
      locationStatus = 'NEAR_STORE_INDOOR';
    } else {
      locationStatus = 'OUTSIDE_STORE_RADIUS';
    }
  }

  const { storeOrderIndex, totalStoresToday } = getDailyStoreSequenceInfo(
    targetAgenda,
    allAgendas
  );

  const outMinutes = parseTimeWibToMinutes(timeWib) ?? 17 * 60 + 30;
  const targetEndMinutes = 17 * 60 + 30; // 17:30
  let outTimingStatus: ActualAttendanceSilentAudit['outTimingStatus'] = 'FULL_DAY_COMPLETE';
  let earlyOutMinutes = 0;

  if (storeOrderIndex < totalStoresToday) {
    // Masih ada jadwal visit toko ke-2 hari ini -> Check-Out Toko 1 dicatat sebagai Transit ke Toko berikutnya
    outTimingStatus = 'TRANSIT_TO_NEXT_STORE';
  } else if (outMinutes < targetEndMinutes) {
    outTimingStatus = 'EARLY_OUT';
    earlyOutMinutes = targetEndMinutes - outMinutes;
  }

  const nextAudit: ActualAttendanceSilentAudit = {
    ...(targetAgenda.silentAudit || {}),
    storeOrderIndex,
    totalStoresToday,
    outLat: gps?.lat,
    outLng: gps?.lng,
    outAccuracyMeters: gps?.accuracyMeters,
    outDistanceToStoreMeters: distanceToStore,
    outLocationStatus: locationStatus,
    outTimingStatus,
    earlyOutMinutes: earlyOutMinutes > 0 ? earlyOutMinutes : undefined,
    clockTamperDetected: clockTamperDetected || targetAgenda.silentAudit?.clockTamperDetected,
    recordedOfflineOut: isOffline,
    syncStatus: isOffline ? 'OFFLINE_QUEUED' : 'SYNCED',
    lastSyncedAt: isOffline ? undefined : nowIso,
  };

  const updatedTarget: ScheduleAgenda = {
    ...targetAgenda,
    actualIn: targetAgenda.actualIn || '08:30 WIB',
    actualOut: timeWib,
    actualOutIso: nowIso,
    completed: true,
    silentAudit: nextAudit,
  };

  saveLocalAttendanceEntry(updatedTarget.id, {
    actualIn: updatedTarget.actualIn,
    actualOut: updatedTarget.actualOut,
    actualInIso: updatedTarget.actualInIso,
    actualOutIso: updatedTarget.actualOutIso,
    completed: true,
    silentAudit: nextAudit,
  });

  if (isOffline) {
    enqueueOfflineAttendanceSync(updatedTarget);
  } else {
    pushSingleAgendaToCloud(updatedTarget);
  }

  return updatedTarget;
}
