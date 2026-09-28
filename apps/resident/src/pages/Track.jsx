import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { trackComplaint, getMyComplaints, getMyMediations, statusBadgeClass } from '../api.js';

function Timeline({ c }) {
  const isMediation = c.status === 'Mediation' || !!c.mediationDate;
  const isResolved = c.status === 'Resolved' || c.status === 'Closed';

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
    { label: 'Resolved', desc: 'Case completion & amicable settlement.', done: isResolved },
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
          setRefInput(mine[0].trackingId);
          doLookup(mine[0].trackingId);
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
            🔍 <input
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
                <div className="card-title">⚖️ Mediation Schedule</div>
                {result.mediationDate || caseMediation ? (
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderLeft: '4px solid #4f46e5', borderRadius: 8, padding: '14px 16px', marginTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <strong style={{ color: '#1e293b', fontSize: '0.92rem' }}>
                        {result.hearingStage || caseMediation?.hearingStage || '1st Mediation Hearing'}
                      </strong>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 12, background: '#ede9fe', color: '#6d28d9' }}>
                        CONFIRMED SESSION
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.7 }}>
                      <div>📅 <strong>Date:</strong> {result.mediationDate || caseMediation?.date}</div>
                      {(result.mediationTime || caseMediation?.time) && (
                        <div>⏰ <strong>Time:</strong> {result.mediationTime || caseMediation?.time}</div>
                      )}
                      <div>📍 <strong>Venue:</strong> {result.mediationVenue || caseMediation?.location || 'Barangay Poblacion Mediation Hall'}</div>
                      {(result.mediator || caseMediation?.mediator) && (
                        <div>👤 <strong>Presiding Officer:</strong> {result.mediator || caseMediation?.mediator}</div>
                      )}
                    </div>
                    <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: '#64748b', background: '#ffffff', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                      ✉️ An official Notice of Hearing has been issued and sent to your registered email. Please bring a valid government ID and arrive 15 minutes before the scheduled time.
                    </p>

                    {(caseMediation?.nextMeetingDate || result.nextMediationDate) && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #cbd5e1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <strong style={{ color: '#6d28d9', fontSize: '0.88rem' }}>
                            🗓️ Next Follow-up Hearing Scheduled
                          </strong>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#ede9fe', color: '#6d28d9' }}>
                            NEXT SESSION
                          </span>
                        </div>
                        <div style={{ fontSize: '0.84rem', color: '#334155', lineHeight: 1.6 }}>
                          <div>📅 <strong>Date:</strong> {caseMediation?.nextMeetingDate || result.nextMediationDate}</div>
                          {(caseMediation?.nextMeetingTime || result.nextMediationTime) && (
                            <div>⏰ <strong>Time:</strong> {caseMediation?.nextMeetingTime || result.nextMediationTime}</div>
                          )}
                          <div>📍 <strong>Venue:</strong> {caseMediation?.nextMeetingVenue || result.nextMediationVenue || 'Barangay Poblacion Mediation Hall'}</div>
                        </div>
                        <p style={{ margin: '8px 0 0', fontSize: '0.76rem', color: '#6d28d9' }}>
                          ✉️ An official Notice for this follow-up session has been dispatched to your Gmail. Please ensure compliance with previously agreed commitments.
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

            <div style={{ display: 'flex', gap: 14, marginTop: 24 }}>
              <button className="btn btn-navy" style={{ flex: 1 }}>🎧 Contact Support</button>
              <button className="btn btn-outline" style={{ flex: 1 }}>❓ Browse FAQ</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
