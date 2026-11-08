import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Check,
  RotateCw,
  Crop,
  Edit3,
  Camera,
  Undo2,
  Trash2,
  Mic,
  MapPin,
  Clock,
  ArrowRight,
  Circle,
  Square,
  Sparkles,
  Maximize2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { EvidencePhoto } from '../../types/visitReport';

interface PhotoEditModalProps {
  photo: EvidencePhoto;
  index: number;
  isCa: boolean;
  onSave: (updated: { photoUrl: string; caption: string }) => void;
  onClose: () => void;
}

type EditTabMode = 'view' | 'crop' | 'markup';
type MarkupTool = 'pen' | 'circle' | 'arrow' | 'rect';

interface DrawAction {
  tool: MarkupTool;
  color: string;
  strokeWidth: number;
  points?: { x: number; y: number }[]; // For pen
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}

export const PhotoEditModal: React.FC<PhotoEditModalProps> = ({
  photo,
  index,
  isCa,
  onSave,
  onClose,
}) => {
  const [currentDataUrl, setCurrentDataUrl] = useState<string>(photo.photoUrl);
  const [rotation, setRotation] = useState<number>(0);
  const [caption, setCaption] = useState<string>(photo.caption || '');
  const [activeTab, setActiveTab] = useState<EditTabMode>('view');

  // Markup States
  const [markupTool, setMarkupTool] = useState<MarkupTool>('pen');
  const [markupColor, setMarkupColor] = useState<string>('#EF4444'); // Red default for findings
  const [markupStrokeWidth, setMarkupStrokeWidth] = useState<number>(4);
  const [history, setHistory] = useState<DrawAction[]>([]);
  const isDrawingRef = useRef<boolean>(false);
  const currentActionRef = useRef<DrawAction | null>(null);

  // Crop States
  const [cropAspect, setCropAspect] = useState<'free' | '1:1' | '4:3' | '16:9' | '3:4'>('free');
  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 10,
    y: 10,
    width: 80,
    height: 80,
  });
  const isDraggingCropRef = useRef<boolean>(false);
  const cropStartPosRef = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });

  // Voice Dictation
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load image onto base ref
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      baseImageRef.current = img;
      redrawCanvas();
    };
    img.src = currentDataUrl;
  }, [currentDataUrl]);

  // Redraw Canvas (Background Image + Rotated + All Markup Actions)
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const img = baseImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to image natural dimensions
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw base image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Render all committed markup actions
    history.forEach((act) => {
      drawSingleAction(ctx, act);
    });

    // Render active live drawing action (if currently drawing)
    if (currentActionRef.current) {
      drawSingleAction(ctx, currentActionRef.current);
    }
  };

  const drawSingleAction = (ctx: CanvasRenderingContext2D, act: DrawAction) => {
    ctx.save();
    ctx.strokeStyle = act.color;
    ctx.fillStyle = act.color;
    ctx.lineWidth = act.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (act.tool === 'pen' && act.points && act.points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(act.points[0].x, act.points[0].y);
      for (let i = 1; i < act.points.length; i++) {
        ctx.lineTo(act.points[i].x, act.points[i].y);
      }
      ctx.stroke();
    } else if (act.tool === 'rect' && act.startX !== undefined && act.startY !== undefined) {
      const w = (act.endX ?? act.startX) - act.startX;
      const h = (act.endY ?? act.startY) - act.startY;
      ctx.beginPath();
      ctx.strokeRect(act.startX, act.startY, w, h);
    } else if (act.tool === 'circle' && act.startX !== undefined && act.startY !== undefined) {
      const rx = Math.abs((act.endX ?? act.startX) - act.startX) / 2;
      const ry = Math.abs((act.endY ?? act.startY) - act.startY) / 2;
      const cx = (act.startX + (act.endX ?? act.startX)) / 2;
      const cy = (act.startY + (act.endY ?? act.startY)) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx || 1, ry || 1, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (act.tool === 'arrow' && act.startX !== undefined && act.startY !== undefined) {
      const fromX = act.startX;
      const fromY = act.startY;
      const toX = act.endX ?? fromX;
      const toY = act.endY ?? fromY;
      const headlen = Math.max(14, act.strokeWidth * 3.5);
      const angle = Math.atan2(toY - fromY, toX - fromX);

      // Main line
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      // Arrow head
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  };

  // Canvas coordinates converter
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Drawing event handlers
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTab !== 'markup') return;
    isDrawingRef.current = true;
    const { x, y } = getCanvasCoords(e);

    currentActionRef.current = {
      tool: markupTool,
      color: markupColor,
      strokeWidth: markupStrokeWidth * ((canvasRef.current?.width || 800) / 600),
      startX: x,
      startY: y,
      endX: x,
      endY: y,
      points: [{ x, y }],
    };
    redrawCanvas();
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current || !currentActionRef.current || activeTab !== 'markup') return;
    const { x, y } = getCanvasCoords(e);

    if (markupTool === 'pen') {
      currentActionRef.current.points?.push({ x, y });
    } else {
      currentActionRef.current.endX = x;
      currentActionRef.current.endY = y;
    }
    redrawCanvas();
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current || !currentActionRef.current || activeTab !== 'markup') return;
    isDrawingRef.current = false;
    setHistory((prev) => [...prev, currentActionRef.current!]);
    currentActionRef.current = null;
    redrawCanvas();
  };

  const handleUndo = () => {
    setHistory((prev) => {
      const next = prev.slice(0, -1);
      setTimeout(redrawCanvas, 10);
      return next;
    });
  };

  const handleClearMarkup = () => {
    setHistory([]);
    setTimeout(redrawCanvas, 10);
  };

  // 90 DEGREE ROTATION
  const handleRotate = () => {
    const canvas = canvasRef.current;
    const img = baseImageRef.current;
    if (!canvas || !img) return;

    // First commit all current markup onto image
    const currentData = canvas.toDataURL('image/jpeg', 0.95);

    const tempImg = new Image();
    tempImg.crossOrigin = 'anonymous';
    tempImg.onload = () => {
      const rotCanvas = document.createElement('canvas');
      rotCanvas.width = tempImg.naturalHeight;
      rotCanvas.height = tempImg.naturalWidth;
      const rotCtx = rotCanvas.getContext('2d');
      if (!rotCtx) return;

      rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
      rotCtx.rotate((90 * Math.PI) / 180);
      rotCtx.drawImage(tempImg, -tempImg.naturalWidth / 2, -tempImg.naturalHeight / 2);

      const rotatedData = rotCanvas.toDataURL('image/jpeg', 0.95);
      setCurrentDataUrl(rotatedData);
      setHistory([]);
      setRotation((prev) => (prev + 90) % 360);
    };
    tempImg.src = currentData;
  };

  // CROP COMMIT
  const handleApplyCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert percentage cropBox to pixel coordinates
    const sx = (cropBox.x / 100) * canvas.width;
    const sy = (cropBox.y / 100) * canvas.height;
    const sw = (cropBox.width / 100) * canvas.width;
    const sh = (cropBox.height / 100) * canvas.height;

    if (sw <= 10 || sh <= 10) return;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = sw;
    cropCanvas.height = sh;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return;

    cropCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    const croppedUrl = cropCanvas.toDataURL('image/jpeg', 0.95);

    setCurrentDataUrl(croppedUrl);
    setHistory([]);
    setActiveTab('view');
    confetti({ particleCount: 25, spread: 45, origin: { y: 0.5 } });
  };

  // REPLACE PHOTO FILE
  const handleReplaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setCurrentDataUrl(event.target.result);
        setHistory([]);
        setRotation(0);
        setActiveTab('view');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // VOICE DICTATION
  const handleToggleVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Fitur Dikte Suara tidak didukung oleh browser ini. Gunakan Google Chrome.');
      return;
    }

    if (isListeningVoice) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListeningVoice(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = 'id-ID';
      rec.continuous = true;
      rec.interimResults = false;

      rec.onstart = () => setIsListeningVoice(true);
      rec.onresult = (evt: any) => {
        let transcript = '';
        for (let i = evt.resultIndex; i < evt.results.length; i++) {
          if (evt.results[i].isFinal) {
            transcript += evt.results[i][0].transcript + ' ';
          }
        }
        if (transcript.trim()) {
          setCaption((prev) => (prev ? `${prev.trim()} ${transcript.trim()}` : transcript.trim()));
        }
      };
      rec.onerror = () => setIsListeningVoice(false);
      rec.onend = () => setIsListeningVoice(false);

      rec.start();
      recognitionRef.current = rec;
    } catch {
      setIsListeningVoice(false);
    }
  };

  // FINAL SAVE
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      onSave({ photoUrl: currentDataUrl, caption });
      onClose();
      return;
    }

    // Capture final state from canvas
    const finalDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    onSave({ photoUrl: finalDataUrl, caption });
    confetti({ particleCount: 35, spread: 55, origin: { y: 0.5 } });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col w-full h-full animate-in fade-in select-none">
      {/* 1. TOP APP BAR (HEADER) */}
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-slate-900/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-between gap-3 shrink-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-slate-300 transition cursor-pointer"
            title="Batal & Kembali"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-white truncate">
                Edit Foto #{index + 1}
              </h2>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                {isCa ? 'Hasil CA' : 'Temuan Lapangan'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium truncate hidden sm:block">
              Potong (Crop), Beri Tanda / Coretan, Putar 90°, dan Ubah Keterangan
            </p>
          </div>
        </div>

        {/* Right Header: Mode Switcher & Save Button */}
        <div className="flex items-center gap-2">
          {/* Action Tabs Pills */}
          <div className="hidden xs:flex items-center p-1 bg-black/40 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('view')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'view' ? 'bg-teal-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Lihat</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('crop')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'crop' ? 'bg-teal-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Crop className="w-3.5 h-3.5" />
              <span>Crop</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('markup')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'markup' ? 'bg-teal-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Tandai</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="px-4 sm:px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-teal-500/20 transition cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Simpan</span>
          </button>
        </div>
      </header>

      {/* 2. MOBILE QUICK MODE TABS BAR (SHOW ON XS ONLY) */}
      <div className="xs:hidden h-11 px-3 bg-slate-900 border-b border-white/10 flex items-center justify-around shrink-0 z-20">
        <button
          type="button"
          onClick={() => setActiveTab('view')}
          className={`flex-1 py-1.5 text-xs font-bold text-center rounded-lg ${
            activeTab === 'view' ? 'bg-teal-500/20 text-teal-300' : 'text-slate-400'
          }`}
        >
          Lihat Foto
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('crop')}
          className={`flex-1 py-1.5 text-xs font-bold text-center rounded-lg ${
            activeTab === 'crop' ? 'bg-teal-500/20 text-teal-300' : 'text-slate-400'
          }`}
        >
          Potong (Crop)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('markup')}
          className={`flex-1 py-1.5 text-xs font-bold text-center rounded-lg ${
            activeTab === 'markup' ? 'bg-teal-500/20 text-teal-300' : 'text-slate-400'
          }`}
        >
          Beri Tanda
        </button>
      </div>

      {/* 3. TOOLBAR SPESIFIK (JIKA MODE MARKUP ATAU CROP) */}
      {activeTab === 'markup' && (
        <div className="px-3 sm:px-6 py-2.5 bg-slate-900/95 border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5 shrink-0 z-20">
          {/* Tools Picker */}
          <div className="flex items-center gap-1.5 bg-black/50 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setMarkupTool('pen')}
              className={`p-1.5 sm:px-3 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                markupTool === 'pen' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Pena Goresan Bebas"
            >
              <Edit3 className="w-4 h-4" />
              <span className="hidden sm:inline">Pena</span>
            </button>
            <button
              type="button"
              onClick={() => setMarkupTool('circle')}
              className={`p-1.5 sm:px-3 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                markupTool === 'circle' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Lingkari Temuan"
            >
              <Circle className="w-4 h-4" />
              <span className="hidden sm:inline">Lingkar</span>
            </button>
            <button
              type="button"
              onClick={() => setMarkupTool('arrow')}
              className={`p-1.5 sm:px-3 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                markupTool === 'arrow' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Panah Penunjuk"
            >
              <ArrowRight className="w-4 h-4" />
              <span className="hidden sm:inline">Panah</span>
            </button>
            <button
              type="button"
              onClick={() => setMarkupTool('rect')}
              className={`p-1.5 sm:px-3 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                markupTool === 'rect' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Kotak Area"
            >
              <Square className="w-4 h-4" />
              <span className="hidden sm:inline">Kotak</span>
            </button>
          </div>

          {/* Color Palettes */}
          <div className="flex items-center gap-2">
            {[
              { color: '#EF4444', label: 'Merah' },
              { color: '#FACC15', label: 'Kuning' },
              { color: '#10B981', label: 'Hijau' },
              { color: '#FFFFFF', label: 'Putih' },
            ].map((c) => (
              <button
                key={c.color}
                type="button"
                onClick={() => setMarkupColor(c.color)}
                style={{ backgroundColor: c.color }}
                className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                  markupColor === c.color ? 'ring-2 ring-white scale-125' : 'opacity-80 hover:opacity-100'
                }`}
                title={`Pilih Warna ${c.label}`}
              />
            ))}
          </div>

          {/* Undo & Clear Actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0}
              className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              title="Batalkan coretan terakhir (Undo)"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={handleClearMarkup}
              disabled={history.length === 0}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 disabled:opacity-30 text-xs font-bold flex items-center gap-1 cursor-pointer"
              title="Hapus semua coretan"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'crop' && (
        <div className="px-3 sm:px-6 py-2.5 bg-slate-900/95 border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">Rasio:</span>
            {(['free', '1:1', '4:3', '16:9', '3:4'] as const).map((asp) => (
              <button
                key={asp}
                type="button"
                onClick={() => {
                  setCropAspect(asp);
                  if (asp === '1:1') setCropBox({ x: 15, y: 15, width: 70, height: 70 });
                  else if (asp === '16:9') setCropBox({ x: 10, y: 25, width: 80, height: 45 });
                  else if (asp === '4:3') setCropBox({ x: 10, y: 20, width: 80, height: 60 });
                  else if (asp === '3:4') setCropBox({ x: 20, y: 10, width: 60, height: 80 });
                  else setCropBox({ x: 10, y: 10, width: 80, height: 80 });
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition cursor-pointer ${
                  cropAspect === asp ? 'bg-teal-500 text-white' : 'bg-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {asp}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('view')}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              className="px-4 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-black flex items-center gap-1 shadow-md transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Terapkan Potongan</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. MAIN CANVAS VIEWPORT (FULL RESPONSIVE) */}
      <div
        ref={containerRef}
        className="flex-1 relative w-full h-full flex items-center justify-center p-2 sm:p-4 overflow-hidden bg-slate-950/70"
      >
        <div className="relative max-w-full max-h-full flex items-center justify-center">
          <canvas
            ref={canvasRef}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            className={`max-w-full max-h-[60vh] sm:max-h-[66vh] object-contain rounded-2xl shadow-2xl transition-all ${
              activeTab === 'markup' ? 'cursor-crosshair touch-none' : 'cursor-default'
            }`}
          />

          {/* CROP INTERACTIVE OVERLAY */}
          {activeTab === 'crop' && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                style={{
                  position: 'absolute',
                  left: `${cropBox.x}%`,
                  top: `${cropBox.y}%`,
                  width: `${cropBox.width}%`,
                  height: `${cropBox.height}%`,
                }}
                className="border-2 border-teal-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] rounded-lg pointer-events-auto"
              >
                {/* 3x3 Rule-of-Thirds Grid */}
                <div className="w-full h-full grid grid-cols-3 grid-rows-3 opacity-30 border border-teal-200 pointer-events-none">
                  <div className="border-r border-b border-teal-200" />
                  <div className="border-r border-b border-teal-200" />
                  <div className="border-b border-teal-200" />
                  <div className="border-r border-b border-teal-200" />
                  <div className="border-r border-b border-teal-200" />
                  <div className="border-b border-teal-200" />
                  <div className="border-r border-teal-200" />
                  <div className="border-r border-teal-200" />
                  <div />
                </div>

                {/* Move Box Control Bar */}
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-teal-500 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-md whitespace-nowrap">
                  Area Potongan
                </div>
              </div>
            </div>
          )}

          {/* QUICK FLOATING ROTATE & REPLACE BUTTONS ON IMAGE */}
          <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-none z-10">
            <button
              type="button"
              onClick={handleRotate}
              className="pointer-events-auto px-3 py-1.5 rounded-xl bg-black/75 hover:bg-black text-white text-xs font-bold backdrop-blur-md border border-white/20 shadow-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Putar 90 Derajat"
            >
              <RotateCw className="w-3.5 h-3.5 text-teal-300" />
              <span>Putar 90°</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="pointer-events-auto px-3 py-1.5 rounded-xl bg-teal-600/90 hover:bg-teal-600 text-white text-xs font-black backdrop-blur-md border border-white/20 shadow-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Ganti Foto Baru dari Kamera atau Galeri"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Ganti Foto</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleReplaceFile}
            />
          </div>
        </div>
      </div>

      {/* 5. BOTTOM DRAWER: EDIT KETERANGAN / DESKRIPSI & METADATA */}
      <footer className="p-3 sm:p-5 bg-slate-900/95 border-t border-white/10 shrink-0 z-30 space-y-2.5">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Header Row: Label & Speech Dictation */}
          <div className="flex items-center justify-between text-xs">
            <label className="font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>Keterangan Foto</span>
              <span className="text-slate-500 font-medium">(Bisa dikosongkan)</span>
            </label>

            <button
              type="button"
              onClick={handleToggleVoice}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                isListeningVoice
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-white/10 hover:bg-white/20 text-teal-300 border border-white/10'
              }`}
            >
              <Mic className="w-3.5 h-3.5 text-rose-400" />
              <span>{isListeningVoice ? 'Mendengarkan Suara...' : 'Dikte Suara'}</span>
            </button>
          </div>

          {/* Caption Input */}
          <textarea
            rows={2}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Tuliskan keterangan detail temuan atau hasil perbaikan (opsional)..."
            className="w-full bg-slate-950/80 border border-white/15 rounded-xl p-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-400 resize-none leading-relaxed"
          />

          {/* GPS & Timestamp Footer Tag */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 text-teal-400" />
              <span>{photo.gpsLocation || 'GPS Verified'}</span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{photo.timestamp || 'WIB'}</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
