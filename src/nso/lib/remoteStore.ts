import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, listAll, ref, uploadBytes } from 'firebase/storage';
import { firebaseDb, firebaseStorage, firebaseDiagnostics } from './firebaseClient';
import { saveReport, upsertHistory } from './localStore';
import { CrewMember, DEFAULT_STORE_PIN, ReportData, TimerRecord } from './types';
import { normalizeStoreName, uid } from './normalize';
import { makeCrew, syncCrewDependentRows } from './reportDefaults';

// Compatibility exports: existing pages still import `convex` / `remoteDb`.
// They now mean "Firebase Firestore is configured".
export const convex = firebaseDb;
export const remoteDb = firebaseDb;

const STORES_COLLECTION = 'stores';

type StoreRow = {
  id: string;
  storeName: string;
  storeKey: string;
  audienceToken: string;
  accessCode?: string;
  updatedAt: string;
  reportData?: ReportData;
};

function nowIso() {
  return new Date().toISOString();
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function safeId(value: unknown) {
  return text(value).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'item';
}

function normalizedPin(value?: string) {
  return String(value ?? '').replace(/\D/g, '') || DEFAULT_STORE_PIN;
}

function normalizeReport(report: ReportData): ReportData {
  return syncCrewDependentRows({ ...report, accessCode: normalizedPin(report.accessCode) });
}

function storeDocRef(id: string) {
  if (!firebaseDb) throw new Error('Firebase Firestore belum dikonfigurasi.');
  return doc(firebaseDb, STORES_COLLECTION, id);
}

function storesCollectionRef() {
  if (!firebaseDb) throw new Error('Firebase Firestore belum dikonfigurasi.');
  return collection(firebaseDb, STORES_COLLECTION);
}

function rowToHistory(row: StoreRow) {
  return {
    id: row.id,
    storeName: row.storeName,
    storeKey: row.storeKey,
    audienceToken: row.audienceToken,
    accessCode: normalizedPin(row.accessCode),
    updatedAt: row.updatedAt
  };
}

function docToRow(id: string, data: DocumentData | undefined): StoreRow | null {
  if (!data) return null;
  const reportData = data.reportData as ReportData | undefined;
  const storeId = text(data.storeId || data.id || reportData?.id || id);
  const storeName = text(data.storeName || reportData?.storeName);
  const storeKey = text(data.storeKey || reportData?.storeKey || reportData?.general?.storeCode || storeName);
  const audienceToken = text(data.audienceToken || reportData?.audienceToken);
  const updatedAt = text(data.updatedAt || reportData?.updatedAt) || nowIso();
  if (!storeId || !storeName || !audienceToken) return null;
  return {
    id: storeId,
    storeName,
    storeKey: storeKey || normalizeStoreName(storeName),
    audienceToken,
    accessCode: normalizedPin(data.accessCode || reportData?.accessCode),
    updatedAt,
    reportData: reportData ? normalizeReport({ ...reportData, id: storeId, storeName, storeKey: storeKey || reportData.storeKey, audienceToken, updatedAt }) : undefined
  };
}

function rowToReport(row: StoreRow): ReportData | null {
  if (!row.reportData) return null;
  return normalizeReport({
    ...row.reportData,
    id: row.id,
    storeName: row.storeName,
    storeKey: row.storeKey,
    audienceToken: row.audienceToken,
    accessCode: normalizedPin(row.accessCode || row.reportData.accessCode),
    updatedAt: row.updatedAt || row.reportData.updatedAt || nowIso()
  });
}

function sameCrew(a: CrewMember, b: CrewMember) {
  const nikA = (a.nik || '').trim();
  const nikB = (b.nik || '').trim();
  if (nikA && nikB) return nikA === nikB;
  return a.id === b.id;
}

function mergeRemoteAudienceData(localReport: ReportData, remoteReport: ReportData | null): ReportData {
  if (!remoteReport) return localReport;
  const local = syncCrewDependentRows(localReport);
  const remote = syncCrewDependentRows(remoteReport);

  const crews = local.crews;
  const deletedSet = new Set(local.deletedCrewIds ?? []);
  const remoteAudienceCrews = remote.crews.filter(
    (remoteCrew) => remoteCrew.createdSource === 'audience' && !crews.some((crew) => sameCrew(crew, remoteCrew)) && !deletedSet.has(remoteCrew.id)
  );

  const remoteTimers = remote.timers ?? [];
  const timerIds = new Set((local.timers ?? []).map((timer) => timer.id));
  const timers = [
    ...(local.timers ?? []),
    ...remoteTimers.filter((timer) => !timerIds.has(timer.id))
  ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const speedGroups = local.speedGroups.map((group) => {
    const remoteGroup = remote.speedGroups.find((item) => item.id === group.id);
    if (!remoteGroup) return group;
    const mergedTrx = group.transactions.map((trx) => {
      const remoteTrx = remoteGroup.transactions.find((item) => item.id === trx.id);
      if (!remoteTrx) return trx;
      return {
        ...trx,
        actualTime: typeof trx.actualTime === 'string' ? trx.actualTime : (remoteTrx.actualTime || ''),
        keterangan: typeof trx.keterangan === 'string' ? trx.keterangan : (remoteTrx.keterangan || ''),
        gapFinding: typeof trx.gapFinding === 'string' ? trx.gapFinding : (remoteTrx.gapFinding || ''),
        correction: typeof trx.correction === 'string' ? trx.correction : (remoteTrx.correction || ''),
        capturedAt: trx.capturedAt || remoteTrx.capturedAt,
        capturedByDeviceId: trx.capturedByDeviceId || remoteTrx.capturedByDeviceId,
        lockedByDeviceId: trx.lockedByDeviceId || remoteTrx.lockedByDeviceId,
        lockedAt: trx.lockedAt || remoteTrx.lockedAt,
        noteUpdatedAt: trx.noteUpdatedAt || remoteTrx.noteUpdatedAt
      };
    });

    const localTrxIds = new Set(group.transactions.map((t) => t.id));
    const missingRemoteTrx = remoteGroup.transactions.filter((t) => !localTrxIds.has(t.id));

    return {
      ...group,
      transactions: [...mergedTrx, ...missingRemoteTrx]
    };
  });

  const localGroupIds = new Set(speedGroups.map((g) => g.id));
  const missingRemoteGroups = remote.speedGroups.filter((g) => !localGroupIds.has(g.id));
  const mergedSpeedGroups = [...speedGroups, ...missingRemoteGroups].sort((a, b) => a.title.localeCompare(b.title));

  return syncCrewDependentRows({
    ...local,
    crews: [...crews, ...remoteAudienceCrews],
    timers,
    speedGroups: mergedSpeedGroups,
    timerSessionActive: local.timerSessionActive ?? remote.timerSessionActive,
    updatedAt: nowIso()
  });
}

async function getRemoteReportById(id: string): Promise<ReportData | null> {
  if (!firebaseDb) return null;
  const snap = await getDoc(storeDocRef(id));
  const row = docToRow(snap.id, snap.data());
  return row ? rowToReport(row) : null;
}

async function getRemoteReportByToken(token: string): Promise<{ id: string; report: ReportData } | null> {
  if (!firebaseDb) return null;
  const snap = await getDocs(query(storesCollectionRef(), where('audienceToken', '==', token), limit(1)));
  const first = snap.docs[0];
  if (!first) return null;
  const row = docToRow(first.id, first.data());
  const report = row ? rowToReport(row) : null;
  return row && report ? { id: row.id, report } : null;
}

/** Membersihkan foto Base64 lama agar tidak menyebabkan error 1MB di Firestore */
function stripBase64Photos(report: ReportData): ReportData {
  function clean(arr: string[] | undefined): string[] {
    return (arr ?? []).filter((url) => typeof url === 'string' && url.startsWith('http'));
  }
  return {
    ...report,
    general: {
      ...report.general,
      coverPhotoUrl: typeof report.general.coverPhotoUrl === 'string' && report.general.coverPhotoUrl.startsWith('http') ? report.general.coverPhotoUrl : '',
    },
    documentationPhotos: clean(report.documentationPhotos),
    layoutCounterPhotos: clean(report.layoutCounterPhotos),
    planogramPhotos: clean(report.planogramPhotos),
    crews: (report.crews ?? []).map((crew) => ({
      ...crew,
      photoUrl: typeof crew.photoUrl === 'string' && crew.photoUrl.startsWith('http') ? crew.photoUrl : '',
      groomingPhotoUrl: typeof crew.groomingPhotoUrl === 'string' && crew.groomingPhotoUrl.startsWith('http') ? crew.groomingPhotoUrl : '',
    })),
  };
}

async function writeRemoteReport(id: string, report: ReportData) {
  if (!firebaseDb) return;
  const synced = normalizeReport({ ...report, id, accessCode: normalizedPin(report.accessCode), updatedAt: nowIso() });
  const cleanedForFirestore = stripBase64Photos(synced);
  
  await setDoc(storeDocRef(id), {
    storeId: cleanedForFirestore.id,
    id: cleanedForFirestore.id,
    storeName: cleanedForFirestore.storeName,
    storeKey: cleanedForFirestore.storeKey || normalizeStoreName(cleanedForFirestore.storeName),
    audienceToken: cleanedForFirestore.audienceToken,
    accessCode: normalizedPin(cleanedForFirestore.accessCode),
    updatedAt: cleanedForFirestore.updatedAt,
    reportData: cleanedForFirestore
  }, { merge: true });
}

async function updateRemoteReport(id: string, report: ReportData) {
  await writeRemoteReport(id, report);
}

export async function testFirebaseConnection() {
  if (!firebaseDb) {
    return {
      ok: false,
      message: firebaseDiagnostics.missingEnv.length
        ? `Firebase belum aktif. Env yang belum terbaca di build: ${firebaseDiagnostics.missingEnv.join(', ')}`
        : 'Firebase belum aktif. Cek value environment variables dan redeploy production.',
      diagnostics: firebaseDiagnostics
    };
  }

  try {
    const testRef = doc(firebaseDb, STORES_COLLECTION, 'firebase_connection_test_doc');
    await setDoc(testRef, {
      diagnostic: true,
      updatedAt: nowIso(),
      source: 'NSO Firebase connection test'
    }, { merge: true });
    try { await deleteDoc(testRef); } catch { /* ignore delete test cleanup failure */ }
    return {
      ok: true,
      message: `Firebase Firestore OK${firebaseDiagnostics.projectId ? ` (${firebaseDiagnostics.projectId})` : ''}.`,
      diagnostics: firebaseDiagnostics
    };
  } catch (error) {
    const anyError = error as { code?: string; message?: string };
    return {
      ok: false,
      message: `${anyError.code ? `${anyError.code}: ` : ''}${anyError.message || 'Firebase test gagal.'}`,
      diagnostics: firebaseDiagnostics
    };
  }
}

export async function listRemoteReports() {
  if (!firebaseDb) return [];
  const queryRef = storesCollectionRef();
  
  // Timeout to prevent infinite hanging if Firebase connection fails silently
  const snap = await Promise.race([
    getDocs(queryRef),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Firebase connection timeout')), 8000))
  ]);

  return snap.docs
    .map((item) => docToRow(item.id, item.data()))
    .filter((row): row is StoreRow => Boolean(row))
    .map(rowToHistory)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function loadRemoteReport(id: string): Promise<ReportData | null> {
  return await getRemoteReportById(id);
}

export async function upsertRemoteReport(report: ReportData) {
  const now = nowIso();
  const localSynced = normalizeReport({ ...report, updatedAt: now });
  // Always save locally first — safety net if Firebase fails
  saveReport(localSynced);
  upsertHistory(localSynced);
  if (!firebaseDb) return;
  await writeRemoteReport(report.id, localSynced);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


function cleanFileName(file: File) {
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  return `${Date.now()}_${uid('media')}.${String(extension || 'jpg').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'jpg'}`;
}

// URL Web App Google Apps Script untuk Google Drive photo upload NSO
export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw34WJkdZvFbz09TYdcp5Exz5prQHkCoTEjOUYk98IyACXSoF_F4LwtcPVMhZk2Nr85_g/exec';

export function pingUploadServer() {
  if (GOOGLE_SCRIPT_URL) {
    fetch(GOOGLE_SCRIPT_URL, { mode: 'no-cors' }).catch(() => {});
  }
}

export async function uploadMedia(file: File, storeId: string): Promise<string> {
  if (GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL.startsWith('https://script.google.com')) {
    try {
      const base64Url = await fileToDataUrl(file);
      const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
      const filename = `${Date.now()}_${uid('media')}.${String(extension || 'jpg').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'jpg'}`;

      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          filename: `${storeId}_${filename}`,
          mimeType: file.type || 'image/jpeg',
          base64: base64Url
        })
      });

      if (!response.ok) {
        throw new Error(`Google Apps Script mengembalikan HTTP status ${response.status} (${response.statusText}).`);
      }

      const result = await response.json();

      const photoUrl = result.url || result.directUrl || result.fileUrl || (result.fileId ? `https://lh3.googleusercontent.com/d/${result.fileId}` : '');
      if ((result.success || result.status === 'success' || result.status === 'ONLINE') && photoUrl) {
        return photoUrl;
      }

      throw new Error(result.error || result.message || 'Script Google Drive tidak mengembalikan URL foto.');
    } catch (error) {
      console.error('Gagal upload ke Google Drive:', error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
        throw new Error('Gagal menghubungi Google Apps Script. Pastikan koneksi internet aktif.');
      }
      throw new Error(msg);
    }
  }

  throw new Error('Sistem penyimpanan Google Drive belum dikonfigurasi.');
}

