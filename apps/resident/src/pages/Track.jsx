import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import InfrastructureTimeline from '../components/InfrastructureTimeline.jsx';
import ModernIcon from '../components/ModernIcons.jsx';
import { trackComplaint, getMyComplaints, getMyMediations, statusBadgeClass, toAssetUrl } from '../api.js';

function Timeline({ c }) {
  const isMediation = c.status === 'Mediation' || !!c.mediationDate;
  const isResolved =
    c.status === 'Resolved/Escalated' ||
    c.status === 'Resolved / Escalated' ||
    c.status === 'Resolved' ||
    c.status === 'Escalated' ||
    c.status === 'Closed';

  const stages = [
    { label: 'Submitted', desc: 'Request successfully logged by system.', done: true },
    { label: 'Under Review', desc: 'Legal and site verification by desk officer.', done: c.stage >= 2 || isMediation || isResolved },
    {
      label: 'Mediation Hearing',
      desc: c.mediationDate
        ? `Scheduled: ${c.mediationDate}${c.mediationTime ? ' at ' + c.mediationTime : ''} (${c.mediationVenue || 'Barangay Hall'})`
        : 'Referred to Lupon Tagapamayapa for conciliation proceedings.',
      done: isMediation || isResolved,
      current: isMediation && !isResolved,
    },
    {
      label: c.status === 'Escalated' || c.needsEscalation ? 'Escalated' : 'Resolved/Escalated',
      desc: c.status === 'Escalated' || c.needsEscalation
        ? 'Case escalated for formal legal proceedings.'
        : 'Case completion, amicable settlement, or resolution.',
      done: isResolved,
    },
  ];

  return (
    <div className="timeline" style={{ marginTop: 20 }}>
      {stages.map((s, i) => (
        <div className="t-item" key={s.label}>
          {i < stages.length - 1 && <div className="t-line" />}
          <div className={`t-dot ${s.done ? '' : 'pending'} ${s.current ? 'current' : ''}`}>{i + 1}</div>
          <div className="t-content">
            <strong>{s.label}</strong>
            <span>{s.desc}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Track() {
  const [params] = useSearchParams();
  const [refInput, setRefInput] = useState(params.get('ref') || '');
  const [result, setResult] = useState(null);
  const [others, setOthers] = useState([]);
  const [mediations, setMediations] = useState([]);
  const [error, setError] = useState('');

  const doLookup = useCallback(async (ref) => {
    setError(''); setResult(null);
    if (!ref) return;
    try {
      const c = await trackComplaint(ref);
      setResult(c);
      try {
        const [all, allM] = await Promise.all([
          getMyComplaints(),
          getMyMediations(),
        ]);
        setOthers(all.filter((x) => x.id !== c.id));
        setMediations(allM);
      } catch { /* not fatal */ }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (refInput) {
      doLookup(refInput);
    } else {
      getMyComplaints().then((mine) => {
        if (mine.length) {
          const initialRef = mine[0].trackingId || mine[0].id || mine[0].caseRef;
          if (initialRef) {
            setRefInput(initialRef);
            doLookup(initialRef);
          }
        }
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upcoming = others.slice(0, 2);
  const history = others.slice(2, 5);

  // Match mediations for the currently tracked case or overall
  const caseMediation = mediations.find((m) => m.caseId === result?.id);

  return (
    <>
      <Navbar />
      <div className="page">
        <h1 className="hero-title" style={{ marginTop: 24 }}>Track Your Request</h1>
        <p className="hero-sub">Check the real-time status of your applications and reports by entering your unique reference ID.</p>

        <div className="track-search">
          <div className="track-search-row">
            <ModernIcon name="search" size={18} color="#64748b" />
            <input
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') doLookup(refInput.trim()); }}
              placeholder="Reference ID (e.g., PS-2024-0891, BC-2024-001)"
            />
          </div>
          <button className="btn btn-navy btn-block" onClick={() => doLookup(refInput.trim())}>Verify</button>
        </div>

        {error && <div className="error-msg" style={{ marginTop: 16 }}>{error}</div>}

        {result && (
          <>
            {(() => {
              const isInfrastructure =
                result.category === 'Infrastructure' ||
                result.category === 'Public Works' ||
                (result.id && result.id.startsWith('IN-')) ||
                (result.trackingId && result.trackingId.startsWith('IN-')) ||
                (result.nature && result.nature.startsWith('['));

              return isInfrastructure ? (
                <>
                  <div className="card" style={{ marginTop: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 8px', borderRadius: 4, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', letterSpacing: '0.04em' }}>
                            INFRASTRUCTURE REPORT
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                            Case Ref: <strong style={{ color: 'var(--navy)' }}>{result.trackingId}</strong>
                          </span>
                        </div>
                        <h2 style={{ margin: '0 0 6px', color: 'var(--navy)' }}>{result.nature}</h2>
                        <div style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
                          Reported by: <strong>{result.complainantName || result.resident}</strong> · Filed on: {result.filingDate || result.createdAt?.split('T')[0]}
                        </div>
                      </div>
                      <span className={`badge ${statusBadgeClass(result.status)}`} style={{ textTransform: 'uppercase', padding: '6px 14px', fontSize: '.78rem' }}>
                        {result.status}
                      </span>
                    </div>
                  </div>

                  {/* Dedicated Progress Timeline Card matching uploaded mockup */}
                  <InfrastructureTimeline c={result} />

                  <div className="two-col">
                    {/* Work Order & Inspection Card */}
                    <div className="card">
                      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ModernIcon name="tool" size={18} color="#0284c7" />
                        <span>Inspection & Work Order Details</span>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: '14px 16px', marginTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>
                            {result.category || 'Infrastructure'} Case
                          </strong>
                          <span className="notice-badge" style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                            WORK ORDER
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ModernIcon name="building" size={14} color="#475569" />
                            <span><strong>Specific Location:</strong> {result.nature || result.description}</span>
                          </div>
                          {result.respondentName && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <ModernIcon name="building" size={14} color="#475569" />
                              <span><strong>Landmark / Nearby:</strong> {result.respondentName.replace('Nearby: ', '')}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ModernIcon name="users" size={14} color="#475569" />
                            <span><strong>Assigned Team:</strong> {result.assignedTeam || 'Pending Assignment'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ModernIcon name="bell" size={14} color="#0369a1" />
                            <span><strong>Current Status:</strong> <span style={{ fontWeight: 700, color: '#0284c7' }}>{result.status}</span></span>
                          </div>
                          {result.reliefSought && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <ModernIcon name="check" size={14} color="#16a34a" />
                              <span><strong>Action Requested:</strong> {result.reliefSought}</span>
                            </div>
                          )}
                        </div>

                        {result.narrative && (
                          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #cbd5e1', fontSize: '0.82rem', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                            {result.narrative}
                          </div>
                        )}

                        {result.attachmentUrl && (
                          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #cbd5e1' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                              Attached Site Evidence:
                            </span>
                            {/\.(mp4|webm|mov|mkv|avi)$/i.test(result.attachmentUrl) ? (
                              <div style={{ marginTop: 6 }}>
                                <video
                                  controls
                                  style={{ width: '100%', maxHeight: 220, borderRadius: 8, background: '#000' }}
                                  preload="metadata"
                                >
                                  <source src={toAssetUrl(result.attachmentUrl)} />
                                  Your browser does not support the video tag.
                                </video>
                                <a
                                  href={toAssetUrl(result.attachmentUrl)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#2563eb', marginTop: 4, textDecoration: 'underline' }}
                                >
                                  <ModernIcon name="video" size={14} color="#2563eb" />
                                  <span>Open video in full screen ↗</span>
                                </a>
                              </div>
                            ) : /\.(jpe?g|png|gif|webp)$/i.test(result.attachmentUrl) ? (
                              <div style={{ marginTop: 6 }}>
                                <img
                                  src={toAssetUrl(result.attachmentUrl)}
                                  alt="Attached Evidence"
                                  style={{ maxHeight: 180, maxWidth: '100%', borderRadius: 8, border: '1px solid #cbd5e1', objectFit: 'contain' }}
                                />
                                <a
                                  href={toAssetUrl(result.attachmentUrl)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#2563eb', marginTop: 4, textDecoration: 'underline' }}
                                >
                                  <ModernIcon name="image" size={14} color="#2563eb" />
                                  <span>View full resolution photo ↗</span>
                                </a>
                              </div>
                            ) : (
                              <a
                                href={toAssetUrl(result.attachmentUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: '#2563eb', textDecoration: 'underline', fontWeight: 600 }}
                              >
                                <ModernIcon name="file" size={14} color="#2563eb" />
                                <span>View Uploaded Document Evidence ↗</span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recent History / Other Cases */}
                    <div className="card">
                      <div className="card-title">Recent History</div>
                      {history.length === 0 && upcoming.length === 0 && (
                        <p style={{ color: 'var(--muted)', padding: '14px 0' }}>No other history yet.</p>
                      )}
                      {[...upcoming, ...history].map((c) => (
                        <div
                          className="history-row"
                          key={c.id}
                          onClick={() => { setRefInput(c.trackingId); doLookup(c.trackingId); }}
                          style={{ cursor: 'pointer' }}
                          title="Click to track this case"
                        >
                          <div>
                            <div style={{ fontWeight: 700 }}>{c.nature}</div>
                            <div className="ref">Ref No. {c.caseRef}</div>
                          </div>
                          <span className={`badge ${statusBadgeClass(c.status)}`}>{c.status.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="card" style={{ marginTop: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h2 style={{ margin: '0 0 6px', color: 'var(--navy)' }}>{result.nature}</h2>
                        <div style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
                          ID: {result.trackingId} · CURRENT STATUS: {result.status}
                        </div>
                      </div>
                      <span className={`badge ${statusBadgeClass(result.status)}`} style={{ textTransform: 'uppercase', padding: '6px 14px', fontSize: '.78rem' }}>
                        {result.status === 'Under Review' ? 'IN PROGRESS' : result.status}
                      </span>
                    </div>
                    <Timeline c={result} />
                  </div>

                  <div className="two-col">
                    {/* Mediation Schedule Card */}
                    <div className="card">
                      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ModernIcon name="scale" size={18} color="#4f46e5" />
                        <span>Mediation Schedule</span>
                      </div>
                      {result.mediationDate || caseMediation ? (
                        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: '14px 16px', marginTop: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                            <strong style={{ color: '#1e293b', fontSize: '0.92rem' }}>
                              {result.hearingStage || caseMediation?.hearingStage || '1st Mediation Hearing'}
                            </strong>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {(result.mediationStatus || caseMediation?.mediationStatus) && (
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '3px 8px',
                                  borderRadius: 12,
                                  background: (result.mediationStatus || caseMediation?.mediationStatus) === 'Settled' ? '#dcfce7' :
                                              (result.mediationStatus || caseMediation?.mediationStatus) === 'Cancelled' ? '#fee2e2' :
                                              (result.mediationStatus || caseMediation?.mediationStatus) === 'Ongoing' ? '#fef3c7' :
                                              (result.mediationStatus || caseMediation?.mediationStatus) === 'Rescheduled' ? '#ffedd5' :
                                              (result.mediationStatus || caseMediation?.mediationStatus) === 'Unsettled' ? '#f1f5f9' : '#e0e7ff',
                                  color: (result.mediationStatus || caseMediation?.mediationStatus) === 'Settled' ? '#15803d' :
                                         (result.mediationStatus || caseMediation?.mediationStatus) === 'Cancelled' ? '#b91c1c' :
                                         (result.mediationStatus || caseMediation?.mediationStatus) === 'Ongoing' ? '#b45309' :
                                         (result.mediationStatus || caseMediation?.mediationStatus) === 'Rescheduled' ? '#c2410c' :
                                         (result.mediationStatus || caseMediation?.mediationStatus) === 'Unsettled' ? '#475569' : '#4338ca',
                                  textTransform: 'uppercase',
                                }}>
                                  {result.mediationStatus || caseMediation?.mediationStatus}
                                </span>
                              )}
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 12, background: '#e0f2fe', color: '#0369a1' }}>
                                CONFIRMED SESSION
                              </span>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <ModernIcon name="calendar" size={14} color="#475569" />
                              <span><strong>Date:</strong> {result.mediationDate || caseMediation?.date}</span>
                            </div>
                            {(result.mediationTime || caseMediation?.time) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ModernIcon name="clock" size={14} color="#475569" />
                                <span><strong>Time:</strong> {result.mediationTime || caseMediation?.time}</span>
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <ModernIcon name="building" size={14} color="#475569" />
                              <span><strong>Venue:</strong> {result.mediationVenue || caseMediation?.location || 'Barangay Poblacion Mediation Hall'}</span>
                            </div>
                            {(result.mediator || caseMediation?.mediator) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ModernIcon name="user" size={14} color="#475569" />
                                <span><strong>Presiding Officer:</strong> {result.mediator || caseMediation?.mediator}</span>
                              </div>
                            )}
                          </div>
                          <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: '#475569', background: '#ffffff', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <ModernIcon name="mail" size={14} color="#475569" style={{ flexShrink: 0, marginTop: 2 }} />
                            <span>An official Notice of Hearing has been issued and sent to your registered email. Please bring a valid government ID and arrive 15 minutes before the scheduled time.</span>
                          </p>

                          {(caseMediation?.nextMeetingDate || result.nextMediationDate) && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #cbd5e1' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <strong style={{ color: '#0f172a', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <ModernIcon name="calendar" size={14} color="#0f172a" />
                                  <span>Next Follow-up Hearing Scheduled</span>
                                </strong>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#e0f2fe', color: '#0369a1' }}>
                                  NEXT SESSION
                                </span>
                              </div>
                              <div style={{ fontSize: '0.84rem', color: '#334155', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <ModernIcon name="calendar" size={14} color="#475569" />
                                  <span><strong>Date:</strong> {caseMediation?.nextMeetingDate || result.nextMediationDate}</span>
                                </div>
                                {(caseMediation?.nextMeetingTime || result.nextMediationTime) && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <ModernIcon name="clock" size={14} color="#475569" />
                                    <span><strong>Time:</strong> {caseMediation?.nextMeetingTime || result.nextMediationTime}</span>
                                  </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <ModernIcon name="building" size={14} color="#475569" />
                                  <span><strong>Venue:</strong> {caseMediation?.nextMeetingVenue || result.nextMediationVenue || 'Barangay Poblacion Mediation Hall'}</span>
                                </div>
                              </div>
                              <p style={{ margin: '8px 0 0', fontSize: '0.76rem', color: '#5b21b6', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                <ModernIcon name="mail" size={14} color="#5b21b6" style={{ flexShrink: 0, marginTop: 2 }} />
                                <span>An official Notice for this follow-up session has been dispatched to your Gmail. Please ensure compliance with previously agreed commitments.</span>
                              </p>
                            </div>
                          )}
                        </div>
                      ) : mediations.length > 0 ? (
                        mediations.map((m) => (
                          <div className="history-row" key={m.id} style={{ marginTop: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700 }}>{m.hearingStage || 'Mediation Session'}</div>
                              <div className="ref">Case Ref: {m.caseId} · {m.location || 'Barangay Hall'}</div>
                            </div>
                            <span style={{ color: 'var(--green-text)', fontWeight: 700, fontSize: '.85rem' }}>
                              {m.date} {m.time ? `(${m.time})` : ''}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p style={{ color: 'var(--muted)', padding: '14px 0' }}>
                          No mediation hearing scheduled for this case yet. If conciliation is required, you will receive an email notice with the date and time.
                        </p>
                      )}

                      {result.attachmentUrl && (
                        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed #cbd5e1' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                            Submitted Case Evidence:
                          </span>
                          {/\.(mp4|webm|mov|mkv|avi)$/i.test(result.attachmentUrl) ? (
                            <div>
                              <video
                                controls
                                style={{ width: '100%', maxHeight: 220, borderRadius: 8, background: '#000' }}
                                preload="metadata"
                              >
                                <source src={toAssetUrl(result.attachmentUrl)} />
                                Your browser does not support the video tag.
                              </video>
                              <a
                                href={toAssetUrl(result.attachmentUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#2563eb', marginTop: 4, textDecoration: 'underline' }}
                              >
                                <ModernIcon name="video" size={14} color="#2563eb" />
                                <span>Open video in full screen ↗</span>
                              </a>
                            </div>
                          ) : /\.(jpe?g|png|gif|webp)$/i.test(result.attachmentUrl) ? (
                            <div>
                              <img
                                src={toAssetUrl(result.attachmentUrl)}
                                alt="Case Evidence"
                                style={{ maxHeight: 180, maxWidth: '100%', borderRadius: 8, border: '1px solid #cbd5e1', objectFit: 'contain' }}
                              />
                              <a
                                href={toAssetUrl(result.attachmentUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#2563eb', marginTop: 4, textDecoration: 'underline' }}
                              >
                                <ModernIcon name="image" size={14} color="#2563eb" />
                                <span>View full resolution photo ↗</span>
                              </a>
                            </div>
                          ) : (
                            <a
                              href={toAssetUrl(result.attachmentUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: '#2563eb', textDecoration: 'underline', fontWeight: 600 }}
                            >
                              <ModernIcon name="file" size={14} color="#2563eb" />
                              <span>View Attached Evidence File ↗</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Recent History / Other Cases */}
                    <div className="card">
                      <div className="card-title">Recent History</div>
                      {history.length === 0 && upcoming.length === 0 && (
                        <p style={{ color: 'var(--muted)', padding: '14px 0' }}>No other history yet.</p>
                      )}
                      {[...upcoming, ...history].map((c) => (
                        <div
                          className="history-row"
                          key={c.id}
                          onClick={() => { setRefInput(c.trackingId); doLookup(c.trackingId); }}
                          style={{ cursor: 'pointer' }}
                          title="Click to track this case"
                        >
                          <div>
                            <div style={{ fontWeight: 700 }}>{c.nature}</div>
                            <div className="ref">Ref No. {c.caseRef}</div>
                          </div>
                          <span className={`badge ${statusBadgeClass(c.status)}`}>{c.status.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </>
        )}
      </div>
    </>
  );
}
