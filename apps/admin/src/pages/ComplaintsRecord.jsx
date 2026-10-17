import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import StatCard from '../components/StatCard.jsx';
import StatusDropdown from '../components/StatusDropdown.jsx';
import AdminIcon from '../components/AdminIcons.jsx';

const STATUS_OPTIONS = ['Pending', 'Under Review', 'In Progress', 'Mediation', 'Resolved/Escalated'];

const statusStyles = {
  Pending: 'bg-amber-100 text-amber-700',
  'Under Review': 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Mediation: 'bg-sky-100 text-sky-800',
  'Resolved/Escalated': 'bg-emerald-100 text-emerald-700',
  'Resolved / Escalated': 'bg-emerald-100 text-emerald-700',
  Resolved: 'bg-emerald-100 text-emerald-700',
  Escalated: 'bg-rose-100 text-rose-700',
  Closed: 'bg-emerald-100 text-emerald-700',
};

function formatFilingDate(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatFilingDateTime(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getFilingAgeDays(filingDate) {
  if (!filingDate) return null;

  const date = new Date(filingDate);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const diffTime = Math.max(0, now - date);
  return Math.floor(diffTime / 86400000);
}

export default function ComplaintsRecord() {
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState({ active: 0, resolutionRate: 0 });
  const [search, setSearch] = useState('');
  const [filingRecency, setFilingRecency] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');

  const fetchComplaints = async (q = '') => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/complaints', { params: { search: q } });
      setComplaints(data.complaints || []);
      setStats(data.stats || { active: 0, resolutionRate: 0 });
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Unable to load complaints records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchComplaints(search);
  };

  const isTerminalStatus = (c) =>
    c.needsEscalation === true ||
    c.status === 'Escalated' ||
    c.status === 'Resolved' ||
    c.status === 'Resolved/Escalated' ||
    c.status === 'Resolved / Escalated' ||
    c.status === 'Rejected' ||
    c.status === 'Closed';

  const matchesDateFilter = (complaint) => {
    if (filingRecency === 'all') return true;
    if (!complaint.filingDate) return false;

    const dateStr = String(complaint.filingDate).slice(0, 10);
    const itemDate = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(itemDate.getTime())) return false;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filingRecency === 'today') {
      return itemDate.getTime() === today.getTime();
    }

    if (filingRecency === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return itemDate.getTime() === yesterday.getTime();
    }

    if (filingRecency === 'this_week') {
      // Week starting Sunday or Monday - start from Sunday (or Monday) of current week
      const dayOfWeek = today.getDay(); // 0 is Sunday
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      return itemDate >= startOfWeek && itemDate <= today;
    }

    if (filingRecency === 'this_month') {
      return itemDate.getFullYear() === today.getFullYear() && itemDate.getMonth() === today.getMonth();
    }

    if (filingRecency === 'last_30_days') {
      const past30 = new Date(today);
      past30.setDate(today.getDate() - 30);
      return itemDate >= past30 && itemDate <= today;
    }

    if (filingRecency === 'custom') {
      if (customStartDate) {
        const start = new Date(`${customStartDate}T00:00:00`);
        if (!Number.isNaN(start.getTime()) && itemDate < start) return false;
      }
      if (customEndDate) {
        const end = new Date(`${customEndDate}T23:59:59`);
        if (!Number.isNaN(end.getTime()) && itemDate > end) return false;
      }
      return true;
    }

    return true;
  };

  const filteredComplaints = complaints.filter((complaint) => {
    // Status filter
    if (statusFilter === 'in-progress') {
      if (complaint.status !== 'In Progress') return false;
      if (
        complaint.needsEscalation === true ||
        complaint.status === 'Escalated' ||
        complaint.status === 'Resolved' ||
        complaint.status === 'Resolved/Escalated' ||
        complaint.status === 'Resolved / Escalated' ||
        complaint.status === 'Rejected' ||
        complaint.status === 'Closed'
      ) return false;
    } else if (statusFilter === 'pending') {
      if (complaint.status !== 'Pending') return false;
    } else if (statusFilter === 'under-review') {
      if (complaint.status !== 'Under Review') return false;
    } else if (statusFilter === 'mediation') {
      if (complaint.status !== 'Mediation') return false;
    } else if (statusFilter === 'escalated') {
      const isEscalated =
        complaint.needsEscalation === true ||
        complaint.status === 'Escalated';
      if (!isEscalated) return false;
    } else if (statusFilter === 'resolved') {
      const isResolved =
        complaint.status === 'Resolved' ||
        complaint.status === 'Resolved/Escalated' ||
        complaint.status === 'Resolved / Escalated' ||
        complaint.status === 'Closed';
      if (!isResolved || complaint.needsEscalation === true || complaint.status === 'Escalated') return false;
    } else if (statusFilter === 'rejected') {
      if (complaint.status !== 'Rejected') return false;
    }
    // statusFilter === 'all' — no status filter applied

    return matchesDateFilter(complaint);
  });

  const visibleComplaints = [...filteredComplaints].sort((a, b) => {
    const timeA = new Date(a.filingDate || a.submittedAt || 0).getTime();
    const timeB = new Date(b.filingDate || b.submittedAt || 0).getTime();
    // In Progress view: oldest first to surface overdue cases
    if (statusFilter === 'in-progress') return timeA - timeB;
    // All other views: newest first
    return timeB - timeA;
  });

  const handleStatusUpdate = async (caseId, newStatus, needsEscalation = false) => {
    setError('');
    setUpdatingId(caseId);
    try {
      await api.put(`/complaints/${caseId}`, {
        status: newStatus,
        needsEscalation: needsEscalation === true,
      });
      // Refresh so both the row and the stat cards (active count, resolution rate) stay accurate.
      await fetchComplaints(search);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteComplaint = async (caseId) => {
    const confirmed = window.confirm('Are you sure you want to delete this complaint record? This action cannot be undone.');
    if (!confirmed) return;

    setError('');
    setUpdatingId(caseId);
    try {
      await api.delete(`/complaints/${caseId}`);
      await fetchComplaints(search);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete complaint record.');
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
        <StatCard
          label="Active Blotters"
          value={<span className="font-mono">{stats.active || 0}</span>}
          accent="green"
          sub="Disputes currently in conciliation or review"
        />
        <StatCard
          label="Scheduled Hearings"
          value={<span className="font-mono">{stats.scheduledHearings || 0}</span>}
          accent="orange"
          sub="Pending mediation sessions assigned"
        />
        <StatCard
          label="Dispute Resolution Rate"
          value={<span className="font-mono">{stats.resolutionRate || 0}%</span>}
          accent="blue"
          sub={`${stats.resolved || 0} disputes successfully settled`}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Active Repository</h2>
          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={handleSearch}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search case ID, resident name, or incident..."
                className="w-80 max-w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </form>
            <select
              aria-label="Filter cases by filing date"
              value={filingRecency}
              onChange={(e) => setFilingRecency(e.target.value)}
              className="w-48 max-w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Any filing date</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
            {filingRecency === 'custom' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Start"
                  title="Start Date"
                />
                <span className="text-slate-400 font-medium">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="End"
                  title="End Date"
                />
              </div>
            )}
            <select
              aria-label="Filter complaints by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-52 max-w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="under-review">Under Review</option>
              <option value="in-progress">In Progress</option>
              <option value="mediation">Mediation</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">CASE ID</th>
              <th className="px-5 py-3 font-medium">RESIDENT</th>
              <th className="px-5 py-3 font-medium">CATEGORY</th>
              <th className="px-5 py-3 font-medium">STATUS</th>
              <th className="px-5 py-3 font-medium">ESCALATION</th>
              <th className="px-5 py-3 font-medium">FILING DATE</th>
              <th className="px-5 py-3 font-medium text-right">ACTION</th>
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
            {!loading && visibleComplaints.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                  {complaints.length === 0 ? 'No cases found.' : 'No cases match this filing-date filter.'}
                </td>
              </tr>
            )}
            {visibleComplaints.map((c) => (
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
                  {(c.aiScanStatus === 'ai_detected' || c.aiScanStatus === 'possibly_ai_generated') && (
                    <span className="ml-2 text-[10px] font-semibold bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200">
                      AI Detected
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-700">{c.resident}</td>
                <td className="px-5 py-3 text-slate-500">{c.category}</td>
                <td className="px-5 py-3">
                  <StatusDropdown
                    status={c.status}
                    needsEscalation={c.needsEscalation}
                    disabled={updatingId === c.id}
                    onChange={(newStatus, needsEsc) => handleStatusUpdate(c.id, newStatus, needsEsc)}
                  />
                </td>
                <td className="px-5 py-3">
                  {c.needsEscalation ? (
                    <span className="text-[11px] font-semibold bg-rose-100 text-rose-700 px-2 py-1 rounded-md inline-flex items-center gap-1">
                      <span>↗</span> Escalated Case
                    </span>
                  ) : (c.status === 'Resolved/Escalated' || c.status === 'Resolved' || c.status === 'Closed') ? (
                    <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md inline-flex items-center gap-1.5">
                      <AdminIcon name="check" size={13} />
                      <span>Resolved (Settled)</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">Not marked</span>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-500">
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-800">{formatFilingDate(c.filingDate)}</span>
                    {formatFilingDateTime(c.filingDate) && (
                      <span className="text-[11px] text-slate-400">{formatFilingDateTime(c.filingDate)}</span>
                    )}
                    {c.status === 'In Progress' && !c.needsEscalation && c.status !== 'Escalated' && c.status !== 'Resolved' && c.status !== 'Rejected' && (() => {
                      const days = getFilingAgeDays(c.filingDate);
                      if (days === null) return null;
                      if (days >= 30) {
                        return (
                          <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5 mt-0.5 inline-flex items-center gap-1 w-fit">
                            <AdminIcon name="warning" size={11} className="text-rose-600" />
                            <span>{days}d pending</span>
                          </span>
                        );
                      }
                      if (days >= 7) {
                        return (
                          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-0.5 inline-flex items-center gap-1 w-fit">
                            <AdminIcon name="clock" size={11} className="text-amber-600" />
                            <span>{days}d in progress</span>
                          </span>
                        );
                      }
                      return (
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          {days === 0 ? 'Today' : `${days}d in progress`}
                        </span>
                      );
                    })()}
                  </div>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      to={`/complaints/${c.id}`}
                      className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteComplaint(c.id)}
                      disabled={updatingId === c.id}
                      className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm hover:bg-red-100 transition-colors disabled:opacity-60"
                    >
                      Delete
                    </button>
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