export async function getPublicStoreByToken(token: string): Promise<ReportData | null> {
  const row = await getRemoteReportByToken(token);
  return row?.report ?? null;
}

export async function submitAudienceProfile(token: string, payload: Record<string, unknown>) {
  if (!firebaseDb) return;
  const row = await getRemoteReportByToken(token);
  if (!row) throw new Error('Store tidak ditemukan.');
  const report = normalizeReport(row.report);
  const nik = String(payload.nik ?? '').trim();
  const name = String(payload.name ?? '').trim().toUpperCase();
  const groomingPhotoUrl = String(payload.groomingPhotoUrl ?? '');
  const existingIndex = report.crews.findIndex((crew) => (nik && crew.nik === nik) || crew.name === name);
  const nextCrew = existingIndex >= 0
    ? {
        ...report.crews[existingIndex],
        name,
        nik,
        level: String(payload.level ?? report.crews[existingIndex].level) as any,
        photoUrl: report.crews[existingIndex].photoUrl || groomingPhotoUrl,
        groomingPhotoUrl: groomingPhotoUrl || report.crews[existingIndex].groomingPhotoUrl,
        createdSource: 'audience' as const
      }
    : makeCrew({
        id: `crew_${safeId(nik || name)}`,
        name,
        nik,
        level: String(payload.level ?? 'MG1') as any,
        photoUrl: groomingPhotoUrl,
        groomingPhotoUrl,
        createdSource: 'audience'
      });
  const crews = existingIndex >= 0
    ? report.crews.map((crew, index) => index === existingIndex ? nextCrew : crew)
    : [...report.crews, nextCrew];
  await updateRemoteReport(row.id, syncCrewDependentRows({ ...report, crews, updatedAt: nowIso() }));
}

