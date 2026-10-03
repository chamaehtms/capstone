import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import InfrastructureReportCard from '../components/InfrastructureReportCard.jsx';
import { fileComplaint, Session } from '../api.js';

export default function FileComplaint() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const categoryParam = params.get('category') || 'complaint';
  const [activeTab, setActiveTab] = useState(categoryParam === 'infrastructure' ? 'infrastructure' : 'complaint');
  const user = Session.getUser();

  useEffect(() => {
    if (params.get('category') === 'infrastructure') {
      setActiveTab('infrastructure');
    } else if (params.get('category') === 'complaint') {
      setActiveTab('complaint');
    }
  }, [params]);

  const [form, setForm] = useState({
    barangayCaseNo: '',
    nature: '',
    complainantName: user?.fullName || '',
    complainantAddress: user?.address || '',
    respondentName: '',
    narrative: '',
    reliefSought: '',
  });

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

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidencePreview, setEvidencePreview] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleEvidenceFile(file) {
    setEvidenceError('');
    if (!file) {
      setEvidenceFile(null);
      setEvidencePreview(null);
      setIsVideo(false);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setEvidenceError('File is too large — max size for video and document evidence is 50MB.');
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
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const body = {
      category: 'Formal Complaint',
      nature: form.nature.trim(),
      barangayCaseNo: form.barangayCaseNo.trim(),
      complainantName: form.complainantName.trim() || (user ? user.fullName : ''),
      complainantAddress: form.complainantAddress.trim(),
      respondentName: form.respondentName.trim(),
      narrative: form.narrative.trim(),
      reliefSought: form.reliefSought.trim(),
      evidence: evidenceFile,
    };
    try {
      const complaint = await fileComplaint(body);
      sessionStorage.setItem('bp_last_complaint', JSON.stringify(complaint));
      navigate('/submission-success');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="page" style={{ paddingBottom: 60 }}>
        <div
          className="form-wrap"
          style={{
            maxWidth: activeTab === 'infrastructure' ? 880 : 760,
            margin: '0 auto',
            transition: 'max-width 0.2s ease',
          }}
        >
          <div className="form-header" style={{ marginBottom: 18 }}>
            <Link to="/services" className="back-arrow">←</Link>
            <h2>{activeTab === 'infrastructure' ? 'Infrastructure Report Card' : 'File Complaint'}</h2>
          </div>

          {/* Form Type Switcher */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#e2e8f0',
              borderRadius: 12,
              padding: 4,
              marginBottom: 24,
              gap: 4,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setActiveTab('complaint');
                setParams({ category: 'complaint' });
              }}
              style={{
                flex: 1,
                padding: '11px 16px',
                border: 'none',
                borderRadius: 8,
                backgroundColor: activeTab === 'complaint' ? '#ffffff' : 'transparent',
                color: activeTab === 'complaint' ? '#0f172a' : '#64748b',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: activeTab === 'complaint' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              ⚖️ Formal Barangay Dispute / Blotter
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('infrastructure');
                setParams({ category: 'infrastructure' });
              }}
              style={{
                flex: 1,
                padding: '11px 16px',
                border: 'none',
                borderRadius: 8,
                backgroundColor: activeTab === 'infrastructure' ? '#ffffff' : 'transparent',
                color: activeTab === 'infrastructure' ? '#0f172a' : '#64748b',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: activeTab === 'infrastructure' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              📋 Infrastructure Report Card
            </button>
          </div>

          {/* Render Active Form */}
          {activeTab === 'infrastructure' ? (
            <InfrastructureReportCard
              user={user}
              onSuccess={(complaint) => {
                sessionStorage.setItem('bp_last_complaint', JSON.stringify(complaint));
                navigate('/submission-success');
              }}
              onCancel={() => navigate('/services')}
            />
          ) : (
            <div className="legal-card">
              <div className="legal-header">
                <div className="line">REPUBLIC OF THE PHILIPPINES</div>
                <div className="line">PROVINCE OF CEBU</div>
                <div className="line">MUNICIPALITY OF CORDOVA</div>
                <div className="line">BARANGAY POBLACION</div>
                <div className="office">OFFICE OF THE LUPONG TAGAPAMAYAPA</div>
              </div>
              <hr className="dash" />

              {error && <div className="error-msg">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Barangay Case No.</label>
                    <input
                      value={form.barangayCaseNo}
                      onChange={(e) => update('barangayCaseNo', e.target.value)}
                      placeholder="Enter case number (if known)"
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">For</label>
                    <input
                      value={form.nature}
                      onChange={(e) => update('nature', e.target.value)}
                      placeholder="Nature of complaint (e.g., Unpaid Debt)"
                      required
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Complainant/s</label>
                  <input
                    value={form.complainantName}
                    onChange={(e) => update('complainantName', e.target.value)}
                    placeholder="Full Name(s) of Complainant"
                    required
                    style={{ marginBottom: 10 }}
                  />
                  <input
                    value={form.complainantAddress}
                    onChange={(e) => update('complainantAddress', e.target.value)}
                    placeholder="Address"
                  />
                </div>
                <p style={{ textAlign: 'right', fontStyle: 'italic', color: 'var(--muted)', margin: '4px 0' }}>
                  -against-
                </p>

                <div className="field">
                  <input
                    value={form.respondentName}
                    onChange={(e) => update('respondentName', e.target.value)}
                    placeholder="Full Name of Respondent"
                  />
                </div>

                <p className="legal-quote">
                  "I hereby complain against above named respondent for violating my rights and interest in the following manner:"
                </p>
                <div className="field">
                  <textarea
                    value={form.narrative}
                    onChange={(e) => update('narrative', e.target.value)}
                    placeholder="Provide a detailed narrative of the incident, including dates, times, and specific actions…"
                    required
                  />
                </div>

                <p className="legal-quote">
                  "THEREFORE, I pray, that the following relief be granted to me in accordance with law or equity:"
                </p>
                <div className="field">
                  <textarea
                    value={form.reliefSought}
                    onChange={(e) => update('reliefSought', e.target.value)}
                    placeholder="What specific action do you want the Barangay to take? (e.g., payment of debt, apology, cease and desist)"
                  />
                </div>

                <div
                  style={{
                    fontWeight: 800,
                    color: 'var(--navy)',
                    letterSpacing: '.03em',
                    fontSize: '.85rem',
                    margin: '20px 0 10px',
                  }}
                >
                  EVIDENCE / ATTACHMENTS (PHOTOS, VIDEOS & DOCUMENTS)
                </div>
                <label className="upload-box" htmlFor="evidence" style={{ cursor: 'pointer', display: 'block' }}>
                  <div className="icon">📷 🎥</div>
                  <strong>{evidenceFile ? evidenceFile.name : 'Upload photo, video recording, or document'}</strong>
                  <small>
                    PNG, JPG, PDF, or MP4/WebM video (Up to 50MB). Files are checked for valid signatures and authenticity.
                  </small>
                </label>
                <input
                  id="evidence"
                  type="file"
                  accept="image/*,video/*,application/pdf,.mp4,.mov,.webm,.avi,.mkv"
                  style={{ display: 'none' }}
                  onChange={(e) => handleEvidenceFile(e.target.files?.[0] || null)}
                />

                {/* Evidence Preview */}
                {evidenceFile && isVideo && evidencePreview && (
                  <div style={{ marginTop: 14, background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1d4ed8' }}>
                        🎬 Video Evidence Preview: {evidenceFile.name} ({(evidenceFile.size / (1024 * 1024)).toFixed(1)} MB)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleEvidenceFile(null)}
                        style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
                      >
                        ✕ Remove
                      </button>
                    </div>
                    <video
                      src={evidencePreview}
                      controls
                      style={{ width: '100%', maxHeight: 260, borderRadius: 8, background: '#000' }}
                    />
                  </div>
                )}

                {evidenceFile && !isVideo && evidencePreview && (
                  <div style={{ marginTop: 14, background: '#f8fafc', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#16a34a' }}>
                        📷 Image Evidence Preview: {evidenceFile.name} ({(evidenceFile.size / 1024).toFixed(1)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleEvidenceFile(null)}
                        style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
                      >
                        ✕ Remove
                      </button>
                    </div>
                    <img
                      src={evidencePreview}
                      alt="Preview"
                      style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)', objectFit: 'contain' }}
                    />
                  </div>
                )}

                {evidenceFile && !evidencePreview && (
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f1f5f9', padding: '8px 12px', borderRadius: 8, fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--navy)', fontWeight: 600 }}>
                      📄 Attached file: {evidenceFile.name} ({(evidenceFile.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleEvidenceFile(null)}
                      style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                )}

                {evidenceError && <p style={{ fontSize: '.8rem', color: '#c0392b', marginTop: 6 }}>{evidenceError}</p>}

                <hr className="dash" />
                <div className="sign-block">
                  <div style={{ marginBottom: 14, fontStyle: 'italic', color: 'var(--text)' }}>
                    Made this <b style={{ color: 'var(--navy)', fontStyle: 'normal' }}>{todayDay}{todaySuffix}</b> day of{' '}
                    <b style={{ color: 'var(--navy)', fontStyle: 'normal' }}>{todayMonth}</b>,{' '}
                    <b style={{ color: 'var(--navy)', fontStyle: 'normal' }}>{todayYear}</b>.
                  </div>
                  <div>
                    {form.complainantName ? (
                      <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>
                        {form.complainantName}
                      </div>
                    ) : null}
                    <div>Complainant Signature</div>
                  </div>
                  <strong>HON. RITCHEL S. BASILLOTE</strong>
                  Punong Barangay, Lupon Chairperson
                  <div style={{ marginTop: 14 }}>Attested by:</div>
                  <strong>AMELYN M. ZARAGOZA</strong>
                  Barangay Secretary
                </div>

                <p className="legal-fine">
                  © By submitting, you agree to provide truthful information. Filing a false report is subject to legal
                  penalties under Article 363 of the Revised Penal Code.
                </p>

                <button type="submit" className="btn btn-navy btn-block" disabled={loading}>
                  {loading ? 'Submitting…' : 'Submit Complaint →'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
