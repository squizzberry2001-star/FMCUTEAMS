import { isSamePersonName } from '../data/masterStoresData';
import { GAS_VAULT_API_URL } from './cloudScheduleSyncService';

export interface CustomUserAvatar {
  userName: string;
  userEmail?: string;
  avatar: string; // Base64 data URL or remote image URL
  updatedAtMs: number;
}

const LOCAL_CUSTOM_AVATARS_KEY = 'fmcu_user_custom_avatars_v2';
const AVATAR_SYNC_EVENT = 'fmcu-custom-avatar-updated';

let avatarBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    avatarBroadcastChannel = new BroadcastChannel('fmcu_custom_avatar_channel');
  }
} catch {
  avatarBroadcastChannel = null;
}

/**
 * Return true if the avatar string is a user-uploaded image (data URL, GDrive URL, HTTPS image),
 * and NOT an auto-generated cartoon DiceBear avatar.
 */
export function isCustomOrRealAvatar(avatar?: string | null): boolean {
  if (!avatar || typeof avatar !== 'string') return false;
  const trimmed = avatar.trim();
  if (trimmed.length < 15) return false;
  if (trimmed.includes('dicebear.com') || trimmed.includes('api.dicebear.com')) {
    return false;
  }
  return true;
}

/**
 * Read cached custom user avatars from localStorage + session fallbacks.
 */
export function getLocalCustomAvatars(): Record<string, CustomUserAvatar> {
  const result: Record<string, CustomUserAvatar> = {};

  try {
    const raw = localStorage.getItem(LOCAL_CUSTOM_AVATARS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.entries(parsed).forEach(([key, val]) => {
          if (val && typeof val === 'object' && (val as CustomUserAvatar).avatar) {
            result[key.toLowerCase()] = val as CustomUserAvatar;
          }
        });
      }
    }
  } catch (err) {
    console.warn('Failed to parse local custom avatars:', err);
  }

  // Also check currently logged-in user session if it has a real avatar
  try {
    const savedUserRaw = localStorage.getItem('fmcu_user_session_v3');
    if (savedUserRaw) {
      const u = JSON.parse(savedUserRaw);
      if (u?.name && isCustomOrRealAvatar(u.avatar)) {
        const key = u.name.trim().toLowerCase();
        if (!result[key] || !result[key].avatar) {
          result[key] = {
            userName: u.name,
            userEmail: u.email,
            avatar: u.avatar,
            updatedAtMs: Date.now(),
          };
        }
      }
    }
  } catch {
    // ignore
  }

  // Also check fmcu_users_v5
  try {
    const savedUsersRaw = localStorage.getItem('fmcu_users_v5');
    if (savedUsersRaw) {
      const list = JSON.parse(savedUsersRaw);
      if (Array.isArray(list)) {
        list.forEach((u: any) => {
          if (u?.name && isCustomOrRealAvatar(u.avatar)) {
            const key = u.name.trim().toLowerCase();
            if (!result[key] || !result[key].avatar) {
              result[key] = {
                userName: u.name,
                userEmail: u.email,
                avatar: u.avatar,
                updatedAtMs: Date.now(),
              };
            }
          }
        });
      }
    }
  } catch {
    // ignore
  }

  return result;
}

/**
 * Save user's custom avatar to localStorage and notify all listeners on current device.
 */
