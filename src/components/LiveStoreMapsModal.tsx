import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  },
  street: {
    label: 'Peta Jalan',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    maxZoom: 19,
  },
  satellite: {
    label: 'Satelit',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri Imagery',
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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const canvasRendererRef = useRef<any>(null);
  const vectorLayerGroupRef = useRef<any>(null);
  const labelLayerGroupRef = useRef<any>(null);
  const lastFitSignatureRef = useRef<string>('');

  const [leafletReady, setLeafletReady] = useState(false);
  const [tileStyle, setTileStyle] = useState<MapTileStyle>('osm');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState<StoreGeoPoint | null>(null);

  // Direct 100% Fullscreen HUD Drawer States
  const [showFloatingControls, setShowFloatingControls] = useState<boolean>(false);
  const [showBottomStrip, setShowBottomStrip] = useState<boolean>(false);

  // Filter Scope: 'all' (610 master stores + route) vs 'scheduled' (route only)
  const [viewMode, setViewMode] = useState<'all' | 'scheduled'>('all');

  // Admin-specific controls
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

  // Lookup map of scheduled store codes
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

  // 2. ALL 610 Master Store GeoPoints
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

  // Bottom drawer strip list
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

  // 3. Admin User Pinpoints (HANYA USER YANG BENAR TERDETEKSI GPS AKTUAL / SUDAH AKSES WEB)
  const adminUserPinpoints = useMemo(() => {
    if (!isAdmin) return [];
    const targetRef =
      scheduledStorePoints.length > 0 ? scheduledStorePoints : allMasterGeoPoints.slice(0, 30);
    const allPoints = buildAdminUserPinpoints(users, targetRef, radiusMeters, agendas, currentUser);
    if (selectedPicFilter === 'ALL') return allPoints;
    return allPoints.filter((u) => isSamePersonName(u.userName, selectedPicFilter));
  }, [isAdmin, users, scheduledStorePoints, allMasterGeoPoints, radiusMeters, selectedPicFilter, agendas, currentUser]);

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

  // Viewport-Culled Idle Labels Updater (Runs ONLY when map finishes moving/zooming, Max 22 lightweight labels)
  const updateViewportLabels = useCallback(() => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    const labelGroup = labelLayerGroupRef.current;
    if (!L || !map || !labelGroup) return;

    labelGroup.clearLayers();
    const zoom = map.getZoom();
    // Hide all text labels when zoomed out (< 12) so panning/zooming wide areas has zero DOM clutter
    if (zoom < 12) return;

    const bounds = map.getBounds();
    let count = 0;
    const MAX_LABELS = 22;

    // 1. Prioritize scheduled route stores visible in current viewport
    if (!isAdmin || showStorePinpoints) {
      for (let i = 0; i < scheduledStorePoints.length; i++) {
        if (count >= MAX_LABELS) break;
        const st = scheduledStorePoints[i];
        if (bounds.contains([st.lat, st.lng])) {
          const shortName = getMinimalistStoreLabel(st.name);
          const icon = L.divIcon({
            className: 'fmcu-fast-label',
            html: `<div style="transform:translate(-50%,8px);pointer-events:none;background:#0F172A;color:#fff;font-size:8.5px;font-weight:800;padding:1px 4px;border-radius:4px;white-space:nowrap;line-height:1.2;">#${st.routeOrder || ''} ${shortName}</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });
          L.marker([st.lat, st.lng], { icon, interactive: false, keyboard: false }).addTo(
            labelGroup
          );
          count++;
        }
      }

      // 2. If zoomed in closely (zoom >= 14), also show regular store labels in viewport up to MAX_LABELS
      if (zoom >= 14 && count < MAX_LABELS) {
        for (let i = 0; i < displayedStorePoints.length; i++) {
          if (count >= MAX_LABELS) break;
          const st = displayedStorePoints[i];
          if (scheduledByCodeMap.has(String(st.code).toUpperCase())) continue;
          if (bounds.contains([st.lat, st.lng])) {
            const shortName = getMinimalistStoreLabel(st.name);
            const icon = L.divIcon({
              className: 'fmcu-fast-label',
              html: `<div style="transform:translate(-50%,7px);pointer-events:none;background:rgba(255,255,255,0.94);color:#0F172A;border:1px solid #CBD5E1;font-size:8px;font-weight:800;padding:0.5px 3.5px;border-radius:3px;white-space:nowrap;line-height:1.15;">${shortName}</div>`,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            });
            L.marker([st.lat, st.lng], { icon, interactive: false, keyboard: false }).addTo(
              labelGroup
            );
            count++;
          }
        }
      }
    }
  }, [isAdmin, showStorePinpoints, scheduledStorePoints, displayedStorePoints, scheduledByCodeMap]);

  // Initialize Map Instance with Hardware-Accelerated HTML5 Canvas Renderer
  useEffect(() => {
    if (!isOpen || !leafletReady || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (!mapInstanceRef.current) {
      const defaultCenter: [number, number] =
        scheduledStorePoints.length > 0
          ? [scheduledStorePoints[0].lat, scheduledStorePoints[0].lng]
          : [-6.2297, 106.8295];

      const canvasRenderer = L.canvas({ padding: 0.5 });
      canvasRendererRef.current = canvasRenderer;

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 11,
        zoomControl: false,
        preferCanvas: true,
        renderer: canvasRenderer,
        fadeAnimation: false,
        markerZoomAnimation: false,
        zoomAnimation: true,
        wheelPxPerZoomLevel: 90,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const provider = MAP_TILE_PROVIDERS[tileStyle];
      const tl = L.tileLayer(provider.url, {
        attribution: provider.attribution,
        maxZoom: provider.maxZoom,
        updateWhenIdle: false,
        updateWhenZooming: false,
        keepBuffer: 3,
      }).addTo(map);

      tl.on('tileerror', () => {
        if (tileStyle === 'osm' && tileLayerRef.current) {
          tileLayerRef.current.setUrl(MAP_TILE_PROVIDERS.street.url);
        }
      });

      tileLayerRef.current = tl;
      vectorLayerGroupRef.current = L.layerGroup().addTo(map);
      labelLayerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      // Clear DOM labels during active zoom so pinch/wheel zoom is 100% pure Canvas (60fps)
      map.on('zoomstart', () => {
        labelLayerGroupRef.current?.clearLayers();
      });

      setTimeout(() => {
        map.invalidateSize();
      }, 60);
    }
  }, [isOpen, leafletReady]);

  // Bind moveend / zoomend listener for viewport-culled labels
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleIdle = () => {
      updateViewportLabels();
    };

    map.on('moveend', handleIdle);
    map.on('zoomend', handleIdle);
    updateViewportLabels();

    return () => {
      map.off('moveend', handleIdle);
      map.off('zoomend', handleIdle);
    };
  }, [updateViewportLabels]);

  // Switch Tile Style seamlessly
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const provider = MAP_TILE_PROVIDERS[tileStyle];
    tileLayerRef.current.setUrl(provider.url);
  }, [tileStyle]);

  // Render All 610 Store Pinpoints, Routes, Geofences & User Pinpoints onto the single GPU <canvas>
  useEffect(() => {
    if (
      !isOpen ||
      !leafletReady ||
      !mapInstanceRef.current ||
      !vectorLayerGroupRef.current ||
      !canvasRendererRef.current
    ) {
      return;
    }
    const L = (window as any).L;
    if (!L) return;

    const map = mapInstanceRef.current;
    const vectorGroup = vectorLayerGroupRef.current;
    const renderer = canvasRendererRef.current;
    vectorGroup.clearLayers();

    const focusBoundsCoords: [number, number][] = [];

    // A. ADMIN ONLY: RADIUS GEOFENCE CIRCLES (Canvas-rendered)
    if (isAdmin && showRadiusCircle && showStorePinpoints) {
      const radiusTargets =
        scheduledStorePoints.length > 0
          ? scheduledStorePoints
          : displayedStorePoints.slice(0, 25);

      radiusTargets.forEach((st) => {
        L.circle([st.lat, st.lng], {
          renderer,
          radius: radiusMeters,
          color: '#0D9488',
          weight: 1.5,
          opacity: 0.7,
          fillColor: '#14B8A6',
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(vectorGroup);
      });
    }

    // B. ROUTE LINES (Canvas-rendered)
    const shouldDrawRoute = (!isAdmin || showRouteLine) && scheduledStorePoints.length >= 2;
    if (shouldDrawRoute) {
      const routeLatLngs: [number, number][] = scheduledStorePoints.map((p) => [p.lat, p.lng]);

      L.polyline(routeLatLngs, {
        renderer,
        color: '#0F766E',
        weight: 5,
        opacity: 0.2,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(vectorGroup);

      L.polyline(routeLatLngs, {
        renderer,
        color: '#0D9488',
        weight: 2.8,
        opacity: 0.92,
        dashArray: '7, 5',
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }).addTo(vectorGroup);
    }

    // Admin route from User Pinpoint to Target Store
    if (isAdmin && showRouteLine && showUserPinpoints) {
      adminUserPinpoints.forEach((up) => {
        const targetStore =
          scheduledStorePoints.find((s) => s.code === up.targetStoreCode) ||
          displayedStorePoints.find((s) => s.code === up.targetStoreCode);
        if (targetStore && up.distanceToStoreMeters < 50000) {
          L.polyline(
            [
              [up.lat, up.lng],
              [targetStore.lat, targetStore.lng],
            ],
            {
              renderer,
              color: up.isInsideRadius ? '#10B981' : '#3B82F6',
              weight: 2,
              opacity: 0.8,
              dashArray: '4, 4',
              interactive: false,
            }
          ).addTo(vectorGroup);
        }
      });
    }

    // C. STORE PINPOINTS ON SINGLE HTML5 CANVAS (Zero DOM Lag for all 610 Stores!)
    if (!isAdmin || showStorePinpoints) {
      // First pass: regular unscheduled master stores
      displayedStorePoints.forEach((st) => {
        const schedInfo = scheduledByCodeMap.get(String(st.code).toUpperCase());
        if (schedInfo) return;

        if (searchQuery.trim()) {
          focusBoundsCoords.push([st.lat, st.lng]);
        }

        const dot = L.circleMarker([st.lat, st.lng], {
          renderer,
          radius: 5.5,
          fillColor: '#0D9488',
          fillOpacity: 0.9,
          color: '#FFFFFF',
          weight: 1.8,
        }).addTo(vectorGroup);

        dot.on('click', () => {
          setSelectedStore(st);
        });
      });

      // Second pass: scheduled stores drawn on top with outer halo ring
      displayedStorePoints.forEach((st) => {
        const schedInfo = scheduledByCodeMap.get(String(st.code).toUpperCase());
        if (!schedInfo) return;

        focusBoundsCoords.push([st.lat, st.lng]);

        // Outer subtle pulse ring on canvas
        L.circleMarker([st.lat, st.lng], {
          renderer,
          radius: 11,
          fillColor: '#10B981',
          fillOpacity: 0.24,
          weight: 0,
          interactive: false,
        }).addTo(vectorGroup);

        // Crisp inner scheduled pin on canvas
        const schedMarker = L.circleMarker([st.lat, st.lng], {
          renderer,
          radius: 7.5,
          fillColor: '#059669',
          fillOpacity: 1,
          color: '#FFFFFF',
          weight: 2.4,
        }).addTo(vectorGroup);

        schedMarker.on('click', () => {
          setSelectedStore(schedInfo);
        });
      });
    }

    // D. ADMIN USER PINPOINTS ON CANVAS
    if (isAdmin && showUserPinpoints) {
      adminUserPinpoints.forEach((up) => {
        focusBoundsCoords.push([up.lat, up.lng]);

        L.circleMarker([up.lat, up.lng], {
          renderer,
          radius: 12,
          fillColor: '#3B82F6',
          fillOpacity: 0.22,
          weight: 0,
          interactive: false,
        }).addTo(vectorGroup);

        const uCircle = L.circleMarker([up.lat, up.lng], {
          renderer,
          radius: 7.5,
          fillColor: '#2563EB',
          fillOpacity: 1,
          color: '#FFFFFF',
          weight: 2.4,
        }).addTo(vectorGroup);

        uCircle.on('click', () => {
          L.popup({ closeButton: true, autoPan: true })
            .setLatLng([up.lat, up.lng])
            .setContent(
              `<div style="font-family:system-ui,-apple-system,sans-serif;min-width:215px;padding:3px;">
                <div style="display:flex;align-items:center;gap:5px;font-size:9.5px;font-weight:800;color:#059669;text-transform:uppercase;">
                  <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#10B981;box-shadow:0 0 6px #10B981;"></span>
                  LIVE GPS TERVERIFIKASI
                </div>
                <div style="font-size:13px;font-weight:900;color:#0F172A;margin-top:2px;">${up.userName}</div>
                <div style="font-size:10px;color:#64748B;margin-bottom:6px;">${up.role}</div>
                <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:6px;font-size:10.5px;line-height:1.45;">
                  <div><strong>Tujuan:</strong> ${up.targetStoreName} (#${up.targetStoreCode})</div>
                  <div><strong>Jarak Aktual:</strong> ${
                    up.distanceToStoreMeters >= 1000
                      ? (up.distanceToStoreMeters / 1000).toFixed(1) + ' km'
                      : up.distanceToStoreMeters + ' m'
                  } (${up.isInsideRadius ? '✅ Dalam Radius' : '🚗 Menuju Lokasi'})</div>
                  <div><strong>Sumber GPS:</strong> ${
                    up.gpsSource === 'LIVE_DEVICE'
                      ? 'Perangkat Aktif (Realtime)'
                      : up.gpsSource === 'ATTENDANCE_CHECKIN'
                      ? 'Audit Kehadiran Toko'
                      : 'Laporan Visit Lapangan'
                  }</div>
                  ${up.capturedAt ? `<div><strong>Waktu:</strong> ${up.capturedAt}</div>` : ''}
                  <div style="font-size:9.5px;color:#64748B;margin-top:2px;"><strong>Koordinat:</strong> ${up.lat.toFixed(5)}°, ${up.lng.toFixed(5)}°</div>
                </div>
              </div>`
            )
            .openOn(map);
        });
      });
    }

    // Only auto-fit bounds when filter scope / search / PIC changes (not on minor layer toggles)
    const fitSignature = `${viewMode}|${selectedPicFilter}|${searchQuery.trim()}`;
    if (focusBoundsCoords.length > 0 && lastFitSignatureRef.current !== fitSignature) {
      lastFitSignatureRef.current = fitSignature;
      try {
        const bounds = L.latLngBounds(focusBoundsCoords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: false });
      } catch {
        // ignore bounds error
      }
    }

    updateViewportLabels();
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
    selectedPicFilter,
    searchQuery,
    updateViewportLabels,
  ]);

  // Cleanup map instance when modal closes
  useEffect(() => {
    if (!isOpen && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      canvasRendererRef.current = null;
      vectorLayerGroupRef.current = null;
      labelLayerGroupRef.current = null;
      lastFitSignatureRef.current = '';
      setShowFloatingControls(false);
      setShowBottomStrip(false);
      setSelectedStore(null);
    }
  }, [isOpen]);

  // Sync Leaflet canvas size when bottom strip drawer toggles
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [showBottomStrip]);

  const handleFitAllBounds = () => {
    if (!mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;
    const targetPoints =
      scheduledStorePoints.length > 0 ? scheduledStorePoints : displayedStorePoints;
    if (targetPoints.length > 0) {
      try {
        const bounds = L.latLngBounds(targetPoints.map((p) => [p.lat, p.lng]));
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      } catch {
        // ignore
      }
    }
  };

  const handleFocusStore = (st: StoreGeoPoint) => {
    setSelectedStore(st);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([st.lat, st.lng], 16, { animate: true });
    }
  };

  if (!isOpen) return null;

  const uniquePics = Array.from(new Set(agendas.map((a) => a.pic).filter(Boolean))).sort();

  return (
    <div className="fixed inset-0 z-[9999] w-screen h-[100dvh] bg-slate-900 flex flex-col overflow-hidden select-none">
      {/* 100% Fullscreen Edge-to-Edge Map Canvas */}
      <div className="relative flex-1 w-full h-full bg-slate-200 overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* TOP BAR HUD: Floating Stats, Tile Switcher, Filter Drawer Toggle & Close Button */}
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between gap-2 pointer-events-none">
          {/* Left Group: Live Counter + Tile Switcher + Filter Button */}
          <div className="flex items-center gap-1.5 pointer-events-auto shrink min-w-0">
            {/* Brand & Counter Pill */}
            <div className="bg-white px-2.5 sm:px-3 py-2 rounded-2xl shadow-lg border border-slate-200/90 flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="w-6 h-6 rounded-lg bg-[#76C88D] text-white flex items-center justify-center shrink-0">
                <Compass className="w-3.5 h-3.5" />
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-[11px] font-extrabold text-slate-900 whitespace-nowrap">
                {displayedStorePoints.length} Toko
              </span>
              {scheduledStorePoints.length > 0 && (
                <>
                  <span className="text-slate-300 hidden sm:inline">•</span>
                  <span className="hidden sm:flex text-[11px] font-extrabold text-teal-700 items-center gap-1 whitespace-nowrap">
                    <Route className="w-3 h-3" />
                    {scheduledStorePoints.length} Rute ({totalRouteKm} km)
                  </span>
                </>
              )}
            </div>

            {/* Map Tile Switcher Pill (Desktop only inline, Mobile inside drawer) */}
            <div className="hidden md:flex bg-white p-1 rounded-2xl shadow-lg border border-slate-200/90 items-center gap-1 shrink-0">
              {(['osm', 'street', 'satellite'] as MapTileStyle[]).map((styleKey) => (
                <button
                  key={styleKey}
                  type="button"
                  onClick={() => setTileStyle(styleKey)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold transition cursor-pointer ${
                    tileStyle === styleKey
                      ? 'bg-[#3A657C] text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {MAP_TILE_PROVIDERS[styleKey].label}
                </button>
              ))}
            </div>

            {/* Filter & Search Drawer Toggle */}
            <button
              type="button"
              onClick={() => setShowFloatingControls((v) => !v)}
              className={`px-2.5 sm:px-3 py-2 rounded-2xl shadow-lg border text-[11px] font-extrabold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                showFloatingControls
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-800 border-slate-200/90 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#76C88D]" />
              <span>Filter &amp; Cari</span>
            </button>
          </div>

          {/* Right Group: Direct Close Fullscreen Map Button */}
          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto h-10 px-3.5 rounded-2xl bg-slate-900 hover:bg-rose-600 text-white shadow-lg flex items-center gap-1.5 text-xs font-extrabold transition active:scale-95 cursor-pointer shrink-0"
            title="Tutup Live Maps"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Tutup Peta</span>
          </button>
        </div>

        {/* FLOATING FILTER & SEARCH DRAWER (WITH BACKDROP ON MOBILE) */}
        {showFloatingControls && (
          <>
            {/* Backdrop on mobile so tapping outside on the map closes the drawer immediately */}
            <div
              className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] sm:hidden"
              onClick={() => setShowFloatingControls(false)}
            />

            {/* Drawer Container: Bottom Sheet on Mobile, Floating Panel on Desktop */}
            <div className="fixed inset-x-0 bottom-0 max-h-[82vh] z-50 bg-white rounded-t-[32px] p-5 shadow-2xl overflow-y-auto no-scrollbar sm:fixed-none sm:absolute sm:top-16 sm:left-3 sm:bottom-auto sm:inset-x-auto sm:w-[380px] sm:rounded-3xl sm:p-4 border border-slate-200 space-y-3 animate-in slide-in-from-bottom sm:slide-in-from-top-2 duration-200">
              {/* Header Drawer with Drag handle & Close */}
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-4 rounded-full bg-[#76C88D]" />
                  <h4 className="text-xs sm:text-sm font-black text-slate-900">
                    Filter &amp; Pencarian Toko
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFloatingControls(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
                  title="Tutup Filter"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Map Tile Switcher on Mobile inside drawer */}
              <div className="md:hidden flex items-center justify-between bg-slate-100 p-1 rounded-2xl">
                <span className="text-[10px] font-extrabold text-slate-500 pl-2">Mode Peta:</span>
                <div className="flex items-center gap-1">
                  {(['osm', 'street', 'satellite'] as MapTileStyle[]).map((styleKey) => (
                    <button
                      key={styleKey}
                      type="button"
                      onClick={() => setTileStyle(styleKey)}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold transition cursor-pointer ${
                        tileStyle === styleKey
                          ? 'bg-[#3A657C] text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {MAP_TILE_PROVIDERS[styleKey].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari dari 610 toko (kode / nama / kota)..."
                  className="w-full pl-8 pr-7 py-2.5 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#3A657C]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setViewMode('all')}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-extrabold flex items-center justify-center gap-1.5 border cursor-pointer ${
                    viewMode === 'all'
                      ? 'bg-[#3A657C] text-white border-[#3A657C]'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Semua Toko ({allMasterStores.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('scheduled')}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-extrabold flex items-center justify-center gap-1.5 border cursor-pointer ${
                    viewMode === 'scheduled'
                      ? 'bg-[#3A657C] text-white border-[#3A657C]'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <Route className="w-3.5 h-3.5" />
                  <span>Rute Jadwal ({scheduledStorePoints.length})</span>
                </button>
              </div>

              {isAdmin && (
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <select
                    value={selectedPicFilter}
                    onChange={(e) => setSelectedPicFilter(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="ALL">Semua Personel ({uniquePics.length})</option>
                    {uniquePics.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowUserPinpoints((v) => !v)}
                      className={`py-2 rounded-xl text-[10px] font-extrabold border cursor-pointer transition ${
                        showUserPinpoints
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      User ({adminUserPinpoints.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowStorePinpoints((v) => !v)}
                      className={`py-2 rounded-xl text-[10px] font-extrabold border cursor-pointer transition ${
                        showStorePinpoints
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Toko
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRadiusCircle((v) => !v)}
                      className={`py-2 rounded-xl text-[10px] font-extrabold border cursor-pointer transition ${
                        showRadiusCircle
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Radius
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRouteLine((v) => !v)}
                      className={`py-2 rounded-xl text-[10px] font-extrabold border cursor-pointer transition ${
                        showRouteLine
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Rute
                    </button>
                  </div>

                  {showRadiusCircle && (
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Radio className="w-3 h-3 text-emerald-600" />
                        Radius Geofence Toko:
                      </span>
                      <select
                        value={radiusMeters}
                        onChange={(e) => setRadiusMeters(Number(e.target.value))}
                        className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-extrabold text-slate-800 cursor-pointer"
                      >
                        <option value={150}>150 Meter</option>
                        <option value={250}>250 Meter</option>
                        <option value={500}>500 Meter</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Apply & Close Button on Mobile */}
              <button
                type="button"
                onClick={() => setShowFloatingControls(false)}
                className="w-full sm:hidden py-3 rounded-2xl bg-[#3A657C] hover:bg-slate-900 text-white font-extrabold text-xs shadow-md transition cursor-pointer"
              >
                Terapkan &amp; Lihat Peta ({displayedStorePoints.length} Toko)
              </button>
            </div>
          </>
        )}

        {/* BOTTOM-LEFT FLOATING DOCK: Pusatkan Peta & Toggle Daftar Rute Toko */}
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleFitAllBounds}
            className="px-3 py-2 rounded-2xl bg-white hover:bg-slate-50 text-slate-900 border border-slate-200/90 shadow-lg text-[11px] font-extrabold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="Pusatkan Rute Peta"
          >
            <LocateFixed className="w-3.5 h-3.5 text-[#3A657C]" />
            <span>Pusatkan Peta</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBottomStrip((v) => !v)}
            className={`px-3 py-2 rounded-2xl border shadow-lg text-[11px] font-extrabold flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
              showBottomStrip
                ? 'bg-[#3A657C] text-white border-[#3A657C]'
                : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200/90'
            }`}
            title="Tampilkan / Sembunyikan Daftar Rute Toko"
          >
            {showBottomStrip ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Tutup Daftar</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-[#76C88D]" />
                <span>Daftar Toko ({bottomStripPoints.length})</span>
              </>
            )}
          </button>
        </div>

        {/* SELECTED STORE FLOATING DETAIL CARD */}
        {selectedStore && (
          <div className="absolute bottom-14 left-3 right-3 sm:bottom-3 sm:left-auto sm:right-14 sm:w-80 z-20 bg-white rounded-3xl p-4 shadow-2xl border border-slate-200">
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
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2 rounded-2xl border border-slate-200/70 mb-2.5 text-center">
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

            {selectedStore.agendaPic && (
              <div className="text-[10px] text-slate-600 font-semibold mb-2 bg-emerald-50/70 px-2.5 py-1 rounded-xl border border-emerald-200/70">
                Jadwal: <strong className="text-emerald-800">{selectedStore.agendaPic}</strong> (
                {selectedStore.agendaDate || ''} {selectedStore.agendaTime || ''})
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] text-slate-500 truncate">
                SH: <strong className="text-slate-700">{selectedStore.storeHead}</strong>
              </div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedStore.lat},${selectedStore.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-[#3A657C] hover:bg-slate-900 text-white text-[10px] font-extrabold flex items-center gap-1 shadow-xs shrink-0"
              >
                <Navigation className="w-3 h-3" />
                <span>Rute Google Maps</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* OPTIONAL COLLAPSIBLE BOTTOM STRIP DRAWER */}
      {showBottomStrip && (
        <div className="z-20 bg-white border-t border-slate-200 px-4 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#3A657C]" />
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
                    className={`shrink-0 text-left p-2 rounded-2xl border transition cursor-pointer min-w-[205px] max-w-[225px] ${
                      isSelected
                        ? 'bg-teal-50 border-teal-500'
                        : isSched
                        ? 'bg-emerald-50/50 hover:bg-slate-50 border-teal-200'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80'
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
  );
};
