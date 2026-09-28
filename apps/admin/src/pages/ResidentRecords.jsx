import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import StatCard from '../components/StatCard.jsx';

export default function ResidentRecords() {
  const [residents, setResidents] = useState([]);
  const [stats, setStats] = useState({ total: 0, male: 0, female: 0, verified: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchResidents = async (q = '') => {
    setLoading(true);
    const { data } = await api.get('/residents', { params: { search: q } });
    setResidents(data.residents);
    setStats(data.stats);
    setLoading(false);
  };

  useEffect(() => {
    fetchResidents();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchResidents(search);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Barangay Poblacion MS</h1>
          <p className="text-sm text-slate-500">Manage and maintain the official demographic database of the barangay.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Residents" value={stats.total} accent="blue" />
        <StatCard label="Total Male" value={stats.male} accent="blue" />
        <StatCard label="Total Female" value={stats.female} accent="orange" />
        <StatCard label="Verified" value={stats.verified} accent="green" />
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Resident Registry</h2>
          <div className="flex items-center gap-2">
            <form onSubmit={handleSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name..."
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </form>
            <Link
              to="/residents/enroll"
              className="bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium rounded-lg px-4 py-2 whitespace-nowrap"
            >
              + Add Record
            </Link>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">FULL NAME</th>
              <th className="px-5 py-3 font-medium">ADDRESS</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium">CATEGORY</th>
              <th className="px-5 py-3 font-medium">AGE</th>
              <th className="px-5 py-3 font-medium">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                  Loading residents…
                </td>
              </tr>
            )}
            {!loading && residents.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                  No residents found.
                </td>
              </tr>
            )}
            {residents.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">
                  <div className="flex items-center gap-3">
                    {r.photoUrl ? (
                      <img
                        src={r.photoUrl}
                        alt={r.fullName}
                        className="h-8 w-8 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                        {r.fullName ? r.fullName.slice(0, 2).toUpperCase() : '?'}
                      </div>
                    )}
                    <span>{r.fullName}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-slate-500">{r.zone}</td>
                <td className="px-5 py-3">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      r.status === 'Verified'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500">{(r.category || []).join(', ')}</td>
                <td className="px-5 py-3 text-slate-500">{r.age ?? '-'}</td>
                <td className="px-5 py-3">
                  <Link to={`/residents/${r.id}`} className="text-blue-600 hover:underline text-xs">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
