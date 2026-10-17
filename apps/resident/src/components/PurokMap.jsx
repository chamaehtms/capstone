import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

// Fix default Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Verified center coordinates for Poblacion, Cordova
const FALLBACK_CENTERS = {
  'Camolinas Centro': [10.2542, 123.9485],
  'Atabay': [10.2558, 123.9525],
  'Calan': [10.2488, 123.9472],
  'Housing': [10.2505, 123.9538],
  'Puso': [10.2518, 123.9498],
  'Intra': [10.2532, 123.9512],
  'Crossroad': [10.2512, 123.9478],
  default: [10.25195, 123.94970], // Poblacion Center / San Roque Church / Mun. Hall
};

// Google Maps Tile Layers
const GOOGLE_TILE_LAYERS = {
  roadmap: {
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['0', '1', '2', '3'],
    name: 'Map',
    maxZoom: 20,
    attribution: 'Map data © Google',
  },
  satellite: {
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', // Hybrid (satellite + labels)
    subdomains: ['0', '1', '2', '3'],
    name: 'Satellite',
    maxZoom: 20,
    attribution: 'Imagery © Google',
  },
  terrain: {
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', // Terrain with roads
    subdomains: ['0', '1', '2', '3'],
    name: 'Terrain',
    maxZoom: 20,
    attribution: 'Map data © Google',
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

  const [mapType, setMapType] = useState('roadmap'); // 'roadmap' | 'satellite' | 'terrain'
  const [purokData, setPurokData] = useState(null);

  // Fetch official purok metadata from backend
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
          setPurokData(found || null);
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

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const defaultCenter = FALLBACK_CENTERS.default;
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 16,
      zoomControl: false, // We use custom Google Maps style controls
      dragging: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    // Add Google Roadmap tile layer
    const layerConf = GOOGLE_TILE_LAYERS[mapType];
    const initialTileLayer = L.tileLayer(layerConf.url, {
      subdomains: layerConf.subdomains,
      maxZoom: layerConf.maxZoom,
      attribution: layerConf.attribution,
    }).addTo(map);

    tileLayerRef.current = initialTileLayer;

    // Layer group for pins & boundaries
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

  // Switch Tile Layer when mapType changes (Map vs Satellite vs Terrain)
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

  // Update map contents when purokData or zoneName changes
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

    // Authentic Google Maps Red Teardrop Pin
    const googlePinIcon = L.divIcon({
      className: 'google-map-pin',
      html: `
        <div style="position: relative; width: 34px; height: 44px; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));">
          <svg viewBox="0 0 384 512" width="34" height="44" style="display: block;">
            <path fill="#EA4335" d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0z"/>
            <circle cx="192" cy="192" r="72" fill="#7B1113"/>
            <circle cx="192" cy="192" r="54" fill="#FFFFFF"/>
          </svg>
          <div style="
            position: absolute;
            top: 6px;
            left: 0;
            right: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
          ">🏠</div>
        </div>
      `,
      iconSize: [34, 44],
      iconAnchor: [17, 44],
      popupAnchor: [0, -44],
    });

    const residentMarker = L.marker(center, { icon: googlePinIcon }).addTo(layerGroup);
    residentMarker.bindPopup(`
      <div style="font-family: Roboto, Arial, sans-serif; font-size: 13px; min-width: 180px; padding: 2px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #ea4335;"></span>
          <strong style="color: #202124; font-size: 14px;">${displayName}</strong>
        </div>
        <div style="color: #1a73e8; font-weight: 500; font-size: 11px;">Assigned Resident Zone</div>
        <div style="color: #5f6368; font-size: 11px; margin-top: 4px;">Barangay Poblacion, Cordova, Cebu</div>
        <div style="margin-top: 8px; pt: 4px; border-top: 1px solid #dadce0;">
          <a
            href="https://www.google.com/maps/search/?api=1&query=${center[0]},${center[1]}"
            target="_blank"
            rel="noopener noreferrer"
            style="color: #1a73e8; text-decoration: none; font-size: 11px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px;"
          >
            Open in Google Maps ↗
          </a>
        </div>
      </div>
    `).openPopup();

    // Boundary Polygon or Area Radius (Google style blue outline)
    if (purokData?.boundaryGeojson) {
      try {
        const geoLayer = L.geoJSON(purokData.boundaryGeojson, {
          style: {
            color: '#1a73e8',
            weight: 2.5,
            opacity: 0.85,
            fillColor: '#4285f4',
            fillOpacity: 0.18,
          },
        }).addTo(layerGroup);
        geoLayer.bindTooltip(`Jurisdiction: ${displayName}`, { sticky: true });
      } catch (err) {
        console.warn('[PurokMap] Invalid boundary geojson:', err);
      }
    } else {
      L.circle(center, {
        radius: 200,
        color: '#1a73e8',
        weight: 2,
        opacity: 0.8,
        fillColor: '#4285f4',
        fillOpacity: 0.15,
      }).addTo(layerGroup);
    }

    // Public Landmarks (Google Map POI Badge Style)
    if (showLandmarks && purokData?.landmarks && Array.isArray(purokData.landmarks)) {
      purokData.landmarks.forEach((lm) => {
        if (lm.lat && lm.lng) {
          const landmarkIcon = L.divIcon({
            className: 'google-poi-pin',
            html: `
              <div style="
                background: #ffffff;
                color: #202124;
                padding: 3px 8px;
                border-radius: 14px;
                font-family: Roboto, Arial, sans-serif;
                font-size: 10px;
                font-weight: 600;
                box-shadow: 0 1px 4px rgba(0,0,0,0.3);
                border: 1px solid #dadce0;
                white-space: nowrap;
                display: inline-flex;
                align-items: center;
                gap: 4px;
              ">
                <span style="color: #1a73e8; font-size: 11px;">🏛️</span>
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
              <div style="font-family: Roboto, Arial, sans-serif; font-size: 12px;">
                <strong style="color: #202124;">${lm.name}</strong>
                <div style="color: #5f6368; font-size: 11px;">${lm.type || 'Public Facility'} • Poblacion, Cordova</div>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=${lm.lat},${lm.lng}"
                  target="_blank"
                  rel="noopener noreferrer"
                  style="color: #1a73e8; font-size: 11px; text-decoration: none; display: inline-block; margin-top: 4px;"
                >
                  View on Google Maps ↗
                </a>
              </div>
            `);
        }
      });
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 150);
  }, [purokData, zoneName, showLandmarks]);

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

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-xs font-sans ${className}`}>
      {/* Top Left: Google Maps Style Layer Switcher (Map / Satellite / Terrain) */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 1000,
        background: '#ffffff',
        borderRadius: 4,
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        display: 'inline-flex',
        overflow: 'hidden',
        border: '1px solid #dadce0',
      }}>
        {['roadmap', 'satellite', 'terrain'].map((typeKey) => (
          <button
            key={typeKey}
            type="button"
            onClick={() => setMapType(typeKey)}
            style={{
              background: mapType === typeKey ? '#1a73e8' : '#ffffff',
              color: mapType === typeKey ? '#ffffff' : '#5f6368',
              border: 'none',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              borderRight: typeKey !== 'terrain' ? '1px solid #dadce0' : 'none',
              transition: 'background 0.2s',
            }}
          >
            {GOOGLE_TILE_LAYERS[typeKey].name}
          </button>
        ))}
      </div>

      {/* Top Right: Zone Info Pill */}
      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(4px)',
        padding: '6px 12px',
        borderRadius: 8,
        border: '1px solid #dadce0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        maxWidth: '65%',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ea4335' }}></span>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#202124', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {zoneName || 'Barangay Poblacion, Cordova'}
        </span>
      </div>

      {/* Google Maps Style Bottom Right Zoom and Recenter Controls */}
      <div style={{
        position: 'absolute',
        bottom: 24,
        right: 14,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}>
        {/* Recenter Button */}
        <button
          type="button"
          onClick={handleRecenter}
          title="Recenter to my assigned Purok / Zone"
          style={{
            background: '#ffffff',
            color: '#1a73e8',
            border: '1px solid #dadce0',
            width: 36,
            height: 36,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          🎯
        </button>

        {/* Zoom Controls (+ / -) */}
        <div style={{
          background: '#ffffff',
          borderRadius: 4,
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          border: '1px solid #dadce0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            style={{
              background: '#ffffff',
              border: 'none',
              borderBottom: '1px solid #dadce0',
              width: 36,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#5f6368',
              cursor: 'pointer',
            }}
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            style={{
              background: '#ffffff',
              border: 'none',
              width: 36,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#5f6368',
              cursor: 'pointer',
            }}
          >
            −
          </button>
        </div>
      </div>

      {/* Map Canvas */}
      <div
        ref={mapContainerRef}
        style={{ height, width: '100%', zIndex: 1 }}
      />

      {/* Bottom Bar: Google Brand & Coordinates Link */}
      <div style={{
        padding: '6px 12px',
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        fontSize: '11px',
        color: '#5f6368',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 800, color: '#4285f4' }}>G<span style={{ color: '#ea4335' }}>o</span><span style={{ color: '#fbbc05' }}>o</span><span style={{ color: '#4285f4' }}>g</span><span style={{ color: '#34a853' }}>l</span><span style={{ color: '#ea4335' }}>e</span></span>
          <span>Maps Format • Poblacion, Cordova, Cebu</span>
        </div>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${zoneName || 'Poblacion'}, Cordova, Cebu, Philippines`)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#1a73e8', textDecoration: 'none', fontWeight: 600 }}
        >
          View Full Google Maps ↗
        </a>
      </div>
    </div>
  );
}
