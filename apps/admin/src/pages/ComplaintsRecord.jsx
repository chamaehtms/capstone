import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import StatCard from '../components/StatCard.jsx';

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Mediation', 'Resolved'];

const statusStyles = {
  Pending: 'bg-amber-100 text-amber-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Mediation: 'bg-purple-100 text-purple-700',
  Resolved: 'bg-green-100 text-green-700',
};

export default function ComplaintsRecord() {
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState({ active: 0, resolutionRate: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');

  const fetchComplaints = async (q = '') => {
    setLoading(true);
    const { data } = await api.get('/complaints', { params: { search: q } });
    setComplaints(data.complaints);
    setStats(data.stats);
    setLoading(false);
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchComplaints(search);
  };

  const handleStatusChange = async (caseId, newStatus) => {
    setError('');
    setUpdatingId(caseId);
    try {
      await api.put(`/complaints/${caseId}`, { status: newStatus });
      // Refresh so both the row and the stat cards (active count, resolution rate) stay accurate.
      await fetchComplaints(search);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update status.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Complaints & Legal Records</h1>
          <p className="text-sm text-slate-500">
            Official repository for legal blotters, community disputes, and administrative cases.
          </p>
        </div>
        <Link
          to="/complaints/new"
          className="bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium rounded-lg px-4 py-2.5 whitespace-nowrap"
        >
          File New Case
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard label="Active Cases" value={stats.active} accent="green" />
        <StatCard label="Hearings This Week" value={8} accent="orange" sub="Next hearing: tomorrow, 10:00 AM" />
        <StatCard label="Resolution Rate" value={`${stats.resolutionRate}%`} accent="blue" sub="Target 90%" />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Active Repository</h2>
          <form onSubmit={handleSearch}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search case ID, resident name, or incident..."
              className="w-80 max-w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </form>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">CASE ID</th>
              <th className="px-5 py-3 font-medium">RESIDENT</th>
              <th className="px-5 py-3 font-medium">CATEGORY</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium">ESCALATION</th>
              <th className="px-5 py-3 font-medium">FILING DATE</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                  Loading cases…
                </td>
              </tr>
            )}
            {!loading && complaints.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                  No cases found.
                </td>
              </tr>
            )}
            {complaints.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Link to={`/complaints/${c.id}`} className="font-medium text-blue-600 hover:underline">
                    {c.id}
                  </Link>
                  {c.filedByResidentId && (
                    <span className="ml-2 text-[10px] font-medium bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded">
                      Resident Portal
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-700">{c.resident}</td>
                <td className="px-5 py-3 text-slate-500">{c.category}</td>
                <td className="px-5 py-3">
                  <select
                    value={c.status}
                    onChange={(e) => handleStatusChange(c.id, e.target.value)}
                    disabled={updatingId === c.id}
                    className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 ${
                      statusStyles[c.status] || 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} className="bg-white text-slate-700">
                        {opt}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-3">
                  {c.needsEscalation ? (
                    <span className="text-[11px] font-semibold bg-red-100 text-red-700 px-2 py-1 rounded-full">
                      Needs Escalation
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">Not marked</span>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-500">{c.filingDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
