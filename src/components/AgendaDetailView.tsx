import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  ChevronLeft,
  Calendar,
  Clock,
  MapPin,
  User as UserIcon,
  Share2,
  Camera,
  Store,
  Building2,
  ClipboardCheck,
  Users,
  GraduationCap,
  ArrowRight,
  Mountain,
  FileText,
  Tag,
  CheckCircle2,
  LogIn,
  LogOut,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { ScheduleAgenda, ScheduleCategory, User } from '../types';
import {
  loadLeaflet,
  resolveAgendaGeoPoints,
  resolvePrimaryAgendaGeoPoint,
} from '../utils/mapGeoUtils';
import {
  getDailyStoreSequenceInfo,
  performSilentActualCheckIn,
  performSilentActualCheckOut,
} from '../services/actualAttendanceService';

interface AgendaDetailViewProps {
  agenda: ScheduleAgenda;
  allAgendas?: ScheduleAgenda[];
  onUpdateAgenda?: (updated: ScheduleAgenda) => void;
  currentUser?: User | null;
  onBack: () => void;
  onOpenVisitForm?: () => void;
}

function getMinimalistPinLabel(rawName: string): string {
  const cleaned = (rawName || '')
    .replace(/^(?:familymart|family mart|fm|fmi|toko|cabang)\s+/i, '')
    .trim();
  if (cleaned.length <= 11) return cleaned;
  return `${cleaned.slice(0, 10).trim()}…`;
}

