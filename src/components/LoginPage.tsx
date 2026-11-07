import React, { useState, useRef, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  User as UserIcon,
  ArrowRight,
  Sparkles,
  ChevronDown,
  Check,
  Shield,
  ShieldAlert,
  AlertCircle,
  Users as UsersIcon
} from 'lucide-react';
import { User } from '../types';
import { ADMIN_PASSWORD, ADMIN_USER, initialUsers } from '../data/mockData';
import { ParacetamolHero3D } from './3d-icons/Illustrations';

interface LoginPageProps {
  users?: User[];
  onLogin: (user: User) => void;
  onContinueAsGuest?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ users = initialUsers, onLogin }) => {
  // Separate staff list (exclude admin)
  const staffUsers = users.filter((u) => !u.isAdmin);
  const defaultStaff = staffUsers[0] || {
    name: 'Septiana Indasari',
    email: 'septiana.indasari@fmcuteams.com',
    role: 'Field Supervisor FMCU',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    password: '0000',
  };

  // Login Mode: 'staff' (Karyawan) | 'admin' (Admin FMCU)
  const [loginMode, setLoginMode] = useState<'staff' | 'admin'>('staff');

  // Staff Form State
  const [selectedStaff, setSelectedStaff] = useState<User>(defaultStaff);
  const [staffSearchQuery, setStaffSearchQuery] = useState(defaultStaff.name);
  const [staffPassword, setStaffPassword] = useState('0000');
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);

  // Admin Form State
  const [adminPasswordInput, setAdminPasswordInput] = useState('');

  // General State
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter staff list according to typing
  const filteredStaff = staffUsers.filter((u) =>
    u.name.toLowerCase().includes(staffSearchQuery.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowStaffDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectStaff = (u: User) => {
    setSelectedStaff(u);
    setStaffSearchQuery(u.name);
    setStaffPassword(u.password || '0000');
    setShowStaffDropdown(false);
    setErrorMessage(null);
  };

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Find user in registered list
    const foundUser = staffUsers.find(
      (u) => u.name.toLowerCase() === staffSearchQuery.trim().toLowerCase()
    );

    if (!foundUser) {
      setErrorMessage(`Nama "${staffSearchQuery}" belum terdaftar. Silakan pilih dari 36 nama karyawan.`);
      return;
    }

    // Verify password (default '0000' or whatever is updated in profile)
    const expectedPassword = foundUser.password || '0000';
    if (staffPassword !== expectedPassword) {
      setErrorMessage('Password salah! Password default adalah 0000 (atau gunakan sandi baru jika sudah diubah).');
      return;
    }

    onLogin(foundUser);
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Verify admin password strictly against '607090'
    if (adminPasswordInput.trim() !== ADMIN_PASSWORD && adminPasswordInput.trim() !== '607090') {
      setErrorMessage('Password Admin salah! Masukkan kode otorisasi resmi: 607090');
      return;
    }

    const adminAccount = users.find((u) => u.isAdmin) || ADMIN_USER;
    onLogin(adminAccount);
  };

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 overflow-hidden ambient-bg-glow">
      {/* Decorative ambient blurred blobs */}
      <div className="absolute top-12 left-10 w-72 h-72 bg-[#D4F4E2]/60 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#FFE6D5]/60 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-[#E8EEFF]/70 rounded-full blur-3xl pointer-events-none -z-0" />

      {/* Main Glassmorphic / Clay Card */}
      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-xl rounded-[38px] p-6 sm:p-8 shadow-soft-lg border border-white/60">
        {/* Top 3D Hero Illustration */}
        <div className="flex flex-col items-center justify-center -mt-2 mb-3">
          <div className="relative group cursor-pointer transition-transform duration-300 hover:scale-105">
            <ParacetamolHero3D className="w-28 h-28 sm:w-32 sm:h-32 drop-shadow-sm" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF8F2] text-[#2BB3A0] text-xs font-bold tracking-wide mt-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>FMCU TEAMS PORTAL</span>
          </div>

          <h1 className="text-2xl font-black text-slate-800 tracking-tight mt-1 text-center">
            {loginMode === 'admin' ? 'Portal Admin FMCU' : 'Login Karyawan FMCU'}
          </h1>
          <p className="text-xs text-slate-400 font-medium text-center mt-0.5">
            {loginMode === 'admin'
              ? 'Kelola jadwal, tim, kategori & impor data Excel'
              : 'Pilih nama Anda dari 36 user jadwal untuk masuk'}
          </p>
        </div>

        {/* Mode Switcher Tabs (Karyawan vs Admin FMCU) */}
        <div className="flex items-center p-1 bg-slate-100 rounded-2xl mb-4 border border-slate-200/50">
          <button
            type="button"
            onClick={() => {
              setLoginMode('staff');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              loginMode === 'staff'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <UsersIcon className="w-3.5 h-3.5" />
            <span>Karyawan ({staffUsers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode('admin');
              setErrorMessage(null);
              setAdminPasswordInput('');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              loginMode === 'admin'
                ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin FMCU</span>
          </button>
        </div>

        {/* Error Notification Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. STAFF LOGIN FORM */}
        {loginMode === 'staff' ? (
          <form onSubmit={handleStaffSubmit} className="space-y-4">
            {/* Nama Karyawan (Autocomplete Dropdown dari 36 nama Excel) */}
            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs text-slate-600 font-bold mb-1.5 flex items-center justify-between">
                <span>Nama Karyawan</span>
                <span className="text-[10px] text-teal-600 font-medium">36 user terdaftar</span>
              </label>

              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none">
                  {selectedStaff.avatar ? (
                    <img
                      src={selectedStaff.avatar}
                      alt={selectedStaff.name}
                      className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-200"
                    />
                  ) : (
                    <UserIcon className="w-4 h-4 text-slate-400" />
                  )}
                </div>

                {/* Input text nama: font size 16px di mobile agar tidak auto zoom */}
                <input
                  type="text"
                  value={staffSearchQuery}
                  onChange={(e) => {
                    setStaffSearchQuery(e.target.value);
                    setShowStaffDropdown(true);
                  }}
                  onFocus={() => setShowStaffDropdown(true)}
                  placeholder="Ketik atau pilih nama Anda..."
                  required
                  className="w-full bg-[#F8FAFC] border border-slate-200/90 rounded-2xl pl-11 pr-10 py-3 text-[16px] sm:text-xs font-bold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all placeholder:font-normal placeholder:text-slate-400"
                />

                <button
                  type="button"
                  onClick={() => setShowStaffDropdown(!showStaffDropdown)}
                  className="absolute right-3 text-slate-400 hover:text-slate-700 p-1"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showStaffDropdown ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Dropdown 36 Karyawan */}
              {showStaffDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-30 max-h-56 overflow-y-auto no-scrollbar animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex justify-between items-center">
                    <span>Pilih Dari Database ({staffUsers.length} Karyawan)</span>
                  </div>
                  {filteredStaff.length === 0 ? (
                    <div className="px-3 py-2.5 text-xs text-slate-400 font-medium">
                      Nama tidak cocok. Pastikan memilih salah satu dari 36 user jadwal.
                    </div>
                  ) : (
                    filteredStaff.map((u) => {
                      const isCurrent = u.name.toLowerCase() === staffSearchQuery.toLowerCase();
                      return (
                        <button
                          key={u.id || u.name}
                          type="button"
                          onClick={() => handleSelectStaff(u)}
                          className={`w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-teal-50/70 transition-colors ${
                            isCurrent ? 'bg-teal-50/50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={u.avatar}
                              alt={u.name}
                              className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="block text-xs font-bold text-slate-800 truncate">
                                {u.name}
                              </span>
                              <span className="block text-[10px] text-slate-400 truncate font-medium">
                                {u.role || 'Staff Lapangan FMCU'}
                              </span>
                            </div>
                          </div>

                          {isCurrent && (
                            <Check className="w-4 h-4 text-teal-600 flex-shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Password Karyawan (Default 0000) */}
            <div>
              <label className="block text-xs text-slate-600 font-bold mb-1.5 flex items-center justify-between">
                <span>Password Karyawan</span>
                <span className="text-[10px] text-teal-600 font-semibold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200/60">
                  Default: 0000
                </span>
              </label>

              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="••••"
                  required
                  className="w-full bg-[#F8FAFC] border border-slate-200/90 rounded-2xl pl-10 pr-11 py-3 text-[16px] sm:text-xs font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all tracking-wider"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500 cursor-pointer"
                />
                <span className="text-slate-500 font-medium">Ingat akun saya di perangkat ini</span>
              </label>
            </div>

            {/* Submit Staff Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white font-bold text-sm shadow-pill-teal hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <span>Masuk ke Jadwal Saya</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </form>
        ) : (
          /* 2. ADMIN LOGIN FORM */
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            {/* Admin Account Header Badge */}
            <div className="p-3.5 bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-200/70 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-800">Admin FMCU</span>
                  <span className="text-[9px] font-bold bg-teal-600 text-white px-1.5 py-0.2 rounded uppercase">Super Admin</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium truncate">admin@fmcuteams.com</p>
              </div>
            </div>

            {/* Password Admin (Must be 607090) */}
            <div>
              <label className="block text-xs text-slate-600 font-bold mb-1.5 flex items-center justify-between">
                <span>Password Admin</span>
                <span className="text-[10px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">
                  Password: 607090
                </span>
              </label>

              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="Masukkan 607090"
                  required
                  autoFocus
                  className="w-full bg-[#F8FAFC] border border-slate-200/90 rounded-2xl pl-10 pr-11 py-3 text-[16px] sm:text-xs font-bold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all tracking-widest placeholder:tracking-normal placeholder:font-normal"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Admin Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-teal-600 via-teal-700 to-slate-800 text-white font-bold text-sm shadow-md hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4 stroke-[2.5]" />
                <span>Masuk ke Dashboard Admin</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </form>
        )}

        {/* Quick Demo Shortcuts */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
            Pilihan Akses Cepat Demo:
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setLoginMode('admin');
                setAdminPasswordInput('607090');
                setErrorMessage(null);
              }}
              className="px-2.5 py-1 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-800 text-[10px] font-bold border border-teal-200/60 transition-all flex items-center gap-1"
            >
              <Shield className="w-3 h-3 text-teal-600" />
              <span>Admin (607090)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('staff');
                const target = staffUsers.find(u => u.name.includes('Septiana')) || staffUsers[0];
                if (target) handleSelectStaff(target);
              }}
              className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold border border-slate-200/60 transition-all"
            >
              Septiana (0000)
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('staff');
                const target = staffUsers.find(u => u.name.includes('Aan Bagus')) || staffUsers[1];
                if (target) handleSelectStaff(target);
              }}
              className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold border border-slate-200/60 transition-all"
            >
              Aan Bagus (0000)
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('staff');
                const target = staffUsers.find(u => u.name.includes('Fauzan')) || staffUsers[2];
                if (target) handleSelectStaff(target);
              }}
              className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold border border-slate-200/60 transition-all"
            >
              Fauzan (0000)
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center mt-5 text-[11px] text-slate-400 font-medium">
          FMCU TEAMS • Sistem Operasional Lapangan & Portal Manajemen
        </div>
      </div>
    </div>
  );
};
