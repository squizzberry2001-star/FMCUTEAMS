import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Compass, MapPin, RefreshCw } from 'lucide-react';
import { initSilentBackgroundPositioning } from '../../services/actualAttendanceService';

interface GpsEnforcerGuardProps {
  children: React.ReactNode;
}

export const GpsEnforcerGuard: React.FC<GpsEnforcerGuardProps> = ({ children }) => {
  const [isGpsConnected, setIsGpsConnected] = useState<boolean>(false);
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const watchIdRef = useRef<number | null>(null);
  const retryTimerRef = useRef<any>(null);

  const handlePositionSuccess = useCallback((pos: GeolocationPosition) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      try {
        localStorage.setItem('fmcu_live_gps', `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      } catch {
        // ignore
      }
      setIsGpsConnected(true);
      setIsRequesting(false);
      initSilentBackgroundPositioning();
    }
  }, []);

  const handlePositionError = useCallback(() => {
    setIsGpsConnected(false);
    setIsRequesting(false);
  }, []);

  const requestGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return;
    }
    setIsRequesting(true);
    try {
      navigator.geolocation.getCurrentPosition(
        handlePositionSuccess,
        handlePositionError,
        {
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 0,
        }
      );
    } catch {
      setIsRequesting(false);
    }
  }, [handlePositionSuccess, handlePositionError]);

  useEffect(() => {
    // 1. Initial immediate trigger
    requestGps();

    // 2. Continuous watch position
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        watchIdRef.current = navigator.geolocation.watchPosition(
          handlePositionSuccess,
          handlePositionError,
          {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 10000,
          }
        );
      } catch {
        // ignore
      }
    }

    // 3. Repeated background permission & connection check if not yet connected
    retryTimerRef.current = setInterval(() => {
      setIsGpsConnected((currentConnected) => {
        if (!currentConnected) {
          requestGps();
        }
        return currentConnected;
      });
    }, 2500);

    // Re-check when window gains focus or device visibility changes
    const handleRecheck = () => {
      requestGps();
    };
    window.addEventListener('focus', handleRecheck);
    document.addEventListener('visibilitychange', handleRecheck);

    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
      }
      window.removeEventListener('focus', handleRecheck);
      document.removeEventListener('visibilitychange', handleRecheck);
    };
  }, [requestGps, handlePositionSuccess, handlePositionError]);

  // If GPS is actively connected, render the main application
  if (isGpsConnected) {
    return <>{children}</>;
  }

  // Minimalist, Clean Apple/Executive style GPS Enforcer (No lengthy narrative)
  return (
    <div className="fixed inset-0 z-[999999] bg-[#F8F9FD] flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-300">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        {/* Pulsing Radar Radar Effect */}
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
            Pastikan Layanan Lokasi (GPS) Aktif
          </p>
        </div>

        {/* Direct Action Button to trigger native browser prompt if needed */}
        <button
          type="button"
          onClick={requestGps}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 transition cursor-pointer"
        >
          {isRequesting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Memverifikasi GPS...</span>
            </>
          ) : (
            <>
              <Compass className="w-4 h-4" />
              <span>Aktifkan GPS</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