export const AgendaDetailView: React.FC<AgendaDetailViewProps> = ({
  agenda,
  allAgendas = [],
  onUpdateAgenda,
  currentUser,
  onBack,
  onOpenVisitForm,
}) => {
  // Hanya tampilkan Maps jika agenda adalah VISIT
  const isVisitAgenda = agenda.category === 'VISIT';
  const [isRecordingAttendance, setIsRecordingAttendance] = useState(false);

  // Urutan kunjungan toko hari ini (mendukung 1 hari visit 2 toko atau lebih)
  const { storeOrderIndex, totalStoresToday } = useMemo(
    () => getDailyStoreSequenceInfo(agenda, allAgendas.length > 0 ? allAgendas : [agenda]),
    [agenda, allAgendas]
  );

  const handleRecordActualIn = async () => {
    if (isRecordingAttendance) return;
    setIsRecordingAttendance(true);
    try {
      const { updatedTarget, autoClosedPrevStore } = await performSilentActualCheckIn(
        agenda,
        allAgendas.length > 0 ? allAgendas : [agenda]
      );
      if (autoClosedPrevStore && onUpdateAgenda) {
        onUpdateAgenda(autoClosedPrevStore);
      }
      if (onUpdateAgenda) {
        onUpdateAgenda(updatedTarget);
      }
    } finally {
      setIsRecordingAttendance(false);
    }
  };

  const handleRecordActualOut = async () => {
    if (isRecordingAttendance) return;
    setIsRecordingAttendance(true);
    try {
      const updatedTarget = await performSilentActualCheckOut(
        agenda,
        allAgendas.length > 0 ? allAgendas : [agenda]
      );
      if (onUpdateAgenda) {
        onUpdateAgenda(updatedTarget);
      }
    } finally {
      setIsRecordingAttendance(false);
    }
  };

  const handleOpenVisitFormWithAutoIn = async () => {
    // Pastikan Actual IN terekam otomatis jika user langsung membuka Form Visit agar tidak pernah miss
    if (!agenda.actualIn) {
      await handleRecordActualIn();
    }
    if (onOpenVisitForm) {
      onOpenVisitForm();
    }
  };

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [isMapFullScreen, setIsMapFullScreen] = useState(false);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.invalidateSize();
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [isMapFullScreen]);

  // Resolve store geo point(s) (Lat, Lng, Altitude) from Master Data Store
  const matchedGeoPoints = useMemo(() => resolveAgendaGeoPoints(agenda), [agenda]);
  const primaryGeoPoint = useMemo(() => resolvePrimaryAgendaGeoPoint(agenda), [agenda]);
  const activePoints = matchedGeoPoints.length > 0 ? matchedGeoPoints : [primaryGeoPoint];

  useEffect(() => {
    if (!isVisitAgenda) return;
    let mounted = true;
    loadLeaflet().then((L) => {
      if (mounted && L) setLeafletReady(true);
    });
    return () => {
      mounted = false;
    };
  }, [isVisitAgenda]);

  useEffect(() => {
    if (!isVisitAgenda || !leafletReady || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [primaryGeoPoint.lat, primaryGeoPoint.lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // 100% Free OpenStreetMap Tile Server (No API Key Required) with Esri fallback
    const tl = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    tl.on('tileerror', () => {
      tl.setUrl(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
      );
    });

    const boundsCoords: [number, number][] = [];

    // Draw route line if agenda contains multiple stores
    if (activePoints.length >= 2) {
      const latlngs: [number, number][] = activePoints.map((p) => [p.lat, p.lng]);
      L.polyline(latlngs, {
        color: '#0D9488',
        weight: 3.5,
        dashArray: '6, 5',
      }).addTo(map);
    }

    // Add radius circle if Admin
    if (currentUser?.isAdmin) {
      activePoints.forEach((pt) => {
        L.circle([pt.lat, pt.lng], {
          radius: 200,
          color: '#0D9488',
          weight: 1.5,
          fillColor: '#14B8A6',
          fillOpacity: 0.15,
        }).addTo(map);
      });
    }

    // Add Minimalist Store Pinpoints (No long oval!)
    activePoints.forEach((pt, idx) => {
      boundsCoords.push([pt.lat, pt.lng]);
      const shortLabel = getMinimalistPinLabel(pt.name);

      const pinIcon = L.divIcon({
        className: 'fmcu-detail-minimal-pin',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-90%);">
            <div style="width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#0D9488,#059669);color:#fff;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(13,148,136,0.5);">
              ${activePoints.length > 1 ? idx + 1 : '•'}
            </div>
            <div style="margin-top:1px;background:rgba(15,23,42,0.9);color:#fff;font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.15;">
              ${shortLabel}
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      L.marker([pt.lat, pt.lng], { icon: pinIcon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:system-ui,sans-serif;font-size:11px;">
            <strong>Toko ${pt.name}</strong> ${pt.code !== 'FMCU' ? `(#${pt.code})` : ''}<br/>
            <span style="color:#64748B;font-size:10px;">${pt.address}</span><br/>
            <span style="color:#0D9488;font-weight:800;font-size:10px;">Lat: ${pt.lat.toFixed(5)}° • Lng: ${pt.lng.toFixed(5)}° • Alt: ${pt.altitude} mdpl</span>
          </div>`
        );
    });

    if (boundsCoords.length > 1) {
      map.fitBounds(L.latLngBounds(boundsCoords), { padding: [30, 30], maxZoom: 15 });
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 120);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isVisitAgenda, leafletReady, primaryGeoPoint, activePoints, currentUser?.isAdmin]);

  const renderCategoryIcon = (category: ScheduleCategory) => {
    switch (category) {
      case 'VISIT':
        return (
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#32C2AD] to-[#20A894] flex items-center justify-center text-white shadow-xs shrink-0">
            <Store className="w-5 h-5 stroke-[2.2]" />
          </div>
        );
      case 'NSO':
        return (
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FF7E98] to-[#FF5376] flex items-center justify-center text-white shadow-xs shrink-0">
            <Building2 className="w-5 h-5 stroke-[2.2]" />
          </div>
        );
      case 'AUDIT':
        return (
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FBBF24] to-[#F59E0B] flex items-center justify-center text-white shadow-xs shrink-0">
            <ClipboardCheck className="w-5 h-5 stroke-[2.2]" />
          </div>
        );
      case 'MEETING':
        return (
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#60A5FA] to-[#3B82F6] flex items-center justify-center text-white shadow-xs shrink-0">
            <Users className="w-5 h-5 stroke-[2.2]" />
          </div>
        );
      case 'TRAINING':
      default:
        return (
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#A855F7] to-[#8B5CF6] flex items-center justify-center text-white shadow-xs shrink-0">
            <GraduationCap className="w-5 h-5 stroke-[2.2]" />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col justify-between h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#F8F9FD] px-4 sm:px-5 pt-[max(0.75rem,env(safe-area-inset-top,14px))] pb-[max(0.75rem,env(safe-area-inset-bottom,14px))] max-w-xl mx-auto w-full select-none gap-2.5">
      {/* 1. Compact Top Header */}
      <div className="flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-full iphone-glass-icon-btn flex items-center justify-center text-black active:scale-95 transition-transform cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.4]" />
        </button>

        <div className="text-center">
          <span className="text-[9px] font-bold text-teal-600 uppercase tracking-wider block leading-none">
            FMCU Schedule Detail
          </span>
          <h2 className="text-base font-black text-slate-800 leading-tight mt-0.5">
            Detail Agenda
          </h2>
        </div>

        <button
          type="button"
          onClick={() => {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(
                `${agenda.title} - ${agenda.date} ${agenda.time} WIB di ${agenda.location}`
              );
              alert('Informasi agenda disalin ke clipboard!');
            }
          }}
          className="w-9 h-9 rounded-full iphone-glass-icon-btn flex items-center justify-center text-black active:scale-95 transition-transform cursor-pointer"
          title="Salin Info Agenda"
        >
          <Share2 className="w-4 h-4 stroke-[2.2]" />
        </button>
      </div>

      {/* 2. Unified Compact Info Card */}
      <div className="bg-white rounded-3xl p-3.5 shadow-soft-card border border-slate-100 space-y-2.5 shrink-0">
        {/* Title & Category Row */}
        <div className="flex items-center gap-3">
          {renderCategoryIcon(agenda.category)}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className="text-[9px] font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                {agenda.category}
              </span>
              {isVisitAgenda && primaryGeoPoint.code !== 'FMCU' && (
                <span className="text-[9px] font-extrabold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  Toko #{primaryGeoPoint.code}
                </span>
              )}
              {agenda.priority === 'HIGH' && (
                <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  Prioritas Tinggi
                </span>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 leading-snug line-clamp-2">
              {agenda.title}
            </h3>
          </div>
        </div>

        {/* 2x2 Operational Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-50 rounded-2xl p-2 border border-slate-100 flex items-center gap-2 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-slate-400 uppercase block leading-none">
                Tanggal
              </span>
              <p className="text-[11px] font-extrabold text-slate-800 truncate mt-0.5">
                {agenda.date}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-2 border border-slate-100 flex items-center gap-2 min-w-0">
            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-slate-400 uppercase block leading-none">
                Waktu
              </span>
              <p className="text-[11px] font-extrabold text-slate-800 truncate mt-0.5">
                {agenda.time}
                {agenda.endTime ? ` - ${agenda.endTime}` : ''} WIB
              </p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-2 border border-slate-100 flex items-center gap-2 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-slate-400 uppercase block leading-none">
                Lokasi
              </span>
              <p className="text-[11px] font-extrabold text-slate-800 truncate mt-0.5">
                {agenda.location}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-2 border border-slate-100 flex items-center gap-2 min-w-0">
            <UserIcon className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-slate-400 uppercase block leading-none">
                Nama / PIC
              </span>
              <p className="text-[11px] font-extrabold text-slate-800 truncate mt-0.5">
                {agenda.pic}
              </p>
            </div>
          </div>
        </div>

        {/* Short Note for Visit */}
        {isVisitAgenda && agenda.description && (
          <div className="bg-slate-50/80 px-2.5 py-1.5 rounded-xl border border-slate-100 flex items-center justify-between gap-2">
            <p className="text-[10px] text-slate-600 font-medium line-clamp-1 flex-1">
              {agenda.description.replace(/\n+/g, ' • ')}
            </p>
            {primaryGeoPoint.storeHead && primaryGeoPoint.storeHead !== '-' && (
              <span className="text-[9px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md shrink-0">
                SH: {primaryGeoPoint.storeHead}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. Middle Section:
          - JIKA VISIT: Tampilkan Peta Interaktif Pinpoint Toko (Dengan Fitur Mode Fullscreen)
          - JIKA BUKAN VISIT: Tidak menampilkan Maps (Tampilkan Detail Catatan & Tag Agenda) */}
      {isVisitAgenda ? (
        <div
          className={
            isMapFullScreen
              ? 'fixed inset-0 z-[9999] bg-white p-3 sm:p-4 flex flex-col overflow-hidden animate-fadeIn'
              : 'flex-1 min-h-[155px] bg-white rounded-3xl p-2.5 shadow-soft-card border border-slate-100 flex flex-col overflow-hidden'
          }
        >
          <div className="flex items-center justify-between px-1 mb-1.5 shrink-0 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-[10px] sm:text-xs font-black text-slate-800 uppercase tracking-wider truncate">
                Pinpoint Toko: {primaryGeoPoint.name}
              </span>
              <span className="text-[9px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100 shrink-0">
                {primaryGeoPoint.city}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsMapFullScreen((v) => !v)}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold flex items-center gap-1 transition active:scale-95 shrink-0 cursor-pointer ${
                isMapFullScreen
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
              }`}
              title={isMapFullScreen ? 'Keluar dari Mode Fullscreen' : 'Buka Peta Layar Penuh'}
            >
              {isMapFullScreen ? (
                <>
                  <Minimize2 className="w-3 h-3 text-teal-400" />
                  <span>Keluar Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3 h-3 text-teal-600" />
                  <span>Fullscreen</span>
                </>
              )}
            </button>
          </div>

          {/* Interactive Leaflet Container (Zero API Key) */}
          <div className="relative flex-1 w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/70">
            <div ref={mapContainerRef} className="w-full h-full z-10" />

            {/* Coordinate & Altitude Overlay Pill at Map Bottom */}
            <div className="absolute bottom-2 left-2 right-2 z-20 bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-2 text-[9px] font-bold text-slate-600 tabular-nums">
              <div className="flex items-center gap-2 truncate">
                <span>
                  Lat: <strong className="text-slate-900">{primaryGeoPoint.lat.toFixed(5)}°</strong>
                </span>
                <span>•</span>
                <span>
                  Lng: <strong className="text-slate-900">{primaryGeoPoint.lng.toFixed(5)}°</strong>
                </span>
              </div>
              <span className="text-teal-700 font-extrabold flex items-center gap-0.5 shrink-0">
                <Mountain className="w-3 h-3" />
                Alt: {primaryGeoPoint.altitude} mdpl
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-[120px] bg-white rounded-3xl p-4 shadow-soft-card border border-slate-100 flex flex-col justify-between overflow-hidden">
          <div className="space-y-2 overflow-y-auto no-scrollbar">
            <div className="flex items-center gap-1.5 text-slate-700">
              <FileText className="w-3.5 h-3.5 text-teal-600" />
              <span className="text-[10px] font-black uppercase tracking-wider">
                Rincian &amp; Catatan Kegiatan
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-line">
              {agenda.description ||
                `Kegiatan ${agenda.title} dijadwalkan pada ${agenda.date} pukul ${agenda.time} WIB bertempat di ${agenda.location}.`}
            </p>
          </div>

          {agenda.tags && agenda.tags.length > 0 && (
            <div className="pt-2.5 border-t border-slate-100 flex items-center gap-1.5 flex-wrap shrink-0">
              <Tag className="w-3 h-3 text-slate-400 shrink-0" />
              {agenda.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Bottom Primary Action Bar:
          - Panel Presensi Actual IN & Actual OUT (Tanpa teks GPS di sisi user — berjalan senyap di balik sistem)
          - Tombol Buka Form Visit Report HANYA untuk Jadwal VISIT */}
      {isVisitAgenda && (
        <div className="shrink-0 space-y-2">
          {/* Compact Actual IN / OUT Bar */}
          <div className="bg-white rounded-2xl p-2.5 shadow-soft-card border border-slate-100">
            <div className="flex items-center justify-between px-0.5 mb-1.5">
              <span className="text-[10px] font-extrabold text-slate-700">
                {totalStoresToday > 1
                  ? `Presensi Toko Ke-${storeOrderIndex} dari ${totalStoresToday} Hari Ini`
                  : 'Presensi Jam Kerja (08:30 – 17:30)'}
              </span>
              <span className="text-[9px] font-semibold text-teal-700">
                {agenda.silentAudit?.syncStatus === 'OFFLINE_QUEUED'
                  ? 'Tersimpan Lokal (Auto-Sync)'
                  : agenda.actualIn && agenda.actualOut
                  ? 'Selesai (IN & OUT)'
                  : agenda.actualIn
                  ? 'Sedang Visit di Toko'
                  : 'Belum Check-In'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Actual IN Button / Status */}
              <button
                type="button"
                disabled={isRecordingAttendance}
                onClick={handleRecordActualIn}
                className={`py-2 px-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
                  agenda.actualIn
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                    : 'bg-teal-600 hover:bg-teal-700 border-teal-600 text-white shadow-xs'
                }`}
              >
                <div className="min-w-0">
                  <span
                    className={`text-[9px] font-bold uppercase block leading-none ${
                      agenda.actualIn ? 'text-emerald-700' : 'text-teal-100'
                    }`}
                  >
                    Actual IN {storeOrderIndex === 1 ? '(08:30)' : `(Toko ${storeOrderIndex})`}
                  </span>
                  <span className="text-[11px] font-black block mt-0.5 truncate">
                    {agenda.actualIn ? agenda.actualIn : 'Rekam Actual IN'}
                  </span>
                </div>
                {agenda.actualIn ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <LogIn className="w-4 h-4 text-white shrink-0" />
                )}
              </button>

              {/* Actual OUT Button / Status */}
              <button
                type="button"
                disabled={isRecordingAttendance}
                onClick={handleRecordActualOut}
                className={`py-2 px-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
                  agenda.actualOut
                    ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                    : agenda.actualIn
                    ? 'bg-amber-500 hover:bg-amber-600 border-amber-500 text-white shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <div className="min-w-0">
                  <span
                    className={`text-[9px] font-bold uppercase block leading-none ${
                      agenda.actualOut
                        ? 'text-amber-700'
                        : agenda.actualIn
                        ? 'text-amber-100'
                        : 'text-slate-400'
                    }`}
                  >
                    Actual OUT {storeOrderIndex < totalStoresToday ? '(Pindah Toko)' : '(17:30)'}
                  </span>
                  <span className="text-[11px] font-black block mt-0.5 truncate">
                    {agenda.actualOut ? agenda.actualOut : 'Rekam Actual OUT'}
                  </span>
                </div>
                {agenda.actualOut ? (
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <LogOut className="w-4 h-4 shrink-0" />
                )}
              </button>
            </div>

            {/* Khusus Admin: Tampilkan Audit Sistem Senyap */}
            {currentUser?.isAdmin && agenda.silentAudit && (
              <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-500">
                <span>
                  Audit Admin:{' '}
                  {agenda.silentAudit.inDistanceToStoreMeters !== undefined
                    ? `Jarak ${agenda.silentAudit.inDistanceToStoreMeters}m dari toko`
                    : 'Terekam di Latar Belakang'}
                </span>
                <span className="font-bold text-teal-700">
                  {agenda.silentAudit.inTimingStatus === 'LATE'
                    ? `Telat +${agenda.silentAudit.lateMinutes || 0}m`
                    : agenda.silentAudit.inTimingStatus === 'CONTINUATION_VISIT'
                    ? `Toko Lanjutan${
                        agenda.silentAudit.transitMinutesFromPrevStore !== undefined
                          ? ` (Transit ${agenda.silentAudit.transitMinutesFromPrevStore}m)`
                          : ''
                      }`
                    : 'On Time'}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenVisitFormWithAutoIn}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#00A389] to-[#00826D] text-white text-xs font-black shadow-pill-teal hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>BUKA FORM VISIT REPORT</span>
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
};
