import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Download,
  Eye,
  ExternalLink,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileText,
  Cloud,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import {
  UnifiedWebReport,
  exportRowsToExcel,
  formatDisplayDateShort,
} from './adminTypes';
import { AdminMobileSheet } from './AdminMobileSheet';

interface AdminReportsSheetViewProps {
  reports: UnifiedWebReport[];
  todayYmd: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onPreviewWebReport: (report: UnifiedWebReport) => void;
}

const PAGE_SIZE = 100;

export const AdminReportsSheetView: React.FC<AdminReportsSheetViewProps> = ({
  reports,
  todayYmd,
  isRefreshing,
  onRefresh,
  onPreviewWebReport,
}) => {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'CLOUD' | 'GDRIVE'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'VISIT' | 'NSO'>('ALL');
  const [picFilter, setPicFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [showMobileFilter, setShowMobileFilter] = useState(false);

  const activeFilterCount =
    (sourceFilter !== 'ALL' ? 1 : 0) +
    (categoryFilter !== 'ALL' ? 1 : 0) +
    (picFilter !== 'ALL' ? 1 : 0) +
    (monthFilter !== 'ALL' ? 1 : 0);

  const resetFilters = () => {
    setSearch('');
    setSourceFilter('ALL');
    setCategoryFilter('ALL');
    setPicFilter('ALL');
    setMonthFilter('ALL');
  };

  const uniquePics = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      if (r.visitorName && r.visitorName !== '-') set.add(r.visitorName.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [reports]);

  const uniqueMonths = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      if (r.visitDate && r.visitDate.length >= 7) set.add(r.visitDate.slice(0, 7));
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [reports]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (sourceFilter !== 'ALL' && r.source !== sourceFilter) return false;
      if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false;
      if (picFilter !== 'ALL' && r.visitorName.trim() !== picFilter) return false;
      if (monthFilter !== 'ALL' && !r.visitDate.startsWith(monthFilter)) return false;

      if (q) {
        const hay = [
          r.storeCode,
          r.storeName,
          r.visitorName,
          r.fileName,
          r.visitDate,
          r.category,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, search, sourceFilter, categoryFilter, picFilter, monthFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, sourceFilter, categoryFilter, picFilter, monthFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const stats = useMemo(() => {
    let visit = 0;
    let nso = 0;
    let cloud = 0;
    let gdrive = 0;
    for (const r of filtered) {
      if (r.category === 'NSO') nso++;
      else visit++;
      if (r.source === 'CLOUD') cloud++;
      else gdrive++;
    }
    return { total: filtered.length, visit, nso, cloud, gdrive };
  }, [filtered]);

  const handleExportExcel = () => {
    const rows = filtered.map((r, idx) => ({
      No: idx + 1,
      Tanggal: r.visitDate || '-',
      Kategori: r.category,
      'Kode Toko': r.storeCode,
      'Nama Toko': r.storeName,
      Personil: r.visitorName,
      'Actual IN': r.actualIn,
      'Actual OUT': r.actualOut,
      'Jumlah Temuan': r.observationsCount,
      'Jumlah Bukti Foto': r.evidenceCount,
      Sumber: r.source === 'CLOUD' ? 'Cloud App Live' : 'Google Drive Archive',
      Format: r.format,
      Status: r.status,
      'Nama Dokumen': r.fileName,
      'Link Dokumen': r.gdriveViewUrl || '-',
    }));
    exportRowsToExcel(rows, 'Laporan Visit FMCU', `FMCU_Rekap_Laporan_${todayYmd}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full admin-view-enter">
      <div className="bg-white border-y md:border border-slate-200 rounded-none md:rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Mobile Single-Row Compact Toolbar (ZERO stacked buttons) */}
        <div className="md:hidden border-b border-slate-200 bg-white shrink-0">
          <div className="px-3 py-2 flex items-center gap-1.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari laporan, toko, PIC..."
                className="w-full h-9 pl-8 pr-6 rounded-lg border border-slate-200 bg-slate-50/70 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowMobileFilter(true)}
              className={`h-9 px-2.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer ${
                activeFilterCount > 0
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
              title="Filter Laporan"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {activeFilterCount > 0 && (
                <span className="font-mono text-[10.5px] font-bold">{activeFilterCount}</span>
              )}
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
              title="Sinkron Cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 cursor-pointer"
              title="Export Excel Laporan"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-3 py-1.5 border-t border-slate-100 bg-slate-50/70 flex items-center gap-3 text-[11px] overflow-x-auto no-scrollbar whitespace-nowrap">
            <span className="text-slate-600 tabular-nums">
              <strong className="text-slate-900">{stats.total}</strong> Laporan
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600 tabular-nums">
              <strong className="text-emerald-700">{stats.visit}</strong> Visit
            </span>
            <span className="text-slate-600 tabular-nums">
              <strong className="text-amber-600">{stats.nso}</strong> NSO
            </span>
            <span className="text-slate-600 tabular-nums">
              <strong className="text-slate-800">{stats.cloud}</strong> Live
            </span>
          </div>
        </div>

        {/* Desktop Top Row: Compact Inline Stats + Actions */}
        <div className="hidden md:flex px-3.5 py-2.5 border-b border-slate-200 flex-wrap items-center justify-between gap-2.5 bg-white">
          <div className="flex items-center gap-3 sm:gap-4 text-xs overflow-x-auto no-scrollbar">
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="font-bold text-slate-900 text-sm tabular-nums">{stats.total}</span>
              <span className="text-slate-500">Laporan</span>
            </div>
            <span className="h-3.5 w-px bg-slate-200 shrink-0" />
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="font-bold text-emerald-700 tabular-nums">{stats.visit}</span>
              <span className="text-slate-500">Visit</span>
            </div>
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="font-bold text-amber-600 tabular-nums">{stats.nso}</span>
              <span className="text-slate-500">NSO</span>
            </div>
            <span className="h-3.5 w-px bg-slate-200 shrink-0" />
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="font-bold text-slate-800 tabular-nums">{stats.cloud}</span>
              <span className="text-slate-500">Live App</span>
            </div>
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="font-bold text-slate-800 tabular-nums">{stats.gdrive}</span>
              <span className="text-slate-500">GDrive</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              title="Muat ulang laporan terbaru dari Cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Sinkron</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Desktop Filter Bar */}
        <div className="hidden md:flex px-3.5 py-2 border-b border-slate-200 bg-slate-50/70 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari toko, kode, PIC, dokumen..."
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

          <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-[11px] font-medium">
            {(
              [
                ['ALL', 'Semua'],
                ['VISIT', 'Visit'],
                ['NSO', 'NSO'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setCategoryFilter(k)}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  categoryFilter === k
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
          >
            <option value="ALL">Semua Sumber</option>
            <option value="CLOUD">Cloud App Live</option>
            <option value="GDRIVE">Arsip Google Drive</option>
          </select>

          <select
            value={picFilter}
            onChange={(e) => setPicFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 max-w-[165px]"
          >
            <option value="ALL">Semua Personil ({uniquePics.length})</option>
            {uniquePics.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 tabular-nums"
          >
            <option value="ALL">Semua Bulan</option>
            {uniqueMonths.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Spreadsheet Grid */}
        <div className="flex-1 overflow-auto admin-sheet-scroll">
          {paged.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Tidak ada laporan yang cocok dengan filter saat ini.
            </div>
          ) : (
            <>
              <table className="hidden md:table w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2 px-2.5 w-10 text-center border-r border-slate-200/70">#</th>
                    <th className="py-2 px-3 w-28 border-r border-slate-200/70">Tanggal</th>
                    <th className="py-2 px-3 w-24 border-r border-slate-200/70">Kategori</th>
                    <th className="py-2 px-3 border-r border-slate-200/70">Toko & Dokumen</th>
                    <th className="py-2 px-3 w-40 border-r border-slate-200/70">Personil</th>
                    <th className="py-2 px-3 w-28 border-r border-slate-200/70">Sumber</th>
                    <th className="py-2 px-3 w-24 border-r border-slate-200/70">Status</th>
                    <th className="py-2 px-3 w-36 text-right">Lihat di Web</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[12.5px] text-slate-700">
                  {paged.map((r, idx) => {
                    const rowNum = (page - 1) * PAGE_SIZE + idx + 1;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/90 transition-colors">
                        <td className="py-2 px-2.5 text-center text-[11px] font-mono text-slate-400 border-r border-slate-100 tabular-nums">
                          {rowNum}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap font-mono text-[11.5px] text-slate-700 tabular-nums">
                          {formatDisplayDateShort(r.visitDate)}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                              r.category === 'NSO'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {r.category}
                          </span>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 max-w-[340px]">
                          <div className="font-medium text-slate-900 truncate flex items-center gap-1.5">
                            {r.storeCode && r.storeCode !== '-' && (
                              <span className="font-mono text-[10.5px] font-semibold bg-slate-100 text-slate-600 px-1 rounded shrink-0">
                                #{r.storeCode}
                              </span>
                            )}
                            <span className="truncate">{r.storeName}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1.5">
                            <FileText className="w-3 h-3 shrink-0" />
                            <span className="truncate">{r.fileName}</span>
                            {r.observationsCount > 0 && (
                              <span className="text-slate-600 font-medium shrink-0">
                                • {r.observationsCount} temuan
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 font-medium text-slate-800 max-w-[160px] truncate">
                          {r.visitorName}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                              r.source === 'CLOUD' ? 'text-teal-700' : 'text-slate-600'
                            }`}
                          >
                            <Cloud className="w-3 h-3" />
                            <span>{r.source === 'CLOUD' ? 'Cloud Live' : `GDrive ${r.format}`}</span>
                          </span>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold border ${
                              r.status === 'SUBMITTED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {r.status === 'SUBMITTED' ? 'Submitted' : 'Draft'}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onPreviewWebReport(r)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Preview</span>
                            </button>
                            {r.gdriveViewUrl && (
                              <a
                                href={r.gdriveViewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition"
                                title="Buka di Google Drive"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile Compact Flat List */}
              <div className="md:hidden divide-y divide-slate-100">
                {paged.map((r) => (
                  <div key={r.id} className="px-3.5 py-3 bg-white flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[10.5px]">
                        <span
                          className={`px-1.5 py-0.5 rounded font-semibold border ${
                            r.category === 'NSO'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {r.category}
                        </span>
                        <span className="font-mono text-slate-500 tabular-nums">
                          {formatDisplayDateShort(r.visitDate)}
                        </span>
                        <span className="text-slate-400">• {r.source === 'CLOUD' ? 'Cloud' : r.format}</span>
                      </div>
                      <div className="text-[13px] font-semibold text-slate-900 truncate mt-1">
                        {r.storeCode && r.storeCode !== '-' ? `#${r.storeCode} ` : ''}
                        {r.storeName}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {r.visitorName} • {r.fileName}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onPreviewWebReport(r)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-semibold shrink-0 cursor-pointer inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat</span>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-3.5 py-2 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span className="tabular-nums">
            Menampilkan{' '}
            <strong className="text-slate-800">
              {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filtered.length)}
            </strong>{' '}
            dari <strong className="text-slate-800">{filtered.length}</strong> dokumen laporan
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

      {/* Mobile Filter Sheet */}
      <AdminMobileSheet
        isOpen={showMobileFilter}
        title="Filter Laporan"
        onClose={() => setShowMobileFilter(false)}
        onReset={resetFilters}
        hasActiveFilters={activeFilterCount > 0 || Boolean(search.trim())}
      >
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Kategori Laporan
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ['ALL', 'Semua'],
                ['VISIT', 'Visit'],
                ['NSO', 'NSO'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setCategoryFilter(k)}
                className={`py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                  categoryFilter === k
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Sumber Data
          </label>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
          >
            <option value="ALL">Semua Sumber</option>
            <option value="CLOUD">Cloud App Live</option>
            <option value="GDRIVE">Arsip Google Drive</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Personil
            </label>
            <select
              value={picFilter}
              onChange={(e) => setPicFilter(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
            >
              <option value="ALL">Semua</option>
              {uniquePics.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Bulan
            </label>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 tabular-nums"
            >
              <option value="ALL">Semua</option>
              {uniqueMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AdminMobileSheet>
    </div>
  );
};
