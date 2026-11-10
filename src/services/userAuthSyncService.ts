import { User } from '../types';
import { CLOUDFLARE_D1_API_URL, GAS_VAULT_API_URL } from './cloudScheduleSyncService';

export const USER_PASSWORD_SYNC_EVENT = 'fmcu:user:password:updated';
export const FMCU_USERS_STORAGE_KEY = 'fmcu_users_v6';
export const FMCU_USER_SESSION_KEY = 'fmcu_user_session_v3';

let authBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    authBroadcastChannel = new BroadcastChannel('fmcu_user_auth_sync_channel');
  }
} catch {
  authBroadcastChannel = null;
}

function normalizeKey(str?: string): string {
  return String(str || '').trim().toLowerCase().replace(/\([^)]+\)\s*/g, '').trim();
}

/**
 * Menyimpan password user ke Cloudflare D1 Edge SQLite dan Google Apps Script Vault
 * sekaligus menyinkronkan ke localStorage dan broadcast ke semua tab di perangkat yang sama.
 */
export async function syncUserPasswordOnline(
  user: User,
  newPassword: string
): Promise<{ success: boolean; cloudSynced: boolean; message: string }> {
  if (!user || !user.name || !newPassword) {
    return { success: false, cloudSynced: false, message: 'Data pengguna atau sandi baru tidak valid.' };
  }

  const cleanPassword = String(newPassword).trim();
  const updatedUser: User = {
    ...user,
    password: cleanPassword,
    nik: user.nik || (/^\d+$/.test(cleanPassword) ? cleanPassword : user.nik),
  };

  // 1. Simpan segera ke localStorage (Instant offline & fast-reload guarantee)
  try {
    // Update user session
    localStorage.setItem(FMCU_USER_SESSION_KEY, JSON.stringify(updatedUser));

    // Update master users list in storage
    const rawUsers = localStorage.getItem(FMCU_USERS_STORAGE_KEY) || localStorage.getItem('fmcu_users_v5');
    if (rawUsers) {
      const parsed = JSON.parse(rawUsers);
      if (Array.isArray(parsed)) {
        const nextList = parsed.map((u: any) =>
          normalizeKey(u.name) === normalizeKey(user.name) || String(u.id) === String(user.id)
            ? { ...u, password: cleanPassword, nik: updatedUser.nik || u.nik }
            : u
        );
        localStorage.setItem(FMCU_USERS_STORAGE_KEY, JSON.stringify(nextList));
      }
    }
  } catch (err) {
    console.warn('Gagal menyimpan password ke localStorage:', err);
  }

  // 2. Broadcast ke semua tab terbuka
  try {
    if (authBroadcastChannel) {
      authBroadcastChannel.postMessage({
        type: 'USER_PASSWORD_UPDATED',
        userName: user.name,
        newPassword: cleanPassword,
        timestamp: Date.now(),
      });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(USER_PASSWORD_SYNC_EVENT, {
          detail: { userName: user.name, newPassword: cleanPassword },
        })
      );
    }
  } catch {
    // ignore broadcast errors
  }

  // 3. Payload untuk Cloudflare D1 & GAS Vault
  const cloudItem = {
    ...updatedUser,
    username: user.email?.split('@')[0] || user.name.toLowerCase().replace(/\s+/g, '.'),
    password: cleanPassword,
    nik: updatedUser.nik || cleanPassword,
    updatedAt: new Date().toISOString(),
  };

  let cloudSynced = false;

  // 4. Push ke Cloudflare D1 Edge SQLite (~20ms)
  try {
    const d1Res = await fetch(CLOUDFLARE_D1_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'db_save_item',
        collection: 'users',
        item: cloudItem,
      }),
    });
    if (d1Res.ok) {
      const d1Json = await d1Res.json().catch(() => null);
      if (d1Json && d1Json.status === 'SUCCESS') {
        cloudSynced = true;
      }
    }
  } catch (err) {
    console.warn('Gagal sinkron password ke Cloudflare D1:', err);
  }

  // 5. Push ke Google Apps Script Vault (Backup redundansi cloud)
  try {
    const gasRes = await fetch(GAS_VAULT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'db_save_item',
        collection: 'users',
        item: cloudItem,
      }),
    });
    if (gasRes.ok) {
      const gasJson = await gasRes.json().catch(() => null);
      if (gasJson && gasJson.status === 'SUCCESS') {
        cloudSynced = true;
      }
    }
  } catch (err) {
    console.warn('Gagal sinkron password ke GAS Vault:', err);
  }

  return {
    success: true,
    cloudSynced,
    message: cloudSynced
      ? 'Sandi berhasil diperbarui dan tersinkronisasi online di semua perangkat.'
      : 'Sandi berhasil diperbarui secara lokal. Sinkronisasi cloud akan berlanjut di latar belakang.',
  };
}

/**
 * Mengambil daftar user & password terkini dari cloud (Cloudflare D1 / GAS)
 */
export async function fetchOnlineUserPasswords(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  try {
    // 1. Coba Cloudflare D1
    const d1Res = await fetch(CLOUDFLARE_D1_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'db_get_collection',
        collection: 'users',
      }),
    });

    if (d1Res.ok) {
      const d1Json = await d1Res.json().catch(() => null);
      if (d1Json && d1Json.status === 'SUCCESS' && Array.isArray(d1Json.data)) {
        d1Json.data.forEach((u: any) => {
          if (u?.name && u?.password) {
            const key = normalizeKey(u.name);
            result[key] = String(u.password).trim();
            if (u.id) result[String(u.id)] = String(u.password).trim();
            if (u.username) result[normalizeKey(u.username)] = String(u.password).trim();
          }
        });
        return result;
      }
    }
  } catch (err) {
    console.warn('Fetch online passwords from D1 error:', err);
  }

  // 2. Fallback GAS Vault
  try {
    const gasRes = await fetch(GAS_VAULT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'db_get_collection',
        collection: 'users',
      }),
    });

    if (gasRes.ok) {
      const gasJson = await gasRes.json().catch(() => null);
      if (gasJson && gasJson.status === 'SUCCESS' && Array.isArray(gasJson.data)) {
        gasJson.data.forEach((u: any) => {
          if (u?.name && u?.password) {
            const key = normalizeKey(u.name);
            result[key] = String(u.password).trim();
            if (u.id) result[String(u.id)] = String(u.password).trim();
          }
        });
      }
    }
  } catch (err) {
    console.warn('Fetch online passwords from GAS error:', err);
  }

  return result;
}

/**
 * Menggabungkan password online dari cloud ke dalam daftar User aplikasi
 */
export function mergeUsersWithOnlinePasswords(
  users: User[],
  cloudPasswords: Record<string, string>
): { updatedList: User[]; hasChanges: boolean } {
  if (!cloudPasswords || Object.keys(cloudPasswords).length === 0) {
    return { updatedList: users, hasChanges: false };
  }

  let hasChanges = false;
  const updatedList = users.map((u) => {
    const nameKey = normalizeKey(u.name);
    const idKey = String(u.id || '');
    const onlinePass = cloudPasswords[nameKey] || (idKey ? cloudPasswords[idKey] : undefined);

    if (onlinePass && onlinePass !== u.password) {
      hasChanges = true;
      return {
        ...u,
        password: onlinePass,
        nik: u.nik || (/^\d+$/.test(onlinePass) ? onlinePass : u.nik),
      };
    }
    return u;
  });

  return { updatedList, hasChanges };
}
