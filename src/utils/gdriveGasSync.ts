import type { StorySlide } from '../components/EmployeeStoriesBar';
import { GAS_VAULT_API_URL } from '../services/cloudScheduleSyncService';
import { pushCustomAvatarToCloud, saveCustomUserAvatarLocally } from '../services/userAvatarSyncService';

export const FMCU_GDRIVE_FOLDER_ID = '1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a';
export const FMCU_GDRIVE_FOLDER_URL =
  'https://drive.google.com/drive/u/3/folders/1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a';

// Official Deployed Google Apps Script Web App URL (Hardcoded Auto-Sync Backend)
export const DEFAULT_GAS_GDRIVE_URL =
  'https://script.google.com/macros/s/AKfycbxSL7hmNr0oGgAR19o3KYR3AMSHD2b9tY3uZ196AS_XTzTA9Wv3OGxE_NZ6ZGUnDe_EeQ/exec';

const IDB_NAME = 'fmcu_stories_gdrive_db_v1';
const IDB_STORE = 'stories_store';
const IDB_KEY = 'active_stories_24h';
const DELETED_STORIES_STORAGE_KEY = 'fmcu_deleted_story_ids_v2';

export const getDeletedStoryIds = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_STORIES_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {
    // ignore
  }
  return new Set();
};

export const removeStoriesFromIdb = async (storyIds: string[]): Promise<void> => {
  if (!Array.isArray(storyIds) || storyIds.length === 0) return;
  try {
    const idSet = new Set(storyIds);
    const existing = await loadStoriesFromIdb();
    if (existing && Array.isArray(existing)) {
      const filtered = existing.filter((s) => s && !idSet.has(s.id));
      await saveStoriesToIdb(filtered);
    }
  } catch (e) {
    console.warn('removeStoriesFromIdb error:', e);
  }
};

export const purgeDeletedStoryIds = (storyIds: string[]): void => {
  if (typeof window === 'undefined' || !Array.isArray(storyIds) || storyIds.length === 0) return;
  try {
    const current = getDeletedStoryIds();
    let hasNew = false;
    storyIds.forEach((id) => {
      if (id && typeof id === 'string' && !current.has(id)) {
        current.add(id);
        hasNew = true;
      }
    });

    if (hasNew) {
      localStorage.setItem(DELETED_STORIES_STORAGE_KEY, JSON.stringify(Array.from(current).slice(-500)));

      // Clean immediately from local stories storage
      const rawStories = localStorage.getItem('fmcu_employee_stories_v2');
      if (rawStories) {
        const parsed: StorySlide[] = JSON.parse(rawStories);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((s) => s && !current.has(s.id));
          localStorage.setItem('fmcu_employee_stories_v2', JSON.stringify(cleaned));
        }
      }

      // Clean from IndexedDB in background
      removeStoriesFromIdb(Array.from(current)).catch(() => {});

      // Dispatch local events so UI updates instantly (0ms)
      storyIds.forEach((id) => {
        window.dispatchEvent(new CustomEvent('fmcu:story:deleted', { detail: { storyId: id } }));
      });
    }
  } catch (e) {
    console.warn('purgeDeletedStoryIds error:', e);
  }
};

export const recordDeletedStoryId = (storyId: string): void => {
  if (typeof window === 'undefined' || !storyId) return;
  purgeDeletedStoryIds([storyId]);
};

export const isStoryDeleted = (storyId: string): boolean => {
  if (!storyId) return false;
  return getDeletedStoryIds().has(storyId);
};

export const removeStoryFromIdb = async (storyId: string): Promise<void> => {
  return removeStoriesFromIdb([storyId]);
};

export const getGasWebAppUrl = (): string => {
  return DEFAULT_GAS_GDRIVE_URL;
};

