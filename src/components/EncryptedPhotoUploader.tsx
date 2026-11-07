import React, { useState } from 'react';
import { Camera, Image as ImageIcon, X, Lock, CheckCircle2, RefreshCw } from 'lucide-react';
import { EncryptedPhotoItem } from '../types';
import { compressAndEncryptImage } from '../services/crypto';

interface EncryptedPhotoUploaderProps {
  photos: EncryptedPhotoItem[];
  onChange: (photos: EncryptedPhotoItem[]) => void;
  secretKey?: string;
  maxPhotos?: number;
}

export const EncryptedPhotoUploader: React.FC<EncryptedPhotoUploaderProps> = ({
  photos,
  onChange,
  secretKey,
  maxPhotos = 12,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    const newPhotos: EncryptedPhotoItem[] = [...photos];

    for (let i = 0; i < files.length; i++) {
      if (newPhotos.length >= maxPhotos) break;
      const file = files[i];

      try {
        const result = await compressAndEncryptImage(file, secretKey);
        newPhotos.push({
          id: `photo-${Date.now()}-${i}`,
          name: file.name,
          caption: '',
          category: 'GENERAL',
          originalSizeKB: result.originalSizeKB,
          compressedSizeKB: result.compressedSizeKB,
          previewUrl: result.previewUrl,
          encryptedBase64: result.encryptedBase64,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Error encrypting image:', err);
      }
    }

    onChange(newPhotos);
    setIsProcessing(false);
    // Reset input
    e.target.value = '';
  };

  const handleRemove = (id: string) => {
    onChange(photos.filter((p) => p.id !== id));
  };

  const handleCaptionChange = (id: string, caption: string) => {
    onChange(
      photos.map((p) => (p.id === id ? { ...p, caption } : p))
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs text-slate-700 font-bold flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-teal-600" />
          <span>Upload Foto Dokumentasi ({photos.length}/{maxPhotos})</span>
        </label>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
          <Lock className="w-3 h-3 text-teal-600" />
          <span>Auto AES-256 Encrypted</span>
        </span>
      </div>

      {/* Upload Drop Zone / Button */}
      {photos.length < maxPhotos && (
        <label className="border-2 border-dashed border-teal-200/90 hover:border-teal-400 bg-teal-50/30 hover:bg-teal-50/60 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all group">
          <input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handleFileSelect}
            disabled={isProcessing}
            className="hidden"
          />
          {isProcessing ? (
            <div className="flex items-center gap-2 text-teal-700 text-xs font-bold py-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Mengompresi & mengenkripsi foto...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-white shadow-soft-sm flex items-center justify-center text-teal-600 group-hover:scale-105 transition-transform mb-2">
                <Camera className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-xs font-bold text-slate-700">
                Ambil Foto Kamera / Pilih Galeri
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Foto akan otomatis dikompresi & dienkripsi sebelum ke Google Drive
              </span>
            </div>
          )}
        </label>
      )}

      {/* Photo Gallery Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
          {photos.map((item) => (
            <div
              key={item.id}
              className="group relative bg-white rounded-2xl p-2 border border-slate-200/80 shadow-soft-sm flex flex-col justify-between"
            >
              {/* Image Thumbnail */}
              <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-100">
                <img
                  src={item.previewUrl}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                {/* Encrypted indicator pill */}
                <div className="absolute bottom-1 left-1 bg-black/70 backdrop-blur-sm text-white px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5 text-teal-400" />
                  <span>AES-256</span>
                </div>
              </div>

              {/* Compression stats */}
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span>{item.compressedSizeKB} KB</span>
                <span className="text-teal-600 font-bold">
                  Hemat {Math.round((1 - item.compressedSizeKB / item.originalSizeKB) * 100)}%
                </span>
              </div>

              {/* Caption Input */}
              <input
                type="text"
                placeholder="Tambah keterangan foto..."
                value={item.caption || ''}
                onChange={(e) => handleCaptionChange(item.id, e.target.value)}
                className="mt-1.5 w-full text-[11px] font-medium bg-[#F8FAFC] border border-slate-200/60 rounded-lg px-2 py-1 outline-none focus:border-teal-500"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