export function saveCustomUserAvatarLocally(
  userName: string,
  avatarData: string,
  userEmail?: string
): void {
  if (!userName || !avatarData) return;
  try {
    const current = getLocalCustomAvatars();
    const key = userName.trim().toLowerCase();
    const updatedEntry: CustomUserAvatar = {
      userName,
      userEmail,
      avatar: avatarData,
      updatedAtMs: Date.now(),
    };
    current[key] = updatedEntry;

    localStorage.setItem(LOCAL_CUSTOM_AVATARS_KEY, JSON.stringify(current));

    // Also update fmcu_users_v5 if present
    try {
      const savedUsersRaw = localStorage.getItem('fmcu_users_v5');
      if (savedUsersRaw) {
        const list = JSON.parse(savedUsersRaw);
        if (Array.isArray(list)) {
          let modified = false;
          const nextList = list.map((u: any) => {
            if (u?.name && isSamePersonName(u.name, userName)) {
              modified = true;
              return { ...u, avatar: avatarData };
            }
            return u;
          });
          if (modified) {
            localStorage.setItem('fmcu_users_v5', JSON.stringify(nextList));
          }
        }
      }
    } catch {
      // ignore
    }

    // Broadcast update across tabs
    if (avatarBroadcastChannel) {
      avatarBroadcastChannel.postMessage({
        type: 'CUSTOM_AVATAR_UPDATED',
        entry: updatedEntry,
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(AVATAR_SYNC_EVENT, { detail: updatedEntry })
      );
    }
  } catch (err) {
    console.warn('Failed to save custom user avatar locally:', err);
  }
}

/**
 * Fetch all users' custom avatars from Cloud Vault (for cross-device synchronization).
 */
export async function fetchCustomAvatarsFromCloud(): Promise<Record<string, CustomUserAvatar>> {
  const localMap = getLocalCustomAvatars();

  try {
    const res = await fetch(GAS_VAULT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'db_get_collection',
        collection: 'user_avatars',
      }),
    });

    if (!res.ok) return localMap;

    const json = await res.json();
    if (json && json.status === 'SUCCESS' && json.data) {
      let cloudItems: CustomUserAvatar[] = [];
      if (Array.isArray(json.data)) {
        cloudItems = json.data;
      } else if (typeof json.data === 'object') {
        cloudItems = Object.values(json.data);
      }

      let hasNew = false;
      cloudItems.forEach((item) => {
        if (item?.userName && isCustomOrRealAvatar(item.avatar)) {
          const key = item.userName.trim().toLowerCase();
          const existing = localMap[key];
          if (!existing || (item.updatedAtMs || 0) >= (existing.updatedAtMs || 0)) {
            localMap[key] = {
              userName: item.userName,
              userEmail: item.userEmail,
              avatar: item.avatar,
              updatedAtMs: item.updatedAtMs || Date.now(),
            };
            hasNew = true;
          }
        }
      });

      if (hasNew) {
        try {
          localStorage.setItem(LOCAL_CUSTOM_AVATARS_KEY, JSON.stringify(localMap));
        } catch {
          // ignore quota
        }
      }
    }
  } catch (err) {
    console.warn('fetchCustomAvatarsFromCloud failed:', err);
  }

  return localMap;
}

/**
 * Push user's custom avatar to Cloud Vault so every device immediately sees it.
 */
export async function pushCustomAvatarToCloud(
  userName: string,
  avatarData: string,
  userEmail?: string
): Promise<boolean> {
  if (!userName || !avatarData) return false;

  // Save locally first for 0ms immediate feedback
  saveCustomUserAvatarLocally(userName, avatarData, userEmail);

  try {
    const currentLocal = getLocalCustomAvatars();
    const payload = {
      action: 'db_save_collection',
      collection: 'user_avatars',
      data: currentLocal,
    };

    const res = await fetch(GAS_VAULT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });

    return res.ok;
  } catch (err) {
    console.warn('pushCustomAvatarToCloud failed:', err);
    return false;
  }
}

/**
 * Resolve the best avatar for a person:
 * Checks custom uploaded photos (local / cloud), then fallback avatar.
 */
export function resolveCustomOrFallbackAvatar(
  personName: string,
  fallbackAvatar?: string,
  customMap?: Record<string, CustomUserAvatar>
): string {
  if (!personName) return fallbackAvatar || '';
  const map = customMap || getLocalCustomAvatars();
  const directKey = personName.trim().toLowerCase();

  if (map[directKey] && isCustomOrRealAvatar(map[directKey].avatar)) {
    return map[directKey].avatar;
  }

  // Flexible match with isSamePersonName
  for (const entry of Object.values(map)) {
    if (entry?.userName && isSamePersonName(entry.userName, personName)) {
      if (isCustomOrRealAvatar(entry.avatar)) {
        return entry.avatar;
      }
    }
  }

  if (isCustomOrRealAvatar(fallbackAvatar)) {
    return fallbackAvatar!;
  }

  return fallbackAvatar || '';
}

/**
 * React hook / listener helper to subscribe to custom avatar updates.
 */
export function subscribeToCustomAvatarUpdates(
  callback: (map: Record<string, CustomUserAvatar>) => void
): () => void {
  const handler = () => {
    callback(getLocalCustomAvatars());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(AVATAR_SYNC_EVENT, handler);
  }

  let chHandler: ((evt: MessageEvent) => void) | null = null;
  if (avatarBroadcastChannel) {
    chHandler = (evt) => {
      if (evt.data && evt.data.type === 'CUSTOM_AVATAR_UPDATED') {
        callback(getLocalCustomAvatars());
      }
    };
    avatarBroadcastChannel.addEventListener('message', chHandler);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(AVATAR_SYNC_EVENT, handler);
    }
    if (avatarBroadcastChannel && chHandler) {
      avatarBroadcastChannel.removeEventListener('message', chHandler);
    }
  };
}
