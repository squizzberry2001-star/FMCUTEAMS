import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Upload,
  Download,
  FileText,
  FileSpreadsheet,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  AlertTriangle,
  Cloud,
  RefreshCw,
} from 'lucide-react';
import {
  MasterStore,
  MasterStoreMetadata,
  mergeMasterStores,
  saveMasterStoresDurable,
} from '../../data/masterStoresData';
import {
  parseMasterStoreExcelFile,
  exportMasterStoresToExcel,
  downloadMasterStoreTemplateExcel,
} from '../../services/scheduleExcelService';
import { parseMasterStorePdfFile } from '../../services/masterStorePdfService';
import { pushMasterStoresToCloud } from '../../services/cloudScheduleSyncService';

interface AdminMasterStoreViewProps {
  masterStores: MasterStore[];
  masterStoreMeta: MasterStoreMetadata | null;
  adminName: string;
  onMasterStoresUpdated: (stores: MasterStore[], meta: MasterStoreMetadata) => void;
}

interface ParsedImportState {
  sourceType: 'PDF' | 'EXCEL';
  fileName: string;
  infoLabel: string;
  detectedColumns: string[];
  warnings: string[];
  incomingStores: Partial<MasterStore>[];
  sheetNames?: string[];
  activeSheet?: string;
}

const PAGE_SIZE = 100;