const openStoriesIdb = (): Promise<IDBDatabase> => {
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

export const saveStoriesToIdb = async (stories: StorySlide[]): Promise<void> => {
  try {
    const validStories = (stories || []).filter((s) => s && s.id && !isStoryDeleted(s.id));
    const db = await openStoriesIdb();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(validStories, IDB_KEY);
  } catch (e) {
    console.warn('IDB Stories Save Warning:', e);
  }
};

export const loadStoriesFromIdb = async (): Promise<StorySlide[] | null> => {
  try {
    const db = await openStoriesIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => {
        if (Array.isArray(req.result)) {
          resolve(req.result.filter((s) => s && s.id && !isStoryDeleted(s.id)));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

/**
 * Upload a new Story photo + metadata to Google Drive Folder (1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a)
 * via Google Apps Script (GAS) automatically.
 */
export const uploadStoryToGasGDrive = async (
  slide: StorySlide
): Promise<{
  synced: boolean;
  driveFileId: string;
  driveUrl: string;
  remoteImageUrl?: string;
  remoteStories?: StorySlide[];
}> => {
  const gasUrl = DEFAULT_GAS_GDRIVE_URL;
  const safeName = slide.userName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `FMCU_STORY_${safeName}_${slide.createdAtMs}.jpg`;
  const fallbackFileId = `GDRIVE_${FMCU_GDRIVE_FOLDER_ID}_${slide.createdAtMs}`;
  const fallbackDriveUrl = FMCU_GDRIVE_FOLDER_URL;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      synced: false,
      driveFileId: fallbackFileId,
      driveUrl: fallbackDriveUrl,
    };
  }

  const payload = {
    action: 'uploadStoryToGDrive',
    folderId: FMCU_GDRIVE_FOLDER_ID,
    folderUrl: FMCU_GDRIVE_FOLDER_URL,
    filename,
    mimeType: 'image/jpeg',
    id: slide.id,
    userId: slide.userId,
    userName: slide.userName,
    userRole: slide.userRole,
    userAvatar: slide.userAvatar,
    caption: slide.caption,
    storeTag: slide.storeTag,
    createdAt: slide.createdAt,
    dateKey: slide.dateKey,
    createdAtMs: slide.createdAtMs,
    expiresAtMs: slide.expiresAtMs,
    base64: slide.imageUrl.replace(/^data:image\/\w+;base64,/, ''),
  };

  // Broadcast story immediately to other tabs and components (0ms)
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('fmcu_story_reaction_channel');
      channel.postMessage({ type: 'STORY_POSTED', story: slide });
      channel.close();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fmcu:story:posted', { detail: { story: slide } }));
    }
  } catch {
    // ignore
  }

  try {
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.ok) {
        const hostedImageUrl = data.imageUrl || fallbackDriveUrl;

        // Concurrently push lightweight story metadata to Edge Cloud Vault for instant multi-device visibility
        (async () => {
          try {
            const lightweightSlide: StorySlide = {
              ...slide,
              imageUrl: hostedImageUrl,
              driveFileId: data.driveFileId || fallbackFileId,
              driveUrl: data.driveUrl || fallbackDriveUrl,
              gdriveSynced: true,
            };
            const existing = (await fetchActiveStoriesFromGasGDrive()) || [];
            const updated = [
              lightweightSlide,
              ...existing.filter((s) => s && s.id !== slide.id && !isStoryDeleted(s.id)),
            ];
            await fetch(GAS_VAULT_API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({
                action: 'db_save_collection',
                collection: 'stories',
                data: updated,
              }),
              keepalive: true,
            });
          } catch {
            // ignore
          }
        })();

        return {
          synced: true,
          driveFileId: data.driveFileId || fallbackFileId,
          driveUrl: data.driveUrl || fallbackDriveUrl,
          remoteImageUrl: data.imageUrl,
          remoteStories: Array.isArray(data.stories) ? data.stories : undefined,
        };
      }
    }
  } catch {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });
      return {
        synced: true,
        driveFileId: fallbackFileId,
        driveUrl: fallbackDriveUrl,
      };
    } catch (innerErr) {
      console.warn('GAS Story Upload fallback error:', innerErr);
    }
  }

  return {
    synced: false,
    driveFileId: fallbackFileId,
    driveUrl: fallbackDriveUrl,
  };
};

