import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import api from '../api';

// Fix default Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const FALLBACK_CENTERS = {
  'Camolinas Centro': [10.2542, 123.9485],
  'Atabay': [10.2558, 123.9525],
  'Calan': [10.2488, 123.9472],
  'Housing': [10.2505, 123.9538],
  'Puso': [10.2518, 123.9498],
  'Intra': [10.2532, 123.9512],
  'Crossroad': [10.2512, 123.9478],
  default: [10.25195, 123.94970],
};

const MAP_TILE_PROVIDERS = {
  osm: {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18,
    subdomains: [],
  },
};

export default function AdminPurokMap({
  zoneName,
  residentName = 'Resident',
  height = '300px',
  interactive = true,
  showLandmarks = true,
  className = '',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const layerGroupRef = useRef(null);

  const [activeLayer, setActiveLayer] = useState('osm');
  const [purokData, setPurokData] = useState(null);
  const [assignedCoords, setAssignedCoords] = useState(FALLBACK_CENTERS.default);
  const [assignedZoom, setAssignedZoom] = useState(16);

  useEffect(() => {
    let isMounted = true;
    async function fetchPurok() {
      try {
        const res = await api.get('/puroks');
        const data = res.data || [];
        if (isMounted) {
          const found = data.find(
            (p) =>
              p.name.toLowerCase().trim() === String(zoneName || '').toLowerCase().trim() ||
              String(zoneName || '').toLowerCase().includes(p.name.toLowerCase())
          );
          if (found) {
            setPurokData(found);
            setAssignedCoords([found.centerLat, found.centerLng]);
            setAssignedZoom(found.zoomLevel || 16);
          } else if (zoneName && FALLBACK_CENTERS[zoneName]) {
            setAssignedCoords(FALLBACK_CENTERS[zoneName]);
            setAssignedZoom(16);
          }
        }
      } catch (err) {
        console.warn('[AdminPurokMap] Could not fetch /api/puroks:', err);
      }
    }
    fetchPurok();
    return () => {
      isMounted = false;
    };
  }, [zoneName]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: assignedCoords,
      zoom: assignedZoom,
      zoomControl: false,
      dragging: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    const conf = MAP_TILE_PROVIDERS[activeLayer];
    const initialTile = L.tileLayer(conf.url, {
      attribution: conf.attribution,
      maxZoom: conf.maxZoom,
      subdomains: conf.subdomains || [],
    }).addTo(map);

    tileLayerRef.current = initialTile;

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = layerGroup;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [interactive]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const conf = MAP_TILE_PROVIDERS[activeLayer];
    const newLayer = L.tileLayer(conf.url, {
      attribution: conf.attribution,
      maxZoom: conf.maxZoom,
      subdomains: conf.subdomains || [],
    }).addTo(map);

    tileLayerRef.current = newLayer;
  }, [activeLayer]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    let center = assignedCoords;
    let zoom = assignedZoom;
    let displayName = zoneName || 'Barangay Poblacion';

    if (purokData) {
      center = [purokData.centerLat, purokData.centerLng];
      zoom = purokData.zoomLevel || 16;
      displayName = purokData.name;
    } else if (zoneName && FALLBACK_CENTERS[zoneName]) {
      center = FALLBACK_CENTERS[zoneName];
    }

    map.setView(center, zoom, { animate: true });

    // Clean Minimalist SVG Admin Resident Pin (No Emojis)
    const adminPinIcon = L.divIcon({
      className: 'admin-resident-pin',
      html: `
        <div style="position: relative; width: 32px; height: 42px; filter: drop-shadow(0 2px 5px rgba(15,23,42,0.35)); cursor: pointer;">
          <svg viewBox="0 0 384 512" width="32" height="42" style="display: block;">
            <path fill="#059669" d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z"/>
            <circle cx="192" cy="192" r="76" fill="#047857"/>
            <circle cx="192" cy="192" r="60" fill="#ffffff"/>
          </svg>
          <div style="position: absolute; top: 10px; left: 0; right: 0; display: flex; align-items: center; justify-content: center;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
        </div>
      `,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -42],
    });

    const residentMarker = L.marker(center, { icon: adminPinIcon }).addTo(layerGroup);
    residentMarker.bindPopup(`
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; min-width: 180px; padding: 2px;">
        <strong style="color: #0f172a; font-size: 13px; display: block; margin-bottom: 2px;">${residentName}</strong>
        <span style="color: #059669; font-weight: 600; font-size: 11px;">Jurisdiction: ${displayName}</span>
        <p style="margin: 4px 0 0; color: #64748b; font-size: 11px;">Barangay Poblacion, Cordova</p>
        <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8;">
          Verified Coordinates: ${center[0].toFixed(4)}°N, ${center[1].toFixed(4)}°E
        </div>
      </div>
    `).openPopup();

    // Boundary Polygon
    if (purokData?.boundaryGeojson) {
      try {
        const geoLayer = L.geoJSON(purokData.boundaryGeojson, {
          style: {
            color: '#059669',
            weight: 2,
            opacity: 0.85,
            fillColor: '#10b981',
            fillOpacity: 0.16,
          },
        }).addTo(layerGroup);
        geoLayer.bindTooltip(`Jurisdiction: ${displayName}`, { sticky: true });
      } catch (e) {
        console.warn('[AdminPurokMap] Boundary render error:', e);
      }
    } else {
      L.circle(center, {
        radius: 200,
        color: '#059669',
        weight: 1.8,
        opacity: 0.8,
        fillColor: '#10b981',
        fillOpacity: 0.12,
      }).addTo(layerGroup);
    }

    // Public Landmarks
    if (showLandmarks && purokData?.landmarks && Array.isArray(purokData.landmarks)) {
      purokData.landmarks.forEach((lm) => {
        if (lm.lat && lm.lng) {
          const landmarkIcon = L.divIcon({
            className: 'admin-landmark-badge',
            html: `
              <div style="
                background: #ffffff;
                color: #0f172a;
                padding: 2px 7px;
                border-radius: 6px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 9px;
                font-weight: 600;
                box-shadow: 0 1px 3px rgba(15,23,42,0.15);
                border: 1px solid #cbd5e1;
                white-space: nowrap;
                display: inline-flex;
                align-items: center;
                gap: 4px;
              ">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M14 10v11M4 10h16l-8-7z"></path>
                </svg>
                <span>${lm.name}</span>
              </div>
            `,
            iconSize: [110, 22],
            iconAnchor: [55, 22],
            popupAnchor: [0, -22],
          });

          L.marker([lm.lat, lm.lng], { icon: landmarkIcon })
            .addTo(layerGroup)
            .bindPopup(`
              <div style="font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <strong style="color: #0f172a;">${lm.name}</strong>
                <div style="color: #64748b; font-size: 10px;">${lm.type || 'Barangay Landmark'}</div>
              </div>
            `);
        }
      });
    }
  }, [purokData, zoneName, assignedCoords, assignedZoom, residentName, showLandmarks]);

  const handleRecenter = () => {
    mapInstanceRef.current?.flyTo(assignedCoords, assignedZoom, { duration: 1 });
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${className}`}
      style={{ height }}
    >
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Bar: Purok Name & Layer Switcher */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-[400] flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto bg-white/95 backdrop-blur-sm border border-slate-200 shadow-sm rounded-lg px-2.5 py-1 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <div className="text-[11px] font-bold text-slate-800 leading-none">
            {purokData?.name || zoneName || 'Poblacion'}
          </div>
        </div>

        <div className="pointer-events-auto flex items-center bg-white/95 backdrop-blur-sm border border-slate-200 shadow-sm rounded-md p-0.5 text-[10px] font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveLayer('osm')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeLayer === 'osm'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            OSM
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('satellite')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeLayer === 'satellite'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Satellite
          </button>
        </div>
      </div>

      {/* Recenter & Zoom Controls */}
      <div className="absolute bottom-2.5 right-2.5 z-[400] flex flex-col gap-1">
        <button
          type="button"
          onClick={handleRecenter}
          title="Recenter on Assigned Zone"
          aria-label="Recenter on Assigned Zone"
          className="bg-white/95 backdrop-blur-sm hover:bg-white text-slate-700 hover:text-emerald-600 border border-slate-200 shadow-sm p-1.5 rounded-lg flex items-center gap-1 text-[11px] font-semibold transition-all active:scale-95"
        >
          <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="22" y1="12" x2="18" y2="12"></line>
            <line x1="6" y1="12" x2="2" y2="12"></line>
            <line x1="12" y1="6" x2="12" y2="2"></line>
            <line x1="12" y1="22" x2="12" y2="18"></line>
          </svg>
          <span className="hidden sm:inline">Recenter</span>
        </button>

        <div className="flex flex-col bg-white/95 backdrop-blur-sm border border-slate-200 shadow-sm rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            aria-label="Zoom In"
            className="p-1.5 text-slate-700 hover:text-emerald-600 hover:bg-slate-50 transition-colors border-b border-slate-100 flex items-center justify-center"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom Out"
            className="p-1.5 text-slate-700 hover:text-emerald-600 hover:bg-slate-50 transition-colors flex items-center justify-center"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
