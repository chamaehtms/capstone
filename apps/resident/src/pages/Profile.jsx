import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import {
  getProfile, updatePreferences, updateProfile, changePassword,
  uploadProfilePhoto, Session, initials, toAssetUrl, statusBadgeClass
} from '../api.js';
import ModernIcon from '../components/ModernIcons.jsx';
import PurokMap from '../components/PurokMap.jsx';

export default function Profile() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [purokOptions, setPurokOptions] = useState([]);
  const [mode, setMode] = useState('view'); // 'view' | 'edit' | 'password'
  const [editForm, setEditForm] = useState(null);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    getProfile().then(d => {
      Session.setUser(d.user);
      setData(d);
    }).catch(e => setError(e.message));

    fetch('/api/puroks')
      .then(r => r.json())
      .then(p => {
        if (Array.isArray(p) && p.length > 0) {
          setPurokOptions(p.map(x => x.name));
        }
      })
      .catch(() => {});
  }, []);

  function startEdit() {
    setFormError('');
    // Extract local digits without +63 or leading 0
    let existingContact = (data.user.contactNumber || '').trim();
    if (existingContact.startsWith('+63')) {
      existingContact = existingContact.slice(3).trim();
    } else if (existingContact.startsWith('63')) {
      existingContact = existingContact.slice(2).trim();
    } else if (existingContact.startsWith('09')) {
      existingContact = existingContact.slice(1).trim();
    }
    const cleanDigits = existingContact.replace(/\D/g, '').slice(0, 10);

    setEditForm({
      fullName: data.user.fullName || '',
      dateOfBirth: data.user.dateOfBirth ? data.user.dateOfBirth.slice(0, 10) : '',
      sex: data.user.sex || '',
      civilStatus: data.user.civilStatus || '',
      contactNumber: cleanDigits,
      purok: data.user.purok || ''
    });
    setMode('edit');
  }

  function handleContactChange(e) {
    let digits = e.target.value.replace(/\D/g, '');
    if (digits.startsWith('09')) {
      digits = digits.slice(1);
    } else if (digits.startsWith('639')) {
      digits = digits.slice(2);
    }
    setEditForm(f => ({ ...f, contactNumber: digits.slice(0, 10) }));
  }

  async function saveEdit(e) {
    e.preventDefault();
    setFormError('');

    const localDigits = (editForm.contactNumber || '').trim().replace(/\D/g, '');
    if (!/^9\d{9}$/.test(localDigits)) {
      setFormError('Please enter a valid 10-digit mobile number starting with 9 (e.g. 9500897878).');
      return;
    }

    const fullContact = `+63${localDigits}`;

    if (editForm.dateOfBirth) {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (editForm.dateOfBirth > todayStr) {
        setFormError('Birthdate cannot be in the future. Please select a valid birthdate.');
        return;
      }
    }

    setSaving(true);
    try {
      const { user } = await updateProfile({ ...editForm, contactNumber: fullContact });
      Session.setUser(user);
      setData(d => ({ ...d, user }));
      setMode('view');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setFormError('');
    if (pwForm.newPassword !== pwForm.confirmPassword) { setFormError('New passwords do not match.'); return; }
    if (pwForm.newPassword.length < 8) { setFormError('New password must be at least 8 characters.'); return; }
    setSaving(true);
    try {
      await changePassword(pwForm.currentPassword, pwForm.newPassword);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMode('view');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { user } = await uploadProfilePhoto(file);
      Session.setUser(user);
      setData(d => ({ ...d, user }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function togglePush() {
    const newVal = !data.user.pushNotifications;
    setData(d => ({ ...d, user: { ...d.user, pushNotifications: newVal } }));
    try { await updatePreferences({ pushNotifications: newVal }); } catch (e) {}
  }
  async function toggleEmail() {
    const newVal = !data.user.emailAnnouncements;
    setData(d => ({ ...d, user: { ...d.user, emailAnnouncements: newVal } }));
    try { await updatePreferences({ emailAnnouncements: newVal }); } catch (e) {}
  }
  function logout() {
    Session.clear();
    navigate('/');
  }

  if (error) {
    const isAuthError = /token|unauthorized|expired|401/i.test(error);
    return (
      <>
        <Navbar />
        <div className="page">
          <div className="error-msg" style={{ marginTop: 20 }}>
            {error}
          </div>
          {isAuthError && (
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-navy"
                onClick={() => {
                  Session.clear();
                  navigate('/login');
                }}
              >
                Sign In Again →
              </button>
            </div>
          )}
        </div>
      </>
    );
  }
  if (!data) return (<><Navbar /><div className="page"><p style={{ marginTop: 20, color: 'var(--muted)' }}>Loading…</p></div></>);

  const {
    user,
    complaintsFiled,
    complaintsResolved,
    complaintsAgainstMe = 0,
    activeComplaintsAgainstMe = 0,
    complaintsAgainstMeList = [],
  } = data;

  const resolutionRate = complaintsFiled > 0 ? Math.round((complaintsResolved / complaintsFiled) * 100) : 0;

  return (
    <>
      <Navbar />
      <div className="page">
        <h1 className="hero-title" style={{ marginTop: 24 }}>Resident Profile</h1>

        {user.status === 'Pending' && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 18px', marginBottom: 20, color: '#92400e', fontSize: '0.88rem', lineHeight: 1.5 }}>
            <strong>⏳ Account Pending Verification:</strong> Your registration details have not yet been verified against the official Barangay Resident Database. Your account currently has limited access to file and monitor complaints.
          </div>
        )}

        <div className="profile-grid">
          <div>
            <label htmlFor="profilePhoto" style={{ cursor: 'pointer', display: 'inline-block', position: 'relative' }}>
              {user.photoUrl ? (
                <img src={toAssetUrl(user.photoUrl)} alt={user.fullName} className="avatar" style={{ objectFit: 'cover' }} />
              ) : (
                <div className="avatar">{initials(user.fullName)}</div>
              )}
              <span style={{
                position: 'absolute', bottom: 0, right: 0, background: 'var(--navy)', color: '#fff',
                borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '.7rem'
              }}>
                {uploadingPhoto ? '…' : <ModernIcon name="camera" size={12} color="#ffffff" />}
              </span>
            </label>
            <input id="profilePhoto" type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect} disabled={uploadingPhoto} />
            <div className="profile-name">{user.fullName}</div>
            <div style={{ margin: '4px 0 10px' }}>
              {user.status === 'Verified' ? (
                <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '2px 10px', borderRadius: 12, fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ModernIcon name="check" size={12} color="#15803d" /> Verified Resident
                </span>
              ) : (
                <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', padding: '2px 10px', borderRadius: 12, fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ModernIcon name="clock" size={12} color="#92400e" /> Pending Verification (Limited Access)
                </span>
              )}
            </div>
            <p className="profile-desc">
              Barangay Poblacion, Resident ID: {user.residentId}. Actively contributing to community safety and environmental initiatives.
            </p>
            {mode !== 'edit' && (
              <button className="btn btn-navy btn-block" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={startEdit}>
                <ModernIcon name="edit" size={14} color="#ffffff" /> Edit Profile
              </button>
            )}

            <div className="stat-card dark">
              <div className="label">
                <span style={{ display: 'flex', alignItems: 'center' }}><ModernIcon name="flag" size={14} color="#38bdf8" /></span>
                <span>Complaints Filed</span>
              </div>
              <div className="value">{String(complaintsFiled).padStart(2, '0')}</div>
              <div className="sub">{complaintsFiled ? `${complaintsResolved} successfully resolved` : 'No complaints filed by you'}</div>
            </div>

            <div className="stat-card light">
              <div className="label">
                <span style={{ display: 'flex', alignItems: 'center' }}><ModernIcon name="chart" size={14} color="#0284c7" /></span>
                <span style={{ fontWeight: 700 }}>Resolution Rate</span>
              </div>
              <div className="value">{String(resolutionRate).padStart(2, '0')}%</div>
              <div className="sub">
                {complaintsFiled > 0
                  ? `${complaintsResolved} of ${complaintsFiled} complaints resolved`
                  : 'No complaints filed by you'}
              </div>
            </div>
          </div>

          <div>
            {mode === 'edit' ? (
              <form className="card" style={{ marginBottom: 20 }} onSubmit={saveEdit}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ModernIcon name="user" size={16} color="#0284c7" /> Edit Personal Information
                </div>
                {formError && <div className="error-msg" style={{ marginBottom: 12 }}>{formError}</div>}
                <div className="field">
                  <label className="field-label">Full Name</label>
                  <input value={editForm.fullName} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))} required />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Birthdate</label>
                    <input
                      type="date"
                      min="1900-01-01"
                      max={new Date().toISOString().slice(0, 10)}
                      value={editForm.dateOfBirth}
                      onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Sex</label>
                    <select value={editForm.sex} onChange={e => setEditForm(f => ({ ...f, sex: e.target.value }))}>
                      <option value="">Select option</option>
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Civil Status</label>
                    <select value={editForm.civilStatus} onChange={e => setEditForm(f => ({ ...f, civilStatus: e.target.value }))}>
                      <option value="">Select option</option>
                      <option>Single</option>
                      <option>Married</option>
                      <option>Widowed</option>
                      <option>Separated</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Contact Number</label>
                    <div className="phone-row">
                      <input
                        value="+63"
                        disabled
                        aria-label="Country Code"
                        style={{
                          textAlign: 'center',
                          fontWeight: 600,
                          cursor: 'not-allowed',
                          userSelect: 'none',
                        }}
                      />
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="9500897878"
                        value={editForm.contactNumber}
                        onChange={handleContactChange}
                        required
                        aria-label="10-digit mobile number"
                      />
                    </div>
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Purok / Zone</label>
                  <select value={editForm.purok} onChange={e => setEditForm(f => ({ ...f, purok: e.target.value }))}>
                    <option value="">Select location</option>
                    {(purokOptions.length > 0
                      ? purokOptions
                      : ['Camolinas Centro', 'Atabay', 'Calan', 'Housing', 'Puso', 'Intra', 'Crossroad']
                    ).map((pName) => (
                      <option key={pName} value={pName}>{pName}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button type="submit" className="btn btn-navy" style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
                  <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setMode('view')} disabled={saving}>Cancel</button>
                </div>
              </form>
            ) : (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ModernIcon name="user" size={16} color="#0284c7" /> Personal Information
                </div>
                <div className="info-grid"><div className="k">Account Status</div><div className="v">
                  {user.status === 'Verified' ? (
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>Verified Resident</span>
                  ) : (
                    <span style={{ color: '#d97706', fontWeight: 700 }}>Pending Verification (Limited Access)</span>
                  )}
                </div></div>
                <div className="info-grid"><div className="k">Birthdate</div><div className="v">
                  {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                </div></div>
                <div className="info-grid"><div className="k">Contact Number</div><div className="v">{user.contactNumber || '—'}</div></div>
                <div className="info-grid"><div className="k">Purok / District</div><div className="v">{user.purok || '—'}</div></div>
                <div className="info-grid"><div className="k">Civil Status</div><div className="v">{user.civilStatus || '—'}</div></div>
              </div>
            )}

            {/* Dynamic Resident Profile Map Based on Assigned Purok/Zone */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ModernIcon name="map-pin" size={16} color="#0284c7" /> Jurisdictional Profile Map
                </span>
                <span style={{ fontSize: '0.74rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                  {user.purok || 'Barangay Poblacion'}
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 12px', lineHeight: 1.5 }}>
                Interactive map dynamically centered on your registered Purok / Zone in Poblacion, Cordova. Includes verified municipal boundaries, neighborhood landmarks, and geo-location points.
              </p>
              <PurokMap zoneName={user.purok} height="320px" />
            </div>



            {complaintsAgainstMe > 0 && (
              <div className="card" style={{ marginBottom: 20, border: '1px solid #fecaca', background: '#fffafb' }}>
                <div className="card-title" style={{ color: '#991b1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ModernIcon name="scale" size={16} color="#991b1b" /> Notice of Complaints Involving You ({complaintsAgainstMe})
                  </span>
                  <span style={{ fontSize: '0.72rem', background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: 8, fontWeight: 700 }}>
                    OFFICIAL NOTICE
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 16px' }}>
                  An official complaint has named you as the respondent. Under Barangay Poblacion confidentiality protocols, the complainant&apos;s identity is strictly protected.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {complaintsAgainstMeList.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: '14px 16px',
                        background: '#ffffff',
                        borderRadius: 10,
                        border: '1px solid #fed7aa',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontWeight: 800, color: 'var(--navy)', fontSize: '0.95rem' }}>Case #{c.id}</span>
                        <span className={`pill ${statusBadgeClass(c.status)}`}>{c.status}</span>
                      </div>

                      <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: 4 }}>
                        <strong>Category:</strong> {c.category || 'General Complaint'} • <strong>Filed:</strong> {c.filingDate ? new Date(c.filingDate).toLocaleDateString() : 'Recent'}
                      </div>

                      <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ModernIcon name="user" size={13} color="#64748b" /> <strong>Complainant:</strong>
                        </span>
                        <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 6, fontStyle: 'italic', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <ModernIcon name="lock" size={11} color="#64748b" /> Confidential / Anonymous Resident (Protected Identity)
                        </span>
                      </div>

                      {(c.narrative || c.nature) && (
                        <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, fontSize: '0.82rem', color: '#334155', marginBottom: 8, border: '1px solid var(--border)' }}>
                          <strong>Complaint Details:</strong> {c.narrative || c.nature}
                        </div>
                      )}

                      {c.reliefSought && (
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 8 }}>
                          <strong>Relief Sought:</strong> {c.reliefSought}
                        </div>
                      )}

                      {c.mediationDate && (
                        <div style={{ background: '#eff6ff', padding: '6px 10px', borderRadius: 6, fontSize: '0.8rem', color: '#1e40af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ModernIcon name="scale" size={13} color="#1e40af" /> <strong>Mediation Session:</strong> {c.mediationDate} {c.mediationTime || ''} at {c.mediationVenue || 'Barangay Hall'}
                        </div>
                      )}

                      <div style={{ textAlign: 'right', marginTop: 4 }}>
                        <Link to={`/track?ref=${encodeURIComponent(c.id)}`} className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '4px 12px' }}>
                          Track Case & Hearing Details →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mode === 'password' ? (
              <form className="card" style={{ marginBottom: 20 }} onSubmit={savePassword}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ModernIcon name="key" size={16} color="#0284c7" /> Change Password
                </div>
                {formError && <div className="error-msg" style={{ marginBottom: 12 }}>{formError}</div>}
                <div className="field">
                  <label className="field-label">Current Password</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPw.current ? 'text' : 'password'}
                      value={pwForm.currentPassword}
                      onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                      style={{ width: '100%', paddingRight: '44px' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => ({ ...p, current: !p.current }))}
                      aria-label={showPw.current ? 'Hide current password' : 'Show current password'}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 6,
                      }}
                    >
                      <ModernIcon name={showPw.current ? 'eye' : 'eye-off'} size={18} />
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">New Password</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPw.new ? 'text' : 'password'}
                      value={pwForm.newPassword}
                      onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                      style={{ width: '100%', paddingRight: '44px' }}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => ({ ...p, new: !p.new }))}
                      aria-label={showPw.new ? 'Hide new password' : 'Show new password'}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 6,
                      }}
                    >
                      <ModernIcon name={showPw.new ? 'eye' : 'eye-off'} size={18} />
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Confirm New Password</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPw.confirm ? 'text' : 'password'}
                      value={pwForm.confirmPassword}
                      onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      style={{ width: '100%', paddingRight: '44px' }}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => ({ ...p, confirm: !p.confirm }))}
                      aria-label={showPw.confirm ? 'Hide confirm new password' : 'Show confirm new password'}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 6,
                      }}
                    >
                      <ModernIcon name={showPw.confirm ? 'eye' : 'eye-off'} size={18} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button type="submit" className="btn btn-navy" style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving…' : 'Update Password'}</button>
                  <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setMode('view'); setFormError(''); }} disabled={saving}>Cancel</button>
                </div>
              </form>
            ) : (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ModernIcon name="shield" size={16} color="#0284c7" /> Account Security
                </div>
                <div className="list-row" style={{ cursor: 'pointer' }} onClick={() => { setFormError(''); setMode('password'); }}>
                  <div className="left">
                    <div className="ic" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ModernIcon name="key" size={16} color="#0284c7" />
                    </div>
                    <div>
                      <div className="title">Change Password</div>
                      <div className="sub">Tap to update your password</div>
                    </div>
                  </div>
                  <span className="chev">›</span>
                </div>
              </div>
            )}

            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ModernIcon name="shield" size={16} color="#0284c7" /> Preferences
              </div>
              <div className="list-row">
                <div className="left">
                  <div className="ic" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ModernIcon name="bell" size={16} color="#0284c7" />
                  </div>
                  <div className="title">Push Notifications</div>
                </div>
                <button className={`toggle ${user.pushNotifications ? 'on' : ''}`} onClick={togglePush}><div className="knob" /></button>
              </div>
              <div className="list-row">
                <div className="left">
                  <div className="ic" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ModernIcon name="mail" size={16} color="#0284c7" />
                  </div>
                  <div className="title">Email Announcements</div>
                </div>
                <button className={`toggle ${user.emailAnnouncements ? 'on' : ''}`} onClick={toggleEmail}><div className="knob" /></button>
              </div>
              <div className="list-row">
                <div className="left">
                  <div className="ic" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ModernIcon name="globe" size={16} color="#0284c7" />
                  </div>
                  <div><div className="title">Language</div><div className="sub">{user.language}</div></div>
                </div>
                <span className="chev">›</span>
              </div>
            </div>

            <button className="btn btn-danger-ghost" onClick={logout}>⇥ Log Out</button>

            <p style={{ fontSize: '.78rem', color: 'var(--muted)', textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
              The Smart Profiling system is built upon strict data privacy protocols. All personal information for Barangay Poblacion residents is encrypted and accessible only by authorized community administrators under the Data Privacy Act of 2012.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
