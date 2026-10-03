import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function CaseFiling() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    barangayCaseNo: '',
    nature: '',
    complainantName: '',
    complainantAddress: '',
    residentId: '',
    respondentName: '',
    respondentAddress: '',
    category: 'Formal Complaint',
    priority: 'Normal',
    narrative: '',
    reliefSought: '',
  });

  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidencePreview, setEvidencePreview] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');
  const [residents, setResidents] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const todayDay = today.getDate();
  const getOrdinalSuffix = (d) => {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1:  return 'st';
      case 2:  return 'nd';
      case 3:  return 'rd';
      default: return 'th';
    }
  };
  const todaySuffix = getOrdinalSuffix(todayDay);
  const todayMonth = today.toLocaleString('en-US', { month: 'long' });
  const todayYear = today.getFullYear();

  // Load existing residents for autocomplete suggestions
  useEffect(() => {
    api.get('/residents')
      .then(({ data }) => {
        setResidents(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, []);

  const update = (field) => (e) => {
    const val = e.target.value;
    setForm((prev) => ({ ...prev, [field]: val }));

    if (field === 'complainantName') {
      if (val.trim().length >= 2) {
        const matches = residents.filter((r) =>
          (r.fullName || '').toLowerCase().includes(val.toLowerCase())
        ).slice(0, 5);
        setSuggestions(matches);
        setShowSuggestions(matches.length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }
  };

  const selectResident = (res) => {
    setForm((prev) => ({
      ...prev,
      complainantName: res.fullName || '',
      complainantAddress: res.address || (res.purok ? `${res.purok}, Barangay Poblacion` : 'Barangay Poblacion'),
      residentId: res.id || '',
    }));
    setShowSuggestions(false);
  };

  const handleEvidenceFile = (file) => {
    setEvidenceError('');
    if (!file) {
      setEvidenceFile(null);
      setEvidencePreview(null);
      setIsVideo(false);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setEvidenceError('File is too large — maximum upload size for video / documents is 50MB.');
      return;
    }
    setEvidenceFile(file);
    const isVid = file.type.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name);
    setIsVideo(isVid);
    if (isVid || file.type.startsWith('image/')) {
      setEvidencePreview(URL.createObjectURL(file));
    } else {
      setEvidencePreview(null);
    }
  };

  const handleSaveDraft = () => {
    try {
      localStorage.setItem('bp_case_filing_draft', JSON.stringify(form));
      alert('Draft saved locally in browser.');
    } catch {
      alert('Unable to save draft.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.complainantName.trim()) {
      setError('Please provide the Complainant name.');
      return;
    }
    if (!form.nature.trim()) {
      setError('Please enter the nature of the complaint ("For").');
      return;
    }
    if (!form.narrative.trim()) {
      setError('Please provide a narrative of the incident.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('resident', form.complainantName.trim());
      formData.append('complainantName', form.complainantName.trim());
      formData.append('complainantAddress', form.complainantAddress.trim());
      formData.append('barangayCaseNo', form.barangayCaseNo.trim());
      formData.append('nature', form.nature.trim());
      formData.append('category', form.category);
      formData.append('priority', form.priority);
      formData.append('respondent', form.respondentName.trim());
      formData.append('respondentName', form.respondentName.trim());
      formData.append('respondentAddress', form.respondentAddress.trim());
      formData.append('narrative', form.narrative.trim());
      formData.append('reliefSought', form.reliefSought.trim());
      if (form.residentId) {
        formData.append('residentId', form.residentId);
      }
      if (evidenceFile) {
        formData.append('evidence', evidenceFile);
      }

      const { data } = await api.post('/complaints', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      localStorage.removeItem('bp_case_filing_draft');
      navigate(`/complaints/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to file case.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Breadcrumb & Page Info */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/complaints" className="text-sm font-semibold text-blue-600 hover:underline">
            ← Back to Complaints Record
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">File New Case</h1>
          <p className="text-sm text-slate-500">
            Official Katarungang Pambarangay (KP Form) blotter and dispute filing for Barangay Poblacion.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            ⚖️ Katarungang Pambarangay
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-red-600 hover:text-red-900">✕</button>
        </div>
      )}

      {/* Official Lupong Tagapamayapa Form Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10 relative">
        {/* Header Block: Republic of the Philippines / Lupong Tagapamayapa */}
        <div className="text-center mb-6 space-y-0.5">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
            Republic of the Philippines
          </p>
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
            Province of Cebu
          </p>
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
            Municipality of Cordova
          </p>
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
            Barangay Poblacion
          </p>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mt-2.5 tracking-wide uppercase border-b-2 border-slate-900 inline-block pb-0.5">
            Office of the Lupong Tagapamayapa
          </h2>
        </div>

        <hr className="border-t border-dashed border-slate-300 my-6" />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Top Row: Barangay Case No. & For */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Barangay Case No.
              </label>
              <input
                type="text"
                value={form.barangayCaseNo}
                onChange={update('barangayCaseNo')}
                placeholder="Leave blank to auto-generate (e.g., BC-2026-00001)"
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Auto-assigned with standard BC blotter sequence if left empty.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                For (Nature of Complaint) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.nature}
                onChange={update('nature')}
                placeholder="e.g., Unpaid Debt, Boundary Dispute, Physical Injuries"
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Primary grievance or cause of dispute.
              </span>
            </div>
          </div>

          {/* Complainant(s) Section */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 sm:p-5 relative">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Complainant / s <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-blue-600 font-medium">
                Type name to search registered residents
              </span>
            </div>

            <div className="space-y-3 relative">
              <div>
                <input
                  type="text"
                  value={form.complainantName}
                  onChange={update('complainantName')}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  placeholder="Full Name(s) of Complainant"
                  className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  required
                />

                {/* Autocomplete dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-11 z-20 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    <div className="p-1.5 text-[10px] font-bold text-slate-400 bg-slate-50 uppercase tracking-wider">
                      Matching Registered Residents:
                    </div>
                    {suggestions.map((r) => (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => selectResident(r)}
                        className="w-full text-left px-3.5 py-2 text-xs hover:bg-blue-50 flex items-center justify-between transition border-t border-slate-100"
                      >
                        <div>
                          <strong className="text-slate-800">{r.fullName}</strong>
                          <span className="text-slate-500 ml-2">({r.purok || 'Poblacion'})</span>
                        </div>
                        <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          {r.status || 'Verified'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <input
                  type="text"
                  value={form.complainantAddress}
                  onChange={update('complainantAddress')}
                  placeholder="Complete Address (e.g., Purok 4, Poblacion, Cordova, Cebu)"
                  className="w-full border border-slate-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Against Divider */}
          <div className="text-center sm:text-right px-2">
            <span className="text-xs italic font-semibold text-slate-400 tracking-wider">
              — against —
            </span>
          </div>

          {/* Respondent(s) Section */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 sm:p-5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Respondent / s <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              <input
                type="text"
                value={form.respondentName}
                onChange={update('respondentName')}
                placeholder="Full Name(s) of Respondent"
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                required
              />
              <input
                type="text"
                value={form.respondentAddress}
                onChange={update('respondentAddress')}
                placeholder="Complete Address of Respondent (if known)"
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>

          {/* Category & Priority Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Case Classification / Category
              </label>
              <select
                value={form.category}
                onChange={update('category')}
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
              >
                <option value="Formal Complaint">Formal Complaint (Lupong Tagapamayapa)</option>
                <option value="Noise Complaint">Noise & Disturbance</option>
                <option value="Public Nuisance">Public Nuisance</option>
                <option value="Boundary Dispute">Boundary Dispute</option>
                <option value="Sanitation">Sanitation & Environmental Waste</option>
                <option value="Utility Misuse">Utility / Water / Electric Misuse</option>
                <option value="Zoning Breach">Zoning / Construction Breach</option>
                <option value="Physical Injuries">Physical Altercation / Harassment</option>
                <option value="Other">Other Dispute</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Priority Level
              </label>
              <select
                value={form.priority}
                onChange={update('priority')}
                className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
              >
                <option value="Normal">Normal — Standard 15-day Conciliation Period</option>
                <option value="High">High — Immediate Attention / Urgent Notice</option>
                <option value="Critical">Critical — Immediate Intervention / Police Coordination</option>
              </select>
            </div>
          </div>

          {/* Legal Quote 1 & Narrative */}
          <div className="space-y-2">
            <p className="text-xs sm:text-sm font-semibold text-slate-700 italic bg-amber-50/70 border-l-4 border-amber-500 p-3 rounded-r-lg">
              "I hereby complain against above named respondent for violating my rights and interest in the following manner:"
            </p>
            <textarea
              value={form.narrative}
              onChange={update('narrative')}
              rows={5}
              placeholder="Provide a detailed narrative of the incident, including dates, times, specific actions, statements made, and circumstances…"
              className="w-full border border-slate-200 rounded-lg px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
              required
            />
          </div>

          {/* Legal Quote 2 & Relief Sought */}
          <div className="space-y-2">
            <p className="text-xs sm:text-sm font-semibold text-slate-700 italic bg-blue-50/70 border-l-4 border-blue-600 p-3 rounded-r-lg">
              "THEREFORE, I pray, that the following relief be granted to me in accordance with law or equity:"
            </p>
            <textarea
              value={form.reliefSought}
              onChange={update('reliefSought')}
              rows={3}
              placeholder="What specific action or amicable settlement do you want the Barangay to facilitate? (e.g., payment of debt, written apology, cease and desist, damages…)"
              className="w-full border border-slate-200 rounded-lg px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
            />
          </div>

          {/* Evidence / Attachments Section */}
          <div className="space-y-2 pt-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Evidence / Attachments
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition"
            >
              <div className="w-11 h-11 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-2 text-lg shadow-xs">
                📷 🎥
              </div>
              <strong className="block text-sm text-slate-800 mb-1">
                {evidenceFile ? evidenceFile.name : 'Upload documentary evidence, site photo, or video recording'}
              </strong>
              <p className="text-xs text-slate-500">
                Photos (PNG, JPG), Videos (MP4, MOV, WebM), or Documents (PDF, DOC) up to 50MB.
              </p>
              {evidenceFile && (
                <div className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded">
                  <span>✓ Selected: {evidenceFile.name} ({(evidenceFile.size / (1024 * 1024) > 1 ? (evidenceFile.size / (1024 * 1024)).toFixed(1) + ' MB' : (evidenceFile.size / 1024).toFixed(1) + ' KB')})</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEvidenceFile(null);
                    }}
                    className="text-red-500 hover:text-red-700 ml-1"
                  >
                    ✕ Remove
                  </button>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,application/pdf,.mp4,.mov,.webm,.avi,.mkv,.doc,.docx"
              className="hidden"
              onChange={(e) => handleEvidenceFile(e.target.files?.[0] || null)}
            />

            {evidencePreview && isVideo && (
              <div className="mt-3 p-3 bg-slate-900 rounded-xl border border-slate-800 shadow-md">
                <div className="flex items-center justify-between text-xs text-slate-300 mb-2 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span>🎬</span>
                    <span>Video Evidence Recording Preview</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleEvidenceFile(null)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    ✕ Remove
                  </button>
                </div>
                <video
                  src={evidencePreview}
                  controls
                  className="rounded-lg max-h-60 w-full bg-black mx-auto"
                />
              </div>
            )}

            {evidencePreview && !isVideo && (
              <div className="mt-3 p-2 bg-slate-100 rounded-lg max-w-sm">
                <img src={evidencePreview} alt="Preview" className="rounded-md max-h-48 object-cover mx-auto" />
              </div>
            )}

            {evidenceError && (
              <p className="text-xs text-red-600 mt-1">{evidenceError}</p>
            )}
          </div>

          <hr className="border-t border-dashed border-slate-300 my-6" />

          {/* Attestation & Signature Block */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 text-xs text-slate-600 space-y-4">
            <div className="italic">
              Made this <strong>{todayDay}{todaySuffix}</strong> day of{' '}
              <strong>{todayMonth}</strong>,{' '}
              <strong>{todayYear}</strong>.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-3">
              <div>
                <div className="border-b border-slate-400 w-48 mb-1.5 pt-8"></div>
                <div className="font-semibold text-slate-800">
                  {form.complainantName || 'Complainant Signature'}
                </div>
                <div className="text-[11px] text-slate-500">Complainant / Authorized Representative</div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="font-bold text-slate-900 text-sm">HON. RITCHEL S. BASILLOTE</div>
                  <div className="text-[11px] text-slate-500">Punong Barangay, Lupon Chairperson</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Attested by:</div>
                  <div className="font-bold text-slate-900 text-sm">AMELYN M. ZARAGOZA</div>
                  <div className="text-[11px] text-slate-500">Barangay Secretary</div>
                </div>
              </div>
            </div>
          </div>

          {/* Legal Fine Notice */}
          <p className="text-xs text-slate-500 leading-relaxed flex items-start gap-1.5">
            <span>⚖️</span>
            <span>
              By filing this case, you certify that the statements herein are true and correct. Filing a false report is
              subject to legal penalties under Article 363 of the Revised Penal Code and Republic Act No. 7160 (Katarungang
              Pambarangay Law).
            </span>
          </p>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/complaints')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
            >
              Save Draft
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold shadow-xs disabled:opacity-60 transition flex items-center justify-center gap-2"
            >
              <span>{loading ? 'Filing Case…' : 'Confirm & File Case (KP Form)'}</span>
              <span>→</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
