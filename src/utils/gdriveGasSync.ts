import type { StorySlide } from '../components/EmployeeStoriesBar';

export const FMCU_GDRIVE_FOLDER_ID = '1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a';
export const FMCU_GDRIVE_FOLDER_URL =
  'https://drive.google.com/drive/u/3/folders/1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a';

export const GAS_WEBAPP_STORAGE_KEY = 'fmcu_gas_webapp_url';
export const DEFAULT_GAS_GDRIVE_URL =
  'https://script.google.com/macros/s/AKfycbzFMCU_VisitReport_GDrive_AutoStorage/exec';

const IDB_NAME = 'fmcu_stories_gdrive_db_v1';
const IDB_STORE = 'stories_store';
const IDB_KEY = 'active_stories_24h';

export const getGasWebAppUrl = (): string => {
  try {
    return localStorage.getItem(GAS_WEBAPP_STORAGE_KEY) || DEFAULT_GAS_GDRIVE_URL;
  } catch {
    return DEFAULT_GAS_GDRIVE_URL;
  }
};

export const setGasWebAppUrl = (url: string): void => {
  try {
    const trimmed = url.trim();
    if (trimmed) {
      localStorage.setItem(GAS_WEBAPP_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(GAS_WEBAPP_STORAGE_KEY);
    }
  } catch (e) {
    console.warn(e);
  }
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
 * via Google Apps Script (GAS).
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
  const gasUrl = getGasWebAppUrl();
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

  try {
    // Try standard CORS POST (text/plain avoids preflight OPTIONS in Google Apps Script)
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
    // Fallback to no-cors fire-and-forget if GAS redirect blocks CORS read
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
 * Fetch active (<24h) stories from Google Drive folder via Google Apps Script.
 */
export const fetchActiveStoriesFromGasGDrive = async (): Promise<StorySlide[] | null> => {
  const gasUrl = getGasWebAppUrl();
  if (
    !gasUrl ||
    gasUrl === DEFAULT_GAS_GDRIVE_URL ||
    (typeof navigator !== 'undefined' && !navigator.onLine)
  ) {
    return null;
  }

  try {
    const sep = gasUrl.includes('?') ? '&' : '?';
    const res = await fetch(
      `${gasUrl}${sep}action=getActiveStories&folderId=${encodeURIComponent(
        FMCU_GDRIVE_FOLDER_ID
      )}&t=${Date.now()}`,
      { method: 'GET' }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.ok && Array.isArray(data.stories)) {
      return data.stories;
    }
  } catch {
    // Silent fallback when GAS URL is not yet deployed or offline
  }
  return null;
};

/**
 * Sync 1x emoji reaction change to Google Drive stories DB via GAS.
 */
export const syncStoryReactionToGasGDrive = async (params: {
  storyId: string;
  emoji: string;
  userName: string;
}): Promise<void> => {
  const gasUrl = getGasWebAppUrl();
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

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
  const gasUrl = getGasWebAppUrl();
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
  const gasUrl = getGasWebAppUrl();
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
