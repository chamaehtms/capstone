import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';

const links = [
  { to: '/', label: 'Overview', icon: '▦', end: true },
  { to: '/residents', label: 'Resident Records', icon: '🧑‍🤝‍🧑', badgeKey: 'residents' },
  { to: '/complaints', label: 'Complaints Record', icon: '📋', badgeKey: 'complaints' },
  { to: '/meetings', label: 'Meeting Minutes', icon: '🗓️', badgeKey: 'meetings' },
  { to: '/escalation', label: 'Escalation', icon: '📈', badgeKey: 'escalations' },
  { to: '/complaints/new', label: 'Case Filing', icon: '📝', badgeKey: 'caseFiling' },
  { to: '/pending-requests', label: 'Pending Requests', icon: '🛂', badgeKey: 'pendingRequests' },
  { to: '/announcements', label: 'Announcements', icon: '📣' },
];

export default function Sidebar() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [newCounts, setNewCounts] = useState({});
  const currentIds = useRef({});

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = admin?.fullName ? admin.fullName.slice(0, 2).toUpperCase() : 'AD';

  useEffect(() => {
    let active = true;

    const readIds = (key) => {
      try {
        return JSON.parse(localStorage.getItem(`admin_sidebar_seen_${key}`) || '[]');
      } catch {
        return [];
      }
    };

    const saveIds = (key, ids) => {
      localStorage.setItem(`admin_sidebar_seen_${key}`, JSON.stringify(ids));
    };

    const updateCount = (key, ids, initialized) => {
      currentIds.current[key] = ids;
      const seen = readIds(key);
      if (!initialized && !localStorage.getItem(`admin_sidebar_seen_${key}`)) {
        saveIds(key, ids);
        return 0;
      }
      return ids.filter((id) => !seen.includes(id)).length;
    };

    const loadCounts = async () => {
      try {
        const [residents, complaints, meetings, escalations, pendingResidents, accessRequests] = await Promise.all([
          api.get('/residents'),
          api.get('/complaints'),
          api.get('/meetings'),
          api.get('/escalations'),
          api.get('/residents/pending-registrations'),
          api.get('/auth/access-requests'),
        ]);
        if (!active) return;

        const initialized = currentIds.current.initialized === true;
        const residentIds = residents.data.residents.map((item) => item.id);
        const complaintIds = complaints.data.complaints.map((item) => item.id);
        const meetingIds = meetings.data.map((item) => item.id);
        const escalationIds = escalations.data.escalations.map((item) => item.id);
        const pendingIds = [
          ...pendingResidents.data.map((item) => `resident-${item.id}`),
          ...accessRequests.data.map((item) => `access-${item.id}`),
        ];

        const counts = {
          residents: updateCount('residents', residentIds, initialized),
          complaints: updateCount('complaints', complaintIds, initialized),
          meetings: updateCount('meetings', meetingIds, initialized),
          escalations: updateCount('escalations', escalationIds, initialized),
          caseFiling: updateCount('caseFiling', complaintIds, initialized),
          pendingRequests: updateCount('pendingRequests', pendingIds, initialized),
        };
        currentIds.current.initialized = true;
        setNewCounts(counts);
      } catch {
        // Sidebar badges are supplemental and should not block navigation.
      }
    };

    loadCounts();
    const intervalId = window.setInterval(loadCounts, 15000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const markSectionRead = (key) => {
    const ids = currentIds.current[key] || [];
    saveSectionRead(key, ids);
    setNewCounts((counts) => ({ ...counts, [key]: 0 }));
  };

  const saveSectionRead = (key, ids) => {
    localStorage.setItem(`admin_sidebar_seen_${key}`, JSON.stringify(ids));
  };

  return (
    <aside className="admin-sidebar w-64 shrink-0 bg-navy-950 text-slate-200 min-h-screen flex flex-col">
      <div className="px-5 py-6 flex items-center gap-3 border-b border-white/10">
        <img
          src="/barangay-seal.png"
          alt="Barangay Poblacion seal"
          className="h-10 w-10 rounded-full object-contain shrink-0 drop-shadow-sm"
        />
        <div className="min-w-0">
          <p className="font-semibold text-white leading-tight truncate">Barangay Poblacion</p>
          <p className="text-[11px] text-slate-400 tracking-wide">LOCAL GOVERNMENT UNIT</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        <p className="px-3 pb-2 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
          Menu
        </p>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={() => link.badgeKey && markSectionRead(link.badgeKey)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white font-medium shadow-sm shadow-blue-900/40'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <span aria-hidden className="text-base leading-none">
              {link.icon}
            </span>
            <span>{link.label}</span>
            {link.badgeKey && newCounts[link.badgeKey] > 0 && (
              <span className="ml-auto min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {newCounts[link.badgeKey] > 99 ? '99+' : newCounts[link.badgeKey]}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-3 pt-2 border-t border-white/10 space-y-1">
        <NavLink
          to="/residents/enroll"
          className="block text-center bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg px-3 py-2.5 transition-colors shadow-sm shadow-blue-900/40"
        >
          + Enroll Resident
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
              isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`
          }
        >
          <span aria-hidden>⚙️</span>
          <span>Settings</span>
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-white/5 hover:text-white"
        >
          <span aria-hidden>⎋</span>
          <span>Logout</span>
        </button>

        {admin && (
          <div className="flex items-center gap-2.5 px-3 pt-3 mt-1 border-t border-white/10">
            {admin.photoUrl ? (
              <img
                src={admin.photoUrl}
                alt={admin.fullName}
                className="h-7 w-7 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center text-[11px] font-semibold text-white shrink-0">
                {initials}
              </div>
            )}
            <p className="text-[11px] text-slate-400 truncate">{admin.fullName}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
