import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Download, Cloud, FileText, ChevronLeft, Folder, Calendar } from 'lucide-react';
import { VisitReportData } from '../../types';
import { generatePdfDoc, formatDateDdMmYyyy, formatIndonesianDate } from '../../services/pdfGeneratorService';
import { FMCU_REPORT_GDRIVE_FOLDER_URL } from '../../services/pdfGeneratorService';

interface ExecutiveReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData?: VisitReportData | null;
  gdrivePdfUrl?: string;
  gdriveEmbedUrl?: string;
  storeFolderName?: string;
  pdfFileName?: string;
  gdriveSavedDate?: string;
}

export const ExecutiveReportPreviewModal: React.FC<ExecutiveReportPreviewModalProps> = ({
  isOpen,
  onClose,
  reportData,
  gdrivePdfUrl,
  gdriveEmbedUrl,
  storeFolderName,
  pdfFileName,
  gdriveSavedDate,
}) => {
  const [blobPdfUrl, setBlobPdfUrl] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    let active = true;
    if (!isOpen || !reportData) {
      if (blobPdfUrl) {
        URL.revokeObjectURL(blobPdfUrl);
        setBlobPdfUrl(null);
      }
      return;
    }

    if (gdriveEmbedUrl) return;

    setIsGeneratingPdf(true);
    generatePdfDoc(reportData)
      .then((doc) => {
        if (!active) return;
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        setBlobPdfUrl(url);
        setIsGeneratingPdf(false);
      })
      .catch((err) => {
        console.error('Error generating executive preview PDF:', err);
        if (active) setIsGeneratingPdf(false);
      });

    return () => {
      active = false;
      if (blobPdfUrl) {
        URL.revokeObjectURL(blobPdfUrl);
      }
    };
  }, [isOpen, reportData, gdriveEmbedUrl]);

  if (!isOpen || !reportData) return null;

  const cleanStore = String(reportData.storeName || 'STORE').replace(/[/\\:*?"<>|]/g, ' ').trim();
  const resolvedFolderName =
    storeFolderName ||
    (reportData.storeCode ? `${reportData.storeCode} - ${cleanStore}` : cleanStore);

  const resolvedFileName =
    pdfFileName ||
    `Hasil Kunjungan-${cleanStore}-${formatDateDdMmYyyy(reportData.visitDate)}.pdf`;

  const resolvedSavedDate =
    gdriveSavedDate ||
    (reportData.updatedAtMs
      ? `${formatIndonesianDate(
          new Date(reportData.updatedAtMs).toISOString().split('T')[0],
          false
        )}, ${String(new Date(reportData.updatedAtMs).getHours()).padStart(2, '0')}:${String(
          new Date(reportData.updatedAtMs).getMinutes()
        ).padStart(2, '0')} WIB`
      : `${formatIndonesianDate(reportData.visitDate, false)}`);

  const pdfSrc = gdriveEmbedUrl || blobPdfUrl || gdrivePdfUrl;

  const handleDownload = async () => {
    try {
      const doc = await generatePdfDoc(reportData);
      doc.save(resolvedFileName);
    } catch (e) {
      console.error('Download error:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black">
                <Cloud className="w-3 h-3" />
                <span>Google Drive Cloud PDF</span>
              </span>

              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/80">
                <FileText className="w-3 h-3 text-emerald-400" />
                <span className="truncate max-w-[280px]">{resolvedFileName}</span>
              </span>
            </div>

            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 flex-wrap">
              <span className="flex items-center gap-1 text-slate-300">
                <Folder className="w-3 h-3 text-amber-400" />
                <span>Folder: <strong>{resolvedFolderName}</strong></span>
              </span>

              <span>•</span>

              <span>
                PIC: <strong className="text-slate-200">{reportData.visitorName}</strong>
              </span>

              <span>•</span>

              <span className="flex items-center gap-1 text-emerald-300 font-semibold">
                <Calendar className="w-3 h-3 text-emerald-400" />
                <span>Tgl Simpan GDrive: {resolvedSavedDate}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Unduh PDF</span>
          </button>

          <a
            href={gdrivePdfUrl || FMCU_REPORT_GDRIVE_FOLDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white text-[11px] font-extrabold flex items-center gap-1.5 transition shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Buka di GDrive</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-400 flex items-center justify-center transition cursor-pointer ml-1"
            title="Tutup Preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main PDF Viewer Frame */}
      <div className="flex-1 w-full bg-slate-900 p-2 sm:p-4 flex flex-col relative overflow-hidden">
        {isGeneratingPdf && !gdriveEmbedUrl ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-9 h-9 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold">Memuat dokumen hasil kunjungan dari Google Drive...</p>
          </div>
        ) : (
          <iframe
            src={pdfSrc}
            title={`Preview PDF GDrive ${reportData.storeName}`}
            className="w-full flex-1 rounded-2xl border border-slate-700 bg-white shadow-2xl"
            allow="autoplay"
          />
        )}
      </div>
    </div>
  );
};
