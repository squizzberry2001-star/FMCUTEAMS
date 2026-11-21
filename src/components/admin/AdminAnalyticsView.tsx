import React, { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { User } from '../../types';
import { MasterStore, isSamePersonName } from '../../data/masterStoresData';
import {
  ActivityKind,
  ClassifiedAgenda,
  UnifiedWebReport,
  exportRowsToExcel,
  formatLocalYmd,
} from './adminTypes';

interface AdminAnalyticsViewProps {
  classifiedAgendas: ClassifiedAgenda[];
  unifiedReports: UnifiedWebReport[];
  users: User[];
  masterStores: MasterStore[];
  todayYmd: string;
}

type PeriodScope = 'all' | 'month' | '30d' | 'week';

const KIND_LABELS: Record<ActivityKind, { label: string; bar: string }> = {
  VISIT: { label: 'Visit Toko', bar: 'bg-emerald-500' },
  NSO: { label: 'NSO Toko Baru', bar: 'bg-amber-500' },
  MEETING: { label: 'Meeting', bar: 'bg-blue-500' },
  TRAINING: { label: 'Training', bar: 'bg-cyan-500' },
  AUDIT: { label: 'Audit', bar: 'bg-violet-500' },
  OPERATION: { label: 'Operasional', bar: 'bg-teal-500' },
  OTHER: { label: 'Work Plan / Lainnya', bar: 'bg-indigo-500' },
  LEAVE: { label: 'Cuti / Izin', bar: 'bg-rose-400' },
  OFF: { label: 'Off / Libur', bar: 'bg-slate-300' },
};

export const AdminAnalyticsView: React.FC<AdminAnalyticsViewProps> = ({
  classifiedAgendas,
  unifiedReports,
  users,
  masterStores,
  todayYmd,
}) => {
  const [period, setPeriod] = useState<PeriodScope>('all');

  const { weekStart, weekEnd, monthPrefix, thirtyDaysAgo } = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const past30 = new Date(now);
    past30.setDate(now.getDate() - 30);
    return {
      weekStart: formatLocalYmd(mon),
      weekEnd: formatLocalYmd(sun),
      monthPrefix: todayYmd.slice(0, 7),
      thirtyDaysAgo: formatLocalYmd(past30),
    };
  }, [todayYmd]);

  const scopedAgendas = useMemo(() => {
    return classifiedAgendas.filter((item) => {
      const d = item.agenda.date || '';
      if (period === 'month') return d.startsWith(monthPrefix);
      if (period === 'week') return d >= weekStart && d <= weekEnd;
      if (period === '30d') return d >= thirtyDaysAgo && d <= todayYmd;
      return true;
    });
  }, [classifiedAgendas, period, monthPrefix, weekStart, weekEnd, thirtyDaysAgo, todayYmd]);

  const scopedReports = useMemo(() => {
    return unifiedReports.filter((r) => {
      const d = r.visitDate || '';
      if (period === 'month') return d.startsWith(monthPrefix);
      if (period === 'week') return d >= weekStart && d <= weekEnd;
      if (period === '30d') return d >= thirtyDaysAgo && d <= todayYmd;
      return true;
    });
  }, [unifiedReports, period, monthPrefix, weekStart, weekEnd, thirtyDaysAgo, todayYmd]);

  const kpi = useMemo(() => {
    const activeWork = scopedAgendas.filter((a) => a.kind !== 'OFF' && a.kind !== 'LEAVE');
    const visitAndNso = scopedAgendas.filter((a) => a.kind === 'VISIT' || a.kind === 'NSO');
    const completedWork = activeWork.filter((a) => a.status.code === 'COMPLETED');
    const kendalaCount = scopedAgendas.filter((a) => Boolean(a.agenda.kendala)).length;
    const completionPct =
      activeWork.length > 0 ? Math.round((completedWork.length / activeWork.length) * 100) : 0;

    return {
      totalAgendas: scopedAgendas.length,
      visitAndNsoCount: visitAndNso.length,
      completedCount: completedWork.length,
      activeWorkCount: activeWork.length,
      completionPct,
      reportsCount: scopedReports.length,
      kendalaCount,
    };
  }, [scopedAgendas, scopedReports]);

  const categoryDistribution = useMemo(() => {
    const counts = new Map<ActivityKind, number>();
    scopedAgendas.forEach((a) => counts.set(a.kind, (counts.get(a.kind) || 0) + 1));
    const total = Math.max(1, scopedAgendas.length);
    return (Object.keys(KIND_LABELS) as ActivityKind[])
      .map((kind) => ({
        kind,
        label: KIND_LABELS[kind].label,
        bar: KIND_LABELS[kind].bar,
        count: counts.get(kind) || 0,
        pct: Math.round(((counts.get(kind) || 0) / total) * 100),
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [scopedAgendas]);

  const storeTypeDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    masterStores.forEach((s) => {
      const tp = (s.type || 'CVS').trim() || 'CVS';
      counts.set(tp, (counts.get(tp) || 0) + 1);
    });
    const total = Math.max(1, masterStores.length);
    return Array.from(counts.entries())
      .map(([type, count]) => ({
        type,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [masterStores]);

  // Personnel leaderboard table
  const personnelSummary = useMemo(() => {
    const staff = users.filter((u) => !u.isAdmin && !u.isExecutiveViewer);
    const picNames = new Set<string>(staff.map((u) => u.name.trim()));
    scopedAgendas.forEach((a) => {
      if (a.agenda.pic) picNames.add(a.agenda.pic.trim());
    });

    return Array.from(picNames)
      .map((name) => {
        const rows = scopedAgendas.filter((a) => isSamePersonName(a.agenda.pic, name));
        const reports = scopedReports.filter((r) => isSamePersonName(r.visitorName, name));
        const visit = rows.filter((a) => a.kind === 'VISIT').length;
        const nso = rows.filter((a) => a.kind === 'NSO').length;
        const nonField = rows.filter(
          (a) =>
            a.kind === 'MEETING' ||
            a.kind === 'TRAINING' ||
            a.kind === 'AUDIT' ||
            a.kind === 'OPERATION' ||
            a.kind === 'OTHER'
        ).length;
        const workable = rows.filter((a) => a.kind !== 'OFF' && a.kind !== 'LEAVE');
        const completed = workable.filter((a) => a.status.code === 'COMPLETED').length;
        const kendala = rows.filter((a) => Boolean(a.agenda.kendala)).length;
        const pct = workable.length > 0 ? Math.round((completed / workable.length) * 100) : 0;

        return {
          name,
          total: rows.length,
          visit,
          nso,
          nonField,
          completed,
          workable: workable.length,
          reportsCount: reports.length,
          kendala,
          pct,
        };
      })
      .filter((r) => r.total > 0 || r.reportsCount > 0)
      .sort((a, b) => b.visit + b.nso + b.reportsCount - (a.visit + a.nso + a.reportsCount));
  }, [users, scopedAgendas, scopedReports]);

  const handleExportAnalytics = () => {
    const rows = personnelSummary.map((p, idx) => ({
      No: idx + 1,
      Personil: p.name,
      'Total Agenda': p.total,
      'Visit Toko': p.visit,
      NSO: p.nso,
      'Meeting / Training / Ops': p.nonField,
      Selesai: p.completed,
      'Agenda Kerja': p.workable,
      'Tingkat Penyelesaian (%)': `${p.pct}%`,
      'Laporan Terverifikasi': p.reportsCount,
      Kendala: p.kendala,
    }));
    exportRowsToExcel(rows, 'Analitik Tim FMCU', `FMCU_Analitik_Performa_${todayYmd}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto admin-sheet-scroll admin-view-enter pb-2">
      {/* Top Compact Toolbar + Unified KPI Strip */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0">
        <div className="px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5 text-[11px] font-medium">
            {(
              [
                ['all', 'Semua Periode'],
                ['month', 'Bulan Ini'],
                ['30d', '30 Hari'],
                ['week', 'Minggu Ini'],
              ] as [PeriodScope, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setPeriod(k)}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  period === k
                    ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportAnalytics}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Analitik</span>
          </button>
        </div>

        {/* Clean 4-Metric Flat Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-slate-200">
          <div className="px-4 py-3.5">
            <div className="text-[11px] font-medium text-slate-500">Total Agenda</div>
            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {kpi.totalAgendas}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
              {kpi.activeWorkCount} jadwal aktif kerja
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="text-[11px] font-medium text-slate-500">Visit & NSO Toko</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
              {kpi.visitAndNsoCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
              {kpi.kendalaCount > 0 ? `${kpi.kendalaCount} catatan kendala` : '0 kendala tercatat'}
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="text-[11px] font-medium text-slate-500">Penyelesaian Jadwal</div>
            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {kpi.completionPct}%
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
              {kpi.completedCount} dari {kpi.activeWorkCount} selesai
            </div>
          </div>

          <div className="px-4 py-3.5">
            <div className="text-[11px] font-medium text-slate-500">Laporan Terverifikasi</div>
            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {kpi.reportsCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
              Cloud App + Arsip Google Drive
            </div>
          </div>
        </div>
      </div>

      {/* Distribution Grid (2 Flat Bordered Panels) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 shrink-0">
        {/* Category Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Distribusi Kategori Kegiatan
            </h3>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
              {scopedAgendas.length} total
            </span>
          </div>
          {categoryDistribution.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Belum ada data pada periode ini.</p>
          ) : (
            <div className="space-y-2.5">
              {categoryDistribution.map((row) => (
                <div key={row.kind} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{row.label}</span>
                    <span className="font-mono text-[11.5px] text-slate-600 tabular-nums">
                      <strong className="text-slate-900">{row.count}</strong> ({row.pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${row.bar}`}
                      style={{ width: `${Math.max(row.pct, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Store Type Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Komposisi Master Store
            </h3>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
              {masterStores.length} toko
            </span>
          </div>
          <div className="space-y-2.5">
            {storeTypeDistribution.map((row) => (
              <div key={row.type} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{row.type}</span>
                  <span className="font-mono text-[11.5px] text-slate-600 tabular-nums">
                    <strong className="text-slate-900">{row.count}</strong> ({row.pct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-slate-800 transition-all duration-300"
                    style={{ width: `${Math.max(row.pct, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spreadsheet-Style Personnel Performance Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0">
        <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Rekap Produktivitas & Laporan per Personil
          </h3>
          <span className="text-[11px] text-slate-400 tabular-nums">
            {personnelSummary.length} personil aktif
          </span>
        </div>

        <div className="overflow-x-auto admin-sheet-scroll">
          <table className="w-full border-collapse text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 px-3 w-10 text-center border-r border-slate-200/70">#</th>
                <th className="py-2 px-3 border-r border-slate-200/70">Personil</th>
                <th className="py-2 px-3 text-right border-r border-slate-200/70">Total</th>
                <th className="py-2 px-3 text-right border-r border-slate-200/70">Visit</th>
                <th className="py-2 px-3 text-right border-r border-slate-200/70">NSO</th>
                <th className="py-2 px-3 text-right border-r border-slate-200/70">Non-Visit</th>
                <th className="py-2 px-3 text-right border-r border-slate-200/70">Laporan</th>
                <th className="py-2 px-3 text-right border-r border-slate-200/70">Kendala</th>
                <th className="py-2 px-3 w-36">Penyelesaian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[12.5px] text-slate-700">
              {personnelSummary.map((p, idx) => (
                <tr key={p.name} className="hover:bg-slate-50/90 transition-colors">
                  <td className="py-2 px-3 text-center text-[11px] font-mono text-slate-400 border-r border-slate-100 tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3 font-medium text-slate-900 border-r border-slate-100 whitespace-nowrap">
                    {p.name}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums border-r border-slate-100">
                    {p.total}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700 tabular-nums border-r border-slate-100">
                    {p.visit}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-amber-600 tabular-nums border-r border-slate-100">
                    {p.nso}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-slate-500 tabular-nums border-r border-slate-100">
                    {p.nonField}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums border-r border-slate-100">
                    {p.reportsCount}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums border-r border-slate-100">
                    {p.kendala > 0 ? (
                      <span className="text-rose-600 font-semibold">{p.kendala}</span>
                    ) : (
                      <span className="text-slate-300">0</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{ width: `${p.pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono font-semibold text-slate-600 w-9 text-right tabular-nums">
                        {p.pct}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
