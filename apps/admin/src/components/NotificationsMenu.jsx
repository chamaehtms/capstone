import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import AdminIcon from './AdminIcons';

export default function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeAlert, setActiveAlert] = useState(null);
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
      const allActivities = data.recentActivity || [];
      const relevantNotifs = allActivities.filter(
        (activity) =>
          activity.type === 'pending_resident' ||
          activity.type === 'pending_access' ||
          (activity.type === 'case' && activity.filedByResidentId)
      );

      const seenIds = JSON.parse(localStorage.getItem('admin_seen_notifications') || '[]');

      if (!initialized.current) {
        localStorage.setItem(
          'admin_seen_notifications',
          JSON.stringify([...new Set([...seenIds, ...relevantNotifs.map((item) => item.id)])])
        );
        initialized.current = true;
        setItems(relevantNotifs);
        return;
      }

      const newIncoming = relevantNotifs.filter((item) => !seenIds.includes(item.id));
      if (newIncoming.length > 0) {
        setItems((current) => {
          const currentIds = new Set(current.map((item) => item.id));
          return [...newIncoming.filter((item) => !currentIds.has(item.id)), ...current];
        });
        setActiveAlert(newIncoming[0]);
        localStorage.setItem(
          'admin_seen_notifications',
          JSON.stringify([...new Set([...seenIds, ...relevantNotifs.map((item) => item.id)])])
        );
      } else if (showLoading) {
        setItems(relevantNotifs);
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
        className="relative text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
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
          <span className="absolute 1 top-0.5 right-0.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-88 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
            <p className="font-semibold text-sm flex items-center gap-2">
              <AdminIcon name="bolt" size={14} className="text-amber-400" />
              <span>Notifications & Activity</span>
            </p>
            <span className="text-[11px] text-slate-300 font-medium">{items.length} updates</span>
          </div>

          <div className="max-h-84 overflow-y-auto divide-y divide-slate-100">
            {loading && <p className="px-4 py-4 text-xs text-slate-400">Loading notifications…</p>}
            {error && <p className="px-4 py-4 text-xs text-red-600">{error}</p>}
            {!loading && !error && items.length === 0 && (
              <div className="px-4 py-6 text-center text-slate-400">
                <AdminIcon name="check-circle" size={20} className="mx-auto mb-1 text-slate-300" />
                <p className="text-xs">No pending requests or recent activity.</p>
              </div>
            )}
            {!loading &&
              !error &&
              items.map((item, idx) => {
                const isPending = item.type === 'pending_resident' || item.type === 'pending_access';
                return (
                  <Link
                    key={idx}
                    to={item.link || '/pending-requests'}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 hover:bg-slate-50 transition group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {isPending ? (
                          <AdminIcon name="shield" size={13} className="text-amber-600 shrink-0" />
                        ) : (
                          <AdminIcon name="document" size={13} className="text-blue-600 shrink-0" />
                        )}
                        <p className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition">
                          {item.title}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">{item.when}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 pl-4.5 leading-snug">{item.detail}</p>
                  </Link>
                );
              })}
          </div>

          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-center">
            <Link
              to="/pending-requests"
              onClick={() => setOpen(false)}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
            >
              View All Pending Requests &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Floating Pop-up Toast Alert */}
      {activeAlert && (
        <div className="fixed top-16 right-6 z-[60] w-88 rounded-xl bg-navy-900 text-white shadow-2xl px-4 py-3 border border-slate-700 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <AdminIcon
                  name={activeAlert.type.startsWith('pending') ? 'shield' : 'document'}
                  size={14}
                  className={activeAlert.type.startsWith('pending') ? 'text-amber-400' : 'text-sky-300'}
                />
                <p className="text-xs font-semibold text-sky-200 uppercase tracking-wide">
                  {activeAlert.type.startsWith('pending') ? 'New Pending Request' : 'New Resident Complaint'}
                </p>
              </div>
              <p className="text-sm font-bold text-white">{activeAlert.title}</p>
              <p className="text-xs text-slate-300 leading-snug">{activeAlert.detail}</p>
              <div className="pt-1.5">
                <Link
                  to={activeAlert.link || '/pending-requests'}
                  onClick={() => setActiveAlert(null)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-300 hover:text-white underline underline-offset-2"
                >
                  Review Request &rarr;
                </Link>
              </div>
            </div>
            <button
              onClick={() => setActiveAlert(null)}
              className="text-slate-400 hover:text-white p-1 rounded transition"
              aria-label="Dismiss notification"
            >
              <AdminIcon name="x" size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
