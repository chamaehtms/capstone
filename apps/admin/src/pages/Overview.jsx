import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import StatCard from '../components/StatCard.jsx';
import AdminIcon from '../components/AdminIcons.jsx';

function formatRelativeTime(dateString) {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getActivityBadge(type) {
  switch (type) {
    case 'pending_resident':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: 'user', label: 'Resident ID' };
    case 'pending_access':
      return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', icon: 'shield', label: 'Staff Access' };
    case 'case':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: 'document', label: 'Dispute Blotter' };
    case 'meeting':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'calendar', label: 'Hearing' };
    default:
      return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', icon: 'document', label: 'Notice' };
  }
}

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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Overview</h1>
          <p className="text-sm text-slate-500">Barangay Poblacion · Local Government Unit</p>
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

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-medium">Loading command center...</span>
        </div>
      </div>
    );
  }

  const pendingRequestsCount = data.totalPendingRequests || 0;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Workbench Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Command Overview</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              SYSTEM ACTIVE
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Barangay Poblacion, Cordova · Katarungang Pambarangay &amp; Civil Administration
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadOverview}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
          >
            <AdminIcon name="refresh" size={13} className="text-slate-500" />
            Refresh
          </button>
          <Link
            to="/complaints/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm"
          >
            <AdminIcon name="document" size={13} className="text-white" />
            Lodge Formal Case
          </Link>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Registered Population"
          value={<span className="font-mono tracking-tight">{data.totalPopulation.toLocaleString()}</span>}
          accent="blue"
          sub="Verified civil registry database"
        />

        <StatCard
          label="Active Case Complaints"
          value={<span className="font-mono tracking-tight">{data.pendingComplaints}</span>}
          accent={data.pendingComplaints > 0 ? 'red' : 'green'}
          sub="Active dispute blotters in review"
        >
          {data.highPriorityComplaints > 0 && (
            <span className="inline-flex items-center gap-1.5 mt-2 text-[10px] font-bold font-mono bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
              {data.highPriorityComplaints} Priority Flagged
            </span>
          )}
        </StatCard>

        <StatCard
          label="Dispute Resolution Rate"
          value={<span className="font-mono tracking-tight">{data.activeProjectsCompletionPct}%</span>}
          accent="green"
          sub={`${data.activeProjects} settled cases concluded`}
        >
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, data.activeProjectsCompletionPct)}%` }}
            />
          </div>
        </StatCard>

        <StatCard
          label="Awaiting Verification"
          value={<span className="font-mono tracking-tight">{pendingRequestsCount}</span>}
          accent={pendingRequestsCount > 0 ? 'orange' : 'blue'}
          sub={`${data.pendingResidentsCount || 0} residents · ${data.pendingAccessCount || 0} staff`}
        >
          {pendingRequestsCount > 0 ? (
            <Link
              to="/pending-requests"
              className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-amber-700 hover:text-amber-800"
            >
              Review queue →
            </Link>
          ) : (
            <p className="text-[11px] font-mono text-emerald-600 mt-2">All queues cleared</p>
          )}
        </StatCard>
      </div>

      {/* Operational Dispatch Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Operational Activity Feed */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm sm:text-base text-slate-800 tracking-tight">Institutional Activity Stream</h2>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Live Audit
              </span>
            </div>
            <Link to="/complaints" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View Complaints Ledger →
            </Link>
          </div>

          <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
            {data.recentActivity && data.recentActivity.length > 0 ? (
              data.recentActivity.map((item, idx) => {
                const badge = getActivityBadge(item.type);
                const ItemWrapper = item.link ? Link : 'div';
                return (
                  <ItemWrapper
                    key={idx}
                    to={item.link}
                    className={`flex items-start gap-3.5 p-4 sm:px-5 transition-colors ${
                      item.link ? 'hover:bg-slate-50/80 cursor-pointer block' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${badge.bg} ${badge.text} border ${badge.border}`}>
                      <AdminIcon name={badge.icon} size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-semibold text-xs sm:text-sm text-slate-900 truncate">{item.title}</p>
                          <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.2 rounded border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {badge.label}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap flex-shrink-0">
                          {item.createdAt ? formatRelativeTime(item.createdAt) : item.when}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                        {item.detail}
                      </p>
                    </div>
                  </ItemWrapper>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                No recent activity recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Right: Operational Quick Dispatch */}
        <div className="space-y-6">
          {/* Quick Actions Panel */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
            <h2 className="font-bold text-sm text-slate-800 tracking-tight mb-3 flex items-center justify-between">
              <span>Quick Dispatch</span>
              <span className="text-[11px] font-mono text-slate-400 font-normal">Civic Tools</span>
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                to="/residents/enroll"
                className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100/90 border border-slate-100 flex flex-col items-center justify-center text-center transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                  <AdminIcon name="user-plus" size={16} />
                </div>
                <p className="text-xs font-semibold text-slate-800">Enroll Resident</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Civil Registry</p>
              </Link>

              <Link
                to="/complaints/new"
                className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100/90 border border-slate-100 flex flex-col items-center justify-center text-center transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                  <AdminIcon name="document" size={16} />
                </div>
                <p className="text-xs font-semibold text-slate-800">Lodge Blotter</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Formal Dispute</p>
              </Link>

              <Link
                to="/meetings"
                className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100/90 border border-slate-100 flex flex-col items-center justify-center text-center transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                  <AdminIcon name="calendar" size={16} />
                </div>
                <p className="text-xs font-semibold text-slate-800">Mediation</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Lupon Hearings</p>
              </Link>

              <Link
                to="/announcements"
                className="p-3 rounded-lg bg-slate-50 hover:bg-slate-100/90 border border-slate-100 flex flex-col items-center justify-center text-center transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                  <AdminIcon name="megaphone" size={16} />
                </div>
                <p className="text-xs font-semibold text-slate-800">Bulletin</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Post Notice</p>
              </Link>
            </div>
          </div>

          {/* Operational Status / Jurisdictional Notice */}
          <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm border border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <AdminIcon name="shield" size={16} className="text-blue-400" />
              <span className="text-xs font-bold font-mono tracking-wider text-slate-200 uppercase">
                KP Jurisdiction Status
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              Katarungang Pambarangay conciliation proceedings are actively maintained under Republic Act 7160.
            </p>
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Jurisdiction: Barangay Poblacion</span>
              <span className="text-emerald-400 font-bold">Compliant</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

