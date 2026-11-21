import React, { useState, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  MapPin,
  Download,
  UserPlus,
  KeyRound,
  Eye,
  X,
  Check,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';
import { User, VisitReportData } from '../../types';
import { isSamePersonName } from '../../data/masterStoresData';
import {
  UserLivePresence,
  getUserPresenceDetailedStatus,
} from '../../services/userLivePresenceService';
import { ClassifiedAgenda, exportRowsToExcel } from './adminTypes';
import { AdminMobileSheet } from './AdminMobileSheet';

interface AdminLiveMonitorViewProps {
  users: User[];
  livePresences: UserLivePresence[];
  todayClassifiedAgendas: ClassifiedAgenda[];
  todayYmd: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenLiveMaps?: () => void;
  onPreviewReport: (report: VisitReportData) => void;
  onAddUser?: (newUser: User) => void;
  onResetUserPassword?: (userName: string) => void;
}

export const AdminLiveMonitorView: React.FC<AdminLiveMonitorViewProps> = ({
  users,
  livePresences,
  todayClassifiedAgendas,
  todayYmd,
  isRefreshing,
  onRefresh,
  onOpenLiveMaps,
  onPreviewReport,
  onAddUser,
  onResetUserPassword,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'SCHEDULED' | 'STANDBY'>('ALL');
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newNik, setNewNik] = useState('');
  const [newRole, setNewRole] = useState('FMCU Field Specialist');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const staffUsers = useMemo(
    () =>
      users
        .filter((u) => !u.isAdmin && !u.isExecutiveViewer)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  // Build actual integrated user rows (users + live GPS presence + today's agendas + today's reports)
  const integratedRows = useMemo(() => {
    const now = Date.now();
    return staffUsers
      .map((u) => {
        const presence = livePresences.find((p) => isSamePersonName(p.userName, u.name)) || null;
        const presenceStatus = getUserPresenceDetailedStatus(presence, now);

        const todayAgendas = todayClassifiedAgendas.filter((item) =>
          isSamePersonName(item.agenda.pic, u.name)
        );
        const primaryAgenda =
          todayAgendas.find((a) => a.kind === 'VISIT' || a.kind === 'NSO') || todayAgendas[0] || null;

        const actualIn =
          todayAgendas.find((a) => a.agenda.actualIn || a.report?.actualIn)?.agenda.actualIn ||
          todayAgendas.find((a) => a.report?.actualIn)?.report?.actualIn ||
          '-';
        const actualOut =
          todayAgendas.find((a) => a.agenda.actualOut || a.report?.actualOut)?.agenda.actualOut ||
          todayAgendas.find((a) => a.report?.actualOut)?.report?.actualOut ||
          '-';

        const reportToday = todayAgendas.find((a) => a.report)?.report || null;
        const submittedCount = todayAgendas.filter((a) => a.report?.status === 'SUBMITTED').length;
        const requiredReportCount = todayAgendas.filter((a) => a.requiresReport).length;

        return {
          user: u,
          presence,
          presenceStatus,
          todayAgendas,
          primaryAgenda,
          actualIn,
          actualOut,
          reportToday,
          submittedCount,
          requiredReportCount,
        };
      })
      .sort((a, b) => {
        // Online first, then checked-in, then scheduled, then alphabetical
        if (a.presenceStatus.isOnline !== b.presenceStatus.isOnline) {
          return a.presenceStatus.isOnline ? -1 : 1;
        }
        const aIn = a.actualIn !== '-' ? 1 : 0;
        const bIn = b.actualIn !== '-' ? 1 : 0;
        if (aIn !== bIn) return bIn - aIn;
        if (a.todayAgendas.length !== b.todayAgendas.length) {
          return b.todayAgendas.length - a.todayAgendas.length;
        }
        return a.user.name.localeCompare(b.user.name);
      });
  }, [staffUsers, livePresences, todayClassifiedAgendas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return integratedRows.filter((row) => {
      if (statusFilter === 'ONLINE' && !row.presenceStatus.isOnline) return false;
      if (statusFilter === 'SCHEDULED' && row.todayAgendas.length === 0) return false;
      if (statusFilter === 'STANDBY' && row.presenceStatus.isOnline) return false;

      if (q) {
        const hay = [
          row.user.name,
          row.user.role,
          row.user.nik,
          row.user.email,
          row.primaryAgenda?.agenda.title,
          row.primaryAgenda?.agenda.storeName,
          row.primaryAgenda?.agenda.storeCode,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [integratedRows, search, statusFilter]);

  const stats = useMemo(() => {
    let online = 0;
    let checkedIn = 0;
    let scheduledToday = 0;
    let submittedReports = 0;
    for (const r of integratedRows) {
      if (r.presenceStatus.isOnline) online++;
      if (r.actualIn !== '-') checkedIn++;
      if (r.todayAgendas.length > 0) scheduledToday++;
      if (r.submittedCount > 0) submittedReports++;
    }
    return {
      total: integratedRows.length,
      online,
      checkedIn,
      scheduledToday,
      submittedReports,
    };
  }, [integratedRows]);

  const handleExportExcel = () => {
    const rows = filtered.map((r, idx) => ({
      No: idx + 1,
      Nama: r.user.name,
      NIK: r.user.nik || '-',
      Role: r.user.role || 'Staff FMCU',
      Email: r.user.email || '-',
      'Status Live': r.presenceStatus.badgeLabel,
      'Aktivitas Web': r.presenceStatus.timeDetail,
      'Agenda Hari Ini': r.primaryAgenda
        ? `${r.primaryAgenda.badge.shortLabel}: ${r.primaryAgenda.agenda.storeName || r.primaryAgenda.agenda.title}`
        : 'Tidak ada jadwal',
      'Jumlah Agenda Hari Ini': r.todayAgendas.length,
      'Actual IN': r.actualIn,
      'Actual OUT': r.actualOut,
      'Laporan Submitted': `${r.submittedCount}/${r.requiredReportCount}`,
      'Koordinat GPS':
        r.presence && r.presence.lat && r.presence.lng
          ? `${r.presence.lat.toFixed(5)}, ${r.presence.lng.toFixed(5)}`
          : '-',
    }));
    exportRowsToExcel(rows, 'Live Monitoring Tim', `FMCU_Live_Monitoring_${todayYmd}.xlsx`);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddUser || !newName.trim()) return;
    const cleanNik = newNik.trim() || '0000';
    const cleanEmail =
      newEmail.trim() ||
      `${newName.trim().toLowerCase().replace(/\s+/g, '.')}@familymartindonesia.com`;

    onAddUser({
      id: `usr_${Date.now()}`,
      name: newName.trim(),
      email: cleanEmail,
      nik: cleanNik,
      password: cleanNik,
      role: newRole.trim() || 'FMCU Field Specialist',
      isAdmin: false,
      accessLevel: 'STAFF',
    });

    setToastMsg(`Personil "${newName.trim()}" ditambahkan (password default: ${cleanNik}).`);
    setNewName('');
    setNewEmail('');
    setNewNik('');
    setShowAddModal(false);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleResetPw = (userName: string) => {
    if (!onResetUserPassword) return;
    if (!window.confirm(`Reset password "${userName}" kembali ke NIK / default?`)) return;
    onResetUserPassword(userName);
    setToastMsg(`Password "${userName}" berhasil di-reset.`);
    setTimeout(() => setToastMsg(null), 3500);
  };

  return (
    <div className="flex flex-col h-full admin-view-enter">
      {toastMsg && (
        <div className="mb-3 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <span>{toastMsg}</span>
          <button type="button" onClick={() => setToastMsg(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
                placeholder="Cari personil, NIK, toko..."
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
                statusFilter !== 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
              title="Filter & Export"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {statusFilter !== 'ALL' && <span className="font-mono text-[10.5px] font-bold">1</span>}
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-700 flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"
              title="Live Sync"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            {onAddUser && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 cursor-pointer"
                title="Tambah Personil"
              >
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="px-3 py-1.5 border-t border-slate-100 bg-slate-50/70 flex items-center gap-3 text-[11px] overflow-x-auto no-scrollbar whitespace-nowrap">
            <span className="text-slate-600 tabular-nums">
              <strong className="text-slate-900">{stats.total}</strong> Tim
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold tabular-nums">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {stats.online} Online
            </span>
            <span className="text-slate-600 tabular-nums">
              <strong className="text-slate-800">{stats.checkedIn}</strong> Check-In
            </span>
            <span className="text-slate-600 tabular-nums">
              <strong className="text-slate-800">{stats.scheduledToday}</strong> Jadwal
            </span>
          </div>
        </div>

        {/* Desktop Top Row: Live Inline Stats + Clean Actions */}
        <div className="hidden md:flex px-3.5 py-2.5 border-b border-slate-200 flex-wrap items-center justify-between gap-2.5 bg-white">
          <div className="flex items-center gap-3 sm:gap-4 text-xs overflow-x-auto no-scrollbar">
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="font-bold text-slate-900 text-sm tabular-nums">{stats.total}</span>
              <span className="text-slate-500">Personil</span>
            </div>
            <span className="h-3.5 w-px bg-slate-200 shrink-0" />
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-emerald-700 tabular-nums">{stats.online}</span>
              <span className="text-slate-500">Online GPS</span>
            </div>
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="font-bold text-slate-800 tabular-nums">{stats.checkedIn}</span>
              <span className="text-slate-500">Check-In</span>
            </div>
            <span className="h-3.5 w-px bg-slate-200 shrink-0" />
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="font-bold text-slate-800 tabular-nums">{stats.scheduledToday}</span>
              <span className="text-slate-500">Terjadwal Hari Ini</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onAddUser && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Tambah Personil</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              title="Refresh Status Live"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Live Sync</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition cursor-pointer"
              title="Tarik Data Live Monitoring ke Excel"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
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
              placeholder="Cari nama personil, NIK, toko..."
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
                ['ONLINE', 'Online GPS'],
                ['SCHEDULED', 'Jadwal Hari Ini'],
                ['STANDBY', 'Offline / Standby'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setStatusFilter(k)}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  statusFilter === k
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Spreadsheet Grid */}
        <div className="flex-1 overflow-auto admin-sheet-scroll">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Tidak ada personil yang cocok dengan filter.
            </div>
          ) : (
            <>
              <table className="hidden md:table w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2 px-2.5 w-10 text-center border-r border-slate-200/70">#</th>
                    <th className="py-2 px-3 w-48 border-r border-slate-200/70">Personil & NIK</th>
                    <th className="py-2 px-3 w-44 border-r border-slate-200/70">Aktivitas Live</th>
                    <th className="py-2 px-3 border-r border-slate-200/70">Agenda Hari Ini</th>
                    <th className="py-2 px-3 w-32 border-r border-slate-200/70">Actual IN / OUT</th>
                    <th className="py-2 px-3 w-28 border-r border-slate-200/70">Laporan</th>
                    <th className="py-2 px-3 w-32 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[12.5px] text-slate-700">
                  {filtered.map((row, idx) => (
                    <tr
                      key={row.user.email || row.user.name}
                      className={`hover:bg-slate-50/90 transition-colors ${
                        row.presenceStatus.isOnline ? 'bg-emerald-50/15' : 'bg-white'
                      }`}
                    >
                      <td className="py-2 px-2.5 text-center text-[11px] font-mono text-slate-400 border-r border-slate-100 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-100">
                        <div className="font-semibold text-slate-900 truncate max-w-[180px]">
                          {row.user.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[180px] font-mono">
                          {row.user.nik ? `NIK ${row.user.nik}` : row.user.role || 'Staff'}
                        </div>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-100">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${row.presenceStatus.badgeBg} ${row.presenceStatus.badgeText} ${row.presenceStatus.badgeBorder}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${row.presenceStatus.dotColor} ${
                              row.presenceStatus.isOnline ? 'animate-pulse' : ''
                            }`}
                          />
                          {row.presenceStatus.badgeLabel}
                        </span>
                        <div className="text-[10.5px] text-slate-500 mt-0.5 truncate max-w-[175px]" title={row.presenceStatus.timeDetail}>
                          {row.presenceStatus.timeDetail}
                        </div>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-100 max-w-[280px]">
                        {row.primaryAgenda ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex px-1.5 py-0.2 rounded text-[10px] font-semibold border shrink-0 ${row.primaryAgenda.badge.bg} ${row.primaryAgenda.badge.color} ${row.primaryAgenda.badge.border}`}
                              >
                                {row.primaryAgenda.badge.shortLabel}
                              </span>
                              <span className="font-medium text-slate-800 truncate">
                                {row.primaryAgenda.agenda.storeName || row.primaryAgenda.agenda.title}
                              </span>
                            </div>
                            {row.todayAgendas.length > 1 && (
                              <div className="text-[10.5px] text-slate-400 mt-0.5">
                                +{row.todayAgendas.length - 1} agenda lainnya hari ini
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Tidak ada agenda hari ini</span>
                        )}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-100 font-mono text-[11px] whitespace-nowrap tabular-nums">
                        {row.actualIn !== '-' || row.actualOut !== '-' ? (
                          <div>
                            <div className="text-emerald-700">IN  {row.actualIn}</div>
                            <div className="text-slate-500">OUT {row.actualOut}</div>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                        {row.requiredReportCount > 0 ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border tabular-nums ${
                              row.submittedCount >= row.requiredReportCount
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {row.submittedCount}/{row.requiredReportCount} Submit
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1">
                          {row.presenceStatus.isOnline && onOpenLiveMaps && (
                            <button
                              type="button"
                              onClick={onOpenLiveMaps}
                              className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                              title="Lacak lokasi live di Peta"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {row.reportToday && (
                            <button
                              type="button"
                              onClick={() => onPreviewReport(row.reportToday!)}
                              className="p-1.5 rounded-md text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                              title="Lihat Laporan Hari Ini"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onResetUserPassword && (
                            <button
                              type="button"
                              onClick={() => handleResetPw(row.user.name)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                              title="Reset Password ke Default NIK"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Compact Flat List */}
              <div className="md:hidden divide-y divide-slate-100">
                {filtered.map((row) => (
                  <div key={row.user.email || row.user.name} className="px-3.5 py-3 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-slate-900 truncate">
                            {row.user.name}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${row.presenceStatus.badgeBg} ${row.presenceStatus.badgeText} ${row.presenceStatus.badgeBorder}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${row.presenceStatus.dotColor}`} />
                            {row.presenceStatus.badgeLabel}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {row.primaryAgenda
                            ? `${row.primaryAgenda.badge.shortLabel}: ${row.primaryAgenda.agenda.storeName || row.primaryAgenda.agenda.title}`
                            : row.presenceStatus.timeDetail}
                        </div>
                        {(row.actualIn !== '-' || row.actualOut !== '-') && (
                          <div className="text-[10.5px] font-mono text-emerald-700 mt-0.5">
                            IN {row.actualIn} • OUT {row.actualOut}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {row.presenceStatus.isOnline && onOpenLiveMaps && (
                          <button
                            type="button"
                            onClick={onOpenLiveMaps}
                            className="p-2 rounded-lg text-indigo-600 bg-indigo-50 cursor-pointer"
                          >
                            <Radio className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {row.reportToday && (
                          <button
                            type="button"
                            onClick={() => onPreviewReport(row.reportToday!)}
                            className="p-2 rounded-lg text-emerald-700 bg-emerald-50 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-3.5 py-2 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <span className="tabular-nums">
            Total <strong className="text-slate-800">{filtered.length}</strong> personil terintegrasi • Update GPS otomatis setiap 15 detik
          </span>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={() => setShowAddModal(false)}
          />
          <form
            onSubmit={handleCreateUser}
            className="relative z-10 w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden admin-sheet-up"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Tambah Personil Baru</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    NIK (Password Default)
                  </label>
                  <input
                    type="text"
                    value={newNik}
                    onChange={(e) => setNewNik(e.target.value)}
                    placeholder="Contoh: 24010099"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Jabatan / Role
                  </label>
                  <input
                    type="text"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Email (Opsional)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nama@familymartindonesia.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simpan</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mobile Filter & Export Sheet */}
      <AdminMobileSheet
        isOpen={showMobileFilter}
        title="Filter & Aksi Live Monitoring"
        onClose={() => setShowMobileFilter(false)}
        onReset={() => {
          setSearch('');
          setStatusFilter('ALL');
        }}
        hasActiveFilters={statusFilter !== 'ALL' || Boolean(search.trim())}
      >
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Status Personil
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ['ALL', 'Semua'],
                ['ONLINE', 'Online GPS'],
                ['SCHEDULED', 'Jadwal Hari Ini'],
                ['STANDBY', 'Offline / Standby'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setStatusFilter(k)}
                className={`py-2 px-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                  statusFilter === k
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowMobileFilter(false);
            handleExportExcel();
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-emerald-600" />
          <span>Export Data Tim ke Excel ({filtered.length})</span>
        </button>
      </AdminMobileSheet>
    </div>
  );
};
