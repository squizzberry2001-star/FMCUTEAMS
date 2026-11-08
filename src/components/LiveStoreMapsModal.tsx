import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  X,
  MapPin,
  Navigation,
  Route,
  Mountain,
  Compass,
  Store,
  Users,
  Radio,
  Search,
  ExternalLink,
  Layers,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { ScheduleAgenda, User } from '../types';
import {
  getMasterStores,
  getStoreCodesOwnedByBestie,
  isSamePersonName,
} from '../data/masterStoresData';
import {
  loadLeaflet,
  StoreGeoPoint,
  toStoreGeoPoint,
  resolveAgendaGeoPoints,
  calculateHaversineKm,
  buildAdminUserPinpoints,
} from '../utils/mapGeoUtils';
import { getMondayOfWeek, getFullWeekDays } from '../services/scheduleExcelService';

interface LiveStoreMapsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
  users?: User[];
  agendas: ScheduleAgenda[];
  selectedDate: string;
  onSelectAgenda?: (agenda: ScheduleAgenda) => void;
}

export const LiveStoreMapsModal: React.FC<LiveStoreMapsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  users = [],
  agendas,
  selectedDate,
}) => {
  const isAdmin = Boolean(currentUser?.isAdmin);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);

  const [leafletReady, setLeafletReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState<StoreGeoPoint | null>(null);

  // Filter Scope:
  // 'scheduled' = Toko yang dijadwalkan (Rute Minggu/Hari Ini)
  // 'master' = Semua Pinpoint Master Data Store (atau Toko Kepemilikan)
  const [viewMode, setViewMode] = useState<'scheduled' | 'master'>('scheduled');

  // Admin-specific controls: Pinpoint User, Pinpoint Toko, Radius, Rute
  const [selectedPicFilter, setSelectedPicFilter] = useState<string>('ALL');
  const [showUserPinpoints, setShowUserPinpoints] = useState<boolean>(true);
  const [showStorePinpoints, setShowStorePinpoints] = useState<boolean>(true);
  const [showRadiusCircle, setShowRadiusCircle] = useState<boolean>(true);
  const [showRouteLine, setShowRouteLine] = useState<boolean>(true);
  const [radiusMeters, setRadiusMeters] = useState<number>(250);

  const allMasterStores = useMemo(() => getMasterStores(), []);
  const currentWeekMonday = useMemo(() => getMondayOfWeek(), []);
  const activeWeekDays = useMemo(() => getFullWeekDays(currentWeekMonday), [currentWeekMonday]);
  const weekStartStr = activeWeekDays[0]?.dateStr || currentWeekMonday;
  const weekEndStr = activeWeekDays[activeWeekDays.length - 1]?.dateStr || currentWeekMonday;

  // 1. Resolve Scheduled Store Points & Route
  const scheduledStorePoints = useMemo(() => {
    // Filter agendas in current running week (or selectedDate)
    const relevantAgendas = agendas
      .filter((a) => {
        const inWeek = a.date >= weekStartStr && a.date <= weekEndStr;
        if (!inWeek && a.date !== selectedDate) return false;

        if (!isAdmin) {
          // User mode: ONLY their own scheduled stores
          return isSamePersonName(a.pic, currentUser?.name);
        } else {
          // Admin mode: filter by selected PIC or ALL
          if (selectedPicFilter !== 'ALL') {
            return isSamePersonName(a.pic, selectedPicFilter);
          }
          return true;
        }
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || '').localeCompare(b.time || '');
      });

    const points: StoreGeoPoint[] = [];
    let order = 1;

    relevantAgendas.forEach((ag) => {
      const resolved = resolveAgendaGeoPoints(ag, allMasterStores);
      resolved.forEach((pt) => {
        points.push({
          ...pt,
          routeOrder: order++,
        });
      });
    });

    // Fallback for User if no store matched in current week: show owned stores or top scheduled stores
    if (points.length === 0 && !isAdmin && currentUser?.name) {
      const myAllAgendas = agendas
        .filter((a) => isSamePersonName(a.pic, currentUser.name))
        .sort((a, b) => a.date.localeCompare(b.date));
      myAllAgendas.forEach((ag) => {
        const resolved = resolveAgendaGeoPoints(ag, allMasterStores);
        resolved.forEach((pt) => {
          points.push({
            ...pt,
            routeOrder: order++,
          });
        });
      });

      if (points.length === 0) {
        const ownedCodes = getStoreCodesOwnedByBestie(currentUser.name);
        if (ownedCodes.size > 0) {
          allMasterStores
            .filter((s) => ownedCodes.has(String(s.code).toUpperCase()))
            .slice(0, 8)
            .forEach((st) => {
              points.push(
                toStoreGeoPoint(st, {
                  agendaTitle: `Kunjungan Toko ${st.name}`,
                  agendaDate: selectedDate,
                  agendaTime: '09:00',
                  agendaPic: currentUser.name,
                  routeOrder: order++,
                })
              );
            });
        }
      }
    }

    return points;
  }, [agendas, weekStartStr, weekEndStr, selectedDate, isAdmin, currentUser, selectedPicFilter, allMasterStores]);

  // 2. Master Store Points (filtered by search query)
  const masterGeoPoints = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const baseList = allMasterStores
      .filter((s) => {
        if (!q) return true;
        return (
          s.code.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q)
        );
      })
      .slice(0, q ? 80 : 120);

    return baseList.map((st, idx) =>
      toStoreGeoPoint(st, {
        routeOrder: idx + 1,
      })
    );
  }, [allMasterStores, searchQuery]);

  // Active Store Points displayed on map
  const displayedStorePoints = useMemo(() => {
    const source = viewMode === 'scheduled' && scheduledStorePoints.length > 0
      ? scheduledStorePoints
      : masterGeoPoints;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        (p.agendaPic || '').toLowerCase().includes(q)
    );
  }, [viewMode, scheduledStorePoints, masterGeoPoints, searchQuery]);

  // 3. Admin User Pinpoints
  const adminUserPinpoints = useMemo(() => {
    if (!isAdmin) return [];
    const allPoints = buildAdminUserPinpoints(users, scheduledStorePoints, radiusMeters);
    if (selectedPicFilter === 'ALL') return allPoints;
    return allPoints.filter((u) => isSamePersonName(u.userName, selectedPicFilter));
  }, [isAdmin, users, scheduledStorePoints, radiusMeters, selectedPicFilter]);

  // 4. Total Route Distance Calculation
  const totalRouteKm = useMemo(() => {
    if (displayedStorePoints.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < displayedStorePoints.length - 1; i++) {
      const a = displayedStorePoints[i];
      const b = displayedStorePoints[i + 1];
      total += calculateHaversineKm(a.lat, a.lng, b.lat, b.lng);
    }
    return Number(total.toFixed(2));
  }, [displayedStorePoints]);

  // Load Leaflet on mount
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    loadLeaflet().then((L) => {
      if (active && L) {
        setLeafletReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, [isOpen]);

  // Initialize & Update Leaflet Map
  useEffect(() => {
    if (!isOpen || !leafletReady || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Create map instance if not created yet
    if (!mapInstanceRef.current) {
      const defaultCenter: [number, number] =
        displayedStorePoints.length > 0
          ? [displayedStorePoints[0].lat, displayedStorePoints[0].lng]
          : [-6.2297, 106.8295];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 12,
        zoomControl: false,
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      // Clean high-contrast CartoDB Voyager / OSM tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    }

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    const boundsCoords: [number, number][] = [];

    // A. ADMIN ONLY: RADIUS GEOFENCE CIRCLES
    if (isAdmin && showRadiusCircle && showStorePinpoints) {
      displayedStorePoints.forEach((st) => {
        L.circle([st.lat, st.lng], {
          radius: radiusMeters,
          color: '#0D9488',
          weight: 1.5,
          opacity: 0.75,
          fillColor: '#14B8A6',
          fillOpacity: 0.16,
          dashArray: '4, 4',
        })
          .bindTooltip(`Radius Geofence Toko ${st.name}: ${radiusMeters}m`, {
            direction: 'top',
          })
          .addTo(layerGroup);
      });
    }

    // B. ROUTE LINES (RUTE TOKO YANG DIJADWALKAN + ADMIN USER-TO-STORE ROUTE)
    // User always sees route for scheduled stores; Admin can toggle showRouteLine
    const shouldDrawRoute = (!isAdmin && viewMode === 'scheduled') || (isAdmin && showRouteLine);

    if (shouldDrawRoute && displayedStorePoints.length >= 2) {
      const routeLatLngs: [number, number][] = displayedStorePoints.map((p) => [p.lat, p.lng]);

      // Outer glow polyline
      L.polyline(routeLatLngs, {
        color: '#0F766E',
        weight: 6,
        opacity: 0.25,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layerGroup);

      // Main dashed route line
      L.polyline(routeLatLngs, {
        color: '#0D9488',
        weight: 3.5,
        opacity: 0.95,
        dashArray: '8, 6',
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layerGroup);
    }

    // Admin route from User Pinpoint to Target Store
    if (isAdmin && showRouteLine && showUserPinpoints) {
      adminUserPinpoints.forEach((up) => {
        const targetStore = displayedStorePoints.find((s) => s.code === up.targetStoreCode);
        if (targetStore) {
          L.polyline(
            [
              [up.lat, up.lng],
              [targetStore.lat, targetStore.lng],
            ],
            {
              color: up.isInsideRadius ? '#10B981' : '#3B82F6',
              weight: 2.5,
              opacity: 0.85,
              dashArray: '4, 5',
            }
          ).addTo(layerGroup);
        }
      });
    }

    // C. STORE PINPOINTS (USER & ADMIN)
    if (!isAdmin || showStorePinpoints) {
      displayedStorePoints.forEach((st, idx) => {
        boundsCoords.push([st.lat, st.lng]);
        const badgeNumber = st.routeOrder || idx + 1;

        const storeIcon = L.divIcon({
          className: 'fmcu-custom-store-pin',
          html: `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
              <div style="background:linear-gradient(135deg,#0D9488,#059669);color:#fff;font-weight:900;font-size:10px;padding:3px 7px;border-radius:999px;border:2px solid #fff;box-shadow:0 4px 12px rgba(13,148,136,0.45);display:flex;align-items:center;gap:4px;white-space:nowrap;">
                <span style="background:#fff;color:#0F766E;border-radius:999px;width:15px;height:15px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;">${badgeNumber}</span>
                <span>${st.name}</span>
              </div>
              <div style="width:3px;height:7px;background:#0D9488;border-radius:2px;"></div>
              <div style="width:8px;height:8px;border-radius:999px;background:#0D9488;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([st.lat, st.lng], { icon: storeIcon }).addTo(layerGroup);

        const popupHtml = `
          <div style="font-family:system-ui,-apple-system,sans-serif;min-width:210px;padding:2px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px;">
              <span style="background:#CCFBF1;color:#115E59;font-size:10px;font-weight:800;padding:2px 7px;border-radius:999px;">#${st.code} • ${st.type}</span>
              <span style="font-size:10px;font-weight:700;color:#64748B;">${st.city}</span>
            </div>
            <div style="font-size:13px;font-weight:900;color:#0F172A;margin-bottom:4px;">Toko ${st.name}</div>
            <div style="font-size:10px;color:#475569;line-height:1.35;margin-bottom:6px;">${st.address}</div>
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:6px;font-size:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:6px;">
              <div>
                <div style="color:#94A3B8;font-weight:700;font-size:9px;">LATITUDE</div>
                <div style="color:#0F172A;font-weight:800;">${st.lat.toFixed(5)}°</div>
              </div>
              <div>
                <div style="color:#94A3B8;font-weight:700;font-size:9px;">LONGITUDE</div>
                <div style="color:#0F172A;font-weight:800;">${st.lng.toFixed(5)}°</div>
              </div>
              <div>
                <div style="color:#94A3B8;font-weight:700;font-size:9px;">ALTITUDE</div>
                <div style="color:#0D9488;font-weight:800;">${st.altitude} mdpl</div>
              </div>
            </div>
            ${
              st.agendaPic
                ? `<div style="font-size:10px;color:#334155;font-weight:700;margin-bottom:4px;">PIC: <span style="color:#0D9488;">${st.agendaPic}</span> (${st.agendaDate || ''} ${st.agendaTime || ''})</div>`
                : ''
            }
            <a href="https://www.google.com/maps/dir/?api=1&destination=${st.lat},${st.lng}" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;background:#0D9488;color:#fff;text-decoration:none;font-size:10px;font-weight:800;padding:5px 8px;border-radius:8px;margin-top:4px;">
              Buka Rute Google Maps
            </a>
          </div>
        `;

        marker.bindPopup(popupHtml);
        marker.on('click', () => {
          setSelectedStore(st);
        });
      });
    }

    // D. ADMIN ONLY: USER PINPOINTS
    if (isAdmin && showUserPinpoints) {
      adminUserPinpoints.forEach((up) => {
        boundsCoords.push([up.lat, up.lng]);
        const initials = up.userName
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();

        const userIcon = L.divIcon({
          className: 'fmcu-custom-user-pin',
          html: `
            <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
              <div style="background:linear-gradient(135deg,#2563EB,#1D4ED8);color:#fff;font-weight:900;font-size:10px;padding:3px 8px;border-radius:999px;border:2px solid #fff;box-shadow:0 4px 12px rgba(37,99,235,0.45);display:flex;align-items:center;gap:4px;white-space:nowrap;">
                <span style="background:#fff;color:#1D4ED8;border-radius:999px;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;">${initials}</span>
                <span>${up.userName}</span>
              </div>
              <div style="width:3px;height:6px;background:#2563EB;"></div>
              <div style="width:10px;height:10px;border-radius:999px;background:#2563EB;border:2px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,0.25);"></div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const uMarker = L.marker([up.lat, up.lng], { icon: userIcon }).addTo(layerGroup);
        uMarker.bindPopup(`
          <div style="font-family:system-ui,-apple-system,sans-serif;min-width:190px;padding:2px;">
            <div style="font-size:10px;font-weight:800;color:#2563EB;text-transform:uppercase;">PINPOINT USER LAPANGAN</div>
            <div style="font-size:13px;font-weight:900;color:#0F172A;margin-top:2px;">${up.userName}</div>
            <div style="font-size:10px;color:#64748B;margin-bottom:6px;">${up.role}</div>
            <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:5px;font-size:10px;margin-bottom:4px;">
              <div><strong>Tujuan:</strong> Toko ${up.targetStoreName} (#${up.targetStoreCode})</div>
              <div><strong>Jarak ke Toko:</strong> ${up.distanceToStoreMeters}m (${
          up.isInsideRadius ? 'Di Dalam Radius' : 'Menuju Lokasi'
        })</div>
              <div><strong>Koordinat:</strong> ${up.lat.toFixed(5)}°, ${up.lng.toFixed(5)}° (${up.altitude} mdpl)</div>
            </div>
          </div>
        `);
      });
    }

    if (boundsCoords.length > 0) {
      try {
        const bounds = L.latLngBounds(boundsCoords);
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
      } catch {
        // ignore bounds error
      }
    }
  }, [
    isOpen,
    leafletReady,
    displayedStorePoints,
    isAdmin,
    showUserPinpoints,
    showStorePinpoints,
    showRadiusCircle,
    showRouteLine,
    radiusMeters,
    adminUserPinpoints,
    viewMode,
  ]);

  // Cleanup map instance when modal closes
  useEffect(() => {
    if (!isOpen && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    }
  }, [isOpen]);

  const handleFocusStore = (st: StoreGeoPoint) => {
    setSelectedStore(st);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([st.lat, st.lng], 16, { duration: 0.8 });
    }
  };

  if (!isOpen) return null;

  const uniquePics = Array.from(
    new Set(agendas.map((a) => a.pic).filter(Boolean))
  ).sort();

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-md flex flex-col justify-between overflow-hidden animate-fadeIn">
      {/* Main Fullscreen Container */}
      <div className="relative w-full h-full bg-[#F8F9FD] flex flex-col overflow-hidden">
        {/* Top Liquid Glass Header */}
        <div className="z-20 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 px-4 py-3 flex flex-col gap-2.5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#2BB3A0] to-[#0D9488] text-white flex items-center justify-center shadow-xs shrink-0">
                <Compass className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-sm sm:text-base font-black text-slate-900 truncate">
                    FMCU Live Maps &amp; Geo-Coordinate
                  </h2>
                  <span
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                      isAdmin
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-teal-50 text-teal-700 border-teal-200'
                    }`}
                  >
                    {isAdmin
                      ? 'ADMIN • USER, TOKO, RADIUS & RUTE'
                      : 'USER • PINPOINT TOKO & RUTE JADWAL'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium truncate">
                  {isAdmin
                    ? 'Monitoring titik koordinat personel lapangan, toko, radius geofence, dan rute kunjungan'
                    : `Menampilkan pinpoint koordinat (Lat, Lng, Altitude) & rute toko terjadwal untuk ${currentUser?.name || 'Anda'}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
              title="Tutup Live Maps"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter & Layer Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Mode Switcher: Rute Terjadwal vs Master Store */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('scheduled')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition cursor-pointer ${
                  viewMode === 'scheduled'
                    ? 'bg-white text-teal-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Route className="w-3.5 h-3.5 text-teal-600" />
                <span>Rute Toko Dijadwalkan ({scheduledStorePoints.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('master')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition cursor-pointer ${
                  viewMode === 'master'
                    ? 'bg-white text-teal-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Store className="w-3.5 h-3.5 text-emerald-600" />
                <span>Master Store ({allMasterStores.length})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode / nama toko / kota..."
                className="w-full pl-8 pr-3 py-1 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-500"
              />
            </div>

            {/* ADMIN ONLY LAYER TOGGLES: Pinpoint User, Pinpoint Toko, Radius, Rute */}
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={selectedPicFilter}
                  onChange={(e) => setSelectedPicFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200 text-[11px] font-bold text-blue-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Semua Personel ({uniquePics.length})</option>
                  {uniquePics.map((p) => (
                    <option key={p} value={p}>
                      Personel: {p}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setShowUserPinpoints((v) => !v)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold border flex items-center gap-1 transition cursor-pointer ${
                    showUserPinpoints
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  <span>Pinpoint User</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowStorePinpoints((v) => !v)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold border flex items-center gap-1 transition cursor-pointer ${
                    showStorePinpoints
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  <MapPin className="w-3 h-3" />
                  <span>Pinpoint Toko</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowRadiusCircle((v) => !v)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold border flex items-center gap-1 transition cursor-pointer ${
                    showRadiusCircle
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  <Radio className="w-3 h-3" />
                  <span>Radius {radiusMeters}m</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowRouteLine((v) => !v)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold border flex items-center gap-1 transition cursor-pointer ${
                    showRouteLine
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  <Route className="w-3 h-3" />
                  <span>Rute</span>
                </button>

                {showRadiusCircle && (
                  <select
                    value={radiusMeters}
                    onChange={(e) => setRadiusMeters(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer"
                    title="Ubah Radius Geofence"
                  >
                    <option value={150}>150m</option>
                    <option value={250}>250m</option>
                    <option value={500}>500m</option>
                  </select>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center Map Canvas Area */}
        <div className="relative flex-1 w-full bg-slate-200 overflow-hidden">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Floating Summary Stats Pill on Map Top-Left */}
          <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 pointer-events-none">
            <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-md border border-slate-200/80 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-black text-slate-800">
                {displayedStorePoints.length} Titik Toko
              </span>
              {totalRouteKm > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-[11px] font-extrabold text-teal-700 flex items-center gap-1">
                    <Route className="w-3 h-3" />
                    Total Rute: {totalRouteKm} km
                  </span>
                </>
              )}
              {isAdmin && showUserPinpoints && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-[11px] font-extrabold text-blue-700 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {adminUserPinpoints.length} User Aktif
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Selected Store Floating Coordinate Card */}
          {selectedStore && (
            <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-80 z-20 bg-white/95 backdrop-blur-xl rounded-2xl p-3.5 shadow-xl border border-teal-200 animate-fadeIn">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-[10px] font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                    #{selectedStore.code} • {selectedStore.type}
                  </span>
                  <h4 className="text-sm font-black text-slate-900 mt-1">
                    Toko {selectedStore.name}
                  </h4>
                  <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">
                    {selectedStore.address}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStore(null)}
                  className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Lat / Lng / Altitude Grid */}
              <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200/70 mb-2.5 text-center">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">
                    Latitude
                  </span>
                  <span className="text-[11px] font-black text-slate-800 tabular-nums">
                    {selectedStore.lat.toFixed(5)}°
                  </span>
                </div>
                <div className="border-x border-slate-200/70">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">
                    Longitude
                  </span>
                  <span className="text-[11px] font-black text-slate-800 tabular-nums">
                    {selectedStore.lng.toFixed(5)}°
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">
                    Altitude
                  </span>
                  <span className="text-[11px] font-black text-teal-700 tabular-nums">
                    {selectedStore.altitude} mdpl
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] text-slate-500 truncate">
                  SH: <strong className="text-slate-700">{selectedStore.storeHead}</strong>
                </div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedStore.lat},${selectedStore.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-extrabold flex items-center gap-1 shadow-xs shrink-0"
                >
                  <Navigation className="w-3 h-3" />
                  <span>Navigasi Rute</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Horizontal Route & Store Pinpoints Strip */}
        <div className="z-20 bg-white border-t border-slate-200/80 px-4 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-teal-600" />
              {viewMode === 'scheduled'
                ? 'Urutan Rute & Pinpoint Toko Terjadwal (Klik untuk Fokus Peta)'
                : 'Daftar Pinpoint Koordinat Master Data Store'}
            </span>
            {displayedStorePoints.length >= 2 && (
              <a
                href={`https://www.google.com/maps/dir/${displayedStorePoints
                  .slice(0, 10)
                  .map((p) => `${p.lat},${p.lng}`)
                  .join('/')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-extrabold text-teal-700 hover:text-teal-800 flex items-center gap-1 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200"
              >
                <Navigation className="w-3 h-3" />
                <span>Buka Multi-Rute di Google Maps</span>
              </a>
            )}
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {displayedStorePoints.length === 0 ? (
              <div className="text-xs text-slate-400 py-2">
                Tidak ada titik toko yang cocok dengan pencarian.
              </div>
            ) : (
              displayedStorePoints.map((st, idx) => {
                const isSelected = selectedStore?.code === st.code && selectedStore?.routeOrder === st.routeOrder;
                const prev = idx > 0 ? displayedStorePoints[idx - 1] : null;
                const distFromPrev = prev
                  ? calculateHaversineKm(prev.lat, prev.lng, st.lat, st.lng).toFixed(1)
                  : null;

                return (
                  <React.Fragment key={`${st.code}-${idx}`}>
                    {distFromPrev && viewMode === 'scheduled' && (
                      <div className="flex flex-col items-center justify-center shrink-0 text-[9px] font-extrabold text-teal-600 px-1">
                        <span>+{distFromPrev} km</span>
                        <span className="text-slate-300">━━▶</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleFocusStore(st)}
                      className={`shrink-0 text-left p-2.5 rounded-2xl border transition-all cursor-pointer min-w-[215px] max-w-[240px] ${
                        isSelected
                          ? 'bg-teal-50/90 border-teal-500 shadow-xs'
                          : 'bg-slate-50/80 hover:bg-white border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                            {st.routeOrder || idx + 1}
                          </span>
                          <span className="text-xs font-black text-slate-800 truncate">
                            {st.name}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                          #{st.code}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 tabular-nums">
                        <span>Lat: {st.lat.toFixed(4)}°</span>
                        <span>•</span>
                        <span>Lng: {st.lng.toFixed(4)}°</span>
                        <span>•</span>
                        <span className="text-teal-700 flex items-center gap-0.5">
                          <Mountain className="w-2.5 h-2.5" />
                          {st.altitude}m
                        </span>
                      </div>

                      {st.agendaDate && (
                        <div className="mt-1 pt-1 border-t border-slate-200/60 flex items-center justify-between text-[9px] text-slate-500 font-semibold">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5 text-teal-600" />
                            {st.agendaDate} ({st.agendaTime})
                          </span>
                          {st.agendaPic && (
                            <span className="text-teal-700 font-bold truncate max-w-[90px]">
                              {st.agendaPic}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
