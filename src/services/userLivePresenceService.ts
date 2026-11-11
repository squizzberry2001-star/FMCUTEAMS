import { User } from '../types';
import { isSamePersonName } from '../data/masterStoresData';
import { CLOUDFLARE_D1_API_URL, GAS_VAULT_API_URL } from './cloudScheduleSyncService';

// ============================================================================
// REALTIME USER WEB ACCESS & LIVE GPS PRESENCE SERVICE
// ATURAN MUTLAK:
// Pinpoint user HANYA muncul di peta jika user sedang aktif mengakses web
// DAN GPS perangkat dalam keadaan menyala (active live coordinates).
// Jika user menutup web atau GPS mati, pinpoint tidak akan ditampilkan sama sekali.
// ============================================================================

export interface UserLivePresence {
  userName: string;
  userEmail?: string;
  lat: number;
  lng: number;
  accuracyMeters?: number;
  lastSeenMs: number; // Timestamp Date.now() heartbeat
  lastOpenedMs?: number; // Timestamp saat pertama kali membuka web / login sesi ini
  lastLeftMs?: number; // Timestamp saat keluar aplikasi / menutup web / logout
  isWebActive: boolean; // True jika halaman web sedang terbuka
  isGpsActive: boolean; // True jika GPS terdeteksi menyala
}

const LOCAL_PRESENCE_KEY = 'fmcu_active_user_presences_v3';
export const PRESENCE_TTL_MS = 3 * 60 * 1000; // 3 menit toleransi heartbeat

// Multi-tab BroadcastChannel for 0ms same-device sync
let presenceBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    presenceBroadcastChannel = new BroadcastChannel('fmcu_presence_channel_v3');
  }
} catch {
  presenceBroadcastChannel = null;
}

const presenceSubscribers = new Set<(presences: UserLivePresence[]) => void>();

export function subscribeToLivePresences(callback: (presences: UserLivePresence[]) => void): () => void {
  presenceSubscribers.add(callback);
  return () => {
    presenceSubscribers.delete(callback);
  };
}

function notifySubscribers(presences: UserLivePresence[]): void {
  presenceSubscribers.forEach((cb) => {
    try {
      cb(presences);
    } catch {
      // ignore callback error
    }
  });
}

// Listen to local BroadcastChannel messages
if (presenceBroadcastChannel) {
  presenceBroadcastChannel.onmessage = (evt) => {
    if (evt.data && evt.data.type === 'PRESENCE_SYNC') {
      const all = getAllLocalPresences();
      notifySubscribers(all);
    }
  };
}

/**
 * Baca seluruh riwayat presensi user (aktif maupun yang sudah keluar) dari localStorage
 */
export function getAllLocalPresences(): UserLivePresence[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_PRESENCE_KEY);
    if (!raw) return [];
    const list: UserLivePresence[] = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Baca daftar presensi aktif dari localStorage yang masih valid (< 3 menit & GPS aktif)
 */
export function getLocalActivePresences(): UserLivePresence[] {
  const list = getAllLocalPresences();
  const now = Date.now();
  return list.filter(
    (p) =>
      p &&
      p.isWebActive === true &&
      p.isGpsActive === true &&
      now - p.lastSeenMs < PRESENCE_TTL_MS &&
      p.lat !== 0 &&
      p.lng !== 0
  );
}

/**
 * Simpan dan sebar status kehadiran live user secara lokal
 */
export function saveLocalActivePresence(presence: UserLivePresence): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getAllLocalPresences();
    const prev = existing.find((p) => isSamePersonName(p.userName, presence.userName));

    const merged: UserLivePresence = {
      ...prev,
      ...presence,
      lastOpenedMs: presence.lastOpenedMs || prev?.lastOpenedMs,
      lastLeftMs: presence.lastLeftMs !== undefined ? presence.lastLeftMs : prev?.lastLeftMs,
    };

    const filtered = existing.filter((p) => !isSamePersonName(p.userName, presence.userName));
    filtered.push(merged);

    localStorage.setItem(LOCAL_PRESENCE_KEY, JSON.stringify(filtered));

    if (presenceBroadcastChannel) {
      presenceBroadcastChannel.postMessage({ type: 'PRESENCE_SYNC' });
    }
    notifySubscribers(filtered);
  } catch {
    // ignore
  }
}

