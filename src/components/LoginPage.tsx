import React, { useState, useRef, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Shield,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Calendar,
  ClipboardCheck,
  Compass,
  FileText,
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
}

const CHARACTERS = ['F', 'M', 'C', 'U', ' ', 'T', 'E', 'A', 'M', 'S'];

const FMCU_HIGHLIGHTS = [
  {
    icon: Calendar,
    title: 'Master Schedule 582+ Agenda',
    desc: 'Sinkronisasi agenda kunjungan 36 staf lapangan, multi-kategori jadwal & filter instan.',
    badge: 'Real-Time Sync',
    color: 'from-teal-500 to-emerald-600',
    lightBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  },
  {
    icon: ClipboardCheck,
    title: 'Audit Lapangan Standar QSC & 6-Box',
    desc: 'Form inspeksi komprehensif, multi-evidence foto bukti & kalkulasi skor otomatis.',
    badge: 'Standar Mutu',
    color: 'from-cyan-500 to-blue-600',
    lightBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  },
  {
    icon: Compass,
    title: 'Radar Geofence GPS Presisi 1m–50m',
    desc: 'Validasi radius kedatangan fisik toko anti-fraud dengan radar visual interaktif.',
    badge: 'Anti-Fraud GPS',
    color: 'from-amber-500 to-orange-500',
    lightBg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  },
  {
    icon: FileText,
    title: 'Laporan PDF Kunjungan Landscape 16:9',
    desc: 'Generate otomatis Berita Acara, observasi & foto bukti siap cetak serta kirim.',
    badge: 'Instant 16:9 PDF',
    color: 'from-rose-500 to-pink-600',
    lightBg: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  },
  {
    icon: Sparkles,
    title: 'AI T.A.R.O Voice Dictation & Root-Cause',
    desc: 'Dikte suara cepat observasi toko serta diagnosis akar masalah rekomendasi solusi.',
    badge: 'AI Assistant',
    color: 'from-purple-500 to-indigo-600',
    lightBg: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({ users = initialUsers, onLogin }) => {
  // Splash sequence state: 'animating-letters' | 'showing-features' | 'dissolving' | 'ready'
  const [splashStage, setSplashStage] = useState<'animating-letters' | 'showing-features' | 'dissolving' | 'ready'>(
    'animating-letters'
  );

  // Letter reveal index (-1 means none, 0..9)
  const [revealedCharIndex, setRevealedCharIndex] = useState<number>(-1);

  // Dot coordinates and animation state
  const [dotPos, setDotPos] = useState<{
    x: number;
    y: number;
    opacity: number;
    scale: number;
    isExpanding: boolean;
  }>({
    x: 0,
    y: 0,
    opacity: 0,
    scale: 1,
    isExpanding: false,
  });

  // Feature carousel index highlight during feature stage
  const [activeFeatureIndex, setActiveFeatureIndex] = useState<number>(0);

  // Admin Form State
  const [adminPasswordInput, setAdminPasswordInput] = useState('607090');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs for tracking character positions
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const lettersContainerRef = useRef<HTMLDivElement>(null);

  // 1. Splash Animation Logic: Glide dot and reveal letters sequentially
  useEffect(() => {
    if (splashStage !== 'animating-letters') return;

    let isMounted = true;
    let timerIds: ReturnType<typeof setTimeout>[] = [];

    const updateDotToChar = (index: number) => {
      if (!isMounted) return;
      const charEl = charRefs.current[index];
      const contEl = lettersContainerRef.current;
      if (charEl && contEl) {
        const charRect = charEl.getBoundingClientRect();
        const contRect = contEl.getBoundingClientRect();
        const x = charRect.left - contRect.left + charRect.width / 2;
        const y = charRect.top - contRect.top + charRect.height / 2;

        setDotPos({
          x,
          y,
          opacity: 1,
          scale: 1,
          isExpanding: false,
        });
        setRevealedCharIndex(index);
      }
    };

    // Initial pause before dot appears at letter 'F' (0)
    const t0 = setTimeout(() => {
      if (!isMounted) return;
      updateDotToChar(0);

      let currentIdx = 0;
      const interval = setInterval(() => {
        if (!isMounted) {
          clearInterval(interval);
          return;
        }
        currentIdx++;
        if (currentIdx < CHARACTERS.length) {
          updateDotToChar(currentIdx);
        } else {
          clearInterval(interval);
          // All letters revealed smoothly! Transition to features showcase
          const t1 = setTimeout(() => {
            if (isMounted) {
              setSplashStage('showing-features');
            }
          }, 600);
          timerIds.push(t1);
        }
      }, 230); // 230ms smooth glide per character

      return () => clearInterval(interval);
    }, 450);

    timerIds.push(t0);

    return () => {
      isMounted = false;
      timerIds.forEach((id) => clearTimeout(id));
    };
  }, [splashStage]);

  // 2. Feature Rotation Timer while in 'showing-features'
  useEffect(() => {
    if (splashStage !== 'showing-features') return;
    const interval = setInterval(() => {
      setActiveFeatureIndex((prev) => (prev + 1) % FMCU_HIGHLIGHTS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [splashStage]);

  // 3. Trigger Dot Expansion and Dissolve into Login Form
  const triggerDissolve = () => {
    if (splashStage === 'dissolving' || splashStage === 'ready') return;
    setSplashStage('dissolving');

    // Move dot to the dead center and trigger smooth massive scale expansion
    if (lettersContainerRef.current) {
      const rect = lettersContainerRef.current.getBoundingClientRect();
      setDotPos({
        x: rect.width / 2,
        y: rect.height / 2,
        opacity: 1,
        scale: 90,
        isExpanding: true,
      });
    } else {
      setDotPos((prev) => ({
        ...prev,
        scale: 90,
        isExpanding: true,
      }));
    }

    // Complete dissolve after 1100ms
    setTimeout(() => {
      setSplashStage('ready');
    }, 1100);
  };

  // Skip splash completely
  const handleSkipSplash = () => {
    setSplashStage('ready');
  };

  // Replay splash from beginning
  const handleReplaySplash = () => {
    setRevealedCharIndex(-1);
    setDotPos({
      x: 0,
      y: 0,
      opacity: 0,
      scale: 1,
      isExpanding: false,
    });
    setSplashStage('animating-letters');
  };

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
      className="fixed inset-0 w-screen h-screen overflow-hidden select-none touch-none overscroll-none flex items-center justify-center p-4 bg-[#F8F9FD]"
      style={{ height: '100dvh', maxHeight: '100dvh' }}
      onTouchMove={(e) => e.preventDefault()}
      onWheel={(e) => e.preventDefault()}
    >
      {/* Decorative ambient background glows */}
      <div className="absolute top-12 left-10 w-72 h-72 bg-[#D4F4E2]/60 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#FFE6D5]/60 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-[#E8EEFF]/70 rounded-full blur-3xl pointer-events-none -z-0" />

      {/* =========================================================================
          STAGE A: WELCOME SPLASH ANIMATION (CINEMATIC DARK VIEWPORT)
          ========================================================================= */}
      {splashStage !== 'ready' && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-6 sm:p-10 bg-[#070B14] transition-opacity duration-1000 ${
            splashStage === 'dissolving' ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          {/* Subtle Ambient Cosmic Glows */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-teal-500/20 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 right-10 w-[450px] h-[300px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
          <div className="absolute top-1/3 left-10 w-[350px] h-[250px] bg-emerald-500/15 rounded-full blur-[130px] pointer-events-none" />

          {/* Top Bar: Brand Pill & Skip Button */}
          <div className="w-full max-w-4xl flex items-center justify-between z-20">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-teal-300 text-[11px] font-bold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span>Sistem Terpadu FMCU Teams</span>
            </div>

            <button
              type="button"
              onClick={handleSkipSplash}
              className="px-4 py-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold backdrop-blur-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>Lewati</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Central Area: Large Glowing Dot & "FMCU TEAMS" Letter Reveal */}
          <div className="w-full max-w-4xl flex flex-col items-center justify-center my-auto z-20 text-center">
            {/* The Text & Dot Stage */}
            <div
              ref={lettersContainerRef}
              className="relative inline-flex items-center justify-center py-6 px-4"
            >
              {/* LARGE GLOWING WHITE DOT (starts at 'F', glides to 'S', expands and dissolves) */}
              <div
                className="absolute rounded-full pointer-events-none z-30 transition-all"
                style={{
                  left: `${dotPos.x}px`,
                  top: `${dotPos.y}px`,
                  width: '28px',
                  height: '28px',
                  transform: `translate(-50%, -50%) scale(${dotPos.scale})`,
                  opacity: dotPos.opacity,
                  transitionProperty: dotPos.isExpanding
                    ? 'all'
                    : 'left, top, opacity, transform',
                  transitionDuration: dotPos.isExpanding ? '1100ms' : '230ms',
                  transitionTimingFunction: dotPos.isExpanding
                    ? 'cubic-bezier(0.4, 0, 0.2, 1)'
                    : 'cubic-bezier(0.25, 1, 0.35, 1)',
                  background: '#FFFFFF',
                  boxShadow: dotPos.isExpanding
                    ? '0 0 150px 60px #FFFFFF, 0 0 300px 100px rgba(45,212,191,0.9), 0 0 500px 150px rgba(56,189,248,0.7)'
                    : '0 0 25px 6px #FFFFFF, 0 0 55px 14px rgba(45,212,191,0.8), 0 0 90px 24px rgba(56,189,248,0.5)',
                }}
              />

              {/* Characters of "FMCU TEAMS" */}
              <div className="flex items-center text-4xl sm:text-6xl md:text-7xl font-black tracking-[0.16em] sm:tracking-[0.24em] font-sans">
                {CHARACTERS.map((char, idx) => {
                  const isRevealed = idx <= revealedCharIndex;
                  const isCurrent = idx === revealedCharIndex;

                  if (char === ' ') {
                    return (
                      <span
                        key={idx}
                        ref={(el) => (charRefs.current[idx] = el)}
                        className="w-4 sm:w-8 inline-block select-none"
                      >
                        &nbsp;
                      </span>
                    );
                  }

                  return (
                    <span
                      key={idx}
                      ref={(el) => (charRefs.current[idx] = el)}
                      className={`inline-block transition-all duration-500 select-none ${
                        isRevealed
                          ? 'opacity-100 translate-y-0 scale-100 blur-0'
                          : 'opacity-0 translate-y-4 scale-75 blur-sm'
                      } ${
                        isCurrent
                          ? 'text-white brightness-150 drop-shadow-[0_0_30px_rgba(255,255,255,1)]'
                          : 'text-slate-100 drop-shadow-[0_4px_16px_rgba(255,255,255,0.35)]'
                      }`}
                      style={{
                        textShadow: isCurrent
                          ? '0 0 35px #FFFFFF, 0 0 65px rgba(45,212,191,0.9)'
                          : isRevealed
                          ? '0 0 20px rgba(255,255,255,0.45)'
                          : 'none',
                      }}
                    >
                      {char}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Tagline Subtitle */}
            <p
              className={`text-xs sm:text-sm text-teal-300 font-semibold tracking-widest uppercase mt-1 transition-all duration-700 ${
                revealedCharIndex >= CHARACTERS.length - 1
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-2'
              }`}
            >
              Field Monitoring & Control Unit Platform
            </p>

            {/* Standout Features Showcase (Emerges after text reveal) */}
            <div
              className={`mt-6 sm:mt-8 w-full max-w-2xl transition-all duration-700 ${
                splashStage === 'showing-features'
                  ? 'opacity-100 translate-y-0 scale-100'
                  : 'opacity-0 translate-y-6 scale-95 pointer-events-none'
              }`}
            >
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span>Fitur Unggulan FMCU Teams</span>
              </div>

              {/* Grid of Highlight Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left mb-6">
                {FMCU_HIGHLIGHTS.slice(0, 4).map((feat, i) => {
                  const Icon = feat.icon;
                  const isActive = i === activeFeatureIndex % 4;
                  return (
                    <div
                      key={feat.title}
                      onClick={() => setActiveFeatureIndex(i)}
                      className={`p-3 rounded-2xl border backdrop-blur-md transition-all duration-300 cursor-pointer ${
                        isActive
                          ? 'bg-white/15 border-teal-400/50 shadow-lg shadow-teal-500/10 scale-[1.02]'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-xl bg-gradient-to-br ${feat.color} flex items-center justify-center text-white flex-shrink-0 shadow-sm`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <h4 className="text-xs font-bold text-white truncate">
                              {feat.title}
                            </h4>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${feat.lightBg}`}
                            >
                              {feat.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-300 leading-snug line-clamp-2">
                            {feat.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Primary Action to Dissolve & Enter Portal */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={triggerDissolve}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-gradient-to-r from-teal-400 via-teal-500 to-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-teal-500/25 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Buka Portal Login Admin</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Footer on Splash */}
          <div className="w-full text-center z-20">
            <span className="text-[11px] text-slate-500 font-medium">
              FMCU TEAMS • Sistem Audit & Operasional Lapangan 2026
            </span>
          </div>
        </div>
      )}

      {/* Expanding Dissolve Flash Barrier */}
      {splashStage === 'dissolving' && (
        <div
          className="fixed inset-0 pointer-events-none z-45 bg-white transition-opacity duration-1000 ease-out"
          style={{ opacity: 0.95 }}
        />
      )}

      {/* =========================================================================
          STAGE B: FIXED VIEWPORT LOGIN FORM (EXCLUSIVELY ADMIN FMCU)
          "form login dibuat fix tidak bisa ditarik atas bawah,
           kemudain hanya ada satu tombol admin FMCU tombol karyawan dihilangakn"
          ========================================================================= */}
      <div
        className={`relative z-10 w-full max-w-[420px] bg-white/95 backdrop-blur-2xl rounded-[36px] p-6 sm:p-8 shadow-soft-card border border-white/80 transition-all duration-700 ${
          splashStage === 'ready'
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
        }`}
      >
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

        {/* Replay Splash & Feature Tour Action */}
        <div className="mt-5 pt-3.5 border-t border-slate-100/90 flex flex-col items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={handleReplaySplash}
            className="text-xs text-slate-400 hover:text-teal-700 font-semibold transition-colors flex items-center justify-center gap-1.5 py-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-teal-600" />
            <span>✨ Putar Ulang Animasi & Fitur Unggulan</span>
          </button>

          <span className="text-[10px] text-slate-400 font-medium">
            FMCU TEAMS • Sistem Operasional Lapangan & Portal Manajemen
          </span>
        </div>
      </div>
    </div>
  );
};
