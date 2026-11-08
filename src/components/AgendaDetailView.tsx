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
  ShieldAlert,
  Navigation,
  Mountain,
  ExternalLink,
} from 'lucide-react';
import { ScheduleAgenda, ScheduleCategory, User } from '../types';
import { isSamePersonName } from '../data/masterStoresData';
import {
  loadLeaflet,
  resolveAgendaGeoPoints,
  resolvePrimaryAgendaGeoPoint,
} from '../utils/mapGeoUtils';

interface AgendaDetailViewProps {
  agenda: ScheduleAgenda;
  currentUser?: User | null;
  onBack: () => void;
  onOpenVisitForm?: () => void;
}

export const AgendaDetailView: React.FC<AgendaDetailViewProps> = ({
  agenda,
  currentUser,
  onBack,
  onOpenVisitForm,
}) => {
  const isOwner =
    Boolean(currentUser?.isAdmin) ||
    isSamePersonName(agenda.pic, currentUser?.name);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);

  // Resolve store geo point(s) (Lat, Lng, Altitude) from Master Data Store
  const matchedGeoPoints = useMemo(() => resolveAgendaGeoPoints(agenda), [agenda]);
  const primaryGeoPoint = useMemo(() => resolvePrimaryAgendaGeoPoint(agenda), [agenda]);
  const activePoints = matchedGeoPoints.length > 0 ? matchedGeoPoints : [primaryGeoPoint];

  useEffect(() => {
    let mounted = true;
    loadLeaflet().then((L) => {
      if (mounted && L) setLeafletReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current) return;
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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

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

    // Add Store Pinpoints
    activePoints.forEach((pt, idx) => {
      boundsCoords.push([pt.lat, pt.lng]);
      const pinIcon = L.divIcon({
        className: 'fmcu-detail-store-pin',
        html: `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
            <div style="background:linear-gradient(135deg,#0D9488,#059669);color:#fff;font-weight:900;font-size:10px;padding:3px 8px;border-radius:999px;border:2px solid #fff;box-shadow:0 4px 12px rgba(13,148,136,0.45);display:flex;align-items:center;gap:4px;white-space:nowrap;">
              ${
                activePoints.length > 1
                  ? `<span style="background:#fff;color:#0F766E;border-radius:999px;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;">${idx + 1}</span>`
                  : ''
              }
              <span>${pt.code !== 'FMCU' ? `#${pt.code} ` : ''}${pt.name}</span>
            </div>
            <div style="width:3px;height:6px;background:#0D9488;"></div>
            <div style="width:9px;height:9px;border-radius:999px;background:#0D9488;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      L.marker([pt.lat, pt.lng], { icon: pinIcon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:system-ui,sans-serif;font-size:11px;">
            <strong>${pt.name}</strong><br/>
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
  }, [leafletReady, primaryGeoPoint, activePoints, currentUser?.isAdmin]);

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
              {primaryGeoPoint.code !== 'FMCU' && (
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
                {agenda.time} WIB
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
                PIC Lapangan
              </span>
              <p className="text-[11px] font-extrabold text-slate-800 truncate mt-0.5">
                {agenda.pic}
              </p>
            </div>
          </div>
        </div>

        {/* Short Note */}
        {agenda.description && (
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

      {/* 3. Embedded Interactive Live Map Card (Auto-flexes to fill remaining screen height) */}
      <div className="flex-1 min-h-[160px] bg-white rounded-3xl p-2.5 shadow-soft-card border border-slate-100 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-1 mb-1.5 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider truncate">
              Pinpoint Lokasi: {primaryGeoPoint.name}
            </span>
          </div>

          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${primaryGeoPoint.lat},${primaryGeoPoint.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-[10px] font-extrabold flex items-center gap-1 shrink-0 transition"
          >
            <Navigation className="w-2.5 h-2.5" />
            <span>Buka Rute Maps</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

        {/* Interactive Leaflet Container */}
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

      {/* 4. Bottom Primary Action Bar (Fits on same screen without scrolling) */}
      <div className="shrink-0">
        {agenda.category === 'VISIT' ? (
          isOwner ? (
            <button
              type="button"
              onClick={onOpenVisitForm}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#00A389] to-[#00826D] text-white text-xs font-black shadow-pill-teal hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>BUKA FORM VISIT REPORT</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          ) : (
            <div className="bg-slate-100 rounded-2xl px-3.5 py-2.5 border border-slate-200/80 flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" />
              <p className="text-[11px] font-bold text-slate-600 truncate">
                Form visit ditugaskan kepada <span className="text-teal-700">{agenda.pic}</span>
              </p>
            </div>
          )
        ) : (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${primaryGeoPoint.lat},${primaryGeoPoint.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition"
          >
            <Navigation className="w-4 h-4 text-teal-400" />
            <span>Navigasi ke Lokasi Agenda ({primaryGeoPoint.city})</span>
          </a>
        )}
      </div>
    </div>
  );
};
