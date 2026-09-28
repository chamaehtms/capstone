import React, { useEffect, useRef, useState } from 'react';
import api from '../api';

export default function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newComplaint, setNewComplaint] = useState(null);
  const initialized = useRef(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/dashboard/overview');
      const residentCases = (data.recentActivity || []).filter(
        (activity) => activity.type === 'case' && activity.filedByResidentId
      );
      const seenIds = JSON.parse(localStorage.getItem('admin_seen_resident_cases') || '[]');

      if (!initialized.current) {
        localStorage.setItem('admin_seen_resident_cases', JSON.stringify(
          [...new Set([...seenIds, ...residentCases.map((item) => item.id)])]
        ));
        initialized.current = true;
        if (showLoading) setItems(residentCases);
        return;
      }

      const newCases = residentCases.filter((item) => !seenIds.includes(item.id));
      if (newCases.length > 0) {
        setItems((current) => {
          const currentIds = new Set(current.map((item) => item.id));
          return [...newCases.filter((item) => !currentIds.has(item.id)), ...current];
        });
        setNewComplaint(newCases[0]);
        localStorage.setItem('admin_seen_resident_cases', JSON.stringify(
          [...new Set([...seenIds, ...residentCases.map((item) => item.id)])]
        ));
      } else if (showLoading) {
        setItems(residentCases);
      }
    } catch {
      if (showLoading) setError('Unable to load notifications.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    const intervalId = window.setInterval(() => loadNotifications(), 15000);
    return () => window.clearInterval(intervalId);
  }, []);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) loadNotifications(true);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggleOpen}
        className="relative text-slate-400 hover:text-slate-600"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {items.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-lg border border-slate-100 z-50">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="font-semibold text-sm text-slate-800">Recent Activity</p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && <p className="px-4 py-4 text-sm text-slate-400">Loading…</p>}
            {error && <p className="px-4 py-4 text-sm text-red-600">{error}</p>}
            {!loading && !error && items.length === 0 && (
              <p className="px-4 py-4 text-sm text-slate-400">No recent activity.</p>
            )}
            {!loading &&
              !error &&
              items.map((item, idx) => (
                <div key={idx} className="px-4 py-3 border-b border-slate-50 last:border-b-0">
                  <div className="flex justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{item.title}</p>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">{item.when}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{item.detail}</p>
                </div>
              ))}
          </div>
        </div>
      )}
      {newComplaint && (
        <div className="fixed top-16 right-6 z-[60] w-80 rounded-xl bg-navy-900 text-white shadow-xl px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-sky-200">New resident complaint</p>
              <p className="text-sm mt-1">{newComplaint.title}</p>
              <p className="text-xs text-slate-300 mt-1">{newComplaint.detail}</p>
            </div>
            <button onClick={() => setNewComplaint(null)} className="text-slate-300 hover:text-white" aria-label="Dismiss notification">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
