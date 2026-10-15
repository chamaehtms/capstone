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
      <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <img src="/barangay-seal.png" alt="Barangay Poblacion seal" className="brand-mark" />
        <span>Barangay Residents Portal</span>
        {user?.status === 'Pending' && (
          <span style={{
            fontSize: '0.68rem',
            background: '#fef3c7',
            color: '#92400e',
            border: '1px solid #fcd34d',
            padding: '2px 8px',
            borderRadius: 10,
            fontWeight: 700,
            whiteSpace: 'nowrap'
          }}>
            ⏳ Pending Verification
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
          style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '6px 8px' }}
        >
          <ModernIcon name="bell" size={20} />
          {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-item-label"><ModernIcon name="profile" size={20} />Profile</span>
        </NavLink>
      </div>
    </nav>
  );
}
