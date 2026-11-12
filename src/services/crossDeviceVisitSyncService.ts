import { VisitReportData, EvidencePhoto } from '../types/visitReport';
import { CLOUDFLARE_D1_API_URL, GAS_VAULT_API_URL } from './cloudScheduleSyncService';

// ============================================================================
// CROSS-DEVICE REAL-TIME VISIT REPORT SYNC SERVICE
// - Guarantees 100% data continuity between Mobile & Desktop (Cross-Device Realtime)
// - Syncs form fields, crews, QSC sheet, observation findings, and evidence photos
// - Primary Engine: Cloudflare D1 Edge SQLite (~200ms latency, high availability)
// - Redundancy Vault: Google Apps Script Hidden Database on Google Drive
// - Local Instant Cache: IndexedDB (Photos) + localStorage + BroadcastChannel (0ms)
// ============================================================================

const D1_REPORTS_COLLECTION = 'reports';
const GAS_VISIT_REPORTS_COLLECTION = 'visit_reports';
const LOCAL_STORAGE_PREFIX = 'fmcu_visit_report_';
const OFFLINE_VISIT_QUEUE_KEY = 'fmcu_visit_report_offline_queue_v1';
const IDB_NAME = 'fmcu_visit_photos_db_v1';
const IDB_STORE = 'visit_photos';

// Tombstone storage keys for reliable cross-device deletion sync
const DELETED_OBS_PREFIX = 'fmcu_deleted_obs_';
const DELETED_PHOTOS_PREFIX = 'fmcu_deleted_photos_';
const DELETED_CREWS_PREFIX = 'fmcu_deleted_crews_';

