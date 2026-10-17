import React, { useEffect, useState } from 'react';
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
  X,
  Plus,
  RefreshCw,
  Navigation,
  Gavel,
  Printer,
  Camera,
  ArrowRight,
  Trash2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { toAssetUrl } from '../api';

function formatDate(value) {
  if (!value) return null;
  const cleanStr = String(value).split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  }
  return value;
}

export default function ResidentProfiling() {
  const [residents, setResidents] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [selectedResident, setSelectedResident] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Tabs & Modals
  const [activeTab, setActiveTab] = useState('Personal Info');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMediationHistoryModalOpen, setIsMediationHistoryModalOpen] = useState(false);
  const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);
  const [isSelectorModalOpen, setIsSelectorModalOpen] = useState(false);
  const [isAddFamilyModalOpen, setIsAddFamilyModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Add Family Member form state
  const [familyForm, setFamilyForm] = useState({
    name: '',
    relation: 'SPOUSE',
    age: '',
    contact: '',
    status: 'Pending' // allows unverified, pending, or verified
  });
  const [savingMember, setSavingMember] = useState(false);

  // Local clearance status toggle
  const [clearanceStatus, setClearanceStatus] = useState('EXPIRED');
  const [clearanceExpiry, setClearanceExpiry] = useState('Oct 12, 2025');

  // Edit profile form state
  const [editForm, setEditForm] = useState({
    fullName: '',
    occupation: '',
    education: '',
    email: '',
    contact: '',
    address: '',
    zone: '',
    placeOfBirth: '',
    bloodType: ''
  });

  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadAllData = async (preferredId = null) => {
    setLoading(true);
    try {
      const [resResidents, resComplaints] = await Promise.all([
        api.get('/residents'),
        api.get('/complaints')
      ]);

      const rList = resResidents.data?.residents || [];
      setResidents(rList);

      const cList = resComplaints.data?.complaints || [];
      setComplaints(cList);

      let target = null;
      if (preferredId) {
        target = rList.find((r) => r.id === preferredId);
      }
      if (!target && rList.length > 0) {
        target = rList[0];
      }

      if (target) {
        selectResident(target, cList);
      }
    } catch (err) {
      console.error(err);
      showNotification('Unable to load constituent profiling directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const selectResident = (r, allComplaints = complaints) => {
    setSelectedResident(r);
    setImgError(false);
    setEditForm({
      fullName: r.fullName || '',
      occupation: r.occupation || '',
      education: r.education || '',
      email: r.email || '',
      contact: r.contact || '',
      address: r.address || '',
      zone: r.zone || '',
      placeOfBirth: r.placeOfBirth || '',
      bloodType: r.bloodType || ''
    });
  };

  const handlePhotoUpload = async (e) => {
    if (!selectedResident) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await api.post(`/residents/${selectedResident.id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSelectedResident(res.data);
      setImgError(false);
      showNotification('Constituent photo updated.');
      loadAllData(selectedResident.id);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Unable to update photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedResident) return;
    try {
      const res = await api.put(`/residents/${selectedResident.id}`, editForm);
      setSelectedResident(res.data);
      setIsEditModalOpen(false);
      showNotification('Constituent profile updated successfully.');
      loadAllData(selectedResident.id);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to update constituent profile.');
    }
  };

  const handleClearanceRenewal = () => {
    setClearanceStatus('VALID');
    setClearanceExpiry('Oct 17, 2027');
    setIsRenewalModalOpen(false);
    showNotification('Barangay Clearance renewal request approved & issued.');
  };

  const handleAddFamilyMember = async (e) => {
    e.preventDefault();
    if (!selectedResident || !familyForm.name.trim()) return;
    setSavingMember(true);
    try {
      const res = await api.post(`/residents/${selectedResident.id}/household-member`, familyForm);
      setSelectedResident(res.data);
      setIsAddFamilyModalOpen(false);
      setFamilyForm({ name: '', relation: 'SPOUSE', age: '', contact: '', status: 'Pending' });
      showNotification(`Added ${familyForm.name} to family unit.`);
      loadAllData(selectedResident.id);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to add family member.');
    } finally {
      setSavingMember(false);
    }
  };

  const handleRemoveFamilyMember = async (memberId, memberName) => {
    if (!selectedResident) return;
    try {
      const res = await api.delete(`/residents/${selectedResident.id}/household-member/${encodeURIComponent(memberId)}`);
      setSelectedResident(res.data);
      showNotification(`Removed ${memberName} from family unit.`);
      loadAllData(selectedResident.id);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to remove family member.');
    }
  };

  // Filter complaints associated with the currently selected resident
  const residentCases = selectedResident
    ? complaints.filter(
        (c) =>
          (c.resident && String(c.resident).toLowerCase() === String(selectedResident.fullName).toLowerCase()) ||
          (c.residentName && String(c.residentName).toLowerCase() === String(selectedResident.fullName).toLowerCase()) ||
          (c.respondentName && String(c.respondentName).toLowerCase() === String(selectedResident.fullName).toLowerCase())
      )
    : [];

  const filteredResidents = residents.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.fullName || '').toLowerCase().includes(q) ||
      (r.id || '').toLowerCase().includes(q) ||
      (r.zone || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-500 font-medium">
        Loading Resident Profiling Directory…
      </div>
    );
  }

  if (!selectedResident) {
    return (
      <div className="p-16 text-center text-slate-500 font-medium">
        No resident profiles found.
      </div>
    );
  }

  const voterRegNo = selectedResident.id
    ? `REG-${selectedResident.id.slice(0, 4).toUpperCase()}-${String(selectedResident.residencyYears || '01').padStart(2, '0')}`
    : '1455-0922-A';

  const precinct = selectedResident.zone
    ? `PRECINCT-${selectedResident.zone.replace(/\D/g, '') || '0432-A'}`
    : 'PRECINCT-0432-A';

  const documents = [
    { name: 'Barangay Resident ID Card', idNum: `BID-${selectedResident.id?.slice(0, 8) || 'POB'}`, status: selectedResident.status === 'Verified' ? 'VALID' : 'PENDING', expiry: 'Perpetual' },
    { name: 'Barangay Tax Clearance (Cedula)', idNum: 'CCI-POB-2024-91', status: clearanceStatus, expiry: clearanceExpiry },
    { name: 'COMELEC Voter Certification', idNum: voterRegNo, status: 'VALID', expiry: 'Active List' }
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-800 font-sans pb-16 antialiased selection:bg-slate-200">
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

      {/* Top Search Header Bar */}
      <header className="bg-white border-b border-slate-200/90 -mt-2 sm:-mt-4 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-8 py-3.5 mb-6 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by constituent name, ID, or zone to switch profile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSelectorModalOpen(true)}
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-100 hover:bg-slate-200/60 focus:bg-white border border-transparent focus:border-slate-300 rounded-lg outline-none transition-all placeholder:text-slate-400 text-slate-800 font-medium"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSelectorModalOpen(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Users className="w-4 h-4 text-slate-600" />
              <span>Switch Resident ({residents.length})</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-2 sm:px-4">
        {/* Profile Header Banner Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            
            {/* Left: Avatar + Identification info */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="relative shrink-0 group">
                {selectedResident.photoUrl && !imgError ? (
                  <img
                    src={toAssetUrl(selectedResident.photoUrl)}
                    alt={selectedResident.fullName}
                    onError={() => setImgError(true)}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-slate-100 shadow-inner"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#0A1A2F] text-amber-300 font-extrabold text-2xl sm:text-3xl flex items-center justify-center border-2 border-slate-100 shadow-inner">
                    {selectedResident.fullName ? selectedResident.fullName.slice(0, 2).toUpperCase() : 'RES'}
                  </div>
                )}

                <label
                  className="absolute inset-0 rounded-2xl bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity text-[10px] font-bold"
                  title="Click to change photo"
                >
                  <Camera className="w-4 h-4 mb-1" />
                  <span>{uploadingPhoto ? 'Uploading…' : 'Change Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    className="hidden"
                  />
                </label>

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
                    <strong className="text-slate-700 font-bold tracking-wide">{selectedResident.id}</strong>
                  </p>
                  <p className="flex items-center gap-1.5 text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{selectedResident.address || 'Barangay Poblacion, Cordova, Cebu'}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Total Case Incidents + Edit Profile */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-4 self-stretch lg:self-auto justify-between">
              {/* Total Case Incidents Block */}
              <div
                onClick={() => setIsMediationHistoryModalOpen(true)}
                className="w-full sm:w-auto bg-[#F8FAFC] border border-slate-200/90 rounded-xl px-6 py-3.5 border-l-4 border-l-[#0A1A2F] cursor-pointer hover:bg-slate-100/80 transition-colors shadow-2xs group"
                title="Click to view full dispute and mediation ledger"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
                      TOTAL CASE INCIDENTS
                    </p>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-3xl font-black text-slate-900 group-hover:text-blue-900 transition-colors">
                        {residentCases.length}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">Historical Records</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Edit Profile Button */}
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
        <div className="flex items-center border-b border-slate-200 mb-6 gap-6 sm:gap-8 overflow-x-auto no-scrollbar">
          {['Personal Info', 'Household & Family', 'Activity Logs'].map((tab) => (
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
                
                {/* Section Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4.5 bg-black rounded-xs inline-block"></span>
                    <h2 className="text-sm font-black text-slate-900 tracking-wider uppercase">
                      CONSTITUENT RECORDS
                    </h2>
                  </div>
                  <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">
                    OFFICIAL RECORD
                  </span>
                </div>

                {/* 2-Column Details Grid */}
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
                    <p className="text-sm font-bold text-slate-900">
                      {formatDate(selectedResident.birthDate) || '-'} {selectedResident.age ? `(Age: ${selectedResident.age})` : ''}
                    </p>
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
                    <p className="text-sm font-bold text-slate-900">{selectedResident.bloodType || 'O+'}</p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                      OCCUPATION
                    </label>
                    <p className="text-sm font-bold text-slate-900">{selectedResident.occupation || 'Private Sector / Resident'}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                      EDUCATIONAL ATTAINMENT
                    </label>
                    <p className="text-sm font-bold text-slate-900">{selectedResident.education || 'College Graduate'}</p>
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

              {/* Uploaded Verification IDs Card */}
              {(selectedResident.idDocumentUrl || selectedResident.selfieIdUrl) && (
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Identity Verification Documents</span>
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {selectedResident.idDocumentUrl && (
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700">Valid ID Document</span>
                          <a
                            href={toAssetUrl(selectedResident.idDocumentUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-600 hover:underline font-semibold"
                          >
                            ↗ Open full
                          </a>
                        </div>
                        <div className="h-40 w-full flex items-center justify-center bg-white rounded-lg border border-slate-200 p-1.5 overflow-hidden">
                          <img
                            src={toAssetUrl(selectedResident.idDocumentUrl)}
                            alt="Valid ID"
                            className="h-full w-auto object-contain rounded"
                          />
                        </div>
                      </div>
                    )}
                    {selectedResident.selfieIdUrl && (
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700">Selfie Holding Valid ID</span>
                          <a
                            href={toAssetUrl(selectedResident.selfieIdUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-600 hover:underline font-semibold"
                          >
                            ↗ Open full
                          </a>
                        </div>
                        <div className="h-40 w-full flex items-center justify-center bg-white rounded-lg border border-slate-200 p-1.5 overflow-hidden">
                          <img
                            src={toAssetUrl(selectedResident.selfieIdUrl)}
                            alt="Selfie Holding ID"
                            className="h-full w-auto object-contain rounded"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right 5 Columns: Map + Zone + Compliance Card */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Interactive Stylized Map of Poblacion Cordova */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs relative">
                <div className="h-56 w-full relative bg-[#E8ECEF] overflow-hidden">
                  
                  {/* Custom SVG Render of Poblacion Cordova Streets & Landmarks */}
                  <svg className="w-full h-full" viewBox="0 0 500 280" preserveAspectRatio="none">
                    <rect width="500" height="280" fill="#F1F3F5" />
                    
                    {/* Street blocks */}
                    <path d="M 0,40 L 500,70" stroke="#DFE4EA" strokeWidth="18" fill="none" />
                    <path d="M 40,280 L 180,0" stroke="#E5E9EF" strokeWidth="22" fill="none" />
                    <path d="M 120,280 L 320,0" stroke="#DFE4EA" strokeWidth="24" fill="none" />
                    <path d="M 0,160 L 500,190" stroke="#E2E7ED" strokeWidth="16" fill="none" />
                    
                    {/* Primary Poblacion Avenue */}
                    <path d="M 330,280 C 340,200 370,120 460,0" stroke="#D1D9E4" strokeWidth="14" fill="none" />
                    <path d="M 180,180 C 260,190 350,220 500,220" stroke="#CAD3DF" strokeWidth="16" fill="none" />
                    <path d="M 230,0 L 230,280" stroke="#D7DEE7" strokeWidth="12" fill="none" />

                    {/* Green zone (Cordova Sports Complex) */}
                    <rect x="30" y="180" width="85" height="45" rx="6" fill="#D6EDDA" stroke="#B9DFC1" strokeWidth="1" />
                    <text x="35" y="205" fontSize="8" fill="#2B7A4B" fontWeight="600">Cordova Sports Complex</text>

                    {/* Street Names text */}
                    <text x="35" y="24" fontSize="8" fill="#8B96A5" fontWeight="500">Victorio Pacaldo Sr. St</text>
                    <text x="238" y="70" fontSize="8" fill="#8B96A5" fontWeight="500" transform="rotate(78 238 70)">Bernardo Nuñez St</text>
                    <text x="2" y="170" fontSize="8" fill="#8B96A5" fontWeight="500">A. Mangubat St</text>
                    <text x="420" y="160" fontSize="8" fill="#8B96A5" fontWeight="500" transform="rotate(35 420 160)">Kamoningan Rd</text>

                    {/* Landmark Pins */}
                    <circle cx="340" cy="165" r="4" fill="#3B82F6" />
                    <text x="352" y="168" fontSize="8.5" fill="#334155" fontWeight="600">San Roque Parish Church</text>

                    <circle cx="310" cy="175" r="5" fill="#8B5CF6" />
                    <text x="235" y="172" fontSize="9" fill="#6B21A8" fontWeight="700">Poblacion Barangay Hall</text>

                    {/* Resident Residence Pin */}
                    <circle cx="240" cy="190" r="7" fill="#10B981" fillOpacity="0.3" />
                    <circle cx="240" cy="190" r="4.5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
                  </svg>

                  {/* Corner indicator badge */}
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded shadow-xs text-[10px] font-bold text-slate-700 flex items-center gap-1.5 border border-slate-200">
                    <Navigation className="w-3 h-3 text-emerald-600" />
                    <span>Geo-Tagged: {selectedResident.zone || 'Barangay Poblacion'}</span>
                  </div>
                </div>
              </div>

              {/* Residential Zone Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  RESIDENTIAL ZONE
                </p>
                <h3 className="text-base font-black text-slate-900">
                  {selectedResident.zone || 'Barangay Poblacion'}
                </h3>
                <div className="text-xs text-slate-500 space-y-0.5 mt-2">
                  <p>Assigned Precinct: <strong className="text-slate-700">{precinct}</strong></p>
                  <p>Residency: <strong className="text-slate-700">{selectedResident.residencyYears || 0} years</strong> in Barangay Poblacion, Cordova</p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: HOUSEHOLD & FAMILY */}
        {activeTab === 'Household & Family' && (() => {
          const storedMembers = Array.isArray(selectedResident.household) ? selectedResident.household : [];
          const cohabitants = residents.filter((r) => r.id !== selectedResident.id && (
            (r.householdNumber && selectedResident.householdNumber && r.householdNumber === selectedResident.householdNumber) ||
            (r.address && selectedResident.address && r.address.toLowerCase().trim() === selectedResident.address.toLowerCase().trim()) ||
            (r.zone && selectedResident.zone && r.zone === selectedResident.zone && r.fullName?.split(' ').pop() === selectedResident.fullName?.split(' ').pop())
          ));

          return (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Registered Family Unit</h3>
                  <p className="text-xs text-slate-500">
                    Co-habitants & family members registered under Household Census Record #{selectedResident.householdNumber || `HH-${selectedResident.zone?.replace(/\s+/g, '-').toUpperCase() || 'POB'}-${selectedResident.id?.slice(0, 4).toUpperCase() || '001'}`}
                  </p>
                </div>
                <button
                  onClick={() => setIsAddFamilyModalOpen(true)}
                  className="px-3.5 py-1.5 bg-[#0A1A2F] text-white rounded-lg text-xs font-bold hover:bg-slate-800 flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Family Member</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Explicitly Added Family Members (stored in selectedResident.household) */}
                {storedMembers.map((member, idx) => (
                  <div key={member.id || idx} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-between group">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-[#0A1A2F] text-amber-300 font-extrabold text-sm flex items-center justify-center border border-slate-200 shrink-0">
                        {member.name ? member.name.slice(0, 2).toUpperCase() : 'FM'}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{member.name}</h4>
                        <p className="text-[11px] font-semibold text-slate-500">
                          {member.relation || 'FAMILY MEMBER'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {member.age ? `Age: ${member.age}` : 'Age: N/A'} • {member.contact || 'No phone record'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-wider ${
                        member.status === 'Verified'
                          ? 'bg-emerald-100 text-emerald-800'
                          : member.status === 'Pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {member.status || 'UNVERIFIED'}
                      </span>
                      <button
                        onClick={() => handleRemoveFamilyMember(member.id || member.name, member.name)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 transition-opacity rounded"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* 2. Co-habitants registered in directory with matching address/surname */}
                {cohabitants.slice(0, 4).map((member) => (
                  <div key={member.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 text-amber-300 font-extrabold text-sm flex items-center justify-center border border-slate-200 shrink-0">
                        {member.fullName?.slice(0, 2).toUpperCase() || 'FM'}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{member.fullName}</h4>
                        <p className="text-[11px] font-semibold text-slate-500">
                          {member.relationToHead || 'CO-HABITANT RESIDENT'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Age: {member.age || 'N/A'} • {member.contact || member.civilStatus || 'Barangay Poblacion'}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-wider ${
                      member.status === 'Verified'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {member.status || 'UNVERIFIED'}
                    </span>
                  </div>
                ))}

                {/* Empty State */}
                {storedMembers.length === 0 && cohabitants.length === 0 && (
                  <div className="col-span-full py-10 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <p className="text-sm font-bold text-slate-700">No family members registered yet.</p>
                    <p className="text-xs text-slate-400 mt-1">Click "Add Family Member" above to add verified or unverified household members.</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* TAB 4: ACTIVITY LOGS */}
        {activeTab === 'Activity Logs' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Institutional Audit & Activity Log</h3>
            <div className="space-y-3">
              {[
                { action: `Resident profile verified & updated in database`, by: 'Barangay Records Officer', time: 'Recently' },
                { action: `Registered under zone ${selectedResident.zone || 'Poblacion'}`, by: 'System Registry', time: 'Official Record' },
                { action: 'Voter precinct status validated', by: 'COMELEC Liaison Officer', time: 'Active' }
              ].map((log, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{log.action}</p>
                    <p className="text-slate-500 text-[11px]">Logged by: {log.by}</p>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-[10px] sm:text-[11px] font-bold text-slate-400 tracking-wider uppercase border-t border-slate-200/80 pt-6">
          ©SMART PROFILING AND COMPLAINT MANAGEMENT SYSTEM FOR BARANGAY POBLACION
        </footer>
      </main>

      {/* MODAL: Switch Resident Selector */}
      {isSelectorModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Select Resident Profile</h3>
                <p className="text-xs text-slate-500">Pick a registered constituent to view their full profile.</p>
              </div>
              <button onClick={() => setIsSelectorModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-3">
              <input
                type="text"
                placeholder="Type name, ID, or zone to filter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:border-slate-500"
              />
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {filteredResidents.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-400">No matching constituents found.</p>
              ) : (
                filteredResidents.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      selectResident(r);
                      setIsSelectorModalOpen(false);
                      showNotification(`Viewing profile for ${r.fullName}`);
                    }}
                    className={`p-3 border rounded-xl cursor-pointer transition-all flex items-center justify-between ${
                      selectedResident.id === r.id
                        ? 'border-[#0A1A2F] bg-slate-50 ring-1 ring-[#0A1A2F]'
                        : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {r.photoUrl ? (
                        <img src={toAssetUrl(r.photoUrl)} alt={r.fullName} className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[#0A1A2F] text-amber-300 font-bold text-xs flex items-center justify-center">
                          {r.fullName ? r.fullName.slice(0, 2).toUpperCase() : 'RE'}
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{r.fullName}</h4>
                        <p className="text-[11px] text-slate-500">ID: {r.id} • {r.zone || 'Poblacion'}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      {r.status || 'Active'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: EDIT PROFILE */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-extrabold text-slate-900">Edit Constituent Profile</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 uppercase text-[10px]">Full Legal Name</label>
                  <input
                    type="text"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800"
                    required
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
                  <label className="font-bold text-slate-500 uppercase text-[10px]">Place of Birth</label>
                  <input
                    type="text"
                    value={editForm.placeOfBirth}
                    onChange={(e) => setEditForm({ ...editForm, placeOfBirth: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-300 rounded font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 uppercase text-[10px]">Blood Type</label>
                  <input
                    type="text"
                    value={editForm.bloodType}
                    onChange={(e) => setEditForm({ ...editForm, bloodType: e.target.value })}
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
                  className="px-4 py-2 bg-[#0A1A2F] text-white font-bold rounded-lg hover:bg-slate-900"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MEDIATION / CASE RECORDS LEDGER */}
      {isMediationHistoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 p-6 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-slate-800" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Total Case Incidents ({residentCases.length} Records)
                </h3>
              </div>
              <button onClick={() => setIsMediationHistoryModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Historical dispute filings, barangay conciliation hearings, and complaints associated with {selectedResident.fullName}.
            </p>

            <div className="space-y-3">
              {residentCases.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs border border-dashed rounded-xl">
                  No dispute or mediation complaints on record for this resident.
                </div>
              ) : (
                residentCases.map((c) => (
                  <div key={c.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs text-blue-900 bg-blue-100 px-2 py-0.5 rounded">
                        {c.id}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        {c.status || 'Active'}
                      </span>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 mt-2">{c.title || c.category || 'Dispute Case'}</h4>
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[11px] text-slate-500">
                      <span>Resident: <strong className="text-slate-700">{c.residentName || c.resident || 'Complainant'}</strong></span>
                      <span>Respondent: <strong className="text-slate-700">{c.respondentName || '—'}</strong></span>
                      <span>Filed: {formatDate(c.filingDate || c.createdAt) || 'Recent'}</span>
                    </div>
                  </div>
                ))
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
      {isRenewalModalOpen && (
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
                You are initiating renewal for <strong>{selectedResident.fullName}</strong> ({selectedResident.zone || 'Barangay Poblacion'}).
              </p>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 text-[11px]">
                <p>• Clearance Type: <strong>Barangay Multi-Purpose Clearance</strong></p>
                <p>• Assessment Fee: <strong>₱ 50.00 {selectedResident.age >= 60 ? '(Senior Citizen Discount Applied)' : ''}</strong></p>
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

      {/* MODAL 4: ADD FAMILY MEMBER (Supports Verified, Pending, or Unverified) */}
      {isAddFamilyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Add Family Member</h3>
                <p className="text-xs text-slate-500">
                  Register a family member for {selectedResident.fullName} (verified or unverified).
                </p>
              </div>
              <button 
                onClick={() => setIsAddFamilyModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddFamilyMember} className="space-y-4">
              {/* Member Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maria Clara De Jesus"
                  value={familyForm.name}
                  onChange={(e) => setFamilyForm({ ...familyForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A1A2F]"
                />
              </div>

              {/* Relationship */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Relationship to Resident
                </label>
                <select
                  value={familyForm.relation}
                  onChange={(e) => setFamilyForm({ ...familyForm, relation: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A1A2F] bg-white"
                >
                  <option value="SPOUSE">Spouse</option>
                  <option value="SON">Son</option>
                  <option value="DAUGHTER">Daughter</option>
                  <option value="PARENT">Parent (Father / Mother)</option>
                  <option value="SIBLING">Sibling (Brother / Sister)</option>
                  <option value="DEPENDENT">Dependent / Minor Ward</option>
                  <option value="RELATIVE">Other Relative / Co-habitant</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Age */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    placeholder="e.g. 24"
                    value={familyForm.age}
                    onChange={(e) => setFamilyForm({ ...familyForm, age: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A1A2F]"
                  />
                </div>

                {/* Verification Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Verification Status
                  </label>
                  <select
                    value={familyForm.status}
                    onChange={(e) => setFamilyForm({ ...familyForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A1A2F] bg-white"
                  >
                    <option value="Unverified">Unverified</option>
                    <option value="Pending">Pending</option>
                    <option value="Verified">Verified</option>
                  </select>
                </div>
              </div>

              {/* Contact Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile / Contact Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 09171234567"
                  value={familyForm.contact}
                  onChange={(e) => setFamilyForm({ ...familyForm, contact: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A1A2F]"
                />
              </div>

              <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Family members can be added even if unverified or without a formal government ID account.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddFamilyModalOpen(false)}
                  className="px-3 py-2 border border-slate-200 text-xs font-bold rounded-lg hover:bg-slate-50 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMember}
                  className="px-4 py-2 bg-[#0A1A2F] hover:bg-slate-800 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                >
                  {savingMember ? 'Saving...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