async function postCloudPresence(payload: Record<string, any>): Promise<any> {
  try {
    const sep = CLOUDFLARE_D1_API_URL.includes('?') ? '&' : '?';
    const res = await fetch(`${CLOUDFLARE_D1_API_URL}${sep}t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch {
    // fallback to GAS
  }

  try {
    const sep = GAS_VAULT_API_URL.includes('?') ? '&' : '?';
    const res = await fetch(`${GAS_VAULT_API_URL}${sep}t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch {
    // ignore network errors
  }
  return null;
}

/**
 * Kirim heartbeat live GPS ke cloud edge
 */
export async function pushUserPresenceToCloud(presence: UserLivePresence): Promise<void> {
  saveLocalActivePresence(presence);

  const payloadItem = {
    ...presence,
    id: `presence-${presence.userName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    updatedAt: new Date().toISOString(),
  };

  await postCloudPresence({
    action: 'db_save_collection',
    collection: 'user_live_presence',
    data: [payloadItem],
  });
}

/**
 * Hapus kehadiran user saat menutup web / tab / logout
 * Menyimpan waktu keluar (lastLeftMs) dan menandai status tidak aktif
 */
export async function clearUserPresence(userName: string): Promise<void> {
  if (typeof window === 'undefined' || !userName) return;
  try {
    const now = Date.now();
    const existing = getAllLocalPresences();
    const prev = existing.find((p) => isSamePersonName(p.userName, userName));

    const inactivePresence: UserLivePresence = {
      userName,
      userEmail: prev?.userEmail,
      lat: prev?.lat || 0,
      lng: prev?.lng || 0,
      accuracyMeters: prev?.accuracyMeters,
      lastSeenMs: prev?.lastSeenMs || now,
      lastOpenedMs: prev?.lastOpenedMs,
      lastLeftMs: now,
      isWebActive: false,
      isGpsActive: false,
    };

    const updated = existing.filter((p) => !isSamePersonName(p.userName, userName));
    updated.push(inactivePresence);
    localStorage.setItem(LOCAL_PRESENCE_KEY, JSON.stringify(updated));

    if (presenceBroadcastChannel) {
      presenceBroadcastChannel.postMessage({ type: 'PRESENCE_SYNC' });
    }
    notifySubscribers(updated);

    const inactivePayload = {
      ...inactivePresence,
      id: `presence-${userName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      updatedAt: new Date().toISOString(),
    };

    // Gunakan sendBeacon jika sedang unload agar request selesai tanpa terpotong
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob(
        [
          JSON.stringify({
            action: 'db_save_collection',
            collection: 'user_live_presence',
            data: [inactivePayload],
          }),
        ],
        { type: 'text/plain;charset=utf-8' }
      );
      navigator.sendBeacon(CLOUDFLARE_D1_API_URL, blob);
    } else {
      postCloudPresence({
        action: 'db_save_collection',
        collection: 'user_live_presence',
        data: [inactivePayload],
      });
    }
  } catch {
    // ignore
  }
}

/**
 * Ambil seluruh presensi user dari cloud (aktif maupun offline) dengan metadata waktu buka & keluar
 */
export async function fetchLiveUserPresencesFromCloud(): Promise<UserLivePresence[]> {
  const localList = getAllLocalPresences();

  try {
    const resp = await postCloudPresence({
      action: 'db_get_collection',
      collection: 'user_live_presence',
    });

    if (resp && resp.status === 'SUCCESS' && Array.isArray(resp.data)) {
      const now = Date.now();
      const cloudList: UserLivePresence[] = [];

      resp.data.forEach((item: any) => {
        if (!item || !item.userName) return;
        const lastSeen = Number(item.lastSeenMs || 0);
        const lastOpened = item.lastOpenedMs ? Number(item.lastOpenedMs) : undefined;
        const lastLeft = item.lastLeftMs ? Number(item.lastLeftMs) : undefined;
        const isWeb = Boolean(item.isWebActive);
        const isGps = Boolean(item.isGpsActive);
        const lat = Number(item.lat || 0);
        const lng = Number(item.lng || 0);

        // Jika heartbeat sudah lebih dari TTL (3 menit), tandai web nonaktif otomatis
        const isStale = now - lastSeen > PRESENCE_TTL_MS;
        const effectiveWeb = isWeb && !isStale;
        const effectiveGps = isGps && !isStale;
        const effectiveLeft = lastLeft || (isStale ? lastSeen : undefined);

        cloudList.push({
          userName: String(item.userName),
          userEmail: item.userEmail ? String(item.userEmail) : undefined,
          lat,
          lng,
          accuracyMeters: item.accuracyMeters ? Number(item.accuracyMeters) : 15,
          lastSeenMs: lastSeen,
          lastOpenedMs: lastOpened,
          lastLeftMs: effectiveLeft,
          isWebActive: effectiveWeb,
          isGpsActive: effectiveGps,
        });
      });

      // Gabungkan data cloud dengan data lokal
      const mergedMap = new Map<string, UserLivePresence>();
      cloudList.forEach((p) => mergedMap.set(p.userName.toLowerCase(), p));
      localList.forEach((p) => {
        const existing = mergedMap.get(p.userName.toLowerCase());
        if (!existing || p.lastSeenMs > existing.lastSeenMs) {
          mergedMap.set(p.userName.toLowerCase(), {
            ...existing,
            ...p,
            lastOpenedMs: p.lastOpenedMs || existing?.lastOpenedMs,
            lastLeftMs: p.lastLeftMs || existing?.lastLeftMs,
          });
        }
      });

      const result = Array.from(mergedMap.values());
      localStorage.setItem(LOCAL_PRESENCE_KEY, JSON.stringify(result));
      notifySubscribers(result);
      return result;
    }
  } catch {
    // ignore cloud fetch error, fallback ke local
  }

  return localList;
}

// Background Heartbeat Interval Tracker
let heartbeatTimer: any = null;
let currentTrackingUser: User | null = null;

/**
 * Memulai pengiriman heartbeat berkala ketika user membuka web.
 * Mencatat waktu pertama buka web (lastOpenedMs) dan status live GPS.
 */
export function startLivePresenceHeartbeat(user: User | null | undefined): void {
  if (typeof window === 'undefined' || !user || !user.name) return;
  currentTrackingUser = user;

  // Catat waktu pertama kali membuka web sesi ini
  let sessionOpened = 0;
  try {
    const stored = sessionStorage.getItem('fmcu_session_opened_at');
    if (stored) {
      sessionOpened = Number(stored);
    } else {
      sessionOpened = Date.now();
      sessionStorage.setItem('fmcu_session_opened_at', String(sessionOpened));
    }
  } catch {
    sessionOpened = Date.now();
  }

  const performCheck = () => {
    // Battery Saver: Jangan polling GPS jika ponsel terkunci atau tab di latar belakang
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }

    if (!navigator.geolocation) {
      // Browser tidak support geolocation tapi web sedang dibuka
      const fallbackPresence: UserLivePresence = {
        userName: user.name,
        userEmail: user.email,
        lat: 0,
        lng: 0,
        accuracyMeters: 0,
        lastSeenMs: Date.now(),
        lastOpenedMs: sessionOpened,
        isWebActive: true,
        isGpsActive: false,
      };
      saveLocalActivePresence(fallbackPresence);
      pushUserPresenceToCloud(fallbackPresence);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // GPS MENYALA & AKSES WEB AKTIF
        const presence: UserLivePresence = {
          userName: user.name,
          userEmail: user.email,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: Math.round(pos.coords.accuracy || 15),
          lastSeenMs: Date.now(),
          lastOpenedMs: sessionOpened,
          lastLeftMs: undefined,
          isWebActive: true,
          isGpsActive: true,
        };

        try {
          localStorage.setItem(
            'fmcu_live_gps',
            `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`
          );
          localStorage.setItem('fmcu_live_gps_timestamp', String(Date.now()));
          sessionStorage.setItem('fmcu_gps_verified', 'true');
        } catch {
          // ignore
        }

        pushUserPresenceToCloud(presence);
      },
      () => {
        // GPS MATI ATAU DITOLAK -> Web tetap aktif namun GPS mati
        const existing = getAllLocalPresences();
        const prev = existing.find((p) => isSamePersonName(p.userName, user.name));

        const presenceWithoutGps: UserLivePresence = {
          userName: user.name,
          userEmail: user.email,
          lat: prev?.lat || 0,
          lng: prev?.lng || 0,
          accuracyMeters: prev?.accuracyMeters,
          lastSeenMs: Date.now(),
          lastOpenedMs: sessionOpened,
          lastLeftMs: undefined,
          isWebActive: true,
          isGpsActive: false,
        };
        saveLocalActivePresence(presenceWithoutGps);
        pushUserPresenceToCloud(presenceWithoutGps);
      },
      // Battery Optimization: enableHighAccuracy false & maximumAge 45s memanfaatkan A-GPS/Wi-Fi & cache
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 45000 }
    );
  };

  // Jalankan segera sekali
  performCheck();

  if (heartbeatTimer) clearInterval(heartbeatTimer);
  // Interval setiap 60 detik selama user aktif membuka web (hemat baterai)
  heartbeatTimer = setInterval(performCheck, 60000);

  // Pasang listener saat tab/window ditutup
  const handleUnload = () => {
    if (currentTrackingUser?.name) {
      clearUserPresence(currentTrackingUser.name);
    }
  };
  window.addEventListener('beforeunload', handleUnload);
  window.addEventListener('pagehide', handleUnload);
}

