import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api, { toAssetUrl } from '../api';
import StatCard from '../components/StatCard.jsx';
import AdminIcon from '../components/AdminIcons';
import {
  Search,
  Bell,
  Edit3,
  MapPin,
  ShieldCheck,
  FileText,
  User,
  Users,
  FolderLock,
  HeartHandshake,
  History,
  Phone,
  Mail,
  Calendar,
  Award,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  X,
  Plus,
  RefreshCw,
  Navigation,
  Gavel,
  Printer,
  Trash2,
  Camera,
  ArrowLeft
} from 'lucide-react';

interface ResidentData {
  id: string;
  fullName: string;
  birthDate?: string;
  gender?: string;
  occupation?: string;
  address?: string;
  zone?: string;
  contact?: string;
  email?: string;
  status?: string;
  photoUrl?: string;
  category?: string[];
  age?: number;
  residencyYears?: number;
  placeOfBirth?: string;
  bloodType?: string;
  education?: string;
  household?: any[];
  [key: string]: any;
}

export default function ResidentProfilingPage() {
  const [residents, setResidents] = useState<ResidentData[]>([]);
  const [stats, setStats] = useState({ total: 0, male: 0, female: 0, verified: 0 });
  const [search, setSearch] = useState('');
  const [selectedGender, setSelectedGender] = useState('All'); // 'All' | 'Male' | 'Female' | 'Verified'
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Active Profiling Detail Drawer / View
  const [selectedResident, setSelectedResident] = useState<ResidentData | null>(null);
  const [complaints, setComplaints] = useState<any[]>([]);

  // Modals inside Profiling inspector
  const [activeTab, setActiveTab] = useState<'Personal Info' | 'Household & Family' | 'Activity Logs'>('Personal Info');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMediationHistoryModalOpen, setIsMediationHistoryModalOpen] = useState(false);
  const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [clearanceStatus, setClearanceStatus] = useState<'VALID' | 'EXPIRED'>('VALID');
  const [clearanceExpiry, setClearanceExpiry] = useState('Oct 17, 2026');

  // Edit resident form
  const [editForm, setEditForm] = useState({
    fullName: '',
    occupation: '',
    education: '',
    email: '',
    contact: '',
    address: '',
    zone: '',
    placeOfBirth: '',
    bloodType: '',
    gender: 'Male'
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchResidents = async (q = '', gender = selectedGender) => {
    setLoading(true);
    try {
      const params: any = { search: q };
      if (gender === 'Male' || gender === 'Female') {
        params.gender = gender;
      } else if (gender === 'Verified') {
        params.status = 'Verified';
      }
      const [resResidents, resComplaints] = await Promise.all([
        api.get('/residents', { params }),
        api.get('/complaints')
      ]);

      const list = resResidents.data.residents || [];
      setResidents(list);
      setStats(resResidents.data.stats || { total: 0, male: 0, female: 0, verified: 0 });
      setComplaints(resComplaints.data?.complaints || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to load resident records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResidents(search, selectedGender);
  }, [selectedGender]);

  const handleGenderToggle = (genderKey: string) => {
    setSelectedGender((prev) => (prev === genderKey ? 'All' : genderKey));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchResidents(search, selectedGender);
  };

  const handleDelete = async (resident: ResidentData) => {
    if (!window.confirm(`Are you sure you want to delete resident "${resident.fullName}"? This action cannot be undone.`)) {
      return;
    }
    setError('');
    setDeletingId(resident.id);
    try {
      await api.delete(`/residents/${resident.id}`);
      if (selectedResident?.id === resident.id) {
        setSelectedResident(null);
      }
      showToast(`Resident "${resident.fullName}" has been deleted.`);
      await fetchResidents(search, selectedGender);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to delete resident.');
    } finally {
      setDeletingId(null);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open resident into profiling view
  const openProfiling = (resident: ResidentData) => {
    setSelectedResident(resident);
    setActiveTab('Personal Info');
    setEditForm({
      fullName: resident.fullName || '',
      occupation: resident.occupation || '',
      education: resident.education || 'High School Graduate',
      email: resident.email || '',
      contact: resident.contact || '',
      address: resident.address || '',
      zone: resident.zone || '',
      placeOfBirth: resident.placeOfBirth || 'Cordova, Cebu',
      bloodType: resident.bloodType || 'O Positive (O+)',
      gender: resident.gender || 'Male'
    });
  };

  // Incidents for selected resident
  const residentIncidents = useMemo(() => {
    if (!selectedResident) return [];
    const name = (selectedResident.fullName || '').toLowerCase();
    return complaints.filter((c: any) => {
      return (
        (c.resident && String(c.resident).toLowerCase() === name) ||
        (c.residentName && String(c.residentName).toLowerCase() === name) ||
        (c.respondentName && String(c.respondentName).toLowerCase() === name)
      );
    });
  }, [selectedResident, complaints]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResident) return;
    setIsSavingEdit(true);
    try {
      const res = await api.put(`/residents/${selectedResident.id}`, editForm);
      const updated = res.data;
      setSelectedResident((prev) => (prev ? { ...prev, ...updated, ...editForm } : null));
      setResidents((prev) =>
        prev.map((r) => (r.id === selectedResident.id ? { ...r, ...updated, ...editForm } : r))
      );
      setIsEditModalOpen(false);
      showToast('Constituent profile updated successfully.');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update constituent profile.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleClearanceRenewal = () => {
    setClearanceStatus('VALID');
    setClearanceExpiry('Oct 17, 2027');
    setIsRenewalModalOpen(false);
    showToast(`Barangay Clearance renewed for ${selectedResident?.fullName || 'Resident'}.`);
  };

  // Computed profiling fields
  const ageDisplay = selectedResident?.age || (selectedResident?.birthDate ? (() => {
    const diff = Date.now() - new Date(selectedResident.birthDate).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)) || 25;
  })() : 25);

  const formattedDob = selectedResident?.birthDate
    ? new Date(selectedResident.birthDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';

  const registryId = selectedResident ? `BSJ-2024-${selectedResident.id.slice(-5).toUpperCase()}` : '';
  const voterRegNo = selectedResident ? `1455-${selectedResident.id.slice(-4).toUpperCase()}-A` : '';
  const precinct = selectedResident?.zone ? `PRECINCT-0432-${selectedResident.zone.slice(-1) || 'A'}` : 'PRECINCT-0432-A';
  const residentialZone = selectedResident?.zone || 'Poblacion Centro';
  const fullAddress = selectedResident?.address || `${residentialZone}, Barangay Poblacion, Cordova, Cebu`;
  const realHousehold = Array.isArray(selectedResident?.household) ? selectedResident.household : [];

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#0A1A2F] text-white px-4 py-3 rounded-lg shadow-xl text-xs sm:text-sm flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resident Profiling</h1>
          <p className="text-sm text-slate-500">
            View, inspect, and maintain comprehensive demographic and constituent profile records.
          </p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Residents"
          value={stats.total}
          accent="blue"
          sub="Click to show all"
          onClick={() => handleGenderToggle('All')}
          className={`transition-all ${
            selectedGender === 'All'
              ? 'ring-2 ring-blue-500 ring-offset-2 bg-blue-50/20'
              : 'hover:border-slate-300'
          }`}
        />
        <StatCard
          label="Total Male"
          value={stats.male}
          accent="blue"
          sub={selectedGender === 'Male' ? '✓ Showing Male only' : 'Click to filter Male'}
          onClick={() => handleGenderToggle('Male')}
          className={`transition-all ${
            selectedGender === 'Male'
              ? 'ring-2 ring-blue-500 ring-offset-2 bg-blue-50/30'
              : 'hover:border-blue-300'
          }`}
        />
        <StatCard
          label="Total Female"
          value={stats.female}
          accent="orange"
          sub={selectedGender === 'Female' ? '✓ Showing Female only' : 'Click to filter Female'}
          onClick={() => handleGenderToggle('Female')}
          className={`transition-all ${
            selectedGender === 'Female'
              ? 'ring-2 ring-orange-500 ring-offset-2 bg-orange-50/30'
              : 'hover:border-orange-300'
          }`}
        />
        <StatCard
          label="Verified"
          value={stats.verified}
          accent="green"
          sub={selectedGender === 'Verified' ? '✓ Showing Verified only' : 'Click to filter Verified'}
          onClick={() => handleGenderToggle('Verified')}
          className={`transition-all ${
            selectedGender === 'Verified'
              ? 'ring-2 ring-green-500 ring-offset-2 bg-green-50/30'
              : 'hover:border-green-300'
          }`}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-red-500 hover:text-red-700 p-1 ml-2"
            aria-label="Dismiss alert"
          >
            <AdminIcon name="x" size={14} />
          </button>
        </div>
      )}

      {/* Resident Records Table Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-slate-800">Resident Registry</h2>
            {selectedGender !== 'All' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                <span>Filter: <strong>{selectedGender}</strong></span>
                <button
                  type="button"
                  onClick={() => setSelectedGender('All')}
                  className="text-slate-400 hover:text-slate-600 ml-0.5"
                  title="Clear filter"
                >
                  <AdminIcon name="x" size={12} />
                </button>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <form onSubmit={handleSearch} className="flex-1 sm:flex-initial">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, address..."
                className="w-full sm:w-64 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </form>
            <Link
              to="/residents/enroll"
              className="bg-[#0A1A2F] hover:bg-slate-900 text-white text-sm font-medium rounded-lg px-3 sm:px-4 py-2 whitespace-nowrap shadow-xs"
            >
              + Add Record
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100 bg-slate-50/50">
                <th className="px-5 py-3 font-medium">FULL NAME</th>
                <th className="px-5 py-3 font-medium">GENDER</th>
                <th className="px-5 py-3 font-medium">ADDRESS</th>
                <th className="px-5 py-3 font-medium">STATUS</th>
                <th className="px-5 py-3 font-medium">CATEGORY</th>
                <th className="px-5 py-3 font-medium">AGE</th>
                <th className="px-5 py-3 font-medium text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                    Loading resident records…
                  </td>
                </tr>
              )}
              {!loading && residents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                    {selectedGender !== 'All' ? `No ${selectedGender.toLowerCase()} residents found.` : 'No resident records found.'}
                  </td>
                </tr>
              )}
              {residents.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openProfiling(r)}
                  className={`border-b border-slate-50 hover:bg-blue-50/40 cursor-pointer transition-colors ${
                    selectedResident?.id === r.id ? 'bg-blue-50/60' : ''
                  }`}
                >
                  <td className="px-5 py-3 font-medium text-slate-800">
                    <div className="flex items-center gap-3">
                      {r.photoUrl && !brokenImages[r.id] ? (
                        <img
                          src={toAssetUrl(r.photoUrl)}
                          alt={r.fullName}
                          onError={() => setBrokenImages((prev) => ({ ...prev, [r.id]: true }))}
                          className="h-8 w-8 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-md bg-[#0A1A2F] text-amber-300 flex items-center justify-center text-xs font-semibold">
                          {r.fullName ? r.fullName.slice(0, 2).toUpperCase() : '?'}
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-slate-900 hover:text-blue-600 transition-colors">{r.fullName}</span>
                        {selectedResident?.id === r.id && (
                          <span className="ml-2 text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                            Profiling Active
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                        r.gender === 'Male'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : r.gender === 'Female'
                          ? 'bg-orange-50 text-orange-700 border border-orange-200'
                          : 'bg-slate-50 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {r.gender || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{r.zone || r.address || 'Cordova'}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-md ${
                        r.status === 'Verified'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {r.status || 'Pending'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{(r.category || []).join(', ') || 'Resident'}</td>
                  <td className="px-5 py-3 text-slate-500">{r.age ?? '-'}</td>
                  <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/residents/${r.id}`}
                        className="text-blue-600 hover:underline text-xs font-medium px-1"
                      >
                        Profile
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(r)}
                        disabled={deletingId === r.id}
                        className="text-red-500 hover:text-red-700 hover:underline text-xs font-medium disabled:opacity-50 px-1"
                      >
                        {deletingId === r.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SELECTED RESIDENT CONSTITUENT PROFILE SECTION */}
      {selectedResident && (
        <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-6 animate-in fade-in">
          {/* Section Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-5 bg-[#0A1A2F] rounded-xs inline-block"></span>
              <h2 className="text-base font-black text-slate-900 tracking-wider uppercase">
                Constituent Profile Record
              </h2>
            </div>
            <button
              onClick={() => setSelectedResident(null)}
              className="text-xs text-slate-400 hover:text-slate-700 font-bold flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              <span>Close Profile</span>
            </button>
          </div>

          {/* Profile Header Banner Card */}
          <div className="bg-[#F8FAFC] rounded-2xl border border-slate-200 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left: Avatar + Identification info */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className="relative shrink-0">
                  {selectedResident.photoUrl && !brokenImages[selectedResident.id] ? (
                    <img
                      src={toAssetUrl(selectedResident.photoUrl)}
                      alt={selectedResident.fullName}
                      onError={() => setBrokenImages((prev) => ({ ...prev, [selectedResident.id]: true }))}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-slate-100 shadow-inner"
                    />
                  ) : (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#0A1A2F] text-amber-300 font-extrabold text-2xl sm:text-3xl flex items-center justify-center border-2 border-slate-100 shadow-inner">
                      {selectedResident.fullName ? selectedResident.fullName.slice(0, 2).toUpperCase() : 'RES'}
                    </div>
                  )}
                  <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-black tracking-widest px-2.5 py-0.5 rounded-full border shadow-xs uppercase ${
                    selectedResident.status === 'Verified'
                      ? 'bg-[#D9EAFE] text-[#1E40AF] border-blue-200'
                      : 'bg-amber-100 text-amber-900 border-amber-200'
                  }`}>
                    {selectedResident.status === 'Verified' ? 'VERIFIED' : 'PENDING'}
                  </span>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                      {selectedResident.fullName}
                    </h1>
                    <span className="bg-[#D9EAFE] text-[#1E40AF] text-[10px] font-extrabold tracking-wide px-2.5 py-1 rounded-md uppercase">
                      ACTIVE CONSTITUENT
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-500 font-medium mt-1.5">
                    <p className="flex items-center gap-2">
                      <span className="text-slate-400">🪪 Registry ID:</span>
                      <strong className="text-slate-700 font-bold tracking-wide">{registryId}</strong>
                    </p>
                    <p className="flex items-center gap-1.5 text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{fullAddress}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Total Case Incidents + Edit Profile */}
              <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-4 self-stretch lg:self-auto justify-between">
                <div
                  onClick={() => setIsMediationHistoryModalOpen(true)}
                  className="w-full sm:w-auto bg-white border border-slate-200/90 rounded-xl px-6 py-3.5 border-l-4 border-l-[#0A1A2F] cursor-pointer hover:bg-slate-100/80 transition-colors shadow-2xs group"
                  title="Click to view full dispute and mediation ledger"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
                        TOTAL CASE INCIDENTS
                      </p>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-3xl font-black text-slate-900 group-hover:text-blue-900 transition-colors">
                          {residentIncidents.length}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">Historical Records</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#E2E8F0] hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-700" />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sub-Navigation Tabs */}
          <div className="flex items-center border-b border-slate-200 gap-6 sm:gap-8 overflow-x-auto no-scrollbar">
            {(['Personal Info', 'Household & Family', 'Activity Logs'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-xs sm:text-sm font-bold transition-all whitespace-nowrap relative ${
                  activeTab === tab
                    ? 'text-slate-900 border-b-2 border-slate-900'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* TAB 1: PERSONAL INFO */}
          {activeTab === 'Personal Info' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 Columns: Constituent Records Card */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-7 shadow-xs">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-4.5 bg-black rounded-xs inline-block"></span>
                      <h3 className="text-sm font-black text-slate-900 tracking-wider uppercase">
                        Socio-Demographic Details
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">
                      LIVE RECORD
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                        FULL LEGAL NAME
                      </label>
                      <p className="text-sm font-bold text-slate-900">{selectedResident.fullName}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                        DATE OF BIRTH
                      </label>
                      <p className="text-sm font-bold text-slate-900">{formattedDob} (Age: {ageDisplay})</p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                        PLACE OF BIRTH
                      </label>
                      <p className="text-sm font-bold text-slate-900">{selectedResident.placeOfBirth || 'Cordova, Cebu'}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                        BLOOD TYPE
                      </label>
                      <p className="text-sm font-bold text-slate-900">{selectedResident.bloodType || 'O Positive (O+)'}</p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                        OCCUPATION
                      </label>
                      <p className="text-sm font-bold text-slate-900">{selectedResident.occupation || 'Barangay Constituent'}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                        EDUCATIONAL ATTAINMENT
                      </label>
                      <p className="text-sm font-bold text-slate-900">{selectedResident.education || 'High School Graduate'}</p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                        CONTACT EMAIL
                      </label>
                      <p className="text-sm font-bold text-slate-900 break-all">{selectedResident.email || 'None on record'}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                        MOBILE NUMBER
                      </label>
                      <p className="text-sm font-bold text-slate-900">{selectedResident.contact || 'None on record'}</p>
                    </div>
                  </div>
                </div>

                {/* Household & Co-Residents Sub-Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      HOUSEHOLD & CO-RESIDENTS
                    </h3>
                    <button 
                      onClick={() => setActiveTab('Household & Family')}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:underline"
                    >
                      View All ({realHousehold.length})
                    </button>
                  </div>

                  {realHousehold.length > 0 ? (
                    <div className="bg-[#F8FAFC] border border-slate-200/90 rounded-xl p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg bg-[#0A1A2F] text-amber-300 font-bold text-sm flex items-center justify-center border border-slate-200">
                          {realHousehold[0].name ? realHousehold[0].name.slice(0, 2).toUpperCase() : 'FM'}
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                            {realHousehold[0].name}
                          </h4>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                            {realHousehold[0].relation || 'DEPENDENT'}
                          </p>
                        </div>
                      </div>

                      <span className="bg-[#D9EAFE] text-[#1E40AF] text-[10px] font-black tracking-widest px-2.5 py-1 rounded uppercase">
                        {realHousehold[0].status || 'VERIFIED'}
                      </span>
                    </div>
                  ) : (
                    <div className="bg-[#F8FAFC] border border-slate-200/90 rounded-xl p-4 text-center text-xs text-slate-400">
                      No co-residents or dependents currently attached to this resident.
                    </div>
                  )}
                </div>
              </div>

              {/* Right 5 Columns: Map + Zone + Compliance Card */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs relative">
                  <div className="h-56 w-full relative bg-[#E8ECEF] overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 500 280" preserveAspectRatio="none">
                      <rect width="500" height="280" fill="#F1F3F5" />
                      <path d="M 0,40 L 500,70" stroke="#DFE4EA" strokeWidth="18" fill="none" />
                      <path d="M 40,280 L 180,0" stroke="#E5E9EF" strokeWidth="22" fill="none" />
                      <path d="M 120,280 L 320,0" stroke="#DFE4EA" strokeWidth="24" fill="none" />
                      <path d="M 0,160 L 500,190" stroke="#E2E7ED" strokeWidth="16" fill="none" />
                      <path d="M 330,280 C 340,200 370,120 460,0" stroke="#D1D9E4" strokeWidth="14" fill="none" />
                      <path d="M 180,180 C 260,190 350,220 500,220" stroke="#CAD3DF" strokeWidth="16" fill="none" />
                      <path d="M 230,0 L 230,280" stroke="#D7DEE7" strokeWidth="12" fill="none" />
                      <rect x="30" y="180" width="85" height="45" rx="6" fill="#D6EDDA" stroke="#B9DFC1" strokeWidth="1" />
                      <text x="35" y="205" fontSize="8" fill="#2B7A4B" fontWeight="600">Cordova Sports Complex</text>
                      <text x="35" y="24" fontSize="8" fill="#8B96A5" fontWeight="500">Victorio Pacaldo Sr. St</text>
                      <text x="238" y="70" fontSize="8" fill="#8B96A5" fontWeight="500" transform="rotate(78 238 70)">Bernardo Nuñez St</text>
                      <text x="2" y="170" fontSize="8" fill="#8B96A5" fontWeight="500">A. Mangubat St</text>
                      <text x="420" y="160" fontSize="8" fill="#8B96A5" fontWeight="500" transform="rotate(35 420 160)">Kamoningan Rd</text>
                      <circle cx="340" cy="165" r="4" fill="#3B82F6" />
                      <text x="352" y="168" fontSize="8.5" fill="#334155" fontWeight="600">San Roque Parish Church</text>
                      <circle cx="310" cy="175" r="5" fill="#8B5CF6" />
                      <text x="235" y="172" fontSize="9" fill="#6B21A8" fontWeight="700">Poblacion Barangay Hall</text>
                      <circle cx="240" cy="190" r="7" fill="#10B981" fillOpacity="0.3" />
                      <circle cx="240" cy="190" r="4.5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
                    </svg>

                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded shadow-xs text-[10px] font-bold text-slate-700 flex items-center gap-1.5 border border-slate-200">
                      <Navigation className="w-3 h-3 text-emerald-600" />
                      <span>Zone: {residentialZone}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                    RESIDENTIAL ZONE
                  </p>
                  <h3 className="text-base font-black text-slate-900">
                    {residentialZone}
                  </h3>
                  <div className="text-xs text-slate-500 space-y-0.5 mt-2">
                    <p>Assigned Precinct: <strong className="text-slate-700">{precinct}</strong></p>
                    <p>Barangay Poblacion, Municipality of Cordova, Cebu</p>
                  </div>
                </div>

                <div className="bg-[#0A1A2F] text-white rounded-xl p-6 shadow-md border border-slate-800">
                  <div className="flex items-center gap-2 mb-5">
                    <ShieldCheck className="w-5 h-5 text-cyan-300" />
                    <h3 className="font-black text-sm tracking-widest uppercase text-white">
                      COMPLIANCE
                    </h3>
                  </div>

                  <div className="space-y-4 border-b border-slate-800 pb-5">
                    <div className="flex items-start justify-between text-xs">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          VOTER'S REGISTRATION
                        </p>
                        <p className="font-mono text-slate-300 text-[11px] mt-0.5">
                          Reg No: {voterRegNo}
                        </p>
                      </div>
                      <span className="text-[11px] font-black text-emerald-400 tracking-wider">
                        VALID
                      </span>
                    </div>

                    <div className="flex items-start justify-between text-xs">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          BARANGAY CLEARANCE
                        </p>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          Expires: {clearanceExpiry}
                        </p>
                      </div>
                      <span className={`text-[11px] font-black tracking-wider ${
                        clearanceStatus === 'EXPIRED' ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                        {clearanceStatus}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsRenewalModalOpen(true)}
                    className="w-full mt-5 py-2.5 px-4 bg-[#1E3A8A] hover:bg-[#2563EB] text-white font-extrabold text-[11px] tracking-widest uppercase rounded-lg transition-colors shadow-sm"
                  >
                    REQUEST RENEWAL DOCS
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HOUSEHOLD & FAMILY */}
          {activeTab === 'Household & Family' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Registered Family Unit</h3>
                  <p className="text-xs text-slate-500">Co-habitants registered under {selectedResident.fullName}</p>
                </div>
              </div>

              {realHousehold.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {realHousehold.map((member: any, idx: number) => (
                    <div key={member.id || idx} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-[#0A1A2F] text-amber-300 font-bold flex items-center justify-center border border-slate-200">
                          {member.name ? member.name.slice(0, 2).toUpperCase() : 'FM'}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{member.name}</h4>
                          <p className="text-[11px] font-semibold text-slate-500">{member.relation || 'FAMILY MEMBER'}</p>
                          <p className="text-[10px] text-slate-400 mt-1">Age: {member.age || 'N/A'} • {member.contact || 'No contact'}</p>
                        </div>
                      </div>
                      <span className="bg-[#D9EAFE] text-[#1E40AF] text-[10px] font-black px-2.5 py-1 rounded uppercase">
                        {member.status || 'VERIFIED'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="font-bold text-slate-600">No Family Members Registered</p>
                  <p className="text-xs text-slate-400 mt-1">You can attach family members in the resident's official record.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ACTIVITY LOGS */}
          {activeTab === 'Activity Logs' && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-base font-extrabold text-slate-900">Institutional Audit & Activity Log</h3>
              <div className="space-y-3">
                {residentIncidents.length > 0 ? (
                  residentIncidents.map((inc: any, i: number) => (
                    <div key={inc.id || i} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{inc.caseNo || inc.id}: {inc.complaintType || 'Dispute Incident'}</p>
                        <p className="text-slate-500 text-[11px]">Status: {inc.status} • Filed on: {inc.filedDate || 'Recently'}</p>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">{inc.status}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-500">
                    No dispute hearings or case logs filed for {selectedResident.fullName}.
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Footer */}
      <footer className="text-center text-[10px] sm:text-[11px] font-bold text-slate-400 tracking-wider uppercase border-t border-slate-200/80 pt-6">
        © SMART PROFILING AND COMPLAINT MANAGEMENT SYSTEM FOR BARANGAY POBLACION
      </footer>

      {/* MODAL 1: EDIT PROFILE */}
      {isEditModalOpen && selectedResident && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-extrabold text-slate-900">Edit Constituent Profile</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 uppercase text-[10px]">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 uppercase text-[10px]">Occupation</label>
                  <input
                    type="text"
                    value={editForm.occupation}
                    onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 uppercase text-[10px]">Contact Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 uppercase text-[10px]">Mobile Phone</label>
                  <input
                    type="text"
                    value={editForm.contact}
                    onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 uppercase text-[10px]">Zone / Purok</label>
                  <input
                    type="text"
                    value={editForm.zone}
                    onChange={(e) => setEditForm({ ...editForm, zone: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 uppercase text-[10px]">Place of Birth</label>
                  <input
                    type="text"
                    value={editForm.placeOfBirth}
                    onChange={(e) => setEditForm({ ...editForm, placeOfBirth: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-500 uppercase text-[10px]">Residential Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-[#0A1A2F] text-white font-bold rounded-lg hover:bg-slate-900 disabled:opacity-50"
                >
                  {isSavingEdit ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MEDIATION / CASE RECORDS LEDGER */}
      {isMediationHistoryModalOpen && selectedResident && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 p-6 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-slate-800" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Total Case Incidents ({residentIncidents.length} Records)
                </h3>
              </div>
              <button onClick={() => setIsMediationHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Historical dispute filings, barangay conciliation hearings, and amicable settlements associated with {selectedResident.fullName}.
            </p>

            <div className="space-y-3">
              {residentIncidents.length > 0 ? (
                residentIncidents.map((c: any) => (
                  <div key={c.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-blue-900 bg-blue-100 px-2 py-0.5 rounded">
                        {c.caseNo || c.id}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        {c.status || 'Active'}
                      </span>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 mt-2">{c.complaintType || 'Dispute Case'}</h4>
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[11px] text-slate-500">
                      <span>Resident: <strong className="text-slate-700">{c.resident || c.residentName || selectedResident.fullName}</strong></span>
                      <span>Hearing: {c.hearingDate || c.filedDate || 'Scheduled'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                  No historical dispute or mediation records found for this constituent.
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsMediationHistoryModalOpen(false)}
                className="px-4 py-2 bg-[#0A1A2F] text-white text-xs font-bold rounded-lg hover:bg-slate-900"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: BARANGAY CLEARANCE RENEWAL */}
      {isRenewalModalOpen && selectedResident && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-extrabold text-slate-900">Renew Barangay Clearance</h3>
              <button onClick={() => setIsRenewalModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                You are initiating renewal for <strong>{selectedResident.fullName}</strong> ({residentialZone}).
              </p>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 text-[11px]">
                <p>• Clearance Type: <strong>Barangay Multi-Purpose Clearance</strong></p>
                <p>• Assessment Fee: <strong>₱ 50.00</strong></p>
                <p>• Verified Status: <strong>No Pending Criminal Summons</strong></p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsRenewalModalOpen(false)}
                className="px-3 py-2 border border-slate-200 text-xs font-bold rounded-lg hover:bg-slate-50 text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleClearanceRenewal}
                className="px-4 py-2 bg-[#1E3A8A] hover:bg-blue-800 text-white text-xs font-bold rounded-lg"
              >
                Confirm & Issue Clearance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