/**
 * Fetch active (<24h) stories from Google Drive folder via Google Apps Script automatically.
 * Queries both primary Google Drive Script & Edge Cloud Vault in parallel for instant cross-device pickup.
 */
export const fetchActiveStoriesFromGasGDrive = async (): Promise<StorySlide[] | null> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return null;
  }

  const nowMs = Date.now();
  const storyMap = new Map<string, StorySlide>();
  let fetchSucceeded = false;

  try {
    // 1. Parallel query:
    // a. Tombstones (deleted stories) from Cloud Vault
    // b. Official Google Drive folder stories
    // c. Edge Cloud Vault stories
    const [tombstoneRes, driveRes, vaultRes] = await Promise.allSettled([
      fetch(GAS_VAULT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'db_get_collection', collection: 'deleted_stories' }),
      }).then(async (r) => (r.ok ? r.json() : null)),
      fetch(
        `${DEFAULT_GAS_GDRIVE_URL}?action=getActiveStories&folderId=${FMCU_GDRIVE_FOLDER_ID}&t=${nowMs}`
      ).then(async (r) => (r.ok ? r.json() : null)),
      fetch(GAS_VAULT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'db_get_collection', collection: 'stories' }),
      }).then(async (r) => (r.ok ? r.json() : null)),
    ]);

    // Process tombstones first to ensure deleted stories NEVER leak
    const deletedIds = new Set<string>();
    getDeletedStoryIds().forEach((id) => deletedIds.add(id));

    if (tombstoneRes.status === 'fulfilled' && tombstoneRes.value) {
      const delJson = tombstoneRes.value;
      if (delJson && delJson.status === 'SUCCESS' && Array.isArray(delJson.data)) {
        const fetchedDelIds = delJson.data.map((item: any) => String(item?.id || item)).filter(Boolean);
        if (fetchedDelIds.length > 0) {
          purgeDeletedStoryIds(fetchedDelIds);
          fetchedDelIds.forEach((id: string) => deletedIds.add(id));
        }
      }
    }

    // Process official Google Drive stories
    if (driveRes.status === 'fulfilled' && driveRes.value) {
      const dJson = driveRes.value;
      if (dJson && dJson.ok && Array.isArray(dJson.stories)) {
        fetchSucceeded = true;
        dJson.stories.forEach((s: StorySlide) => {
          if (
            s &&
            s.id &&
            !deletedIds.has(s.id) &&
            !isStoryDeleted(s.id) &&
            (s.expiresAtMs ? s.expiresAtMs > nowMs : true)
          ) {
            storyMap.set(s.id, s);
          }
        });
      }
    }

    // Merge with Edge Cloud Vault stories
    if (vaultRes.status === 'fulfilled' && vaultRes.value) {
      const vJson = vaultRes.value;
      if (vJson && vJson.status === 'SUCCESS' && Array.isArray(vJson.data)) {
        fetchSucceeded = true;
        vJson.data.forEach((s: StorySlide) => {
          if (
            s &&
            s.id &&
            !deletedIds.has(s.id) &&
            !isStoryDeleted(s.id) &&
            (s.expiresAtMs ? s.expiresAtMs > nowMs : true)
          ) {
            const existing = storyMap.get(s.id);
            if (existing) {
              storyMap.set(s.id, {
                ...s,
                ...existing,
                imageUrl: existing.imageUrl || s.imageUrl,
                reactions: s.reactions || existing.reactions,
                views: Array.from(new Set([...(existing.views || []), ...(s.views || [])])),
              });
            } else {
              storyMap.set(s.id, s);
            }
          }
        });
      }
    }
  } catch (e) {
    console.warn('fetchActiveStoriesFromGasGDrive error:', e);
  }

  if (!fetchSucceeded) {
    return null; // Network or server error, preserve local cache
  }

  const list = Array.from(storyMap.values()).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  return list; // ALWAYS returns StorySlide[] (even if empty []), indicating successful sync
};

