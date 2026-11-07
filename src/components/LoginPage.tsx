import React, { useState, useRef, useEffect } from 'react';
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
}

const CHARACTERS = ['F', 'M', 'C', 'U', ' ', 'T', 'E', 'A', 'M', 'S'];

export const LoginPage: React.FC<LoginPageProps> = ({ users = initialUsers, onLogin }) => {
  // Splash sequence state: 'animating-letters' | 'dissolving' | 'ready'
  const [splashStage, setSplashStage] = useState<'animating-letters' | 'dissolving' | 'ready'>(
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

  // Admin Form State
  const [adminPasswordInput, setAdminPasswordInput] = useState('607090');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs for tracking character positions and after-S anchor
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const afterSRef = useRef<HTMLSpanElement>(null);
  const lettersContainerRef = useRef<HTMLDivElement>(null);

  // Synchronize mobile status bar / theme-color with web background
  useEffect(() => {
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTheme);
    }
    // Set to #F8F9FD when login form is open, #070B14 during dark splash
    metaTheme.setAttribute('content', splashStage === 'ready' ? '#F8F9FD' : '#070B14');
  }, [splashStage]);

  // Trigger Dot Expansion and Dissolve into Login Form
  const triggerDissolve = () => {
    if (splashStage === 'dissolving' || splashStage === 'ready') return;
    setSplashStage('dissolving');

    // Smooth massive scale expansion to envelope screen and dissolve gracefully
    setDotPos((prev) => ({
      ...prev,
      scale: 90,
      isExpanding: true,
    }));

    // Complete dissolve after 850ms for a majestic, smooth transition
    setTimeout(() => {
      setSplashStage('ready');
    }, 850);
  };

  // 1. Splash Animation Logic:
  // - Starts with a calm breath (280ms)
  // - Glides at majestic pace (160ms per character)
  // - Stops right after 'S' on TEAMS for 600ms
  // - Expands and dissolves into Login Form
  useEffect(() => {
    if (splashStage !== 'animating-letters') return;

    let isMounted = true;
    let timerIds: ReturnType<typeof setTimeout>[] = [];

    const updateDotToChar = (index: number) => {
      if (!isMounted) return;
      const contEl = lettersContainerRef.current;
      let charEl: HTMLElement | null = null;

      if (index < CHARACTERS.length) {
        charEl = charRefs.current[index];
      } else if (index === CHARACTERS.length) {
        // Target anchor right after letter 'S'
        charEl = afterSRef.current;
      }

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

        if (index < CHARACTERS.length) {
          setRevealedCharIndex(index);
        }
      }
    };

    // Calm initial pause before gliding begins (280ms)
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
        if (currentIdx <= CHARACTERS.length) {
          updateDotToChar(currentIdx);
        } else {
          clearInterval(interval);
          // Dot has arrived right after 'S' and stops there!
          // Pauses for 600ms so the user can enjoy the completed glowing title
          const t1 = setTimeout(() => {
            if (isMounted) {
              triggerDissolve();
            }
          }, 600);
          timerIds.push(t1);
        }
      }, 160); // 160ms per character for an elegant, majestic glide

      return () => clearInterval(interval);
    }, 280);

    timerIds.push(t0);

    return () => {
      isMounted = false;
      timerIds.forEach((id) => clearTimeout(id));
    };
  }, [splashStage]);

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
          STAGE A: CLEAN CINEMATIC SPLASH SCREEN (PERFECTLY CENTERED, NO BUTTONS/TEXT)
          - No buttons, no top bar, no footer, no subtitles.
          - Large glowing dot glides and stops right after 'S' on TEAMS.
          - Multi-tier progressive Gaussian text-shadow: seamless, radiant, zero boxiness.
          ========================================================================= */}
      {splashStage !== 'ready' && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-[#070B14] transition-opacity duration-700 ${
            splashStage === 'dissolving' ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          {/* Subtle Ambient Cosmic Glows */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-teal-500/15 rounded-full blur-[130px] pointer-events-none" />
          <div className="absolute bottom-0 right-10 w-[450px] h-[300px] bg-blue-600/10 rounded-full blur-[150px] pointer-events-none" />
          <div className="absolute top-1/3 left-10 w-[350px] h-[250px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

          {/* Perfectly Centered Stage */}
          <div
            ref={lettersContainerRef}
            className="relative inline-flex items-center justify-center px-6 py-8 overflow-visible"
          >
            {/* LARGE GLOWING WHITE DOT (starts at 'F', glides to 'S', stops after 'S', expands and dissolves) */}
            <div
              className="absolute rounded-full pointer-events-none z-30"
              style={{
                left: `${dotPos.x}px`,
                top: `${dotPos.y}px`,
                width: '26px',
                height: '26px',
                transform: `translate(-50%, -50%) scale(${dotPos.scale})`,
                opacity: dotPos.opacity,
                transition: dotPos.isExpanding
                  ? 'transform 850ms cubic-bezier(0.4, 0, 0.2, 1), opacity 650ms ease-out'
                  : 'left 160ms cubic-bezier(0.25, 1, 0.35, 1), top 160ms cubic-bezier(0.25, 1, 0.35, 1), opacity 200ms ease-out',
                background: '#FFFFFF',
                boxShadow: dotPos.isExpanding
                  ? '0 0 160px 70px #FFFFFF, 0 0 320px 120px rgba(45,212,191,0.9), 0 0 500px 180px rgba(56,189,248,0.7)'
                  : '0 0 20px 5px #FFFFFF, 0 0 45px 12px rgba(45,212,191,0.85), 0 0 80px 24px rgba(56,189,248,0.5)',
              }}
            />

            {/* Typography "FMCU TEAMS" with Seamless Multi-Tier Text-Shadow */}
            <div className="flex items-center text-4xl sm:text-6xl md:text-7xl font-black tracking-[0.16em] sm:tracking-[0.24em] font-sans overflow-visible">
              {CHARACTERS.map((char, idx) => {
                const isRevealed = idx <= revealedCharIndex;
                const isCurrent = idx === revealedCharIndex;

                if (char === ' ') {
                  return (
                    <span
                      key={idx}
                      ref={(el) => (charRefs.current[idx] = el)}
                      className="w-3 sm:w-6 inline-block select-none"
                    >
                      &nbsp;
                    </span>
                  );
                }

                return (
                  <span
                    key={idx}
                    ref={(el) => (charRefs.current[idx] = el)}
                    className="inline-block select-none transition-all duration-300 overflow-visible"
                    style={{
                      opacity: isRevealed ? 1 : 0,
                      transform: isRevealed
                        ? 'translateY(0) scale(1)'
                        : 'translateY(6px) scale(0.85)',
                      color: '#FFFFFF',
                      // Multi-tiered concentric Gaussian text-shadow: seamless, deep bloom, no boxiness
                      textShadow: isCurrent
                        ? '0 0 8px #FFFFFF, 0 0 18px rgba(255, 255, 255, 0.9), 0 0 32px rgba(45, 212, 191, 0.8), 0 0 55px rgba(45, 212, 191, 0.5), 0 0 85px rgba(56, 189, 248, 0.3)'
                        : isRevealed
                        ? '0 0 6px rgba(255, 255, 255, 0.8), 0 0 15px rgba(255, 255, 255, 0.5), 0 0 28px rgba(45, 212, 191, 0.4), 0 0 48px rgba(45, 212, 191, 0.2)'
                        : 'none',
                    }}
                  >
                    {char}
                  </span>
                );
              })}

              {/* Anchor Slot right AFTER letter 'S' on TEAMS (where the dot stops) */}
              <span
                ref={afterSRef}
                className="w-4 sm:w-6 h-8 inline-flex items-center justify-center select-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Expanding Dissolve Flash Barrier */}
      {splashStage === 'dissolving' && (
        <div
          className="fixed inset-0 pointer-events-none z-45 bg-white transition-opacity duration-700 ease-out"
          style={{ opacity: 0.95 }}
        />
      )}

      {/* =========================================================================
          STAGE B: FIXED VIEWPORT LOGIN FORM (EXCLUSIVELY ADMIN FMCU)
          - Form login is completely fixed: cannot be dragged up or down.
          - Only ONE button: "Masuk sebagai Admin FMCU" (employee buttons removed).
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

        {/* Replay Splash Action */}
        <div className="mt-5 pt-3.5 border-t border-slate-100/90 flex flex-col items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={handleReplaySplash}
            className="text-xs text-slate-400 hover:text-teal-700 font-semibold transition-colors flex items-center justify-center gap-1.5 py-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-teal-600" />
            <span>✨ Putar Ulang Animasi Splash</span>
          </button>

          <span className="text-[10px] text-slate-400 font-medium">
            FMCU TEAMS • Sistem Operasional Lapangan & Portal Manajemen
          </span>
        </div>
      </div>
    </div>
  );
};
