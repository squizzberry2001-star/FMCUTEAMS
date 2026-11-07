/**
 * ============================================================================
 * FMCU TEAMS — GOOGLE APPS SCRIPT (GAS) FOR GOOGLE DRIVE STORY & VISIT STORAGE
 * Target Folder: https://drive.google.com/drive/u/3/folders/1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a
 * Folder ID    : 1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a
 * ============================================================================
 *
 * CARA DEPLOY (1 MENIT):
 * 1. Buka https://script.google.com -> Buat Project Baru ("FMCU TEAMS GDrive Sync")
 * 2. Paste seluruh kode ini ke file Code.gs lalu klik Save (Ctrl+S)
 * 3. Klik tombol "Deploy" (kanan atas) -> "New deployment"
 * 4. Pilih jenis: "Web app"
 *    - Execute as : "Me" (Akun Google pemilik folder GDrive)
 *    - Who has access : "Anyone" (Siapa saja)
 * 5. Klik "Deploy", berikan izin akses (Authorize access), lalu salin URL Web App
 *    (format: https://script.google.com/macros/s/AKfycb.../exec)
 * 6. Tempel URL Web App tersebut pada menu Konfigurasi GDrive di aplikasi FMCU TEAMS.
 */

const TARGET_FOLDER_ID = '1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a';
const STORY_DB_FILENAME = 'fmcu_stories_24h_db.json';
const STORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 Jam (Auto-Disappear seperti Instagram)

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'getActiveStories';
    if (action === 'getActiveStories') {
      const stories = getAndPruneStories();
      return jsonResponse({
        ok: true,
        folderId: TARGET_FOLDER_ID,
        stories: stories,
      });
    }
    return jsonResponse({ ok: true, status: 'FMCU TEAMS GDrive GAS Active', folderId: TARGET_FOLDER_ID });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const payload = JSON.parse(raw);
    const action = payload.action || '';
    const folderId = payload.folderId || TARGET_FOLDER_ID;
    const rootFolder = DriveApp.getFolderById(folderId);

    // 1. UPLOAD STORY KE GOOGLE DRIVE FOLDER 1IjruNS9pl5llP4k1VAlRNUhAvIEGql1a
    if (action === 'uploadStoryToGDrive') {
      const stories = getAndPruneStories(rootFolder);
      const nowMs = Date.now();
      const base64Clean = (payload.base64 || '').replace(/^data:image\/\w+;base64,/, '');
      const filename =
        payload.filename ||
        'STORY_' + (payload.userId || 'user') + '_' + nowMs + '.jpg';

      const blob = Utilities.newBlob(
        Utilities.base64Decode(base64Clean),
        payload.mimeType || 'image/jpeg',
        filename
      );

      const file = rootFolder.createFile(blob);
      file.setDescription(
        'FMCU Story by ' + (payload.userName || '') + ' | Caption: ' + (payload.caption || '')
      );

      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr) {
        // Jika kebijakan domain Workspace membatasi sharing publik, tetap simpan file
      }

      const fileId = file.getId();
      const directImageUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
      const driveViewUrl = 'https://drive.google.com/file/d/' + fileId + '/view';

      const newSlide = {
        id: payload.id || 'story-' + nowMs,
        userId: payload.userId || 'user',
        userName: payload.userName || 'User FMCU',
        userRole: payload.userRole || 'Field Staff FMCU',
        userAvatar: payload.userAvatar || '',
        imageUrl: directImageUrl,
        driveFileId: fileId,
        driveFolderId: folderId,
        driveUrl: driveViewUrl,
        caption: payload.caption || '',
        storeTag: payload.storeTag || 'FMCU Field Activity',
        createdAt: payload.createdAt || '',
        dateKey: payload.dateKey || '',
        createdAtMs: payload.createdAtMs || nowMs,
        expiresAtMs: (payload.createdAtMs || nowMs) + STORY_TTL_MS,
        reactions: {},
        views: [],
      };

      const updatedStories = [newSlide].concat(stories);
      saveStoriesDb(rootFolder, updatedStories);

      return jsonResponse({
        ok: true,
        driveFileId: fileId,
        driveUrl: driveViewUrl,
        imageUrl: directImageUrl,
        story: newSlide,
        stories: updatedStories,
      });
    }

    // 2. REACT KE STORY (Maksimal 1x per user, bisa ganti-ganti emoticon)
    if (action === 'reactToStory') {
      const stories = getAndPruneStories(rootFolder);
      const storyId = payload.storyId;
      const emoji = payload.emoji;
      const userName = payload.userName || '';

      const updated = stories.map(function (slide) {
        if (slide.id !== storyId) return slide;
        const reactions = slide.reactions || {};
        const existingForEmoji = reactions[emoji] || [];
        const alreadyPicked = existingForEmoji.some(function (u) {
          return String(u).toLowerCase() === String(userName).toLowerCase();
        });

        const cleaned = {};
        Object.keys(reactions).forEach(function (em) {
          const filtered = (reactions[em] || []).filter(function (u) {
            return String(u).toLowerCase() !== String(userName).toLowerCase();
          });
          if (filtered.length > 0) {
            cleaned[em] = filtered;
          }
        });

        if (!alreadyPicked && emoji) {
          cleaned[emoji] = (cleaned[emoji] || []).concat([userName]);
        }

        slide.reactions = cleaned;
        return slide;
      });

      saveStoriesDb(rootFolder, updated);
      return jsonResponse({ ok: true, stories: updated });
    }

    // 3. RECORD VIEW DARI USER LAIN (Icon Mata + Jumlah Lihat)
    if (action === 'viewStory') {
      const stories = getAndPruneStories(rootFolder);
      const storyId = payload.storyId;
      const viewerName = payload.viewerName || '';

      const updated = stories.map(function (slide) {
        if (slide.id !== storyId) return slide;
        if (String(slide.userName).toLowerCase() === String(viewerName).toLowerCase()) {
          return slide;
        }
        const views = Array.isArray(slide.views) ? slide.views : [];
        const exists = views.some(function (v) {
          return String(v).toLowerCase() === String(viewerName).toLowerCase();
        });
        if (!exists && viewerName) {
          slide.views = views.concat([viewerName]);
        }
        return slide;
      });

      saveStoriesDb(rootFolder, updated);
      return jsonResponse({ ok: true, stories: updated });
    }

    // 4. HAPUS STORY PRIBADI DARI GDRIVE
    if (action === 'deleteStory') {
      const stories = getAndPruneStories(rootFolder);
      const storyId = payload.storyId;
      const remaining = [];

      stories.forEach(function (slide) {
        if (slide.id === storyId) {
          if (slide.driveFileId) {
            try {
              DriveApp.getFileById(slide.driveFileId).setTrashed(true);
            } catch (err) {}
          }
        } else {
          remaining.push(slide);
        }
      });

      saveStoriesDb(rootFolder, remaining);
      return jsonResponse({ ok: true, stories: remaining });
    }

    // 5. UPLOAD FOTO VISIT REPORT KE SUBFOLDER DI DALAM FOLDER GDRIVE YANG SAMA
    if (action === 'uploadPhotoToGDrive') {
      const subFolderName = payload.folderName || 'FMCU_VISIT_PHOTOS';
      let targetSubFolder = rootFolder;
      const subIter = rootFolder.getFoldersByName(subFolderName);
      if (subIter.hasNext()) {
        targetSubFolder = subIter.next();
      } else {
        targetSubFolder = rootFolder.createFolder(subFolderName);
      }

      const base64Clean = (payload.base64 || '').replace(/^data:image\/\w+;base64,/, '');
      const blob = Utilities.newBlob(
        Utilities.base64Decode(base64Clean),
        payload.mimeType || 'image/jpeg',
        payload.filename || 'VISIT_' + Date.now() + '.jpg'
      );
      const file = targetSubFolder.createFile(blob);
      return jsonResponse({
        ok: true,
        driveFileId: file.getId(),
        driveUrl: 'https://drive.google.com/file/d/' + file.getId() + '/view',
      });
    }

    return jsonResponse({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Membaca database story dari folder GDrive dan otomatis menghapus (Auto-Disappear)
 * story beserta file fotonya di GDrive jika sudah lewat 24 jam.
 */
function getAndPruneStories(folderOpt) {
  const folder = folderOpt || DriveApp.getFolderById(TARGET_FOLDER_ID);
  const files = folder.getFilesByName(STORY_DB_FILENAME);
  if (!files.hasNext()) {
    return [];
  }

  const dbFile = files.next();
  let list = [];
  try {
    const content = dbFile.getBlob().getDataAsString('UTF-8');
    list = JSON.parse(content);
    if (!Array.isArray(list)) list = [];
  } catch (e) {
    list = [];
  }

  const nowMs = Date.now();
  const active = [];
  let changed = false;

  list.forEach(function (slide) {
    const expiresAt =
      typeof slide.expiresAtMs === 'number'
        ? slide.expiresAtMs
        : (slide.createdAtMs || 0) + STORY_TTL_MS;

    if (expiresAt > nowMs) {
      active.push(slide);
    } else {
      changed = true;
      // Auto-trash expired photo file from Google Drive after 24 hours
      if (slide.driveFileId) {
        try {
          DriveApp.getFileById(slide.driveFileId).setTrashed(true);
        } catch (err) {}
      }
    }
  });

  if (changed) {
    dbFile.setContent(JSON.stringify(active));
  }

  return active;
}

function saveStoriesDb(folder, stories) {
  const files = folder.getFilesByName(STORY_DB_FILENAME);
  const payload = JSON.stringify(stories);
  if (files.hasNext()) {
    files.next().setContent(payload);
  } else {
    folder.createFile(STORY_DB_FILENAME, payload, MimeType.PLAIN_TEXT);
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
