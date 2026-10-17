import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import api from '../api';
import AdminIcon from '../components/AdminIcons.jsx';

export default function PuroksManagement() {
  const [puroks, setPuroks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPurok, setSelectedPurok] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    centerLat: 10.25195,
    centerLng: 123.94970,
    zoomLevel: 16,
    landmarksText: '',
  });

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);

  const loadPuroks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/puroks');
      setPuroks(res.data || []);
      if (!selectedPurok && res.data?.length > 0) {
        setSelectedPurok(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to load puroks:', err);
      setStatusMessage({ type: 'error', text: 'Unable to fetch official puroks.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPuroks();
  }, []);

  // Initialize Admin Overview Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [10.25195, 123.94970],
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = layerGroup;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Map layers when puroks or selectedPurok changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    puroks.forEach((p) => {
      const isSelected = selectedPurok?.id === p.id;
      const center = [Number(p.centerLat), Number(p.centerLng)];

      // Circle / Boundary outline
      if (p.boundaryGeojson) {
        try {
          L.geoJSON(p.boundaryGeojson, {
            style: {
              color: isSelected ? '#2563eb' : '#64748b',
              weight: isSelected ? 3 : 1.5,
              opacity: 0.85,
              fillColor: isSelected ? '#3b82f6' : '#94a3b8',
              fillOpacity: isSelected ? 0.22 : 0.08,
            },
          }).addTo(layerGroup);
        } catch {
          // fallback circle
        }
      } else {
        L.circle(center, {
          radius: 200,
          color: isSelected ? '#2563eb' : '#64748b',
          weight: isSelected ? 2.5 : 1,
          fillColor: isSelected ? '#3b82f6' : '#94a3b8',
          fillOpacity: isSelected ? 0.2 : 0.06,
        }).addTo(layerGroup);
      }

      // Marker
      const pinIcon = L.divIcon({
        className: 'admin-purok-badge',
        html: `
          <div style="
            background: ${isSelected ? '#1e3a8a' : '#ffffff'};
            color: ${isSelected ? '#ffffff' : '#1e293b'};
            border: 1.5px solid ${isSelected ? '#1d4ed8' : '#cbd5e1'};
            padding: 2px 7px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 700;
            white-space: nowrap;
            box-shadow: 0 1px 3px rgba(0,0,0,0.15);
            cursor: pointer;
          ">
            ${p.name}
          </div>
        `,
        iconSize: [80, 20],
        iconAnchor: [40, 10],
      });

      const marker = L.marker(center, { icon: pinIcon }).addTo(layerGroup);
      marker.on('click', () => setSelectedPurok(p));
    });

    if (selectedPurok) {
      map.flyTo([Number(selectedPurok.centerLat), Number(selectedPurok.centerLng)], selectedPurok.zoomLevel || 16, {
        duration: 0.8,
      });
    }
  }, [puroks, selectedPurok]);

  const openAddModal = () => {
    setModalMode('add');
    setFormData({
      id: '',
      name: '',
      description: '',
      centerLat: 10.25195,
      centerLng: 123.94970,
      zoomLevel: 16,
      landmarksText: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p) => {
    setModalMode('edit');
    const lmList = Array.isArray(p.landmarks) ? p.landmarks : [];
    const lmString = lmList.map((l) => `${l.name} | ${l.type || 'Landmark'} | ${l.lat} | ${l.lng}`).join('\n');

    setFormData({
      id: p.id,
      name: p.name,
      description: p.description || '',
      centerLat: p.centerLat,
      centerLng: p.centerLng,
      zoomLevel: p.zoomLevel || 16,
      landmarksText: lmString,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage({ type: '', text: '' });

    // Parse landmarks lines: "Name | Type | Lat | Lng"
    const parsedLandmarks = [];
    if (formData.landmarksText) {
      formData.landmarksText.split('\n').forEach((line) => {
        const parts = line.split('|').map((s) => s.trim());
        if (parts.length >= 4) {
          const lat = Number(parts[2]);
          const lng = Number(parts[3]);
          if (!isNaN(lat) && !isNaN(lng)) {
            parsedLandmarks.push({
              name: parts[0],
              type: parts[1],
              lat,
              lng,
            });
          }
        }
      });
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      centerLat: Number(formData.centerLat),
      centerLng: Number(formData.centerLng),
      zoomLevel: Number(formData.zoomLevel),
      landmarks: parsedLandmarks,
    };

    try {
      if (modalMode === 'add') {
        const res = await api.post('/puroks', payload);
        setStatusMessage({ type: 'success', text: `Purok ${res.data.name} created successfully.` });
      } else {
        const res = await api.put(`/puroks/${formData.id}`, payload);
        setStatusMessage({ type: 'success', text: `Purok ${res.data.name} updated successfully.` });
      }
      setIsModalOpen(false);
      await loadPuroks();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Error saving purok.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from the official Purok list?`)) return;
    try {
      await api.delete(`/puroks/${id}`);
      setStatusMessage({ type: 'success', text: `Purok "${name}" has been deleted.` });
      await loadPuroks();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Error deleting purok.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Official Puroks & Geographic Boundaries</h1>
          <p className="text-sm text-slate-500">
            Configure verified municipal zones, coordinate boundaries, and public landmarks for Poblacion, Cordova.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors shadow-xs"
        >
          <AdminIcon name="pin" size={16} />
          <span>Add New Purok</span>
        </button>
      </div>

      {statusMessage.text && (
        <div
          className={`p-3 rounded-lg text-sm font-medium ${
            statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Main Grid: Interactive Map + Purok List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Leaflet Map */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <AdminIcon name="pin" size={16} className="text-blue-600" />
              <span>Poblacion Map Viewer (OpenStreetMap)</span>
            </h2>
            {selectedPurok && (
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-semibold">
                Focused: {selectedPurok.name}
              </span>
            )}
          </div>
          <div
            ref={mapContainerRef}
            className="w-full h-[440px] rounded-lg border border-slate-200 overflow-hidden"
          />
          <p className="text-xs text-slate-400 mt-2">
            Click any purok marker or list item to inspect assigned geographic boundaries and verified landmarks.
          </p>
        </div>

        {/* Right Column: Purok List Cards */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Configured Zones ({puroks.length})
            </h3>
          </div>

          <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading official zones...</div>
            ) : puroks.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm bg-white rounded-xl border border-slate-200">
                No puroks configured yet.
              </div>
            ) : (
              puroks.map((p) => {
                const isSelected = selectedPurok?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPurok(p)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {p.description || 'Barangay Poblacion residential zone.'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(p);
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded transition-colors"
                          title="Edit Purok"
                        >
                          <AdminIcon name="edit" size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(p.id, p.name);
                          }}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-white rounded transition-colors"
                          title="Delete Purok"
                        >
                          <AdminIcon name="close" size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        Coords: {Number(p.centerLat).toFixed(4)}°N, {Number(p.centerLng).toFixed(4)}°E
                      </span>
                      <span>
                        Landmarks: {Array.isArray(p.landmarks) ? p.landmarks.length : 0}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Purok Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {modalMode === 'add' ? 'Add Official Purok / Zone' : `Edit ${formData.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <AdminIcon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Purok / Zone Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Camolinas Centro, Atabay, Puso"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Official territorial scope and jurisdiction details..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Center Latitude *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.centerLat}
                    onChange={(e) => setFormData({ ...formData, centerLat: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Center Longitude *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.centerLng}
                    onChange={(e) => setFormData({ ...formData, centerLng: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Default Zoom Level
                </label>
                <input
                  type="number"
                  min="12"
                  max="19"
                  value={formData.zoomLevel}
                  onChange={(e) => setFormData({ ...formData, zoomLevel: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Verified Public Landmarks
                </label>
                <p className="text-[11px] text-slate-400 mb-1">
                  Format per line: <code>Name | Category | Latitude | Longitude</code>
                </p>
                <textarea
                  rows={3}
                  value={formData.landmarksText}
                  onChange={(e) => setFormData({ ...formData, landmarksText: e.target.value })}
                  placeholder="San Roque Parish Church | Church | 10.25128 | 123.94957&#10;Cordova Town Plaza | Plaza | 10.25150 | 123.94940"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Purok'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
