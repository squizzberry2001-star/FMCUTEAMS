import { ScheduleAgenda, ScheduleCategory, User } from '../types';
import { MasterStore, getBestieByStoreCode, getMasterStores } from '../data/masterStoresData';

// ============================================================================
// CROSS-DEVICE REAL-TIME CLOUD SCHEDULE, USER & MASTER STORE SYNC SERVICE
// Primary Engine : Cloudflare D1 Edge SQLite (~20ms latency, 5M reads/day)
// Backup Vault   : Google Apps Script Hidden Vault on Google Drive
// Local Instant  : BroadcastChannel + Storage Event (0ms multi-tab sync)
// ============================================================================

export const CLOUDFLARE_D1_API_URL = 'https://fmcuonegatesystem-edge-api.pages.dev/api';
export const GAS_VAULT_API_URL =
  'https://script.google.com/macros/s/AKfycbxC29L4Cb3NNvUl4IRe0MGDnrluvCvv1neuTjQieA8j7C4n7zgGfQ3dMA8SLXYBG0AWtw/exec';

const DELETED_AGENDA_IDS_KEY = 'fmcu_deleted_agenda_ids_v5';
const SCHEDULE_WRITE_LOCK_KEY = 'fmcu_schedule_write_protect_until_v1';
const PENDING_SCHEDULES_QUEUE_KEY = 'fmcu_pending_schedules_queue_v1';

const MASTER_STORES_COLLECTION = 'stores'; // Cloudflare D1 only allows 'schedules', 'users', 'reports', 'stores'
const GAS_MASTER_STORES_META_COLLECTION = 'master_stores_meta';
const MASTER_STORES_CHUNK_SIZE = 200; // Fallback chunk size if db_save_collection hits size limits
const KEEP_ALIVE_MAX_BYTES = 48_000; // Browser fetch keepalive hard cap is 64 KiB
const GAS_BACKGROUND_GRACE_MS = 1_800; // Do not stall Admin UI spinner for slow GAS Drive writes after D1 succeeds

export interface CloudSyncResult {
  ok: boolean;
  d1Synced: boolean;
  gasSynced: boolean;
  syncedCount: number;
  queuedOffline?: boolean;
  error?: string;
}

export interface MasterStoreMetadata {
  version: number;
  updatedAt: string;
  updatedBy: string;
  sourceFilename?: string;
  totalStores: number;
  addedCount: number;
  updatedCount: number;
  cloudSynced?: boolean;
}

export interface PendingSchedulesQueueEntry {
  agendas: ScheduleAgenda[];
  users?: User[];
  savedAtMs: number;
  d1Pending?: boolean;
  gasPending?: boolean;
}

export interface PushSchedulesOptions {
  clearDeletedTombstones?: boolean;
  replaceAll?: boolean;
}

// ============================================================================
// WRITE-PROTECTION & OFFLINE RETRY QUEUE (Prevents 5s polling overwrite race)
// ============================================================================
let isBulkWriteInFlight = false;
let isGasBackupInFlight = false;
let inMemoryWriteProtectUntilMs = 0;
let isFlushingPendingQueue = false;

export function markScheduleWriteProtection(durationMs = 20_000): void {
  const until = Date.now() + Math.max(1000, durationMs);
  inMemoryWriteProtectUntilMs = Math.max(inMemoryWriteProtectUntilMs, until);
  if (typeof localStorage !== 'undefined') {
    try {
      const existing = Number(localStorage.getItem(SCHEDULE_WRITE_LOCK_KEY) || '0');
      localStorage.setItem(SCHEDULE_WRITE_LOCK_KEY, String(Math.max(existing, until)));
    } catch {
      // ignore storage errors
    }
  }
}

export function clearScheduleWriteProtection(): void {
  inMemoryWriteProtectUntilMs = 0;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(SCHEDULE_WRITE_LOCK_KEY);
    } catch {
      // ignore
    }
  }
}

export function getPendingSchedulesQueue(): PendingSchedulesQueueEntry | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PENDING_SCHEDULES_QUEUE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.agendas)) {
      return parsed as PendingSchedulesQueueEntry;
    }
  } catch {
    // ignore
  }
  return null;
}

function savePendingSchedulesQueue(entry: PendingSchedulesQueueEntry): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PENDING_SCHEDULES_QUEUE_KEY, JSON.stringify(entry));
  } catch (err) {
    console.warn('Failed to persist pending schedules queue:', err);
  }
}

export function clearPendingSchedulesQueue(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(PENDING_SCHEDULES_QUEUE_KEY);
  } catch {
    // ignore
  }
}

export function isScheduleSyncProtected(): boolean {
  if (isBulkWriteInFlight) return true;
  const now = Date.now();
  if (now < inMemoryWriteProtectUntilMs) return true;
  if (typeof localStorage !== 'undefined') {
    try {
      const storedUntil = Number(localStorage.getItem(SCHEDULE_WRITE_LOCK_KEY) || '0');
      if (now < storedUntil) return true;
    } catch {
      // ignore
    }
  }
  if (getPendingSchedulesQueue() !== null) return true;
  return false;
}

export async function flushPendingSchedulesQueue(): Promise<CloudSyncResult | null> {
  if (isFlushingPendingQueue || isBulkWriteInFlight || isGasBackupInFlight) return null;
  const pending = getPendingSchedulesQueue();
  if (!pending) return null;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;

  // Avoid hammering GAS every 5s if D1 already synced and GAS just recently attempted
  if (!pending.d1Pending && pending.gasPending && Date.now() - (pending.savedAtMs || 0) < 15_000) {
    return null;
  }

  isFlushingPendingQueue = true;
  try {
    if (!pending.d1Pending && pending.gasPending) {
      isGasBackupInFlight = true;
      try {
        const enriched = pending.agendas.map(enrichAgendaForCloud);
        const importedIds = new Set(pending.agendas.map((a) => String(a.id)));
        await cleanGasTombstonesForIds(importedIds, false);
        const gasOk = await pushCollectionWithFallback(GAS_VAULT_API_URL, 'schedules', enriched, {
          singleItemAction: 'db_save_schedule',
          singleItemKey: 'schedule',
          deleteItemAction: 'db_delete_schedule',
          deleteIdKey: 'scheduleId',
          concurrency: 4,
          maxDirectCollectionBytes: 2_500_000,
          timeoutMs: 25_000,
        });
        if (gasOk) {
          clearPendingSchedulesQueue();
        }
        return {
          ok: true,
          d1Synced: true,
          gasSynced: gasOk,
          syncedCount: pending.agendas.length,
        };
      } finally {
        isGasBackupInFlight = false;
      }
    }

    return await pushAllSchedulesToCloud(pending.agendas, pending.users, {
      clearDeletedTombstones: true,
    });
  } finally {
    isFlushingPendingQueue = false;
  }
}

