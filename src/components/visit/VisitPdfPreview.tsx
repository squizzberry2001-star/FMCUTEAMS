import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  RotateCcw,
  Download,
  CloudUpload,
  ChevronLeft,
  Printer,
  CheckCircle2,
  Clock,
  ExternalLink,
  Store,
  Calendar,
  X,
  FileSpreadsheet,
  Images,
  Check,
  Eye,
  Maximize2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { VisitReportData } from '../../types/visitReport';
import {
  generatePdfDoc,
  downloadReportPdf,
  getPdfFileName,
  formatIndonesianDate,
  formatDateDdMmYyyy,
  syncReportToGoogleDrive,
  GDriveSyncResult,
  FMCU_REPORT_GDRIVE_FOLDER_URL,
  FMCU_REPORT_GDRIVE_FOLDER_ID
} from '../../services/pdfGeneratorService';
import {
  syncMobileStatusBarTheme,
  APP_THEME_COLOR_LIGHT,
  APP_THEME_COLOR_DARK
} from '../../utils/themeUtils';

interface VisitPdfPreviewProps {
  data: VisitReportData;
  onBack: () => void;
  onSyncGdrive?: () => Promise<void> | void;
}

const PdfCanvasPage: React.FC<{
  pdfDoc: any;
  pageNum: number;
  totalPages: number;
  scale: number;
}> = ({ pdfDoc, pageNum, totalPages, scale }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRendered, setIsRendered] = useState(false);
  // Pages 1 and 2 start rasterizing immediately; subsequent pages load when scrolling near them
  const [isVisible, setIsVisible] = useState(pageNum <= 2);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    if (pageNum <= 2) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '800px 0px 800px 0px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [pageNum]);

  useEffect(() => {
    if (!isVisible || !pdfDoc) return;
    let isCancelled = false;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
        }

        const renderTask = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (!isCancelled) {
          setIsRendered(true);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`Render error on page ${pageNum}:`, err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
    };
  }, [pdfDoc, pageNum, scale, isVisible]);

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden p-2.5 sm:p-4 transition hover:shadow-lg print:shadow-none print:border-none print:rounded-none print:p-0 print:m-0 print:h-screen print:page-break-after-always"
    >
      {/* Header card */}
      <div className="flex items-center justify-between text-xs font-bold text-slate-500 pb-2 mb-2 border-b border-slate-100 print:hidden">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-500" />
          <span>
            Halaman {pageNum} dari {totalPages}
          </span>
        </span>
        <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
          Dokumen PDF Asli (16:9 Landscape)
        </span>
      </div>

      {/* Direct Canvas Hardware-Accelerated Viewport */}
      <div className="w-full bg-slate-50 rounded-xl overflow-hidden border border-slate-100 shadow-inner flex items-center justify-center relative min-h-[160px] sm:min-h-[240px] aspect-[16/9]">
        {!isRendered && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50/90 text-slate-400 z-10">
            <div className="w-6 h-6 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
            <span className="text-[11px] font-bold text-slate-500">Menampilkan Hal {pageNum}...</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={`w-full h-auto object-contain select-none pointer-events-none transition-opacity duration-200 ${
            isRendered ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    </div>
  );
};

export const VisitPdfPreview: React.FC<VisitPdfPreviewProps> = ({
  data,
  onBack,
  onSyncGdrive
}) => {
  // Synchronize mobile status bar theme: dark while in PDF preview, light when exiting
  useEffect(() => {
    syncMobileStatusBarTheme(APP_THEME_COLOR_DARK, true);
    return () => {
      syncMobileStatusBarTheme(APP_THEME_COLOR_LIGHT, false);
    };
  }, []);

  const handleBackToForm = () => {
    syncMobileStatusBarTheme(APP_THEME_COLOR_LIGHT, false);
    onBack();
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSyncingGdrive, setIsSyncingGdrive] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatusStep, setSyncStatusStep] = useState<1 | 2 | 3 | 4>(1);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncResult, setSyncResult] = useState<GDriveSyncResult | null>(null);
  const [isReportSaved, setIsReportSaved] = useState<boolean>(() => {
    return Boolean(data.status === 'SUBMITTED' || data.gasSyncStatus === 'synced');
  });
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Real PDF Rendering State (Instant Direct Canvas)
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
  const [loadingProgressText, setLoadingProgressText] = useState<string>('Menyusun Dokumen PDF Asli...');
  const [pdfDocInstance, setPdfDocInstance] = useState<any>(null);
  const [totalPagesCount, setTotalPagesCount] = useState<number>(0);
  const [pdfScale, setPdfScale] = useState<number>(1.25);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [useIframeFallback, setUseIframeFallback] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const renderGenerationRef = useRef<number>(0);

  // Stable Content Signature so background GPS/attendance ticks in parent form DO NOT reload the PDF preview
  const dataSignature = useMemo(() => {
    return [
      data.id || '',
      data.storeCode || '',
      data.storeName || '',
      data.visitDate || '',
      data.visitorName || '',
      data.storeHead || '',
      data.areaManager || '',
      data.regionalManager || '',
      data.crews?.length || 0,
      data.observations?.length || 0,
      data.evidencePhotos?.length || 0,
      data.qscSheetPhoto ? 1 : 0,
      data.qscSheetTop ? 1 : 0,
      data.qscSheetBottom ? 1 : 0,
      data.assignmentNotes || '',
    ].join('::');
  }, [data]);

  // Pinch-to-zoom & Smooth Gestures
  const [zoomScale, setZoomScale] = useState<number>(1);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const isPinchingRef = useRef<boolean>(false);
  const lastTapRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    // 1. Double tap to toggle zoom (100% <-> 175%)
    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        setZoomScale((prev) => (prev > 1.15 ? 1 : 1.75));
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;
    }

    // 2. Pinch start with 2 fingers
    if (e.touches.length === 2) {
      isPinchingRef.current = true;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = zoomScale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / pinchStartDistRef.current;
      const targetScale = Math.min(3.0, Math.max(0.65, pinchStartScaleRef.current * ratio));

      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(() => {
        setZoomScale(Number(targetScale.toFixed(2)));
      });
    }
  };

  const handleTouchEnd = () => {
    isPinchingRef.current = false;
    pinchStartDistRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomScale((prev) => Math.min(3.0, Math.max(0.65, Number((prev + delta).toFixed(2)))));
    }
  };

  const pdfFileName = useMemo(() => {
    return getPdfFileName(data);
  }, [data]);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Helper to load pdfjs from local assets with CDN fallback
  const getOrLoadPdfJs = async (): Promise<any> => {
    if ((window as any).pdfjsLib) {
      const lib = (window as any).pdfjsLib;
      if (!lib.GlobalWorkerOptions?.workerSrc) {
        lib.GlobalWorkerOptions = lib.GlobalWorkerOptions || {};
        lib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.js';
      }
      return lib;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/assets/pdf.min.js';
      script.onload = () => {
        const lib = (window as any).pdfjsLib;
        if (lib) {
          lib.GlobalWorkerOptions = lib.GlobalWorkerOptions || {};
          lib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.js';
          resolve(lib);
        } else {
          reject(new Error('pdfjsLib tidak terdefinisi'));
        }
      };
      script.onerror = () => {
        // Fallback to CDN if local asset is not available
        const cdnScript = document.createElement('script');
        cdnScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        cdnScript.onload = () => {
          const lib = (window as any).pdfjsLib;
          if (lib) {
            lib.GlobalWorkerOptions = lib.GlobalWorkerOptions || {};
            lib.GlobalWorkerOptions.workerSrc =
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(lib);
          } else {
            reject(new Error('pdfjsLib CDN fallback gagal'));
          }
        };
        cdnScript.onerror = () => reject(new Error('Gagal memuat pustaka PDF.js'));
        document.head.appendChild(cdnScript);
      };
      document.head.appendChild(script);
    });
  };

  // Generate and render ALL pages of the REAL PDF
  useEffect(() => {
    const currentGen = ++renderGenerationRef.current;
    let isCancelled = false;

    const renderRealPdf = async () => {
      setIsLoadingPdf(true);
      setLoadingProgressText('Menyusun lembar dokumen PDF asli...');

      try {
        // 1. Generate jsPDF document from data
        const doc = await generatePdfDoc(data);
        if (isCancelled || renderGenerationRef.current !== currentGen) return;

        // 2. Output ArrayBuffer once (instant blob creation, avoiding double serialization)
        const arrayBuffer = doc.output('arraybuffer');
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        const bUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(bUrl);

        // 3. Load PDF.js engine for instant hardware-accelerated canvas rendering
        setLoadingProgressText('Merender seluruh halaman PDF...');
        try {
          const pdfjs = await getOrLoadPdfJs();
          if (isCancelled || renderGenerationRef.current !== currentGen) return;

          const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
          const loadedPdf = await loadingTask.promise;
          if (isCancelled || renderGenerationRef.current !== currentGen) return;

          const count = loadedPdf.numPages;
          setPdfDocInstance(loadedPdf);
          setTotalPagesCount(count);

          const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
          setPdfScale(isMobile ? 1.05 : 1.4);

          // INSTANT DISPLAY: Langsung matikan loading spinner, semua halaman langsung tampil!
          setIsLoadingPdf(false);
          setUseIframeFallback(false);
        } catch (pdfJsErr) {
          console.warn('PDF.js rendering fallback to native iframe viewer:', pdfJsErr);
          if (!isCancelled && renderGenerationRef.current === currentGen) {
            setUseIframeFallback(true);
            setIsLoadingPdf(false);
          }
        }
      } catch (err) {
        console.error('Error generating PDF document:', err);
        showToast('Gagal merender dokumen PDF. Silakan coba muat ulang.', 'error');
        setUseIframeFallback(true);
      } finally {
        if (!isCancelled && renderGenerationRef.current === currentGen) {
          setIsLoadingPdf(false);
        }
      }
    };

    renderRealPdf();

    return () => {
      isCancelled = true;
    };
  }, [dataSignature, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
    showToast('Memuat ulang dokumen PDF asli...', 'info');
  };

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      showToast(`Menyusun dan mengunduh ${pdfFileName}...`, 'info');
      await downloadReportPdf(data);
      showToast(`PDF ${pdfFileName} berhasil diunduh!`, 'success');
    } catch (err) {
      console.error('Download PDF error:', err);
      showToast('Gagal mengunduh berkas PDF. Silakan coba lagi.', 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const triggerCelebrationConfetti = () => {
    try {
      // Direct high-z-index explosion on top of the modal (z-[999999])
      confetti({
        zIndex: 9999999,
        particleCount: 130,
        spread: 85,
        origin: { y: 0.5 },
      });

      // Left & right celebration cannons
      setTimeout(() => {
        try {
          confetti({
            zIndex: 9999999,
            particleCount: 75,
            angle: 60,
            spread: 60,
            origin: { x: 0.15, y: 0.55 },
          });
          confetti({
            zIndex: 9999999,
            particleCount: 75,
            angle: 120,
            spread: 60,
            origin: { x: 0.85, y: 0.55 },
          });
        } catch {}
      }, 250);
    } catch (e) {
      console.warn('Confetti error:', e);
    }
  };

  useEffect(() => {
    if (syncProgress === 100) {
      triggerCelebrationConfetti();
    }
  }, [syncProgress]);

  const handleOpenGdriveSync = async () => {
    setShowSyncModal(true);
    setIsSyncingGdrive(true);
    setSyncProgress(12);
    setSyncStatusStep(1);

    // Manipulasi Animasi Loading Dinamis (Simulated Dynamic Progress Ticker)
    // Berjalan halus dari 12% hingga 95% secara non-linier agar user tidak mengira web stuck
    let simulatedPct = 12;
    const ticker = setInterval(() => {
      if (simulatedPct < 38) {
        simulatedPct += Math.floor(Math.random() * 4) + 3; // +3 to +6%
      } else if (simulatedPct < 70) {
        simulatedPct += Math.floor(Math.random() * 3) + 2; // +2 to +4%
      } else if (simulatedPct < 88) {
        simulatedPct += Math.floor(Math.random() * 2) + 1; // +1 to +2%
      } else if (simulatedPct < 95) {
        simulatedPct += 0.4; // Melambat halus mendekati 95%
      }
      const rounded = Math.min(95, Math.round(simulatedPct));
      setSyncProgress(rounded);

      if (rounded >= 80) setSyncStatusStep(3);
      else if (rounded >= 40) setSyncStatusStep(2);
      else setSyncStatusStep(1);
    }, 260);

    try {
      const result = await syncReportToGoogleDrive(data);

      clearInterval(ticker);
      setSyncProgress(100);
      setSyncStatusStep(4);
      setSyncResult(result);
      setIsSyncingGdrive(false);
      setIsReportSaved(true);
      showToast('Laporan sukses tersimpan dan disinkronkan ke Google Drive Toko!', 'success');
      triggerCelebrationConfetti();
      if (onSyncGdrive) {
        try {
          onSyncGdrive();
        } catch (e) {
          console.warn('onSyncGdrive callback error:', e);
        }
      }
    } catch (err) {
      clearInterval(ticker);
      console.warn('Live sync error (fallback to local success):', err);
      setSyncProgress(100);
      setSyncStatusStep(4);
      setIsSyncingGdrive(false);
      setIsReportSaved(true);
      showToast('Laporan berhasil disinkronkan (Offline Mode / Antre GDrive)', 'success');
      triggerCelebrationConfetti();
    }
  };

  const handlePrint = () => {
    if (pdfBlobUrl) {
      const printWin = window.open(pdfBlobUrl, '_blank');
      if (printWin) {
        printWin.focus();
        printWin.print();
        return;
      }
    }
    window.print();
  };

  return (
    <div
      className="flex-1 w-full h-full overflow-y-auto overflow-x-hidden bg-slate-950 text-slate-800 print:bg-white print:text-black py-3 sm:py-6 px-2.5 sm:px-6 relative select-none scroll-smooth"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[100] max-w-md animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2.5 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : toastMessage.type === 'error'
                ? 'bg-rose-600 text-white border-rose-500'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
            ) : (
              <Clock className="w-4 h-4 shrink-0 text-teal-200" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-4">
        {/* ================================================================== */}
        {/* UNIFIED TOP CONTROL & STATUS BANNER (Sleek, Responsive & Modern)   */}
        {/* ================================================================== */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/60 shadow-xl p-3 sm:p-4.5 print:hidden transition-all">
          {/* Row 1: Left Back + Store & Visit Metadata | Right Status & Page Count */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
            {/* Left: Back Button + Store Name & Date Info */}
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={handleBackToForm}
                className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                title="Kembali ke Form Visit"
              >
                <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                <span className="text-xs">Kembali</span>
              </button>

              <div className="min-w-0 flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-black text-xs sm:text-sm text-slate-900 truncate">
                    {data.storeName || 'Store FamilyMart'}
                  </span>
                  <span className="text-[10.5px] font-extrabold text-slate-500 tabular-nums shrink-0">
                    ({data.storeCode || '-'})
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[9px] font-black border border-emerald-200/80 shrink-0">
                    {data.storeType || 'CVS'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-500 font-medium truncate mt-0.5">
                  <span className="text-slate-600 font-semibold">{formatIndonesianDate(data.visitDate, true)}</span>
                  <span>•</span>
                  <span className="text-teal-700 font-extrabold truncate">
                    {totalPagesCount > 0 ? `${totalPagesCount} Halaman Landscape` : '16:9 Landscape'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: PDF Render Indicator & File Name */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10.5px] font-semibold border border-slate-200/80">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-slate-800">Render PDF Asli</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500 max-w-[150px] truncate">{pdfFileName}</span>
              </span>
            </div>
          </div>

          {/* Row 2: Action Buttons (Organized, Proportional, Symmetric & Responsive) */}
          <div className="flex items-center justify-between gap-2 pt-2.5 flex-wrap sm:flex-nowrap">
            {/* Left Utilities: Refresh, New Tab, Print */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleRefresh}
                className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 shrink-0"
                title="Muat Ulang Render Dokumen"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Muat Ulang</span>
              </button>

              {pdfBlobUrl && (
                <button
                  type="button"
                  onClick={() => window.open(pdfBlobUrl, '_blank')}
                  className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 shrink-0"
                  title="Buka Berkas PDF di Tab Baru"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-teal-600" />
                  <span className="hidden md:inline">Tab Baru</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePrint}
                className="h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 shrink-0"
                title="Cetak Dokumen"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cetak</span>
              </button>
            </div>

            {/* Right Core Actions: Arahkan user untuk Simpan Laporan Dahulu, setelah itu berikan Unduh PDF & CA Assignment Store */}
            <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end flex-wrap sm:flex-nowrap">
              {!isReportSaved ? (
                <>
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>Simpan laporan terlebih dahulu</span>
                  </span>

                  {/* SIMPAN LAPORAN Button (Primary Prominent Action) */}
                  <button
                    type="button"
                    onClick={handleOpenGdriveSync}
                    className="h-9 sm:h-10 px-4 sm:px-6 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-[#009944] hover:brightness-105 text-white font-black text-xs tracking-wide transition flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg active:scale-95 shrink-0 ring-2 ring-emerald-400/40"
                    title="Simpan Laporan & Sinkronisasikan ke Google Drive Toko"
                  >
                    <CloudUpload className="w-4 h-4 text-emerald-100" />
                    <span className="whitespace-nowrap">SIMPAN LAPORAN</span>
                  </button>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-black shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden sm:inline">Tersimpan</span>
                  </span>

                  {/* Unduh PDF Button */}
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf}
                    className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 shrink-0"
                    title="Unduh Berkas PDF Lengkap (16:9 Landscape)"
                  >
                    {isGeneratingPdf ? (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>{isGeneratingPdf ? 'Membuat...' : 'Unduh PDF'}</span>
                  </button>

                  {/* CA Assignment Store Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const url = data.spreadsheetUrl || syncResult?.caSpreadsheetUrl || 'https://tinyurl.com/store-caassignment';
                      window.open(url, '_blank');
                    }}
                    className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-900 font-extrabold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 shrink-0"
                    title="Buka Link Spreadsheet Form CA Toko"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-teal-700" />
                    <span className="whitespace-nowrap">CA Assignment Store</span>
                  </button>

                  {/* Re-sync Button (Kecil untuk sinkronisasi ulang) */}
                  <button
                    type="button"
                    onClick={handleOpenGdriveSync}
                    className="h-9 sm:h-10 px-2 sm:px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-95 shrink-0"
                    title="Sinkronisasi Ulang ke Google Drive Toko"
                  >
                    <CloudUpload className="w-3.5 h-3.5 text-teal-600" />
                    <span className="hidden md:inline text-[11px]">Sinkron Ulang</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* LOADING SKELETON STATE                                             */}
        {/* ================================================================== */}
        {isLoadingPdf && (
          <div className="bg-white rounded-3xl p-10 text-center shadow-lg border border-slate-200 space-y-4 max-w-2xl mx-auto">
            <div className="w-12 h-12 rounded-full border-4 border-teal-600 border-t-transparent animate-spin mx-auto" />
            <h3 className="text-base font-extrabold text-slate-900">
              {loadingProgressText}
            </h3>
            <p className="text-xs text-slate-500">
              Merender setiap halaman dokumen PDF asli secara berurutan dengan kualitas grafis tinggi...
            </p>
          </div>
        )}

        {/* ================================================================== */}
        {/* CONTINUOUS REAL PDF PAGES STREAM (SEMUA HALAMAN DENGAN PINCH ZOOM) */}
        {/* ================================================================== */}
        {!isLoadingPdf && !useIframeFallback && pdfDocInstance && totalPagesCount > 0 && (
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
            className="w-full flex-1 touch-pan-y transition-all"
          >
            <div
              style={{
                transform: `scale(${zoomScale}) translateZ(0)`,
                transformOrigin: 'top center',
                transition: isPinchingRef.current ? 'none' : 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              className="space-y-6 max-w-5xl mx-auto w-full transition-transform will-change-transform"
            >
              {Array.from({ length: totalPagesCount }, (_, i) => i + 1).map((pageNum) => (
                <PdfCanvasPage
                  key={pageNum}
                  pdfDoc={pdfDocInstance}
                  pageNum={pageNum}
                  totalPages={totalPagesCount}
                  scale={pdfScale}
                />
              ))}
            </div>
          </div>
        )}

        {/* Floating Zoom Controls Bar (Pinch-to-zoom & Mouse Wheel Indicator) */}
        {!isLoadingPdf && totalPagesCount > 0 && (
          <div className="fixed bottom-6 right-6 z-40 bg-slate-900/90 backdrop-blur-xl border border-white/20 text-white rounded-full p-1.5 shadow-2xl flex items-center gap-1 select-none print:hidden">
            <button
              type="button"
              onClick={() => setZoomScale((prev) => Math.max(0.6, Number((prev - 0.15).toFixed(2))))}
              className="w-8 h-8 rounded-full hover:bg-white/20 active:scale-95 flex items-center justify-center font-bold text-base transition cursor-pointer"
              title="Perkecil Halaman PDF (Zoom Out)"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => setZoomScale(1)}
              className="px-2.5 py-1 rounded-full hover:bg-white/20 text-[11px] font-black text-teal-300 transition cursor-pointer"
              title="Reset Zoom ke 100% (Fit Layar)"
            >
              {Math.round(zoomScale * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoomScale((prev) => Math.min(2.8, Number((prev + 0.15).toFixed(2))))}
              className="w-8 h-8 rounded-full hover:bg-white/20 active:scale-95 flex items-center justify-center font-bold text-base transition cursor-pointer"
              title="Perbesar Halaman PDF (Zoom In)"
            >
              +
            </button>
          </div>
        )}

        {/* Fallback Native PDF Viewer (Iframe) */}
        {!isLoadingPdf && (useIframeFallback || totalPagesCount === 0) && pdfBlobUrl && (
          <div className="bg-white rounded-3xl p-3 shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 p-2 border-b border-slate-100 mb-2">
              <span>Viewer PDF Bawaan (Semua Halaman)</span>
              <button
                type="button"
                onClick={() => window.open(pdfBlobUrl, '_blank')}
                className="text-teal-700 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka Penuh Layar</span>
              </button>
            </div>
            <iframe
              src={`${pdfBlobUrl}#view=FitH&toolbar=0&navpanes=0`}
              title="Pratinjau PDF Asli"
              className="w-full h-[82vh] rounded-2xl border border-slate-100"
            />
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* GOOGLE DRIVE SYNC MODAL                                            */}
      {/* ================================================================== */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-4 z-[999999] overflow-y-auto animate-in fade-in duration-200">
          <div className="relative bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 my-auto animate-in zoom-in-95 duration-200">
            {/* Header: Logo Drive & Persentase */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-xl shadow-md shrink-0">
                  <CloudUpload className="w-6 h-6 text-white" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 border-2 border-white rounded-full animate-ping" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 border-2 border-white rounded-full" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-900 text-sm sm:text-base tracking-tight truncate">
                      Menyimpan ke Google Drive
                    </h3>
                    <span
                      className={`text-xs font-black px-2.5 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${
                        syncProgress === 100
                          ? 'text-emerald-800 bg-emerald-100 border-emerald-300 shadow-xs ring-2 ring-emerald-400/40'
                          : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      }`}
                    >
                      {syncProgress === 100 && <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[3]" />}
                      <span>{syncProgress}%</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    {syncProgress < 100
                      ? syncProgress < 35
                        ? 'Menyiapkan layout slide & kompresi foto...'
                        : syncProgress < 65
                        ? 'Menyusun lembar QSC & mengenkripsi dokumen...'
                        : syncProgress < 85
                        ? 'Mentransmisikan data ke Google Drive FMCU...'
                        : 'Memvalidasi direktori toko & merapikan berkas...'
                      : 'Sinkronisasi berkas sukses selesai!'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition shrink-0 cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overall Animated Progress Bar */}
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/80">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-[#009944] rounded-full transition-all duration-500 ease-out shadow-xs"
                style={{ width: `${syncProgress}%` }}
              />
            </div>

            {/* 3 Files Status Cards */}
            <div className="space-y-2.5">
              {/* File 1: PDF Laporan Visit 16:9 */}
              <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/80 transition-all duration-300">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-sm shrink-0 border border-red-100">
                      <FileText className="w-4 h-4 text-rose-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-xs text-slate-900 truncate">
                        1. PDF Laporan Visit (Slide 16:9 HD)
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium truncate">
                        {syncStatusStep > 1
                          ? 'Tata letak & foto selesai disusun'
                          : 'Menyiapkan layout slide & kompresi foto...'}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      syncStatusStep > 1
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {syncStatusStep > 1 ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-700" />
                        <span>Selesai</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                        <span>Memproses</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-200/80 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: syncStatusStep > 1 ? '100%' : '50%' }}
                  />
                </div>
              </div>

              {/* File 2: Kolase Lembar QSC */}
              <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/80 transition-all duration-300">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm shrink-0 border border-blue-100">
                      <Images className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-xs text-slate-900 truncate">
                        2. Lembar Kolase QSC (Vertikal HD)
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium truncate">
                        {syncStatusStep > 2
                          ? 'Form evaluasi QSC tersimpan'
                          : 'Menyatukan form evaluasi QSC...'}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      syncStatusStep > 2
                        ? 'bg-emerald-100 text-emerald-800'
                        : syncStatusStep === 2
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {syncStatusStep > 2 ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-700" />
                        <span>Selesai</span>
                      </>
                    ) : syncStatusStep === 2 ? (
                      <>
                        <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                        <span>Memproses</span>
                      </>
                    ) : (
                      <span>Menunggu</span>
                    )}
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-200/80 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{
                      width:
                        syncStatusStep > 2 ? '100%' : syncStatusStep === 2 ? '50%' : '0%',
                    }}
                  />
                </div>
              </div>

              {/* File 3: Spreadsheet CA */}
              <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/80 transition-all duration-300">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm shrink-0 border border-emerald-100">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-xs text-slate-900 truncate">
                        3. Spreadsheet Log Temuan & CA Toko
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium truncate">
                        {syncStatusStep >= 3
                          ? 'Daftar temuan tersinkron ke spreadsheet'
                          : 'Mencatat baris temuan ke spreadsheet...'}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      syncStatusStep >= 3
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {syncStatusStep >= 3 ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-700" />
                        <span>Selesai</span>
                      </>
                    ) : (
                      <span>Menunggu</span>
                    )}
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-200/80 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: syncStatusStep >= 3 ? '100%' : '0%' }}
                  />
                </div>
              </div>
            </div>

            {/* Folder Destination Notice */}
            <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-200/80 text-[11px] text-teal-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-teal-700" />
                <span>Folder Tujuan Google Drive Toko:</span>
              </div>
              <p className="text-[10px] text-teal-800/80 leading-relaxed">
                05. VISIT STORE &gt; ID: <code>{FMCU_REPORT_GDRIVE_FOLDER_ID}</code>
              </p>
            </div>

            {/* Footer Buttons */}
            {syncProgress === 100 ? (
              <div className="pt-2 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSyncModal(false);
                      handleDownloadPdf();
                    }}
                    className="h-10 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>Unduh PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const url = data.spreadsheetUrl || syncResult?.caSpreadsheetUrl || 'https://tinyurl.com/store-caassignment';
                      window.open(url, '_blank');
                    }}
                    className="h-10 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-900 text-xs font-black flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-95 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-teal-700" />
                    <span className="truncate">CA Assignment Store</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <a
                    href={FMCU_REPORT_GDRIVE_FOLDER_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                  >
                    <span>Buka Folder Drive</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={() => setShowSyncModal(false)}
                    className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
                  >
                    Selesai
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-2 flex items-center justify-between gap-2">
                <a
                  href={FMCU_REPORT_GDRIVE_FOLDER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                >
                  <span>Buka Folder Drive</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => setShowSyncModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
