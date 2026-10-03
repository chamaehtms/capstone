import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { getAnnouncements, toAssetUrl, Session } from '../api.js';

const emergencyContacts = [
  { label: 'CORDOVA POLICE STATION', value: '0998-598-6392' },
  { label: 'BUREAU OF FIRE PROTECTION', value: '436-4245\n0933-394-9073' },
  { label: 'CORDOVA PRIMARY HEALTH CARE FACILITY (ABTC, BIRTHING CENTER, MEDICAL SECTION)', value: '0967-491-5579' },
  { label: 'CORDOVA PRIMARY HEALTH CARE FACILITY AMBULANCE SERVICES (8:00 AM - 5:00 PM)', value: '0967-491-5579' },
  { label: 'MDRRMO AMBULANCE', value: '247\n0917-149-8457\n0917-116-9819' },
  { label: 'PHILIPPINE RED CROSS (LAPU-LAPU & CORDOVA CHAPTER)', value: '0969-450-8482' },
  { label: 'PHILIPPINE COAST GUARD (CORDOVA)', value: '0927-941-2486' },
];

export default function Services() {
  const user = Session.getUser();
  const isVerified = user?.status === 'Verified';
  const [showEmergencyDirectory, setShowEmergencyDirectory] = useState(false);
  const [showAnnouncementsFeed, setShowAnnouncementsFeed] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const searchTerm = serviceSearch.trim().toLowerCase();
  const matchesSearch = (...terms) => !searchTerm || terms.join(' ').toLowerCase().includes(searchTerm);
  const emergencySearchTerms = emergencyContacts.flatMap(({ label, value }) => [label, value.replace(/\n/g, ' ')]);
  const showComplaintService = matchesSearch('File a Formal Complaint', 'mediation', 'civil disputes', 'criminal disputes', 'residential concerns');
  const showInfrastructureService = matchesSearch('Infrastructure Public Works', 'public facilities', 'roads', 'drainage', 'utilities', 'maintenance');
  const showTrackingService = matchesSearch('Track Filed Complaints', 'case timelines', 'Lupon hearings', 'resolution outcomes', 'Reference ID');
  const showEmergencyService = matchesSearch('Emergency Contacts Hotlines', 'local police', 'fire department', 'medical ambulances', 'emergency response', ...emergencySearchTerms);
  const showAnnouncementService = isVerified && matchesSearch('Announcements Safety Notifications', 'Barangay announcements', 'event updates', 'emergency alerts');
  const hasMatchingService = showComplaintService || showInfrastructureService || showTrackingService || showEmergencyService || showAnnouncementService;

  useEffect(() => {
    if (isVerified) {
      getAnnouncements()
        .then(setAnnouncements)
        .catch(() => setAnnouncementsError('Unable to load announcements right now.'));
    }
  }, [isVerified]);

  function openAnnouncements() {
    if (!isVerified) return;
    setShowAnnouncementsFeed(true);
    if (announcements.length === 0 && !announcementsLoading) {
      setAnnouncementsLoading(true);
      setAnnouncementsError('');
      getAnnouncements()
        .then(setAnnouncements)
        .catch(() => setAnnouncementsError('Unable to load announcements right now.'))
        .finally(() => setAnnouncementsLoading(false));
    }
  }

  return (
    <>
      <Navbar />
      <div className="page">
        <label className="search-box">
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            aria-label="Search services"
            placeholder="Search Services"
            value={serviceSearch}
            onChange={(event) => setServiceSearch(event.target.value)}
          />
        </label>

        {!isVerified && (
          <div className="card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb', marginBottom: 20, padding: '14px 18px', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: '1.1rem' }}>⏳</span>
              <strong style={{ color: '#b45309', fontSize: '0.9rem' }}>Account Pending Verification — Limited Access Active</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
              Your account currently allows filing Barangay Justice complaints, reporting infrastructure damages, and tracking existing case progress. Announcements and certified administrative documents require verified resident status.
            </p>
          </div>
        )}

        {(showComplaintService || showInfrastructureService || showTrackingService) && (
          <div className="justice-panel">
            <h2>Barangay Complaints &amp; Justice</h2>
            <p>Our Lupong Tagapamayapa ensures swift and fair mediation for neighborhood disputes. Resolve issues peacefully within the community.</p>
            <div className="justice-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
              {showComplaintService && (
                <div className="justice-card">
                  <div className="icon-badge">📣</div>
                  <h4>File a Formal Complaint</h4>
                  <p>Initiate the official mediation process for civil or minor criminal disputes and other residential concerns.</p>
                  <Link to="/file-complaint?category=complaint"><button className="btn btn-sky">Start Form →</button></Link>
                </div>
              )}
              {showInfrastructureService && (
                <div className="justice-card">
                  <div className="icon-badge">🛠️</div>
                  <h4>Infrastructure / Public Works</h4>
                  <p>Issues related to public facilities, roads, drainage, and utilities that require maintenance in your area.</p>
                  <Link to="/file-complaint?category=infrastructure"><button className="btn btn-sky">Start Form →</button></Link>
                </div>
              )}
              {showTrackingService && (
                <div className="justice-card">
                  <div className="icon-badge">📈</div>
                  <h4>Track Filed Complaints</h4>
                  <p>Check ongoing case timelines, upcoming Lupon hearings, and resolution outcomes by Reference ID.</p>
                  <Link to="/track"><button className="btn btn-navy">Track Status →</button></Link>
                </div>
              )}
            </div>
          </div>
        )}

        {(showEmergencyService || showAnnouncementService) && (
          <>
            <div className="section-title"><h3>Public Safety &amp; Emergency</h3></div>
            <div className="services-grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}>
              {showEmergencyService && (
                <div className="card service-simple-card emergency-card" onClick={() => setShowEmergencyDirectory(true)} role="button" tabIndex={0} onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowEmergencyDirectory(true);
                  }
                }}>
                  <div className="icon-badge">📞</div>
                  <h4>Emergency Contacts &amp; Hotlines</h4>
                  <p>Direct access to local police, the fire department, medical ambulances, and emergency response units.</p>
                </div>
              )}

              {showAnnouncementService && (
                <div className="card service-simple-card announcement-card" onClick={openAnnouncements} role="button" tabIndex={0} onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openAnnouncements();
                  }
                }}>
                  <div className="icon-badge">🔔</div>
                  <h4>Announcements &amp; Safety Notifications</h4>
                  <p>Barangay announcements, event updates, and emergency alerts you should be aware of.</p>
                </div>
              )}
            </div>
          </>
        )}

        {searchTerm && !hasMatchingService && (
          <div className="card" role="status" style={{ marginTop: 20, color: 'var(--muted)', textAlign: 'center' }}>
            No services match “{serviceSearch}”. Try another search.
          </div>
        )}

        {isVerified && showAnnouncementsFeed && (
          <div className="announcement-feed-overlay" onClick={() => setShowAnnouncementsFeed(false)}>
            <div className="announcement-feed-modal" onClick={(e) => e.stopPropagation()}>
              <button className="lightbox-close emergency-close" onClick={() => setShowAnnouncementsFeed(false)} aria-label="Close">✕</button>

              <div className="announcement-feed-header">
                <h3>Announcements &amp; Safety Notifications</h3>
              </div>

              <div className="announcement-feed-list">
                {announcementsLoading && <p className="announcement-feed-status">Loading announcements...</p>}
                {!announcementsLoading && announcementsError && <p className="announcement-feed-status error-msg">{announcementsError}</p>}
                {!announcementsLoading && !announcementsError && announcements.length === 0 && (
                  <p className="announcement-feed-status">No announcements have been posted yet.</p>
                )}
                {!announcementsLoading && announcements.map((post) => (
                  <article className="announcement-post" key={post.id}>
                    <div className="announcement-post-header">
                      <div className="announcement-avatar">🏛️</div>
                      <div>
                        <div className="announcement-author">Barangay Poblacion</div>
                        <div className="announcement-time">
                          {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'New announcement'}
                        </div>
                      </div>
                    </div>

                    <div className="announcement-post-body">
                      <div className="announcement-post-tag">{post.tag || 'General'}</div>
                      <h4>{post.title}</h4>
                      {post.body && <p>{post.body}</p>}
                      {post.eventDate && <div className="announcement-post-date">Event date: {post.eventDate}</div>}
                    </div>

                    {post.imageUrl && (
                      <img src={toAssetUrl(post.imageUrl)} alt={post.title} className="announcement-post-image" />
                    )}
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {showEmergencyDirectory && (
          <div className="emergency-directory-overlay" onClick={() => setShowEmergencyDirectory(false)}>
            <div className="emergency-directory-modal" onClick={(e) => e.stopPropagation()}>
              <button className="lightbox-close emergency-close" onClick={() => setShowEmergencyDirectory(false)} aria-label="Close">✕</button>

              <div className="emergency-header">
                <div className="emergency-badge">🏛️</div>
                <div className="emergency-header-text">
                  <div className="municipality-line">MUNICIPALITY OF CORDOVA</div>
                  <div className="tagline">BAGONG PILIPINAS</div>
                </div>
              </div>

              <h1 className="emergency-title">EMERGENCY<br />HOTLINES</h1>

              <div className="emergency-list">
                {emergencyContacts.map((item) => (
                  <div className="emergency-row" key={item.label}>
                    <div className="emergency-label">{item.label}</div>
                    <div className="emergency-value">{item.value.split('\n').map((line, index) => (
                      <span key={`${item.label}-${index}`}>
                        {line}
                        {index < item.value.split('\n').length - 1 && <br />}
                      </span>
                    ))}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
