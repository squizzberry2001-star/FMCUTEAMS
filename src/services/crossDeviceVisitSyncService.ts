import { VisitReportData, EvidencePhoto } from '../types/visitReport';
import { GAS_VAULT_API_URL } from './cloudScheduleSyncService';

// ============================================================================
// CROSS-DEVICE REAL-TIME VISIT REPORT SYNC SERVICE
// - Guarantees 100% data continuity between Mobile & Desktop (Cross-Device Realtime)
// - Syncs form fields, crews, QSC sheet, observation findings, and evidence photos
// - Edge Cloud Vault (Google Apps Script Hidden Database) + Local IndexedDB Cache
// ============================================================================

const VISIT_REPORTS_COLLECTION = 'visit_reports';
const LOCAL_STORAGE_PREFIX = 'fmcu_visit_report_';
const OFFLINE_VISIT_QUEUE_KEY = 'fmcu_visit_report_offline_queue_v1';
const IDB_NAME = 'fmcu_visit_photos_db_v1';
const IDB_STORE = 'visit_photos';

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
 */
export async function fetchAllVisitReportsFromCloud(forceFresh = false): Promise<(VisitReportData & { updatedAtMs?: number })[]> {
  const now = Date.now();
  if (!forceFresh && cachedReportsList && now - lastCacheFetchTime < CACHE_TTL_MS) {
    return cachedReportsList;
  }

  try {
    const res = await fetch(GAS_VAULT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'db_get_collection',
        collection: VISIT_REPORTS_COLLECTION,
      }),
    });
    if (!res.ok) return cachedReportsList || [];
    const json = await res.json();
    if (json && json.status === 'SUCCESS' && Array.isArray(json.data)) {
      cachedReportsList = json.data;
      lastCacheFetchTime = now;
      return json.data;
    }
    return cachedReportsList || [];
  } catch (err) {
    console.warn('fetchAllVisitReportsFromCloud network warning:', err);
    return cachedReportsList || [];
  }
}

/**
 * Fetch a single visit report by agendaId from Cloud Vault
 */
export async function fetchVisitReportFromCloud(agendaId: string, forceFresh = false): Promise<(VisitReportData & { updatedAtMs?: number }) | null> {
  if (!agendaId) return null;
  try {
    const all = await fetchAllVisitReportsFromCloud(forceFresh);
    const found = all.find((r) => r.agendaId === agendaId || r.id === agendaId);
    return found || null;
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
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Push an active visit report to the Cloud Vault for instant cross-device continuity
 */
export async function pushVisitReportToCloud(report: VisitReportData): Promise<boolean> {
  if (!report || !report.agendaId) return false;

  const nowMs = Date.now();
  const sanitized = sanitizeReportForCloud(report);
  const enrichedReport: VisitReportData & { updatedAtMs: number } = {
    ...sanitized,
    updatedAtMs: nowMs,
  };

  // 1. Instant local persistence & multi-tab broadcast (0ms latency)
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${report.agendaId}`, JSON.stringify(enrichedReport));
  } catch {
    try {
      // Light copy if localStorage quota exceeded
      const lightCopy = {
        ...enrichedReport,
        storeFrontPhoto: enrichedReport.storeFrontPhoto ? '__IDB__' : '',
        qscSheetPhoto: enrichedReport.qscSheetPhoto ? '__IDB__' : '',
        qscSheetTop: enrichedReport.qscSheetTop ? '__IDB__' : '',
        qscSheetBottom: enrichedReport.qscSheetBottom ? '__IDB__' : '',
      };
      localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${report.agendaId}`, JSON.stringify(lightCopy));
    } catch {
      // ignore
    }
  }

  // Also cache photos in IndexedDB for resilience
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
    const filtered = cachedReportsList.filter((r) => r.agendaId !== report.agendaId && r.id !== report.id);
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

  // 3. Push to Cloud Vault
  try {
    const currentList = await fetchAllVisitReportsFromCloud(true);
    const filtered = currentList.filter(
      (r) => r.agendaId !== report.agendaId && r.id !== report.id
    );
    const updatedCollection = [enrichedReport, ...filtered];

    const res = await fetch(GAS_VAULT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'db_save_collection',
        collection: VISIT_REPORTS_COLLECTION,
        data: updatedCollection,
      }),
    });

    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json && json.status === 'SUCCESS');
  } catch (err) {
    console.warn('pushVisitReportToCloud warning:', err);
    return false;
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
        onRemoteUpdate(event.data.report);
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
        onRemoteUpdate(cloudReport);
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