/**
 * Sync 1x emoji reaction change to Google Drive stories DB via GAS & Edge Cloud Vault.
 */
export const syncStoryReactionToGasGDrive = async (params: {
  storyId: string;
  emoji: string;
  userName: string;
  updatedReactions?: Record<string, string[]>;
}): Promise<void> => {
  const gasUrl = DEFAULT_GAS_GDRIVE_URL;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  // 1. Immediately update Edge Cloud Vault so other devices pick up the reaction in real time
  (async () => {
    try {
      const existing = (await fetchActiveStoriesFromGasGDrive()) || [];
      const updated = existing.map((s) => {
        if (s.id !== params.storyId) return s;
        let reactions = params.updatedReactions;
        if (!reactions) {
          const current = s.reactions || {};
          const filtered: Record<string, string[]> = {};
          Object.entries(current).forEach(([em, list]) => {
            const f = (list || []).filter(
              (u) => u.toLowerCase() !== params.userName.toLowerCase()
            );
            if (f.length > 0) filtered[em] = f;
          });
          filtered[params.emoji] = [...(filtered[params.emoji] || []), params.userName];
          reactions = filtered;
        }
        return { ...s, reactions };
      });

      await fetch(GAS_VAULT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'db_save_collection',
          collection: 'stories',
          data: updated,
        }),
        keepalive: true,
      });
    } catch {
      // ignore
    }
  })();

  // 2. Concurrently notify GAS WebApp
  try {
    await fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'reactToStory',
        folderId: FMCU_GDRIVE_FOLDER_ID,
        ...params,
      }),
      keepalive: true,
    });
  } catch {
    // Ignore background sync error
  }
};

/**
 * Sync story view from another user to Google Drive stories DB via GAS.
 */
export const syncStoryViewToGasGDrive = async (params: {
  storyId: string;
  viewerName: string;
}): Promise<void> => {
  const gasUrl = DEFAULT_GAS_GDRIVE_URL;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  try {
    await fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'viewStory',
        folderId: FMCU_GDRIVE_FOLDER_ID,
        ...params,
      }),
      keepalive: true,
    });
  } catch {
    // Ignore background sync error
  }
};

/**
 * Delete story and move its photo file to Trash in Google Drive folder via GAS,
 * and immediately purge it from Edge Cloud Vault and local caches so it NEVER reappears.
 */
