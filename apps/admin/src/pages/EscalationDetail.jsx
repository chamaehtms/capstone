import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api';

const STATUS_OPTIONS = ['Under Review', 'Mediation', 'Resolved'];

const priorityStyles = {
  Critical: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-blue-100 text-blue-700',
};

export default function EscalationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [escalation, setEscalation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/escalations/${id}`)
      .then((res) => setEscalation(res.data))
      .catch(() => setError('Escalation case not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (event) => {
    const status = event.target.value;
    setUpdating(true);
    setError('');
    try {
      const { data } = await api.put(`/escalations/${id}`, { status });
      setEscalation(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update escalation status.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <p className="text-slate-500">Loading escalation case...</p>;
  if (error && !escalation) return <p className="text-red-600">{error}</p>;

  return (
    <div className="max-w-4xl space-y-6">
      <Link to="/escalation" className="text-sm text-blue-600 hover:underline">
        &larr; Back to Escalation Queue
      </Link>

      <div className="bg-white rounded-xl shadow-sm p-6 flex items-start justify-between gap-5">
        <div>
          <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase">Escalation Case</p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">{escalation.id}</h1>
          <p className="text-sm text-slate-500 mt-1">{escalation.subject || 'No subject provided'}</p>
        </div>
        <select
          value={escalation.status}
          onChange={handleStatusChange}
          disabled={updating}
          className="text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
        >
          {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-slate-800 mb-4">Escalation Letter Details</h2>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div><dt className="text-xs text-slate-400 uppercase">Department</dt><dd className="mt-1 text-slate-700">{escalation.toDepartment || '—'}</dd></div>
              <div><dt className="text-xs text-slate-400 uppercase">Recipient</dt><dd className="mt-1 text-slate-700">{escalation.toRecipient || '—'}</dd></div>
              <div><dt className="text-xs text-slate-400 uppercase">Category</dt><dd className="mt-1 text-slate-700">{escalation.category || '—'}</dd></div>
              <div><dt className="text-xs text-slate-400 uppercase">Reason</dt><dd className="mt-1 text-slate-700">{escalation.reason || '—'}</dd></div>
              <div><dt className="text-xs text-slate-400 uppercase">Case Reference</dt><dd className="mt-1 text-slate-700">{escalation.caseRef || '—'}</dd></div>
              <div><dt className="text-xs text-slate-400 uppercase">Date Issued</dt><dd className="mt-1 text-slate-700">{escalation.escalated || '—'}</dd></div>
            </dl>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-slate-800 mb-3">Letter Body</h2>
            <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
              {escalation.body || 'No letter body provided.'}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 mb-3 text-sm">Case Summary</h2>
            <div className="space-y-3 text-sm">
              <div><p className="text-xs text-slate-400">PRIORITY</p><span className={`inline-block mt-1 text-xs font-medium px-2 py-1 rounded-full ${priorityStyles[escalation.priority] || 'bg-slate-100 text-slate-600'}`}>{escalation.priority || 'Medium'}</span></div>
              <div><p className="text-xs text-slate-400">OVERSEER</p><p className="text-slate-700 mt-1">{escalation.overseer || 'Unassigned'}</p></div>
              <div><p className="text-xs text-slate-400">STATUS</p><p className="text-slate-700 mt-1">{escalation.status}</p></div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/escalation/${escalation.id}/issued`, { state: { escalation } })}
            className="w-full bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium rounded-lg px-4 py-2.5"
          >
            View / Print Letter
          </button>
        </div>
      </div>
    </div>
  );
}
