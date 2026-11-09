import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Compass, MapPin, RefreshCw, AlertCircle, Smartphone, ShieldCheck, ChevronRight } from 'lucide-react';
import { initSilentBackgroundPositioning } from '../../services/actualAttendanceService';

interface GpsEnforcerGuardProps {
  children: React.ReactNode;
}

/**
 * Deteksi apakah perangkat adalah iPad, Tablet, atau Desktop.
 * Perangkat-perangkat ini sering tidak memiliki modul satelit GPS fisik (hanya Wi-Fi trilaterasi / IP)
 * dan digunakan untuk dashboard admin / eksekutif / browsing jadwal di kantor.
 */
export function isDesktopOrTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Layar Desktop (lebar >= 1024px)
  if (window.innerWidth >= 1024) return true;

  // 2. Layar Tablet (lebar >= 600px)
  if (window.innerWidth >= 600) return true;

  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';

  // 3. iPad detection (iPadOS 13+ Safari melaporkan platform 'MacIntel' dengan maxTouchPoints > 1)
  const isIPad =
    ua.includes('iPad') ||
    (platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  if (isIPad) return true;

  // 4. Android Tablet (mengandung 'Android' tapi TIDAK mengandung 'Mobile')
  const isAndroidTablet = ua.includes('Android') && !ua.includes('Mobile');
  if (isAndroidTablet) return true;

  // 5. Desktop OS (Windows, Macintosh, Linux non-Android)
  if (/Windows|Macintosh|Linux/i.test(ua) && !/Android|iPhone|iPod|Mobile/i.test(ua)) {
    return true;
  }

  return false;
}

/**
 * Deteksi platform OS untuk instruksi perizinan GPS spesifik
 */
