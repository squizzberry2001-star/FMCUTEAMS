import React, { useState, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  Calendar,
  Store,
  Users,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  Filter,
  Search,
  Check,
  AlertTriangle,
  RotateCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ScheduleAgenda, User } from '../types';
import {
  ExcelWorkbookParseResult,
  parseScheduleExcelFile,
} from '../services/scheduleExcelService';

interface ExcelScheduleUploadModalProps {
  existingUsers: User[];
  currentAgendasCount: number;
  onClose: () => void;
  onImportSuccess: (
    updatedUsers: User[],
    newAgendas: ScheduleAgenda[],
    mode: 'merge' | 'replace',
    summaryMessage: string
  ) => void;
}

export const ExcelScheduleUploadModal: React.FC<ExcelScheduleUploadModalProps> = ({
  existingUsers,
  currentAgendasCount,
  onClose,
  onImportSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<ExcelWorkbookParseResult | null>(null);
  const [selectedSheetMode, setSelectedSheetMode] = useState<string>('ALL');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [previewFilter, setPreviewFilter] = useState<'all' | 'visit' | 'nso' | 'non-store' | 'off'>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleProcessFile = async (file: File, sheetChoice = selectedSheetMode) => {
    setSelectedFile(file);
    setIsParsing(true);
    setErrorMessage(null);

    try {
      const res = await parseScheduleExcelFile(file, existingUsers, sheetChoice);
      setParseResult(res);
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
    } catch (err: any) {
      console.error('Excel Parsing Error:', err);
      setErrorMessage(
        err?.message || 'Gagal mengekstrak berkas Excel. Pastikan format kolom sesuai template (Nama, Start Date, Start Time, End Date, End Time, Description, Location).'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file, selectedSheetMode);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      handleProcessFile(file, selectedSheetMode);
    } else if (file) {
      setErrorMessage('Harap unggah berkas berekstensi .xlsx atau .xls');
    }
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheetMode(sheetName);
    if (selectedFile) {
      handleProcessFile(selectedFile, sheetName);
    }
  };

  const handleConfirmImport = () => {
    if (!parseResult || parseResult.summary.agendas.length === 0) return;

    const { summary } = parseResult;
    const msg = `Berhasil mengimpor ${summary.agendas.length} agenda dari Excel (${summary.sheetName})!`;
    onImportSuccess(summary.updatedUsers, summary.agendas, importMode, msg);
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
    onClose();
  };

  // Filter agendas for preview table
  const displayedPreviewAgendas = (parseResult?.summary.agendas || []).filter((item) => {
    // Category Filter
    if (previewFilter === 'visit' && item.category !== 'VISIT') return false;
    if (previewFilter === 'nso' && item.category !== 'NSO') return false;
    if (previewFilter === 'off' && item.category !== 'OFF' && item.category !== 'CUTI') return false;
    if (
      previewFilter === 'non-store' &&
      (item.category === 'VISIT' || item.category === 'NSO' || item.category === 'OFF' || item.category === 'CUTI')
    )
      return false;

    // Search query
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchLoc = item.location.toLowerCase().includes(q);
      const matchPic = item.pic.toLowerCase().includes(q);
      const matchStore = (item.storeName || '').toLowerCase().includes(q);
      if (!matchTitle && !matchLoc && !matchPic && !matchStore) return false;
    }

    return true;
  });

  return (
    <div className="fixed inset-0 z-[999999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in select-none">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        {/* 1. Header (Liquid Glass Accent) */}
        <header className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight truncate">
                  Upload Schedule by Excel
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200/80 shrink-0">
                  Auto Extract FMCU
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium truncate">
                Membaca jadwal kerja 7 kolom resmi, auto klasifikasi nama, tanggal, jam 24H, dan toko
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* 2. Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* A. Dropzone Upload Box */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center transition-all cursor-pointer group ${
              selectedFile
                ? 'border-teal-500 bg-teal-50/30'
                : 'border-slate-300 hover:border-teal-400 bg-slate-50/60 hover:bg-teal-50/20'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex flex-col items-center justify-center gap-2.5">
              <div className="w-14 h-14 rounded-3xl bg-white text-teal-600 shadow-md border border-slate-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                {isParsing ? (
                  <RotateCw className="w-7 h-7 text-teal-500 animate-spin" />
                ) : (
                  <UploadCloud className="w-7 h-7 text-teal-600" />
                )}
              </div>

              {selectedFile ? (
                <div>
                  <h4 className="font-extrabold text-sm text-slate-800 flex items-center justify-center gap-2">
                    <span>{selectedFile.name}</span>
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </span>
                  </h4>
                  <p className="text-xs text-teal-600 font-semibold mt-1">
                    Klik atau drag berkas baru jika ingin mengganti file
                  </p>
                </div>
              ) : (
                <div>
                  <h4 className="font-extrabold text-sm text-slate-800">
                    Klik untuk memilih berkas Excel atau Drag & Drop di sini
                  </h4>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    Mendukung berkas Excel (.xlsx / .xls) template "TEMPLET EXCEL JADWAL"
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* B. Sheet Selector (Jika Workbook memiliki lebih dari 1 sheet) */}
          {parseResult && parseResult.availableSheets.length > 0 && (
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-teal-600" />
                  <span>Pilih Periode Sheet Excel:</span>
                </span>
                <span className="text-slate-400 font-medium">
                  {parseResult.availableSheets.length} sheet terdeteksi
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSheetChange('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                    selectedSheetMode === 'ALL'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  ✨ Ekstrak Semua Sheet Sekaligus
                </button>

                {parseResult.availableSheets.map((sName) => (
                  <button
                    key={sName}
                    type="button"
                    onClick={() => handleSheetChange(sName)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                      selectedSheetMode === sName
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {sName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* C. Live Summary Statistik Ekstraksi */}
          {parseResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* 1. Total Agenda */}
                <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200/80 flex flex-col justify-between">
                  <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-wider">
                    Total Agenda
                  </span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-teal-900">
                      {parseResult.summary.stats.totalRows}
                    </span>
                    <span className="text-[11px] font-bold text-teal-600">item</span>
                  </div>
                </div>

                {/* 2. Visit Store */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col justify-between">
                  <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                    <Store className="w-3 h-3" />
                    <span>Visit Store</span>
                  </span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-emerald-900">
                      {parseResult.summary.stats.visitCount}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600">toko</span>
                  </div>
                </div>

                {/* 3. NSO Store */}
                <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200/80 flex flex-col justify-between">
                  <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider">
                    NSO / Reopening
                  </span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-purple-900">
                      {parseResult.summary.stats.nsoCount}
                    </span>
                    <span className="text-[11px] font-bold text-purple-600">toko</span>
                  </div>
                </div>

                {/* 4. OFF / Libur Weekend */}
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex flex-col justify-between">
                  <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider">
                    OFF / Weekend
                  </span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-amber-900">
                      {parseResult.summary.stats.offCount + parseResult.summary.stats.cutiCount}
                    </span>
                    <span className="text-[11px] font-bold text-amber-600">hari</span>
                  </div>
                </div>
              </div>

              {/* Info Bar Klasifikasi Nama & Toko */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-600 font-medium">
                    PIC Terdeteksi:{' '}
                    <strong className="text-slate-900 font-black">
                      {parseResult.summary.stats.matchedUsersCount} Karyawan
                    </strong>
                    {parseResult.summary.newUsersCount > 0 && (
                      <span className="ml-1 text-[10px] text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full font-bold">
                        +{parseResult.summary.newUsersCount} Baru
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-600 font-medium">
                    Toko Cocok Master:{' '}
                    <strong className="text-slate-900 font-black">
                      {parseResult.summary.stats.matchedStoresCount} Toko
                    </strong>
                  </span>
                </div>
              </div>

              {/* D. Filter Preview Tab & Search Bar */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Category Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                    {[
                      { id: 'all', label: 'Semua' },
                      { id: 'visit', label: `Visit Store (${parseResult.summary.stats.visitCount})` },
                      { id: 'nso', label: `NSO (${parseResult.summary.stats.nsoCount})` },
                      { id: 'non-store', label: `Non-Store (${parseResult.summary.stats.nonStoreAgendaCount})` },
                      { id: 'off', label: `OFF (${parseResult.summary.stats.offCount})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setPreviewFilter(tab.id as any)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                          previewFilter === tab.id
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Mini Search */}
                  <div className="relative w-full sm:w-48">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari agenda / nama..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 bg-slate-100 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>

                {/* E. Preview Table Box */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-500 font-extrabold text-[10px] uppercase sticky top-0 z-10">
                      <tr>
                        <th className="py-2 px-3">Tanggal & Jam</th>
                        <th className="py-2 px-3">Nama (PIC)</th>
                        <th className="py-2 px-3">Kategori</th>
                        <th className="py-2 px-3">Lokasi / Toko</th>
                        <th className="py-2 px-3">Deskripsi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {displayedPreviewAgendas.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                            Tidak ada agenda yang cocok dengan filter preview ini.
                          </td>
                        </tr>
                      ) : (
                        displayedPreviewAgendas.slice(0, 100).map((ag, i) => (
                          <tr key={ag.id || i} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-3 whitespace-nowrap font-bold text-slate-900">
                              <div>{ag.date}</div>
                              <div className="text-[10px] text-slate-400">
                                {ag.time} - {ag.endTime || '17:30'}
                              </div>
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap font-bold text-slate-800">
                              {ag.pic}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  ag.category === 'VISIT'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : ag.category === 'NSO'
                                    ? 'bg-purple-100 text-purple-800'
                                    : ag.category === 'OFF' || ag.category === 'CUTI'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-teal-100 text-teal-800'
                                }`}
                              >
                                {ag.category}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-800 max-w-[160px] truncate">
                              {ag.storeName || ag.location}
                            </td>
                            <td className="py-2 px-3 text-slate-600 max-w-[200px] truncate">
                              {ag.title}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {displayedPreviewAgendas.length > 100 && (
                  <p className="text-[10px] text-slate-400 text-right pr-1">
                    Menampilkan 100 dari {displayedPreviewAgendas.length} agenda preview
                  </p>
                )}
              </div>

              {/* F. Opsi Penggabungan (Merge vs Replace) */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div>
                  <span className="font-extrabold text-slate-800 block">Metode Penerapan ke Web:</span>
                  <span className="text-[11px] text-slate-400">
                    Pilih apakah ingin menggabungkan dengan jadwal lama atau mengganti seluruhnya
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition active:scale-95 cursor-pointer ${
                      importMode === 'merge'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    Gabungkan (Merge)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition active:scale-95 cursor-pointer ${
                      importMode === 'replace'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    Ganti Semua (Replace)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. Footer Action */}
        <footer className="px-5 sm:px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={!parseResult || parseResult.summary.agendas.length === 0}
            onClick={handleConfirmImport}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs sm:text-sm font-black shadow-lg shadow-teal-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition active:scale-95 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Terapkan {parseResult?.summary.agendas.length || 0} Jadwal ke Web</span>
          </button>
        </footer>
      </div>
    </div>
  );
};
