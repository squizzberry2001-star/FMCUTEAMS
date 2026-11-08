import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Check,
  RotateCw,
  Crop,
  Edit3,
  Camera,
  Undo2,
  Trash2,
  ArrowRight,
  Circle,
  Square,
  Maximize2,
  Move,
  RefreshCw
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
type CropAspect = 'free' | '1:1' | '4:3' | '16:9' | '3:4';
type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | null;

interface DrawAction {
  tool: MarkupTool;
  color: string;
  strokeWidth: number;
  points?: { x: number; y: number }[];
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}

interface CropBox {
  x: number;      // 0 to 100 percentage
  y: number;      // 0 to 100 percentage
  width: number;  // 0 to 100 percentage
  height: number; // 0 to 100 percentage
}

export const PhotoEditModal: React.FC<PhotoEditModalProps> = ({
  photo,
  index,
  isCa,
  onSave,
  onClose,
}) => {
  // SAAT USER MASUK KE FITUR EDIT: Gunakan foto bersih raw tanpa watermark
  const initialPhotoUrl = photo.rawPhotoUrl || photo.photoUrl;
  const [currentDataUrl, setCurrentDataUrl] = useState<string>(initialPhotoUrl);
  const [activeTab, setActiveTab] = useState<EditTabMode>('view');

  // Markup States
  const [markupTool, setMarkupTool] = useState<MarkupTool>('pen');
  const [markupColor, setMarkupColor] = useState<string>('#EF4444');
  const [markupStrokeWidth, setMarkupStrokeWidth] = useState<number>(4);
  const [history, setHistory] = useState<DrawAction[]>([]);
  const isDrawingRef = useRef<boolean>(false);
  const currentActionRef = useRef<DrawAction | null>(null);

  // Crop States
  const [cropAspect, setCropAspect] = useState<CropAspect>('free');
  const [cropBox, setCropBox] = useState<CropBox>({
    x: 5,
    y: 5,
    width: 90,
    height: 90,
  });
  const cropDragRef = useRef<{
    mode: DragMode;
    pointerId: number;
    startX: number;
    startY: number;
    initialBox: CropBox;
    stageWidth: number;
    stageHeight: number;
  } | null>(null);

  // DOM Refs
  const imgRef = useRef<HTMLImageElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ==========================================================================
  // 1. SYNC CANVAS SIZE DENGAN NATURAL SIZE IMAGE SAAT LOAD
  // ==========================================================================
  const handleImageLoaded = () => {
    try {
      const img = imgRef.current;
      const canvas = drawCanvasRef.current;
      if (!img || !canvas) return;

      const naturalW = img.naturalWidth || 1200;
      const naturalH = img.naturalHeight || 900;

      canvas.width = naturalW;
      canvas.height = naturalH;
      redrawDrawCanvas();
    } catch (err) {
      console.warn('handleImageLoaded error:', err);
    }
  };

  // ==========================================================================
  // 2. REDRAW DRAWING OVERLAY (TRANSPARENT LAYER - ZERO BLANK RISK)
  // ==========================================================================
  const drawSingleAction = (ctx: CanvasRenderingContext2D, act: DrawAction) => {
    if (!ctx || !act) return;
    try {
      ctx.save();
      ctx.strokeStyle = act.color || '#EF4444';
      ctx.fillStyle = act.color || '#EF4444';
      ctx.lineWidth = Number.isFinite(act.strokeWidth) && act.strokeWidth > 0 ? act.strokeWidth : 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (act.tool === 'pen' && act.points && act.points.length > 0) {
        if (act.points.length === 1) {
          const pt = act.points[0];
          if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, Math.max(1, (act.strokeWidth || 4) / 2), 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          ctx.beginPath();
          let started = false;
          for (let i = 0; i < act.points.length; i++) {
            const pt = act.points[i];
            if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
              if (!started) {
                ctx.moveTo(pt.x, pt.y);
                started = true;
              } else {
                ctx.lineTo(pt.x, pt.y);
              }
            }
          }
          if (started) {
            ctx.stroke();
          }
        }
      } else if (act.tool === 'rect') {
        const sX = Number(act.startX);
        const sY = Number(act.startY);
        const eX = Number(act.endX ?? sX);
        const eY = Number(act.endY ?? sY);
        if (Number.isFinite(sX) && Number.isFinite(sY) && Number.isFinite(eX) && Number.isFinite(eY)) {
          const w = eX - sX;
          const h = eY - sY;
          ctx.beginPath();
          ctx.strokeRect(sX, sY, w, h);
        }
      } else if (act.tool === 'circle') {
        const sX = Number(act.startX);
        const sY = Number(act.startY);
        const eX = Number(act.endX ?? sX);
        const eY = Number(act.endY ?? sY);
        if (Number.isFinite(sX) && Number.isFinite(sY) && Number.isFinite(eX) && Number.isFinite(eY)) {
          const rx = Math.max(Math.abs(eX - sX) / 2, 1);
          const ry = Math.max(Math.abs(eY - sY) / 2, 1);
          const cx = (sX + eX) / 2;
          const cy = (sY + eY) / 2;
          ctx.beginPath();
          if (typeof (ctx as any).ellipse === 'function') {
            try {
              (ctx as any).ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            } catch {
              const avgR = (rx + ry) / 2;
              ctx.arc(cx, cy, avgR, 0, Math.PI * 2);
            }
          } else {
            const avgR = (rx + ry) / 2;
            ctx.arc(cx, cy, avgR, 0, Math.PI * 2);
          }
          ctx.stroke();
        }
      } else if (act.tool === 'arrow') {
        const fromX = Number(act.startX);
        const fromY = Number(act.startY);
        const toX = Number(act.endX ?? fromX);
        const toY = Number(act.endY ?? fromY);
        if (Number.isFinite(fromX) && Number.isFinite(fromY) && Number.isFinite(toX) && Number.isFinite(toY)) {
          const dx = toX - fromX;
          const dy = toY - fromY;
          const dist = Math.hypot(dx, dy);

          // Line
          ctx.beginPath();
          ctx.moveTo(fromX, fromY);
          ctx.lineTo(toX, toY);
          ctx.stroke();

          // Arrowhead
          if (dist > 3) {
            const angle = Math.atan2(dy, dx);
            const headlen = Math.min(Math.max(16, (act.strokeWidth || 4) * 3), Math.max(dist * 0.75, 10));
            ctx.beginPath();
            ctx.moveTo(toX, toY);
            ctx.lineTo(
              toX - headlen * Math.cos(angle - Math.PI / 6),
              toY - headlen * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
              toX - headlen * Math.cos(angle + Math.PI / 6),
              toY - headlen * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
          }
        }
      }
      ctx.restore();
    } catch (err) {
      console.warn('drawSingleAction error handled safely:', err);
      try {
        ctx.restore();
      } catch {}
    }
  };

  const redrawDrawCanvas = useCallback(() => {
    try {
      const canvas = drawCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (Array.isArray(history)) {
        history.forEach((act) => {
          if (act) drawSingleAction(ctx, act);
        });
      }

      if (currentActionRef.current) {
        drawSingleAction(ctx, currentActionRef.current);
      }
    } catch (err) {
      console.warn('redrawDrawCanvas error safely handled:', err);
    }
  }, [history]);

  useEffect(() => {
    redrawDrawCanvas();
  }, [history, redrawDrawCanvas]);

  // Sync canvas dimensions instantly on mount, data URL change, or active tab switch
  useEffect(() => {
    try {
      const img = imgRef.current;
      const canvas = drawCanvasRef.current;
      if (!img || !canvas) return;

      if (img.complete && img.naturalWidth && img.naturalHeight) {
        if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          redrawDrawCanvas();
        }
      }
    } catch (err) {
      console.warn('Sync canvas dimensions error:', err);
    }
  }, [currentDataUrl, activeTab, redrawDrawCanvas]);

  // Coordinates converter from pointer position
  const getCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return {
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
    };
  };

  // Drawing Pointer Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTab !== 'markup') return;
    try {
      e.preventDefault();
      e.stopPropagation();

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}

      const { x, y } = getCanvasCoords(e.clientX, e.clientY);
      isDrawingRef.current = true;

      const baseWidth = drawCanvasRef.current?.width || 1200;
      const scaledStroke = Math.max(2, Math.round(markupStrokeWidth * (baseWidth / 650)));

      currentActionRef.current = {
        tool: markupTool,
        color: markupColor,
        strokeWidth: scaledStroke,
        startX: x,
        startY: y,
        endX: x,
        endY: y,
        points: [{ x, y }],
      };

      redrawDrawCanvas();
    } catch (err) {
      console.warn('handlePointerDown error handled safely:', err);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentActionRef.current || activeTab !== 'markup') return;
    try {
      e.preventDefault();
      const { x, y } = getCanvasCoords(e.clientX, e.clientY);

      if (markupTool === 'pen') {
        if (!currentActionRef.current.points) {
          currentActionRef.current.points = [];
        }
        currentActionRef.current.points.push({ x, y });
      } else {
        currentActionRef.current.endX = x;
        currentActionRef.current.endY = y;
      }

      redrawDrawCanvas();
    } catch (err) {
      console.warn('handlePointerMove error handled safely:', err);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || activeTab !== 'markup') return;
    try {
      e.preventDefault();

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}

      isDrawingRef.current = false;
      if (currentActionRef.current) {
        const finishedAction = { ...currentActionRef.current };
        currentActionRef.current = null;
        setHistory((prev) => [...prev, finishedAction]);
      }
      redrawDrawCanvas();
    } catch (err) {
      console.warn('handlePointerUp error handled safely:', err);
    }
  };

  const handleUndo = () => {
    try {
      setHistory((prev) => prev.slice(0, -1));
    } catch {}
  };

  const handleClearMarkup = () => {
    try {
      setHistory([]);
    } catch {}
  };

  // ==========================================================================
  // 3. BAKE DRAWING ONTO IMAGE
  // ==========================================================================
  const commitDrawingToBase = (): string => {
    try {
      const img = imgRef.current;
      const drawCanvas = drawCanvasRef.current;
      if (!img || !drawCanvas || history.length === 0) return currentDataUrl;

      const mergeCanvas = document.createElement('canvas');
      mergeCanvas.width = img.naturalWidth || 1200;
      mergeCanvas.height = img.naturalHeight || 900;
      const mCtx = mergeCanvas.getContext('2d');
      if (!mCtx) return currentDataUrl;

      mCtx.drawImage(img, 0, 0, mergeCanvas.width, mergeCanvas.height);
      mCtx.drawImage(drawCanvas, 0, 0, mergeCanvas.width, mergeCanvas.height);

      const mergedUrl = mergeCanvas.toDataURL('image/jpeg', 0.95);
      setCurrentDataUrl(mergedUrl);
      setHistory([]);
      return mergedUrl;
    } catch (err) {
      console.warn('commitDrawingToBase fallback:', err);
      return currentDataUrl;
    }
  };

  const handleSwitchTab = (tab: EditTabMode) => {
    if (tab === activeTab) return;
    if (activeTab === 'markup' && history.length > 0) {
      commitDrawingToBase();
    }
    setActiveTab(tab);
  };

  // ==========================================================================
  // 4. CROP INTERACTION ENGINE
  // ==========================================================================
  const startCropDrag = (e: React.PointerEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const stage = stageRef.current;
    const stageWidth = stage?.clientWidth || 300;
    const stageHeight = stage?.clientHeight || 200;

    cropDragRef.current = {
      mode,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initialBox: { ...cropBox },
      stageWidth,
      stageHeight,
    };
  };

  const handleCropPointerMove = (e: React.PointerEvent) => {
    if (!cropDragRef.current) return;
    e.preventDefault();

    const { mode, startX, startY, initialBox, stageWidth, stageHeight } = cropDragRef.current;
    if (!mode || stageWidth <= 0 || stageHeight <= 0) return;

    const dxPercent = ((e.clientX - startX) / stageWidth) * 100;
    const dyPercent = ((e.clientY - startY) / stageHeight) * 100;

    const MIN_SIZE = 12;

    if (mode === 'move') {
      const newX = Math.min(Math.max(0, initialBox.x + dxPercent), 100 - initialBox.width);
      const newY = Math.min(Math.max(0, initialBox.y + dyPercent), 100 - initialBox.height);
      setCropBox({
        ...initialBox,
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
      });
      return;
    }

    let newX = initialBox.x;
    let newY = initialBox.y;
    let newW = initialBox.width;
    let newH = initialBox.height;

    if (mode.includes('w')) {
      newX = Math.min(Math.max(0, initialBox.x + dxPercent), initialBox.x + initialBox.width - MIN_SIZE);
      newW = initialBox.width - (newX - initialBox.x);
    } else if (mode.includes('e')) {
      newW = Math.min(Math.max(MIN_SIZE, initialBox.width + dxPercent), 100 - initialBox.x);
    }

    if (mode.includes('n')) {
      newY = Math.min(Math.max(0, initialBox.y + dyPercent), initialBox.y + initialBox.height - MIN_SIZE);
      newH = initialBox.height - (newY - initialBox.y);
    } else if (mode.includes('s')) {
      newH = Math.min(Math.max(MIN_SIZE, initialBox.height + dyPercent), 100 - initialBox.y);
    }

    setCropBox({
      x: Math.round(newX * 10) / 10,
      y: Math.round(newY * 10) / 10,
      width: Math.round(newW * 10) / 10,
      height: Math.round(newH * 10) / 10,
    });
  };

  const endCropDrag = (e: React.PointerEvent) => {
    if (!cropDragRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    cropDragRef.current = null;
  };

  const applyAspectPreset = (aspect: CropAspect) => {
    setCropAspect(aspect);
    const stage = stageRef.current;
    const sW = stage?.clientWidth || 300;
    const sH = stage?.clientHeight || 200;

    if (aspect === 'free') {
      setCropBox({ x: 5, y: 5, width: 90, height: 90 });
      return;
    }

    let ratio = 1;
    if (aspect === '1:1') ratio = 1;
    else if (aspect === '4:3') ratio = 4 / 3;
    else if (aspect === '16:9') ratio = 16 / 9;
    else if (aspect === '3:4') ratio = 3 / 4;

    let boxW = sW * 0.85;
    let boxH = boxW / ratio;

    if (boxH > sH * 0.85) {
      boxH = sH * 0.85;
      boxW = boxH * ratio;
    }

    const wPercent = Math.min(95, Math.round((boxW / sW) * 100));
    const hPercent = Math.min(95, Math.round((boxH / sH) * 100));
    const xPercent = Math.max(0, Math.round((100 - wPercent) / 2));
    const yPercent = Math.max(0, Math.round((100 - hPercent) / 2));

    setCropBox({
      x: xPercent,
      y: yPercent,
      width: wPercent,
      height: hPercent,
    });
  };

  const handleApplyCrop = () => {
    const img = imgRef.current;
    if (!img) return;

    commitDrawingToBase();

    const w = img.naturalWidth;
    const h = img.naturalHeight;

    const sx = Math.max(0, Math.round((cropBox.x / 100) * w));
    const sy = Math.max(0, Math.round((cropBox.y / 100) * h));
    const sw = Math.min(w - sx, Math.round((cropBox.width / 100) * w));
    const sh = Math.min(h - sy, Math.round((cropBox.height / 100) * h));

    if (sw <= 20 || sh <= 20) return;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = sw;
    cropCanvas.height = sh;
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const croppedUrl = cropCanvas.toDataURL('image/jpeg', 0.95);

    setCurrentDataUrl(croppedUrl);
    setHistory([]);
    setCropBox({ x: 5, y: 5, width: 90, height: 90 });
    setActiveTab('view');
    confetti({ particleCount: 25, spread: 45, origin: { y: 0.5 } });
  };

  // ==========================================================================
  // 5. ROTATE 90-DEGREES
  // ==========================================================================
  const handleRotate90 = () => {
    commitDrawingToBase();
    const img = imgRef.current;
    if (!img) return;

    const rotCanvas = document.createElement('canvas');
    rotCanvas.width = img.naturalHeight;
    rotCanvas.height = img.naturalWidth;
    const ctx = rotCanvas.getContext('2d');
    if (!ctx) return;

    ctx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
    ctx.rotate((90 * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    const rotatedUrl = rotCanvas.toDataURL('image/jpeg', 0.95);
    setCurrentDataUrl(rotatedUrl);
    setHistory([]);
  };

  // ==========================================================================
  // 6. REPLACE PHOTO FILE
  // ==========================================================================
  const handleReplaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setCurrentDataUrl(event.target.result);
        setHistory([]);
        setActiveTab('view');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ==========================================================================
  // 7. FINAL SAVE
  // ==========================================================================
  const handleSave = () => {
    try {
      const img = imgRef.current;
      const drawCanvas = drawCanvasRef.current;

      let finalDataUrl = currentDataUrl;

      if (img) {
        const saveCanvas = document.createElement('canvas');
        saveCanvas.width = img.naturalWidth || 1200;
        saveCanvas.height = img.naturalHeight || 900;
        const ctx = saveCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, saveCanvas.width, saveCanvas.height);
          if (drawCanvas && history.length > 0) {
            ctx.drawImage(drawCanvas, 0, 0, saveCanvas.width, saveCanvas.height);
          }
          finalDataUrl = saveCanvas.toDataURL('image/jpeg', 0.95);
        }
      }

      onSave({ photoUrl: finalDataUrl, caption: photo.caption || '' });
      confetti({ zIndex: 9999999, particleCount: 45, spread: 60, origin: { y: 0.5 } });
      onClose();
    } catch (err) {
      console.warn('handleSave fallback:', err);
      onSave({ photoUrl: currentDataUrl, caption: photo.caption || '' });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] bg-slate-950 text-white flex flex-col w-full h-full animate-in fade-in select-none touch-none">
      {/* 1. TOP APP BAR (LIQUID GLASS FLOATING HEADER) */}
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-slate-900/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-between gap-3 shrink-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-slate-300 transition cursor-pointer touch-manipulation"
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
              Potong (Crop), Beri Tanda / Coretan, dan Putar 90°
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs & Save Button */}
        <div className="flex items-center gap-2">
          {/* Action Tabs Pills */}
          <div className="hidden xs:flex items-center p-1 bg-black/40 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => handleSwitchTab('view')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer touch-manipulation ${
                activeTab === 'view' ? 'bg-teal-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Lihat</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab('crop')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer touch-manipulation ${
                activeTab === 'crop' ? 'bg-teal-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Crop className="w-3.5 h-3.5" />
              <span>Crop</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab('markup')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer touch-manipulation ${
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
            className="px-4 sm:px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-teal-500/20 transition cursor-pointer touch-manipulation"
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
          onClick={() => handleSwitchTab('view')}
          className={`flex-1 py-1.5 text-xs font-bold text-center rounded-lg transition touch-manipulation ${
            activeTab === 'view' ? 'bg-teal-500/20 text-teal-300 font-black' : 'text-slate-400'
          }`}
        >
          Lihat Foto
        </button>
        <button
          type="button"
          onClick={() => handleSwitchTab('crop')}
          className={`flex-1 py-1.5 text-xs font-bold text-center rounded-lg transition touch-manipulation ${
            activeTab === 'crop' ? 'bg-teal-500/20 text-teal-300 font-black' : 'text-slate-400'
          }`}
        >
          Potong (Crop)
        </button>
        <button
          type="button"
          onClick={() => handleSwitchTab('markup')}
          className={`flex-1 py-1.5 text-xs font-bold text-center rounded-lg transition touch-manipulation ${
            activeTab === 'markup' ? 'bg-teal-500/20 text-teal-300 font-black' : 'text-slate-400'
          }`}
        >
          Beri Tanda
        </button>
      </div>

      {/* 3. TOOLBAR SPESIFIK (MODE MARKUP ATAU CROP) */}
      {activeTab === 'markup' && (
        <div className="px-3 sm:px-6 py-2 bg-slate-900/95 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
          {/* Tools Picker */}
          <div className="flex items-center gap-1 bg-black/50 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setMarkupTool('pen')}
              className={`p-1.5 sm:px-3 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer touch-manipulation ${
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
              className={`p-1.5 sm:px-3 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer touch-manipulation ${
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
              className={`p-1.5 sm:px-3 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer touch-manipulation ${
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
              className={`p-1.5 sm:px-3 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer touch-manipulation ${
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
              { color: '#3B82F6', label: 'Biru' },
              { color: '#FFFFFF', label: 'Putih' },
            ].map((c) => (
              <button
                key={c.color}
                type="button"
                onClick={() => setMarkupColor(c.color)}
                style={{ backgroundColor: c.color }}
                className={`w-6 h-6 rounded-full cursor-pointer transition-transform touch-manipulation ${
                  markupColor === c.color ? 'ring-2 ring-white scale-125' : 'opacity-80 hover:opacity-100'
                }`}
                title={`Pilih Warna ${c.label}`}
              />
            ))}
          </div>

          {/* Stroke Width Selector */}
          <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-xl">
            {[
              { label: 'Tipis', width: 2 },
              { label: 'Sedang', width: 4 },
              { label: 'Tebal', width: 8 },
            ].map((sw) => (
              <button
                key={sw.label}
                type="button"
                onClick={() => setMarkupStrokeWidth(sw.width)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer touch-manipulation ${
                  markupStrokeWidth === sw.width ? 'bg-white/30 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {sw.label}
              </button>
            ))}
          </div>

          {/* Undo & Clear Actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0}
              className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-xs font-bold flex items-center gap-1 cursor-pointer touch-manipulation"
              title="Batalkan coretan terakhir (Undo)"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              onClick={handleClearMarkup}
              disabled={history.length === 0}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 disabled:opacity-30 text-xs font-bold flex items-center gap-1 cursor-pointer touch-manipulation"
              title="Hapus semua coretan"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hapus</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'crop' && (
        <div className="px-3 sm:px-6 py-2 bg-slate-900/95 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <span className="text-xs font-bold text-slate-400 mr-1">Rasio:</span>
            {(['free', '1:1', '4:3', '16:9', '3:4'] as const).map((asp) => (
              <button
                key={asp}
                type="button"
                onClick={() => applyAspectPreset(asp)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition cursor-pointer touch-manipulation ${
                  cropAspect === asp ? 'bg-teal-500 text-white font-black' : 'bg-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {asp === 'free' ? 'Bebas' : asp}
              </button>
            ))}
            <button
              type="button"
              onClick={() => applyAspectPreset('free')}
              className="px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-white transition flex items-center gap-1 cursor-pointer touch-manipulation"
              title="Reset Kotak Potongan"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="text-[10px]">Reset</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('view')}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition cursor-pointer touch-manipulation"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:brightness-110 active:scale-95 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md transition cursor-pointer touch-manipulation"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Terapkan Potongan</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. FULL-SCREEN PHOTO VIEWPORT (NO BOTTOM DRAWER BANNER - FOTO 100% FULL) */}
      <div className="flex-1 relative w-full h-full flex items-center justify-center p-2 sm:p-4 overflow-hidden bg-slate-950">
        <div
          ref={stageRef}
          className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden rounded-2xl shadow-2xl"
        >
          {/* Base Native Image (Rock-solid, can NEVER be blank white) */}
          <img
            ref={imgRef}
            src={currentDataUrl}
            crossOrigin="anonymous"
            onLoad={handleImageLoaded}
            alt="Edit Canvas Base"
            className="max-w-full max-h-[82vh] sm:max-h-[85vh] object-contain block select-none pointer-events-none rounded-2xl"
          />

          {/* Transparent Overlay Drawing Canvas */}
          <canvas
            ref={drawCanvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ touchAction: 'none' }}
            className={`absolute inset-0 w-full h-full object-contain block select-none rounded-2xl ${
              activeTab === 'markup'
                ? 'cursor-crosshair touch-none pointer-events-auto z-10'
                : 'pointer-events-none z-0'
            }`}
          />

          {/* CROP INTERACTIVE OVERLAY */}
          {activeTab === 'crop' && (
            <div
              className="absolute inset-0 pointer-events-auto select-none touch-none z-20"
              onPointerMove={handleCropPointerMove}
              onPointerUp={endCropDrag}
              onPointerCancel={endCropDrag}
            >
              <div
                style={{
                  position: 'absolute',
                  left: `${cropBox.x}%`,
                  top: `${cropBox.y}%`,
                  width: `${cropBox.width}%`,
                  height: `${cropBox.height}%`,
                }}
                className="border-2 border-teal-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] rounded-sm cursor-move pointer-events-auto"
                onPointerDown={(e) => startCropDrag(e, 'move')}
              >
                {/* 3x3 Rule-of-Thirds Grid */}
                <div className="w-full h-full grid grid-cols-3 grid-rows-3 opacity-40 border border-teal-200/50 pointer-events-none">
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

                {/* Center Move Drag Handle Tag */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/85 backdrop-blur-md text-teal-300 border border-teal-400/40 text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 pointer-events-none select-none">
                  <Move className="w-3 h-3 text-teal-400" />
                  <span>Geser Area</span>
                </div>

                {/* 4 Corner Resize Grips */}
                <div
                  onPointerDown={(e) => startCropDrag(e, 'nw')}
                  className="absolute -top-3 -left-3 w-8 h-8 flex items-center justify-center cursor-nwse-resize pointer-events-auto touch-none"
                  title="Tarik sudut kiri atas"
                >
                  <div className="w-3.5 h-3.5 bg-white border-2 border-teal-500 rounded-sm shadow-md" />
                </div>

                <div
                  onPointerDown={(e) => startCropDrag(e, 'ne')}
                  className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center cursor-nesw-resize pointer-events-auto touch-none"
                  title="Tarik sudut kanan atas"
                >
                  <div className="w-3.5 h-3.5 bg-white border-2 border-teal-500 rounded-sm shadow-md" />
                </div>

                <div
                  onPointerDown={(e) => startCropDrag(e, 'sw')}
                  className="absolute -bottom-3 -left-3 w-8 h-8 flex items-center justify-center cursor-nesw-resize pointer-events-auto touch-none"
                  title="Tarik sudut kiri bawah"
                >
                  <div className="w-3.5 h-3.5 bg-white border-2 border-teal-500 rounded-sm shadow-md" />
                </div>

                <div
                  onPointerDown={(e) => startCropDrag(e, 'se')}
                  className="absolute -bottom-3 -right-3 w-8 h-8 flex items-center justify-center cursor-nwse-resize pointer-events-auto touch-none"
                  title="Tarik sudut kanan bawah"
                >
                  <div className="w-3.5 h-3.5 bg-white border-2 border-teal-500 rounded-sm shadow-md" />
                </div>

                {/* 4 Edge Handles */}
                <div
                  onPointerDown={(e) => startCropDrag(e, 'n')}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-5 flex items-center justify-center cursor-ns-resize pointer-events-auto touch-none"
                >
                  <div className="w-6 h-1.5 bg-white/90 border border-teal-500 rounded-full shadow-sm" />
                </div>
                <div
                  onPointerDown={(e) => startCropDrag(e, 's')}
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-5 flex items-center justify-center cursor-ns-resize pointer-events-auto touch-none"
                >
                  <div className="w-6 h-1.5 bg-white/90 border border-teal-500 rounded-full shadow-sm" />
                </div>
                <div
                  onPointerDown={(e) => startCropDrag(e, 'w')}
                  className="absolute top-1/2 -left-2 -translate-y-1/2 w-5 h-12 flex items-center justify-center cursor-ew-resize pointer-events-auto touch-none"
                >
                  <div className="w-1.5 h-6 bg-white/90 border border-teal-500 rounded-full shadow-sm" />
                </div>
                <div
                  onPointerDown={(e) => startCropDrag(e, 'e')}
                  className="absolute top-1/2 -right-2 -translate-y-1/2 w-5 h-12 flex items-center justify-center cursor-ew-resize pointer-events-auto touch-none"
                >
                  <div className="w-1.5 h-6 bg-white/90 border border-teal-500 rounded-full shadow-sm" />
                </div>
              </div>
            </div>
          )}

          {/* FLOATING ACTION PILLS ON BOTTOM OF PHOTO */}
          <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-none z-30">
            <button
              type="button"
              onClick={handleRotate90}
              className="pointer-events-auto px-3.5 py-2 rounded-xl bg-slate-900/85 hover:bg-black text-white text-xs font-bold backdrop-blur-md border border-white/20 shadow-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer touch-manipulation"
              title="Putar 90 Derajat Searah Jarum Jam"
            >
              <RotateCw className="w-3.5 h-3.5 text-teal-300" />
              <span>Putar 90°</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="pointer-events-auto px-3.5 py-2 rounded-xl bg-teal-600/90 hover:bg-teal-600 text-white text-xs font-black backdrop-blur-md border border-white/20 shadow-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer touch-manipulation"
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
    </div>
  );
};