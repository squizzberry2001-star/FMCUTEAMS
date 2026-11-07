import React, { useState, useEffect } from 'react';
import {
  Download,
  Smartphone,
  Monitor,
  Share,
  PlusSquare,
  CheckCircle2,
  X,
  Sparkles,
  MoreVertical,
  Laptop,
} from 'lucide-react';

export type DevicePlatform = 'android' | 'ios' | 'windows' | 'macos';

const detectPlatform = (): DevicePlatform => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'android';
  }
  const ua = navigator.userAgent || navigator.vendor || '';
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || '';

  if (/iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/android/i.test(ua)) {
    return 'android';
  }
  if (/Mac/i.test(platform) || /Macintosh|Mac OS X/i.test(ua)) {
    return 'macos';
  }
  if (/Win/i.test(platform) || /Windows/i.test(ua)) {
    return 'windows';
  }
  return 'android';
};

const isRunningStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  const isStandaloneDisplay = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const isIosStandalone = (window.navigator as any).standalone === true;
  return Boolean(isStandaloneDisplay || isIosStandalone);
};

interface PwaInstallPromptProps {
  readyToShow: boolean;
}

export const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = ({ readyToShow }) => {
  const [detectedPlatform] = useState<DevicePlatform>(() => detectPlatform());
  const [activeTab, setActiveTab] = useState<DevicePlatform>(() => detectPlatform());
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() =>
    typeof window !== 'undefined' ? (window as any).__fmcuDeferredPwaPrompt || null : null
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isRunningStandalone());
  const [showModal, setShowModal] = useState<boolean>(() => {
    if (isRunningStandalone()) return false;
    return localStorage.getItem('fmcu_pwa_installed_flag') !== 'true' &&
      sessionStorage.getItem('fmcu_pwa_prompt_dismissed') !== 'true';
  });
  const [showGuideSteps, setShowGuideSteps] = useState<boolean>(false);

  useEffect(() => {
    const syncDeferred = () => {
      if ((window as any).__fmcuDeferredPwaPrompt) {
        setDeferredPrompt((window as any).__fmcuDeferredPwaPrompt);
      }
    };

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      (window as any).__fmcuDeferredPwaPrompt = e;
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowModal(false);
      try {
        localStorage.setItem('fmcu_pwa_installed_flag', 'true');
      } catch (err) {
        console.warn(err);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('fmcu-pwa-ready', syncDeferred);
    window.addEventListener('appinstalled', handleAppInstalled);
    syncDeferred();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('fmcu-pwa-ready', syncDeferred);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (!readyToShow || isInstalled || !showModal) return null;

  const handleNativeInstallClick = async () => {
    const promptEvent = deferredPrompt || (window as any).__fmcuDeferredPwaPrompt;
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        if (choiceResult?.outcome === 'accepted') {
          localStorage.setItem('fmcu_pwa_installed_flag', 'true');
          setIsInstalled(true);
          setShowModal(false);
        }
        (window as any).__fmcuDeferredPwaPrompt = null;
        setDeferredPrompt(null);
      } catch (err) {
        console.warn(err);
        setShowGuideSteps(true);
      }
    } else {
      // Show step-by-step instructions for browsers without native prompt (e.g. iOS Safari / macOS Safari)
      setShowGuideSteps(true);
    }
  };

  const handleDismiss = () => {
    try {
      sessionStorage.setItem('fmcu_pwa_prompt_dismissed', 'true');
    } catch (e) {
      console.warn(e);
    }
    setShowModal(false);
  };

  const handleMarkAlreadyInstalled = () => {
    try {
      localStorage.setItem('fmcu_pwa_installed_flag', 'true');
    } catch (e) {
      console.warn(e);
    }
    setShowModal(false);
  };

  const platformLabels: Record<DevicePlatform, string> = {
    android: 'Android',
    ios: 'iOS (iPhone/iPad)',
    windows: 'Windows PC',
    macos: 'macOS',
  };

  return (
    <div className="fixed inset-0 z-[9200] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 relative overflow-hidden">
        {/* Top Ambient Soft Glass Accent */}
        <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-teal-400/15 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full bg-blue-400/15 blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer z-10"
          title="Tutup"
        >
          <X className="w-4 h-4" />
        </button>

        {/* App Icon + Header */}
        <div className="flex items-center gap-3.5 pt-1">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200/80 shadow-md shrink-0 bg-white">
            <img
              src="/icon-192.png?v=2"
              alt="FMCU TEAMS"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 pr-6">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200">
              <Sparkles className="w-2.5 h-2.5" />
              Terdeteksi: {platformLabels[detectedPlatform]}
            </span>
            <h3 className="text-base font-black text-slate-900 leading-tight mt-1">
              Install Web App FMCU TEAMS
            </h3>
            <p className="text-[11px] text-slate-500 font-medium leading-snug mt-0.5">
              Pasang aplikasi di perangkat Anda untuk akses penuh layar, GPS lebih stabil & cepat.
            </p>
          </div>
        </div>

        {/* Platform Switcher Tabs (Android, iOS, Windows, macOS) */}
        <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-2xl">
          {(
            [
              { id: 'android', label: 'Android', icon: Smartphone },
              { id: 'ios', label: 'iOS', icon: Smartphone },
              { id: 'windows', label: 'Windows', icon: Monitor },
              { id: 'macos', label: 'macOS', icon: Laptop },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1.5 px-1 rounded-xl text-[10px] font-extrabold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Platform-Specific Instructions Box */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-left">
          {activeTab === 'android' && (
            <>
              <div className="text-[11px] font-extrabold text-slate-800 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-teal-600" />
                <span>Cara Install di Android (Chrome / Browser):</span>
              </div>
              <ol className="text-[11px] text-slate-600 font-medium space-y-1.5 pl-4 list-decimal">
                <li>
                  Tekan tombol <strong className="text-slate-900">&ldquo;Install Aplikasi Sekarang&rdquo;</strong> di bawah.
                </li>
                <li>
                  Atau ketuk ikon menu <MoreVertical className="w-3 h-3 inline text-slate-800" /> di pojok kanan atas browser lalu pilih <strong className="text-slate-900">&ldquo;Instal Aplikasi&rdquo; / &ldquo;Tambahkan ke Layar Utama&rdquo;</strong>.
                </li>
              </ol>
            </>
          )}

          {activeTab === 'ios' && (
            <>
              <div className="text-[11px] font-extrabold text-slate-800 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                <span>Cara Install di iPhone / iPad (Safari):</span>
              </div>
              <ol className="text-[11px] text-slate-600 font-medium space-y-1.5 pl-4 list-decimal">
                <li>
                  Ketuk tombol <strong className="text-slate-900">Share / Bagikan</strong>{' '}
                  <Share className="w-3.5 h-3.5 inline text-blue-600" /> di bar bawah Safari.
                </li>
                <li>
                  Gulir ke bawah dan pilih{' '}
                  <strong className="text-slate-900">&ldquo;Tambah ke Layar Utama&rdquo; (Add to Home Screen)</strong>{' '}
                  <PlusSquare className="w-3.5 h-3.5 inline text-slate-800" />.
                </li>
                <li>
                  Ketuk <strong className="text-slate-900">&ldquo;Tambah&rdquo; (Add)</strong> di pojok kanan atas.
                </li>
              </ol>
            </>
          )}

          {activeTab === 'windows' && (
            <>
              <div className="text-[11px] font-extrabold text-slate-800 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-indigo-600" />
                <span>Cara Install di Windows (Chrome / Edge):</span>
              </div>
              <ol className="text-[11px] text-slate-600 font-medium space-y-1.5 pl-4 list-decimal">
                <li>
                  Klik tombol <strong className="text-slate-900">&ldquo;Install Aplikasi Sekarang&rdquo;</strong> di bawah.
                </li>
                <li>
                  Atau klik ikon <strong className="text-slate-900">Install (⊕ / komputer dengan panah)</strong> di sisi kanan kolom URL browser atas, lalu klik <strong className="text-slate-900">Install</strong>.
                </li>
              </ol>
            </>
          )}

          {activeTab === 'macos' && (
            <>
              <div className="text-[11px] font-extrabold text-slate-800 flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-teal-600" />
                <span>Cara Install di macOS (Safari / Chrome):</span>
              </div>
              <ol className="text-[11px] text-slate-600 font-medium space-y-1.5 pl-4 list-decimal">
                <li>
                  <strong>Chrome / Edge:</strong> Klik tombol <strong className="text-slate-900">&ldquo;Install Aplikasi Sekarang&rdquo;</strong> atau ikon Install di kolom URL.
                </li>
                <li>
                  <strong>Safari macOS:</strong> Klik menu <strong className="text-slate-900">File → Add to Dock... (Tambahkan ke Dock)</strong> atau tombol Share <Share className="w-3 h-3 inline text-blue-600" /> → <strong className="text-slate-900">Add to Dock</strong>.
                </li>
              </ol>
            </>
          )}

          {showGuideSteps && !deferredPrompt && (
            <div className="pt-1 text-[10px] font-bold text-teal-700 bg-teal-50/90 border border-teal-200 px-2.5 py-1.5 rounded-xl">
              💡 Ikuti langkah di atas pada menu browser Anda untuk menambahkan ikon FMCU TEAMS ke layar utama / desktop.
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-0.5">
          <button
            type="button"
            onClick={handleNativeInstallClick}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#32C2AD] to-[#20A894] hover:brightness-105 text-white font-black text-xs shadow-pill-teal transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>
              {deferredPrompt
                ? `Install Aplikasi Sekarang (${platformLabels[detectedPlatform]})`
                : `Pasang Web App di ${platformLabels[activeTab]}`}
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAlreadyInstalled}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sudah Install</span>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] transition cursor-pointer"
            >
              Nanti Saja
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
