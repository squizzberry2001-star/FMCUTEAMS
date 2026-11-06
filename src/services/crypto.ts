/**
 * ====================================================================
 * FMCU TEAMS - Client-Side AES-256-GCM Zero-Knowledge Encryption
 * Menggunakan Web Crypto API Native (Aman, Cepat, Tanpa Dependency Berat)
 * ====================================================================
 */

// Default fallback key (bisa di-custom oleh user di UI atau .env)
export const DEFAULT_SECRET_KEY = "FMCU-SECRET-KEY-2026-TEAMS-SECURITY";

// Helper: Ubah string password jadi Cryptographic Key AES-GCM
async function getKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('FMCU_SALT_SALT_12345'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// 1. Enkripsi Text / JSON
export async function encryptText(plainText: string, secretKey = DEFAULT_SECRET_KEY): Promise<string> {
  const key = await getKey(secretKey);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(plainText);

  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData
  );

  // Gabungkan IV + Encrypted Data ke dalam format Base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

// 2. Dekripsi Text / JSON
export async function decryptText(cipherTextBase64: string, secretKey = DEFAULT_SECRET_KEY): Promise<string> {
  try {
    const key = await getKey(secretKey);
    const combinedStr = atob(cipherTextBase64);
    const combined = new Uint8Array(combinedStr.length);
    for (let i = 0; i < combinedStr.length; i++) {
      combined[i] = combinedStr.charCodeAt(i);
    }

    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('Decryption failed:', err);
    throw new Error('Gagal mendekripsi data. Kunci enkripsi salah atau data rusak.');
  }
}

// 3. Kompresi Gambar Otomatis & Enkripsi AES-256
export async function compressAndEncryptImage(
  file: File,
  secretKey = DEFAULT_SECRET_KEY,
  maxWidth = 1600,
  quality = 0.82
): Promise<{
  encryptedBase64: string;
  originalSizeKB: number;
  compressedSizeKB: number;
  fileName: string;
  previewUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = async () => {
        // Hitung skala kompresi
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Canvas context unavailable');

        ctx.drawImage(img, 0, 0, width, height);

        // Ekstrak sebagai compressed JPEG data URL
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        const originalSizeKB = Math.round(file.size / 1024);
        const compressedSizeKB = Math.round((compressedDataUrl.length * 3) / 4 / 1024);

        // Enkripsi string data URL gambar tersebut
        const encryptedBase64 = await encryptText(compressedDataUrl, secretKey);

        resolve({
          encryptedBase64,
          originalSizeKB,
          compressedSizeKB,
          fileName: file.name,
          previewUrl: compressedDataUrl, // untuk preview lokal langsung
        });
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
}

// 4. Dekripsi Foto Terenkripsi Menjadi Image Data URL untuk Tampilan Web
export async function decryptImage(
  encryptedBase64: string,
  secretKey = DEFAULT_SECRET_KEY
): Promise<string> {
  return await decryptText(encryptedBase64, secretKey);
}
