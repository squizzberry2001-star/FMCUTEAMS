import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Compass, MapPin, RefreshCw, ArrowRight } from 'lucide-react';
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
 * Periksa apakah izin lokasi browser sudah diberikan ('granted')
 * atau sudah pernah terverifikasi di sesi aktif.
 */
function isInitiallyConnected(): boolean {
  if (typeof window === 'undefined') return true;

  // Pada iPad, Tablet, atau Desktop: jangan pernah blokir di awal
  if (isDesktopOrTabletDevice()) {
    return true;
  }

  // Jika sudah terverifikasi di sessionStorage atau ada koordinat GPS tersimpan di localStorage
  try {
    if (sessionStorage.getItem('fmcu_gps_verified') === 'true') {
      return true;
    }
    if (localStorage.getItem('fmcu_live_gps')) {
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
  const watchIdRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);

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
      }
      initSilentBackgroundPositioning();
    }
  }, []);

  const handlePositionError = useCallback((err?: GeolocationPositionError) => {
    if (!isMountedRef.current) return;
    setIsRequesting(false);

    // ATURAN KRUSIAL:
    // Jangan pernah mencabut isGpsConnected jika user sudah terhubung atau di perangkat Desktop/iPad/Tablet!
    // Kesalahan timeout (code 3) atau sinyal hilang sesaat (code 2) di dalam ruangan / saat ganti tab
    // TIDAK BOLEH menendang user ke layar pemblokir "Aktifkan GPS".
    if (err && err.code === 1) {
      // Hanya jika izin secara eksplisit ditolak (code 1 = PERMISSION_DENIED)
      // dan BUKAN perangkat desktop/tablet
      if (!isDesktopOrTabletDevice()) {
        try {
          sessionStorage.removeItem('fmcu_gps_verified');
        } catch {
          // ignore
        }
        setIsGpsConnected(false);
      }
    }
  }, []);

  const requestGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      // Jika browser tidak mendukung Geolocation, jangan blokir
      setIsGpsConnected(true);
      return;
    }

    setIsRequesting(true);

    // Coba dengan High Accuracy terlebih dahulu (ideal untuk ponsel lapangan dengan GPS satelit)
    try {
      navigator.geolocation.getCurrentPosition(
        handlePositionSuccess,
        (err) => {
          // Jika High Accuracy gagal / timeout (sangat umum di iPad Wi-Fi, Desktop, atau di dalam ruangan),
          // fallback otomatis ke Low Accuracy (Wi-Fi / IP trilaterasi) tanpa memblokir layar!
          if (err.code !== 1) {
            try {
              navigator.geolocation.getCurrentPosition(
                handlePositionSuccess,
                handlePositionError,
                {
                  enableHighAccuracy: false,
                  timeout: 10000,
                  maximumAge: 300000, // toleransi cache 5 menit
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
          timeout: 5000,
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
            sessionStorage.setItem('fmcu_gps_verified', 'true');
          }
          status.onchange = () => {
            if (status.state === 'granted') {
              setIsGpsConnected(true);
              sessionStorage.setItem('fmcu_gps_verified', 'true');
            } else if (status.state === 'denied' && !isDesktopOrTabletDevice()) {
              setIsGpsConnected(false);
              sessionStorage.removeItem('fmcu_gps_verified');
            }
          };
        })
        .catch(() => {
          // ignore
        });
    }

    // 2. Trigger sinkronisasi GPS di latar belakang
    requestGps();

    // 3. Pasang continuous watchPosition
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        watchIdRef.current = navigator.geolocation.watchPosition(
          handlePositionSuccess,
          (err) => {
            // Pada watchPosition, jika gagal jangan pernah mencabut isGpsConnected jika sudah terhubung
            if (err && err.code === 1 && !isDesktopOrTabletDevice()) {
              setIsGpsConnected(false);
            }
          },
          {
            enableHighAccuracy: !isDesktopOrTabletDevice(),
            maximumAge: 15000,
            timeout: 12000,
          }
        );
      } catch {
        // ignore
      }
    }

    // 4. Re-check saat window aktif / kembali dari tab lain (hanya perbarui koordinat, jangan blokir)
    const handleRecheck = () => {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          handlePositionSuccess,
          () => {},
          {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 120000,
          }
        );
      }
    };

    window.addEventListener('focus', handleRecheck);
    document.addEventListener('visibilitychange', handleRecheck);

    return () => {
      isMountedRef.current = false;
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      window.removeEventListener('focus', handleRecheck);
      document.removeEventListener('visibilitychange', handleRecheck);
    };
  }, [requestGps, handlePositionSuccess, handlePositionError]);

  // Jika GPS terhubung atau perangkat adalah Desktop/iPad/Tablet, tampilkan aplikasi langsung
  if (isGpsConnected || isDesktopOrTabletDevice()) {
    return <>{children}</>;
  }

  // Khusus ponsel lapangan (smartphone) jika izin lokasi belum diberikan sama sekali
  return (
    <div className="fixed inset-0 z-[999999] bg-[#F8F9FD] flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-300">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        {/* Pulsing Radar Effect */}
        <div className="relative flex items-center justify-center mb-8">
          <div className="absolute w-28 h-28 rounded-full bg-emerald-500/10 animate-ping duration-1000" />
          <div className="absolute w-20 h-20 rounded-full bg-teal-500/20 animate-pulse" />
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-xl flex items-center justify-center text-white">
            <MapPin className="w-8 h-8 stroke-[2.2]" />
          </div>
        </div>

        {/* Minimal Clean Status */}
        <div className="space-y-1.5 mb-8">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Menghubungkan GPS...
          </h2>
          <p className="text-xs font-semibold text-slate-500">
            Pastikan Layanan Lokasi (GPS) Diizinkan di Browser
          </p>
        </div>

        {/* Tombol Aksi Utama: Minta Izin Lokasi Browser */}
        <button
          type="button"
          onClick={requestGps}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 transition cursor-pointer"
        >
          {isRequesting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Memverifikasi Lokasi...</span>
            </>
          ) : (
            <>
              <Compass className="w-4 h-4" />
              <span>Aktifkan Lokasi / GPS</span>
            </>
          )}
        </button>

        {/* Tombol Cadangan: Lanjutkan Jika di Kantor / Tablet */}
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem('fmcu_gps_verified', 'true');
            setIsGpsConnected(true);
          }}
          className="mt-3.5 w-full py-2.5 px-4 rounded-xl text-slate-500 hover:text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer hover:bg-slate-100/70"
        >
          <span>Lanjutkan ke Aplikasi</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
