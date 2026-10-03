import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import StatCard from '../components/StatCard.jsx';

export default function Overview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOverview = () => {
    setLoading(true);
    setError('');
    api
      .get('/dashboard/overview')
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error('Failed to load dashboard overview:', err);
        setError(err.response?.data?.message || err.message || 'Unable to load dashboard data. Please make sure the server is running.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOverview();
  }, []);

  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
          <p className="text-sm text-slate-500">Poblacion Admin · Local Government Unit</p>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <p className="font-semibold text-sm">Unable to load dashboard data</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
          <button
            onClick={loadOverview}
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) return <p className="text-slate-500">Loading overview…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500">Poblacion Admin · Local Government Unit</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard
          label="Total Population"
          value={data.totalPopulation.toLocaleString()}
          accent="blue"
          sub="↑ 2.4% increase from last quarter"
        />
        <StatCard label="Pending Complaints" value={data.pendingComplaints} accent="red">
          {data.highPriorityComplaints > 0 && (
            <span className="inline-block mt-2 text-[11px] font-semibold bg-red-100 text-red-600 px-2 py-0.5 rounded">
              HIGH PRIORITY / OVERDUE
            </span>
          )}
        </StatCard>
        <StatCard label="Resolved cases" value={String(data.activeProjects).padStart(2, '0')} accent="green">
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
            <div
              className="bg-green-500 h-1.5 rounded-full"
              style={{ width: `${data.activeProjectsCompletionPct}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {data.activeProjectsCompletionPct}% overall completion
          </p>
        </StatCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Recent Institutional Activity</h2>
            <Link to="/complaints" className="text-xs text-blue-600 hover:underline">
              View Full Ledger
            </Link>
          </div>
          <ul className="space-y-4">
            {data.recentActivity.map((item, idx) => (
              <li key={idx} className="flex justify-between gap-3">
                <div>
                  <p className="font-medium text-sm text-slate-800">{item.title}</p>
                  <p className="text-sm text-slate-500">{item.detail}</p>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">{item.when}</span>
              </li>
            ))}
            {data.recentActivity.length === 0 && (
              <p className="text-sm text-slate-400">No recent activity yet.</p>
            )}
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Administrative Actions</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Link to="/residents/enroll" className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100">
              <p className="text-xl">👤➕</p>
              <p className="text-[11px] mt-1 text-slate-600">Add Resident</p>
            </Link>
            <Link to="/complaints" className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100">
              <p className="text-xl">📄</p>
              <p className="text-[11px] mt-1 text-slate-600">Reports</p>
            </Link>
            <Link to="/announcements" className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100">
              <p className="text-xl">📢</p>
              <p className="text-[11px] mt-1 text-slate-600">Announce</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
