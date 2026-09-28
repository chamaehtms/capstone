import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const PRIORITY_OPTIONS = ['Normal', 'Medium', 'High', 'Critical'];

export default function Escalation() {
  const [escalationCandidates, setEscalationCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingPriorityId, setUpdatingPriorityId] = useState(null);

  const fetchEscalations = () => {
    setLoading(true);
    api.get('/escalations').then((res) => {
      setEscalationCandidates(res.data.escalationCandidates || []);
      setLoading(false);
    }).catch(() => {
      setError('Unable to load escalation candidates.');
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchEscalations();
  }, []);

  const handlePriorityChange = async (id, priority) => {
    setUpdatingPriorityId(id);
    setError('');
    try {
      await api.put(`/complaints/${id}`, { priority });
      setEscalationCandidates((current) => current.map((candidate) => (
        candidate.id === id ? { ...candidate, priority } : candidate
      )));
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update complaint priority.');
    } finally {
      setUpdatingPriorityId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Escalation Management</h1>
          <p className="text-sm text-slate-500">
            Manage critical administrative escalations and judicial requests requiring higher-level
            oversight and formal mediation.
          </p>
        </div>
        <Link
          to="/escalation/new"
          className="bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium rounded-lg px-4 py-2.5 whitespace-nowrap"
        >
          Create Escalation Letter
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-800">Complaints Needing Escalation</h2>
            <p className="text-xs text-slate-500 mt-1">Cases marked for escalation from the Complaints Record.</p>
          </div>
          <span className="text-xs font-semibold bg-red-100 text-red-700 px-2.5 py-1 rounded-full">
            {escalationCandidates.length} flagged
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="px-5 py-3 font-medium">CASE ID</th>
                <th className="px-5 py-3 font-medium">RESIDENT</th>
                <th className="px-5 py-3 font-medium">CATEGORY</th>
                <th className="px-5 py-3 font-medium">STATUS</th>
                <th className="px-5 py-3 font-medium">PRIORITY</th>
                <th className="px-5 py-3 font-medium">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {escalationCandidates.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-6 text-center text-slate-400">No complaints marked for escalation.</td></tr>
              )}
              {escalationCandidates.map((candidate) => (
                <tr key={candidate.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-blue-600">{candidate.id}</td>
                  <td className="px-5 py-3 text-slate-700">{candidate.resident}</td>
                  <td className="px-5 py-3 text-slate-500">{candidate.category}</td>
                  <td className="px-5 py-3 text-slate-500">{candidate.status}</td>
                  <td className="px-5 py-3">
                    <select
                      value={candidate.priority || 'Normal'}
                      onChange={(event) => handlePriorityChange(candidate.id, event.target.value)}
                      disabled={updatingPriorityId === candidate.id}
                      className="text-xs font-medium px-2 py-1 rounded-lg border border-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                    >
                      {PRIORITY_OPTIONS.map((priority) => (
                        <option key={priority} value={priority}>{priority}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3 whitespace-nowrap">
                      <Link to={`/complaints/${candidate.id}`} className="text-blue-600 text-xs hover:underline">
                        Review Complaint
                      </Link>
                      <Link
                        to={`/escalation/new?caseRef=${encodeURIComponent(candidate.id)}&category=${encodeURIComponent(candidate.category || '')}`}
                        className="text-xs font-medium bg-navy-900 hover:bg-navy-800 text-white px-2.5 py-1.5 rounded-lg"
                      >
                        Create Letter
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
