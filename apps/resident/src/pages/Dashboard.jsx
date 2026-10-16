import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import ModernIcon from '../components/ModernIcons.jsx';
import { getAnnouncements, getMyComplaints, getMyMediations, getProfile, Session, statusBadgeClass, toAssetUrl } from '../api.js';

export default function Dashboard() {
  const [user, setUser] = useState(() => Session.getUser());
  const isVerified = user?.status === 'Verified';
  const [announcements, setAnnouncements] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [mediations, setMediations] = useState([]);
  const [lightboxAnnouncement, setLightboxAnnouncement] = useState(null);

  useEffect(() => {
    // Validate live account status with backend; kicks user to login if removed
    getProfile()
      .then((data) => {
        if (data?.user) {
          Session.setUser(data.user);
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isVerified) {
      getAnnouncements().then(setAnnouncements).catch(console.error);
    }
    getMyComplaints().then(setComplaints).catch(console.error);
    getMyMediations().then(setMediations).catch(console.error);
  }, [isVerified]);

  const complaintsAgainstMe = complaints.filter((c) => c.isAgainstMe);

  return (
    <>
      <Navbar />
      <div className="page dashboard-page">
        <h1 className="hero-title">Hello, {user ? user.firstName : 'Resident'}</h1>
        <p className="hero-sub">
          Welcome to your Smart Profiling and Complaint Management System. Access essential services,
          file reports, and stay connected with your community.
        </p>

        {!isVerified && (
          <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb', marginBottom: 20, padding: '16px 20px', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ color: '#b45309', fontSize: '0.95rem' }}>⏳ Account Pending Verification · Limited Access Active</strong>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 9px', borderRadius: 12, background: '#fef3c7', color: '#92400e' }}>
                LIMITED ACCESS
              </span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 }}>
              Your resident information could not yet be automatically verified against the Barangay Resident Database. You have <strong>limited access</strong>: you may submit complaints and track their status in real time. General announcements and official certificate issuance will be enabled once your residency is confirmed by barangay officials.
            </p>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 8 }}>
              <Link to="/file-complaint" style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 700, textDecoration: 'underline' }}>
                Submit a Complaint / Report →
              </Link>
              <Link to="/track" style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 700, textDecoration: 'underline' }}>
                Track Your Requests →
              </Link>
            </div>
          </div>
        )}

        {complaintsAgainstMe.length > 0 && (
          <div className="card" style={{ borderLeft: '4px solid #ef4444', background: '#fef2f2', marginBottom: 20, padding: '16px 20px', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ color: '#b91c1c', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ModernIcon name="warning" size={16} color="#b91c1c" /> Official Notice: Complaint Filed Involving You
              </strong>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 9px', borderRadius: 12, background: '#fee2e2', color: '#991b1b' }}>
                NOTICE AS RESPONDENT ({complaintsAgainstMe.length})
              </span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 }}>
              You are named as the respondent in <strong>Case #{complaintsAgainstMe[0].caseRef}</strong> ({complaintsAgainstMe[0].category || 'Formal Complaint'}). Under Barangay privacy protocols, the complainant&apos;s identity is protected.
            </p>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 8 }}>
              <Link to={`/track?ref=${encodeURIComponent(complaintsAgainstMe[0].caseRef)}`} style={{ fontSize: '0.85rem', color: '#b91c1c', fontWeight: 700, textDecoration: 'underline' }}>
                View Case Details →
              </Link>
              <Link to="/profile" style={{ fontSize: '0.85rem', color: '#64748b', textDecoration: 'underline' }}>
                View All Notices in Profile ({complaintsAgainstMe.length})
              </Link>
            </div>
          </div>
        )}

        {mediations.length > 0 && (
          <div className="card" style={{ borderLeft: '4px solid #6366f1', background: '#f5f3ff', marginBottom: 24, padding: '16px 20px', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
              <strong style={{ color: '#4338ca', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ModernIcon name="scale" size={16} color="#4338ca" /> Official Mediation Hearing Scheduled
              </strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {mediations[0].mediationStatus && (
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 12,
                    background: mediations[0].mediationStatus === 'Settled' ? '#dcfce7' :
                                mediations[0].mediationStatus === 'Cancelled' ? '#fee2e2' :
                                mediations[0].mediationStatus === 'Ongoing' ? '#fef3c7' :
                                mediations[0].mediationStatus === 'Rescheduled' ? '#ffedd5' :
                                mediations[0].mediationStatus === 'Unsettled' ? '#f1f5f9' : '#e0e7ff',
                    color: mediations[0].mediationStatus === 'Settled' ? '#15803d' :
                           mediations[0].mediationStatus === 'Cancelled' ? '#b91c1c' :
                           mediations[0].mediationStatus === 'Ongoing' ? '#b45309' :
                           mediations[0].mediationStatus === 'Rescheduled' ? '#c2410c' :
                           mediations[0].mediationStatus === 'Unsettled' ? '#475569' : '#4338ca',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                  }}>
                    {mediations[0].mediationStatus}
                  </span>
                )}
                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 9px', borderRadius: 12, background: '#e0f2fe', color: '#0369a1' }}>
                  ACTION REQUIRED
                </span>
              </div>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 }}>
              You have a scheduled {mediations[0].hearingStage || 'mediation session'} for <strong>Case #{mediations[0].caseId}</strong> on <strong>{mediations[0].date} {mediations[0].time ? `at ${mediations[0].time}` : ''}</strong> at {mediations[0].location || 'Barangay Hall'}. An official notice was also sent to your email.
            </p>
            {mediations[0].nextMeetingDate && (
              <div style={{ marginTop: 12, marginBottom: 12, padding: '10px 14px', background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ color: '#0f172a', marginTop: 2 }}>
                  <ModernIcon name="calendar" size={18} color="#0f172a" />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#0f172a', fontSize: '0.88rem' }}>
                      Next Hearing / Follow-up Session Scheduled
                    </strong>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#e0f2fe', color: '#0369a1' }}>
                      FOLLOW-UP
                    </span>
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#1e293b', fontWeight: 600, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ModernIcon name="calendar" size={14} color="#64748b" /> {mediations[0].nextMeetingDate} {mediations[0].nextMeetingTime ? `at ${mediations[0].nextMeetingTime}` : ''}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ModernIcon name="map-pin" size={13} color="#64748b" /> Venue: {mediations[0].nextMeetingVenue || 'Barangay Poblacion Mediation Hall'}
                  </div>
                </div>
              </div>
            )}
            <Link to={`/track?ref=${encodeURIComponent(mediations[0].caseId)}`} style={{ fontSize: '0.85rem', color: '#4f46e5', fontWeight: 700, textDecoration: 'underline' }}>
              View Hearing Details & Instructions →
            </Link>
          </div>
        )}

        <div className="section-title">
          <h3>Quick Actions</h3>
          <span className="pill-muted">{isVerified ? 'Available Actions' : 'Complaints & Tracking'}</span>
        </div>

        <div className="quick-actions-grid">
          <div className="card quick-action-card" style={{ margin: 0 }}>
            <div className="icon-badge">
              <ModernIcon name="megaphone" size={20} color="#0284c7" />
            </div>
            <h4>File Complaint</h4>
            <p>Report neighborhood issues, safety concerns, or infrastructure damages.</p>
            <Link to="/file-complaint"><button className="btn btn-sky">File Report →</button></Link>
          </div>

          <div className="card quick-action-card" style={{ margin: 0 }}>
            <div className="icon-badge">
              <ModernIcon name="chart" size={20} color="#1d4ed8" />
            </div>
            <h4>Track Complaints</h4>
            <p>Monitor real-time progress, hearings, and status of your filed reports.</p>
            <Link to="/track"><button className="btn btn-navy">Track Status →</button></Link>
          </div>
        </div>

        {isVerified && (
          <>
            <div className="section-title">
              <h3>Announcements</h3>
            </div>
            {announcements.length === 0 && <p style={{ color: 'var(--muted)' }}>No announcements yet.</p>}
            {announcements.map((a) => (
              <div className="announcement-banner" style={{ marginBottom: 16 }} key={a.id}>
                <div
                  className="cover"
                  onClick={a.imageUrl ? () => setLightboxAnnouncement(a) : undefined}
                  style={a.imageUrl ? {
                    backgroundColor: '#0f172a',
                    backgroundImage: `url(${toAssetUrl(a.imageUrl)})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    cursor: 'zoom-in',
                  } : undefined}
                >{a.tag || ''}</div>
                <div className="body">
                  <h4>{a.title}</h4>
                  <p>{a.body}</p>
                  <div className="date-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <ModernIcon name="calendar" size={13} color="#64748b" /> {a.eventDate || ''}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        <div className="section-title">
          <h3>Portal Activity &amp; Case Tracking</h3>
          <Link to="/track" style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 600 }}>Track Status →</Link>
        </div>
        <div className="card" style={{ padding: 0 }}>
          {complaints.length === 0 && (
            <div style={{ padding: 20, color: 'var(--muted)' }}>
              No requests filed yet. Use "File Report" to submit your first report.
            </div>
          )}
          {complaints.map((c) => (
            <Link
              to={`/track?ref=${encodeURIComponent(c.trackingId || c.caseRef || c.id)}`}
              key={c.id}
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <div className="history-row" style={{ padding: '16px 20px', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{c.nature}</div>
                  <div className="ref">Ref ID: #{c.trackingId} • Click to Track →</div>
                </div>
                <span className={`badge ${statusBadgeClass(c.status)}`}>{c.status.toUpperCase()}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {isVerified && lightboxAnnouncement && (
        <div className="lightbox-overlay" onClick={() => setLightboxAnnouncement(null)}>
          <button className="lightbox-close" onClick={() => setLightboxAnnouncement(null)} aria-label="Close">
            <ModernIcon name="close" size={16} />
          </button>
          <div className="lightbox-card" onClick={(e) => e.stopPropagation()}>
            <img src={toAssetUrl(lightboxAnnouncement.imageUrl)} alt="" className="lightbox-img" />
            <div className="lightbox-info">
              {lightboxAnnouncement.tag && <span className="pill-muted" style={{ marginBottom: 8, display: 'inline-block' }}>{lightboxAnnouncement.tag}</span>}
              <h4>{lightboxAnnouncement.title}</h4>
              {lightboxAnnouncement.body && <p>{lightboxAnnouncement.body}</p>}
              {lightboxAnnouncement.eventDate && (
                <div className="date-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <ModernIcon name="calendar" size={13} color="#64748b" /> {lightboxAnnouncement.eventDate}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
