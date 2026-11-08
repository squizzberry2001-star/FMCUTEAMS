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
  Mic,
  MapPin,
  Clock,
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
  const [currentDataUrl, setCurrentDataUrl] = useState<string>(photo.photoUrl);
  const [caption, setCaption] = useState<string>(photo.caption || '');
  const [activeTab, setActiveTab] = useState<EditTabMode>('view');

  // Stage & Natural Dimensions
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 900,
  });
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: 400,
    height: 300,
  });

  // Markup States
  const [markupTool, setMarkupTool] = useState<MarkupTool>('pen');
  const [markupColor, setMarkupColor] = useState<string>('#EF4444'); // Default finding red
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

  // Voice Dictation
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const recognitionRef = useRef<any>(null);

  // DOM Refs
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ==========================================================================
  // 1. CALCULATE STAGE DISPLAY SIZE TO FIT VIEWPORT PERFECTLY
  // ==========================================================================
  const updateStageDisplaySize = useCallback(
    (imgW: number, imgH: number) => {
      const viewport = viewportRef.current;
      if (!viewport || !imgW || !imgH) return;

      const vW = Math.max(260, viewport.clientWidth - 20);
      const vH = Math.max(200, viewport.clientHeight - 20);
      const imgAspect = imgW / imgH;

      let fitW = vW;
      let fitH = vW / imgAspect;

      if (fitH > vH) {
        fitH = vH;
        fitW = vH * imgAspect;
      }

      setStageSize({
        width: Math.round(fitW),
        height: Math.round(fitH),
      });
    },
    []
  );

  // ResizeObserver on Viewport to recalculate stage when window/drawer resizes
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(() => {
      if (baseImageRef.current) {
        updateStageDisplaySize(
          baseImageRef.current.naturalWidth,
          baseImageRef.current.naturalHeight
        );
      }
    });

    observer.observe(viewport);
    return () => observer.disconnect();
  }, [updateStageDisplaySize]);

  // ==========================================================================
  // 2. LOAD IMAGE ONTO BASE CANVAS (Runs only on image change)
  // ==========================================================================
  useEffect(() => {
    let isCancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (isCancelled) return;
      baseImageRef.current = img;
      const w = img.naturalWidth || 1200;
      const h = img.naturalHeight || 900;
      setNaturalDimensions({ width: w, height: h });
      updateStageDisplaySize(w, h);

      // Render onto background canvas
      const bgCanvas = bgCanvasRef.current;
      if (bgCanvas) {
        bgCanvas.width = w;
        bgCanvas.height = h;
        const ctx = bgCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
        }
      }

      // Resize drawing canvas to match
      const drawCanvas = drawCanvasRef.current;
      if (drawCanvas) {
        drawCanvas.width = w;
        drawCanvas.height = h;
        redrawDrawCanvas();
      }
    };

    img.src = currentDataUrl;

    return () => {
      isCancelled = true;
    };
  }, [currentDataUrl, updateStageDisplaySize]);

  // ==========================================================================
  // 3. FAST DRAWING LAYER (ONLY clears & renders the transparent overlay)
  // ==========================================================================
  const redrawDrawCanvas = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all committed actions
    history.forEach((act) => {
      drawSingleAction(ctx, act);
    });

    // Draw live active action
    if (currentActionRef.current) {
      drawSingleAction(ctx, currentActionRef.current);
    }
  }, [history]);

  useEffect(() => {
    redrawDrawCanvas();
  }, [history, redrawDrawCanvas]);

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
      ctx.ellipse(cx, cy, Math.max(rx, 2), Math.max(ry, 2), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (act.tool === 'arrow' && act.startX !== undefined && act.startY !== undefined) {
      const fromX = act.startX;
      const fromY = act.startY;
      const toX = act.endX ?? fromX;
      const toY = act.endY ?? fromY;
      const headlen = Math.max(22, act.strokeWidth * 3.5);
      const angle = Math.atan2(toY - fromY, toX - fromX);

      // Line
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      // Sharp solid arrowhead
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

    ctx.restore();
  };

  // Canvas coordinates converter from pointer event
  const getCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Drawing Pointer Handlers (Native Pointer Events for 100% responsiveness)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTab !== 'markup') return;
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
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentActionRef.current || activeTab !== 'markup') return;
    e.preventDefault();
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    if (markupTool === 'pen') {
      currentActionRef.current.points?.push({ x, y });
    } else {
      currentActionRef.current.endX = x;
      currentActionRef.current.endY = y;
    }

    redrawDrawCanvas();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentActionRef.current || activeTab !== 'markup') return;
    e.preventDefault();

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    isDrawingRef.current = false;
    setHistory((prev) => [...prev, currentActionRef.current!]);
    currentActionRef.current = null;
    redrawDrawCanvas();
  };

  const handleUndo = () => {
    setHistory((prev) => prev.slice(0, -1));
  };

  const handleClearMarkup = () => {
    setHistory([]);
  };

  // ==========================================================================
  // 4. BAKE / COMMIT DRAWING ONTO BASE IMAGE
  // ==========================================================================
  const commitDrawingToBase = (): string => {
    const bgCanvas = bgCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!bgCanvas || !drawCanvas || history.length === 0) return currentDataUrl;

    const mergeCanvas = document.createElement('canvas');
    mergeCanvas.width = bgCanvas.width;
    mergeCanvas.height = bgCanvas.height;
    const mCtx = mergeCanvas.getContext('2d');
    if (!mCtx) return currentDataUrl;

    mCtx.drawImage(bgCanvas, 0, 0);
    mCtx.drawImage(drawCanvas, 0, 0);

    const mergedUrl = mergeCanvas.toDataURL('image/jpeg', 0.95);
    setCurrentDataUrl(mergedUrl);
    setHistory([]);
    return mergedUrl;
  };

  // Tab switch handler
  const handleSwitchTab = (tab: EditTabMode) => {
    if (tab === activeTab) return;
    if (activeTab === 'markup' && history.length > 0) {
      commitDrawingToBase();
    }
    setActiveTab(tab);
  };

  // ==========================================================================
  // 5. CROP INTERACTION ENGINE (DRAGGABLE & RESIZABLE WITH POINTER CAPTURE)
  // ==========================================================================
  const startCropDrag = (e: React.PointerEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    cropDragRef.current = {
      mode,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initialBox: { ...cropBox },
      stageWidth: stageSize.width,
      stageHeight: stageSize.height,
    };
  };

  const handleCropPointerMove = (e: React.PointerEvent) => {
    if (!cropDragRef.current) return;
    e.preventDefault();

    const { mode, startX, startY, initialBox, stageWidth, stageHeight } = cropDragRef.current;
    if (!mode || stageWidth <= 0 || stageHeight <= 0) return;

    const dxPercent = ((e.clientX - startX) / stageWidth) * 100;
    const dyPercent = ((e.clientY - startY) / stageHeight) * 100;

    const MIN_SIZE = 12; // Minimum 12% size

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

    // Horizontal adjustments
    if (mode.includes('w')) {
      newX = Math.min(Math.max(0, initialBox.x + dxPercent), initialBox.x + initialBox.width - MIN_SIZE);
      newW = initialBox.width - (newX - initialBox.x);
    } else if (mode.includes('e')) {
      newW = Math.min(Math.max(MIN_SIZE, initialBox.width + dxPercent), 100 - initialBox.x);
    }

    // Vertical adjustments
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

  // Apply Aspect Ratio Presets
  const applyAspectPreset = (aspect: CropAspect) => {
    setCropAspect(aspect);
    const { width: sW, height: sH } = stageSize;
    if (sW <= 0 || sH <= 0) return;

    if (aspect === 'free') {
      setCropBox({ x: 5, y: 5, width: 90, height: 90 });
      return;
    }

    let ratio = 1;
    if (aspect === '1:1') ratio = 1;
    else if (aspect === '4:3') ratio = 4 / 3;
    else if (aspect === '16:9') ratio = 16 / 9;
    else if (aspect === '3:4') ratio = 3 / 4;

    // Fit maximum rectangle with this ratio inside stageSize
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

  // Commit Crop Execution
  const handleApplyCrop = () => {
    const bgCanvas = bgCanvasRef.current;
    if (!bgCanvas) return;

    // Ensure any drawing is baked first
    commitDrawingToBase();

    const w = bgCanvas.width;
    const h = bgCanvas.height;

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

    ctx.drawImage(bgCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
    const croppedUrl = cropCanvas.toDataURL('image/jpeg', 0.95);

    setCurrentDataUrl(croppedUrl);
    setHistory([]);
    setCropBox({ x: 5, y: 5, width: 90, height: 90 });
    setActiveTab('view');
    confetti({ particleCount: 25, spread: 45, origin: { y: 0.5 } });
  };

  // ==========================================================================
  // 6. 90-DEGREE ROTATION
  // ==========================================================================
  const handleRotate90 = () => {
    commitDrawingToBase();

    const bgCanvas = bgCanvasRef.current;
    if (!bgCanvas) return;

    const rotCanvas = document.createElement('canvas');
    rotCanvas.width = bgCanvas.height;
    rotCanvas.height = bgCanvas.width;
    const ctx = rotCanvas.getContext('2d');
    if (!ctx) return;

    ctx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
    ctx.rotate((90 * Math.PI) / 180);
    ctx.drawImage(bgCanvas, -bgCanvas.width / 2, -bgCanvas.height / 2);

    const rotatedUrl = rotCanvas.toDataURL('image/jpeg', 0.95);
    setCurrentDataUrl(rotatedUrl);
    setHistory([]);
  };

  // ==========================================================================
  // 7. REPLACE PHOTO FILE
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
  // 8. VOICE DICTATION
  // ==========================================================================
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

  // ==========================================================================
  // 9. FINAL SAVE
  // ==========================================================================
  const handleSave = () => {
    const bgCanvas = bgCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;

    let finalDataUrl = currentDataUrl;

    if (bgCanvas) {
      const saveCanvas = document.createElement('canvas');
      saveCanvas.width = bgCanvas.width;
      saveCanvas.height = bgCanvas.height;
      const ctx = saveCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bgCanvas, 0, 0);
        if (drawCanvas && history.length > 0) {
          ctx.drawImage(drawCanvas, 0, 0);
        }
        finalDataUrl = saveCanvas.toDataURL('image/jpeg', 0.95);
      }
    }

    onSave({ photoUrl: finalDataUrl, caption });
    confetti({ particleCount: 35, spread: 55, origin: { y: 0.5 } });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col w-full h-full animate-in fade-in select-none touch-none">
      {/* 1. TOP APP BAR (HEADER) */}
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
        <div className="px-3 sm:px-6 py-2.5 bg-slate-900/95 border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5 shrink-0 z-20">
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
            <span className="text-[10px] font-bold text-slate-400 mr-1 hidden sm:inline">Tebal:</span>
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
              <span className="hidden sm:inline">Hapus Semua</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'crop' && (
        <div className="px-3 sm:px-6 py-2.5 bg-slate-900/95 border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5 shrink-0 z-20">
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

      {/* 4. MAIN CANVAS VIEWPORT (FULL RESPONSIVE DUAL-CANVAS ENGINE) */}
      <div
        ref={viewportRef}
        className="flex-1 relative w-full h-full flex items-center justify-center p-2 sm:p-4 overflow-hidden bg-slate-950/80"
      >
        <div
          ref={stageRef}
          style={{ width: stageSize.width, height: stageSize.height }}
          className="relative rounded-2xl shadow-2xl flex items-center justify-center overflow-hidden bg-black"
        >
          {/* Base Background Image Canvas */}
          <canvas
            ref={bgCanvasRef}
            className="w-full h-full object-contain block pointer-events-none select-none"
          />

          {/* Transparent Overlay Drawing Canvas (Dual-Canvas Architecture for 60fps/120fps Smoothness) */}
          <canvas
            ref={drawCanvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={`absolute inset-0 w-full h-full object-contain block select-none ${
              activeTab === 'markup'
                ? 'cursor-crosshair touch-none pointer-events-auto z-10'
                : 'pointer-events-none z-0'
            }`}
          />

          {/* CROP INTERACTIVE OVERLAY (FULLY DRAGGABLE & RESIZABLE WITH POINTER CAPTURE) */}
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

                {/* 4 Corner Resize Grips (Extra Touch Hitbox 40px) */}
                {/* Top-Left */}
                <div
                  onPointerDown={(e) => startCropDrag(e, 'nw')}
                  className="absolute -top-3 -left-3 w-8 h-8 flex items-center justify-center cursor-nwse-resize pointer-events-auto touch-none"
                  title="Tarik sudut kiri atas"
                >
                  <div className="w-3.5 h-3.5 bg-white border-2 border-teal-500 rounded-sm shadow-md" />
                </div>

                {/* Top-Right */}
                <div
                  onPointerDown={(e) => startCropDrag(e, 'ne')}
                  className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center cursor-nesw-resize pointer-events-auto touch-none"
                  title="Tarik sudut kanan atas"
                >
                  <div className="w-3.5 h-3.5 bg-white border-2 border-teal-500 rounded-sm shadow-md" />
                </div>

                {/* Bottom-Left */}
                <div
                  onPointerDown={(e) => startCropDrag(e, 'sw')}
                  className="absolute -bottom-3 -left-3 w-8 h-8 flex items-center justify-center cursor-nesw-resize pointer-events-auto touch-none"
                  title="Tarik sudut kiri bawah"
                >
                  <div className="w-3.5 h-3.5 bg-white border-2 border-teal-500 rounded-sm shadow-md" />
                </div>

                {/* Bottom-Right */}
                <div
                  onPointerDown={(e) => startCropDrag(e, 'se')}
                  className="absolute -bottom-3 -right-3 w-8 h-8 flex items-center justify-center cursor-nwse-resize pointer-events-auto touch-none"
                  title="Tarik sudut kanan bawah"
                >
                  <div className="w-3.5 h-3.5 bg-white border-2 border-teal-500 rounded-sm shadow-md" />
                </div>

                {/* 4 Edge Handles */}
                {/* Top Edge */}
                <div
                  onPointerDown={(e) => startCropDrag(e, 'n')}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-5 flex items-center justify-center cursor-ns-resize pointer-events-auto touch-none"
                >
                  <div className="w-6 h-1.5 bg-white/90 border border-teal-500 rounded-full shadow-sm" />
                </div>
                {/* Bottom Edge */}
                <div
                  onPointerDown={(e) => startCropDrag(e, 's')}
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-5 flex items-center justify-center cursor-ns-resize pointer-events-auto touch-none"
                >
                  <div className="w-6 h-1.5 bg-white/90 border border-teal-500 rounded-full shadow-sm" />
                </div>
                {/* Left Edge */}
                <div
                  onPointerDown={(e) => startCropDrag(e, 'w')}
                  className="absolute top-1/2 -left-2 -translate-y-1/2 w-5 h-12 flex items-center justify-center cursor-ew-resize pointer-events-auto touch-none"
                >
                  <div className="w-1.5 h-6 bg-white/90 border border-teal-500 rounded-full shadow-sm" />
                </div>
                {/* Right Edge */}
                <div
                  onPointerDown={(e) => startCropDrag(e, 'e')}
                  className="absolute top-1/2 -right-2 -translate-y-1/2 w-5 h-12 flex items-center justify-center cursor-ew-resize pointer-events-auto touch-none"
                >
                  <div className="w-1.5 h-6 bg-white/90 border border-teal-500 rounded-full shadow-sm" />
                </div>
              </div>
            </div>
          )}

          {/* QUICK FLOATING ROTATE & REPLACE BUTTONS ON IMAGE */}
          <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-none z-30">
            <button
              type="button"
              onClick={handleRotate90}
              className="pointer-events-auto px-3 py-1.5 rounded-xl bg-black/75 hover:bg-black text-white text-xs font-bold backdrop-blur-md border border-white/20 shadow-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer touch-manipulation"
              title="Putar 90 Derajat Searah Jarum Jam"
            >
              <RotateCw className="w-3.5 h-3.5 text-teal-300" />
              <span>Putar 90°</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="pointer-events-auto px-3 py-1.5 rounded-xl bg-teal-600/90 hover:bg-teal-600 text-white text-xs font-black backdrop-blur-md border border-white/20 shadow-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer touch-manipulation"
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
              className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer touch-manipulation ${
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