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
  Calendar,
  Maximize2,
  Minimize2,
  LocateFixed,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
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

type MapTileStyle = 'osm' | 'street' | 'satellite';

const MAP_TILE_PROVIDERS: Record<
  MapTileStyle,
  { label: string; url: string; attribution: string; maxZoom: number }
> = {
  osm: {
    label: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  street: {
    label: 'Peta Jalan',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &copy; OpenStreetMap',
    maxZoom: 19,
  },
  satellite: {
    label: 'Satelit',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Imagery',
    maxZoom: 19,
  },
};

function getMinimalistStoreLabel(rawName: string): string {
  const cleaned = (rawName || '')
    .replace(/^(?:familymart|family mart|fm|fmi|toko|cabang)\s+/i, '')
    .trim();
  if (cleaned.length <= 10) return cleaned;
  return `${cleaned.slice(0, 9).trim()}…`;
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
  const modalRootRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);

  const [leafletReady, setLeafletReady] = useState(false);
  const [tileStyle, setTileStyle] = useState<MapTileStyle>('osm');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState<StoreGeoPoint | null>(null);

  // Fullscreen & Immersive HUD State
  const [isFullScreenMap, setIsFullScreenMap] = useState<boolean>(false);
  const [showFloatingControls, setShowFloatingControls] = useState<boolean>(false);
  const [showBottomStripInFs, setShowBottomStripInFs] = useState<boolean>(false);

  // Filter Scope:
  // 'all' = Menampilkan SEMUA titik koordinat toko yang ada di Master Data (610 toko) + Rute Toko Terjadwal
  // 'scheduled' = Fokus hanya pada toko yang dijadwalkan
  const [viewMode, setViewMode] = useState<'all' | 'scheduled'>('all');

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
    const relevantAgendas = agendas
      .filter((a) => {
        const inWeek = a.date >= weekStartStr && a.date <= weekEndStr;
        if (!inWeek && a.date !== selectedDate) return false;

        if (!isAdmin) {
          return isSamePersonName(a.pic, currentUser?.name);
        } else {
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
  }, [
    agendas,
    weekStartStr,
    weekEndStr,
    selectedDate,
    isAdmin,
    currentUser,
    selectedPicFilter,
    allMasterStores,
  ]);

  // Set of scheduled store codes & lookup map for route order
  const scheduledByCodeMap = useMemo(() => {
    const map = new Map<string, StoreGeoPoint>();
    scheduledStorePoints.forEach((pt) => {
      const key = String(pt.code).toUpperCase();
      if (!map.has(key)) {
        map.set(key, pt);
      }
    });
    return map;
  }, [scheduledStorePoints]);

  // 2. ALL Master Store GeoPoints (Seluruh 610 Toko di Master Data tanpa pemotongan!)
  const allMasterGeoPoints = useMemo(() => {
    return allMasterStores.map((st, idx) => {
      const sched = scheduledByCodeMap.get(String(st.code).toUpperCase());
      if (sched) {
        return sched;
      }
      return toStoreGeoPoint(st, {
        routeOrder: idx + 1,
      });
    });
  }, [allMasterStores, scheduledByCodeMap]);

  // Active Store Points displayed on map
  const displayedStorePoints = useMemo(() => {
    const source = viewMode === 'scheduled' ? scheduledStorePoints : allMasterGeoPoints;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        (p.agendaPic || '').toLowerCase().includes(q)
    );
  }, [viewMode, scheduledStorePoints, allMasterGeoPoints, searchQuery]);

  // Bottom strip list (prioritizes scheduled route stores first, then master stores)
  const bottomStripPoints = useMemo(() => {
    if (viewMode === 'scheduled') return displayedStorePoints;
    const q = searchQuery.trim().toLowerCase();
    if (q) return displayedStorePoints.slice(0, 60);
    if (scheduledStorePoints.length > 0) {
      const schedCodes = new Set(scheduledStorePoints.map((s) => s.code));
      const rest = displayedStorePoints.filter((s) => !schedCodes.has(s.code)).slice(0, 40);
      return [...scheduledStorePoints, ...rest];
    }
    return displayedStorePoints.slice(0, 50);
  }, [viewMode, displayedStorePoints, scheduledStorePoints, searchQuery]);

  // 3. Admin User Pinpoints
  const adminUserPinpoints = useMemo(() => {
    if (!isAdmin) return [];
    const targetRef =
      scheduledStorePoints.length > 0 ? scheduledStorePoints : allMasterGeoPoints.slice(0, 30);
    const allPoints = buildAdminUserPinpoints(users, targetRef, radiusMeters);
    if (selectedPicFilter === 'ALL') return allPoints;
    return allPoints.filter((u) => isSamePersonName(u.userName, selectedPicFilter));
  }, [isAdmin, users, scheduledStorePoints, allMasterGeoPoints, radiusMeters, selectedPicFilter]);

  // 4. Total Scheduled Route Distance Calculation
  const totalRouteKm = useMemo(() => {
    if (scheduledStorePoints.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < scheduledStorePoints.length - 1; i++) {
      const a = scheduledStorePoints[i];
      const b = scheduledStorePoints[i + 1];
      total += calculateHaversineKm(a.lat, a.lng, b.lat, b.lng);
    }
    return Number(total.toFixed(2));
  }, [scheduledStorePoints]);

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

  // Initialize Map Instance & Tile Layer (100% Free, Zero API Key)
  useEffect(() => {
    if (!isOpen || !leafletReady || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (!mapInstanceRef.current) {
      const defaultCenter: [number, number] =
        scheduledStorePoints.length > 0
          ? [scheduledStorePoints[0].lat, scheduledStorePoints[0].lng]
          : [-6.2297, 106.8295];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 11,
        zoomControl: false,
        preferCanvas: true,
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      const provider = MAP_TILE_PROVIDERS[tileStyle];
      const tl = L.tileLayer(provider.url, {
        attribution: provider.attribution,
        maxZoom: provider.maxZoom,
      }).addTo(map);

      // Auto-fallback to Esri Street Map if primary tile server fails
      tl.on('tileerror', () => {
        if (tileStyle === 'osm' && tileLayerRef.current) {
          tileLayerRef.current.setUrl(MAP_TILE_PROVIDERS.street.url);
        }
      });

      tileLayerRef.current = tl;
      layerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    }
  }, [isOpen, leafletReady]);

  // Update Tile Style when switched by user
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const provider = MAP_TILE_PROVIDERS[tileStyle];
    tileLayerRef.current.setUrl(provider.url);
  }, [tileStyle]);

  // Render All Store Pinpoints, Scheduled Routes, Admin User Pinpoints & Radius
  useEffect(() => {
    if (!isOpen || !leafletReady || !mapInstanceRef.current || !layerGroupRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    const focusBoundsCoords: [number, number][] = [];

    // A. ADMIN ONLY: RADIUS GEOFENCE CIRCLES (on scheduled stores or selected store)
    if (isAdmin && showRadiusCircle && showStorePinpoints) {
      const radiusTargets =
        scheduledStorePoints.length > 0
          ? scheduledStorePoints
          : displayedStorePoints.slice(0, 25);

      radiusTargets.forEach((st) => {
        L.circle([st.lat, st.lng], {
          radius: radiusMeters,
          color: '#0D9488',
          weight: 1.5,
          opacity: 0.75,
          fillColor: '#14B8A6',
          fillOpacity: 0.14,
          dashArray: '4, 4',
        })
          .bindTooltip(`Radius Geofence ${st.name}: ${radiusMeters}m`, {
            direction: 'top',
          })
          .addTo(layerGroup);
      });
    }

    // B. ROUTE LINES (RUTE TOKO YANG DIJADWALKAN)
    const shouldDrawRoute = (!isAdmin || showRouteLine) && scheduledStorePoints.length >= 2;

    if (shouldDrawRoute) {
      const routeLatLngs: [number, number][] = scheduledStorePoints.map((p) => [p.lat, p.lng]);

      L.polyline(routeLatLngs, {
        color: '#0F766E',
        weight: 6,
        opacity: 0.22,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layerGroup);

      L.polyline(routeLatLngs, {
        color: '#0D9488',
        weight: 3.2,
        opacity: 0.95,
        dashArray: '7, 5',
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layerGroup);
    }

    // Admin route from User Pinpoint to Target Store
    if (isAdmin && showRouteLine && showUserPinpoints) {
      adminUserPinpoints.forEach((up) => {
        const targetStore =
          scheduledStorePoints.find((s) => s.code === up.targetStoreCode) ||
          displayedStorePoints.find((s) => s.code === up.targetStoreCode);
        if (targetStore) {
          L.polyline(
            [
              [up.lat, up.lng],
              [targetStore.lat, targetStore.lng],
            ],
            {
              color: up.isInsideRadius ? '#10B981' : '#3B82F6',
              weight: 2.2,
              opacity: 0.85,
              dashArray: '4, 4',
            }
          ).addTo(layerGroup);
        }
      });
    }

    // C. STORE PINPOINTS (ALL 610 MASTER STORES + SCHEDULED HIGHLIGHTS)
    // UI Pinpoint dibuat MINIMALIST (Pin bulat kecil + label pendek persegi kompak, BUKAN oval panjang!)
    if (!isAdmin || showStorePinpoints) {
      displayedStorePoints.forEach((st) => {
        const schedInfo = scheduledByCodeMap.get(String(st.code).toUpperCase());
        const isScheduled = Boolean(schedInfo);
        const shortName = getMinimalistStoreLabel(st.name);

        if (isScheduled || searchQuery.trim()) {
          focusBoundsCoords.push([st.lat, st.lng]);
        }

        // Minimalist Pinpoint HTML: circular pin + compact tiny square tag (no long oval!)
        const pinHtml = isScheduled
          ? `
            <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-90%);">
              <div style="width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#0D9488,#059669);color:#fff;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(13,148,136,0.5);">
                ${schedInfo?.routeOrder || '•'}
              </div>
              <div style="margin-top:1px;background:rgba(15,23,42,0.88);color:#fff;font-size:8px;font-weight:700;padding:1px 3.5px;border-radius:3px;max-width:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.15;box-shadow:0 1px 3px rgba(0,0,0,0.2);">
                ${shortName}
              </div>
            </div>
          `
          : `
            <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-85%);">
              <div style="width:12px;height:12px;border-radius:50%;background:#0D9488;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);"></div>
              <div style="margin-top:1px;background:rgba(255,255,255,0.92);color:#0F172A;border:1px solid rgba(148,163,184,0.45);font-size:7.5px;font-weight:800;padding:0.5px 3px;border-radius:3px;max-width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.1;">
                ${shortName}
              </div>
            </div>
          `;

        const storeIcon = L.divIcon({
          className: 'fmcu-minimal-store-pin',
          html: pinHtml,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([st.lat, st.lng], {
          icon: storeIcon,
          zIndexOffset: isScheduled ? 500 : 10,
        }).addTo(layerGroup);

        const popupHtml = `
          <div style="font-family:system-ui,-apple-system,sans-serif;min-width:205px;padding:2px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px;">
              <span style="background:#CCFBF1;color:#115E59;font-size:10px;font-weight:800;padding:2px 6px;border-radius:6px;">#${st.code} • ${st.type}</span>
              <span style="font-size:10px;font-weight:700;color:#64748B;">${st.city}</span>
            </div>
            <div style="font-size:12.5px;font-weight:900;color:#0F172A;margin-bottom:3px;">Toko ${st.name}</div>
            <div style="font-size:10px;color:#475569;line-height:1.35;margin-bottom:6px;">${st.address}</div>
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:6px;font-size:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:6px;">
              <div>
                <div style="color:#94A3B8;font-weight:700;font-size:8.5px;">LATITUDE</div>
                <div style="color:#0F172A;font-weight:800;">${st.lat.toFixed(5)}°</div>
              </div>
              <div>
                <div style="color:#94A3B8;font-weight:700;font-size:8.5px;">LONGITUDE</div>
                <div style="color:#0F172A;font-weight:800;">${st.lng.toFixed(5)}°</div>
              </div>
              <div>
                <div style="color:#94A3B8;font-weight:700;font-size:8.5px;">ALTITUDE</div>
                <div style="color:#0D9488;font-weight:800;">${st.altitude} mdpl</div>
              </div>
            </div>
            ${
              schedInfo?.agendaPic
                ? `<div style="font-size:10px;color:#334155;font-weight:700;margin-bottom:4px;">Jadwal: <span style="color:#0D9488;">${schedInfo.agendaPic}</span> (${schedInfo.agendaDate || ''} ${schedInfo.agendaTime || ''})</div>`
                : ''
            }
            <a href="https://www.google.com/maps/dir/?api=1&destination=${st.lat},${st.lng}" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;background:#0D9488;color:#fff;text-decoration:none;font-size:10px;font-weight:800;padding:5px 8px;border-radius:8px;margin-top:4px;">
              Buka Rute Google Maps
            </a>
          </div>
        `;

        marker.bindPopup(popupHtml);
        marker.on('click', () => {
          setSelectedStore(schedInfo || st);
        });
      });
    }

    // D. ADMIN ONLY: USER PINPOINTS (Minimalist circular avatar badge)
    if (isAdmin && showUserPinpoints) {
      adminUserPinpoints.forEach((up) => {
        focusBoundsCoords.push([up.lat, up.lng]);
        const initials = up.userName
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
        const firstName = up.userName.split(' ')[0] || up.userName;

        const userIcon = L.divIcon({
          className: 'fmcu-minimal-user-pin',
          html: `
            <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-90%);">
              <div style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#2563EB,#1D4ED8);color:#fff;font-weight:900;font-size:9px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(37,99,235,0.5);">
                ${initials}
              </div>
              <div style="margin-top:1px;background:#1E40AF;color:#fff;font-size:7.5px;font-weight:800;padding:0.5px 3.5px;border-radius:3px;max-width:54px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.15;">
                ${firstName}
              </div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const uMarker = L.marker([up.lat, up.lng], {
          icon: userIcon,
          zIndexOffset: 900,
        }).addTo(layerGroup);

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

    if (focusBoundsCoords.length > 0) {
      try {
        const bounds = L.latLngBounds(focusBoundsCoords);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } catch {
        // ignore bounds error
      }
    }
  }, [
    isOpen,
    leafletReady,
    displayedStorePoints,
    scheduledStorePoints,
    scheduledByCodeMap,
    isAdmin,
    showUserPinpoints,
    showStorePinpoints,
    showRadiusCircle,
    showRouteLine,
    radiusMeters,
    adminUserPinpoints,
    viewMode,
    searchQuery,
  ]);

  // Cleanup map instance when modal closes
  useEffect(() => {
    if (!isOpen && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      layerGroupRef.current = null;
      setIsFullScreenMap(false);
      setShowFloatingControls(false);
    }
  }, [isOpen]);

  // Sync Leaflet canvas size whenever Fullscreen or Bottom Strip toggles
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.invalidateSize();
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 180);
    return () => clearTimeout(timer);
  }, [isFullScreenMap, showBottomStripInFs, showFloatingControls]);

  // Listen to native browser fullscreenchange (e.g. when user presses ESC)
  useEffect(() => {
    const handleFsChange = () => {
      const isNativeFs = Boolean(
        document.fullscreenElement || (document as any).webkitFullscreenElement
      );
      if (!isNativeFs && isFullScreenMap) {
        // Keep map valid if user exited browser fullscreen via ESC
        setTimeout(() => {
          mapInstanceRef.current?.invalidateSize();
        }, 120);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [isFullScreenMap]);

  const handleToggleFullScreenMap = async () => {
    const nextState = !isFullScreenMap;
    setIsFullScreenMap(nextState);
    if (!nextState) {
      setShowFloatingControls(false);
    }

    try {
      const el = modalRootRef.current as any;
      if (nextState && el) {
        if (el.requestFullscreen && !document.fullscreenElement) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen && !(document as any).webkitFullscreenElement) {
          el.webkitRequestFullscreen();
        }
      } else if (!nextState) {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (
          (document as any).webkitFullscreenElement &&
          (document as any).webkitExitFullscreen
        ) {
          (document as any).webkitExitFullscreen();
        }
      }
    } catch {
      // Fallback: Immersive 100dvh x 100vw HUD mode still works on iOS Safari & mobile webviews
    }
  };

  const handleFitAllBounds = () => {
    if (!mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;
    const targetPoints =
      scheduledStorePoints.length > 0 ? scheduledStorePoints : displayedStorePoints;
    if (targetPoints.length > 0) {
      try {
        const bounds = L.latLngBounds(targetPoints.map((p) => [p.lat, p.lng]));
        mapInstanceRef.current.fitBounds(bounds, { padding: [45, 45], maxZoom: 14 });
      } catch {
        // ignore
      }
    }
  };

  const handleFocusStore = (st: StoreGeoPoint) => {
    setSelectedStore(st);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([st.lat, st.lng], 16, { duration: 0.7 });
    }
  };

  if (!isOpen) return null;

  const uniquePics = Array.from(new Set(agendas.map((a) => a.pic).filter(Boolean))).sort();

  return (
    <div
      ref={modalRootRef}
      className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-md flex flex-col justify-between overflow-hidden animate-fadeIn"
    >
      <div className="relative w-full h-full bg-[#F8F9FD] flex flex-col overflow-hidden">
        {/* Top Liquid Glass Header (Hidden when Fullscreen Map Mode is Active) */}
        {!isFullScreenMap && (
          <div className="z-20 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 px-4 py-2.5 flex flex-col gap-2 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#2BB3A0] to-[#0D9488] text-white flex items-center justify-center shadow-xs shrink-0">
                  <Compass className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="text-sm sm:text-base font-black text-slate-900 truncate">
                      FMCU Live Maps &amp; Master Store
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
                    Menampilkan {allMasterStores.length} titik koordinat toko Master Data (Lat, Lng, Altitude) &amp; rute jadwal
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleFullScreenMap}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#00A389] to-[#0D9488] hover:brightness-105 text-white text-[11px] font-extrabold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                  title="Buka Mode Fullscreen Live Maps (Layar Penuh 100%)"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mode Fullscreen</span>
                  <span className="sm:hidden">Fullscreen</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
                  title="Tutup Live Maps"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

          {/* Filter & Layer Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Mode Switcher: Semua Toko Master (610) vs Rute Terjadwal */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-extrabold flex items-center gap-1 transition cursor-pointer ${
                  viewMode === 'all'
                    ? 'bg-white text-teal-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Store className="w-3.5 h-3.5 text-emerald-600" />
                <span>Semua Toko ({allMasterStores.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('scheduled')}
                className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-extrabold flex items-center gap-1 transition cursor-pointer ${
                  viewMode === 'scheduled'
                    ? 'bg-white text-teal-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Route className="w-3.5 h-3.5 text-teal-600" />
                <span>Rute Jadwal ({scheduledStorePoints.length})</span>
              </button>
            </div>

            {/* Map Tile Switcher (OSM / Peta Jalan / Satelit - Bebas API Key) */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {(['osm', 'street', 'satellite'] as MapTileStyle[]).map((styleKey) => (
                <button
                  key={styleKey}
                  type="button"
                  onClick={() => setTileStyle(styleKey)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                    tileStyle === styleKey
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {MAP_TILE_PROVIDERS[styleKey].label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[150px] max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari dari 610 toko (kode/nama/kota)..."
                className="w-full pl-8 pr-3 py-1 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-500"
              />
            </div>

            {/* ADMIN ONLY LAYER TOGGLES */}
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={selectedPicFilter}
                  onChange={(e) => setSelectedPicFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200 text-[10px] font-bold text-blue-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Semua Personel ({uniquePics.length})</option>
                  {uniquePics.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setShowUserPinpoints((v) => !v)}
                  className={`px-2 py-1 rounded-xl text-[10px] font-extrabold border flex items-center gap-1 transition cursor-pointer ${
                    showUserPinpoints
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  <Users className="w-3 h-3" />
                  <span>User</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowStorePinpoints((v) => !v)}
                  className={`px-2 py-1 rounded-xl text-[10px] font-extrabold border flex items-center gap-1 transition cursor-pointer ${
                    showStorePinpoints
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-500 border-slate-200'
                  }`}
                >
                  <MapPin className="w-3 h-3" />
                  <span>Toko</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowRadiusCircle((v) => !v)}
                  className={`px-2 py-1 rounded-xl text-[10px] font-extrabold border flex items-center gap-1 transition cursor-pointer ${
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
                  className={`px-2 py-1 rounded-xl text-[10px] font-extrabold border flex items-center gap-1 transition cursor-pointer ${
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
        )}

        {/* Center Map Canvas Area (100% Edge-to-Edge in Fullscreen Mode) */}
        <div className="relative flex-1 w-full bg-slate-200 overflow-hidden">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Floating Summary Stats Pill + Quick Fullscreen HUD on Map Top-Left */}
          <div className="absolute top-3 left-3 right-16 z-20 flex flex-wrap items-center gap-1.5 pointer-events-none">
            <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-md border border-slate-200/80 flex items-center gap-2 pointer-events-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-black text-slate-800">
                {displayedStorePoints.length} Pinpoint Toko Aktif
              </span>
              {scheduledStorePoints.length > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-[11px] font-extrabold text-teal-700 flex items-center gap-1">
                    <Route className="w-3 h-3" />
                    {scheduledStorePoints.length} Rute ({totalRouteKm} km)
                  </span>
                </>
              )}
              {isAdmin && showUserPinpoints && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-[11px] font-extrabold text-blue-700 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {adminUserPinpoints.length} User
                  </span>
                </>
              )}
            </div>

            {/* Extra Floating HUD Controls when in Fullscreen Mode */}
            {isFullScreenMap && (
              <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
                {/* Quick Tile Switcher Pill in Fullscreen */}
                <div className="bg-white/95 backdrop-blur-md p-1 rounded-2xl shadow-md border border-slate-200/80 flex items-center gap-1">
                  {(['osm', 'street', 'satellite'] as MapTileStyle[]).map((styleKey) => (
                    <button
                      key={styleKey}
                      type="button"
                      onClick={() => setTileStyle(styleKey)}
                      className={`px-2 py-1 rounded-xl text-[10px] font-extrabold transition cursor-pointer ${
                        tileStyle === styleKey
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {MAP_TILE_PROVIDERS[styleKey].label}
                    </button>
                  ))}
                </div>

                {/* Toggle Floating Search & Filter Drawer */}
                <button
                  type="button"
                  onClick={() => setShowFloatingControls((v) => !v)}
                  className={`px-3 py-1.5 rounded-2xl shadow-md border text-[10px] font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                    showFloatingControls
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white/95 backdrop-blur-md text-slate-800 border-slate-200/80 hover:bg-white'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-teal-500" />
                  <span>Filter &amp; Cari</span>
                </button>
              </div>
            )}
          </div>

          {/* Floating Search & Filter Drawer in Fullscreen Mode */}
          {isFullScreenMap && showFloatingControls && (
            <div className="absolute top-14 left-3 z-20 w-[min(92vw,360px)] bg-white/95 backdrop-blur-xl rounded-2xl p-3 shadow-xl border border-slate-200/90 space-y-2.5 animate-fadeIn">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kode / nama toko / kota..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-teal-500"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setViewMode('all')}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] font-extrabold flex items-center justify-center gap-1 border cursor-pointer ${
                    viewMode === 'all'
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <Store className="w-3 h-3" />
                  <span>Semua ({allMasterStores.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('scheduled')}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] font-extrabold flex items-center justify-center gap-1 border cursor-pointer ${
                    viewMode === 'scheduled'
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <Route className="w-3 h-3" />
                  <span>Rute ({scheduledStorePoints.length})</span>
                </button>
              </div>

              {isAdmin && (
                <div className="space-y-1.5 pt-1 border-t border-slate-100">
                  <select
                    value={selectedPicFilter}
                    onChange={(e) => setSelectedPicFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-[10px] font-bold text-blue-800 outline-none"
                  >
                    <option value="ALL">Semua Personel ({uniquePics.length})</option>
                    {uniquePics.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-4 gap-1">
                    <button
                      type="button"
                      onClick={() => setShowUserPinpoints((v) => !v)}
                      className={`py-1 rounded-lg text-[9.5px] font-extrabold border cursor-pointer ${
                        showUserPinpoints
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      User
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowStorePinpoints((v) => !v)}
                      className={`py-1 rounded-lg text-[9.5px] font-extrabold border cursor-pointer ${
                        showStorePinpoints
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      Toko
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRadiusCircle((v) => !v)}
                      className={`py-1 rounded-lg text-[9.5px] font-extrabold border cursor-pointer ${
                        showRadiusCircle
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      Radius
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRouteLine((v) => !v)}
                      className={`py-1 rounded-lg text-[9.5px] font-extrabold border cursor-pointer ${
                        showRouteLine
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      Rute
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Floating Action Dock on Map Bottom-Left / Top-Right (Fullscreen Toggle + Fit Bounds + Close) */}
          <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleFullScreenMap}
              className={`px-3 py-2 rounded-2xl shadow-lg border text-[11px] font-black flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                isFullScreenMap
                  ? 'bg-slate-900/95 hover:bg-black text-white border-slate-700'
                  : 'bg-white/95 hover:bg-white text-slate-900 border-slate-200/90'
              }`}
              title={isFullScreenMap ? 'Keluar dari Mode Fullscreen' : 'Buka Mode Fullscreen Live Maps'}
            >
              {isFullScreenMap ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-teal-400" />
                  <span>Keluar Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>Layar Penuh</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleFitAllBounds}
              className="px-2.5 py-2 rounded-2xl bg-white/95 hover:bg-white text-slate-800 border border-slate-200/90 shadow-lg text-[11px] font-extrabold flex items-center gap-1 transition active:scale-95 cursor-pointer"
              title="Fokus & Pusatkan Rute Peta"
            >
              <LocateFixed className="w-3.5 h-3.5 text-teal-600" />
              <span className="hidden sm:inline">Pusatkan Peta</span>
            </button>

            {isFullScreenMap && (
              <>
                <button
                  type="button"
                  onClick={() => setShowBottomStripInFs((v) => !v)}
                  className="px-2.5 py-2 rounded-2xl bg-white/95 hover:bg-white text-slate-800 border border-slate-200/90 shadow-lg text-[11px] font-extrabold flex items-center gap-1 transition active:scale-95 cursor-pointer"
                  title="Tampilkan / Sembunyikan Daftar Rute Bawah"
                >
                  {showBottomStripInFs ? (
                    <>
                      <ChevronDown className="w-3.5 h-3.5 text-teal-600" />
                      <span className="hidden sm:inline">Sembunyikan Daftar</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="w-3.5 h-3.5 text-teal-600" />
                      <span className="hidden sm:inline">Daftar Toko ({bottomStripPoints.length})</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white shadow-lg flex items-center justify-center transition active:scale-95 cursor-pointer"
                  title="Tutup Live Maps"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Selected Store Floating Coordinate Card */}
          {selectedStore && (
            <div className="absolute bottom-14 left-3 right-3 sm:bottom-3 sm:left-auto sm:right-3 sm:w-80 z-20 bg-white/95 backdrop-blur-xl rounded-2xl p-3.5 shadow-xl border border-teal-200 animate-fadeIn">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-[10px] font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
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

        {/* Bottom Horizontal Route & Store Pinpoints Strip (Auto-Hidden in Fullscreen unless toggled) */}
        {(!isFullScreenMap || showBottomStripInFs) && (
          <div className="z-20 bg-white border-t border-slate-200/80 px-4 py-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-teal-600" />
                <span>
                  Rute &amp; Koordinat Toko ({displayedStorePoints.length} Titik Master Data)
                </span>
              </span>
              {scheduledStorePoints.length >= 2 && (
                <a
                  href={`https://www.google.com/maps/dir/${scheduledStorePoints
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

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {bottomStripPoints.length === 0 ? (
                <div className="text-xs text-slate-400 py-2">
                  Tidak ada titik toko yang cocok dengan pencarian.
                </div>
              ) : (
                bottomStripPoints.map((st, idx) => {
                  const isSelected = selectedStore?.code === st.code;
                  const isSched = scheduledByCodeMap.has(String(st.code).toUpperCase());

                  return (
                    <button
                      key={`${st.code}-${idx}`}
                      type="button"
                      onClick={() => handleFocusStore(st)}
                      className={`shrink-0 text-left p-2 rounded-2xl border transition-all cursor-pointer min-w-[205px] max-w-[225px] ${
                        isSelected
                          ? 'bg-teal-50/90 border-teal-500 shadow-xs'
                          : isSched
                          ? 'bg-emerald-50/50 hover:bg-white border-teal-200'
                          : 'bg-slate-50/80 hover:bg-white border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-4 h-4 rounded-full text-white text-[9px] font-black flex items-center justify-center shrink-0 ${
                              isSched ? 'bg-teal-600' : 'bg-slate-500'
                            }`}
                          >
                            {isSched ? st.routeOrder || idx + 1 : '•'}
                          </span>
                          <span className="text-[11px] font-black text-slate-800 truncate">
                            {st.name}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                          #{st.code}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 tabular-nums">
                        <span>{st.lat.toFixed(4)}°</span>
                        <span>•</span>
                        <span>{st.lng.toFixed(4)}°</span>
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
                            <span className="text-teal-700 font-bold truncate max-w-[85px]">
                              {st.agendaPic}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
