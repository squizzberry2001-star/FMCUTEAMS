/**
 * ====================================================================
 * FMCU TEAMS - Google Apps Script Web App Backend
 * Database & Encrypted Drive Storage
 * ====================================================================
 * 
 * CARA DEPLOY:
 * 1. Buka https://script.google.com/
 * 2. Klik "New Project" (Beri nama: "FMCU TEAMS Backend")
 * 3. Hapus semua kode default, lalu COPAS seluruh isi script ini.
 * 4. Klik "Deploy" -> "New deployment"
 * 5. Pilih icon Gear ⚙️ -> Pilih "Web app"
 * 6. Konfigurasi:
 *    - Description: "FMCU Web App API"
 *    - Execute as: "Me (email akun Anda)"
 *    - Who has access: "Anyone" (PENTING! Agar web Vercel bisa kirim data)
 * 7. Klik "Deploy" -> "Authorize access" (Pilih akun Google Anda -> Advanced -> Go to ... (unsafe) -> Allow)
 * 8. Copy "Web app URL" (akhiran /exec) dan tempelkan ke aplikasi web FMCU Anda!
 */

const FOLDER_NAME = "FMCU_Encrypted_Drive";
const SHEET_NAME = "FMCU_Database";

// Handler GET (Cek koneksi dan ambil data)
function doGet(e) {
  try {
    const action = e.parameter.action || "ping";
    
    if (action === "ping") {
      return createResponse({
        status: "success",
        message: "Koneksi ke Google Apps Script FMCU TEAMS Berhasil!",
        timestamp: new Date().toISOString()
      });
    }

    if (action === "getData") {
      const type = e.parameter.type || "all";
      const data = getRecordsFromSheet(type);
      return createResponse({
        status: "success",
        data: data
      });
    }

    return createResponse({ status: "error", message: "Action tidak dikenali." });
  } catch (error) {
    return createResponse({ status: "error", message: error.toString() });
  }
}

// Handler POST (Simpan data form & upload foto terenkripsi)
function doPost(e) {
  try {
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      payload = e.parameter;
    }

    const action = payload.action || "saveData";

    // 1. Simpan Data Form (Agenda, Visit, NSO)
    if (action === "saveData") {
      const result = saveRecordToSheet(payload);
      return createResponse({
        status: "success",
        message: "Data berhasil disimpan ke Google Drive!",
        recordId: result.id,
        timestamp: new Date().toISOString()
      });
    }

    // 2. Simpan Foto Terenkripsi ke Folder Google Drive
    if (action === "uploadEncryptedPhoto") {
      const fileUrl = saveEncryptedPhotoToDrive(payload);
      return createResponse({
        status: "success",
        message: "Foto terenkripsi berhasil disimpan ke Google Drive!",
        fileId: fileUrl.id,
        fileName: fileUrl.name
      });
    }

    return createResponse({ status: "error", message: "Aksi POST tidak valid." });
  } catch (error) {
    return createResponse({ status: "error", message: error.toString() });
  }
}

// Helper: Ambil atau buat Google Spreadsheet database di Google Drive
function getOrCreateDatabaseSheet() {
  const files = DriveApp.getFilesByName(SHEET_NAME);
  let spreadsheet;
  if (files.hasNext()) {
    spreadsheet = SpreadsheetApp.open(files.next());
  } else {
    spreadsheet = SpreadsheetApp.create(SHEET_NAME);
    const sheet = spreadsheet.getActiveSheet();
    sheet.appendRow(["ID", "Timestamp", "Type", "EncryptedData", "Author", "TitleOrLocation", "Status"]);
    sheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#2BB3A0").setFontColor("#FFFFFF");
  }
  return spreadsheet.getActiveSheet();
}

// Helper: Ambil atau buat Folder penyimpanan file terenkripsi di Google Drive
function getOrCreateDriveFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(FOLDER_NAME);
}

// Simpan record ke Spreadsheet
function saveRecordToSheet(payload) {
  const sheet = getOrCreateDatabaseSheet();
  const id = "FMCU-" + new Date().getTime();
  const timestamp = new Date().toISOString();
  const type = payload.type || "GENERAL";
  const encryptedData = payload.encryptedData || "";
  const author = payload.author || "Anonymous";
  const title = payload.title || "-";
  const status = payload.status || "COMPLETED";

  sheet.appendRow([id, timestamp, type, encryptedData, author, title, status]);
  return { id: id };
}

// Ambil record dari Spreadsheet
function getRecordsFromSheet(filterType) {
  const sheet = getOrCreateDatabaseSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (filterType === "all" || row[2] === filterType) {
      results.push({
        id: row[0],
        timestamp: row[1],
        type: row[2],
        encryptedData: row[3],
        author: row[4],
        title: row[5],
        status: row[6]
      });
    }
  }
  return results.reverse(); // Terbaru di atas
}

// Simpan file terenkripsi (.enc) ke Google Drive
function saveEncryptedPhotoToDrive(payload) {
  const folder = getOrCreateDriveFolder();
  const fileName = "ENC_" + (payload.fileName || ("PHOTO_" + new Date().getTime() + ".enc"));
  const encryptedBase64 = payload.encryptedBase64;
  
  // Simpan data terenkripsi sebagai file biner murni
  const decodedBytes = Utilities.base64Decode(encryptedBase64);
  const blob = Utilities.newBlob(decodedBytes, "application/octet-stream", fileName);
  const file = folder.createFile(blob);
  
  return {
    id: file.getId(),
    name: fileName
  };
}

// Helper response JSON dengan CORS header
function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