/**
 * Hentikan heartbeat ketika user logout
 */
export function stopLivePresenceHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (currentTrackingUser?.name) {
    clearUserPresence(currentTrackingUser.name);
    currentTrackingUser = null;
  }
}

// ============================================================================
// HELPER STATUS ONLINE / WAKTU TERAKHIR BUKA WEB & KELUAR APLIKASI
// ============================================================================

/**
 * Format timestamp ke jam WIB (UTC+7) misal "08:30 WIB"
 */
export function formatTimeWibStr(ms?: number | null): string {
  if (!ms || ms <= 0) return '-';
  const d = new Date(ms);
  // Normalisasi timezone WIB (UTC+7)
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const wibDate = new Date(utc + 7 * 3600000);
  const hh = String(wibDate.getHours()).padStart(2, '0');
  const mm = String(wibDate.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} WIB`;
}

/**
 * Format selisih waktu relatif dalam bahasa Indonesia
 */
export function formatRelativeTimeStr(ms?: number | null, now = Date.now()): string {
  if (!ms || ms <= 0) return '';
  const diffMs = Math.max(0, now - ms);
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'baru saja';
  if (diffMinutes < 60) return `${diffMinutes} mnt lalu`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} hari lalu`;
}

export interface UserPresenceDetailedStatus {
  isOnline: boolean;
  statusBadge: 'ONLINE' | 'LEFT' | 'STANDBY';
  badgeLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  openedTimeStr?: string;
  leftTimeStr?: string;
  summaryText: string;
  timeDetail: string;
}