function getMobilePlatform(): 'ios' | 'android' | 'other' {
  if (typeof window === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

/**
 * Periksa apakah izin lokasi browser sudah diberikan ('granted')
 * atau sudah pernah terverifikasi di sesi aktif.
 */
function isInitiallyConnected(): boolean {
  if (typeof window === 'undefined') return true;

  // Pada iPad, Tablet, atau Desktop: jangan pernah blokir di awal
  if (isDesktopOrTabletDevice()) {
    return true;
  }

  // Pada ponsel smartphone, periksa apakah koordinat GPS tersimpan dan masih segar (< 15 menit)
  try {
    const liveGps = localStorage.getItem('fmcu_live_gps');
    const liveTimestamp = Number(localStorage.getItem('fmcu_live_gps_timestamp') || '0');
    if (liveGps && liveTimestamp && Date.now() - liveTimestamp < 900000) {
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}

export const GpsEnforcerGuard: React.FC<GpsEnforcerGuardProps> = ({ children }) => {
  const [isGpsConnected, setIsGpsConnected] = useState<boolean>(() => isInitiallyConnected());
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    setPlatform(getMobilePlatform());
  }, []);

  const handlePositionSuccess = useCallback((pos: GeolocationPosition) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      try {
        localStorage.setItem('fmcu_live_gps', `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        localStorage.setItem('fmcu_live_gps_timestamp', String(Date.now()));
        sessionStorage.setItem('fmcu_gps_verified', 'true');
      } catch {
        // ignore
      }

      if (isMountedRef.current) {
        setIsGpsConnected(true);
        setIsRequesting(false);
        setPermissionDenied(false);
      }
      initSilentBackgroundPositioning();
    }
  }, []);

  const handlePositionError = useCallback((err?: GeolocationPositionError) => {
    if (!isMountedRef.current) return;
    setIsRequesting(false);

    if (err && err.code === 1) {
      // PERMISSION_DENIED (Kode 1): User menolak atau browser memblokir lokasi
      if (!isDesktopOrTabletDevice()) {
        try {
          sessionStorage.removeItem('fmcu_gps_verified');
        } catch {
          // ignore
        }
        setIsGpsConnected(false);
        setPermissionDenied(true);
      }
    }
  }, []);

  const requestGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setIsGpsConnected(true);
      return;
    }

    setIsRequesting(true);
    setPermissionDenied(false);

    try {
      navigator.geolocation.getCurrentPosition(
        handlePositionSuccess,
        (err) => {
          // Fallback coba Low Accuracy jika High Accuracy timeout
          if (err.code !== 1) {
            try {
              navigator.geolocation.getCurrentPosition(
                handlePositionSuccess,
                handlePositionError,
                {
                  enableHighAccuracy: false,
                  timeout: 10000,
                  maximumAge: 120000,
                }
              );
            } catch {
              handlePositionError(err);
            }
          } else {
            handlePositionError(err);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 60000,
        }
      );
    } catch {
      setIsRequesting(false);
    }
  }, [handlePositionSuccess, handlePositionError]);

  useEffect(() => {
    isMountedRef.current = true;

    // 1. Cek Permissions API jika didukung browser
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          if (status.state === 'granted') {
            setIsGpsConnected(true);
            setPermissionDenied(false);
            sessionStorage.setItem('fmcu_gps_verified', 'true');
            initSilentBackgroundPositioning();
          } else if (status.state === 'denied' && !isDesktopOrTabletDevice()) {
            setIsGpsConnected(false);
            setPermissionDenied(true);
            sessionStorage.removeItem('fmcu_gps_verified');
          }
          status.onchange = () => {
            if (status.state === 'granted') {
              setIsGpsConnected(true);
              setPermissionDenied(false);
              sessionStorage.setItem('fmcu_gps_verified', 'true');
              initSilentBackgroundPositioning();
            } else if (status.state === 'denied' && !isDesktopOrTabletDevice()) {
              setIsGpsConnected(false);
              setPermissionDenied(true);
              sessionStorage.removeItem('fmcu_gps_verified');
            }
          };
        })
        .catch(() => {
          // ignore
        });
    }

    // 2. Minta izin GPS otomatis saat pertama kali dibuka
    requestGps();

    // 3. Re-check saat window aktif kembali (pindah tab atau buka lock screen)
    const handleRecheck = () => {
      if (document.hidden) return; // Battery Saver: Jangan trigger jika layar mati
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          handlePositionSuccess,
          () => {},
          {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 60000,
          }
        );
      }
    };

    window.addEventListener('focus', handleRecheck);
    document.addEventListener('visibilitychange', handleRecheck);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('focus', handleRecheck);
      document.removeEventListener('visibilitychange', handleRecheck);
    };
  }, [requestGps, handlePositionSuccess, handlePositionError]);

  // Jika GPS terhubung atau perangkat adalah Desktop/iPad/Tablet, tampilkan aplikasi langsung
  if (isGpsConnected || isDesktopOrTabletDevice()) {
    return <>{children}</>;
  }

  // ============================================================================
  // LAYAR PEMBLOKIR: LOKASI GPS WAJIB (TIDAK BISA DI-SKIP)
  // ============================================================================
  return (
    <div className="fixed inset-0 z-[999999] bg-[#F8F9FD] flex flex-col items-center justify-center p-5 select-none animate-in fade-in duration-300 overflow-y-auto">
      <div className="w-full max-w-sm flex flex-col items-center text-center my-auto py-6">
        {/* Radar Icon dengan Efek Glow */}
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute w-28 h-28 rounded-full bg-emerald-500/15 animate-ping duration-1000" />
          <div className="absolute w-20 h-20 rounded-full bg-teal-500/25 animate-pulse" />
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-xl flex items-center justify-center text-white ring-4 ring-emerald-500/20">
            <MapPin className="w-8 h-8 stroke-[2.3]" />
          </div>
        </div>

        {/* Judul & Alasan Wajib */}
        <div className="space-y-2 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-black uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Izin Akses Lokasi Wajib</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight leading-snug">
            Aktifkan GPS Perangkat
          </h2>
          <p className="text-xs text-slate-600 font-medium leading-relaxed px-2">
            Sistem operasional FMCU Teams mewajibkan koordinat GPS aktif untuk validasi kehadiran di toko secara otomatis (radius 1–50m).
          </p>
        </div>

        {/* Petunjuk Spesifik Jika Izin Ditolak / Diblokir Browser */}
        {permissionDenied && (
          <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-left mb-6 space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2 text-amber-900 font-black text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Akses Lokasi Diblokir di Browser</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              {platform === 'ios' ? (
                <>
                  <strong>Cara aktifkan di iPhone (Safari):</strong>
                  <br />
                  1. Buka <strong>Pengaturan iPhone</strong> &gt; <strong>Privasi & Keamanan</strong> &gt; <strong>Layanan Lokasi</strong> (Pastikan Aktif).
                  <br />
                  2. Gulir ke bawah, pilih <strong>Situs Web Safari</strong> &gt; Pilih <strong>Saat Menggunakan App</strong>.
                  <br />
                  3. Kembali ke browser dan ketuk tombol di bawah.
                </>
              ) : (
                <>
                  <strong>Cara aktifkan di Android (Google Chrome):</strong>
                  <br />
                  1. Ketuk ikon <strong>Gembok 🔒 / Setelan ⚙️</strong> di samping tautan web (bar atas).
                  <br />
                  2. Pilih <strong>Izin (Permissions)</strong> &gt; <strong>Lokasi</strong> &gt; Pilih <strong>Izinkan</strong>.
                  <br />
                  3. Muat ulang halaman atau ketuk tombol di bawah.
                </>
              )}
            </p>
          </div>
        )}

        {/* Tombol Aksi Utama (Satu-satunya Jalan Masuk: Harus Mengizinkan Lokasi) */}
        <button
          type="button"
          onClick={requestGps}
          disabled={isRequesting}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 transition cursor-pointer"
        >
          {isRequesting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Memverifikasi Sinyal GPS...</span>
            </>
          ) : (
            <>
              <Compass className="w-4 h-4" />
              <span>{permissionDenied ? 'Coba Lagi / Aktifkan Lokasi' : 'Izinkan & Aktifkan GPS'}</span>
            </>
          )}
        </button>

        {/* Catatan Transparansi Keamanan */}
        <p className="text-[10px] text-slate-400 font-bold mt-4 leading-normal">
          🔒 Koordinat Anda hanya diproses secara privat saat aplikasi aktif untuk keperluan verifikasi jadwal visit resmi FamilyMart.
        </p>
      </div>
    </div>
  );
};
