/**
 * ====================================================================
 * FMCU TEAMS - Google Apps Script Service Client
 * Jembatan Komunikasi Web Frontend ke Google Drive
 * ====================================================================
 */

import { encryptText, decryptText } from './crypto';

const STORAGE_KEY_GAS_URL = 'fmcu_gas_webapp_url';
const STORAGE_KEY_SECRET = 'fmcu_secret_encryption_key';

const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbxAU3BtImhT2UQic0cLYpOG5WgZ8Ch0CGi0KrUrIA0Aa85DKOlb1Ihh85sXXUh8c4M3/exec";

// Ambil URL Google Apps Script yang tersimpan
export function getGasUrl(): string {
  return (
    localStorage.getItem(STORAGE_KEY_GAS_URL) ||
    ((import.meta as any).env?.VITE_GAS_WEBAPP_URL as string) ||
    DEFAULT_GAS_URL
  );
}

// Simpan URL Google Apps Script
export function setGasUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY_GAS_URL, url.trim());
}

// Ambil Kunci Enkripsi
export function getSecretKey(): string {
  return localStorage.getItem(STORAGE_KEY_SECRET) || '';
}

// Simpan Kunci Enkripsi
export function setSecretKey(key: string): void {
  localStorage.setItem(STORAGE_KEY_SECRET, key.trim());
}

// 1. Tes Ping Koneksi ke Google Apps Script
export async function testGasConnection(urlOverride?: string): Promise<{
  success: boolean;
  message: string;
  timestamp?: string;
}> {
  const url = urlOverride || getGasUrl();
  if (!url) {
    return {
      success: false,
      message: 'URL Google Apps Script belum dimasukkan.',
    };
  }

  try {
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}action=ping`, {
      method: 'GET',
      mode: 'cors',
    });

    const data = await response.json();
    if (data.status === 'success') {
      return {
        success: true,
        message: data.message || 'Koneksi ke Google Apps Script Berhasil!',
        timestamp: data.timestamp,
      };
    }
    return {
      success: false,
      message: data.message || 'Respons tidak valid dari server.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal terhubung ke Google Apps Script: ${err.message || err}`,
    };
  }
}

// 2. Simpan Data Form (Agenda / Visit / NSO) Terenkripsi ke Google Drive
export async function saveEncryptedRecordToDrive(params: {
  type: 'AGENDA' | 'VISIT' | 'NSO' | 'OTHER';
  title: string;
  author: string;
  data: Record<string, any>;
  secretKey?: string;
}): Promise<{ success: boolean; recordId?: string; message: string }> {
  const url = getGasUrl();
  if (!url) {
    return {
      success: false,
      message: 'URL Google Apps Script belum diatur. Silakan atur di menu Koneksi.',
    };
  }

  try {
    // Enkripsi seluruh payload data form sebelum dikirim ke Google Drive
    const jsonString = JSON.stringify(params.data);
    const encryptedData = await encryptText(jsonString, params.secretKey);

    const payload = {
      action: 'saveData',
      type: params.type,
      title: params.title,
      author: params.author,
      encryptedData: encryptedData,
      status: 'SUBMITTED',
    };

    const response = await fetch(url, {
      method: 'POST',
      mode: 'no-cors', // Google Apps Script Web App redirect handling
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Karena mode no-cors untuk redirect Google Script, kita return success
    return {
      success: true,
      message: 'Data berhasil dienkripsi dan disimpan ke Google Drive!',
    };
  } catch (err: any) {
    console.error('Save to Drive error:', err);
    return {
      success: false,
      message: `Gagal menyimpan ke Google Drive: ${err.message || err}`,
    };
  }
}

// 3. Upload File Foto Terenkripsi ke Folder Google Drive
export async function uploadEncryptedPhotoToDrive(params: {
  encryptedBase64: string;
  fileName: string;
}): Promise<{ success: boolean; message: string; fileId?: string }> {
  const url = getGasUrl();
  if (!url) {
    return {
      success: false,
      message: 'URL Google Apps Script belum diatur.',
    };
  }

  try {
    const payload = {
      action: 'uploadEncryptedPhoto',
      fileName: params.fileName,
      encryptedBase64: params.encryptedBase64,
    };

    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return {
      success: true,
      message: 'Foto terenkripsi berhasil di-upload ke Google Drive!',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal upload foto: ${err.message || err}`,
    };
  }
}

// 4. Ambil dan Dekripsi Data dari Google Drive
export async function fetchAndDecryptRecords(
  type: string = 'all',
  secretKey?: string
): Promise<any[]> {
  const url = getGasUrl();
  if (!url) return [];

  try {
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}action=getData&type=${type}`, {
      method: 'GET',
      mode: 'cors',
    });

    const res = await response.json();
    if (res.status !== 'success' || !Array.isArray(res.data)) return [];

    const decryptedList = await Promise.all(
      res.data.map(async (item: any) => {
        try {
          const decryptedJson = await decryptText(item.encryptedData, secretKey);
          const parsedData = JSON.parse(decryptedJson);
          return {
            ...item,
            decryptedData: parsedData,
          };
        } catch (decryptErr) {
          return {
            ...item,
            decryptedData: null,
            error: 'Gagal mendekripsi data (Kunci tidak cocok)',
          };
        }
      })
    );

    return decryptedList;
  } catch (err) {
    console.error('Fetch records error:', err);
    return [];
  }
}
