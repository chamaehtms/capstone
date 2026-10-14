import React, { useEffect, useState } from 'react';
import api from '../api';
import AdminIcon from '../components/AdminIcons.jsx';
import StatCard from '../components/StatCard.jsx';

const PUROK_ZONES = [
  'Camolinas Centro',
  'Atabay',
  'Calan',
  'Housing',
  'Puso',
  'Intra',
  'Crossroad',
];

const INCOME_CLASSES = [
  'Ultra Poor / Indigent',
  'Low Income',
  'Lower Middle Class',
  'Middle Class',
  'Upper Class',
];

const HOUSING_TYPES = [
  'Concrete / Permanent',
  'Semi-Concrete',
  'Wood / Light Materials',
  'Makeshift / Salvaged',
];

const TOILET_FACILITIES = [
  'Water-sealed / Flush',
  'Closed Pit',
  'Open Pit',
  'Shared / Communal',
  'No Facility',
];

const WATER_SOURCES = [
  'Piped Water Connection',
  'Deep Well (Community)',
  'Shallow Well',
  'Rainwater / Spring',
  'Bought / Refilling Station',
];

export default function Households() {
  const [households, setHouseholds] = useState([]);
  const [residents, setResidents] = useState([]);
  const [stats, setStats] = useState({ totalHouseholds: 0, totalMembers: 0, total4ps: 0, totalIndigent: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterZone, setFilterZone] = useState('all');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [selectedHousehold, setSelectedHousehold] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewDetail, setViewDetail] = useState(null);

  // Form State
  const [form, setForm] = useState({
    householdNo: '',
    headResidentId: '',
    headName: '',
    purokZone: PUROK_ZONES[0],
    address: '',
    incomeClass: 'Low Income',
    housingType: 'Concrete / Permanent',
    toiletFacility: 'Water-sealed / Flush',
    waterSource: 'Piped Water Connection',
    wasteManagement: 'Barangay Collection',
    is4psBeneficiary: false,
    isIndigent: false,
    members: [],
    remarks: '',
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [hhRes, resRes] = await Promise.all([
        api.get('/households', { params: { search, zone: filterZone } }),
        api.get('/residents/all-directory').catch(() => ({ data: [] })),
      ]);
      setHouseholds(hhRes.data.households || []);
      setStats(hhRes.data.stats || { totalHouseholds: 0, totalMembers: 0, total4ps: 0, totalIndigent: 0 });
      setResidents(Array.isArray(resRes.data) ? resRes.data : []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Unable to load household records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterZone]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedHousehold(null);
    setForm({
      householdNo: '',
      headResidentId: '',
      headName: '',
      purokZone: PUROK_ZONES[0],
      address: '',
      incomeClass: 'Low Income',
      housingType: 'Concrete / Permanent',
      toiletFacility: 'Water-sealed / Flush',
      waterSource: 'Piped Water Connection',
      wasteManagement: 'Barangay Collection',
      is4psBeneficiary: false,
      isIndigent: false,
      members: [],
      remarks: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (hh) => {
    setModalMode('edit');
    setSelectedHousehold(hh);
    setForm({
      householdNo: hh.householdNo || '',
      headResidentId: hh.headResidentId || '',
      headName: hh.headName || '',
      purokZone: hh.purokZone || PUROK_ZONES[0],
      address: hh.address || '',
      incomeClass: hh.incomeClass || 'Low Income',
      housingType: hh.housingType || 'Concrete / Permanent',
      toiletFacility: hh.toiletFacility || 'Water-sealed / Flush',
      waterSource: hh.waterSource || 'Piped Water Connection',
      wasteManagement: hh.wasteManagement || 'Barangay Collection',
      is4psBeneficiary: Boolean(hh.is4psBeneficiary),
      isIndigent: Boolean(hh.isIndigent),
      members: Array.isArray(hh.members) ? [...hh.members] : [],
      remarks: hh.remarks || '',
    });
    setIsModalOpen(true);
  };

  const handleHeadSelect = (residentId) => {
    const found = residents.find((r) => r.id === residentId);
    if (found) {
      setForm((prev) => ({
        ...prev,
        headResidentId: found.id,
        headName: found.fullName || found.name || '',
        address: found.address || prev.address,
        purokZone: found.zone || prev.purokZone,
      }));
    } else {
      setForm((prev) => ({ ...prev, headResidentId: '' }));
    }
  };

  const addMember = () => {
    setForm((prev) => ({
      ...prev,
      members: [
        ...prev.members,
        { name: '', relation: 'Spouse', birthDate: '', occupation: '' },
      ],
    }));
  };

  const updateMember = (index, field, value) => {
    setForm((prev) => {
      const nextMembers = [...prev.members];
      nextMembers[index] = { ...nextMembers[index], [field]: value };
      return { ...prev, members: nextMembers };
    });
  };

  const removeMember = (index) => {
    setForm((prev) => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.headName.trim() || !form.address.trim() || !form.purokZone.trim()) {
      alert('Head of household name, Purok/Zone, and address are required.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (modalMode === 'edit' && selectedHousehold) {
        await api.put(`/households/${selectedHousehold.id}`, form);
        setMessage('Household profile updated successfully.');
      } else {
        await api.post('/households', form);
        setMessage('New household enrolled into Barangay Registry.');
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Unable to save household record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (hh) => {
    if (!window.confirm(`Are you sure you want to delete household "${hh.householdNo} - ${hh.headName}"?`)) {
      return;
    }
    try {
      await api.delete(`/households/${hh.id}`);
      setMessage('Household removed from registry.');
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Unable to delete household.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Household Records</h1>
          <p className="text-sm text-slate-500">
            Official census repository for family units, housing demographics, socio-economic profiling, and 4Ps assistance.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition shadow-sm"
        >
          <AdminIcon name="plus" size={16} />
          <span>Enroll Household</span>
        </button>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Households" value={stats.totalHouseholds} accent="blue" sub="Official Family Units" />
        <StatCard label="Total Family Members" value={stats.totalMembers} accent="green" sub="Citizens within Households" />
        <StatCard label="4Ps Beneficiaries" value={stats.total4ps} accent="orange" sub="Government CCT Program" />
        <StatCard label="Indigent Households" value={stats.totalIndigent} accent="red" sub="Barangay Welfare Priority" />
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-emerald-600 font-bold hover:text-emerald-800">×</button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2 w-full">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <AdminIcon name="search" size={15} />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Household #, Head of Family, or Street Address..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <label className="text-xs text-slate-500 font-medium whitespace-nowrap">Filter Purok:</label>
          <select
            value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">All Zones / Puroks</option>
            {PUROK_ZONES.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Households Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 min-w-[700px]">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
            <tr>
              <th className="px-5 py-3">Household No.</th>
              <th className="px-5 py-3">Head of Household</th>
              <th className="px-5 py-3">Purok / Zone</th>
              <th className="px-5 py-3">Family Size</th>
              <th className="px-5 py-3">Socio-Economic</th>
              <th className="px-5 py-3">Welfare Tags</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  Loading households census data…
                </td>
              </tr>
            )}
            {!loading && households.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  No household records found matching criteria.
                </td>
              </tr>
            )}
            {households.map((hh) => {
              const memberCount = (hh.members?.length || 0) + 1;
              return (
                <tr key={hh.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-5 py-3.5 font-mono font-bold text-blue-700">
                    {hh.householdNo}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {hh.headName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold">{hh.headName}</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-xs">{hh.address}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-700">
                    {hh.purokZone}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-semibold text-slate-800">{memberCount}</span>
                    <span className="text-[11px] text-slate-400 ml-1">({hh.members?.length || 0} dependents)</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {hh.incomeClass || 'Low Income'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {hh.is4psBeneficiary && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          4Ps Beneficiary
                        </span>
                      )}
                      {hh.isIndigent && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          Indigent
                        </span>
                      )}
                      {!hh.is4psBeneficiary && !hh.isIndigent && (
                        <span className="text-[11px] text-slate-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => setViewDetail(hh)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-semibold hover:underline"
                      >
                        Profile
                      </button>
                      <button
                        onClick={() => openEditModal(hh)}
                        className="text-slate-600 hover:text-slate-900 text-xs font-semibold hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(hh)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Household Enrollment / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-navy-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AdminIcon name="home" size={20} className="text-blue-400" />
                <h3 className="font-bold text-base">
                  {modalMode === 'edit' ? `Edit Household: ${form.householdNo}` : 'Enroll New Household Unit'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <AdminIcon name="x" size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto text-xs">
              {/* Section 1: Basic Identifiers */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b pb-1">
                  1. Household Identity & Residence
                </h4>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Household No.</label>
                    <input
                      type="text"
                      value={form.householdNo}
                      onChange={(e) => setForm({ ...form, householdNo: e.target.value })}
                      placeholder="e.g. HH-2026-1045 (Auto-generated if blank)"
                      className="w-full border border-slate-300 rounded-lg p-2.5 font-mono text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">
                      Link Registered Resident (Optional)
                    </label>
                    <select
                      value={form.headResidentId}
                      onChange={(e) => handleHeadSelect(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">-- Choose from Enrolled Citizens (or type below) --</option>
                      {residents.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.fullName || r.name} ({r.zone || 'No Zone'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Head of Family Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.headName}
                      onChange={(e) => setForm({ ...form, headName: e.target.value })}
                      placeholder="e.g. Juan Martinez Santos"
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Purok / Zone Jurisdiction <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.purokZone}
                      onChange={(e) => setForm({ ...form, purokZone: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white font-medium"
                    >
                      {PUROK_ZONES.map((z) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    House #, Street Address & Landmark <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="e.g. Lot 4 Block 12, Manga St. near Poblacion Chapel"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Section 2: Socio-Economic & Living Conditions */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b pb-1">
                  2. Socio-Economic Profile & Utilities
                </h4>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Income Classification</label>
                    <select
                      value={form.incomeClass}
                      onChange={(e) => setForm({ ...form, incomeClass: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {INCOME_CLASSES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Housing Material</label>
                    <select
                      value={form.housingType}
                      onChange={(e) => setForm({ ...form, housingType: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {HOUSING_TYPES.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Toilet Facility</label>
                    <select
                      value={form.toiletFacility}
                      onChange={(e) => setForm({ ...form, toiletFacility: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {TOILET_FACILITIES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Main Water Source</label>
                    <select
                      value={form.waterSource}
                      onChange={(e) => setForm({ ...form, waterSource: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {WATER_SOURCES.map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Waste Disposal Method</label>
                    <input
                      type="text"
                      value={form.wasteManagement}
                      onChange={(e) => setForm({ ...form, wasteManagement: e.target.value })}
                      placeholder="Barangay Collection, Segregation, Composting"
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Welfare Checkboxes */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap gap-6 items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is4psBeneficiary}
                      onChange={(e) => setForm({ ...form, is4psBeneficiary: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span className="font-semibold text-slate-800">Enrolled in Pantawid Pamilyang Pilipino Program (4Ps)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isIndigent}
                      onChange={(e) => setForm({ ...form, isIndigent: e.target.checked })}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-semibold text-slate-800">Certified Indigent Family</span>
                  </label>
                </div>
              </div>

              {/* Section 3: Household Members */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-1">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    3. Other Household Members / Dependents ({form.members.length})
                  </h4>
                  <button
                    type="button"
                    onClick={addMember}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                  >
                    + Add Family Member
                  </button>
                </div>

                {form.members.length === 0 ? (
                  <p className="text-slate-400 italic py-2">
                    No dependents added. Click "+ Add Family Member" to enroll spouse, children, or elderly residing together.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.members.map((m, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <div className="col-span-4">
                          <input
                            type="text"
                            value={m.name}
                            onChange={(e) => updateMember(idx, 'name', e.target.value)}
                            placeholder="Full Name"
                            className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
                          />
                        </div>
                        <div className="col-span-3">
                          <select
                            value={m.relation}
                            onChange={(e) => updateMember(idx, 'relation', e.target.value)}
                            className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
                          >
                            <option value="Spouse">Spouse</option>
                            <option value="Son">Son</option>
                            <option value="Daughter">Daughter</option>
                            <option value="Parent">Parent</option>
                            <option value="Sibling">Sibling</option>
                            <option value="Relative">Relative</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="text"
                            value={m.occupation}
                            onChange={(e) => updateMember(idx, 'occupation', e.target.value)}
                            placeholder="Occupation / Student"
                            className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="date"
                            value={m.birthDate}
                            onChange={(e) => updateMember(idx, 'birthDate', e.target.value)}
                            className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white"
                          />
                        </div>
                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeMember(idx)}
                            className="text-red-500 hover:text-red-700"
                            title="Remove member"
                          >
                            <AdminIcon name="x" size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 4: Remarks */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Social Worker Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  placeholder="Special assistance requirements, disaster vulnerability, senior citizen support..."
                  className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-white font-semibold transition shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Saving Household…' : (modalMode === 'edit' ? 'Update Household Record' : 'Enroll Household')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Household Profile View Modal */}
      {viewDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-navy-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <AdminIcon name="home" size={18} className="text-blue-400" />
                  <span>Household Dossier: {viewDetail.householdNo}</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">{viewDetail.purokZone} · Barangay Poblacion</p>
              </div>
              <button
                onClick={() => setViewDetail(null)}
                className="text-slate-400 hover:text-white transition"
              >
                <AdminIcon name="x" size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs text-slate-700">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Head of Household</span>
                  <span className="font-bold text-slate-900 text-sm">{viewDetail.headName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Purok / Zone</span>
                  <span className="font-medium text-slate-800">{viewDetail.purokZone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Family Size</span>
                  <span className="font-bold text-blue-700">{(viewDetail.members?.length || 0) + 1} Members</span>
                </div>
                <div className="sm:col-span-3">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Residential Address</span>
                  <span className="font-medium text-slate-800">{viewDetail.address}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="border border-slate-200 p-3 rounded-lg">
                  <span className="text-[10px] text-slate-400 uppercase block">Income Level</span>
                  <span className="font-semibold text-slate-800">{viewDetail.incomeClass}</span>
                </div>
                <div className="border border-slate-200 p-3 rounded-lg">
                  <span className="text-[10px] text-slate-400 uppercase block">Housing Structure</span>
                  <span className="font-semibold text-slate-800">{viewDetail.housingType}</span>
                </div>
                <div className="border border-slate-200 p-3 rounded-lg">
                  <span className="text-[10px] text-slate-400 uppercase block">Sanitation / Toilet</span>
                  <span className="font-semibold text-slate-800">{viewDetail.toiletFacility}</span>
                </div>
                <div className="border border-slate-200 p-3 rounded-lg">
                  <span className="text-[10px] text-slate-400 uppercase block">Water Supply</span>
                  <span className="font-semibold text-slate-800">{viewDetail.waterSource}</span>
                </div>
                <div className="border border-slate-200 p-3 rounded-lg sm:col-span-2">
                  <span className="text-[10px] text-slate-400 uppercase block">Waste Disposal</span>
                  <span className="font-semibold text-slate-800">{viewDetail.wasteManagement}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                  Family Members List
                </h4>
                {(!viewDetail.members || viewDetail.members.length === 0) ? (
                  <p className="text-slate-400 italic">Only the head of family is recorded for this household.</p>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-semibold">
                        <tr>
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Relationship</th>
                          <th className="px-3 py-2">Occupation</th>
                          <th className="px-3 py-2">Birthdate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewDetail.members.map((m, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 font-medium text-slate-800">{m.name || '-'}</td>
                            <td className="px-3 py-2 text-slate-600">{m.relation || '-'}</td>
                            <td className="px-3 py-2 text-slate-600">{m.occupation || '-'}</td>
                            <td className="px-3 py-2 text-slate-500">{m.birthDate || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {viewDetail.remarks && (
                <div className="bg-amber-50/60 border border-amber-200 p-3 rounded-lg text-amber-900">
                  <span className="text-[10px] font-bold uppercase block mb-1">Remarks & Notes</span>
                  <p>{viewDetail.remarks}</p>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t">
                <button
                  onClick={() => setViewDetail(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold"
                >
                  Close Dossier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
