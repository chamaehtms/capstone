import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function CaseFiling() {
  const [form, setForm] = useState({
    resident: '',
    category: 'Noise Nuisance',
    priority: 'Normal',
    description: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/complaints', form);
      navigate('/complaints');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to file case.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">File New Case</h1>
        <p className="text-sm text-slate-500">
          Register a new complaint, dispute, or administrative case for Barangay Poblacion.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-600">
            RESIDENT / COMPLAINANT <span className="text-red-500">*</span>
          </label>
          <input
            value={form.resident}
            onChange={update('resident')}
            placeholder="Full name of resident filing the complaint"
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600">CATEGORY</label>
            <select
              value={form.category}
              onChange={update('category')}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>Noise Nuisance</option>
              <option>Sanitation</option>
              <option>Boundary Dispute</option>
              <option>Utility Misuse</option>
              <option>Zoning Breach</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">PRIORITY</label>
            <select
              value={form.priority}
              onChange={update('priority')}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>Normal</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">OBJECTIVES & DETAILS</label>
          <textarea
            value={form.description}
            onChange={update('description')}
            rows={5}
            placeholder="Outline the key points for this case..."
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
            {loading ? 'Filing…' : 'Confirm & File Case'}
          </button>
        </div>
      </form>
    </div>
  );
}