function getGroups(reportData: ReportData) {
  return Array.isArray(reportData?.speedGroups) ? reportData.speedGroups : [];
}

function groupById(reportData: ReportData, groupId: string) {
  return getGroups(reportData).find((group) => group?.id === groupId);
}

function transactionById(group: any, transactionId: string) {
  return (Array.isArray(group?.transactions) ? group.transactions : []).find((trx: any) => trx?.id === transactionId);
}

function updateGroupTransaction(reportData: ReportData, groupId: string, transactionId: string, updater: (trx: any, group: any) => any): ReportData {
  const speedGroups = getGroups(reportData).map((group) => {
    if (group?.id !== groupId) return group;
    return {
      ...group,
      transactions: (Array.isArray(group.transactions) ? group.transactions : []).map((trx: any) => {
        if (trx?.id !== transactionId) return trx;
        return updater(trx, group);
      })
    };
  });
  return syncCrewDependentRows({ ...reportData, speedGroups, updatedAt: nowIso() });
}

export async function claimAudienceTransaction(token: string, payload: { groupId: string; transactionId: string; deviceId: string }) {
  if (!firebaseDb) return;
  const row = await getRemoteReportByToken(token);
  if (!row) throw new Error('Link timer tidak valid.');
  const reportData = row.report;
  const groupId = text(payload.groupId);
  const transactionId = text(payload.transactionId);
  const deviceId = text(payload.deviceId);
  if (!groupId || !transactionId || !deviceId) throw new Error('Payload transaksi tidak lengkap.');
  const group = groupById(reportData, groupId);
  if (!group?.timerEnabled) throw new Error('Simulasi belum dimulai oleh fasilitator.');
  const trx = transactionById(group, transactionId);
  if (!trx) throw new Error('Transaksi tidak ditemukan.');
  if (trx.actualTime) throw new Error('Transaksi ini sudah terekam.');
  if (trx.lockedByDeviceId && trx.lockedByDeviceId !== deviceId) throw new Error('Transaksi sudah dipilih customer lain.');
  const nextData = updateGroupTransaction(reportData, groupId, transactionId, (current) => ({
    ...current,
    lockedByDeviceId: deviceId,
    lockedAt: current.lockedAt || nowIso()
  }));
  await updateRemoteReport(row.id, nextData);
}

