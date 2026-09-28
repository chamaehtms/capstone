import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { getAnnouncements, getMyComplaints, getMyMediations, Session, statusBadgeClass, toAssetUrl } from '../api.js';

export default function Dashboard() {
  const user = Session.getUser();
  const [announcements, setAnnouncements] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [mediations, setMediations] = useState([]);
  const [lightboxAnnouncement, setLightboxAnnouncement] = useState(null);

  useEffect(() => {
    getAnnouncements().then(setAnnouncements).catch(console.error);
    getMyComplaints().then(setComplaints).catch(console.error);
    getMyMediations().then(setMediations).catch(console.error);
  }, []);

  const complaintsAgainstMe = complaints.filter((c) => c.isAgainstMe);

  return (
    <>
      <Navbar />
      <div className="page">
        <h1 className="hero-title">Hello, {user ? user.firstName : 'Resident'}</h1>
        <p className="hero-sub">
          Welcome to your Smart Profiling and Complaint Management System. Access essential services,
          file reports, and stay connected with your community.
        </p>

        {complaintsAgainstMe.length > 0 && (
          <div className="card" style={{ borderLeft: '4px solid #ef4444', background: '#fef2f2', marginBottom: 20, padding: '16px 20px', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ color: '#b91c1c', fontSize: '0.95rem' }}>⚠️ Official Notice: Complaint Filed Involving You</strong>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ color: '#4338ca', fontSize: '0.95rem' }}>⚖️ Official Mediation Hearing Scheduled</strong>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 9px', borderRadius: 12, background: '#ede9fe', color: '#6d28d9' }}>
                ACTION REQUIRED
              </span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 }}>
              You have a scheduled {mediations[0].hearingStage || 'mediation session'} for <strong>Case #{mediations[0].caseId}</strong> on <strong>{mediations[0].date} {mediations[0].time ? `at ${mediations[0].time}` : ''}</strong> at {mediations[0].location || 'Barangay Hall'}. An official notice was also sent to your email.
            </p>
            {mediations[0].nextMeetingDate && (
              <div style={{ marginTop: 12, marginBottom: 12, padding: '10px 14px', background: '#ffffff', borderRadius: 8, border: '1px solid #e0e7ff', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: '1.25rem' }}>🗓️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#4338ca', fontSize: '0.88rem' }}>
                      Next Hearing / Follow-up Session Scheduled
                    </strong>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#ede9fe', color: '#6d28d9' }}>
                      FOLLOW-UP
                    </span>
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#1e293b', fontWeight: 600, marginTop: 3 }}>
                    📅 {mediations[0].nextMeetingDate} {mediations[0].nextMeetingTime ? `⏰ at ${mediations[0].nextMeetingTime}` : ''}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>
                    📍 Venue: {mediations[0].nextMeetingVenue || 'Barangay Poblacion Mediation Hall'}
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
          <span className="pill-muted">3 Available</span>
        </div>

        <div className="card quick-action-card">
          <div className="icon-badge">⚠️</div>
          <h4>File Complaint</h4>
          <p>Report neighborhood issues, safety concerns, or infrastructure damages.</p>
          <Link to="/file-complaint"><button className="btn btn-sky">File Report</button></Link>
        </div>

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
                backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,.55) 100%), url(${toAssetUrl(a.imageUrl)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                cursor: 'zoom-in',
              } : undefined}
            >{a.tag || ''}</div>
            <div className="body">
              <h4>{a.title}</h4>
              <p>{a.body}</p>
              <div className="date-tag">📅 {a.eventDate || ''}</div>
            </div>
          </div>
        ))}

        <div className="section-title">
          <h3>Portal Activity</h3>
          <span style={{ color: 'var(--muted)' }}>↻</span>
        </div>
        <div className="card" style={{ padding: 0 }}>
          {complaints.length === 0 && (
            <div style={{ padding: 20, color: 'var(--muted)' }}>
              No requests filed yet. Use "File Report" to get started.
            </div>
          )}
          {complaints.map((c) => (
            <div className="history-row" style={{ padding: '16px 20px' }} key={c.id}>
              <div>
                <div style={{ fontWeight: 700 }}>{c.nature}</div>
                <div className="ref">Ref ID: #{c.trackingId}</div>
              </div>
              <span className={`badge ${statusBadgeClass(c.status)}`}>{c.status.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>

      {lightboxAnnouncement && (
        <div className="lightbox-overlay" onClick={() => setLightboxAnnouncement(null)}>
          <button className="lightbox-close" onClick={() => setLightboxAnnouncement(null)} aria-label="Close">✕</button>
          <div className="lightbox-card" onClick={(e) => e.stopPropagation()}>
            <img src={toAssetUrl(lightboxAnnouncement.imageUrl)} alt="" className="lightbox-img" />
            <div className="lightbox-info">
              {lightboxAnnouncement.tag && <span className="pill-muted" style={{ marginBottom: 8, display: 'inline-block' }}>{lightboxAnnouncement.tag}</span>}
              <h4>{lightboxAnnouncement.title}</h4>
              {lightboxAnnouncement.body && <p>{lightboxAnnouncement.body}</p>}
              {lightboxAnnouncement.eventDate && <div className="date-tag">📅 {lightboxAnnouncement.eventDate}</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
