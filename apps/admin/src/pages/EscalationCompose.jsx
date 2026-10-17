import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';

const DRAFT_STORAGE_KEY = 'bp_escalation_compose_draft';

export default function EscalationCompose() {
  const [searchParams] = useSearchParams();
  const caseRefParam = searchParams.get('caseRef') || '';
  const categoryParam = searchParams.get('category') || '';

  const [form, setForm] = useState(() => {
    // Attempt restoring saved draft from localStorage
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            category: parsed.category || categoryParam || '',
            reason: parsed.reason || 'Formal Escalation',
            toDepartment: parsed.toDepartment || '',
            toRecipient: parsed.toRecipient || '',
            subject: parsed.subject || (categoryParam ? `Formal Escalation - ${categoryParam}` : 'Formal Escalation Letter'),
            body: parsed.body || '',
            caseRef: parsed.caseRef || caseRefParam || '',
          };
        }
      }
    } catch {
      // Ignore parse failure
    }

    return {
      category: categoryParam,
      reason: 'Formal Escalation',
      toDepartment: '',
      toRecipient: '',
      subject: categoryParam ? `Formal Escalation - ${categoryParam}` : 'Formal Escalation Letter',
      body: '',
      caseRef: caseRefParam,
    };
  });

  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSaveDraft = () => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(form));
      setToastMessage('Draft letter saved successfully.');
      setTimeout(() => setToastMessage(''), 3000);
    } catch {
      setError('Unable to save draft in browser storage.');
    }
  };

  const handleClearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setForm({
        category: categoryParam,
        reason: 'Formal Escalation',
        toDepartment: '',
        toRecipient: '',
        subject: categoryParam ? `Formal Escalation - ${categoryParam}` : 'Formal Escalation Letter',
        body: '',
        caseRef: caseRefParam,
      });
      setToastMessage('Draft discarded.');
      setTimeout(() => setToastMessage(''), 3000);
    } catch {
      // Ignore
    }
  };

  const handleIssue = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/escalations', form);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
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
              placeholder="e.g. City Engineering Office / Municipal Social Welfare"
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

        <div className="grid grid-cols-2 gap-4">
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

        {toastMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm font-semibold flex items-center justify-between animate-in fade-in">
            <span>✓ {toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage('')}
              className="text-emerald-600 hover:text-emerald-900 font-bold ml-2 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleClearDraft}
            className="text-xs text-slate-400 hover:text-rose-600 font-medium transition-colors"
          >
            Discard Draft
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors shadow-xs"
            >
              Save Draft
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold disabled:opacity-60 transition-colors shadow-xs"
            >
              {loading ? 'Issuing…' : 'Issue Letter'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
