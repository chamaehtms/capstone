import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';

export default function EscalationCompose() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    category: searchParams.get('category') || 'Infrastructure Discrepancy',
    reason: 'Formal Escalation',
    priority: 'High',
    toDepartment: 'Department of Urban Infrastructure & Planning',
    toRecipient: 'Director Sarah Montgomery',
    subject: 'Formal Escalation - Infrastructure Discrepancy',
    body: '',
    caseRef: searchParams.get('caseRef') || '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleIssue = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/escalations', form);
      navigate(`/escalation/${data.id}/issued`, { state: { escalation: data } });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to issue letter.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold bg-blue-50 text-blue-600 px-2 py-1 rounded">
            CIVIC LEDGER PORTAL · ADMINISTRATIVE ESCALATION UNIT
          </span>
          <h1 className="text-xl font-bold text-slate-900 mt-2">Draft Escalation Letter</h1>
        </div>
      </div>

      <form onSubmit={handleIssue} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-500">TO (DEPARTMENT / RECIPIENT)</label>
            <input
              value={form.toDepartment}
              onChange={update('toDepartment')}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={form.toRecipient}
              onChange={update('toRecipient')}
              placeholder="Attn: Recipient name"
              className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">CASE REFERENCE</label>
            <input
              value={form.caseRef}
              onChange={update('caseRef')}
              placeholder="e.g. Case #44819"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-500">CATEGORY</label>
            <input
              value={form.category}
              onChange={update('category')}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">REASON</label>
            <input
              value={form.reason}
              onChange={update('reason')}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">PRIORITY</label>
            <select
              value={form.priority}
              onChange={update('priority')}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500">
            SUBJECT <span className="text-red-500">*</span>
          </label>
          <input
            value={form.subject}
            onChange={update('subject')}
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500">LETTER BODY</label>
          <textarea
            value={form.body}
            onChange={update('body')}
            rows={8}
            placeholder="Draft the formal body of the escalation letter here. Use formal administrative language to detail the grounds for escalation and the requested resolution path..."
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
          >
            Save Draft
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium disabled:opacity-60"
          >
            {loading ? 'Issuing…' : 'Issue Letter'}
          </button>
        </div>
      </form>
    </div>
  );
}
