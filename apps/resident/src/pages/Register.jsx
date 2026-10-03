import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { register, Session } from '../api.js';

export default function Register() {
  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '', dateOfBirth: '', sex: '',
    contactNumber: '', purok: '', email: '', password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationResult, setRegistrationResult] = useState(null);
  const [idFile, setIdFile] = useState(null);
  const [idPhotoPreview, setIdPhotoPreview] = useState('');
  const [idFileError, setIdFileError] = useState('');

  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePhotoPreview, setSelfiePhotoPreview] = useState('');
  const [selfieFileError, setSelfieFileError] = useState('');

  function handleIdFile(file) {
    setIdFileError('');
    if (!file) {
      setIdFile(null);
      setIdPhotoPreview('');
      return;
    }
    const okType = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!okType) { setIdFileError('Only image or PDF files are allowed.'); return; }
    if (file.size > 5 * 1024 * 1024) { setIdFileError('File is too large — max size is 5MB.'); return; }
    setIdFile(file);
    if (file.type.startsWith('image/')) {
      setIdPhotoPreview(URL.createObjectURL(file));
    } else {
      setIdPhotoPreview('');
    }
  }

  function handleRemoveIdFile() {
    setIdFile(null);
    setIdPhotoPreview('');
    setIdFileError('');
  }

  function handleSelfieFile(file) {
    setSelfieFileError('');
    if (!file) {
      setSelfieFile(null);
      setSelfiePhotoPreview('');
      return;
    }
    const okType = file.type.startsWith('image/');
    if (!okType) { setSelfieFileError('Please select a valid image file (JPG, PNG, or WebP).'); return; }
    if (file.size > 5 * 1024 * 1024) { setSelfieFileError('Image file size must be less than 5MB.'); return; }
    setSelfieFile(file);
    setSelfiePhotoPreview(URL.createObjectURL(file));
  }

  function handleRemoveSelfieFile() {
    setSelfieFile(null);
    setSelfiePhotoPreview('');
    setSelfieFileError('');
  }

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.purok) { setError('Please select your Purok / Zone.'); return; }
    if (!form.email.trim()) { setError('Email is required — it doubles as your login and login recovery address.'); return; }
    if (!idFile) { setError('Please upload your valid ID card or document.'); return; }
    if (!selfieFile) { setError('Please upload a selfie holding your ID to confirm your identity.'); return; }

    setLoading(true);
    try {
      const body = {
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth,
        sex: form.sex,
        contactNumber: '+63 ' + form.contactNumber.trim(),
        purok: form.purok,
        email: form.email.trim(),
        password: form.password,
        idDocument: idFile,
        selfieWithId: selfieFile,
      };
      const data = await register(body);
      if (data.token && data.user) {
        Session.setToken(data.token);
        Session.setUser(data.user);
      }
      setRegistrationResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (registrationResult) {
    const isVerified = registrationResult.verified;
    const user = registrationResult.user;

    return (
      <div className="auth-scene auth-register-page">
        <div className="form-wrap">
          <div className="card auth-register-panel" style={{ padding: 36, textAlign: 'center' }}>
            <img src="/barangay-seal.png" alt="Barangay Poblacion seal" className="auth-logo" style={{ margin: '0 auto 12px' }} />

            {isVerified ? (
              <>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
                <div style={{
                  display: 'inline-block',
                  background: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #86efac',
                  padding: '4px 14px',
                  borderRadius: 9999,
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: 14
                }}>
                  ✓ Account Verified &amp; Approved
                </div>
                <h2 style={{ color: 'var(--navy)', margin: '0 0 10px', fontSize: '1.5rem', fontWeight: 800 }}>
                  Account Verified &amp; Approved!
                </h2>
                <p style={{ color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.6, fontSize: '0.92rem' }}>
                  A matching resident record was verified in the official <strong>Barangay Resident Database</strong>. Your account has been automatically approved for full portal access.
                </p>

                {user && (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '16px 20px',
                    textAlign: 'left',
                    marginBottom: 24,
                    fontSize: '0.88rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: '#64748b' }}>Resident Name:</span>
                      <strong style={{ color: '#0f172a' }}>{user.fullName}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: '#64748b' }}>Resident ID:</span>
                      <strong style={{ color: '#0f172a' }}>{user.id}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: '#64748b' }}>Purok / Zone:</span>
                      <strong style={{ color: '#0f172a' }}>{user.purok || '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Access Level:</span>
                      <strong style={{ color: '#16a34a' }}>● Full Resident Access</strong>
                    </div>
                  </div>
                )}

                <Link to="/dashboard">
                  <button className="btn btn-navy btn-block" style={{ padding: '12px 20px', fontSize: '0.95rem', fontWeight: 700 }}>
                    Enter Resident Portal →
                  </button>
                </Link>
              </>
            ) : (
              <>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>⏳</div>
                <div style={{
                  display: 'inline-block',
                  background: '#fef3c7',
                  color: '#92400e',
                  border: '1px solid #fcd34d',
                  padding: '4px 14px',
                  borderRadius: 9999,
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: 14
                }}>
                  ⏳ Account Pending Verification
                </div>
                <h2 style={{ color: 'var(--navy)', margin: '0 0 10px', fontSize: '1.5rem', fontWeight: 800 }}>
                  Registration Received
                </h2>
                <p style={{ color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.6, fontSize: '0.92rem' }}>
                  Your details could not yet be automatically matched against the pre-existing Barangay Resident Database.
                </p>

                <div style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 10,
                  padding: '14px 18px',
                  textAlign: 'left',
                  marginBottom: 20,
                  fontSize: '0.85rem',
                  color: '#92400e',
                  lineHeight: 1.5
                }}>
                  <strong>Limited Access Active:</strong> You can access the system and submit complaints, incident reports, and blotter filings immediately. Full resident services will become active once barangay staff confirms your resident records.
                </div>

                {user && (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '14px 18px',
                    textAlign: 'left',
                    marginBottom: 22,
                    fontSize: '0.86rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#64748b' }}>Account Name:</span>
                      <strong style={{ color: '#0f172a' }}>{user.fullName}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#64748b' }}>Status:</span>
                      <strong style={{ color: '#d97706' }}>Pending Verification</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Permitted Action:</span>
                      <strong style={{ color: '#0f172a' }}>Submit Complaints / Reports</strong>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Link to="/file-complaint">
                    <button className="btn btn-navy btn-block" style={{ padding: '12px 20px', fontSize: '0.95rem', fontWeight: 700 }}>
                      Submit a Complaint / Report →
                    </button>
                  </Link>
                  <Link to="/dashboard">
                    <button className="btn btn-outline btn-block" style={{ padding: '10px 16px' }}>
                      Go to Dashboard
                    </button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-scene auth-register-page">
      <div className="form-wrap">
        <div className="card auth-register-panel" style={{ padding: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <img src="/barangay-seal.png" alt="Barangay Poblacion seal" style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0 }} />
            <div>
              <h2 style={{ color: 'var(--navy)', margin: '0 0 2px', fontSize: '1.4rem' }}>Personal Information</h2>
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.04em' }}>BARANGAY POBLACION • RESIDENT ENROLLMENT</span>
            </div>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '.9rem', margin: '0 0 24px' }}>
            Please provide your official details as they appear on your government-issued identification cards.
          </p>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field-row">
              <div className="field">
                <label className="field-label">First Name</label>
                <input value={form.firstName} onChange={e => update('firstName', e.target.value)} placeholder="e.g. Alexander" required />
              </div>
              <div className="field">
                <label className="field-label">Middle Name</label>
                <input value={form.middleName} onChange={e => update('middleName', e.target.value)} placeholder="e.g. Sterling" />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">Last Name</label>
                <input value={form.lastName} onChange={e => update('lastName', e.target.value)} placeholder="e.g. Montgomery" required />
              </div>
              <div className="field">
                <label className="field-label">Date of Birth</label>
                <input type="date" value={form.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">Sex</label>
                <select value={form.sex} onChange={e => update('sex', e.target.value)}>
                  <option value="">Select option</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label">Contact Number</label>
                <div className="phone-row">
                  <input value="+63" disabled />
                  <input value={form.contactNumber} onChange={e => update('contactNumber', e.target.value)} placeholder="917 123 4567" required />
                </div>
              </div>
            </div>

            <div className="field">
              <label className="field-label">Purok / Zone</label>
              <select value={form.purok} onChange={e => update('purok', e.target.value)} required>
                <option value="">Select location</option>
                <option>Camulinas Centro</option>
                <option>Atabay</option>
                <option>Calan</option>
                <option>Housing</option>
                <option>Puso</option>
                <option> Intra </option>
                <option>crossroad </option>

              </select>
            </div>

            <div className="field">
              <label className="field-label">Email (used to sign in)</label>
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="field">
              <label className="field-label">Password</label>
              <input type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="Create a password" required minLength={6} />
            </div>

            {/* Field 1: Valid Government ID */}
            <div style={{ fontWeight: 800, color: 'var(--navy)', margin: '22px 0 4px' }}>
              1. Valid ID Card or Document <span style={{ color: '#dc2626' }}>*</span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '.82rem', color: 'var(--muted)' }}>
              Clear photo of your valid Government ID (PhilSys ID, Driver's License, Passport, Voter's ID, etc.)
            </p>
            {idFile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                {idPhotoPreview ? (
                  <img
                    src={idPhotoPreview}
                    alt="ID Preview"
                    style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: 8, background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', border: '1px solid #fecaca', flexShrink: 0 }}>
                    📄
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {idFile.name}
                  </div>
                  <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: 2 }}>
                    {(idFile.size / (1024 * 1024)).toFixed(2)} MB • ID Document Attached
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 14 }}>
                    <label style={{ fontSize: '.82rem', color: '#2563eb', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                      Change Photo
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        style={{ display: 'none' }}
                        onChange={e => handleIdFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveIdFile}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '.82rem', color: '#dc2626', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label className="upload-box" htmlFor="idDocumentInput" style={{ cursor: 'pointer', display: 'block' }}>
                <div className="icon">🪪</div>
                <strong>Click to upload your valid ID card</strong>
                <small>JPG, PNG, or PDF up to 5MB (Clear front-facing ID)</small>
                <input
                  id="idDocumentInput"
                  type="file"
                  accept="image/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={e => handleIdFile(e.target.files?.[0] || null)}
                />
              </label>
            )}
            {idFileError && <p style={{ fontSize: '.8rem', color: '#c0392b', marginTop: 6 }}>{idFileError}</p>}

            {/* Field 2: Selfie Holding Your ID */}
            <div style={{ fontWeight: 800, color: 'var(--navy)', margin: '22px 0 4px' }}>
              2. Selfie Holding Your Valid ID <span style={{ color: '#dc2626' }}>*</span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '.82rem', color: 'var(--muted)' }}>
              Take a selfie holding your ID next to your face so your face and ID details are both clearly visible.
            </p>
            {selfieFile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                {selfiePhotoPreview ? (
                  <img
                    src={selfiePhotoPreview}
                    alt="Selfie with ID Preview"
                    style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: 8, background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', border: '1px solid #bae6fd', flexShrink: 0 }}>
                    🤳
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selfieFile.name}
                  </div>
                  <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: 2 }}>
                    {(selfieFile.size / (1024 * 1024)).toFixed(2)} MB • Selfie Attached
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 14 }}>
                    <label style={{ fontSize: '.82rem', color: '#2563eb', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                      Change Photo
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => handleSelfieFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveSelfieFile}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '.82rem', color: '#dc2626', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label className="upload-box" htmlFor="selfieWithIdInput" style={{ cursor: 'pointer', display: 'block' }}>
                <div className="icon">🤳</div>
                <strong>Click to upload selfie holding your ID</strong>
                <small>JPG, PNG, or WebP up to 5MB (Clear selfie holding ID card)</small>
                <input
                  id="selfieWithIdInput"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => handleSelfieFile(e.target.files?.[0] || null)}
                />
              </label>
            )}
            {selfieFileError && <p style={{ fontSize: '.8rem', color: '#c0392b', marginTop: 6 }}>{selfieFileError}</p>}

            <div className="card" style={{ background: '#eaf3fd', borderColor: '#cfe4f9', margin: '22px 0 24px' }}>
              <strong style={{ color: 'var(--navy)' }}>🛡️ Secured Transmission</strong>
              <p style={{ margin: '6px 0 0', fontSize: '.85rem', color: 'var(--muted)' }}>
                Your data is encrypted using AES-256 standards. Only authorized civil personnel can access this information for verification purposes.
              </p>
            </div>

            <button type="submit" className="btn btn-navy btn-block" disabled={loading}>
              {loading ? 'Submitting…' : 'SUBMIT →'}
            </button>
            <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--muted)', fontSize: '.9rem' }}>
              Already registered? <Link to="/" className="link-blue">Sign In</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