export async function submitAudienceTransactionNote(token: string, payload: { groupId: string; transactionId: string; deviceId: string; keterangan: string }) {
  if (!firebaseDb) return;
  const row = await getRemoteReportByToken(token);
  if (!row) throw new Error('Link timer tidak valid.');
  const reportData = row.report;
  const groupId = text(payload.groupId);
  const transactionId = text(payload.transactionId);
  const deviceId = text(payload.deviceId);
  const note = text(payload.keterangan) || '-';
  const group = groupById(reportData, groupId);
  if (!group?.timerEnabled) throw new Error('Simulasi belum dimulai oleh fasilitator.');
  const trx = transactionById(group, transactionId);
  if (!trx) throw new Error('Transaksi tidak ditemukan.');
  if (trx.lockedByDeviceId && trx.lockedByDeviceId !== deviceId) throw new Error('Transaksi sedang dipakai customer lain.');
  const nextData = updateGroupTransaction(reportData, groupId, transactionId, (current) => ({
    ...current,
    keterangan: note,
    noteUpdatedAt: nowIso()
  }));
  await updateRemoteReport(row.id, nextData);
}

export async function submitAudienceTimer(token: string, payload: TimerRecord) {
  if (!firebaseDb) return;
  const row = await getRemoteReportByToken(token);
  if (!row) throw new Error('Link timer tidak valid.');
  const reportData = row.report;
  const groupId = text(payload.groupId);
  const transactionId = text(payload.transactionId);
  const deviceId = text(payload.deviceId);
  const elapsedText = text(payload.elapsedText);
  if (!groupId || !transactionId || !elapsedText) throw new Error('Payload timer tidak lengkap.');
  const group = groupById(reportData, groupId);
  if (!group?.timerEnabled) throw new Error('Kelompok timer belum diaktifkan fasilitator.');
  const trx = transactionById(group, transactionId);
  if (!trx) throw new Error('Transaksi tidak ditemukan.');
  if (trx.actualTime) return;
  if (trx.lockedByDeviceId && deviceId && trx.lockedByDeviceId !== deviceId) throw new Error('Transaksi sudah dipilih customer lain.');
  let nextData = updateGroupTransaction(reportData, groupId, transactionId, (current) => ({
    ...current,
    actualTime: elapsedText,
    keterangan: text(payload.keterangan) || current.keterangan || '-',
    capturedAt: text(payload.createdAt) || nowIso(),
    capturedByDeviceId: deviceId,
    lockedByDeviceId: current.lockedByDeviceId || deviceId,
    lockedAt: current.lockedAt || text(payload.createdAt) || nowIso()
  }));
  const timers = Array.isArray(reportData.timers) ? reportData.timers : [];
  nextData = syncCrewDependentRows({ ...nextData, timers: [payload, ...timers.filter((timer: any) => timer?.id !== payload.id)] });
  await updateRemoteReport(row.id, nextData);
}