// ============================================================================
// DELETED AGENDA TOMBSTONES (LOCAL + CLOUD)
// ============================================================================
export function getDeletedAgendaIds(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_AGENDA_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

export function markAgendaDeletedLocally(id: string): void {
  if (!id || typeof localStorage === 'undefined') return;
  try {
    const set = getDeletedAgendaIds();
    set.add(String(id));
    localStorage.setItem(DELETED_AGENDA_IDS_KEY, JSON.stringify(Array.from(set).slice(-1000)));
  } catch {
    // ignore storage errors
  }
}

export function unmarkAgendasDeletedLocally(ids: Iterable<string>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const set = getDeletedAgendaIds();
    let changed = false;
    for (const id of ids) {
      if (set.delete(String(id))) changed = true;
    }
    if (changed) {
      localStorage.setItem(DELETED_AGENDA_IDS_KEY, JSON.stringify(Array.from(set).slice(-1000)));
    }
  } catch {
    // ignore
  }
}

export function clearDeletedAgendaIds(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(DELETED_AGENDA_IDS_KEY);
  } catch {
    // ignore
  }
}

// ============================================================================
// SCHEDULE SCHEMA ENRICHMENT & NORMALIZATION (FMCU Teams <-> FMCU OneGate)
// ============================================================================
export function enrichAgendaForCloud(agenda: ScheduleAgenda): Record<string, any> {
  const isVisit = agenda.category === 'VISIT';
  const resolvedStoreCode = isVisit
    ? agenda.storeCode || 'STORE'
    : agenda.category === 'NSO'
      ? 'NSO'
      : agenda.category === 'OFF'
        ? 'OFF'
        : agenda.category === 'CUTI'
          ? 'CUTI'
          : 'AGENDA';

  const resolvedStoreName = isVisit ? agenda.storeName || agenda.title : agenda.title;
  const auditorSlug = String(agenda.pic || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  return {
    ...agenda,
    id: String(agenda.id),
    refStoreCode: agenda.storeCode,
    refStoreName: agenda.storeName,
    storeCode: resolvedStoreCode,
    storeName: resolvedStoreName,
    auditorId: `usr-${auditorSlug || 'user'}`,
    auditorName: agenda.pic,
    scheduledDate: agenda.date,
    endDate: agenda.endDate || agenda.date,
    shiftWindow: `${agenda.time || '08:30'} - ${agenda.endTime || '17:30'}`,
    status: agenda.completed ? 'COMPLETED' : isVisit ? 'SCHEDULED' : 'AGENDA',
    agendaCategory: isVisit ? 'VISIT_STORE' : agenda.category,
    agendaLocation: agenda.location,
    notes: agenda.description,
    auditFocus: agenda.description || agenda.title,
    isAgenda: !isVisit,
    _fmcuTeamsV5: true,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeCloudScheduleToAgenda(item: any): ScheduleAgenda | null {
  if (!item || !item.id) return null;

  // 1. Native FMCU Teams v5 record (or has title + date + pic + category)
  if (item.title && item.date && item.pic && item.category) {
    const isVisit = item.category === 'VISIT';
    const isCompleted = Boolean(
      item.completed || item.status === 'COMPLETED' || item.category === 'OFF'
    );
    return {
      id: String(item.id),
      title: String(item.title),
      date: String(item.date),
      endDate: String(item.endDate || item.date),
      time: String(item.time || '08:30'),
      endTime: String(item.endTime || '17:30'),
      category: item.category as ScheduleCategory,
      location: String(item.location || ''),
      pic: String(item.pic),
      description: String(item.description || ''),
      rawDescription: item.rawDescription ? String(item.rawDescription) : undefined,
      rawLocation: item.rawLocation ? String(item.rawLocation) : undefined,
      storeCode: isVisit ? String(item.refStoreCode || item.storeCode || '') : item.refStoreCode,
      storeName: isVisit ? String(item.refStoreName || item.storeName || '') : item.refStoreName,
      storeType: item.storeType,
      storeHead: item.storeHead,
      areaManager: item.areaManager,
      regionalManager: item.regionalManager,
      storeEmail: item.storeEmail,
      bestieInCharge: item.bestieInCharge,
      tags: Array.isArray(item.tags) ? item.tags : [item.category],
      completed: isCompleted,
      priority: item.priority === 'HIGH' ? 'HIGH' : 'NORMAL',
      createdBy: item.createdBy || 'Cloud Sync',
      actualIn: item.actualIn ? String(item.actualIn) : undefined,
      actualOut: item.actualOut ? String(item.actualOut) : undefined,
      actualInIso: item.actualInIso ? String(item.actualInIso) : undefined,
      actualOutIso: item.actualOutIso ? String(item.actualOutIso) : undefined,
      silentAudit: item.silentAudit || undefined,
      kendala: item.kendala ? String(item.kendala) : undefined,
      kendalaCategory: item.kendalaCategory ? String(item.kendalaCategory) : undefined,
      kendalaReportedAt: item.kendalaReportedAt ? String(item.kendalaReportedAt) : undefined,
      kendalaReportedBy: item.kendalaReportedBy ? String(item.kendalaReportedBy) : undefined,
    };
  }

  // 2. Record created via FMCU OneGate / legacy schema
  const dateStr = String(item.scheduledDate || item.date || '').trim();
  const picName = String(item.auditorName || item.pic || '').trim();
  if (!dateStr || !picName) return null;

  const shiftParts = String(item.shiftWindow || '08:30 - 17:30').split('-');
  const startTime = (shiftParts[0] || '08:30').trim();
  const endTime = (shiftParts[1] || '17:30').trim();

  const rawCat = String(item.agendaCategory || item.storeType || '').toUpperCase();
  const rawCode = String(item.storeCode || '').toUpperCase();

  let category: ScheduleCategory = 'OPERATION';
  if (
    rawCat === 'VISIT_STORE' ||
    rawCat === 'VISIT' ||
    (!item.isAgenda && rawCode && !['AGENDA', 'NSO', 'OFF', 'CUTI', 'NON_STORE'].includes(rawCode))
  ) {
    category = 'VISIT';
  } else if (rawCat.includes('NSO') || rawCode === 'NSO') {
    category = 'NSO';
  } else if (rawCat === 'CUTI' || rawCode === 'CUTI') {
    category = 'CUTI';
  } else if (rawCat === 'OFF' || rawCode === 'OFF' || item.status === 'OFF') {
    category = 'OFF';
  } else if (rawCat.includes('TRAIN')) {
    category = 'TRAINING';
  } else if (rawCat.includes('MEET')) {
    category = 'MEETING';
  } else if (rawCat.includes('WORK') || rawCat.includes('PLAN')) {
    category = 'WORK_PLAN';
  } else if (rawCat.includes('AUDIT') || rawCat.includes('ASSESSMENT')) {
    category = 'AUDIT';
  }

  const allStores = getMasterStores();
  const matchedStore =
    category === 'VISIT'
      ? allStores.find(
          (s) =>
            String(s.code).toUpperCase() === rawCode ||
            String(s.name).toUpperCase() === String(item.storeName || '').toUpperCase()
        )
      : undefined;

  const storeName = matchedStore?.name || String(item.storeName || '');
  const title =
    category === 'VISIT'
      ? `Visit Store - ${storeName}`
      : String(item.storeName || item.auditFocus || 'Agenda Operasional');

  const location =
    category === 'VISIT' && matchedStore
      ? `${matchedStore.name} (${matchedStore.code}) - ${matchedStore.city}`
      : String(item.agendaLocation || item.storeName || 'FMCU / Head Office');

  const rawNotes = String(item.notes || item.auditFocus || '').replace(/^\s*agenda\s*:\s*/i, '');

  return {
    id: String(item.id),
    title,
    date: dateStr,
    endDate: String(item.endDate || dateStr),
    time: startTime,
    endTime,
    category,
    location,
    pic: picName,
    description: rawNotes ? rawNotes.replace(/\r?\n/g, ' | ') : title,
    storeCode: category === 'VISIT' ? matchedStore?.code || rawCode : undefined,
    storeName: category === 'VISIT' ? storeName : undefined,
    storeType: matchedStore?.type || item.storeType,
    storeHead: matchedStore?.storeHead,
    areaManager: matchedStore?.areaManager,
    regionalManager: matchedStore?.regionalManager,
    storeEmail: matchedStore?.email,
    bestieInCharge: matchedStore ? getBestieByStoreCode(matchedStore.code) : undefined,
    tags: [category],
    completed: Boolean(item.status === 'COMPLETED' || category === 'OFF'),
    priority: category === 'VISIT' || category === 'NSO' ? 'HIGH' : 'NORMAL',
    createdBy: item.assignedBy || 'Cloud Sync',
  };
}

// ============================================================================
// SAFE CLOUD HTTP TRANSPORT (Fixes keepalive 64 KiB client-side rejection)
// ============================================================================
interface PostCloudOptions {
  keepalive?: boolean;
  timeoutMs?: number;
  retries?: number;
}

function isCloudRespSuccess(resp: any): boolean {
  return Boolean(resp && (resp.status === 'SUCCESS' || resp.ok === true));
}

async function postCloudEndpoint(
  url: string,
  payload: Record<string, any>,
  options: PostCloudOptions = {}
): Promise<any> {
  const bodyStr = JSON.stringify(payload);
  // CRITICAL FIX: Never set keepalive:true for payloads >= 48 KB (browser fetch limit is 64 KiB)
  const useKeepalive = Boolean(options.keepalive) && bodyStr.length < KEEP_ALIVE_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? 25_000;
  const maxAttempts = 1 + Math.max(0, options.retries ?? 0);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const sep = url.includes('?') ? '&' : '?';
      const res = await fetch(`${url}${sep}t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: bodyStr,
        keepalive: useKeepalive,
        signal: controller ? controller.signal : undefined,
      });
      if (timer) clearTimeout(timer);
      if (!res.ok) {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 350 * attempt));
          continue;
        }
        return null;
      }
      return await res.json().catch(() => null);
    } catch (err) {
      if (timer) clearTimeout(timer);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 350 * attempt));
        continue;
      }
      console.warn('postCloudEndpoint fetch warning for', url, err);
      return null;
    }
  }
  return null;
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await worker(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

async function pushCollectionWithFallback(
  url: string,
  collection: string,
  items: Record<string, any>[],
  options: {
    singleItemAction?: string;
    singleItemKey?: string;
    deleteItemAction?: string;
    deleteIdKey?: string;
    concurrency?: number;
    maxDirectCollectionBytes?: number;
    timeoutMs?: number;
  } = {}
): Promise<boolean> {
  const maxDirectBytes = options.maxDirectCollectionBytes ?? 280_000;
  const serializedLen = JSON.stringify(items).length;

  // 1. Fast path: single db_save_collection when payload is within safe threshold
  if (items.length === 0 || serializedLen <= maxDirectBytes) {
    const resp = await postCloudEndpoint(
      url,
      {
        action: 'db_save_collection',
        collection,
        data: items,
      },
      { timeoutMs: options.timeoutMs ?? 30_000, retries: 1 }
    );
    if (isCloudRespSuccess(resp)) {
      return true;
    }
    if (items.length === 0) {
      return false;
    }
  }

  // 2. Large-payload or fallback path:
  //    Fetch existing remote IDs -> delete stale IDs -> batched upsert via db_save_item
  //    (Never calls db_save_collection per chunk because db_save_collection overwrites whole collection!)
  const singleAction = options.singleItemAction || 'db_save_item';
  const singleKey = options.singleItemKey || 'item';
  const deleteAction = options.deleteItemAction || 'db_delete_item';
  const deleteIdKey = options.deleteIdKey || 'id';
  const concurrency = options.concurrency ?? 6;

  try {
    const existingResp = await postCloudEndpoint(
      url,
      { action: 'db_get_collection', collection },
      { timeoutMs: 15_000, retries: 1 }
    );
    const newIdSet = new Set(items.map((it) => String(it.id)));
    if (isCloudRespSuccess(existingResp) && Array.isArray(existingResp.data)) {
      const staleIds = existingResp.data
        .map((it: any) => String(it?.id || ''))
        .filter((id: string) => id && !newIdSet.has(id));
      if (staleIds.length > 0) {
        await runWithConcurrency(staleIds, concurrency, async (staleId) => {
          await postCloudEndpoint(
            url,
            {
              action: deleteAction,
              collection,
              [deleteIdKey]: staleId,
            },
            { timeoutMs: 12_000, retries: 1 }
          );
        });
      }
    }
  } catch {
    // Non-fatal: continue upserting new items
  }

  const upsertResults = await runWithConcurrency(items, concurrency, async (item) => {
    const payload: Record<string, any> = {
      action: singleAction,
      [singleKey]: item,
    };
    if (singleAction === 'db_save_item') {
      payload.collection = collection;
    }
    const resp = await postCloudEndpoint(url, payload, { timeoutMs: 15_000, retries: 2 });
    return isCloudRespSuccess(resp);
  });

  const successCount = upsertResults.filter(Boolean).length;
  return successCount === items.length;
}

// ============================================================================
// FETCH & PUSH SCHEDULES + USERS
// ============================================================================
function parseUpdatedAtMs(item: any): number {
  if (!item) return 0;
  if (typeof item.updatedAtMs === 'number') return item.updatedAtMs;
  if (item.updatedAt) {
    const parsed = Date.parse(String(item.updatedAt));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

let cachedTombstonesMap: Map<string, number> = new Map();
let lastTombstoneFetchMs = 0;

/**
 * Fetch latest schedules from Cloudflare D1 Edge DB (or fallback to Google Apps Script Vault).
 * Returns null if BOTH cloud endpoints failed (offline/error), or ScheduleAgenda[] (possibly []) on success.
 */
export async function fetchSchedulesFromCloud(): Promise<ScheduleAgenda[] | null> {
  // 0. Fetch GAS tombstones with 20s cache so 5s polling hits fast D1 (~800ms) instead of stalling on GAS
  const tombstoneAgeMs = Date.now() - lastTombstoneFetchMs;
  const tombstonePromise =
    tombstoneAgeMs < 20_000 && lastTombstoneFetchMs > 0
      ? Promise.resolve(cachedTombstonesMap)
      : (async (): Promise<Map<string, number>> => {
          const map = new Map<string, number>();
          try {
            const resp = await postCloudEndpoint(
              GAS_VAULT_API_URL,
              {
                action: 'db_get_collection',
                collection: 'deleted_schedules',
              },
              { timeoutMs: 8_000 }
            );
            if (isCloudRespSuccess(resp) && Array.isArray(resp.data)) {
              resp.data.forEach((item: any) => {
                const id = String(item?.id || item || '').trim();
                const deletedAtMs = Number(item?.deletedAtMs || 0);
                if (id) {
                  const prev = map.get(id) || 0;
                  map.set(id, Math.max(prev, deletedAtMs));
                }
              });
              cachedTombstonesMap = map;
              lastTombstoneFetchMs = Date.now();
            }
          } catch {
            // ignore
          }
          return cachedTombstonesMap.size > 0 ? cachedTombstonesMap : map;
        })();

  // 1. Try Cloudflare D1 Edge SQLite first (~200-900ms)
  const d1Resp = await postCloudEndpoint(
    CLOUDFLARE_D1_API_URL,
    {
      action: 'db_get_collection',
      collection: 'schedules',
    },
    { timeoutMs: 10_000 }
  );

  // Give GAS tombstones at most 1s extra if cache is stale; otherwise use cached map immediately
  const cloudTombstones = await Promise.race([
    tombstonePromise,
    new Promise<Map<string, number>>((resolve) =>
      setTimeout(() => resolve(cachedTombstonesMap), 1_000)
    ),
  ]);
  const localDeletedIds = getDeletedAgendaIds();

  let rawList: any[] | null =
    isCloudRespSuccess(d1Resp) && Array.isArray(d1Resp.data) ? d1Resp.data : null;

  // 2. Fallback to GAS Vault if D1 failed, returned empty, OR D1 write is still pending in queue
  const pendingQueue = getPendingSchedulesQueue();
  const shouldFallbackToGas =
    rawList === null ||
    rawList.length === 0 ||
    Boolean(pendingQueue && pendingQueue.d1Pending && !pendingQueue.gasPending);

  if (shouldFallbackToGas) {
    const gasResp = await postCloudEndpoint(
      GAS_VAULT_API_URL,
      {
        action: 'db_get_collection',
        collection: 'schedules',
      },
      { timeoutMs: 20_000 }
    );
    if (isCloudRespSuccess(gasResp) && Array.isArray(gasResp.data)) {
      if (rawList === null || gasResp.data.length > 0) {
        rawList = gasResp.data;
      }
    }
  }

  // Network/API error on both endpoints
  if (rawList === null) return null;

  const agendas: ScheduleAgenda[] = [];
  for (const item of rawList) {
    if (!item || !item.id) continue;
    const itemId = String(item.id);
    const itemUpdatedAtMs = parseUpdatedAtMs(item);
    const cloudDeletedAtMs = cloudTombstones.get(itemId);

    // Tombstone check: if item was re-uploaded AFTER tombstone (updatedAtMs > deletedAtMs + 2s), keep it!
    if (cloudDeletedAtMs !== undefined) {
      if (itemUpdatedAtMs <= cloudDeletedAtMs + 2000) {
        markAgendaDeletedLocally(itemId);
        continue;
      }
    }

    if (localDeletedIds.has(itemId) && (cloudDeletedAtMs === undefined || itemUpdatedAtMs <= cloudDeletedAtMs + 2000)) {
      continue;
    }

    const normalized = normalizeCloudScheduleToAgenda(item);
    if (normalized) {
      agendas.push(normalized);
    }
  }

  return agendas;
}

/**
 * Fetch users collection from Cloudflare D1 (or fallback to GAS Vault)
 */
export async function fetchUsersFromCloud(): Promise<User[] | null> {
  const d1Resp = await postCloudEndpoint(
    CLOUDFLARE_D1_API_URL,
    { action: 'db_get_collection', collection: 'users' },
    { timeoutMs: 12_000 }
  );

  let rawUsers: any[] | null =
    isCloudRespSuccess(d1Resp) && Array.isArray(d1Resp.data) ? d1Resp.data : null;

  if (!rawUsers || rawUsers.length === 0) {
    const gasResp = await postCloudEndpoint(
      GAS_VAULT_API_URL,
      { action: 'db_get_collection', collection: 'users' },
      { timeoutMs: 18_000 }
    );
    if (isCloudRespSuccess(gasResp) && Array.isArray(gasResp.data)) {
      rawUsers = gasResp.data;
    }
  }

  if (rawUsers === null) return null;

  return rawUsers
    .filter((u) => u && u.name && String(u.name).trim().length > 0)
    .map((u) => ({
      id: u.id ? String(u.id) : undefined,
      name: String(u.name).trim(),
      email: String(u.email || ''),
      avatar: u.avatar ? String(u.avatar) : undefined,
      role: u.role ? String(u.role) : undefined,
      password: u.password ? String(u.password) : undefined,
      nik: u.nik ? String(u.nik) : undefined,
      isAdmin: Boolean(u.isAdmin),
      isExecutiveViewer: Boolean(u.isExecutiveViewer),
      accessLevel: u.accessLevel,
    }));
}

async function cleanGasTombstonesForIds(idsToRestore: Set<string>, replaceAll = false): Promise<void> {
  try {
    if (replaceAll) {
      await postCloudEndpoint(
        GAS_VAULT_API_URL,
        {
          action: 'db_save_collection',
          collection: 'deleted_schedules',
          data: [],
        },
        { timeoutMs: 15_000 }
      );
      return;
    }

    if (idsToRestore.size === 0) return;
    const getRes = await postCloudEndpoint(
      GAS_VAULT_API_URL,
      {
        action: 'db_get_collection',
        collection: 'deleted_schedules',
      },
      { timeoutMs: 12_000 }
    );
    if (!isCloudRespSuccess(getRes) || !Array.isArray(getRes.data) || getRes.data.length === 0) {
      return;
    }

    const filtered = getRes.data.filter(
      (t: any) => !idsToRestore.has(String(t?.id || t || '').trim())
    );
    if (filtered.length !== getRes.data.length) {
      await postCloudEndpoint(
        GAS_VAULT_API_URL,
        {
          action: 'db_save_collection',
          collection: 'deleted_schedules',
          data: filtered,
        },
        { timeoutMs: 15_000 }
      );
    }
  } catch (err) {
    console.warn('cleanGasTombstonesForIds warning:', err);
  }
}

/**
 * Push an entire collection of ScheduleAgendas (and optional Users) to both Cloudflare D1 and GAS Vault.
 * Uses chunked fallback + write-protection lock + offline retry queue so large Excel imports never fail silently.
 */
export async function pushAllSchedulesToCloud(
  agendas: ScheduleAgenda[],
  users?: User[],
  options: PushSchedulesOptions = {}
): Promise<CloudSyncResult> {
  isBulkWriteInFlight = true;
  markScheduleWriteProtection(60_000);

  // Persist locally to offline queue immediately in case tab closes or network fails mid-upload
  savePendingSchedulesQueue({
    agendas,
    users,
    savedAtMs: Date.now(),
    d1Pending: true,
    gasPending: true,
  });

  try {
    const clearTombstones = options.clearDeletedTombstones !== false;
    const importedIds = new Set(agendas.map((a) => String(a.id)));

    if (clearTombstones) {
      if (options.replaceAll) {
        clearDeletedAgendaIds();
      } else {
        unmarkAgendasDeletedLocally(importedIds);
      }
    }

    const enriched = agendas.map(enrichAgendaForCloud);

    const cleanUsers =
      users && users.length > 0
        ? users
            .filter((u) => u && u.name && String(u.name).trim().length > 0)
            .map((u) => ({
              ...u,
              id:
                u.id ||
                `usr-${u.name
                  .toLowerCase()
                  .replace(/[^a-z0-9]/g, '-')
                  .replace(/-+/g, '-')}`,
              username: u.email?.split('@')[0] || u.name.toLowerCase().replace(/\s+/g, '.'),
              nik: u.nik || u.password || '0000',
            }))
        : null;

    // Fast primary path: push schedules & users directly to Cloudflare D1 (~0.5-1.5s via db_save_collection)
    const d1SchedulesPromise = pushCollectionWithFallback(
      CLOUDFLARE_D1_API_URL,
      'schedules',
      enriched,
      {
        singleItemAction: 'db_save_item',
        singleItemKey: 'item',
        deleteItemAction: 'db_delete_item',
        deleteIdKey: 'id',
        concurrency: 12,
        maxDirectCollectionBytes: 2_500_000,
        timeoutMs: 20_000,
      }
    );

    const d1UsersPromise = cleanUsers
      ? pushCollectionWithFallback(CLOUDFLARE_D1_API_URL, 'users', cleanUsers, {
          singleItemAction: 'db_save_item',
          singleItemKey: 'item',
          concurrency: 10,
          maxDirectCollectionBytes: 2_500_000,
          timeoutMs: 15_000,
        })
      : Promise.resolve(true);

    // Run GAS Vault backup sequentially in one promise to avoid GAS LockService contention
    isGasBackupInFlight = true;
    const gasBackupPromise = (async (): Promise<boolean> => {
      try {
        if (clearTombstones) {
          cachedTombstonesMap = new Map();
          lastTombstoneFetchMs = 0;
          await cleanGasTombstonesForIds(importedIds, Boolean(options.replaceAll));
        }
        const gasSchedOk = await pushCollectionWithFallback(
          GAS_VAULT_API_URL,
          'schedules',
          enriched,
          {
            singleItemAction: 'db_save_schedule',
            singleItemKey: 'schedule',
            deleteItemAction: 'db_delete_schedule',
            deleteIdKey: 'scheduleId',
            concurrency: 4,
            maxDirectCollectionBytes: 2_500_000,
            timeoutMs: 25_000,
          }
        );
        if (cleanUsers) {
          await pushCollectionWithFallback(GAS_VAULT_API_URL, 'users', cleanUsers, {
            singleItemAction: 'db_save_item',
            singleItemKey: 'item',
            concurrency: 4,
            maxDirectCollectionBytes: 2_500_000,
            timeoutMs: 20_000,
          });
        }
        return gasSchedOk;
      } catch (err) {
        console.warn('GAS schedules backup warning:', err);
        return false;
      } finally {
        isGasBackupInFlight = false;
      }
    })();

    // Wait for Primary Cloudflare D1 first (instant ~1s)
    const [d1SchedulesOk] = await Promise.all([d1SchedulesPromise, d1UsersPromise]);

    let gasSchedulesOk = false;
    if (d1SchedulesOk) {
      // D1 already succeeded! Give GAS backup a brief grace window, then return to UI immediately
      // while letting GAS finish gracefully in the background.
      const settled = await Promise.race([
        gasBackupPromise.then((res) => ({ done: true as const, res })),
        new Promise<{ done: false; res: boolean }>((resolve) =>
          setTimeout(() => resolve({ done: false, res: false }), GAS_BACKGROUND_GRACE_MS)
        ),
      ]);
      if (settled.done) {
        gasSchedulesOk = settled.res;
      } else {
        // Attach background completion handler to clear pending queue once GAS finishes
        gasBackupPromise.then((bgGasOk) => {
          if (bgGasOk) {
            const curPending = getPendingSchedulesQueue();
            if (curPending && !curPending.d1Pending) {
              clearPendingSchedulesQueue();
            }
          }
        });
      }
    } else {
      // D1 failed: await GAS Vault fallback completely
      gasSchedulesOk = await gasBackupPromise;
    }

    const ok = d1SchedulesOk || gasSchedulesOk;

    if (d1SchedulesOk && gasSchedulesOk) {
      clearPendingSchedulesQueue();
      // Keep a short 5s grace window so eventual consistency doesn't revert immediately
      inMemoryWriteProtectUntilMs = Date.now() + 5_000;
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(SCHEDULE_WRITE_LOCK_KEY, String(inMemoryWriteProtectUntilMs));
        } catch {}
      }
    } else if (ok) {
      // D1 or GAS succeeded; keep queue only for whichever target is still pending
      savePendingSchedulesQueue({
        agendas,
        users,
        savedAtMs: Date.now(),
        d1Pending: !d1SchedulesOk,
        gasPending: !gasSchedulesOk,
      });
      inMemoryWriteProtectUntilMs = Date.now() + 12_000;
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(SCHEDULE_WRITE_LOCK_KEY, String(inMemoryWriteProtectUntilMs));
        } catch {}
      }
    } else {
      // Both failed: keep pending queue so 5s poll doesn't wipe local agendas & retries automatically
      savePendingSchedulesQueue({
        agendas,
        users,
        savedAtMs: Date.now(),
        d1Pending: true,
        gasPending: true,
      });
    }

    broadcastLocalSync({
      type: 'SCHEDULES_UPDATED',
      count: agendas.length,
      d1Synced: d1SchedulesOk,
      gasSynced: gasSchedulesOk,
    });

    return {
      ok,
      d1Synced: d1SchedulesOk,
      gasSynced: gasSchedulesOk,
      syncedCount: ok ? agendas.length : 0,
      queuedOffline: !d1SchedulesOk && !gasSchedulesOk,
      error: ok ? undefined : 'Gagal terhubung ke Cloudflare D1 dan GAS Vault. Jadwal disimpan lokal untuk sinkronisasi otomatis.',
    };
  } catch (err: any) {
    savePendingSchedulesQueue({
      agendas,
      users,
      savedAtMs: Date.now(),
      d1Pending: true,
      gasPending: true,
    });
    return {
      ok: false,
      d1Synced: false,
      gasSynced: false,
      syncedCount: 0,
      queuedOffline: true,
      error: err?.message || 'Gagal menyinkronkan jadwal ke cloud.',
    };
  } finally {
    isBulkWriteInFlight = false;
  }
}

/**
 * Push a single added or updated ScheduleAgenda to Cloudflare D1 and GAS Vault
 */
export async function pushSingleAgendaToCloud(agenda: ScheduleAgenda): Promise<CloudSyncResult> {
  markScheduleWriteProtection(10_000);
  unmarkAgendasDeletedLocally([String(agenda.id)]);
  const enriched = enrichAgendaForCloud(agenda);
  broadcastLocalSync({ type: 'SCHEDULE_SAVED', agenda });

  const [d1Resp, gasResp] = await Promise.all([
    postCloudEndpoint(
      CLOUDFLARE_D1_API_URL,
      {
        action: 'db_save_item',
        collection: 'schedules',
        item: enriched,
      },
      { keepalive: true, timeoutMs: 15_000, retries: 1 }
    ),
    postCloudEndpoint(
      GAS_VAULT_API_URL,
      {
        action: 'db_save_schedule',
        schedule: enriched,
      },
      { keepalive: true, timeoutMs: 20_000, retries: 1 }
    ),
  ]);

  const d1Synced = isCloudRespSuccess(d1Resp);
  const gasSynced = isCloudRespSuccess(gasResp);

  return {
    ok: d1Synced || gasSynced,
    d1Synced,
    gasSynced,
    syncedCount: d1Synced || gasSynced ? 1 : 0,
  };
}

/**
 * Delete a single ScheduleAgenda from Cloudflare D1, GAS Vault, and register in cloud tombstones.
 */
export async function deleteAgendaFromCloud(agendaId: string): Promise<void> {
  const cleanId = String(agendaId);
  markScheduleWriteProtection(8_000);
  markAgendaDeletedLocally(cleanId);
  broadcastLocalSync({ type: 'SCHEDULE_DELETED', agendaId: cleanId });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fmcu:schedule:deleted', { detail: { agendaId: cleanId } }));
  }

  // 1. Delete from Cloudflare D1
  const d1Promise = postCloudEndpoint(
    CLOUDFLARE_D1_API_URL,
    {
      action: 'db_delete_item',
      collection: 'schedules',
      id: cleanId,
    },
    { keepalive: true, timeoutMs: 12_000 }
  );

  // 2. Delete from GAS Vault
  const gasSchedulePromise = postCloudEndpoint(
    GAS_VAULT_API_URL,
    {
      action: 'db_delete_schedule',
      scheduleId: cleanId,
    },
    { keepalive: true, timeoutMs: 15_000 }
  );

  // 3. Save tombstone to GAS Vault 'deleted_schedules' so all devices/roles pick it up
  const tombstonePromise = (async () => {
    try {
      let existingTombstones: any[] = [];
      const getRes = await postCloudEndpoint(
        GAS_VAULT_API_URL,
        {
          action: 'db_get_collection',
          collection: 'deleted_schedules',
        },
        { timeoutMs: 12_000 }
      );
      if (isCloudRespSuccess(getRes) && Array.isArray(getRes.data)) {
        existingTombstones = getRes.data;
      }
      const updated = [
        ...existingTombstones.filter((t: any) => String(t?.id || t) !== cleanId),
        { id: cleanId, deletedAtMs: Date.now() },
      ].slice(-500);

      await postCloudEndpoint(
        GAS_VAULT_API_URL,
        {
          action: 'db_save_collection',
          collection: 'deleted_schedules',
          data: updated,
        },
        { keepalive: true, timeoutMs: 15_000 }
      );
    } catch (e) {
      console.warn('Save deleted_schedules tombstone error:', e);
    }
  })();

  await Promise.allSettled([d1Promise, gasSchedulePromise, tombstonePromise]);
}

// ============================================================================
// MASTER TOKO CLOUD SYNC (Cloudflare D1 + GAS Vault with Chunking & Retry)
// ============================================================================
function normalizeCloudStoreRecord(s: any): MasterStore | null {
  if (!s || !s.code || !s.name) return null;
  const lat = Number(s.lat ?? s.latitude ?? 0);
  const lng = Number(s.lng ?? s.longitude ?? 0);
  const cleanLat = Number.isFinite(lat) ? lat : 0;
  const cleanLng = Number.isFinite(lng) ? lng : 0;

  return {
    code: String(s.code).trim().toUpperCase(),
    name: String(s.name).trim(),
    type: String(s.type || 'CVS').trim() || 'CVS',
    city: String(s.city || '').trim(),
    ...(s.region ? { region: String(s.region).trim() } : {}),
    address: String(s.address || '').trim(),
    lat: cleanLat,
    lng: cleanLng,
    latitude: cleanLat,
    longitude: cleanLng,
    email: String(s.email || '').trim(),
    storePhone: String(s.storePhone || '').trim(),
    storeHead: String(s.storeHead || '').trim(),
    areaManager: String(s.areaManager || '').trim(),
    areaManagerEmail: String(s.areaManagerEmail || '').trim(),
    regionalManager: String(s.regionalManager || '').trim(),
    regionalManagerEmail: String(s.regionalManagerEmail || '').trim(),
  };
}

function extractMasterStoresFromRawCollection(
  rawData: any[],
  meta: MasterStoreMetadata | null
): MasterStore[] {
  const chunkRows = rawData.filter((it: any) => it && it._isChunk && Array.isArray(it.items));
  let extracted: MasterStore[] = [];

  if (chunkRows.length > 0) {
    const targetVersion =
      meta?.version && chunkRows.some((c: any) => Number(c.version) === Number(meta.version))
        ? Number(meta.version)
        : Math.max(...chunkRows.map((c: any) => Number(c.version || 0)));

    const activeChunks = chunkRows
      .filter((c: any) => Number(c.version || 0) === targetVersion)
      .sort((a: any, b: any) => Number(a.chunkIndex || 0) - Number(b.chunkIndex || 0));

    const seenChunkIdx = new Set<number>();
    for (const chunk of activeChunks) {
      const idx = Number(chunk.chunkIndex || 0);
      if (seenChunkIdx.has(idx)) continue;
      seenChunkIdx.add(idx);
      for (const rawStore of chunk.items) {
        const norm = normalizeCloudStoreRecord(rawStore);
        if (norm) extracted.push(norm);
      }
    }
  } else {
    for (const rawStore of rawData) {
      const norm = normalizeCloudStoreRecord(rawStore);
      if (norm) extracted.push(norm);
    }
  }

  // Deduplicate by store code
  const byCode = new Map<string, MasterStore>();
  for (const st of extracted) {
    byCode.set(st.code.toUpperCase(), st);
  }
  return Array.from(byCode.values());
}

function extractEmbeddedStoreMeta(rawData: any[]): MasterStoreMetadata | null {
  if (!Array.isArray(rawData)) return null;
  const carrier = rawData.find((it: any) => it && typeof it._metaVersion === 'number' && it._metaVersion > 0);
  if (!carrier) return null;
  const version = Number(carrier._metaVersion);
  return {
    version,
    updatedAt: String(carrier._metaUpdatedAt || new Date(version).toISOString()),
    updatedBy: String(carrier._metaUpdatedBy || 'Admin FMCU'),
    sourceFilename: carrier._metaSource ? String(carrier._metaSource) : undefined,
    totalStores: Number(carrier._metaTotal || rawData.length),
    addedCount: Number(carrier._metaAdded || 0),
    updatedCount: Number(carrier._metaUpdated || 0),
    cloudSynced: true,
  };
}

function extractMetaFromRawCollection(rawMetaData: any): MasterStoreMetadata | null {
  if (!Array.isArray(rawMetaData) || rawMetaData.length === 0) return null;
  const current =
    rawMetaData.find((m: any) => m && m.id === 'current') || rawMetaData[rawMetaData.length - 1];
  if (!current || typeof current.version !== 'number') return null;
  return {
    version: Number(current.version),
    updatedAt: String(current.updatedAt || new Date(current.version).toISOString()),
    updatedBy: String(current.updatedBy || 'Admin FMCU'),
    sourceFilename: current.sourceFilename ? String(current.sourceFilename) : undefined,
    totalStores: Number(current.totalStores || 0),
    addedCount: Number(current.addedCount || 0),
    updatedCount: Number(current.updatedCount || 0),
    cloudSynced: true,
  };
}

async function fetchMasterStoresFromD1(): Promise<{
  stores: MasterStore[];
  meta: MasterStoreMetadata | null;
} | null> {
  // Cloudflare D1 ONLY accepts 'stores' (never query 'master_stores' or 'master_stores_meta' on D1)
  const storesResp = await postCloudEndpoint(
    CLOUDFLARE_D1_API_URL,
    { action: 'db_get_collection', collection: MASTER_STORES_COLLECTION },
    { timeoutMs: 10_000, retries: 1 }
  );

  if (!isCloudRespSuccess(storesResp) || !Array.isArray(storesResp.data)) {
    return null;
  }

  const embeddedMeta = extractEmbeddedStoreMeta(storesResp.data);
  const stores = extractMasterStoresFromRawCollection(storesResp.data, embeddedMeta);
  if (stores.length === 0) return null;

  return {
    stores,
    meta: embeddedMeta
      ? { ...embeddedMeta, totalStores: embeddedMeta.totalStores || stores.length, cloudSynced: true }
      : null,
  };
}

async function fetchMasterStoresFromGas(): Promise<{
  stores: MasterStore[];
  meta: MasterStoreMetadata | null;
} | null> {
  const [metaResp, storesResp] = await Promise.all([
    postCloudEndpoint(
      GAS_VAULT_API_URL,
      { action: 'db_get_collection', collection: GAS_MASTER_STORES_META_COLLECTION },
      { timeoutMs: 18_000, retries: 1 }
    ),
    postCloudEndpoint(
      GAS_VAULT_API_URL,
      { action: 'db_get_collection', collection: MASTER_STORES_COLLECTION },
      { timeoutMs: 22_000, retries: 1 }
    ),
  ]);

  if (!isCloudRespSuccess(storesResp) || !Array.isArray(storesResp.data)) {
    return null;
  }

  const gasMeta =
    isCloudRespSuccess(metaResp) && Array.isArray(metaResp.data)
      ? extractMetaFromRawCollection(metaResp.data)
      : null;
  const embeddedMeta = extractEmbeddedStoreMeta(storesResp.data);
  const meta = gasMeta || embeddedMeta;

  const stores = extractMasterStoresFromRawCollection(storesResp.data, meta);
  if (stores.length === 0) return null;

  return {
    stores,
    meta: meta ? { ...meta, totalStores: meta.totalStores || stores.length, cloudSynced: true } : null,
  };
}

/**
 * Fetch latest Master Toko list & version metadata from Cloudflare D1 (1-call fast read; fallback to GAS Vault)
 */
export async function fetchMasterStoresFromCloud(): Promise<{
  stores: MasterStore[];
  meta: MasterStoreMetadata | null;
} | null> {
  const d1Result = await fetchMasterStoresFromD1();
  if (d1Result && d1Result.stores.length > 0) {
    return d1Result;
  }

  const gasResult = await fetchMasterStoresFromGas();
  if (gasResult && gasResult.stores.length > 0) {
    return gasResult;
  }

  return null;
}

async function pushMasterStoresBackupToGas(
  flatItems: Record<string, any>[],
  chunks: Record<string, any>[],
  metaItem: Record<string, any>
): Promise<boolean> {
  try {
    // 1. Try fast single-call collection save first (~250 KB JSON fits easily in Drive)
    const directResp = await postCloudEndpoint(
      GAS_VAULT_API_URL,
      {
        action: 'db_save_collection',
        collection: MASTER_STORES_COLLECTION,
        data: flatItems,
      },
      { timeoutMs: 25_000, retries: 1 }
    );

    let storesOk = isCloudRespSuccess(directResp);

    // 2. Fallback to bounded chunks only if direct collection save fails
    if (!storesOk) {
      const chunkResults = await runWithConcurrency(chunks, 2, async (chunkItem) => {
        const resp = await postCloudEndpoint(
          GAS_VAULT_API_URL,
          {
            action: 'db_save_item',
            collection: MASTER_STORES_COLLECTION,
            item: chunkItem,
          },
          { timeoutMs: 25_000, retries: 1 }
        );
        return isCloudRespSuccess(resp);
      });
      storesOk = chunkResults.every(Boolean);
    }

    if (!storesOk) return false;

    const metaResp = await postCloudEndpoint(
      GAS_VAULT_API_URL,
      {
        action: 'db_save_item',
        collection: GAS_MASTER_STORES_META_COLLECTION,
        item: metaItem,
      },
      { timeoutMs: 20_000, retries: 1 }
    );

    return isCloudRespSuccess(metaResp);
  } catch (err) {
    console.warn('GAS master stores backup warning:', err);
    return false;
  }
}

/**
 * Push updated Master Toko list + version metadata to Cloudflare D1 ('stores' single-batch write)
 * and GAS Vault backup (runs fast grace window + background completion after D1 succeeds).
 */
export async function pushMasterStoresToCloud(
  stores: MasterStore[],
  meta: MasterStoreMetadata,
  options: { mode?: 'merge' | 'replace' } = {}
): Promise<CloudSyncResult> {
  const cleanStores: MasterStore[] = [];
  const seen = new Set<string>();
  for (const s of stores) {
    const norm = normalizeCloudStoreRecord(s);
    if (norm && !seen.has(norm.code)) {
      seen.add(norm.code);
      cleanStores.push(norm);
    }
  }

  const version = meta.version || Date.now();
  const updatedAt = meta.updatedAt || new Date(version).toISOString();

  // Keep flat MasterStore records (compatible with D1 'stores' schema) and embed version metadata on item[0]
  const flatItems: Record<string, any>[] = cleanStores.map((st, idx) =>
    idx === 0
      ? {
          id: st.code,
          ...st,
          _metaVersion: version,
          _metaUpdatedAt: updatedAt,
          _metaUpdatedBy: meta.updatedBy || 'Admin FMCU',
          _metaSource: meta.sourceFilename || '',
          _metaTotal: cleanStores.length,
          _metaAdded: meta.addedCount ?? 0,
          _metaUpdated: meta.updatedCount ?? 0,
        }
      : {
          id: st.code,
          ...st,
        }
  );

  const chunks: Record<string, any>[] = [];
  for (let i = 0; i < cleanStores.length; i += MASTER_STORES_CHUNK_SIZE) {
    const chunkIndex = chunks.length;
    chunks.push({
      id: `chunk_v${version}_${String(chunkIndex).padStart(3, '0')}`,
      _isChunk: true,
      chunkIndex,
      totalChunks: Math.ceil(cleanStores.length / MASTER_STORES_CHUNK_SIZE),
      version,
      updatedAt,
      items: cleanStores.slice(i, i + MASTER_STORES_CHUNK_SIZE),
    });
  }

  const metaItem: Record<string, any> = {
    id: 'current',
    version,
    updatedAt,
    updatedBy: meta.updatedBy || 'Admin FMCU',
    sourceFilename: meta.sourceFilename || '',
    totalStores: cleanStores.length,
    addedCount: meta.addedCount ?? 0,
    updatedCount: meta.updatedCount ?? 0,
    chunkCount: chunks.length,
    storageFormat: 'flat_v2',
    mode: options.mode || 'merge',
  };

  // Start D1 primary sync (1 fast db_save_collection call ~1s) and GAS backup in parallel
  const d1Promise = pushCollectionWithFallback(CLOUDFLARE_D1_API_URL, MASTER_STORES_COLLECTION, flatItems, {
    singleItemAction: 'db_save_item',
    singleItemKey: 'item',
    concurrency: 12,
    maxDirectCollectionBytes: 2_500_000,
    timeoutMs: 20_000,
  });

  const gasBackupPromise = pushMasterStoresBackupToGas(flatItems, chunks, metaItem);

  const d1Synced = await d1Promise;
  let gasSynced = false;

  if (d1Synced) {
    // D1 succeeded! Give GAS a brief grace window, then return immediately so Admin UI never stalls.
    const settled = await Promise.race([
      gasBackupPromise.then((res) => ({ done: true as const, res })),
      new Promise<{ done: false; res: boolean }>((resolve) =>
        setTimeout(() => resolve({ done: false, res: false }), GAS_BACKGROUND_GRACE_MS)
      ),
    ]);
    if (settled.done) {
      gasSynced = settled.res;
    }
  } else {
    // D1 failed: await full GAS Vault fallback
    gasSynced = await gasBackupPromise;
  }

  const ok = d1Synced || gasSynced;
  const syncedMeta: MasterStoreMetadata = {
    ...meta,
    version,
    updatedAt,
    totalStores: cleanStores.length,
    cloudSynced: ok,
  };

  broadcastLocalSync({
    type: 'MASTER_STORES_UPDATED',
    meta: syncedMeta,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('fmcu:master-stores:cloud-synced', {
        detail: { meta: syncedMeta, d1Synced, gasSynced },
      })
    );
  }

  return {
    ok,
    d1Synced,
    gasSynced,
    syncedCount: ok ? cleanStores.length : 0,
    error: ok
      ? undefined
      : 'Gagal menyinkronkan Master Toko ke Cloudflare D1 dan GAS Vault. Perubahan tersimpan lokal.',
  };
}

// ============================================================================
// INSTANT SAME-DEVICE MULTI-TAB BROADCAST CHANNEL
// ============================================================================
let syncChannel: BroadcastChannel | null = null;

function getSyncChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!syncChannel) {
    try {
      syncChannel = new BroadcastChannel('fmcu_teams_realtime_sync');
    } catch {
      syncChannel = null;
    }
  }
  return syncChannel;
}

export function broadcastLocalSync(payload: Record<string, any>): void {
  const ch = getSyncChannel();
  if (ch) {
    try {
      ch.postMessage(payload);
    } catch {
      // ignore
    }
  }
}

export function subscribeToLocalSync(onUpdate: (payload?: any) => void): () => void {
  const ch = getSyncChannel();
  if (!ch) return () => {};
  const handler = (evt: MessageEvent) => onUpdate(evt.data);
  ch.addEventListener('message', handler);
  return () => ch.removeEventListener('message', handler);
}

export function subscribeMasterStoresCloudSync(
  onUpdate: (meta?: MasterStoreMetadata | null) => void
): () => void {
  return subscribeToLocalSync((payload) => {
    if (payload && payload.type === 'MASTER_STORES_UPDATED') {
      onUpdate(payload.meta || null);
    }
  });
}
