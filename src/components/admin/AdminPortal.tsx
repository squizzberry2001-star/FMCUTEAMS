import React, { useState, useRef } from 'react';
import {
  LayoutDashboard,
  Calendar as CalendarIcon,
  Upload,
  FileSpreadsheet,
  Users,
  Tag,
  Plus,
  Search,
  Trash2,
  Edit3,
  Filter,
  CheckCircle2,
  Download,
  LogOut,
  Eye,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Clock,
  MapPin,
  Building2,
  Store,
  GraduationCap,
  Briefcase,
  AlertCircle,
  RefreshCw,
  X,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';
import { ScheduleAgenda, ScheduleCategory, User } from '../../types';
import excelSeed from '../../data/excelScheduleSeed.json';

interface AdminPortalProps {
  adminUser: User;
  agendas: ScheduleAgenda[];
  users: User[];
  onAddAgenda: (newAgenda: ScheduleAgenda) => void;
  onUpdateAgenda: (updated: ScheduleAgenda) => void;
  onDeleteAgenda: (id: string) => void;
  onImportExcel: (importedUsers: User[], importedAgendas: ScheduleAgenda[]) => void;
  onSwitchToUserView: () => void;
  onLogout: () => void;
  onAddUser?: (newUser: User) => void;
  onResetUserPassword?: (userName: string) => void;
  onReplaySplash?: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  adminUser,
  agendas,
  users,
  onAddAgenda,
  onUpdateAgenda,
  onDeleteAgenda,
  onImportExcel,
  onSwitchToUserView,
  onLogout,
  onAddUser,
  onResetUserPassword,
  onReplaySplash,
}) => {
  // Navigation Tabs: 'dashboard' | 'schedules' | 'import-excel' | 'users' | 'categories'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'schedules' | 'import-excel' | 'users' | 'categories'>('dashboard');

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');

  // Modal State for New / Edit Agenda
  const [showAgendaModal, setShowAgendaModal] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<ScheduleAgenda | null>(null);

  // Form State for Agenda Modal
  const [agendaTitle, setAgendaTitle] = useState('');
  const [agendaPic, setAgendaPic] = useState(users[1]?.name || 'Septiana Indasari');
  const [agendaCategory, setAgendaCategory] = useState<ScheduleCategory>('VISIT');
  const [agendaDate, setAgendaDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [agendaTime, setAgendaTime] = useState('08:30');
  const [agendaLocation, setAgendaLocation] = useState('');
  const [agendaDescription, setAgendaDescription] = useState('');
  const [agendaPriority, setAgendaPriority] = useState<'NORMAL' | 'HIGH'>('NORMAL');

  // Excel Upload Drag State & Feedback
  const [isDragging, setIsDragging] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Categories Master List
  const [categoriesList, setCategoriesList] = useState<
    { id: ScheduleCategory; label: string; desc: string; bg: string; text: string }[]
  >([
    { id: 'VISIT', label: 'Store Visit', desc: 'Kunjungan & inspeksi lapangan toko (Form Visit)', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    { id: 'NSO', label: 'NSO Opening', desc: 'New Store Opening & walkthrough fit-out', bg: 'bg-pink-50', text: 'text-pink-700' },
    { id: 'TRAINING', label: 'Training / SBS', desc: 'Pelatihan modul, SBS, new hire batch', bg: 'bg-purple-50', text: 'text-purple-700' },
    { id: 'MEETING', label: 'Meeting / Koordinasi', desc: 'Rapat operasional, town hall, 1-on-1', bg: 'bg-blue-50', text: 'text-blue-700' },
    { id: 'AUDIT', label: 'Audit SOP / Assessment', desc: 'Audit kepatuhan, kebersihan, asset', bg: 'bg-amber-50', text: 'text-amber-700' },
    { id: 'WORK_PLAN', label: 'Weekly Work Plan', desc: 'Perencanaan kerja mingguan divisi', bg: 'bg-teal-50', text: 'text-teal-700' },
    { id: 'OPERATION', label: 'Operations Duty', desc: 'Aktivitas operasional rutin lapangan', bg: 'bg-slate-50', text: 'text-slate-700' },
    { id: 'CUTI', label: 'Cuti / Libur', desc: 'Izin cuti resmi karyawan', bg: 'bg-rose-50', text: 'text-rose-700' },
  ]);

  // Handle open modal for create
  const handleOpenCreateModal = () => {
    setEditingAgenda(null);
    setAgendaTitle('');
    setAgendaPic(users[1]?.name || 'Septiana Indasari');
    setAgendaCategory('VISIT');
    setAgendaDate(new Date().toISOString().split('T')[0]);
    setAgendaTime('08:30');
    setAgendaLocation('Cabang Store FMCU');
    setAgendaDescription('');
    setAgendaPriority('NORMAL');
    setShowAgendaModal(true);
  };

  // Handle open modal for edit
  const handleOpenEditModal = (item: ScheduleAgenda) => {
    setEditingAgenda(item);
    setAgendaTitle(item.title);
    setAgendaPic(item.pic);
    setAgendaCategory(item.category);
    setAgendaDate(item.date);
    setAgendaTime(item.time);
    setAgendaLocation(item.location);
    setAgendaDescription(item.description || '');
    setAgendaPriority(item.priority === 'HIGH' ? 'HIGH' : 'NORMAL');
    setShowAgendaModal(true);
  };

  // Handle save agenda
  const handleSaveAgenda = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agendaTitle.trim()) return;

    if (editingAgenda) {
      const updated: ScheduleAgenda = {
        ...editingAgenda,
        title: agendaTitle.trim(),
        pic: agendaPic,
        category: agendaCategory,
        date: agendaDate,
        time: agendaTime,
        location: agendaLocation.trim() || 'FMCU Lapangan',
        description: agendaDescription.trim() || 'Agenda operasional FMCU.',
        priority: agendaPriority,
        tags: [agendaCategory, 'Admin Updated'],
      };
      onUpdateAgenda(updated);
    } else {
      const created: ScheduleAgenda = {
        id: `sch-${Date.now()}`,
        title: agendaTitle.trim(),
        pic: agendaPic,
        category: agendaCategory,
        date: agendaDate,
        time: agendaTime,
        location: agendaLocation.trim() || 'FMCU Lapangan',
        description: agendaDescription.trim() || 'Agenda operasional FMCU.',
        priority: agendaPriority,
        tags: [agendaCategory, 'Admin Created'],
        completed: false,
        createdBy: 'Admin FMCU (Portal)',
      };
      onAddAgenda(created);
    }

    setShowAgendaModal(false);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#00A389', '#38BDF8', '#4ADE80', '#F59E0B'],
    });
  };

  // Excel Parser Helper Function
  const processExcelWorkbook = (wb: XLSX.WorkBook) => {
    const parsedUsers: Record<string, User> = {};
    const parsedAgendas: ScheduleAgenda[] = [];

    const inferCategory = (desc: string, loc: string): ScheduleCategory => {
      const text = `${desc} ${loc}`.toLowerCase();
      if (text.includes('visit') || text.includes('toko') || text.includes('store')) return 'VISIT';
      if (text.includes('nso') || text.includes('grand opening')) return 'NSO';
      if (text.includes('training') || text.includes('sbs') || text.includes('magang') || text.includes('batch')) return 'TRAINING';
      if (text.includes('meeting') || text.includes('town hall') || text.includes('1 on 1')) return 'MEETING';
      if (text.includes('audit') || text.includes('inspeksi') || text.includes('asset') || text.includes('assessment')) return 'AUDIT';
      if (text.includes('cuti') || text.includes('libur')) return 'CUTI';
      if (text.includes('plan') || text.includes('work plan')) return 'WORK_PLAN';
      return 'OPERATION';
    };

    let counter = 1;

    wb.SheetNames.forEach((sheetName) => {
      const ws = wb.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Row 0 is header: ['Nama', 'Start Date', 'Start Time', 'End Date', 'End Time', 'Description', 'Location']
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[0]) continue;

        const nama = String(row[0]).trim();
        if (!nama) continue;

        if (!parsedUsers[nama]) {
          const cleanEmail = nama.toLowerCase().replace(/\s+/g, '.');
          parsedUsers[nama] = {
            id: `usr-${Object.keys(parsedUsers).length + 1}`,
            name: nama,
            email: `${cleanEmail}@fmcuteams.com`,
            role: 'FMCU Field Operations',
            password: '0000', // Default password 0000
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${nama.replace(/\s+/g, '')}`,
            isAdmin: false,
          };
        }

        // Date & Time formatting
        let dateVal = row[1];
        let dateStr = '';
        if (dateVal instanceof Date) {
          dateStr = dateVal.toISOString().split('T')[0];
        } else if (typeof dateVal === 'string') {
          dateStr = dateVal.split(' ')[0];
        } else if (typeof dateVal === 'number') {
          // Excel serial date to JS Date
          const jsDate = new Date((dateVal - (25567 + 2)) * 86400 * 1000);
          dateStr = jsDate.toISOString().split('T')[0];
        }

        let timeVal = row[2] ? String(row[2]).trim() : '08:30';
        let timeParts = timeVal.split(':');
        let formattedTime = timeParts.length >= 2 ? `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}` : '08:30';

        const descVal = row[5] ? String(row[5]).trim() : '';
        const locVal = row[6] ? String(row[6]).trim() : '';

        let titleVal = descVal.replace(/^Agenda\s*:\s*/i, '').trim();
        let firstLine = titleVal.split('\n')[0].trim();
        if (!firstLine) firstLine = 'Tugas Lapangan FMCU';

        const cat = inferCategory(descVal, locVal);

        parsedAgendas.push({
          id: `excel-${Date.now()}-${counter++}`,
          pic: nama,
          title: firstLine,
          date: dateStr || new Date().toISOString().split('T')[0],
          time: formattedTime,
          category: cat,
          location: locVal || 'FMCU Lapangan',
          description: descVal || 'Aktivitas operasional FMCU.',
          tags: [cat, 'Excel Import'],
          completed: false,
          priority: 'NORMAL',
          createdBy: 'Admin FMCU (Excel)',
        });
      }
    });

    const userList = Object.values(parsedUsers);
    onImportExcel(userList, parsedAgendas);
    setImportStatus(`Berhasil mengimpor ${parsedAgendas.length} jadwal untuk ${userList.length} karyawan dari Excel! Akun otomatis dibuat dengan password default: 0000.`);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00A389', '#38BDF8', '#4ADE80', '#F59E0B'],
    });
  };

  // Upload file event handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const bstr = evt.target?.result;
        try {
          const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
          processExcelWorkbook(wb);
        } catch (err) {
          console.error(err);
          alert('Gagal membaca file Excel. Pastikan format file adalah .xlsx atau .xls.');
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  // Quick 1-Click Sync from pre-bundled "TEMPLET EXCEL JADWAL.xlsx"
  const handleSyncPreBundledExcel = () => {
    const seedUsers = excelSeed.users as User[];
    const seedAgendas = excelSeed.agendas as ScheduleAgenda[];
    onImportExcel(seedUsers, seedAgendas);
    setImportStatus(`Sinkronisasi Sukses! ${seedAgendas.length} jadwal dan ${seedUsers.length} karyawan dari 'TEMPLET EXCEL JADWAL.xlsx' berhasil dimuat ke database.`);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00A389', '#38BDF8', '#4ADE80', '#F59E0B'],
    });
  };

  // Filtered Agendas
  const filteredAgendas = agendas.filter((item) => {
    const matchSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.pic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory =
      selectedCategoryFilter === 'ALL' || item.category === selectedCategoryFilter;
    const matchUser =
      selectedUserFilter === 'ALL' || item.pic === selectedUserFilter;
    return matchSearch && matchCategory && matchUser;
  });

  return (
    <div className="min-h-screen bg-[#F4F6FB] flex flex-col select-none text-slate-800">
      {/* 1. Master Top Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 pt-[max(0.875rem,env(safe-area-inset-top,14px))] pb-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00A389] to-[#00705E] flex items-center justify-center text-white shadow-pill-teal font-black text-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-900 tracking-tight">
                FMCU TEAMS
              </span>
              <span className="text-[10px] font-extrabold text-[#00A389] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 uppercase">
                Admin Control Hub
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Sistem Pengelolaan Jadwal & Akun Terpusat
            </p>
          </div>
        </div>

        {/* Right Admin Profile & Switch View */}
        <div className="flex items-center gap-3">
          {/* Replay Splash Button */}
          {onReplaySplash && (
            <button
              onClick={onReplaySplash}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all active:scale-95"
              title="Putar ulang animasi splash FMCU TEAMS"
            >
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>Animasi Splash</span>
            </button>
          )}

          {/* Switch to User View Preview */}
          <button
            onClick={onSwitchToUserView}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all active:scale-95"
            title="Pratinjau tampilan sisi user / karyawan"
          >
            <Eye className="w-4 h-4 text-teal-600" />
            <span className="hidden sm:inline">Lihat Tampilan Sisi User</span>
            <span className="sm:hidden">Sisi User</span>
          </button>

          {/* Admin Avatar Pill */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
            <img
              src={adminUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt={adminUser.name}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-teal-200"
            />
            <div className="hidden md:block text-left">
              <span className="block text-xs font-extrabold text-slate-900 leading-tight">
                {adminUser.name}
              </span>
              <span className="block text-[10px] text-teal-700 font-bold leading-tight">
                Super Admin
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            title="Keluar dari Portal Admin"
            className="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Admin Navigation Sub-Header */}
      <nav className="bg-white border-b border-slate-200/80 px-6 py-2.5 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {[
              { id: 'dashboard', label: 'Ringkasan & Analitik', icon: LayoutDashboard },
              { id: 'schedules', label: `Kelola Jadwal (${agendas.length})`, icon: CalendarIcon },
              { id: 'import-excel', label: 'Impor Excel Templet', icon: FileSpreadsheet, badge: 'Excel Sync' },
              { id: 'users', label: `Akun Karyawan (${users.filter((u) => !u.isAdmin).length})`, icon: Users },
              { id: 'categories', label: 'Kategori Agenda', icon: Tag },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-extrabold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-[#00A389] to-[#00826D] text-white shadow-pill-teal scale-102'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                      isActive ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Create Agenda Button */}
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-slate-900 text-white text-xs font-extrabold shadow-sm hover:bg-slate-800 transition-all flex-shrink-0"
          >
            <Plus className="w-4 h-4 text-teal-400 stroke-[3]" />
            <span>+ Buat Agenda Baru</span>
          </button>
        </div>
      </nav>

      {/* 3. Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* TAB 1: DASHBOARD & ANALYTICS */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Karyawan */}
              <div className="bg-white rounded-3xl p-5 shadow-soft-card border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Total Karyawan Terdaftar
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">
                    {users.filter((u) => !u.isAdmin).length} Pegawai
                  </h3>
                  <span className="text-xs font-semibold text-emerald-600 mt-1 block">
                    Password Default: 0000
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              {/* Card 2: Total Agenda */}
              <div className="bg-white rounded-3xl p-5 shadow-soft-card border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Total Seluruh Agenda
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">
                    {agendas.length} Jadwal
                  </h3>
                  <span className="text-xs font-semibold text-teal-600 mt-1 block">
                    Tersinkron ke Sisi User
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <CalendarIcon className="w-6 h-6" />
                </div>
              </div>

              {/* Card 3: Agenda Visit */}
              <div className="bg-white rounded-3xl p-5 shadow-soft-card border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Agenda Visit Toko
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">
                    {agendas.filter((a) => a.category === 'VISIT').length} Toko
                  </h3>
                  <span className="text-xs font-semibold text-emerald-600 mt-1 block">
                    Dilengkapi Form Visit PDF
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Store className="w-6 h-6" />
                </div>
              </div>

              {/* Card 4: Kategori Training & Meeting */}
              <div className="bg-white rounded-3xl p-5 shadow-soft-card border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Training & Koordinasi
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">
                    {agendas.filter((a) => a.category === 'TRAINING' || a.category === 'MEETING').length} Kegiatan
                  </h3>
                  <span className="text-xs font-semibold text-purple-600 mt-1 block">
                    SBS & Meeting Operasional
                  </span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Excel Quick Sync Banner */}
            <div className="bg-gradient-to-r from-[#00A389] via-[#00826D] to-[#0A564A] rounded-3xl p-6 text-white shadow-pill-teal flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-wider">
                    Excel Sync System
                  </span>
                  <span className="text-xs text-white/80 font-bold">
                    TEMPLET EXCEL JADWAL.xlsx
                  </span>
                </div>
                <h2 className="text-lg font-black tracking-tight">
                  Sinkronisasi Master Jadwal & Akun Pegawai
                </h2>
                <p className="text-xs text-white/80 max-w-xl mt-1">
                  Database telah siap membaca format Excel 3 sheet (02-08 Nov, 09-15 Nov, 16-22 Nov) dengan kolom Nama, Tanggal, Jam, Deskripsi, dan Lokasi.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleSyncPreBundledExcel}
                  className="px-4 py-2.5 rounded-2xl bg-white text-teal-900 text-xs font-black shadow-md hover:bg-teal-50 active:scale-95 transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4 text-[#00A389]" />
                  <span>Sinkronisasi Data Excel</span>
                </button>
                <button
                  onClick={() => setActiveTab('import-excel')}
                  className="px-4 py-2.5 rounded-2xl bg-black/25 text-white text-xs font-extrabold hover:bg-black/35 transition-all"
                >
                  Unggah File Lain
                </button>
              </div>
            </div>

            {/* Recent Agendas Overview Table */}
            <div className="bg-white rounded-3xl p-6 shadow-soft-card border border-slate-200/80">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Daftar Agenda Terkini (Live)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Data agenda langsung terhubung dan otomatis terlihat oleh masing-masing karyawan
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('schedules')}
                  className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                >
                  <span>Lihat Semua ({agendas.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">Karyawan (PIC)</th>
                      <th className="py-3 px-4">Judul Agenda</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4">Tanggal & Waktu</th>
                      <th className="py-3 px-4">Lokasi</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {agendas.slice(0, 8).map((agenda) => (
                      <tr key={agenda.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-teal-50 text-teal-700 font-extrabold flex items-center justify-center text-[10px]">
                            {agenda.pic.charAt(0)}
                          </div>
                          <span>{agenda.pic}</span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800 max-w-xs truncate">
                          {agenda.title}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
                            {agenda.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-600">
                          {agenda.date} • {agenda.time} WIB
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 truncate max-w-[180px]">
                          {agenda.location}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(agenda)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                              title="Edit Agenda"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteAgenda(agenda.id)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                              title="Hapus Agenda"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MASTER SCHEDULE MANAGEMENT */}
        {activeTab === 'schedules' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Filter & Search Bar */}
            <div className="bg-white rounded-3xl p-5 shadow-soft-card border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari agenda, karyawan, atau lokasi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-teal-400"
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
                {/* Category Filter */}
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-400"
                >
                  <option value="ALL">Semua Kategori ({agendas.length})</option>
                  <option value="VISIT">Store Visit ({agendas.filter((a) => a.category === 'VISIT').length})</option>
                  <option value="NSO">NSO Opening ({agendas.filter((a) => a.category === 'NSO').length})</option>
                  <option value="TRAINING">Training / SBS ({agendas.filter((a) => a.category === 'TRAINING').length})</option>
                  <option value="MEETING">Meeting ({agendas.filter((a) => a.category === 'MEETING').length})</option>
                  <option value="AUDIT">Audit SOP ({agendas.filter((a) => a.category === 'AUDIT').length})</option>
                  <option value="WORK_PLAN">Work Plan ({agendas.filter((a) => a.category === 'WORK_PLAN').length})</option>
                  <option value="CUTI">Cuti ({agendas.filter((a) => a.category === 'CUTI').length})</option>
                </select>

                {/* User Filter */}
                <select
                  value={selectedUserFilter}
                  onChange={(e) => setSelectedUserFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-400 max-w-[200px]"
                >
                  <option value="ALL">Semua Karyawan (36)</option>
                  {users.filter((u) => !u.isAdmin).map((u) => (
                    <option key={u.id || u.name} value={u.name}>
                      {u.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2 rounded-2xl bg-[#00A389] text-white text-xs font-extrabold shadow-pill-teal hover:brightness-105 active:scale-95 transition-all flex items-center gap-1.5 flex-shrink-0"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ Buat Agenda</span>
                </button>
              </div>
            </div>

            {/* Schedule Table */}
            <div className="bg-white rounded-3xl shadow-soft-card border border-slate-200/80 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  Menampilkan {filteredAgendas.length} agenda kerja
                </span>
                <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full">
                  Realtime Sync dengan Aplikasi User
                </span>
              </div>

              <div className="overflow-x-auto no-scrollbar max-h-[600px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100 text-slate-600 font-black uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">Karyawan (PIC)</th>
                      <th className="py-3 px-4">Judul Agenda</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4">Tanggal & Waktu</th>
                      <th className="py-3 px-4">Lokasi</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredAgendas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Tidak ada agenda yang cocok dengan filter atau pencarian.
                        </td>
                      </tr>
                    ) : (
                      filteredAgendas.map((agenda) => (
                        <tr key={agenda.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-teal-50 text-teal-700 font-extrabold flex items-center justify-center text-[10px]">
                              {agenda.pic.charAt(0)}
                            </div>
                            <span className="truncate max-w-[150px]">{agenda.pic}</span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800 max-w-xs break-words">
                            {agenda.title}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100">
                              {agenda.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-600">
                            {agenda.date} • {agenda.time} WIB
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 truncate max-w-[180px]">
                            {agenda.location}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditModal(agenda)}
                                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                title="Edit Agenda"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeleteAgenda(agenda.id)}
                                className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                                title="Hapus Agenda"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: IMPORT EXCEL ("TEMPLET EXCEL JADWAL") */}
        {activeTab === 'import-excel' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-8 shadow-soft-card border border-slate-200/80">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Unggah & Impor File Excel Jadwal
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mendukung file Excel resmi dengan kolom: Nama, Start Date, Start Time, End Date, End Time, Description, Location
                  </p>
                </div>
              </div>

              {/* Status Message */}
              {importStatus && (
                <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{importStatus}</span>
                </div>
              )}

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const bstr = evt.target?.result;
                      try {
                        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                        processExcelWorkbook(wb);
                      } catch (err) {
                        alert('Gagal membaca file Excel.');
                      }
                    };
                    reader.readAsBinaryString(file);
                  }
                }}
                className={`border-3 border-dashed rounded-3xl p-10 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/50 scale-101'
                    : 'border-slate-300 bg-slate-50/60 hover:bg-slate-100/60'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-16 h-16 rounded-3xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-base font-extrabold text-slate-800">
                  Tarik & Letakkan File Excel di sini, atau Klik untuk Memilih
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Format file yang didukung: .xlsx, .xls (Mendukung multi-sheet otomatis)
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Quick 1-Click Sync Button */}
              <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    Gunakan Data Template Bawaan (Default Seed)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    File "TEMPLET EXCEL JADWAL.xlsx" (582 Jadwal & 36 Akun Pegawai) telah disiapkan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSyncPreBundledExcel}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#00A389] to-[#00826D] text-white text-xs font-black shadow-pill-teal hover:brightness-105 active:scale-95 transition-all flex items-center gap-2 flex-shrink-0"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Sinkronisasi Ulang Template Excel</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: USERS MANAGEMENT (36 USERS DARI EXCEL) */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 shadow-soft-card border border-slate-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-teal-600" />
                    <span>Daftar Akun Pegawai dari Excel (36 Karyawan)</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Semua akun dibuat otomatis dari kolom 'Nama' di Excel dengan password default: <strong className="text-slate-700">0000</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                    Total: {users.filter((u) => !u.isAdmin).length} Akun Aktif
                  </span>
                </div>
              </div>

              {/* Users Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {users.filter((u) => !u.isAdmin).map((u, idx) => {
                  const userAgendasCount = agendas.filter((a) => a.pic === u.name).length;
                  return (
                    <div
                      key={u.id || idx}
                      className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex items-start gap-3.5 hover:bg-white hover:shadow-soft-sm transition-all"
                    >
                      <img
                        src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name.replace(/\s+/g, '')}`}
                        alt={u.name}
                        className="w-11 h-11 rounded-full object-cover ring-2 ring-teal-200 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-extrabold text-slate-900 truncate">
                          {u.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate">
                          {u.email}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                            {userAgendasCount} Jadwal Terjadwal
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            Sandi: {u.password || '0000'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CATEGORIES MANAGEMENT */}
        {activeTab === 'categories' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 shadow-soft-card border border-slate-200/80">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-teal-600" />
                    <span>Master Kategori Agenda FMCU</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Kategori digunakan untuk klasifikasi agenda kerja, pembedaan warna badge, dan pemicu form khusus (misal: VISIT).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoriesList.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex items-start gap-3"
                  >
                    <div className={`px-3 py-1.5 rounded-xl font-black text-xs ${cat.bg} ${cat.text} flex-shrink-0`}>
                      {cat.id}
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900">{cat.label}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{cat.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Minimalist Page Footer */}
        <footer className="pt-8 pb-4 text-center">
          <span className="text-[10px] font-light text-slate-400/90 tracking-widest">
            Pengembang Web
          </span>
        </footer>
      </main>

      {/* 4. Modal Buat / Edit Agenda */}
      {showAgendaModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Plus className="w-4 h-4 stroke-[3]" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingAgenda ? 'Edit Agenda Kerja' : 'Buat Agenda Kerja Baru (Admin)'}
                </h3>
              </div>
              <button
                onClick={() => setShowAgendaModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveAgenda} className="space-y-3.5">
              {/* Judul Agenda */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Judul Agenda *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Audit & Store Visit - Cabang Dago"
                  value={agendaTitle}
                  onChange={(e) => setAgendaTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              {/* Pilih Karyawan (PIC) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Ditugaskan Kepada (Karyawan PIC) *
                </label>
                <select
                  value={agendaPic}
                  onChange={(e) => setAgendaPic(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  {users.filter((u) => !u.isAdmin).map((u) => (
                    <option key={u.id || u.name} value={u.name}>
                      {u.name} ({u.role || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Kategori Agenda */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Kategori Agenda
                </label>
                <select
                  value={agendaCategory}
                  onChange={(e) => setAgendaCategory(e.target.value as ScheduleCategory)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  {categoriesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} - {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tanggal & Waktu */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    value={agendaDate}
                    onChange={(e) => setAgendaDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Waktu (WIB)
                  </label>
                  <input
                    type="time"
                    required
                    value={agendaTime}
                    onChange={(e) => setAgendaTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
              </div>

              {/* Lokasi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Lokasi Toko / Tempat
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Toko Bandung Dago No. 124"
                  value={agendaLocation}
                  onChange={(e) => setAgendaLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Instruksi Kerja / Catatan Admin
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan detail untuk karyawan yang bertugas..."
                  value={agendaDescription}
                  onChange={(e) => setAgendaDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00A389] to-[#00826D] text-white text-xs font-black shadow-pill-teal hover:brightness-105 active:scale-95 transition-all"
                >
                  {editingAgenda ? 'Simpan Perubahan Agenda' : 'Terbitkan Agenda ke Sisi User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
