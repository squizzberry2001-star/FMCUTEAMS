import React, { useState, useRef, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  User as UserIcon,
  Shield,
  ArrowRight,
  ChevronDown,
  Check,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { User } from '../types';
import { ADMIN_PASSWORD, ADMIN_USER, initialUsers } from '../data/mockData';
import { ParacetamolHero3D } from './3d-icons/Illustrations';
import { PageTransitionLoader } from './PageTransitionLoader';
import { DeveloperFooter } from './DeveloperFooter';

interface LoginPageProps {
  users?: User[];
  onLogin: (user: User) => void;
  onContinueAsGuest?: () => void;
  onReplaySplash?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  users = initialUsers,
  onLogin,
  onReplaySplash,
}) => {
  // Staff users list (36 names from Excel)
  const staffUsers = users.filter((u) => !u.isAdmin);

  // Login Mode: DEFAULT is 'member' (Anggota), changes to 'admin' when admin button clicked
  const [loginMode, setLoginMode] = useState<'member' | 'admin'>('member');

  // Member / Staff Form State (Default Kosong)
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Admin Form State (Default Kosong)
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter staff list according to user typing
  const filteredStaff = staffUsers.filter((u) =>
    u.name.toLowerCase().includes(staffSearchQuery.toLowerCase())
  );

  // Close dropdown on click outside
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
    setShowStaffDropdown(false);
    setErrorMessage(null);
  };

  // Member Submit Handler (with 5-second loading animation on click Masuk)
  const handleMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);

    const foundUser = staffUsers.find(
      (u) => u.name.toLowerCase() === staffSearchQuery.trim().toLowerCase()
    );

    if (!foundUser) {
      setTimeout(() => {
        setErrorMessage(`Nama "${staffSearchQuery}" belum terdaftar. Silakan pilih dari 36 nama karyawan.`);
        setIsSubmitting(false);
      }, 600);
      return;
    }

    const expectedPassword = foundUser.password || '0000';
    if (staffPassword !== expectedPassword) {
      setTimeout(() => {
        setErrorMessage('Password salah! Silakan periksa kembali password akun Anda.');
        setIsSubmitting(false);
      }, 600);
      return;
    }

    // Show 5-second loading animation before entering the app
    setTimeout(() => {
      setIsSubmitting(false);
      onLogin(foundUser);
    }, 5000);
  };

  // Admin Submit Handler (with 5-second loading animation on click Masuk)
  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);
    setIsSubmitting(true);

    const entered = adminPasswordInput.trim();
    if (entered !== ADMIN_PASSWORD && entered !== '607090') {
      setTimeout(() => {
        setErrorMessage('Kode Otorisasi salah! Masukkan kode resmi: 607090');
        setIsSubmitting(false);
      }, 600);
      return;
    }

    const adminAccount = users.find((u) => u.isAdmin) || ADMIN_USER;
    setTimeout(() => {
      setIsSubmitting(false);
      onLogin(adminAccount);
    }, 5000);
  };

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden select-none touch-none overscroll-none flex items-center justify-center p-4 bg-[#F8F9FD]"
      style={{
        height: '100dvh',
        minHeight: '100vh',
        backgroundColor: '#F8F9FD',
        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
      }}
      onTouchMove={(e) => e.preventDefault()}
      onWheel={(e) => e.preventDefault()}
    >
      {/* 5-Second Loading Animation Overlay on Login Submit */}
      <PageTransitionLoader visible={isSubmitting} delayMs={0} />
      {/* Full-bleed solid background shield matching web color `#F8F9FD` */}
      <div
        className="fixed inset-0 -z-10 bg-[#F8F9FD] pointer-events-none"
        style={{ backgroundColor: '#F8F9FD' }}
      />

      {/* Decorative ambient background glows */}
      <div className="absolute top-12 left-10 w-72 h-72 bg-[#D4F4E2]/60 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#FFE6D5]/60 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-[#E8EEFF]/70 rounded-full blur-3xl pointer-events-none -z-0" />

      {/* =========================================================================
          FIXED VIEWPORT LOGIN FORM CARD
          - Default: Form Anggota (36 Staff Selection)
          - Switches to Form Admin FMCU when admin button is clicked
          - Completely fixed: no vertical pulling or rubber-banding
          ========================================================================= */}
      <div className="relative z-10 w-full max-w-[420px] bg-white/95 backdrop-blur-2xl rounded-[36px] p-6 sm:p-7 shadow-soft-card border border-white/80 animate-in fade-in duration-300">
        {/* Top 3D Hero Illustration */}
        <div className="flex flex-col items-center justify-center -mt-2 mb-3">
          <div className="relative group cursor-pointer transition-transform duration-300 hover:scale-105">
            <ParacetamolHero3D className="w-22 h-22 sm:w-24 sm:h-24 drop-shadow-sm" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF8F2] text-[#2BB3A0] text-xs font-bold tracking-wide mt-1">
            {loginMode === 'member' ? (
              <>
                <Users className="w-3.5 h-3.5 text-[#2BB3A0]" />
                <span>PORTAL ANGGOTA TIM</span>
              </>
            ) : (
              <>
                <Shield className="w-3.5 h-3.5 text-[#2BB3A0]" />
                <span>PORTAL RESMI ADMIN</span>
              </>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight mt-1 text-center">
            {loginMode === 'member' ? 'Login Anggota FMCU' : 'Admin FMCU'}
          </h1>
          <p className="text-xs text-slate-400 font-medium text-center mt-0.5 max-w-xs">
            {loginMode === 'member'
              ? 'Pilih nama Anda dari 36 user jadwal untuk masuk ke agenda'
              : 'Akses kendali penuh Master Schedule, Audit Toko & Laporan'}
          </p>
        </div>

        {/* Error Notification Alert */}
        {errorMessage && (
          <div className="mb-3.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* -------------------------------------------------------------------------
            1. FORM ANGGOTA (DEFAULT VIEW)
            ------------------------------------------------------------------------- */}
        {loginMode === 'member' ? (
          <form onSubmit={handleMemberSubmit} className="space-y-3.5">
            {/* Nama Anggota (Autocomplete Dropdown dari 36 nama Excel) */}
            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs text-slate-600 font-bold mb-1 flex items-center justify-between">
                <span>Nama Anggota Tim</span>
                <span className="text-[10px] text-teal-600 font-semibold">{staffUsers.length} Terdaftar</span>
              </label>

              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none">
                  {selectedStaff &&
                  selectedStaff.avatar &&
                  selectedStaff.name.toLowerCase() === staffSearchQuery.trim().toLowerCase() ? (
                    <img
                      src={selectedStaff.avatar}
                      alt={selectedStaff.name}
                      className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-200"
                    />
                  ) : (
                    <UserIcon className="w-4 h-4 text-slate-400" />
                  )}
                </div>

                <input
                  type="text"
                  value={staffSearchQuery}
                  onChange={(e) => {
                    setStaffSearchQuery(e.target.value);
                    if (
                      selectedStaff &&
                      e.target.value.trim().toLowerCase() !== selectedStaff.name.toLowerCase()
                    ) {
                      setSelectedStaff(null);
                    }
                    setShowStaffDropdown(true);
                  }}
                  onFocus={() => setShowStaffDropdown(true)}
                  placeholder="Pilih nama Anda..."
                  required
                  className="w-full bg-[#F8FAFC] border border-slate-200/90 rounded-2xl pl-11 pr-10 py-2.5 text-[16px] sm:text-xs font-bold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all placeholder:font-normal placeholder:text-slate-400"
                />

                <button
                  type="button"
                  onClick={() => setShowStaffDropdown(!showStaffDropdown)}
                  className="absolute right-3 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showStaffDropdown ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Dropdown 36 Anggota */}
              {showStaffDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-40 max-h-48 overflow-y-auto no-scrollbar animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex justify-between items-center">
                    <span>Pilih Dari 36 Karyawan Lapangan</span>
                  </div>
                  {filteredStaff.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-400 font-medium">
                      Nama tidak cocok. Pastikan memilih salah satu nama jadwal.
                    </div>
                  ) : (
                    filteredStaff.map((u) => {
                      const isCurrent = u.name.toLowerCase() === staffSearchQuery.toLowerCase();
                      return (
                        <button
                          key={u.id || u.name}
                          type="button"
                          onClick={() => handleSelectStaff(u)}
                          className={`w-full px-3 py-2 flex items-center justify-between text-left hover:bg-teal-50/70 transition-colors cursor-pointer ${
                            isCurrent ? 'bg-teal-50/50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={u.avatar}
                              alt={u.name}
                              className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200 flex-shrink-0"
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
                          {isCurrent && <Check className="w-4 h-4 text-teal-600 flex-shrink-0 ml-2" />}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Password Anggota (Default Kosong, Tanpa Badge Default) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-600 font-bold">Password Anggota</label>
              </div>

              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="Masukkan password..."
                  required
                  className="w-full bg-[#F8FAFC] border border-slate-200/90 rounded-2xl pl-10 pr-11 py-2.5 text-[16px] sm:text-xs font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all tracking-wider placeholder:tracking-normal placeholder:font-normal"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
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
                  className="w-3.5 h-3.5 rounded text-teal-600 border-slate-300 focus:ring-teal-500 cursor-pointer"
                />
                <span className="text-slate-500 font-medium text-[11px]">Ingat akun saya di perangkat ini</span>
              </label>
            </div>

            {/* Submit Button Anggota */}
            <div className="pt-1">
              <button
                type="submit"
                data-splash-target="login-submit-btn"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#32C2AD] to-[#20A894] text-white font-bold text-sm shadow-pill-teal hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>Masuk ke Jadwal Saya</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* SWITCH TO ADMIN BUTTON ("form akan berubah jika tombol admin di klik") */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('admin');
                  setErrorMessage(null);
                  setAdminPasswordInput('');
                }}
                className="w-full py-2.5 px-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Shield className="w-4 h-4 text-teal-600" />
                <span>Masuk sebagai Admin FMCU</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </form>
        ) : (
          /* -------------------------------------------------------------------------
              2. FORM ADMIN FMCU (ACTIVATED ON ADMIN BUTTON CLICK)
              ------------------------------------------------------------------------- */
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            {/* Admin Account Header Card */}
            <div className="p-3 bg-gradient-to-r from-teal-50/90 to-blue-50/90 border border-teal-200/70 rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-800">Administrator FMCU</span>
                  <span className="text-[9px] font-bold bg-teal-600 text-white px-1.5 py-0.2 rounded-full uppercase">
                    Super Admin
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium truncate">admin@fmcuteams.com</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
            </div>

            {/* Password Admin Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-600 font-bold">Kode Otorisasi Keamanan</label>
              </div>

              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="Masukkan kode otorisasi..."
                  required
                  autoFocus
                  className="w-full bg-[#F8FAFC] border border-slate-200/90 rounded-2xl pl-10 pr-11 py-2.5 text-[16px] sm:text-xs font-bold text-slate-800 outline-none focus:border-teal-500 focus:bg-white transition-all tracking-widest placeholder:tracking-normal placeholder:font-normal"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button Admin */}
            <div className="pt-1">
              <button
                type="submit"
                data-splash-target="login-submit-btn"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-teal-600 via-teal-700 to-slate-800 text-white font-bold text-sm shadow-pill-teal hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
              >
                <Shield className="w-4 h-4 stroke-[2.5]" />
                <span>Masuk sebagai Admin FMCU</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* SWITCH BACK TO MEMBER BUTTON */}
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('member');
                  setErrorMessage(null);
                }}
                className="w-full py-2 px-3 rounded-2xl text-slate-500 hover:text-slate-800 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>← Kembali ke Form Anggota Tim</span>
              </button>
            </div>
          </form>
        )}

        {/* Replay Splash Action & Minimalist Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100/90 flex flex-col items-center justify-center gap-1">
          {onReplaySplash && (
            <button
              type="button"
              onClick={onReplaySplash}
              className="text-xs text-slate-400 hover:text-teal-700 font-semibold transition-colors flex items-center justify-center gap-1.5 py-0.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-teal-600" />
              <span>✨ Putar Ulang Animasi Splash</span>
            </button>
          )}

          <DeveloperFooter className="mt-0.5 text-center" />
        </div>
      </div>
    </div>
  );
};
