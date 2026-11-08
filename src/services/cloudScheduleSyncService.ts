import { ScheduleAgenda, ScheduleCategory, User } from '../types';
import { getBestieByStoreCode, getMasterStores } from '../data/masterStoresData';

// ============================================================================
// CROSS-DEVICE REAL-TIME CLOUD SCHEDULE & USER SYNC SERVICE
// Primary Engine : Cloudflare D1 Edge SQLite (~20ms latency, 5M reads/day)
// Backup Vault   : Google Apps Script Hidden Vault on Google Drive
// Local Instant  : BroadcastChannel + Storage Event (0ms multi-tab sync)
// ============================================================================

export const CLOUDFLARE_D1_API_URL = 'https://fmcuonegatesystem-edge-api.pages.dev/api';
export const GAS_VAULT_API_URL =
  'https://script.google.com/macros/s/AKfycbxC29L4Cb3NNvUl4IRe0MGDnrluvCvv1neuTjQieA8j7C4n7zgGfQ3dMA8SLXYBG0AWtw/exec';

const DELETED_AGENDA_IDS_KEY = 'fmcu_deleted_agenda_ids_v5';

export function getDeletedAgendaIds(): Set<string> {
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
  if (!id) return;
  try {
    const set = getDeletedAgendaIds();
    set.add(String(id));
    localStorage.setItem(DELETED_AGENDA_IDS_KEY, JSON.stringify(Array.from(set).slice(-1000)));
  } catch {
    // ignore storage errors
  }
}

export function clearDeletedAgendaIds(): void {
  try {
    localStorage.removeItem(DELETED_AGENDA_IDS_KEY);
  } catch {
    // ignore
  }
}

/**
 * Enrich ScheduleAgenda with Cloudflare D1 / GAS Vault compatibility fields
 * so both FMCU Teams and FMCU OneGate share the exact same schedule records.
 */
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
    auditorId: `usr-${auditorSlug}`,
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

/**
 * Convert any cloud schedule object (from FMCU Teams or FMCU OneGate) back into ScheduleAgenda
 */
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

async function postCloudEndpoint(url: string, payload: Record<string, any>): Promise<any> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch latest schedules from Cloudflare D1 Edge DB (or fallback to Google Apps Script Vault)
 */
export async function fetchSchedulesFromCloud(): Promise<ScheduleAgenda[] | null> {
  const deletedIds = getDeletedAgendaIds();

  // 1. Try Cloudflare D1 Edge SQLite first (~20ms)
  let resp = await postCloudEndpoint(CLOUDFLARE_D1_API_URL, {
    action: 'db_get_collection',
    collection: 'schedules',
  });

  let rawList: any[] | null =
    resp && resp.status === 'SUCCESS' && Array.isArray(resp.data) ? resp.data : null;

  // 2. Fallback to Google Apps Script Hidden Vault
  if (!rawList || rawList.length === 0) {
    resp = await postCloudEndpoint(GAS_VAULT_API_URL, {
      action: 'db_get_collection',
      collection: 'schedules',
    });
    if (resp && resp.status === 'SUCCESS' && Array.isArray(resp.data)) {
      rawList = resp.data;
    }
  }

  if (!rawList || rawList.length === 0) return null;

  const agendas: ScheduleAgenda[] = [];
  for (const item of rawList) {
    if (!item || !item.id) continue;
    if (deletedIds.has(String(item.id))) continue;
    const normalized = normalizeCloudScheduleToAgenda(item);
    if (normalized) {
      agendas.push(normalized);
    }
  }

  return agendas.length > 0 ? agendas : null;
}

/**
 * Push an entire collection of ScheduleAgendas to both Cloudflare D1 and GAS Vault
 * Used when Admin uploads an Excel schedule or syncs the master schedule.
 */
export async function pushAllSchedulesToCloud(
  agendas: ScheduleAgenda[],
  users?: User[]
): Promise<boolean> {
  clearDeletedAgendaIds();
  const enriched = agendas.map(enrichAgendaForCloud);

  const tasks: Promise<any>[] = [
    postCloudEndpoint(CLOUDFLARE_D1_API_URL, {
      action: 'db_save_collection',
      collection: 'schedules',
      data: enriched,
    }),
    postCloudEndpoint(GAS_VAULT_API_URL, {
      action: 'db_save_collection',
      collection: 'schedules',
      data: enriched,
    }),
  ];

  if (users && users.length > 0) {
    const cleanUsers = users.map((u) => ({
      ...u,
      username: u.email?.split('@')[0] || u.name.toLowerCase().replace(/\s+/g, '.'),
      nik: u.password || '0000',
    }));
    tasks.push(
      postCloudEndpoint(CLOUDFLARE_D1_API_URL, {
        action: 'db_save_collection',
        collection: 'users',
        data: cleanUsers,
      })
    );
  }

  const results = await Promise.all(tasks);
  broadcastLocalSync({ type: 'SCHEDULES_UPDATED', count: agendas.length });
  return results.some((r) => r && r.status === 'SUCCESS');
}

/**
 * Push a single added or updated ScheduleAgenda to Cloudflare D1 and GAS Vault
 */
export async function pushSingleAgendaToCloud(agenda: ScheduleAgenda): Promise<void> {
  const enriched = enrichAgendaForCloud(agenda);
  broadcastLocalSync({ type: 'SCHEDULE_SAVED', agenda });
  await Promise.all([
    postCloudEndpoint(CLOUDFLARE_D1_API_URL, {
      action: 'db_save_item',
      collection: 'schedules',
      item: enriched,
    }),
    postCloudEndpoint(GAS_VAULT_API_URL, {
      action: 'db_save_schedule',
      schedule: enriched,
    }),
  ]);
}

/**
 * Delete a single ScheduleAgenda from Cloudflare D1 and GAS Vault
 */
export async function deleteAgendaFromCloud(agendaId: string): Promise<void> {
  markAgendaDeletedLocally(agendaId);
  broadcastLocalSync({ type: 'SCHEDULE_DELETED', agendaId });
  await Promise.all([
    postCloudEndpoint(CLOUDFLARE_D1_API_URL, {
      action: 'db_delete_item',
      collection: 'schedules',
      id: String(agendaId),
    }),
    postCloudEndpoint(GAS_VAULT_API_URL, {
      action: 'db_delete_schedule',
      scheduleId: String(agendaId),
    }),
  ]);
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

export function subscribeToLocalSync(onUpdate: () => void): () => void {
  const ch = getSyncChannel();
  if (!ch) return () => {};
  const handler = () => onUpdate();
  ch.addEventListener('message', handler);
  return () => ch.removeEventListener('message', handler);
}