export const AdminMasterStoreView: React.FC<AdminMasterStoreViewProps> = ({
  masterStores,
  masterStoreMeta,
  adminName,
  onMasterStoresUpdated,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Import Drawer State (PDF & Excel unified)
  const [showImportDrawer, setShowImportDrawer] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedImport, setParsedImport] = useState<ParsedImportState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; title: string; detail: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const uniqueTypes = useMemo(() => {
    const set = new Set<string>();
    masterStores.forEach((s) => {
      if (s.type) set.add(s.type.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [masterStores]);

  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    masterStores.forEach((s) => {
      if (s.city) set.add(s.city.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [masterStores]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return masterStores.filter((s) => {
      if (typeFilter !== 'ALL' && (s.type || '').trim() !== typeFilter) return false;
      if (cityFilter !== 'ALL' && (s.city || '').trim() !== cityFilter) return false;
      if (q) {
        const hay = [
          s.code,
          s.name,
          s.type,
          s.city,
          s.address,
          s.storeHead,
          s.areaManager,
          s.regionalManager,
          s.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [masterStores, search, typeFilter, cityFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, cityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Live merge diff preview for Import Drawer
  const liveMergePreview = useMemo(() => {
    if (!parsedImport) return null;
    return mergeMasterStores(masterStores, parsedImport.incomingStores, importMode);
  }, [parsedImport, masterStores, importMode]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRawFile(file);
    setParseError(null);
    setParsedImport(null);
    setIsParsing(true);

    try {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
        const res = await parseMasterStorePdfFile(file, masterStores, importMode);
        setParsedImport({
          sourceType: 'PDF',
          fileName: res.fileName,
          infoLabel: `${res.pageCount} halaman PDF • Mode ${
            res.extractionMode === 'tabular' ? 'Tabel Terstruktur' : 'Auto-Pola'
          }`,
          detectedColumns: res.detectedColumns,
          warnings: res.warnings,
          incomingStores: res.incomingStores,
        });
      } else {
        const res = await parseMasterStoreExcelFile(file, masterStores, importMode);
        const warnings = res.invalidRows
          .slice(0, 5)
          .map((r) => `Baris ${r.row}: ${r.reason}`);
        if (res.invalidRows.length > 5) {
          warnings.push(`...dan ${res.invalidRows.length - 5} baris dilewati.`);
        }
        setParsedImport({
          sourceType: 'EXCEL',
          fileName: file.name,
          infoLabel: `Sheet "${res.sheetName}" (${res.incomingStores.length} toko valid)`,
          detectedColumns: Object.values(res.detectedColumns || {}),
          warnings,
          incomingStores: res.incomingStores,
          sheetNames: res.availableSheets,
          activeSheet: res.sheetName,
        });
      }
    } catch (err: any) {
      setParseError(err?.message || 'Gagal membaca file Master Store.');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSwitchExcelSheet = async (sheetName: string) => {
    if (!rawFile) return;
    setIsParsing(true);
    setParseError(null);
    try {
      const res = await parseMasterStoreExcelFile(rawFile, masterStores, importMode, sheetName);
      const warnings = res.invalidRows
        .slice(0, 5)
        .map((r) => `Baris ${r.row}: ${r.reason}`);
      if (res.invalidRows.length > 5) {
        warnings.push(`...dan ${res.invalidRows.length - 5} baris dilewati.`);
      }
      setParsedImport({
        sourceType: 'EXCEL',
        fileName: rawFile.name,
        infoLabel: `Sheet "${res.sheetName}" (${res.incomingStores.length} toko valid)`,
        detectedColumns: Object.values(res.detectedColumns || {}),
        warnings,
        incomingStores: res.incomingStores,
        sheetNames: res.availableSheets,
        activeSheet: res.sheetName,
      });
    } catch (err: any) {
      setParseError(err?.message || `Gagal membaca sheet ${sheetName}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveImport = async () => {
    if (!parsedImport || !liveMergePreview || isSaving) return;
    setIsSaving(true);
    setBanner(null);

    try {
      const nextStores = liveMergePreview.stores;
      const savedMeta = await saveMasterStoresDurable(nextStores, {
        updatedBy: adminName || 'Admin FMCU',
        sourceFilename: parsedImport.fileName,
        totalStores: nextStores.length,
        addedCount: liveMergePreview.addedCount,
        updatedCount: liveMergePreview.updatedCount,
        cloudSynced: false,
      });

      onMasterStoresUpdated(nextStores, savedMeta);

      const cloudRes = await pushMasterStoresToCloud(nextStores, savedMeta, { mode: importMode });
      if (cloudRes.ok) {
        const syncedMeta = await saveMasterStoresDurable(nextStores, {
          ...savedMeta,
          version: savedMeta.version,
          updatedAt: savedMeta.updatedAt,
          cloudSynced: true,
        });
        onMasterStoresUpdated(nextStores, syncedMeta);
        setBanner({
          ok: true,
          title: `Master Store diperbarui (${nextStores.length} toko • +${liveMergePreview.addedCount} baru, ~${liveMergePreview.updatedCount} update)`,
          detail: `Sumber: ${parsedImport.sourceType} (${parsedImport.fileName}) • Cloud D1: ${
            cloudRes.d1Synced ? 'OK' : 'Pending'
          }`,
        });
        setShowImportDrawer(false);
        setParsedImport(null);
        setRawFile(null);
      } else {
        setBanner({
          ok: false,
          title: `Tersimpan lokal (${nextStores.length} toko), sinkronisasi cloud tertunda`,
          detail: cloudRes.error || 'Klik Sync Cloud saat koneksi stabil.',
        });
        setShowImportDrawer(false);
      }
    } catch (err: any) {
      setParseError(err?.message || 'Gagal menyimpan data Master Store.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualCloudSync = async () => {
    if (isSyncingCloud) return;
    setIsSyncingCloud(true);
    try {
      const meta: MasterStoreMetadata = masterStoreMeta || {
        version: Date.now(),
        updatedAt: new Date().toISOString(),
        updatedBy: adminName || 'Admin FMCU',
        totalStores: masterStores.length,
        addedCount: 0,
        updatedCount: 0,
        cloudSynced: false,
      };
      const res = await pushMasterStoresToCloud(masterStores, meta, { mode: 'replace' });
      if (res.ok) {
        const synced = await saveMasterStoresDurable(masterStores, { ...meta, cloudSynced: true });
        onMasterStoresUpdated(masterStores, synced);
        setBanner({
          ok: true,
          title: `Master Store tersinkronisasi (${masterStores.length} toko)`,
          detail: `Cloudflare D1: ${res.d1Synced ? 'OK' : 'Pending'} • Backup GAS: ${
            res.gasSynced ? 'OK' : 'Berjalan di latar'
          }`,
        });
      } else {
        setBanner({
          ok: false,
          title: 'Sinkronisasi cloud gagal',
          detail: res.error || 'Coba ulang beberapa saat lagi.',
        });
      }
    } finally {
      setIsSyncingCloud(false);
    }
  };

  return (
    <div className="flex flex-col h-full admin-view-enter">
      {banner && (
        <div
          className={`mb-3 px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            banner.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <div className="min-w-0">
            <span className="font-semibold">{banner.title}</span>
            <span className="ml-2 opacity-80">{banner.detail}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="p-1 rounded-md hover:bg-black/5 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Top Row: Compact Inline Stats + Actions */}
        <div className="px-3.5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 bg-white">
          <div className="flex items-center gap-3 sm:gap-4 text-xs overflow-x-auto no-scrollbar">
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="font-bold text-slate-900 text-sm tabular-nums">{masterStores.length}</span>
              <span className="text-slate-500">Total Toko</span>
            </div>
            <span className="h-3.5 w-px bg-slate-200 shrink-0" />
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="font-bold text-slate-800 tabular-nums">{uniqueCities.length}</span>
              <span className="text-slate-500">Kota</span>
            </div>
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="font-bold text-slate-800 tabular-nums">{uniqueTypes.length}</span>
              <span className="text-slate-500">Tipe</span>
            </div>
            {masterStoreMeta && (
              <>
                <span className="h-3.5 w-px bg-slate-200 shrink-0 hidden sm:block" />
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                  <Cloud
                    className={`w-3.5 h-3.5 ${
                      masterStoreMeta.cloudSynced ? 'text-emerald-600' : 'text-amber-500'
                    }`}
                  />
                  <span>
                    {masterStoreMeta.cloudSynced ? 'Cloud Synced' : 'Lokal (Belum Sync)'}
                  </span>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setParseError(null);
                setShowImportDrawer(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload PDF / Excel</span>
            </button>

            <button
              type="button"
              onClick={handleManualCloudSync}
              disabled={isSyncingCloud}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              title="Sinkronkan Master Toko ke Cloudflare D1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>

            <div className="relative" ref={exportRef}>
              <button
                type="button"
                onClick={() => setShowExportMenu((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Export</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      exportMasterStoresToExcel(filtered);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Export Master Toko ({filtered.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false);
                      downloadMasterStoreTemplateExcel();
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Unduh Template Excel</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-3.5 py-2 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode, nama toko, kota, AM, RM..."
              className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
          >
            <option value="ALL">Semua Tipe ({uniqueTypes.length})</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 max-w-[180px]"
          >
            <option value="ALL">Semua Kota ({uniqueCities.length})</option>
            {uniqueCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Spreadsheet Grid */}
        <div className="flex-1 overflow-auto admin-sheet-scroll">
          {paged.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Tidak ada toko yang cocok dengan pencarian.
            </div>
          ) : (
            <>
              <table className="hidden md:table w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2 px-2.5 w-10 text-center border-r border-slate-200/70">#</th>
                    <th className="py-2 px-3 w-20 border-r border-slate-200/70">Kode</th>
                    <th className="py-2 px-3 border-r border-slate-200/70">Nama Toko & Alamat</th>
                    <th className="py-2 px-3 w-28 border-r border-slate-200/70">Tipe / Kota</th>
                    <th className="py-2 px-3 w-44 border-r border-slate-200/70">Store Head</th>
                    <th className="py-2 px-3 w-48 border-r border-slate-200/70">AM / RM</th>
                    <th className="py-2 px-3 w-32 text-right">Koordinat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[12.5px] text-slate-700">
                  {paged.map((st, idx) => {
                    const rowNum = (page - 1) * PAGE_SIZE + idx + 1;
                    const hasGps = Boolean(st.lat && st.lng);
                    return (
                      <tr key={st.code} className="hover:bg-slate-50/90 transition-colors">
                        <td className="py-2 px-2.5 text-center text-[11px] font-mono text-slate-400 border-r border-slate-100 tabular-nums">
                          {rowNum}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 font-mono text-xs font-semibold text-emerald-700 whitespace-nowrap">
                          {st.code}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 max-w-[320px]">
                          <div className="font-semibold text-slate-900 truncate">{st.name}</div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5" title={st.address}>
                            {st.address || '-'}
                          </div>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10.5px] font-semibold">
                            {st.type || 'CVS'}
                          </span>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[110px]">
                            {st.city || '-'}
                          </div>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 max-w-[175px]">
                          <div className="font-medium text-slate-800 truncate">{st.storeHead || '-'}</div>
                          <div className="text-[11px] font-mono text-slate-400 truncate">
                            {st.storePhone || st.email || '-'}
                          </div>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 max-w-[190px]">
                          <div className="text-[11.5px] text-slate-700 truncate">
                            <span className="text-slate-400 mr-1">AM:</span>
                            {st.areaManager || '-'}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            <span className="text-slate-400 mr-1">RM:</span>
                            {st.regionalManager || '-'}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap font-mono text-[11px] tabular-nums">
                          {hasGps ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${st.lat},${st.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-slate-600 hover:text-emerald-700 transition"
                              title="Buka di Google Maps"
                            >
                              <span>
                                {st.lat.toFixed(3)}, {st.lng.toFixed(3)}
                              </span>
                              <ExternalLink className="w-3 h-3 opacity-60" />
                            </a>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile Compact Flat List */}
              <div className="md:hidden divide-y divide-slate-100">
                {paged.map((st) => (
                  <div key={st.code} className="px-3.5 py-3 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-bold text-emerald-700">
                            #{st.code}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                            {st.type || 'CVS'}
                          </span>
                          <span className="text-[11px] text-slate-400 truncate">{st.city}</span>
                        </div>
                        <div className="text-[13px] font-semibold text-slate-900 mt-0.5 truncate">
                          {st.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          SH: {st.storeHead || '-'} • AM: {st.areaManager || '-'}
                        </div>
                      </div>
                      {st.lat !== 0 && st.lng !== 0 && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${st.lat},${st.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="px-3.5 py-2 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span className="tabular-nums">
            Menampilkan{' '}
            <strong className="text-slate-800">
              {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filtered.length)}
            </strong>{' '}
            dari <strong className="text-slate-800">{filtered.length}</strong> toko
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono font-semibold text-slate-700">
                {page}/{totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================
          SLIDE-OVER DRAWER: UPLOAD MASTER STORE BY PDF (OR EXCEL)
          ================================================================ */}
      {showImportDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end items-end sm:items-stretch">
          <div
            className="fixed inset-0 bg-slate-900/35 backdrop-blur-[2px]"
            onClick={() => !isSaving && setShowImportDrawer(false)}
          />

          <div className="relative z-10 w-full sm:max-w-[540px] bg-white h-[92vh] sm:h-full rounded-t-2xl sm:rounded-none sm:border-l border-slate-200 flex flex-col shadow-2xl admin-sheet-up sm:admin-drawer-right overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Update Master Store via PDF / Excel
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Ekstraksi tabel otomatis dari dokumen PDF berbasis teks atau file Excel (.xlsx/.csv).
                </p>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setShowImportDrawer(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto admin-sheet-scroll px-5 py-4 space-y-4">
              {/* Dropzone / File Picker */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf,.xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing || isSaving}
                className="w-full p-5 rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-900 hover:bg-slate-50/70 transition flex flex-col items-center justify-center text-center gap-2 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  {isParsing ? (
                    <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                  ) : (
                    <FileText className="w-5 h-5 text-slate-700" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {isParsing
                      ? 'Membaca & mengekstrak tabel Master Store...'
                      : 'Pilih File PDF Master Store (atau Excel .xlsx)'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Mendukung kolom Kode Toko, Nama Toko, Tipe, Kota, Alamat, GPS, SH, AM, RM
                  </div>
                </div>
              </button>

              {parseError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{parseError}</span>
                </div>
              )}

              {parsedImport && liveMergePreview && (
                <div className="space-y-3.5">
                  {/* Source Info */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            parsedImport.sourceType === 'PDF'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {parsedImport.sourceType}
                        </span>
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {parsedImport.fileName}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0">
                        {parsedImport.incomingStores.length} toko
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">{parsedImport.infoLabel}</div>

                    {/* Excel Sheet Switcher if multi-sheet */}
                    {parsedImport.sheetNames && parsedImport.sheetNames.length > 1 && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[11px] font-medium text-slate-500">Sheet:</span>
                        <select
                          value={parsedImport.activeSheet}
                          onChange={(e) => handleSwitchExcelSheet(e.target.value)}
                          className="px-2 py-1 rounded-md border border-slate-200 bg-white text-xs text-slate-800"
                        >
                          {parsedImport.sheetNames.map((sn) => (
                            <option key={sn} value={sn}>
                              {sn}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Mode Toggle */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setImportMode('merge')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        importMode === 'merge'
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-bold">Gabung & Perbarui</div>
                      <div
                        className={`text-[10.5px] mt-0.5 ${
                          importMode === 'merge' ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        Tambah baru & update kode cocok
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('replace')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        importMode === 'replace'
                          ? 'border-rose-600 bg-rose-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-bold">Timpa Semua Data</div>
                      <div
                        className={`text-[10.5px] mt-0.5 ${
                          importMode === 'replace' ? 'text-rose-100' : 'text-slate-500'
                        }`}
                      >
                        Ganti seluruh master dengan file ini
                      </div>
                    </button>
                  </div>

                  {/* Diff Summary Bar */}
                  <div className="grid grid-cols-4 border border-slate-200 rounded-xl divide-x divide-slate-200 text-center bg-white">
                    <div className="py-2">
                      <div className="text-sm font-bold text-emerald-700 tabular-nums">
                        +{liveMergePreview.addedCount}
                      </div>
                      <div className="text-[10px] text-slate-500">Baru</div>
                    </div>
                    <div className="py-2">
                      <div className="text-sm font-bold text-amber-600 tabular-nums">
                        ~{liveMergePreview.updatedCount}
                      </div>
                      <div className="text-[10px] text-slate-500">Update</div>
                    </div>
                    <div className="py-2">
                      <div className="text-sm font-bold text-slate-500 tabular-nums">
                        {liveMergePreview.unchangedCount}
                      </div>
                      <div className="text-[10px] text-slate-500">Sama</div>
                    </div>
                    <div className="py-2">
                      <div className="text-sm font-bold text-slate-900 tabular-nums">
                        {liveMergePreview.stores.length}
                      </div>
                      <div className="text-[10px] text-slate-500">Total Akhir</div>
                    </div>
                  </div>

                  {parsedImport.warnings.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 space-y-1">
                      {parsedImport.warnings.map((w, i) => (
                        <div key={i}>• {w}</div>
                      ))}
                    </div>
                  )}

                  {/* Mini Spreadsheet Preview */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      Pratinjau Data Terbaca (20 baris pertama)
                    </div>
                    <div className="max-h-56 overflow-auto admin-sheet-scroll">
                      <table className="w-full border-collapse text-left text-[11.5px]">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[10px] uppercase text-slate-500">
                          <tr>
                            <th className="py-1.5 px-2.5">Kode</th>
                            <th className="py-1.5 px-2.5">Nama Toko</th>
                            <th className="py-1.5 px-2.5">Tipe</th>
                            <th className="py-1.5 px-2.5">Kota</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedImport.incomingStores.slice(0, 20).map((s) => (
                            <tr key={s.code}>
                              <td className="py-1.5 px-2.5 font-mono font-semibold text-emerald-700">
                                {s.code}
                              </td>
                              <td className="py-1.5 px-2.5 font-medium text-slate-800">{s.name}</td>
                              <td className="py-1.5 px-2.5 text-slate-500">{s.type}</td>
                              <td className="py-1.5 px-2.5 text-slate-500">{s.city || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setShowImportDrawer(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!parsedImport || !liveMergePreview || isSaving}
                onClick={handleSaveImport}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan ke Cloud...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan & Sinkronkan Cloud</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