function snapshotHasDocs(snapshot: QuerySnapshot<DocumentData>) {
  return snapshot.docs.length > 0;
}

export function subscribeReports(callback: () => void): Unsubscribe {
  if (!firebaseDb) return () => undefined;
  return onSnapshot(
    storesCollectionRef(),
    () => callback(),
    () => { /* keep UI on local fallback when cloud listener fails */ }
  );
}

export function subscribeReport(id: string, callback: (data: ReportData) => void): Unsubscribe {
  if (!firebaseDb || !id) return () => undefined;
  return onSnapshot(
    storeDocRef(id),
    (snap) => {
      const row = docToRow(snap.id, snap.data());
      if (row) {
        const report = rowToReport(row);
        if (report) callback(report);
      }
    },
    () => { /* keep UI on local fallback when cloud listener fails */ }
  );
}

export function subscribeReportByToken(token: string, callback: () => void): Unsubscribe {
  if (!firebaseDb || !token) return () => undefined;
  return onSnapshot(
    query(storesCollectionRef(), where('audienceToken', '==', token), limit(1)),
    (snapshot) => { if (snapshotHasDocs(snapshot)) callback(); },
    () => { /* keep UI on local fallback when cloud listener fails */ }
  );
}

export async function deleteStoreMedia(storeId: string) {
  // We use ImgBB which hosts files anonymously, no need to delete them explicitly
  return;
}

export async function deleteRemoteReport(id: string) {
  if (!firebaseDb) return;
  await deleteStoreMedia(id);
  await deleteDoc(storeDocRef(id));
}

