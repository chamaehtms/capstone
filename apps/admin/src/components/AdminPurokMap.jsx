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

const GOOGLE_TILE_LAYERS = {
  roadmap: {
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    name: 'Map',
    maxZoom: 20,
    attribution: 'Map data © Google',
  },
  satellite: {
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', // Hybrid satellite + roads/labels
    subdomains: ['0', '1', '2', '3'],
    name: 'Satellite',
    maxZoom: 20,
    attribution: 'Imagery © Google',
  },
  terrain: {
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    name: 'Terrain',
    maxZoom: 20,
    attribution: 'Map data © Google',
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

  const [mapType, setMapType] = useState('roadmap');
  const [purokData, setPurokData] = useState(null);

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
          setPurokData(found || null);
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

    const defaultCenter = FALLBACK_CENTERS.default;
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 16,
      zoomControl: false,
      dragging: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    const conf = GOOGLE_TILE_LAYERS[mapType];
    const initialTile = L.tileLayer(conf.url, {
      subdomains: conf.subdomains,
      maxZoom: conf.maxZoom,
      attribution: conf.attribution,
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

    const conf = GOOGLE_TILE_LAYERS[mapType];
    const newLayer = L.tileLayer(conf.url, {
      subdomains: conf.subdomains,
      maxZoom: conf.maxZoom,
      attribution: conf.attribution,
    }).addTo(map);

    tileLayerRef.current = newLayer;
  }, [mapType]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    let center = FALLBACK_CENTERS.default;
    let zoom = 16;
    let displayName = zoneName || 'Barangay Poblacion';

    if (purokData) {
      center = [purokData.centerLat, purokData.centerLng];
      zoom = purokData.zoomLevel || 16;
      displayName = purokData.name;
    } else if (zoneName && FALLBACK_CENTERS[zoneName]) {
      center = FALLBACK_CENTERS[zoneName];
    }

    map.setView(center, zoom, { animate: true });

    // Google Maps Red Pin
    const googlePinIcon = L.divIcon({
      className: 'google-admin-pin',
      html: `
        <div style="position: relative; width: 32px; height: 42px; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.4));">
          <svg viewBox="0 0 384 512" width="32" height="42" style="display: block;">
            <path fill="#EA4335" d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z"/>
            <circle cx="192" cy="192" r="72" fill="#7B1113"/>
            <circle cx="192" cy="192" r="54" fill="#FFFFFF"/>
          </svg>
          <div style="
            position: absolute;
            top: 5px;
            left: 0;
            right: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
          ">👤</div>
        </div>
      `,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -42],
    });

    const residentMarker = L.marker(center, { icon: googlePinIcon }).addTo(layerGroup);
    residentMarker.bindPopup(`
      <div style="font-family: Roboto, Arial, sans-serif; font-size: 12px; min-width: 170px;">
        <strong style="color: #202124; font-size: 13px; display: block; margin-bottom: 2px;">${residentName}</strong>
        <span style="color: #1a73e8; font-weight: 600; font-size: 11px;">Zone: ${displayName}</span>
        <p style="margin: 4px 0 0; color: #5f6368; font-size: 11px;">Barangay Poblacion, Cordova</p>
        <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #e2e8f0;">
          <a
            href="https://www.google.com/maps/search/?api=1&query=${center[0]},${center[1]}"
            target="_blank"
            rel="noopener noreferrer"
            style="color: #1a73e8; text-decoration: none; font-size: 11px; font-weight: 500;"
          >
            Open in Google Maps ↗
          </a>
        </div>
      </div>
    `).openPopup();

    // Boundary Polygon
    if (purokData?.boundaryGeojson) {
      try {
        const geoLayer = L.geoJSON(purokData.boundaryGeojson, {
          style: {
            color: '#1a73e8',
            weight: 2,
            opacity: 0.85,
            fillColor: '#4285f4',
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
        color: '#1a73e8',
        weight: 2,
        opacity: 0.8,
        fillColor: '#4285f4',
        fillOpacity: 0.14,
      }).addTo(layerGroup);
    }

    // Public Landmarks
    if (showLandmarks && purokData?.landmarks && Array.isArray(purokData.landmarks)) {
      purokData.landmarks.forEach((lm) => {
        if (lm.lat && lm.lng) {
          const landmarkIcon = L.divIcon({
            className: 'admin-google-poi',
            html: `
              <div style="
                background: #ffffff;
                color: #202124;
                padding: 2px 7px;
                border-radius: 12px;
                font-family: Roboto, Arial, sans-serif;
                font-size: 9px;
                font-weight: 600;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                border: 1px solid #dadce0;
                white-space: nowrap;
                display: inline-flex;
                align-items: center;
                gap: 3px;
              ">
                <span style="color: #1a73e8;">🏛️</span>
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
              <div style="font-size: 11px; font-family: Roboto, Arial, sans-serif;">
                <strong style="color: #202124;">${lm.name}</strong>
                <div style="color: #5f6368; font-size: 10px;">${lm.type || 'Barangay Landmark'}</div>
              </div>
            `);
        }
      });
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 150);
  }, [purokData, zoneName, residentName, showLandmarks]);

  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    let center = FALLBACK_CENTERS.default;
    let zoom = 16;
    if (purokData) {
      center = [purokData.centerLat, purokData.centerLng];
      zoom = purokData.zoomLevel || 16;
    } else if (zoneName && FALLBACK_CENTERS[zoneName]) {
      center = FALLBACK_CENTERS[zoneName];
    }
    map.setView(center, zoom, { animate: true });
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-xs font-sans ${className}`}>
      {/* Top Left: Google Maps Layer Switcher */}
      <div className="absolute top-2.5 left-2.5 z-[1000] bg-white rounded shadow-sm border border-slate-300 flex overflow-hidden">
        {['roadmap', 'satellite', 'terrain'].map((typeKey) => (
          <button
            key={typeKey}
            type="button"
            onClick={() => setMapType(typeKey)}
            className={`px-2.5 py-1 text-[10px] font-bold border-r last:border-r-0 border-slate-200 transition-colors ${
              mapType === typeKey ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {GOOGLE_TILE_LAYERS[typeKey].name}
          </button>
        ))}
      </div>

      {/* Top Right: Zone Info Pill */}
      <div className="absolute top-2.5 right-2.5 z-[1000] bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-md shadow-xs border border-slate-200 flex items-center gap-1.5 text-xs">
        <span className="w-2 h-2 rounded-full bg-red-500"></span>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Jurisdiction:</span>
        <strong className="text-xs font-bold text-slate-800">{zoneName || 'Barangay Poblacion'}</strong>
      </div>

      {/* Recenter Button */}
      <button
        type="button"
        onClick={handleRecenter}
        title="Recenter to resident's Purok"
        className="absolute bottom-3 right-3 z-[1000] bg-white text-blue-600 hover:bg-slate-50 border border-slate-300 px-2 py-1 rounded text-[11px] font-bold shadow-md flex items-center gap-1 transition-all"
      >
        <span>🎯</span>
        <span>Recenter</span>
      </button>

      {/* Map Container */}
      <div ref={mapContainerRef} style={{ height, width: '100%', zIndex: 1 }} />
    </div>
  );
}