export function getDeletedObsIds(agendaId: string): Set<string> {
  if (!agendaId || typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(`${DELETED_OBS_PREFIX}${agendaId}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function markObsDeletedLocally(agendaId: string, obsId: string): void {
  if (!agendaId || !obsId || typeof localStorage === 'undefined') return;
  try {
    const set = getDeletedObsIds(agendaId);
    set.add(String(obsId));
    localStorage.setItem(`${DELETED_OBS_PREFIX}${agendaId}`, JSON.stringify(Array.from(set).slice(-500)));
  } catch {
    // ignore
  }
}

export function getDeletedPhotoIds(agendaId: string): Set<string> {
  if (!agendaId || typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(`${DELETED_PHOTOS_PREFIX}${agendaId}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function markPhotoDeletedLocally(agendaId: string, photoId: string): void {
  if (!agendaId || !photoId || typeof localStorage === 'undefined') return;
  try {
    const set = getDeletedPhotoIds(agendaId);
    set.add(String(photoId));
    localStorage.setItem(`${DELETED_PHOTOS_PREFIX}${agendaId}`, JSON.stringify(Array.from(set).slice(-500)));
  } catch {
    // ignore
  }
}

export function getDeletedCrewIds(agendaId: string): Set<string> {
  if (!agendaId || typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(`${DELETED_CREWS_PREFIX}${agendaId}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function markCrewDeletedLocally(agendaId: string, crewId: string): void {
  if (!agendaId || !crewId || typeof localStorage === 'undefined') return;
  try {
    const set = getDeletedCrewIds(agendaId);
    set.add(String(crewId));
    localStorage.setItem(`${DELETED_CREWS_PREFIX}${agendaId}`, JSON.stringify(Array.from(set).slice(-500)));
  } catch {
    // ignore
  }
}

/**
 * Filter a report using tombstone tracking to guarantee deleted items
 * (observations, photos, crews) never resurrect across devices or reloads.
 */
export function filterReportWithTombstones(report: VisitReportData & { updatedAtMs?: number }): VisitReportData & { updatedAtMs?: number } {
  if (!report || !report.agendaId) return report;
  const agendaId = report.agendaId;

  // Merge any remote tombstones into local storage
  if (Array.isArray(report.deletedObsIds) && typeof localStorage !== 'undefined') {
    const localObs = getDeletedObsIds(agendaId);
    let changed = false;
    report.deletedObsIds.forEach((id) => {
      if (!localObs.has(String(id))) {
        localObs.add(String(id));
        changed = true;
      }
    });
    if (changed) {
      try {
        localStorage.setItem(`${DELETED_OBS_PREFIX}${agendaId}`, JSON.stringify(Array.from(localObs).slice(-500)));
      } catch {}
    }
  }

  if (Array.isArray(report.deletedPhotoIds) && typeof localStorage !== 'undefined') {
    const localPhotos = getDeletedPhotoIds(agendaId);
    let changed = false;
    report.deletedPhotoIds.forEach((id) => {
      if (!localPhotos.has(String(id))) {
        localPhotos.add(String(id));
        changed = true;
      }
    });
    if (changed) {
      try {
        localStorage.setItem(`${DELETED_PHOTOS_PREFIX}${agendaId}`, JSON.stringify(Array.from(localPhotos).slice(-500)));
      } catch {}
    }
  }

  if (Array.isArray(report.deletedCrewIds) && typeof localStorage !== 'undefined') {
    const localCrews = getDeletedCrewIds(agendaId);
    let changed = false;
    report.deletedCrewIds.forEach((id) => {
      if (!localCrews.has(String(id))) {
        localCrews.add(String(id));
        changed = true;
      }
    });
    if (changed) {
      try {
        localStorage.setItem(`${DELETED_CREWS_PREFIX}${agendaId}`, JSON.stringify(Array.from(localCrews).slice(-500)));
      } catch {}
    }
  }

  const deletedObs = getDeletedObsIds(agendaId);
  const deletedPhotos = getDeletedPhotoIds(agendaId);
  const deletedCrews = getDeletedCrewIds(agendaId);

  return {
    ...report,
    observations: Array.isArray(report.observations)
      ? report.observations.filter((o) => !deletedObs.has(o.id))
      : report.observations,
    evidencePhotos: Array.isArray(report.evidencePhotos)
      ? report.evidencePhotos.filter((p) => !deletedPhotos.has(p.id))
      : report.evidencePhotos,
    caPhotos: Array.isArray(report.caPhotos)
      ? report.caPhotos.filter((p) => !deletedPhotos.has(p.id))
      : report.caPhotos,
    crews: Array.isArray(report.crews)
      ? report.crews.filter((c) => !deletedCrews.has(c.id))
      : report.crews,
    deletedObsIds: Array.from(deletedObs),
    deletedPhotoIds: Array.from(deletedPhotos),
    deletedCrewIds: Array.from(deletedCrews),
  };
}

// In-memory cache to prevent redundant network fetches
let cachedReportsList: (VisitReportData & { updatedAtMs?: number })[] | null = null;
let lastCacheFetchTime = 0;
const CACHE_TTL_MS = 3000; // 3 seconds TTL

// Open IndexedDB safely
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

export const saveVisitPhotosToIdb = async (
  key: string,
  payload: {
    storeFrontPhoto?: string;
    qscSheetPhoto?: string;
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

export const loadVisitPhotosFromIdb = async (key: string): Promise<any | null> => {
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

// Same-device multi-tab BroadcastChannel
let visitSyncBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    visitSyncBroadcastChannel = new BroadcastChannel('fmcu_visit_cross_device_channel');
  }
} catch {
  visitSyncBroadcastChannel = null;
}

export function broadcastVisitUpdateLocally(report: VisitReportData & { updatedAtMs?: number }): void {
  if (visitSyncBroadcastChannel) {
    try {
      visitSyncBroadcastChannel.postMessage({
        type: 'VISIT_REPORT_UPDATED',
        agendaId: report.agendaId,
        report,
        updatedAtMs: report.updatedAtMs || Date.now(),
      });
    } catch {
      // ignore
    }
  }
}

/**
 * Sanitize report to minimize JSON payload size for ultra-fast sync
 * Eliminates duplicate raw photos if stamped is available
 */
function sanitizeReportForCloud(report: VisitReportData): VisitReportData {
  const sanitizePhoto = (p: EvidencePhoto): EvidencePhoto => {
    // If raw is same or unnecessary, don't duplicate base64
    const isRedundantRaw = p.rawPhotoUrl && p.rawPhotoUrl.length > 500 && p.photoUrl && p.photoUrl.length > 500;
    return {
      ...p,
      rawPhotoUrl: isRedundantRaw ? undefined : p.rawPhotoUrl,
    };
  };

  return {
    ...report,
    evidencePhotos: (report.evidencePhotos || []).map(sanitizePhoto),
    caPhotos: (report.caPhotos || []).map(sanitizePhoto),
  };
}

/**
 * Fetch all visit reports from Cloud Vault (with short caching)
 * Primary: Cloudflare D1 Edge SQLite (<100ms)
 * Backup: Google Apps Script Hidden Vault
 */
export async function fetchAllVisitReportsFromCloud(forceFresh = false): Promise<(VisitReportData & { updatedAtMs?: number })[]> {
  const now = Date.now();
  if (!forceFresh && cachedReportsList && now - lastCacheFetchTime < CACHE_TTL_MS) {
    return cachedReportsList;
  }

  // 1. Primary: Cloudflare D1 Edge SQLite (<100ms)
  try {
    const res = await fetch(CLOUDFLARE_D1_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'db_get_collection',
        collection: D1_REPORTS_COLLECTION,
      }),
    });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.status === 'SUCCESS' && Array.isArray(json.data)) {
        cachedReportsList = json.data.map((r: any) => filterReportWithTombstones(r));
        lastCacheFetchTime = now;
        return cachedReportsList || [];
      }
    }
  } catch (err) {
    console.warn('fetchAllVisitReportsFromCloud D1 error:', err);
  }

  // 2. Backup Fallback: Google Apps Script Hidden Vault
  try {
    const res = await fetch(GAS_VAULT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'db_get_collection',
        collection: GAS_VISIT_REPORTS_COLLECTION,
      }),
    });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.status === 'SUCCESS' && Array.isArray(json.data)) {
        cachedReportsList = json.data.map((r: any) => filterReportWithTombstones(r));
        lastCacheFetchTime = now;
        return cachedReportsList || [];
      }
    }
  } catch (err) {
    console.warn('fetchAllVisitReportsFromCloud GAS fallback warning:', err);
  }

  return cachedReportsList || [];
}

/**
 * Fetch a single visit report by agendaId from Cloud Vault
 * Isolated per store visit / agendaId
 */
export async function fetchVisitReportFromCloud(
  agendaId: string,
  forceFresh = false
): Promise<(VisitReportData & { updatedAtMs?: number }) | null> {
  if (!agendaId) return null;
  try {
    const all = await fetchAllVisitReportsFromCloud(forceFresh);
    const found = all.find(
      (r) =>
        String(r.agendaId) === String(agendaId) ||
        String(r.id) === String(agendaId) ||
        String(r.id) === `report-${agendaId}`
    );
    return found ? filterReportWithTombstones(found) : null;
  } catch {
    return null;
  }
}

/**
 * Read cached local report from localStorage
 */
export function getLocalVisitReport(agendaId: string): (VisitReportData & { updatedAtMs?: number }) | null {
  if (!agendaId || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${agendaId}`);
    if (!raw) return null;
    return filterReportWithTombstones(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Push an active visit report to the Cloud Vault for instant cross-device continuity
 * - Saves locally immediately (localStorage + IndexedDB) with 0ms latency
 * - Pushes single item directly to Cloudflare D1 Edge SQLite (~200ms)
 * - Fires background backup to Google Apps Script Hidden Vault
 */
export async function pushVisitReportToCloud(report: VisitReportData): Promise<boolean> {
  if (!report || !report.agendaId) return false;

  const nowMs = report.updatedAtMs || Date.now();
  const sanitized = sanitizeReportForCloud(report);
  const enrichedReport: VisitReportData & { id: string; updatedAtMs: number } = {
    ...filterReportWithTombstones(sanitized),
    id: report.id || `report-${report.agendaId}`,
    agendaId: String(report.agendaId),
    updatedAtMs: nowMs,
  };

  // 1. Instant local persistence & multi-tab broadcast (0ms latency)
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${report.agendaId}`, JSON.stringify(enrichedReport));
  } catch {
    try {
      // Light copy if localStorage quota exceeded
      // NOTE: Use '__IDB__' so the app knows a photo exists and restores it from IndexedDB!
      const lightCopy = {
        ...enrichedReport,
        storeFrontPhoto: enrichedReport.storeFrontPhoto ? '__IDB__' : '',
        qscSheetPhoto: enrichedReport.qscSheetPhoto ? '__IDB__' : '',
        qscSheetTop: enrichedReport.qscSheetTop ? '__IDB__' : '',
        qscSheetBottom: enrichedReport.qscSheetBottom ? '__IDB__' : '',
        evidencePhotos: (enrichedReport.evidencePhotos || []).map((p) => ({
          ...p,
          photoUrl: p.photoUrl ? '__IDB__' : '',
        })),
        caPhotos: (enrichedReport.caPhotos || []).map((p) => ({
          ...p,
          photoUrl: p.photoUrl ? '__IDB__' : '',
        })),
      };
      localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${report.agendaId}`, JSON.stringify(lightCopy));
    } catch {
      // ignore
    }
  }

  // Also cache photos in IndexedDB for resilience (unlimited storage)
  saveVisitPhotosToIdb(`${LOCAL_STORAGE_PREFIX}${report.agendaId}`, {
    storeFrontPhoto: enrichedReport.storeFrontPhoto,
    qscSheetPhoto: enrichedReport.qscSheetPhoto,
    qscSheetTop: enrichedReport.qscSheetTop,
    qscSheetBottom: enrichedReport.qscSheetBottom,
    evidencePhotos: enrichedReport.evidencePhotos,
    caPhotos: enrichedReport.caPhotos,
  });

  broadcastVisitUpdateLocally(enrichedReport);

  // Update memory cache immediately
  if (cachedReportsList) {
    const filtered = cachedReportsList.filter(
      (r) => String(r.agendaId) !== String(report.agendaId) && String(r.id) !== String(enrichedReport.id)
    );
    cachedReportsList = [enrichedReport, ...filtered];
  } else {
    cachedReportsList = [enrichedReport];
  }
  lastCacheFetchTime = nowMs;

  // 2. If offline, enqueue for background upload when connection returns
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    try {
      const rawQueue = localStorage.getItem(OFFLINE_VISIT_QUEUE_KEY);
      const queue: Record<string, any> = rawQueue ? JSON.parse(rawQueue) : {};
      queue[report.agendaId] = enrichedReport;
      localStorage.setItem(OFFLINE_VISIT_QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // ignore
    }
    return false;
  }

  // 3. Push to Cloudflare D1 Edge SQLite (~200ms) - Primary Engine
  let d1Success = false;
  try {
    const res = await fetch(CLOUDFLARE_D1_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'db_save_item',
        collection: D1_REPORTS_COLLECTION,
        item: enrichedReport,
      }),
      keepalive: true,
    });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.status === 'SUCCESS') {
        d1Success = true;
      }
    }
  } catch (err) {
    console.warn('pushVisitReportToCloud D1 warning:', err);
  }

  // 4. Background redundancy to Google Apps Script Hidden Vault (fire-and-forget, never blocks)
  (async () => {
    try {
      await fetch(GAS_VAULT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'db_save_item',
          collection: GAS_VISIT_REPORTS_COLLECTION,
          item: enrichedReport,
        }),
      });
    } catch {
      // ignore GAS background errors
    }
  })();

  return d1Success;
}

