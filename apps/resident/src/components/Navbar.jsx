import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import ModernIcon from './ModernIcons.jsx';
import { getAnnouncements, getMyEscalations, getMyMediations, getMyNotifications, Session } from '../api.js';

export default function Navbar() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastKnownIdsRef = useRef(new Set());
  const initialized = useRef(false);
  const user = Session.getUser();
  const isVerified = user?.status === 'Verified';

  useEffect(() => {
    let active = true;

    const loadNotifications = async () => {
      try {
        const dbNotifs = await getMyNotifications().catch(() => []);
        if (!active) return;

        const seenIds = JSON.parse(localStorage.getItem('bp_seen_notifications') || '[]');
        const unread = (Array.isArray(dbNotifs) ? dbNotifs : []).filter(
          (n) => !n.read && !seenIds.includes(`db-${n.id}`) && !seenIds.includes(n.id)
        ).length;

        setUnreadCount(unread);
        initialized.current = true;
      } catch {
        // Notifications are supplemental; the rest of the navbar remains usable.
      }
    };

    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 30000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [isVerified]);

  return (
    <nav className="navbar">
      <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <img src="/barangay-seal.png" alt="Barangay Poblacion seal" className="brand-mark" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>Barangay Poblacion</span>
          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--navy)', lineHeight: 1.2 }}>Resident Portal</span>
        </div>
        {user?.status === 'Pending' && (
          <span className="notice-badge notice-badge-amber" style={{ marginLeft: 6, fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ModernIcon name="clock" size={12} color="var(--amber-text)" /> Pending Verification
          </span>
        )}
      </div>
      <div className="nav-links">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-item-label"><ModernIcon name="home" size={20} />Home</span>
        </NavLink>
        {isVerified ? (
          <NavLink to="/services" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-item-label"><ModernIcon name="tool" size={20} />Services</span>
          </NavLink>
        ) : (
          <NavLink to="/file-complaint" className={({ isActive }) => isActive ? 'active' : ''}>
            <span className="nav-item-label"><ModernIcon name="megaphone" size={20} />File Complaint</span>
          </NavLink>
        )}
        <NavLink to="/track" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-item-label"><ModernIcon name="chart" size={20} />Track</span>
        </NavLink>
        <NavLink
          to="/notifications"
          className={({ isActive }) => (isActive ? 'active notification-link' : 'notification-link')}
          aria-label="Notifications"
          title="Notifications"
          style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
        >
          <span className="nav-item-label" style={{ position: 'relative' }}>
            <ModernIcon name="bell" size={20} />
            <span>Notifications</span>
            {unreadCount > 0 && <span className="notification-count" style={{ top: '-6px', right: '-10px' }}>{unreadCount}</span>}
          </span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-item-label"><ModernIcon name="profile" size={20} />Profile</span>
        </NavLink>
      </div>
    </nav>
  );
}
