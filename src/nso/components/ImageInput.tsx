'use client';

import { useEffect, useRef, useState } from 'react';
import { uploadMedia, pingUploadServer } from '@nso/lib/remoteStore';

interface ImageInputProps {
  label: string;
  storeId: string;
  multiple?: boolean;
  aspect?: 'portrait' | 'square' | 'original';
  onUploaded: (urls: string[]) => void;
  existingImageUrl?: string;
  editOnly?: boolean;
  highRes?: boolean;
}

interface CropState {
  file: File;
  url: string;
}


function InputGlyph({ type }: { type: 'camera' | 'gallery' | 'crop' }) {
  if (type === 'camera') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M8.6 5.5 10 3.8h4l1.4 1.7H19a2 2 0 0 1 2 2v10.7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2h3.6Zm3.4 11a4.4 4.4 0 1 0 0-8.8 4.4 4.4 0 0 0 0 8.8Zm0-1.8a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2Zm5.3-6.3a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" />
      </svg>
    );
  }
  if (type === 'gallery') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 13.2 4.4-4.4 2.8 2.8 3.4-4.1L19 15.6V6H5v11.2Zm3.2-6.9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 3h2v4h8v2H9v8H7V9H3V7h4V3Zm4 8h2v6h6v2h-8v-8Zm8 8h2v2h-2v-2Zm0-4h2v2h-2v-2Z" fill="currentColor" />
    </svg>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ImageInput({ label, storeId, multiple, aspect = 'portrait', onUploaded, existingImageUrl, editOnly = false, highRes = false }: ImageInputProps) {
  const [queue, setQueue] = useState<File[]>([]);
  const [crop, setCrop] = useState<CropState | null>(null);
  const [zoom, setZoom] = useState(1.08);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 });
  const [uploading, setUploading] = useState(false);
  const [preparingEdit, setPreparingEdit] = useState(false);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);

  function resetCropViewport() {
    setZoom(aspect === 'original' ? 1 : 1.08);
    setOffset({ x: 0, y: 0 });
    setNaturalRatio(null);
  }

  function openCrop(files: File[]) {
    const images = files.filter((file) => file.type.startsWith('image/') || !file.type || file.name.match(/\.(jpg|jpeg|png|heic|heif|webp)$/i));
    if (!images.length) {
      alert(`Format file tidak dikenali. Pastikan Anda memilih gambar. (${files[0]?.name || 'Kosong'})`);
      return;
    }
    const [first, ...rest] = images;
    setQueue(rest);
    setCrop({ file: first, url: URL.createObjectURL(first) });
    resetCropViewport();
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    openCrop(Array.from(files));
  }

  async function editExistingPhoto() {
    if (!existingImageUrl || uploading || preparingEdit) return;
    setPreparingEdit(true);
    try {
      const proxyUrl = '/api/proxy?url=' + encodeURIComponent(existingImageUrl);
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Foto tidak bisa dibuka untuk diedit.');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('File bukan gambar.');
      const extension = blob.type.includes('png') ? 'png' : 'jpg';
      const file = new File([blob], `edit-photo-${Date.now()}.${extension}`, { type: blob.type || 'image/jpeg' });
      setQueue([]);
      setCrop({ file, url: URL.createObjectURL(file) });
      resetCropViewport();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Foto gagal dibuka untuk crop.');
    } finally {
      setPreparingEdit(false);
    }
  }

  function closeCrop() {
    if (crop) URL.revokeObjectURL(crop.url);
    setCrop(null);
    setQueue([]);
    setUploading(false);
    setPreparingEdit(false);
  }

  useEffect(() => () => {
    if (crop) URL.revokeObjectURL(crop.url);
  }, [crop]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !crop) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const step = 0.12;
      const delta = e.deltaY < 0 ? step : -step;
      setZoom((prev) => clamp(Number((prev + delta).toFixed(2)), 1, 3.5));
    };

    frame.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      frame.removeEventListener('wheel', handleWheel);
    };
  }, [crop]);


  function nextInQueue() {
    if (crop) URL.revokeObjectURL(crop.url);
    const [next, ...rest] = queue;
    if (!next) {
      setCrop(null);
      setQueue([]);
      setUploading(false);
      return;
    }
    setQueue(rest);
    setCrop({ file: next, url: URL.createObjectURL(next) });
    resetCropViewport();
    setUploading(false);
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!crop) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setDragStart({ x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y });
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const maxOffset = Math.round(220 * Math.max(1, zoom * 0.9));
    setOffset({
      x: clamp(dragStart.ox + event.clientX - dragStart.x, -maxOffset, maxOffset),
      y: clamp(dragStart.oy + event.clientY - dragStart.y, -maxOffset, maxOffset)
    });
  }

  function stopDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragging) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  }

  function wheelZoom(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const next = zoom + (event.deltaY > 0 ? -0.05 : 0.05);
    setZoom(clamp(next, 1, 3));
  }

  async function cropToBlob() {
    if (!crop) throw new Error('Foto belum dipilih.');
    const currentCrop = crop;
    const image = imageRef.current;
    const frame = frameRef.current;
    if (!image || !frame) throw new Error('Komponen gambar belum siap.');
    if (image.naturalWidth === 0) throw new Error('Gambar gagal dimuat oleh browser. (Mungkin format HEIC tidak didukung, silakan gunakan JPG).');
    let width: number;
    let height: number;
    if (aspect === 'original') {
      // Keep the photo's native aspect ratio (no forced crop). Limit long edge for crisp HD display.
      const maxEdge = highRes ? 2400 : 1800;
      const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
      width = Math.max(1, Math.round(image.naturalWidth * scale));
      height = Math.max(1, Math.round(image.naturalHeight * scale));
    } else {
      const baseWidth = 1080;
      const baseHeight = aspect === 'square' ? 1080 : 1440;
      width = highRes ? Math.round(baseWidth * 1.33) : baseWidth;
      height = highRes ? Math.round(baseHeight * 1.33) : baseHeight;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Gagal memproses gambar (Canvas API tidak didukung).');

    // Fill background with white in case of transparency
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const baseScale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawW = image.naturalWidth * baseScale * zoom;
    const drawH = image.naturalHeight * baseScale * zoom;
    const rect = frame.getBoundingClientRect();
    const dx = (width - drawW) / 2 + offset.x * (width / rect.width);
    const dy = (height - drawH) / 2 + offset.y * (height / rect.height);
    ctx.drawImage(image, dx, dy, drawW, drawH);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', highRes ? 0.92 : 0.88));
    if (!blob) throw new Error('HP Anda kehabisan memori saat mengecilkan foto ini. Cobalah foto yang ukurannya lebih kecil, atau gunakan format JPG.');
    return new File([blob], currentCrop.file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
  }

  async function saveCrop() {
    if (!crop) return;
    setUploading(true);
    try {
      const croppedFile = await cropToBlob();
      const url = await uploadMedia(croppedFile, storeId);
      if (!url || url.length < 10) throw new Error('Data gambar terlalu kecil atau kosong.');
      onUploaded([url]);
      nextInQueue();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Upload foto gagal.');
      setUploading(false);
    }
  }

  const busy = uploading || preparingEdit;

  return (
    <div className={`image-input-modern ${editOnly ? 'image-input-edit-only' : ''}`}>
      {editOnly ? (
        existingImageUrl ? (
          <button className="icon-btn small-icon secondary" type="button" title="Edit Crop Foto" onClick={editExistingPhoto} disabled={busy}>
            <span><InputGlyph type="crop" /></span><b>{preparingEdit ? 'Memuat...' : 'Edit Crop'}</b>
          </button>
        ) : null
      ) : (
        <>
          <div className="image-choice-row">
            <button className="icon-btn small-icon" type="button" title="Open Camera" onClick={() => { pingUploadServer(); cameraRef.current?.click(); }} disabled={busy}><span><InputGlyph type="camera" /></span><b>Camera</b></button>
            <button className="icon-btn small-icon" type="button" title="Upload Gallery" onClick={() => { pingUploadServer(); galleryRef.current?.click(); }} disabled={busy}><span><InputGlyph type="gallery" /></span><b>Gallery</b></button>
            {existingImageUrl ? <button className="icon-btn small-icon secondary" type="button" title="Edit Crop Foto" onClick={editExistingPhoto} disabled={busy}><span><InputGlyph type="crop" /></span><b>{preparingEdit ? 'Memuat...' : 'Edit Crop'}</b></button> : null}
            <span className="image-input-label">{label}</span>
          </div>
          <input ref={cameraRef} hidden type="file" accept="image/jpeg, image/png, image/webp" capture="environment" onChange={(event) => handleFiles(event.target.files)} />
          <input ref={galleryRef} hidden type="file" accept="image/jpeg, image/png, image/webp" multiple={multiple} onChange={(event) => handleFiles(event.target.files)} />
        </>
      )}
      {busy ? <span className="mini-upload-loading"><span className="spinner" /> {uploading ? 'Uploading...' : 'Menyiapkan foto...'}</span> : null}

      {crop ? (
        <div className="modal-backdrop crop-modal-backdrop">
          <div className="modal-card crop-modal-card">
            <div className="section-header compact-header">
              <div>
                <p className="eyebrow">Crop Foto</p>
                <h2>{label}</h2>
              </div>
              <button className="icon-btn" type="button" title="Tutup" onClick={closeCrop}>✕</button>
            </div>
            <div className="crop-frame-wrapper">
              <div
                ref={frameRef}
                className={`crop-frame ${aspect}`}
                style={aspect === 'original' && naturalRatio ? { aspectRatio: String(naturalRatio) } : undefined}
                onPointerDown={startDrag}
                onPointerMove={moveDrag}
                onPointerUp={stopDrag}
                onPointerCancel={stopDrag}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  setZoom((prev) => (prev > 1.8 ? 1.08 : Number((prev + 0.6).toFixed(2))));
                }}
              >
                <img
                  ref={imageRef}
                  src={crop.url}
                  alt="Crop preview"
                  draggable={false}
                  onLoad={(event) => {
                    const img = event.currentTarget;
                    if (img.naturalWidth && img.naturalHeight) setNaturalRatio(img.naturalWidth / img.naturalHeight);
                  }}
                  style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
                />
                <div className="crop-guide">
                  {aspect === 'portrait' ? (
                    <svg className="crop-silhouette" viewBox="0 0 100 133" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', stroke: 'rgba(255,255,255,0.6)', strokeWidth: '1.5', fill: 'none', strokeDasharray: '4 4' }}>
                      {/* Head */}
                      <ellipse cx="50" cy="40" rx="20" ry="26" />
                      {/* Shoulders */}
                      <path d="M 20 133 C 20 90, 80 90, 80 133" />
                    </svg>
                  ) : (
                    <div className="crop-grid" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', border: 'none', backgroundImage: 'linear-gradient(to right, transparent 33.33%, rgba(255,255,255,0.3) 33.33%, rgba(255,255,255,0.3) 33.53%, transparent 33.53%, transparent 66.66%, rgba(255,255,255,0.3) 66.66%, rgba(255,255,255,0.3) 66.86%, transparent 66.86%), linear-gradient(to bottom, transparent 33.33%, rgba(255,255,255,0.3) 33.33%, rgba(255,255,255,0.3) 33.53%, transparent 33.53%, transparent 66.66%, rgba(255,255,255,0.3) 66.66%, rgba(255,255,255,0.3) 66.86%, transparent 66.86%)' }} />
                  )}
                </div>

                {/* Floating zoom toolbar on cursor hover */}
                <div className="crop-floating-zoom" onPointerDown={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="crop-float-btn"
                    title="Perkecil (−)"
                    onClick={() => setZoom((z) => clamp(Number((z - 0.2).toFixed(2)), 1, 3.5))}
                  >
                    −
                  </button>
                  <span className="crop-float-badge" title="Tingkat Zoom">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    className="crop-float-btn"
                    title="Perbesar (+)"
                    onClick={() => setZoom((z) => clamp(Number((z + 0.2).toFixed(2)), 1, 3.5))}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="crop-float-btn reset"
                    title="Reset Zoom & Posisi"
                    onClick={() => { setZoom(1.08); setOffset({ x: 0, y: 0 }); }}
                  >
                    ⟲
                  </button>
                </div>

                <div className="crop-hover-hint">
                  Scroll mouse di foto untuk zoom • Drag untuk geser
                </div>
              </div>
            </div>
            <div className="crop-controls">
              <div className="crop-zoom-header">
                <label>Zoom Foto: <b>{Math.round(zoom * 100)}%</b></label>
                <span className="crop-zoom-hint">Scroll kursor di foto / slider</span>
              </div>
              <input type="range" min="1" max="3.5" step="0.02" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
            </div>
            <div className="actions crop-actions">
              <button className="btn green" type="button" disabled={uploading} onClick={saveCrop}>{uploading ? <span className="spinner" /> : null}{uploading ? 'Uploading...' : 'Simpan Foto'}</button>
              <button className="btn secondary" type="button" disabled={uploading} onClick={closeCrop}>Batal</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

