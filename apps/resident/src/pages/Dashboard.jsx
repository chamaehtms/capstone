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
          <div className="notice-card notice-card-amber">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ color: 'var(--amber-text)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ModernIcon name="clock" size={16} color="var(--amber-text)" /> Account Pending Verification · Limited Access Active
              </strong>
              <span className="notice-badge notice-badge-amber">
                LIMITED ACCESS
              </span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 }}>
              Your resident information could not yet be automatically verified against the Barangay Resident Database. You have <strong>limited access</strong>: you may submit complaints and track their status in real time. General announcements and official certificate issuance will be enabled once your residency is confirmed by barangay officials.
            </p>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 8 }}>
              <Link to="/file-complaint" style={{ fontSize: '0.85rem', color: 'var(--amber-text)', fontWeight: 700, textDecoration: 'underline' }}>
                Submit a Complaint / Report →
              </Link>
              <Link to="/track" style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 700, textDecoration: 'underline' }}>
                Track Your Requests →
              </Link>
            </div>
          </div>
        )}

        {complaintsAgainstMe.length > 0 && (
          <div className="notice-card notice-card-red">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ color: 'var(--red-text)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ModernIcon name="warning" size={16} color="var(--red-text)" /> Official Notice: Complaint Filed Involving You
              </strong>
              <span className="notice-badge notice-badge-red">
                NOTICE AS RESPONDENT ({complaintsAgainstMe.length})
              </span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 }}>
              You are named as the respondent in <strong>Case #{complaintsAgainstMe[0].caseRef}</strong> ({complaintsAgainstMe[0].category || 'Formal Complaint'}). Under Barangay privacy protocols, the complainant&apos;s identity is protected.
            </p>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 8 }}>
              <Link to={`/track?ref=${encodeURIComponent(complaintsAgainstMe[0].caseRef)}`} style={{ fontSize: '0.85rem', color: 'var(--red-text)', fontWeight: 700, textDecoration: 'underline' }}>
                View Case Details →
              </Link>
              <Link to="/profile" style={{ fontSize: '0.85rem', color: 'var(--muted)', textDecoration: 'underline' }}>
                View All Notices in Profile ({complaintsAgainstMe.length})
              </Link>
            </div>
          </div>
        )}

        {mediations.length > 0 && (
          <div className="notice-card notice-card-indigo">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
              <strong style={{ color: 'var(--indigo-text)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ModernIcon name="scale" size={16} color="var(--indigo-text)" /> Official Mediation Hearing Scheduled
              </strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {mediations[0].mediationStatus && (
                  <span className="notice-badge notice-badge-indigo">
                    {mediations[0].mediationStatus}
                  </span>
                )}
                <span className="notice-badge" style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
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
          <h3>Services & Dispatch</h3>
          <span className="notice-badge" style={{ background: 'var(--gray-bg)', color: 'var(--gray-text)' }}>
            {isVerified ? 'Full Access' : 'Limited Access'}
          </span>
        </div>

        <div className="quick-actions-grid" style={{ gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', maxWidth: '100%' }}>
          {/* Primary Action Card */}
          <div className="card quick-action-card" style={{ maxWidth: '100%', background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="icon-badge" style={{ background: 'var(--sky)', color: 'var(--navy)', marginBottom: 0 }}>
                <ModernIcon name="megaphone" size={22} color="var(--navy)" />
              </div>
              <span className="notice-badge" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                PRIMARY ACTION
              </span>
            </div>
            <h4 style={{ fontSize: '1.2rem', marginBottom: 6 }}>File a Formal Complaint / Report</h4>
            <p style={{ fontSize: '0.92rem', color: 'var(--muted)', marginBottom: 20 }}>
              Initiate barangay dispute proceedings under Katarungang Pambarangay, report safety concerns, or request local peace officer intervention.
            </p>
            <Link to="/file-complaint">
              <button className="btn btn-navy" style={{ width: '100%', padding: '12px 20px' }}>
                Open Filing Form →
              </button>
            </Link>
          </div>

          {/* Secondary Action Card */}
          <div className="card quick-action-card" style={{ maxWidth: '100%', background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="icon-badge" style={{ background: 'var(--gray-bg)', color: 'var(--muted)', marginBottom: 0 }}>
                <ModernIcon name="chart" size={20} color="var(--muted)" />
              </div>
              <span className="notice-badge" style={{ background: 'var(--gray-bg)', color: 'var(--gray-text)' }}>
                TRACKING
              </span>
            </div>
            <h4 style={{ fontSize: '1.05rem', marginBottom: 6 }}>Track Filed Reports & Hearings</h4>
            <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginBottom: 20 }}>
              Check reference IDs, summons updates, and schedule notifications.
            </p>
            <Link to="/track">
              <button className="btn btn-outline" style={{ width: '100%', padding: '11px 18px' }}>
                Lookup Case Status →
              </button>
            </Link>
          </div>
        </div>

        {isVerified && (
          <>
            <div className="section-title">
              <h3>Community Bulletins &amp; Announcements</h3>
            </div>
            {announcements.length === 0 && (
              <div className="card" style={{ padding: '24px', color: 'var(--muted)', textAlign: 'center' }}>
                No active announcements posted yet.
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '20px', marginBottom: 28 }}>
              {announcements.map((a) => (
                <Link
                  key={a.id}
                  to={`/announcements/${a.id}`}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}
                >
                  <article
                    className="card announcement-civic-card"
                    style={{
                      width: '100%',
                      padding: 0,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                    }}
                  >
                    {a.imageUrl ? (
                      <div
                        style={{
                          height: 180,
                          width: '100%',
                          backgroundImage: `url(${toAssetUrl(a.imageUrl)})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundColor: '#0f172a',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          height: 90,
                          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 20px',
                          color: '#94a3b8',
                        }}
                      >
                        <ModernIcon name="megaphone" size={24} color="#38bdf8" />
                      </div>
                    )}
                    <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: '#0284c7',
                            background: '#e0f2fe',
                            padding: '3px 9px',
                            borderRadius: 'var(--radius-pill)',
                            border: '1px solid #bae6fd',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {a.tag || 'Official Bulletin'}
                        </span>
                        {a.eventDate && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: '#64748b' }}>
                            <ModernIcon name="calendar" size={13} color="#64748b" /> {a.eventDate}
                          </div>
                        )}
                      </div>
                      <h4
                        style={{
                          fontSize: '1.08rem',
                          fontWeight: 700,
                          color: 'var(--navy)',
                          margin: '0 0 8px',
                          lineHeight: 1.35,
                        }}
                      >
                        {a.title}
                      </h4>
                      <p
                        style={{
                          fontSize: '0.88rem',
                          color: 'var(--muted)',
                          lineHeight: 1.55,
                          margin: '0 0 16px',
                          flex: 1,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {a.body}
                      </p>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: '#2563eb',
                          marginTop: 'auto',
                        }}
                      >
                        Read Full Bulletin →
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
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
    </>
  );
}
