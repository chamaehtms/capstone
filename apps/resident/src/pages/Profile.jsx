import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import {
  getProfile, updatePreferences, updateProfile, changePassword,
  uploadProfilePhoto, Session, initials, toAssetUrl, statusBadgeClass, api
} from '../api.js';
import ModernIcon from '../components/ModernIcons.jsx';

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

export default function Profile() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [purokOptions, setPurokOptions] = useState([]);
  
  // Navigation tabs: 'Personal Info' | 'Disputes & Cases' | 'Account Security'
  const [activeTab, setActiveTab] = useState('Personal Info');

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);

  // Password Form State
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    getProfile().then(d => {
      Session.setUser(d.user);
      setData(d);
    }).catch(e => setError(e.message));

    api('/puroks')
      .then(p => {
        if (Array.isArray(p) && p.length > 0) {
          setPurokOptions(p.map(x => x.name));
        }
      })
      .catch(() => {});
  }, []);

  function openEditModal() {
    setFormError('');
    let existingContact = (data.user.contactNumber || data.user.contact || '').trim();
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
      sex: data.user.sex || data.user.gender || '',
      civilStatus: data.user.civilStatus || '',
      contactNumber: cleanDigits,
      purok: data.user.purok || data.user.zone || '',
      occupation: data.user.occupation || '',
      education: data.user.education || '',
      placeOfBirth: data.user.placeOfBirth || '',
      bloodType: data.user.bloodType || ''
    });
    setIsEditModalOpen(true);
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
      setIsEditModalOpen(false);
      showNotification('Constituent profile updated successfully.');
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setFormError('');
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setFormError('New passwords do not match.');
      return;
    }
    if (pwForm.newPassword.length < 8) {
      setFormError('New password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await changePassword(pwForm.currentPassword, pwForm.newPassword);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showNotification('Password updated successfully.');
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
      showNotification('Profile photo updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function togglePush() {
    const newVal = !data.user.pushNotifications;
    setData(d => ({ ...d, user: { ...d.user, pushNotifications: newVal } }));
    try {
      await updatePreferences({ pushNotifications: newVal });
      showNotification(`Push notifications turned ${newVal ? 'on' : 'off'}.`);
    } catch (e) {}
  }

  async function toggleEmail() {
    const newVal = !data.user.emailAnnouncements;
    setData(d => ({ ...d, user: { ...d.user, emailAnnouncements: newVal } }));
    try {
      await updatePreferences({ emailAnnouncements: newVal });
      showNotification(`Email announcements turned ${newVal ? 'on' : 'off'}.`);
    } catch (e) {}
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
        <div className="page" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div className="error-msg" style={{ maxWidth: 500, margin: '0 auto 16px' }}>
            {error}
          </div>
          {isAuthError && (
            <div>
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

  if (!data) {
    return (
      <>
        <Navbar />
        <div className="page" style={{ padding: '60px 24px', textAlign: 'center', color: '#64748b' }}>
          <p>Loading constituent profile…</p>
        </div>
      </>
    );
  }

  const {
    user,
    complaintsFiled = 0,
    complaintsResolved = 0,
    complaintsAgainstMe = 0,
    complaintsAgainstMeList = [],
  } = data;

  const resolutionRate = complaintsFiled > 0 ? Math.round((complaintsResolved / complaintsFiled) * 100) : 0;
  const isVerified = user.status === 'Verified';
  const totalIncidents = complaintsFiled + complaintsAgainstMe;
  const zoneName = user.purok || user.zone || 'Barangay Poblacion';
  const precinct = zoneName ? `PRECINCT-${zoneName.replace(/\D/g, '') || '0432-A'}` : 'PRECINCT-0432-A';

  return (
    <>
      <Navbar />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 9999,
          background: '#0a1a2f',
          color: '#ffffff',
          padding: '12px 18px',
          borderRadius: 10,
          boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: '0.86rem',
          border: '1px solid #334155'
        }}>
          <span style={{ color: '#4ade80' }}><ModernIcon name="check-circle" size={16} /></span>
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', marginLeft: 8 }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="page" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 60px' }}>
        
        {/* Pending Verification Notice Banner */}
        {!isVerified && (
          <div className="notice-card notice-card-amber" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ color: 'var(--amber-text)', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ModernIcon name="clock" size={16} color="var(--amber-text)" /> Account Pending Verification · Limited Access Active
              </strong>
              <span className="notice-badge notice-badge-amber">PENDING VERIFICATION</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#334155', lineHeight: 1.5 }}>
              Your registration details are currently pending official verification by Barangay Poblacion administrators. Your account has limited access to certain services until confirmed.
            </p>
          </div>
        )}

        {/* HERO BANNER CARD (Admin-Style) */}
        <div style={{
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          padding: '24px 28px',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
          marginBottom: 24
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 24
          }}>
            {/* Left: Avatar & Constituent Identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
                <label
                  htmlFor="profilePhotoInput"
                  title="Click to update photo"
                  style={{
                    cursor: 'pointer',
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    borderRadius: 16,
                    overflow: 'hidden',
                    border: '2px solid #e2e8f0'
                  }}
                >
                  {user.photoUrl ? (
                    <img
                      src={toAssetUrl(user.photoUrl)}
                      alt={user.fullName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      background: '#0a1a2f',
                      color: '#fde047',
                      fontWeight: 800,
                      fontSize: '1.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {initials(user.fullName) || 'RES'}
                    </div>
                  )}
                  {/* Hover Camera Overlay */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0,0,0,0.45)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    opacity: uploadingPhoto ? 1 : 0,
                    transition: 'opacity 0.2s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => !uploadingPhoto && (e.currentTarget.style.opacity = 0)}
                  >
                    <ModernIcon name="camera" size={16} color="#ffffff" />
                    <span>{uploadingPhoto ? 'Uploading…' : 'Change'}</span>
                  </div>
                </label>
                <input
                  id="profilePhotoInput"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoSelect}
                  disabled={uploadingPhoto}
                />

                {/* Badge underneath avatar */}
                <span style={{
                  position: 'absolute',
                  bottom: -8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  padding: '2px 8px',
                  borderRadius: 999,
                  textTransform: 'uppercase',
                  border: isVerified ? '1px solid #bfdbfe' : '1px solid #fde68a',
                  background: isVerified ? '#dbeafe' : '#fef3c7',
                  color: isVerified ? '#1e40af' : '#92400e',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  {isVerified ? 'VERIFIED' : 'PENDING'}
                </span>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                  <h1 style={{
                    margin: 0,
                    fontSize: '1.65rem',
                    fontWeight: 900,
                    color: '#0f172a',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2
                  }}>
                    {user.fullName}
                  </h1>
                  <span style={{
                    background: '#dbeafe',
                    color: '#1e40af',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    padding: '3px 8px',
                    borderRadius: 6,
                    textTransform: 'uppercase'
                  }}>
                    ACTIVE CONSTITUENT
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#94a3b8' }}>🪪 Registry ID:</span>
                    <strong style={{ color: '#334155', letterSpacing: '0.02em' }}>
                      {user.residentId || user.id || 'POB-RES-0000'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ModernIcon name="map-pin" size={13} color="#94a3b8" />
                    <span>{zoneName}, Cordova, Cebu</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Total Cases Stat Box & Edit Profile Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '12px 18px',
                minWidth: 160
              }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.06em', color: '#94a3b8', textTransform: 'uppercase' }}>
                  TOTAL CASE INCIDENTS
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a' }}>
                    {totalIncidents}
                  </span>
                  <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                    {complaintsFiled} Filed · {complaintsAgainstMe} Named
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={openEditModal}
                style={{
                  background: '#e2e8f0',
                  color: '#1e293b',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 18px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'}
                onMouseLeave={e => e.currentTarget.style.background = '#e2e8f0'}
              >
                <ModernIcon name="edit" size={14} color="#1e293b" />
                <span>Edit Profile</span>
              </button>
            </div>
          </div>
        </div>

        {/* SUB-NAVIGATION TABS (Admin-Style) */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          gap: 28,
          marginBottom: 24,
          overflowX: 'auto'
        }}>
          {[
            { id: 'Personal Info', label: 'Personal Info' },
            { id: 'Disputes & Cases', label: `Disputes & Cases (${totalIncidents})` },
            { id: 'Account Security', label: 'Account Security' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0 0 12px',
                fontSize: '0.88rem',
                fontWeight: activeTab === tab.id ? 800 : 600,
                color: activeTab === tab.id ? '#0f172a' : '#64748b',
                borderBottom: activeTab === tab.id ? '2px solid #0f172a' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: PERSONAL INFO */}
        {activeTab === 'Personal Info' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 24 }} className="profile-layout-grid">
            
            {/* Left Column: Constituent Records Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{
                background: '#ffffff',
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                padding: '24px 26px',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 14,
                  borderBottom: '1px solid #f1f5f9',
                  marginBottom: 20
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 4, height: 16, background: '#0a1a2f', borderRadius: 2, display: 'inline-block' }}></span>
                    <h2 style={{ fontSize: '0.85rem', fontWeight: 900, color: '#0f172a', letterSpacing: '0.04em', margin: 0, textTransform: 'uppercase' }}>
                      CONSTITUENT RECORDS
                    </h2>
                  </div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', background: '#f1f5f9', padding: '3px 8px', borderRadius: 4 }}>
                    OFFICIAL RECORD
                  </span>
                </div>

                {/* 2-Column Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '20px 24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      FULL LEGAL NAME
                    </label>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                      {user.fullName}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      DATE OF BIRTH & AGE
                    </label>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                      {formatDate(user.dateOfBirth || user.birthDate) || '—'} {user.age ? `(Age: ${user.age})` : ''}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      SEX & GENDER
                    </label>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                      {user.sex || user.gender || '—'}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      CIVIL STATUS
                    </label>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                      {user.civilStatus || '—'}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      CONTACT EMAIL
                    </label>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', wordBreak: 'break-all' }}>
                      {user.email || '—'}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      MOBILE NUMBER
                    </label>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                      {user.contactNumber || user.contact || '—'}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      OCCUPATION
                    </label>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                      {user.occupation || 'Private Sector / Resident'}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      EDUCATIONAL ATTAINMENT
                    </label>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                      {user.education || 'College / Tertiary'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Identity Verification Documents Card */}
              {(user.idDocumentUrl || user.selfieIdUrl) && (
                <div style={{
                  background: '#ffffff',
                  borderRadius: 14,
                  border: '1px solid #e2e8f0',
                  padding: '22px 24px',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 16,
                    fontSize: '0.85rem',
                    fontWeight: 900,
                    color: '#0f172a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}>
                    <ModernIcon name="shield" size={16} color="#0284c7" />
                    <span>Identity Verification Documents</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                    {user.idDocumentUrl && (
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, background: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155' }}>Valid ID Document</span>
                          <a
                            href={toAssetUrl(user.idDocumentUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 700, textDecoration: 'none' }}
                          >
                            ↗ Open Full
                          </a>
                        </div>
                        <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                          <img
                            src={toAssetUrl(user.idDocumentUrl)}
                            alt="Valid ID"
                            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                          />
                        </div>
                      </div>
                    )}

                    {user.selfieIdUrl && (
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, background: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155' }}>Selfie with ID</span>
                          <a
                            href={toAssetUrl(user.selfieIdUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 700, textDecoration: 'none' }}
                          >
                            ↗ Open Full
                          </a>
                        </div>
                        <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                          <img
                            src={toAssetUrl(user.selfieIdUrl)}
                            alt="Selfie holding ID"
                            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Residential Zone & Overview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Residential Zone Card */}
              <div style={{
                background: '#ffffff',
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                padding: '20px 22px',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
              }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 4 }}>
                  RESIDENTIAL ZONE
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                  {zoneName}
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>Assigned Precinct: <strong style={{ color: '#334155' }}>{precinct}</strong></div>
                  <div>Jurisdiction: <strong style={{ color: '#334155' }}>Barangay Poblacion, Cordova, Cebu</strong></div>
                  <div>Account Verification: <strong style={{ color: isVerified ? '#16a34a' : '#d97706' }}>{isVerified ? 'Fully Verified' : 'Pending Verification'}</strong></div>
                </div>
              </div>

              {/* Community Resolution Rate Stats */}
              <div style={{
                background: '#ffffff',
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                padding: '20px 22px',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
              }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 4 }}>
                  COMPLAINT RESOLUTION RATE
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: '2rem', fontWeight: 900, color: '#0284c7' }}>
                    {resolutionRate}%
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {complaintsResolved} of {complaintsFiled} complaints resolved
                  </span>
                </div>
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10 }}>
                  <Link
                    to="/file-complaint"
                    className="btn btn-navy"
                    style={{ flex: 1, fontSize: '0.8rem', padding: '8px 12px' }}
                  >
                    + File Complaint
                  </Link>
                  <Link
                    to="/track"
                    className="btn btn-outline"
                    style={{ flex: 1, fontSize: '0.8rem', padding: '8px 12px' }}
                  >
                    Track Complaints
                  </Link>
                </div>
              </div>

              {/* Data Privacy Policy Notice */}
              <div style={{
                background: '#f8fafc',
                borderRadius: 14,
                border: '1px dashed #cbd5e1',
                padding: '16px 18px',
                fontSize: '0.78rem',
                color: '#64748b',
                lineHeight: 1.55
              }}>
                <strong style={{ color: '#334155', display: 'block', marginBottom: 4 }}>🔒 Data Privacy Notice</strong>
                All constituent information is secured under strict Philippine Data Privacy Act (RA 10173) protocols and accessible only to authorized Barangay Poblacion officials.
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: DISPUTES & CASES */}
        {activeTab === 'Disputes & Cases' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Notice of Complaints Involving You (if any) */}
            {complaintsAgainstMe > 0 && (
              <div style={{
                background: '#fffafb',
                border: '1px solid #fecaca',
                borderRadius: 14,
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#991b1b', fontWeight: 900, fontSize: '0.95rem' }}>
                    <ModernIcon name="scale" size={18} color="#991b1b" />
                    <span>Notice of Complaints Involving You ({complaintsAgainstMe})</span>
                  </div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: 6, letterSpacing: '0.04em' }}>
                    OFFICIAL NOTICE
                  </span>
                </div>

                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 16px', lineHeight: 1.5 }}>
                  An official complaint has named you as the respondent. Under Barangay Poblacion confidentiality protocols, the complainant&apos;s identity is strictly protected.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {complaintsAgainstMeList.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: '16px 18px',
                        background: '#ffffff',
                        borderRadius: 12,
                        border: '1px solid #fed7aa',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 800, color: '#0a1a2f', fontSize: '0.95rem' }}>Case #{c.id}</span>
                        <span className={`pill ${statusBadgeClass(c.status)}`}>{c.status}</span>
                      </div>

                      <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: 6 }}>
                        <strong>Category:</strong> {c.category || 'General Complaint'} • <strong>Filed:</strong> {c.filingDate ? new Date(c.filingDate).toLocaleDateString() : 'Recent'}
                      </div>

                      <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ModernIcon name="user" size={13} color="#64748b" /> <strong>Complainant:</strong>
                        </span>
                        <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 6, fontStyle: 'italic', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <ModernIcon name="lock" size={11} color="#64748b" /> Confidential / Protected Identity
                        </span>
                      </div>

                      {(c.narrative || c.nature) && (
                        <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 8, fontSize: '0.82rem', color: '#334155', marginBottom: 8, border: '1px solid #e2e8f0' }}>
                          <strong>Complaint Details:</strong> {c.narrative || c.nature}
                        </div>
                      )}

                      {c.reliefSought && (
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 8 }}>
                          <strong>Relief Sought:</strong> {c.reliefSought}
                        </div>
                      )}

                      {c.mediationDate && (
                        <div style={{ background: '#eff6ff', padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem', color: '#1e40af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ModernIcon name="scale" size={14} color="#1e40af" /> <strong>Mediation Session:</strong> {c.mediationDate} {c.mediationTime || ''} at {c.mediationVenue || 'Barangay Hall'}
                        </div>
                      )}

                      <div style={{ textAlign: 'right', marginTop: 6 }}>
                        <Link to={`/track?ref=${encodeURIComponent(c.id)}`} className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '5px 14px' }}>
                          Track Case & Hearing Details →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Complaints Filed Summary Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              padding: '24px 26px',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                    Cases Filed by You
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Official disputes, formal complaints, and Lupon mediation requests submitted through your account.
                  </p>
                </div>
                <Link to="/file-complaint" className="btn btn-navy" style={{ fontSize: '0.8rem', padding: '7px 14px' }}>
                  + File New
                </Link>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>TOTAL FILED</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', marginTop: 4 }}>{complaintsFiled}</div>
                </div>

                <div style={{ background: '#ecfdf5', padding: '14px 18px', borderRadius: 10, border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>RESOLVED CASES</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#065f46', marginTop: 4 }}>{complaintsResolved}</div>
                </div>

                <div style={{ background: '#eff6ff', padding: '14px 18px', borderRadius: 10, border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase' }}>RESOLUTION RATE</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1e40af', marginTop: 4 }}>{resolutionRate}%</div>
                </div>
              </div>

              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <Link to="/track" className="btn btn-outline" style={{ fontSize: '0.84rem', padding: '8px 20px' }}>
                  View All Tracked Cases & Histories →
                </Link>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: ACCOUNT SECURITY & PREFERENCES */}
        {activeTab === 'Account Security' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 24 }} className="profile-layout-grid">
            
            {/* Change Password Card */}
            <div style={{
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              padding: '24px 26px',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <ModernIcon name="key" size={16} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
                  Change Account Password
                </h3>
              </div>

              {formError && <div className="error-msg" style={{ marginBottom: 14 }}>{formError}</div>}

              <form onSubmit={savePassword}>
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
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: 4
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
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: 4
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
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: 4
                      }}
                    >
                      <ModernIcon name={showPw.confirm ? 'eye' : 'eye-off'} size={18} />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-navy"
                  style={{ width: '100%', marginTop: 8 }}
                  disabled={saving}
                >
                  {saving ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </div>

            {/* Notification Preferences & Logout */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div style={{
                background: '#ffffff',
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                padding: '22px 24px',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <ModernIcon name="bell" size={16} color="#0284c7" />
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: '#0f172a' }}>
                    Notification Preferences
                  </h3>
                </div>

                <div className="list-row" style={{ padding: '12px 0' }}>
                  <div className="left">
                    <div className="ic" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ModernIcon name="bell" size={16} color="#0284c7" />
                    </div>
                    <div>
                      <div className="title" style={{ fontSize: '0.88rem' }}>Push Notifications</div>
                      <div className="sub" style={{ fontSize: '0.74rem' }}>Receive browser updates for case status</div>
                    </div>
                  </div>
                  <button className={`toggle ${user.pushNotifications ? 'on' : ''}`} onClick={togglePush}>
                    <div className="knob" />
                  </button>
                </div>

                <div className="list-row" style={{ padding: '12px 0' }}>
                  <div className="left">
                    <div className="ic" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ModernIcon name="mail" size={16} color="#0284c7" />
                    </div>
                    <div>
                      <div className="title" style={{ fontSize: '0.88rem' }}>Email Announcements</div>
                      <div className="sub" style={{ fontSize: '0.74rem' }}>Important barangay announcements</div>
                    </div>
                  </div>
                  <button className={`toggle ${user.emailAnnouncements ? 'on' : ''}`} onClick={toggleEmail}>
                    <div className="knob" />
                  </button>
                </div>
              </div>

              {/* Log Out Button */}
              <button
                type="button"
                className="btn btn-danger-ghost"
                onClick={logout}
                style={{ padding: '12px 20px', borderRadius: 10, fontWeight: 700 }}
              >
                ⇥ Sign Out of Resident Portal
              </button>

            </div>

          </div>
        )}

      </div>

      {/* EDIT CONSTITUENT PROFILE MODAL (Admin-Style) */}
      {isEditModalOpen && editForm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1500,
          padding: 20
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            maxWidth: 680,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            border: '1px solid #cbd5e1'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 24px',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 4, height: 16, background: '#0a1a2f', borderRadius: 2 }}></span>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                  Edit Constituent Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '1.2rem', cursor: 'pointer', padding: 4 }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={saveEdit} style={{ padding: '24px' }}>
              {formError && <div className="error-msg" style={{ marginBottom: 16 }}>{formError}</div>}

              <div className="field">
                <label className="field-label">Full Legal Name</label>
                <input
                  value={editForm.fullName}
                  onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))}
                  required
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label className="field-label">Date of Birth</label>
                  <input
                    type="date"
                    min="1900-01-01"
                    max={new Date().toISOString().slice(0, 10)}
                    value={editForm.dateOfBirth}
                    onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label className="field-label">Sex / Gender</label>
                  <select
                    value={editForm.sex}
                    onChange={e => setEditForm(f => ({ ...f, sex: e.target.value }))}
                  >
                    <option value="">Select option</option>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label className="field-label">Civil Status</label>
                  <select
                    value={editForm.civilStatus}
                    onChange={e => setEditForm(f => ({ ...f, civilStatus: e.target.value }))}
                  >
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
                      style={{ textAlign: 'center', fontWeight: 700, cursor: 'not-allowed', userSelect: 'none' }}
                    />
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="9500897878"
                      value={editForm.contactNumber}
                      onChange={handleContactChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label className="field-label">Occupation</label>
                  <input
                    value={editForm.occupation}
                    onChange={e => setEditForm(f => ({ ...f, occupation: e.target.value }))}
                    placeholder="e.g. Teacher, Engineer, Self-employed"
                  />
                </div>
                <div className="field">
                  <label className="field-label">Educational Attainment</label>
                  <input
                    value={editForm.education}
                    onChange={e => setEditForm(f => ({ ...f, education: e.target.value }))}
                    placeholder="e.g. College Graduate, High School"
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label">Residential Zone / Purok</label>
                <select
                  value={editForm.purok}
                  onChange={e => setEditForm(f => ({ ...f, purok: e.target.value }))}
                >
                  <option value="">Select location</option>
                  {(purokOptions.length > 0
                    ? purokOptions
                    : ['Camolinas Centro', 'Atabay', 'Calan', 'Housing', 'Puso', 'Intra', 'Crossroad']
                  ).map((pName) => (
                    <option key={pName} value={pName}>{pName}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="submit"
                  className="btn btn-navy"
                  style={{ flex: 1 }}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
