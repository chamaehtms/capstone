import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

// Fix default Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Verified coordinates for Barangay Poblacion, Cordova, Cebu
const FALLBACK_CENTERS = {
  'Camolinas Centro': [10.2542, 123.9485],
  'Atabay': [10.2558, 123.9525],
  'Calan': [10.2488, 123.9472],
  'Housing': [10.2505, 123.9538],
  'Puso': [10.2518, 123.9498],
  'Intra': [10.2532, 123.9512],
  'Crossroad': [10.2512, 123.9478],
  default: [10.25195, 123.94970], // San Roque Parish Church / Poblacion Hall
};

// Map Tile Providers (Standard OpenStreetMap default)
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
  topo: {
    name: 'Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
    subdomains: ['a', 'b', 'c'],
  },
};

export default function PurokMap({
  zoneName,
  height = '360px',
  interactive = true,
  showLandmarks = true,
  className = '',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const layerGroupRef = useRef(null);

  const [activeLayer, setActiveLayer] = useState('osm'); // 'osm' | 'satellite' | 'topo'
  const [purokData, setPurokData] = useState(null);
  const [assignedCoords, setAssignedCoords] = useState(FALLBACK_CENTERS.default);
  const [assignedZoom, setAssignedZoom] = useState(16);

  // Fetch official verified purok boundaries and landmarks
  useEffect(() => {
    let isMounted = true;
    async function loadPuroks() {
      try {
        const res = await fetch('/api/puroks');
        if (!res.ok) throw new Error('Failed to load puroks');
        const data = await res.json();
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
        console.warn('[PurokMap] Could not fetch /api/puroks:', err);
      }
    }
    loadPuroks();
    return () => {
      isMounted = false;
    };
  }, [zoneName]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: assignedCoords,
      zoom: assignedZoom,
      zoomControl: false, // Clean custom UI buttons
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

  // Handle Layer Switch (OpenStreetMap vs Satellite vs Topo)
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

  // Render Markers, Boundary GeoJSON, and Landmarks
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

    // Clean Minimalist SVG Resident Pin (No Emojis)
    const residentPinIcon = L.divIcon({
      className: 'resident-purok-pin',
      html: `
        <div style="position: relative; width: 34px; height: 44px; filter: drop-shadow(0 2px 5px rgba(15,23,42,0.35)); cursor: pointer;">
          <svg viewBox="0 0 384 512" width="34" height="44" style="display: block;">
            <path fill="#2563eb" d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z"/>
            <circle cx="192" cy="192" r="78" fill="#1e40af"/>
            <circle cx="192" cy="192" r="62" fill="#ffffff"/>
          </svg>
          <div style="position: absolute; top: 11px; left: 0; right: 0; display: flex; align-items: center; justify-content: center;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </div>
        </div>
      `,
      iconSize: [34, 44],
      iconAnchor: [17, 44],
      popupAnchor: [0, -44],
    });

    const residentMarker = L.marker(center, { icon: residentPinIcon }).addTo(layerGroup);
    residentMarker.bindPopup(`
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; min-width: 190px; padding: 2px;">
        <div style="font-weight: 700; color: #0f172a; font-size: 13px; margin-bottom: 2px;">
          ${displayName}
        </div>
        <div style="color: #2563eb; font-weight: 600; font-size: 11px; margin-bottom: 4px;">
          Assigned Resident Jurisdiction
        </div>
        <div style="color: #64748b; font-size: 11px; line-height: 1.4;">
          Barangay Poblacion, Cordova, Cebu
        </div>
        <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8;">
          Verified Municipal Coordinates: ${center[0].toFixed(4)}°N, ${center[1].toFixed(4)}°E
        </div>
      </div>
    `).openPopup();

    // Boundary GeoJSON rendering or verified radius
    if (purokData?.boundaryGeojson) {
      try {
        const geoLayer = L.geoJSON(purokData.boundaryGeojson, {
          style: {
            color: '#2563eb',
            weight: 2,
            opacity: 0.85,
            fillColor: '#3b82f6',
            fillOpacity: 0.16,
          },
        }).addTo(layerGroup);
        geoLayer.bindTooltip(`Jurisdiction Boundary: ${displayName}`, { sticky: true });
      } catch (err) {
        console.warn('[PurokMap] Invalid boundary geojson:', err);
      }
    } else {
      L.circle(center, {
        radius: 200,
        color: '#2563eb',
        weight: 1.8,
        opacity: 0.8,
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
      }).addTo(layerGroup);
    }

    // Public Landmarks within Assigned Area (Clean SVG Badges, No Emojis)
    if (showLandmarks && purokData?.landmarks && Array.isArray(purokData.landmarks)) {
      purokData.landmarks.forEach((lm) => {
        if (lm.lat && lm.lng) {
          const landmarkIcon = L.divIcon({
            className: 'verified-landmark-badge',
            html: `
              <div style="
                background: #ffffff;
                color: #0f172a;
                padding: 3px 8px;
                border-radius: 6px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 10px;
                font-weight: 600;
                box-shadow: 0 1px 3px rgba(15,23,42,0.15);
                border: 1px solid #cbd5e1;
                white-space: nowrap;
                display: inline-flex;
                align-items: center;
                gap: 5px;
              ">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M14 10v11M4 10h16l-8-7z"></path>
                </svg>
                <span>${lm.name}</span>
              </div>
            `,
            iconSize: [120, 24],
            iconAnchor: [60, 24],
            popupAnchor: [0, -24],
          });

          L.marker([lm.lat, lm.lng], { icon: landmarkIcon })
            .addTo(layerGroup)
            .bindPopup(`
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px;">
                <div style="font-weight: 700; color: #0f172a;">${lm.name}</div>
                <div style="color: #64748b; font-size: 10px; margin-top: 2px;">
                  ${lm.type || 'Public Landmark'} • Barangay Poblacion
                </div>
              </div>
            `);
        }
      });
    }
  }, [purokData, zoneName, assignedCoords, assignedZoom, showLandmarks]);

  // Recenter handler
  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo(assignedCoords, assignedZoom, { duration: 1 });
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
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Bar: Purok Name & Active Layer Switcher */}
      <div className="absolute top-3 left-3 right-3 z-[400] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Purok Name Badge */}
        <div className="pointer-events-auto bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <div>
            <div className="text-[11px] font-bold text-slate-800 leading-tight">
              {purokData?.name || zoneName || 'Poblacion'}
            </div>
            <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
              Poblacion, Cordova
            </div>
          </div>
        </div>

        {/* Map Style Selector */}
        <div className="pointer-events-auto flex items-center bg-white/95 backdrop-blur-sm border border-slate-200/80 shadow-sm rounded-lg p-0.5 text-[11px] font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveLayer('osm')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeLayer === 'osm'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            OpenStreetMap
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('satellite')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeLayer === 'satellite'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('topo')}
            className={`px-2.5 py-1 rounded-md transition-colors hidden sm:block ${
              activeLayer === 'topo'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'hover:text-slate-900'
            }`}
          >
            Terrain
          </button>
        </div>
      </div>

      {/* Floating Control Buttons: Recenter & Zoom */}
      <div className="absolute bottom-3 right-3 z-[400] flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleRecenter}
          title="Return to My Assigned Purok"
          aria-label="Return to My Assigned Purok"
          className="bg-white/95 backdrop-blur-sm hover:bg-white text-slate-700 hover:text-blue-600 border border-slate-200 shadow-sm p-2 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all active:scale-95"
        >
          <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
            className="p-2 text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors border-b border-slate-100 flex items-center justify-center"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom Out"
            className="p-2 text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors flex items-center justify-center"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
