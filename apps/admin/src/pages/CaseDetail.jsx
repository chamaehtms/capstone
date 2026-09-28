import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Mediation', 'Resolved'];

const statusStyles = {
  Pending: 'bg-amber-100 text-amber-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Mediation: 'bg-purple-100 text-purple-700',
  Resolved: 'bg-green-100 text-green-700',
};

function formatDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const cleanStr = String(dateStr).split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  }
  return dateStr;
}

export default function CaseDetail() {
  const { id } = useParams();
  const [complaint, setComplaint] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [updating, setUpdating] = useState(false);

  // Mediation modal state
  const [isMediationModalOpen, setIsMediationModalOpen] = useState(false);
  const [schedulingMediation, setSchedulingMediation] = useState(false);
  const [resendingNotice, setResendingNotice] = useState(false);
  const [mediationForm, setMediationForm] = useState({
    date: '',
    time: '10:00 AM',
    venue: 'Barangay Poblacion Mediation Hall / Session Room',
    mediator: 'Hon. Roberto Cruz (Barangay Captain / Lupon Chairman)',
    hearingStage: '1st Mediation Hearing',
    notes: '',
    residentEmail: '',
    sendNotification: true,
  });

  const load = () => {
    api
      .get(`/complaints/${id}`)
      .then((res) => {
        setComplaint(res.data);
      })
      .catch(() => setError('Case not found.'));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'Mediation' && !complaint?.scheduledMeeting) {
      openMediationModal();
      return;
    }

    setUpdating(true);
    try {
      const { data } = await api.put(`/complaints/${id}`, { status: newStatus });
      setComplaint(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleEscalationChange = async () => {
    setUpdating(true);
    setError('');
    try {
      const { data } = await api.put(`/complaints/${id}`, {
        needsEscalation: !complaint.needsEscalation,
      });
      setComplaint(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update escalation decision.');
    } finally {
      setUpdating(false);
    }
  };

  const openMediationModal = () => {
    const today = new Date();
    today.setDate(today.getDate() + 2); // Default 2 days out
    const defaultDate = today.toISOString().split('T')[0];

    setMediationForm({
      date: complaint?.scheduledMeeting?.date ? String(complaint.scheduledMeeting.date).split('T')[0] : defaultDate,
      time: complaint?.scheduledMeeting?.time || '10:00 AM',
      venue: complaint?.scheduledMeeting?.venue || 'Barangay Poblacion Mediation Hall / Session Room',
      mediator: complaint?.scheduledMeeting?.mediator || 'Hon. Roberto Cruz (Barangay Captain / Lupon Chairman)',
      hearingStage: complaint?.scheduledMeeting?.hearingStage || '1st Mediation Hearing',
      notes: complaint?.scheduledMeeting?.notes || `Katarungang Pambarangay mediation session for Case ${complaint?.id || id}. Please bring valid government IDs and supporting evidence.`,
      residentEmail: complaint?.residentEmail || '',
      sendNotification: true,
    });
    setIsMediationModalOpen(true);
  };

  const handleScheduleMediation = async (e) => {
    e.preventDefault();
    if (!mediationForm.date) {
      alert('Mediation date is required.');
      return;
    }

    setSchedulingMediation(true);
    setError('');
    setMessage('');

    try {
      const { data } = await api.post(`/complaints/${id}/schedule-mediation`, mediationForm);
      setComplaint(data.complaint);
      setMessage(data.message || 'Mediation scheduled successfully!');
      setIsMediationModalOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to schedule mediation.');
    } finally {
      setSchedulingMediation(false);
    }
  };

  const handleResendNotice = async () => {
    if (!complaint?.scheduledMeeting?.id) return;
    setResendingNotice(true);
    setError('');
    setMessage('');

    try {
      const { data } = await api.post(`/meetings/${complaint.scheduledMeeting.id}/resend-notification`);
      setMessage(data.message || 'Notification notice resent to resident successfully.');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend notice.');
    } finally {
      setResendingNotice(false);
    }
  };

  if (error && !complaint) return <p className="text-red-600">{error}</p>;
  if (!complaint) return <p className="text-slate-500">Loading case…</p>;

  const isFromPortal = !!complaint.filedByResidentId;
  const hasMediation = !!complaint.scheduledMeeting || complaint.status === 'Mediation';

  return (
    <div className="max-w-4xl space-y-6">
      <Link to="/complaints" className="text-sm text-blue-600 hover:underline">
        ← Back to Complaints Record
      </Link>

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center justify-between">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} className="text-emerald-600 hover:text-emerald-900">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-red-600 hover:text-red-900">✕</button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{complaint.category}</h1>
            {isFromPortal && (
              <span className="text-[11px] font-medium bg-sky-50 text-sky-600 px-2 py-0.5 rounded">
                Filed via Resident Portal
              </span>
            )}
            {hasMediation && (
              <span className="text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">
                ⚖️ Lupon Mediation
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Case ID: {complaint.id} · Filed by {complaint.resident} · {complaint.filingDate}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={complaint.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={updating}
            className={`text-sm font-medium px-3.5 py-1.5 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 ${
              statusStyles[complaint.status] || 'bg-slate-100 text-slate-600'
            }`}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt} className="bg-white text-slate-700">
                {opt}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={openMediationModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition shadow-xs"
          >
            <span>⚖️</span>
            <span>{complaint.scheduledMeeting ? 'Edit Mediation' : 'Schedule Mediation'}</span>
          </button>
        </div>
      </div>

      {/* SCHEDULED MEDIATION HEARING CARD */}
      {complaint.scheduledMeeting && (
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-xl shadow-md p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                  ⚖️ {complaint.scheduledMeeting.hearingStage || 'Official Mediation Hearing'}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-500/30 text-purple-200 border border-purple-400/40">
                  Katarungang Pambarangay
                </span>
              </div>

              <div className="mt-2 space-y-1">
                <h3 className="text-lg font-bold text-white">
                  📅 {formatDate(complaint.scheduledMeeting.date)} {complaint.scheduledMeeting.time && `· ⏰ ${complaint.scheduledMeeting.time}`}
                </h3>
                <p className="text-xs text-purple-200 flex flex-wrap items-center gap-x-4">
                  <span>📍 Venue: <strong>{complaint.scheduledMeeting.venue || 'Barangay Mediation Hall'}</strong></span>
                  {complaint.scheduledMeeting.mediator && (
                    <span>👤 Presiding Officer: <strong>{complaint.scheduledMeeting.mediator}</strong></span>
                  )}
                </p>
              </div>

              {/* Notice delivery info */}
              <div className="mt-3 flex items-center gap-2 text-xs">
                {complaint.scheduledMeeting.notificationSent ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                    <span>✉️</span>
                    <span>Notice of Hearing Sent via Email to <strong>{complaint.residentEmail || 'Complainant'}</strong></span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                    <span>⚠️</span>
                    <span>Notice email not yet sent ({complaint.residentEmail || 'No complainant email recorded'})</span>
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleResendNotice}
                disabled={resendingNotice || !complaint.residentEmail}
                className="px-3.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg transition disabled:opacity-50"
              >
                {resendingNotice ? 'Sending…' : '✉️ Resend Notice Email'}
              </button>

              <button
                type="button"
                onClick={openMediationModal}
                className="px-3.5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition shadow-xs"
              >
                ✏️ Reschedule Hearing
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {complaint.narrative && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-3">Narrative</h2>
              <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                {complaint.narrative}
              </p>
            </div>
          )}

          {!complaint.narrative && complaint.description && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-3">Description</h2>
              <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                {complaint.description}
              </p>
            </div>
          )}

          {complaint.reliefSought && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-3">Relief Sought</h2>
              <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                {complaint.reliefSought}
              </p>
            </div>
          )}

          {(complaint.respondent || complaint.respondentAddress) && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-3">Respondent</h2>
              <p className="text-sm text-slate-700 font-medium">{complaint.respondent || '—'}</p>
              <p className="text-sm text-slate-500 mt-1">{complaint.respondentAddress || '—'}</p>
            </div>
          )}

          {complaint.attachmentUrl && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-3">Evidence / Attachment</h2>
              <a
                href={complaint.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block"
              >
                {/\.(jpe?g|png|gif|webp)$/i.test(complaint.attachmentUrl) ? (
                  <img
                    src={complaint.attachmentUrl}
                    alt="Evidence"
                    className="max-h-64 rounded-lg border border-slate-200"
                  />
                ) : (
                  <span className="text-sm text-blue-600 hover:underline">View attached file →</span>
                )}
              </a>
            </div>
          )}

          {complaint.attachmentUrl && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-3">AI Evidence Scan</h2>
              <p className={`text-sm font-semibold ${complaint.aiScanStatus === 'possibly_ai_generated' ? 'text-red-600' : complaint.aiScanStatus === 'likely_authentic' ? 'text-green-600' : 'text-amber-600'}`}>
                {complaint.aiScanStatus === 'possibly_ai_generated'
                  ? 'Possibly AI-generated'
                  : complaint.aiScanStatus === 'likely_authentic'
                    ? 'Likely authentic'
                    : complaint.aiScanStatus === 'not_configured'
                      ? 'AI scan not configured'
                      : complaint.aiScanStatus === 'provider_unavailable'
                        ? 'AI provider unavailable; manual review required'
                        : 'Manual review required'}
              </p>
              {complaint.aiScanScore !== null && complaint.aiScanScore !== undefined && (
                <p className="text-xs text-slate-500 mt-1">AI-generated confidence: {(Number(complaint.aiScanScore) * 100).toFixed(1)}%</p>
              )}
              <p className="text-xs text-slate-400 mt-2">This result is advisory and does not replace staff review.</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 mb-3 text-sm">Filing Details</h2>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-slate-400">COMPLAINANT ADDRESS</p>
                <p className="text-slate-700">{complaint.complainantAddress || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">COMPLAINANT EMAIL</p>
                <p className="text-slate-700 font-medium">{complaint.residentEmail || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">PRIORITY</p>
                <p className="text-slate-700">{complaint.priority}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">ESCALATION DECISION</p>
                <p className={`mt-1 text-sm font-semibold ${complaint.needsEscalation ? 'text-red-600' : 'text-slate-500'}`}>
                  {complaint.needsEscalation ? 'Needs Escalation' : 'No Escalation Needed'}
                </p>
                <button
                  type="button"
                  onClick={handleEscalationChange}
                  disabled={updating}
                  className="mt-3 text-xs font-medium text-blue-600 hover:underline disabled:opacity-60"
                >
                  {complaint.needsEscalation ? 'Clear Escalation Flag' : 'Mark for Escalation'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-navy-900 text-white rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-sm mb-3">Timeline</h2>
            <div className="space-y-3 text-xs">
              <div>
                <p className="font-medium text-white">Submitted</p>
                <p className="text-slate-300">{formatDateTime(complaint.submittedAt) || '—'}</p>
              </div>
              <div>
                <p className={complaint.underReviewAt ? 'font-medium text-white' : 'text-slate-400'}>
                  Under Review
                </p>
                <p className="text-slate-300">{formatDateTime(complaint.underReviewAt) || 'Not yet'}</p>
              </div>
              <div>
                <p className={hasMediation ? 'font-medium text-purple-300' : 'text-slate-400'}>
                  Mediation Hearing
                </p>
                <p className="text-slate-300">
                  {complaint.scheduledMeeting ? `${formatDate(complaint.scheduledMeeting.date)} (${complaint.scheduledMeeting.time || '10:00 AM'})` : 'Not yet'}
                </p>
              </div>
              <div>
                <p className={complaint.resolvedAt ? 'font-medium text-white' : 'text-slate-400'}>
                  Resolved
                </p>
                <p className="text-slate-300">{formatDateTime(complaint.resolvedAt) || 'Not yet'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SCHEDULE MEDIATION MODAL */}
      {isMediationModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsMediationModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-xl my-8 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-purple-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <span>⚖️</span>
                  <span>Schedule Katarungang Pambarangay Mediation</span>
                </h3>
                <p className="text-xs text-purple-200 mt-0.5">
                  Case #{complaint.id} · Complainant: {complaint.resident}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMediationModalOpen(false)}
                className="text-purple-300 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleScheduleMediation} className="p-6 space-y-4 text-xs">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Hearing Stage <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={mediationForm.hearingStage}
                    onChange={(e) => setMediationForm({ ...mediationForm, hearingStage: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-medium focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="1st Mediation Hearing">1st Mediation Hearing (KP Form 7)</option>
                    <option value="2nd Mediation Hearing">2nd Mediation Hearing</option>
                    <option value="3rd Mediation Hearing">3rd Mediation Hearing</option>
                    <option value="Conciliation Proceedings">Conciliation Proceedings (Pangkat Tagapagkasundo)</option>
                    <option value="Arbitration Session">Arbitration Session</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Presiding Mediator / Officer <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={mediationForm.mediator}
                    onChange={(e) => setMediationForm({ ...mediationForm, mediator: e.target.value })}
                    placeholder="e.g. Hon. Roberto Cruz (Barangay Captain)"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Hearing Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={mediationForm.date}
                    onChange={(e) => setMediationForm({ ...mediationForm, date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Hearing Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={mediationForm.time}
                    onChange={(e) => setMediationForm({ ...mediationForm, time: e.target.value })}
                    placeholder="e.g. 10:00 AM or 02:00 PM - 03:30 PM"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Hearing Venue / Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={mediationForm.venue}
                  onChange={(e) => setMediationForm({ ...mediationForm, venue: e.target.value })}
                  placeholder="e.g. Barangay Poblacion Mediation Hall / Session Room"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Complainant Email (for automated Notice of Hearing)
                </label>
                <input
                  type="email"
                  value={mediationForm.residentEmail}
                  onChange={(e) => setMediationForm({ ...mediationForm, residentEmail: e.target.value })}
                  placeholder="resident@example.com"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  The resident's account email will receive the summons notice with hearing date, venue, and attendance instructions.
                </p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Special Instructions / Hearing Notes
                </label>
                <textarea
                  rows={3}
                  value={mediationForm.notes}
                  onChange={(e) => setMediationForm({ ...mediationForm, notes: e.target.value })}
                  placeholder="Instructions for the parties (e.g. Bring copy of deed of sale, valid ID, photos of property boundary)..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Notification Checkbox */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mediationForm.sendNotification}
                    onChange={(e) => setMediationForm({ ...mediationForm, sendNotification: e.target.checked })}
                    className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <span className="font-bold text-purple-900 block">
                      ✉️ Send Official Hearing Notification Email to Resident
                    </span>
                    <span className="text-[11px] text-purple-700 block mt-0.5 leading-relaxed">
                      Sends an official Notice of Mediation Hearing directly to <strong>{mediationForm.residentEmail || 'the complainant email'}</strong> containing the scheduled date, time, venue, and instructions to bring valid IDs.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsMediationModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={schedulingMediation}
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {schedulingMediation ? 'Scheduling & Sending Notice…' : 'Confirm & Schedule Mediation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
