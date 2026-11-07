import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Shield,
  ArrowRight,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { User } from '../types';
import { ADMIN_PASSWORD, ADMIN_USER, initialUsers } from '../data/mockData';
import { ParacetamolHero3D } from './3d-icons/Illustrations';

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
  // Admin Form State
  const [adminPasswordInput, setAdminPasswordInput] = useState('607090');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin Submit Handler
  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const entered = adminPasswordInput.trim();
    if (entered !== ADMIN_PASSWORD && entered !== '607090') {
      setErrorMessage('Kode Otorisasi salah! Masukkan kode resmi: 607090');
      setIsSubmitting(false);
      return;
    }

    // Admin authentication success
    const adminAccount = users.find((u) => u.isAdmin) || ADMIN_USER;
    onLogin(adminAccount);
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
          FIXED VIEWPORT LOGIN FORM (EXCLUSIVELY ADMIN FMCU)
          - Form login is completely fixed: cannot be dragged up or down.
          - Only ONE button: "Masuk sebagai Admin FMCU" (employee buttons removed).
          ========================================================================= */}
      <div className="relative z-10 w-full max-w-[420px] bg-white/95 backdrop-blur-2xl rounded-[36px] p-6 sm:p-8 shadow-soft-card border border-white/80 animate-in fade-in duration-500">
        {/* Top 3D Hero Illustration */}
        <div className="flex flex-col items-center justify-center -mt-2 mb-4">
          <div className="relative group cursor-pointer transition-transform duration-300 hover:scale-105">
            <ParacetamolHero3D className="w-24 h-24 sm:w-28 sm:h-28 drop-shadow-sm" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF8F2] text-[#2BB3A0] text-xs font-bold tracking-wide mt-1">
            <Shield className="w-3.5 h-3.5 text-[#2BB3A0]" />
            <span>PORTAL RESMI ADMIN</span>
          </div>

          <h1 className="text-2xl font-black text-slate-800 tracking-tight mt-1.5 text-center">
            Admin FMCU
          </h1>
          <p className="text-xs text-slate-400 font-medium text-center mt-0.5 max-w-xs">
            Akses kendali penuh Master Schedule, Audit Lapangan QSC, Radar GPS & Laporan PDF
          </p>
        </div>

        {/* Error Notification Alert */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ADMIN LOGIN FORM (ONLY ONE BUTTON - NO EMPLOYEE TAB/BUTTON) */}
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

          {/* Password Admin Input (607090) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-slate-600 font-bold">
                Kode Otorisasi Keamanan
              </label>
              <button
                type="button"
                onClick={() => setAdminPasswordInput('607090')}
                className="text-[10px] text-teal-700 font-bold bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded-full border border-teal-200/60 transition-colors cursor-pointer"
                title="Klik untuk mengisi kode resmi"
              >
                Kode Resmi: 607090
              </button>
            </div>

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
                className="absolute right-3.5 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* THE SINGLE PRIMARY SUBMISSION BUTTON: "Admin FMCU" */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-teal-600 via-teal-700 to-slate-800 text-white font-bold text-sm shadow-pill-teal hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
            >
              <Shield className="w-4 h-4 stroke-[2.5]" />
              <span>Masuk sebagai Admin FMCU</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </form>

        {/* Replay Splash Action */}
        {onReplaySplash && (
          <div className="mt-5 pt-3.5 border-t border-slate-100/90 flex flex-col items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={onReplaySplash}
              className="text-xs text-slate-400 hover:text-teal-700 font-semibold transition-colors flex items-center justify-center gap-1.5 py-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-teal-600" />
              <span>✨ Putar Ulang Animasi Splash</span>
            </button>

            <span className="text-[10px] text-slate-400 font-medium">
              FMCU TEAMS • Sistem Operasional Lapangan & Portal Manajemen
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
