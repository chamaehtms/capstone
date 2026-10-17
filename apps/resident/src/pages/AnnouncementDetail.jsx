import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import ModernIcon from '../components/ModernIcons.jsx';
import { getAnnouncement, getAnnouncements, toAssetUrl, Session } from '../api.js';

export default function AnnouncementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = Session.getUser();
  const isVerified = user?.status === 'Verified';

  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [otherAnnouncements, setOtherAnnouncements] = useState([]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');

    async function loadData() {
      try {
        const item = await getAnnouncement(id);
        if (isMounted) {
          setAnnouncement(item);
        }
      } catch (err) {
        // Fallback: try finding it from the full list if individual fetch encounters any issue
        try {
          const list = await getAnnouncements();
          const found = list.find((a) => String(a.id) === String(id));
          if (found && isMounted) {
            setAnnouncement(found);
          } else if (isMounted) {
            setError('This bulletin or official announcement could not be found.');
          }
        } catch {
          if (isMounted) {
            setError('Unable to load this announcement at the moment. Please verify your connection or residency verification status.');
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }

      // Load other recent notices for sidebar / further reading
      try {
        const all = await getAnnouncements();
        if (isMounted && Array.isArray(all)) {
          setOtherAnnouncements(all.filter((a) => String(a.id) !== String(id)).slice(0, 3));
        }
      } catch {
        // non-critical
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (!isVerified) {
    return (
      <>
        <Navbar />
        <main className="page" style={{ maxWidth: '820px', padding: '36px 20px' }}>
          <div className="notice-card notice-card-amber" style={{ margin: '40px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <ModernIcon name="lock" size={20} color="var(--amber-text)" />
              <strong style={{ color: 'var(--amber-text)', fontSize: '1rem' }}>
                Residency Verification Required
              </strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.92rem', color: '#334155', lineHeight: 1.6 }}>
              Official community announcements and advisories are reserved for verified residents. Your profile verification is currently pending review by barangay administrators.
            </p>
            <div style={{ marginTop: 16 }}>
              <Link to="/dashboard" className="btn btn-navy" style={{ textDecoration: 'none' }}>
                Return to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="page" style={{ maxWidth: '960px', padding: '32px 20px 80px' }}>
        {/* Navigation Breadcrumb & Back action */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'none',
              border: 'none',
              color: 'var(--navy)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <ModernIcon name="arrow-left" size={16} /> Back to Announcements
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--muted)' }}>
            <Link to="/dashboard" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Dashboard</Link>
            <span>/</span>
            <span style={{ color: 'var(--navy)', fontWeight: 600 }}>Official Notice</span>
          </div>
        </div>

        {loading && (
          <div className="card" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--muted)' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid #e2e8f0',
                borderTopColor: '#2b6ef2',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 16px',
              }}
            />
            <p style={{ margin: 0, fontWeight: 600 }}>Loading official publication...</p>
          </div>
        )}

        {!loading && error && (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ marginBottom: 14 }}>
              <ModernIcon name="alert" size={36} color="var(--amber-text)" />
            </div>
            <h3 style={{ color: 'var(--navy)', marginBottom: 8, fontSize: '1.25rem' }}>Notice Unavailable</h3>
            <p style={{ color: 'var(--muted)', maxWidth: 480, margin: '0 auto 20px', fontSize: '0.95rem' }}>{error}</p>
            <Link to="/dashboard" className="btn btn-navy" style={{ textDecoration: 'none' }}>
              Return to Portal Dashboard
            </Link>
          </div>
        )}

        {!loading && announcement && (
          <div className="announcement-detail-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: '32px', alignItems: 'start' }}>
            {/* Primary Notice Article */}
            <article
              className="card announcement-detail-card"
              style={{
                padding: '32px 36px',
                background: '#ffffff',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
              }}
            >
              {/* Category tag & Event Date badge */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-pill)',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    border: '1px solid #bae6fd',
                  }}
                >
                  <ModernIcon name="megaphone" size={13} color="#0369a1" />
                  {announcement.tag || 'Official Advisory'}
                </span>

                {announcement.eventDate && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#475569',
                      background: '#f8fafc',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <ModernIcon name="calendar" size={14} color="#64748b" />
                    Target Date: {announcement.eventDate}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1
                style={{
                  fontSize: '1.9rem',
                  fontWeight: 800,
                  color: 'var(--navy)',
                  lineHeight: 1.25,
                  margin: '0 0 16px',
                  letterSpacing: '-0.02em',
                }}
              >
                {announcement.title}
              </h1>

              {/* Meta bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  paddingBottom: 20,
                  marginBottom: 24,
                  borderBottom: '1px solid #f1f5f9',
                  fontSize: '0.85rem',
                  color: 'var(--muted)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: '#eff6ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ModernIcon name="building" size={14} color="#2563eb" />
                  </div>
                  <span style={{ fontWeight: 600, color: '#334155' }}>Barangay Poblacion Administration</span>
                </div>
                {announcement.createdAt && (
                  <span>
                    Posted on {new Date(announcement.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>

              {/* Cover Image / Visual Media */}
              {announcement.imageUrl && (
                <div
                  style={{
                    marginBottom: 28,
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    background: '#0f172a',
                  }}
                >
                  <img
                    src={toAssetUrl(announcement.imageUrl)}
                    alt={announcement.title}
                    style={{
                      width: '100%',
                      maxHeight: '480px',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </div>
              )}

              {/* Full Notice Body */}
              <div
                style={{
                  fontSize: '1.05rem',
                  lineHeight: 1.8,
                  color: '#1e293b',
                  whiteSpace: 'pre-line',
                }}
              >
                {announcement.body || 'No detailed written content provided for this notice.'}
              </div>

              {/* Official Seal / Verification Sign-off */}
              <div
                style={{
                  marginTop: 40,
                  paddingTop: 24,
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ModernIcon name="shield" size={20} color="#059669" />
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Official Civic Bulletin verified by Barangay Council
                  </span>
                </div>
                <Link to="/dashboard" className="btn btn-outline" style={{ textDecoration: 'none', padding: '8px 18px', fontSize: '0.88rem' }}>
                  Back to Dashboard
                </Link>
              </div>
            </article>

            {/* Sidebar / More Bulletins */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: '20px', background: '#f8fafc', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', color: 'var(--navy)', fontWeight: 700 }}>
                  Need Assistance?
                </h4>
                <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                  Have questions regarding this announcement or need clarification from the barangay hall?
                </p>
                <Link to="/services" style={{ textDecoration: 'none' }}>
                  <button className="btn btn-navy" style={{ width: '100%', padding: '10px 14px', fontSize: '0.88rem' }}>
                    View Services &amp; Contacts
                  </button>
                </Link>
              </div>

              {otherAnnouncements.length > 0 && (
                <div className="card" style={{ padding: '20px', border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 14px', fontSize: '0.95rem', color: 'var(--navy)', fontWeight: 700 }}>
                    Recent Bulletins
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {otherAnnouncements.map((item) => (
                      <Link
                        key={item.id}
                        to={`/announcements/${item.id}`}
                        style={{
                          textDecoration: 'none',
                          color: 'inherit',
                          display: 'block',
                          paddingBottom: 12,
                          borderBottom: '1px solid #f1f5f9',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: '#0284c7',
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                            display: 'block',
                            marginBottom: 4,
                          }}
                        >
                          {item.tag || 'Notice'}
                        </span>
                        <strong
                          style={{
                            fontSize: '0.88rem',
                            color: 'var(--navy)',
                            display: 'block',
                            lineHeight: 1.4,
                            marginBottom: 4,
                          }}
                        >
                          {item.title}
                        </strong>
                        {item.eventDate && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <ModernIcon name="calendar" size={12} color="#94a3b8" />
                            {item.eventDate}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </main>
    </>
  );
}