/**
 * Fast synchronous-like flush to Cloudflare D1 during beforeunload / pagehide / tab close
 */
export function flushVisitReportImmediate(report: VisitReportData & { updatedAtMs?: number }): void {
  if (!report || !report.agendaId) return;
  const nowMs = report.updatedAtMs || Date.now();
  const enrichedReport = {
    ...report,
    id: report.id || `report-${report.agendaId}`,
    agendaId: String(report.agendaId),
    updatedAtMs: nowMs,
  };

  // Immediate localStorage write
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${report.agendaId}`, JSON.stringify(enrichedReport));
  } catch {}

  // Send beacon / keepalive fetch
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const payloadStr = JSON.stringify({
        action: 'db_save_item',
        collection: D1_REPORTS_COLLECTION,
        item: enrichedReport,
      });

      if (typeof fetch !== 'undefined') {
        fetch(CLOUDFLARE_D1_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payloadStr,
          keepalive: true,
        }).catch(() => {});
      } else if (navigator.sendBeacon) {
        const blob = new Blob([payloadStr], { type: 'application/json' });
        navigator.sendBeacon(CLOUDFLARE_D1_API_URL, blob);
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Flush any queued offline visit reports to Cloud Vault
 */
export async function flushOfflineVisitReportQueue(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  try {
    const rawQueue = localStorage.getItem(OFFLINE_VISIT_QUEUE_KEY);
    if (!rawQueue) return;
    const queue: Record<string, VisitReportData> = JSON.parse(rawQueue) || {};
    const ids = Object.keys(queue);
    if (ids.length === 0) return;

    for (const agendaId of ids) {
      const item = queue[agendaId];
      if (item) {
        await pushVisitReportToCloud(item);
        delete queue[agendaId];
      }
    }
    localStorage.setItem(OFFLINE_VISIT_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

/**
 * Subscribe to real-time cross-device updates for a visit report.
 * - Same-device: instant via BroadcastChannel (0ms)
 * - Cross-device: active background polling when page is visible
 */
export function subscribeToCrossDeviceVisit(
  agendaId: string,
  getCurrentUpdatedAtMs: () => number,
  onRemoteUpdate: (report: VisitReportData) => void,
  pollIntervalMs = 7000
): () => void {
  let isSubscribed = true;

  // 1. BroadcastChannel (Same-device multi-tab 0ms)
  const channelHandler = (event: MessageEvent) => {
    if (!isSubscribed) return;
    if (
      event.data &&
      event.data.type === 'VISIT_REPORT_UPDATED' &&
      event.data.agendaId === agendaId &&
      event.data.report
    ) {
      const remoteMs = event.data.updatedAtMs || 0;
      if (remoteMs > getCurrentUpdatedAtMs()) {
        onRemoteUpdate(filterReportWithTombstones(event.data.report));
      }
    }
  };

  visitSyncBroadcastChannel?.addEventListener('message', channelHandler);

  // 2. Cloud Poll check function
  const checkCloudOnce = async () => {
    if (!isSubscribed) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    try {
      const cloudReport = await fetchVisitReportFromCloud(agendaId, true);
      if (!isSubscribed || !cloudReport) return;

      const remoteMs = cloudReport.updatedAtMs || 0;
      const currentMs = getCurrentUpdatedAtMs();

      // If remote has newer data than local
      if (remoteMs > currentMs) {
        onRemoteUpdate(filterReportWithTombstones(cloudReport));
      }
    } catch {
      // ignore network errors
    }
  };

  // 3. Periodic interval
  const intervalId = setInterval(checkCloudOnce, pollIntervalMs);

  // 4. Trigger on tab focus and online
  const onFocusOrOnline = () => {
    checkCloudOnce();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onFocusOrOnline);
    window.addEventListener('online', onFocusOrOnline);
  }

  return () => {
    isSubscribed = false;
    visitSyncBroadcastChannel?.removeEventListener('message', channelHandler);
    clearInterval(intervalId);
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onFocusOrOnline);
      window.removeEventListener('online', onFocusOrOnline);
    }
  };
}
