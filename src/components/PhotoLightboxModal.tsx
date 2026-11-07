import React from 'react';
import { X, Lock, Download, ShieldCheck } from 'lucide-react';
import { EncryptedPhotoItem } from '../types';

interface PhotoLightboxModalProps {
  photo: EncryptedPhotoItem | null;
  onClose: () => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({ photo, onClose }) => {
  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors z-20"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="max-w-4xl w-full flex flex-col items-center">
        {/* Full Image */}
        <div className="relative rounded-2xl overflow-hidden max-h-[75vh] shadow-2xl bg-black/40">
          <img
            src={photo.previewUrl}
            alt={photo.name}
            className="w-full h-full max-h-[75vh] object-contain"
          />
        </div>

        {/* Image Metadata Bar */}
        <div className="mt-4 w-full bg-white/10 backdrop-blur-md rounded-2xl p-4 text-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{photo.name}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-teal-500/30 text-teal-300 border border-teal-400/40 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3" />
                <span>AES-256 Decrypted in Browser</span>
              </span>
            </div>
            {photo.caption && (
              <p className="text-xs text-slate-300 mt-1">{photo.caption}</p>
            )}
            <p className="text-[10px] text-slate-400 mt-0.5">
              Ukuran kompresi: {photo.compressedSizeKB} KB (Asli: {photo.originalSizeKB} KB)
            </p>
          </div>

          <a
            href={photo.previewUrl}
            download={photo.name}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Download Asli</span>
          </a>
        </div>
      </div>
    </div>
  );
};