/**
 * Evaluasi status presensi user lengkap dengan keterangan kapan terakhir buka web dan kapan keluar aplikasi
 */
export function getUserPresenceDetailedStatus(
  presence?: UserLivePresence | null,
  now = Date.now()
): UserPresenceDetailedStatus {
  if (!presence || !presence.lastSeenMs) {
    return {
      isOnline: false,
      statusBadge: 'STANDBY',
      badgeLabel: 'Standby',
      badgeBg: 'bg-slate-100',
      badgeText: 'text-slate-600',
      badgeBorder: 'border-slate-200',
      dotColor: 'bg-slate-400',
      summaryText: 'Belum ada aktivitas',
      timeDetail: 'Belum membuka web hari ini',
    };
  }

  const isRecent = now - presence.lastSeenMs < PRESENCE_TTL_MS;
  const isOnline = Boolean(presence.isWebActive && presence.isGpsActive && isRecent);

  // KONDISI 1: USER SEDANG ONLINE AKTIF DENGAN GPS
  if (isOnline) {
    const openedMs = presence.lastOpenedMs || presence.lastSeenMs;
    const openedStr = formatTimeWibStr(openedMs);
    const relStr = formatRelativeTimeStr(openedMs, now);

    return {
      isOnline: true,
      statusBadge: 'ONLINE',
      badgeLabel: 'Online',
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-800',
      badgeBorder: 'border-emerald-200',
      dotColor: 'bg-emerald-500',
      openedTimeStr: openedStr,
      summaryText: `Online • Buka ${openedStr}`,
      timeDetail: `Buka web pk ${openedStr} (${relStr})`,
    };
  }

  // KONDISI 2: USER KELUAR APLIKASI / MENUTUP WEB
  const leftMs = presence.lastLeftMs || presence.lastSeenMs;
  const leftStr = formatTimeWibStr(leftMs);
  const leftRelStr = formatRelativeTimeStr(leftMs, now);
  const openedStr = presence.lastOpenedMs ? formatTimeWibStr(presence.lastOpenedMs) : undefined;

  if (presence.lastLeftMs || !presence.isWebActive) {
    return {
      isOnline: false,
      statusBadge: 'LEFT',
      badgeLabel: 'Keluar',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-800',
      badgeBorder: 'border-amber-200',
      dotColor: 'bg-amber-500',
      openedTimeStr: openedStr,
      leftTimeStr: leftStr,
      summaryText: `Keluar ${leftStr}`,
      timeDetail: openedStr
        ? `Keluar pk ${leftStr} (${leftRelStr}) • Buka pk ${openedStr}`
        : `Keluar pk ${leftStr} (${leftRelStr})`,
    };
  }

  // KONDISI 3: WEB TERBUKA TAPI GPS OFF ATAU HEARTBEAT TIMEOUT
  return {
    isOnline: false,
    statusBadge: 'STANDBY',
    badgeLabel: presence.isWebActive ? 'GPS Off' : 'Standby',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-600',
    badgeBorder: 'border-slate-200',
    dotColor: 'bg-slate-400',
    openedTimeStr: openedStr,
    leftTimeStr: leftStr,
    summaryText: `Terakhir aktif ${leftStr}`,
    timeDetail: `Terakhir aktif pk ${leftStr} (${leftRelStr})`,
  };
}

/**
 * Filter personel yang sedang aktif di lapangan (GPS & Web aktif < 3 mnt)
 */
export function filterActiveRadarUsers(
  presences: UserLivePresence[],
  now = Date.now()
): UserLivePresence[] {
  return presences.filter(
    (p) => p && p.isWebActive && p.isGpsActive && now - p.lastSeenMs < PRESENCE_TTL_MS
  );
}
