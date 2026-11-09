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
  lastSeenMs: number; // Timestamp Date.now()
  isWebActive: boolean; // True jika halaman web sedang terbuka
  isGpsActive: boolean; // True jika GPS terdeteksi menyala
}

const LOCAL_PRESENCE_KEY = 'fmcu_active_user_presences_v3';
const PRESENCE_TTL_MS = 3 * 60 * 1000; // 3 menit toleransi heartbeat

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
      const active = getLocalActivePresences();
      notifySubscribers(active);
    }
  };
}

/**
 * Baca daftar presensi aktif dari localStorage yang masih valid (< 3 menit & GPS aktif)
 */
export function getLocalActivePresences(): UserLivePresence[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_PRESENCE_KEY);
    if (!raw) return [];
    const list: UserLivePresence[] = JSON.parse(raw);
    if (!Array.isArray(list)) return [];

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
  } catch {
    return [];
  }
}

/**
 * Simpan dan sebar status kehadiran live user secara lokal
 */
export function saveLocalActivePresence(presence: UserLivePresence): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLocalActivePresences();
    const filtered = existing.filter((p) => !isSamePersonName(p.userName, presence.userName));

    // Jika user masih aktif & GPS menyala, simpan ke daftar
    if (presence.isWebActive && presence.isGpsActive && Date.now() - presence.lastSeenMs < PRESENCE_TTL_MS) {
      filtered.push(presence);
    }

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
 */
export async function clearUserPresence(userName: string): Promise<void> {
  if (typeof window === 'undefined' || !userName) return;
  try {
    const existing = getLocalActivePresences();
    const updated = existing.filter((p) => !isSamePersonName(p.userName, userName));
    localStorage.setItem(LOCAL_PRESENCE_KEY, JSON.stringify(updated));

    if (presenceBroadcastChannel) {
      presenceBroadcastChannel.postMessage({ type: 'PRESENCE_SYNC' });
    }
    notifySubscribers(updated);

    const inactivePayload = {
      userName,
      isWebActive: false,
      isGpsActive: false,
      lastSeenMs: 0,
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
 * Ambil seluruh presensi user aktif dari cloud yang masih valid (< 3 menit & GPS menyala)
 */
export async function fetchLiveUserPresencesFromCloud(): Promise<UserLivePresence[]> {
  const localList = getLocalActivePresences();

  try {
    const resp = await postCloudPresence({
      action: 'db_get_collection',
      collection: 'user_live_presence',
    });

    if (resp && resp.status === 'SUCCESS' && Array.isArray(resp.data)) {
      const now = Date.now();
      const validCloudList: UserLivePresence[] = [];

      resp.data.forEach((item: any) => {
        if (!item || !item.userName) return;
        const lastSeen = Number(item.lastSeenMs || 0);
        const isWeb = Boolean(item.isWebActive);
        const isGps = Boolean(item.isGpsActive);
        const lat = Number(item.lat || 0);
        const lng = Number(item.lng || 0);

        // Hanya valid jika sedang akses web, GPS menyala, dan heartbeat < 3 menit
        if (isWeb && isGps && now - lastSeen < PRESENCE_TTL_MS && (lat !== 0 || lng !== 0)) {
          validCloudList.push({
            userName: String(item.userName),
            userEmail: item.userEmail ? String(item.userEmail) : undefined,
            lat,
            lng,
            accuracyMeters: item.accuracyMeters ? Number(item.accuracyMeters) : 15,
            lastSeenMs: lastSeen,
            isWebActive: true,
            isGpsActive: true,
          });
        }
      });

      // Gabungkan data cloud dengan data lokal
      const mergedMap = new Map<string, UserLivePresence>();
      validCloudList.forEach((p) => mergedMap.set(p.userName.toLowerCase(), p));
      localList.forEach((p) => {
        const existing = mergedMap.get(p.userName.toLowerCase());
        if (!existing || p.lastSeenMs > existing.lastSeenMs) {
          mergedMap.set(p.userName.toLowerCase(), p);
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
 * Memulai pengiriman heartbeat berkala ketika user membuka web dan GPS aktif.
 * Otomatis mati saat user menutup web atau GPS dimatikan.
 */
export function startLivePresenceHeartbeat(user: User | null | undefined): void {
  if (typeof window === 'undefined' || !user || !user.name) return;
  currentTrackingUser = user;

  const performCheck = () => {
    if (!navigator.geolocation) {
      clearUserPresence(user.name);
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
        // GPS MATI ATAU DITOLAK -> Hapus kehadiran karena GPS tidak menyala
        clearUserPresence(user.name);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
    );
  };

  // Jalankan segera sekali
  performCheck();

  if (heartbeatTimer) clearInterval(heartbeatTimer);
  // Interval setiap 45 detik selama user membuka web
  heartbeatTimer = setInterval(performCheck, 45000);

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
