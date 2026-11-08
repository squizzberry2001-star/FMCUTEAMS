import type { StorySlide } from '../components/EmployeeStoriesBar';
import { GAS_VAULT_API_URL } from '../services/cloudScheduleSyncService';

export const FMCU_GDRIVE_FOLDER_ID = '1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a';
export const FMCU_GDRIVE_FOLDER_URL =
  'https://drive.google.com/drive/u/3/folders/1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a';

// Official Deployed Google Apps Script Web App URL (Hardcoded Auto-Sync Backend)
export const DEFAULT_GAS_GDRIVE_URL =
  'https://script.google.com/macros/s/AKfycbxSL7hmNr0oGgAR19o3KYR3AMSHD2b9tY3uZ196AS_XTzTA9Wv3OGxE_NZ6ZGUnDe_EeQ/exec';

const IDB_NAME = 'fmcu_stories_gdrive_db_v1';
const IDB_STORE = 'stories_store';
const IDB_KEY = 'active_stories_24h';

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
    const db = await openStoriesIdb();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(stories, IDB_KEY);
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
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : null);
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

  // Concurrently push story metadata to Edge Cloud Vault for immediate multi-device visibility
  (async () => {
    try {
      const existing = (await fetchActiveStoriesFromGasGDrive()) || [];
      const updated = [slide, ...existing.filter((s) => s.id !== slide.id)];
      await fetch(GAS_VAULT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'db_save_collection',
          collection: 'stories',
          data: updated,
        }),
      });
    } catch {
      // ignore
    }
  })();

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

  // 1. Query Edge Cloud Vault (Fast ~2s)
  const vaultPromise = (async () => {
    try {
      const res = await fetch(GAS_VAULT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'db_get_collection', collection: 'stories' }),
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json && json.status === 'SUCCESS' && Array.isArray(json.data)) {
        json.data.forEach((s: StorySlide) => {
          if (s && s.id && (s.expiresAtMs ? s.expiresAtMs > nowMs : true)) {
            storyMap.set(s.id, s);
          }
        });
      }
    } catch {
      // ignore
    }
  })();

  // 2. Query Primary GDrive Folder Backend
  const primaryPromise = (async () => {
    try {
      const sep = DEFAULT_GAS_GDRIVE_URL.includes('?') ? '&' : '?';
      const res = await fetch(
        `${DEFAULT_GAS_GDRIVE_URL}${sep}action=getActiveStories&folderId=${encodeURIComponent(
          FMCU_GDRIVE_FOLDER_ID
        )}&t=${nowMs}`,
        { method: 'GET' }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.ok && Array.isArray(data.stories)) {
        data.stories.forEach((s: StorySlide) => {
          if (s && s.id && (s.expiresAtMs ? s.expiresAtMs > nowMs : true)) {
            storyMap.set(s.id, s);
          }
        });
      }
    } catch {
      // ignore
    }
  })();

  await Promise.allSettled([vaultPromise, primaryPromise]);

  const list = Array.from(storyMap.values()).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  return list.length > 0 ? list : null;
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
    });
  } catch {
    // Ignore background sync error
  }
};

/**
 * Delete story and move its photo file to Trash in Google Drive folder via GAS.
 */
export const deleteStoryFromGasGDrive = async (storyId: string): Promise<void> => {
  const gasUrl = DEFAULT_GAS_GDRIVE_URL;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  try {
    await fetch(gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'deleteStory',
        folderId: FMCU_GDRIVE_FOLDER_ID,
        storyId,
      }),
    });
  } catch {
    // Ignore background sync error
  }
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