export const deleteStoryFromGasGDrive = async (storyId: string): Promise<void> => {
  if (!storyId) return;

  // 1. Immediately record in local tombstone, purge local storage & IndexedDB (0ms local sync)
  purgeDeletedStoryIds([storyId]);

  // 2. Broadcast to other open tabs and components immediately (0ms)
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('fmcu_story_reaction_channel');
      channel.postMessage({ type: 'STORY_DELETED', storyId });
      channel.close();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fmcu:story:deleted', { detail: { storyId } }));
    }
  } catch {
    // ignore
  }

  // 3. Fast Parallel Cloud Purge with keepalive: true
  // Even if user refreshes page or closes tab immediately, keepalive guarantees requests finish!
  const purgeVaultPromise = (async () => {
    try {
      const res = await fetch(GAS_VAULT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'db_get_collection', collection: 'stories' }),
        keepalive: true,
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.status === 'SUCCESS' && Array.isArray(json.data)) {
          const updatedStories = json.data.filter((s: any) => s && s.id !== storyId);
          await fetch(GAS_VAULT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'db_save_collection',
              collection: 'stories',
              data: updatedStories,
            }),
            keepalive: true,
          });
        }
      }
    } catch (e) {
      console.warn('Vault story collection delete error:', e);
    }
  })();

  const tombstonePromise = (async () => {
    try {
      let existingTombstones: any[] = [];
      const delGetRes = await fetch(GAS_VAULT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'db_get_collection', collection: 'deleted_stories' }),
        keepalive: true,
      });
      if (delGetRes.ok) {
        const delJson = await delGetRes.json();
        if (delJson && delJson.status === 'SUCCESS' && Array.isArray(delJson.data)) {
          existingTombstones = delJson.data;
        }
      }

      const updatedTombstones = [
        ...existingTombstones.filter((t: any) => t && t.id !== storyId),
        { id: storyId, deletedAtMs: Date.now() },
      ].slice(-300);

      await fetch(GAS_VAULT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'db_save_collection',
          collection: 'deleted_stories',
          data: updatedTombstones,
        }),
        keepalive: true,
      });
    } catch (e) {
      console.warn('Vault tombstone error:', e);
    }
  })();

  const driveTrashPromise = (async () => {
    try {
      const gasUrl = DEFAULT_GAS_GDRIVE_URL;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'deleteStory',
          folderId: FMCU_GDRIVE_FOLDER_ID,
          storyId,
        }),
        keepalive: true,
      });
    } catch {
      // Ignore background sync error
    }
  })();

  await Promise.allSettled([purgeVaultPromise, tombstonePromise, driveTrashPromise]);
};

export const FMCU_GDRIVE_PROFILE_SUBFOLDER = 'FMCU_FOTO_PROFIL_USER';

/**
 * Upload user profile photo to a dedicated new subfolder ('FMCU_FOTO_PROFIL_USER')
 * inside the same Google Drive folder (1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a) via Google Apps Script.
 */
export const uploadProfilePhotoToGasGDrive = async (params: {
  userName: string;
  userEmail?: string;
  base64Data: string;
}): Promise<{
  synced: boolean;
  driveFileId: string;
  driveUrl: string;
}> => {
  // Immediately persist custom avatar locally and push to Cloud Vault
  saveCustomUserAvatarLocally(params.userName, params.base64Data, params.userEmail);
  pushCustomAvatarToCloud(params.userName, params.base64Data, params.userEmail).catch(() => {});

  const gasUrl = DEFAULT_GAS_GDRIVE_URL;
  const safeName = params.userName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const nowMs = Date.now();
  const filename = `PROFIL_${safeName}_${nowMs}.jpg`;
  const fallbackFileId = `GDRIVE_PROFIL_${safeName}_${nowMs}`;
  const fallbackDriveUrl = FMCU_GDRIVE_FOLDER_URL;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      synced: false,
      driveFileId: fallbackFileId,
      driveUrl: fallbackDriveUrl,
    };
  }

  const payload = {
    action: 'uploadPhotoToGDrive',
    folderId: FMCU_GDRIVE_FOLDER_ID,
    folderUrl: FMCU_GDRIVE_FOLDER_URL,
    folderName: FMCU_GDRIVE_PROFILE_SUBFOLDER,
    filename,
    mimeType: 'image/jpeg',
    visitorName: params.userName,
    userEmail: params.userEmail || '',
    section: 'PROFILE_PHOTO',
    base64: params.base64Data.replace(/^data:image\/\w+;base64,/, ''),
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.ok) {
        return {
          synced: true,
          driveFileId: data.driveFileId || fallbackFileId,
          driveUrl: data.driveUrl || fallbackDriveUrl,
        };
      }
    }
  } catch {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });
      return {
        synced: true,
        driveFileId: fallbackFileId,
        driveUrl: fallbackDriveUrl,
      };
    } catch (err) {
      console.warn('GAS Profile Photo upload fallback error:', err);
    }
  }

  return {
    synced: false,
    driveFileId: fallbackFileId,
    driveUrl: fallbackDriveUrl,
  };
};
