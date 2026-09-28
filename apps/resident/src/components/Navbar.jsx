import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getAnnouncements, getMyEscalations, getMyMediations, getMyNotifications, markNotificationsRead } from '../api.js';

export default function Navbar() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [newNotification, setNewNotification] = useState(null);
  const lastKnownIdsRef = useRef(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    let active = true;

    const loadNotifications = async () => {
      try {
        const [announcements, escalations, mediations, dbNotifs] = await Promise.all([
          getAnnouncements(),
          getMyEscalations(),
          getMyMediations(),
          getMyNotifications(),
        ]);
        if (!active) return;

        const seenIds = JSON.parse(localStorage.getItem('bp_seen_notifications') || '[]');

        // Convert announcements into notification objects
        const announcementNotifications = announcements.map((announcement) => ({
          id: `announcement-${announcement.id}`,
          title: '📢 Community Announcement',
          message: announcement.title,
          type: 'announcement',
          link: '/services',
          unread: !seenIds.includes(`announcement-${announcement.id}`),
        }));

        // Convert escalations
        const escalationNotifications = escalations.map((escalation) => ({
          id: `escalation-${escalation.id}`,
          title: '⚖️ Case Escalated for Review',
          message: `${escalation.caseRef || escalation.complaintId} has been escalated for review.`,
          type: 'escalation',
          link: '/services',
          unread: !seenIds.includes(`escalation-${escalation.id}`),
        }));

        // Convert primary mediations
        const mediationNotifications = mediations.map((m) => ({
          id: `mediation-${m.id}`,
          title: `⚖️ Mediation Hearing: ${m.hearingStage || 'Lupon Session'}`,
          message: `Notice of hearing for ${m.caseId}: ${m.date} at ${m.time || '10:00 AM'} (${m.location || 'Barangay Hall'}).`,
          type: 'mediation',
          link: `/track?ref=${encodeURIComponent(m.caseId)}`,
          unread: !seenIds.includes(`mediation-${m.id}`),
        }));

        // Convert next session / follow-up mediation hearings (Section 7)
        const nextSessionNotifications = mediations
          .filter((m) => m.nextMeetingDate && String(m.nextMeetingDate).trim())
          .map((m) => ({
            id: `mediation-next-${m.id}-${m.nextMeetingDate}`,
            title: '🗓️ Next Mediation Hearing Scheduled',
            message: `Follow-up session for ${m.caseId}: ${m.nextMeetingDate} at ${m.nextMeetingTime || '10:00 AM'} (${m.nextMeetingVenue || 'Barangay Poblacion Mediation Hall'}).`,
            type: 'next_hearing',
            link: `/track?ref=${encodeURIComponent(m.caseId)}`,
            unread: !seenIds.includes(`mediation-next-${m.id}-${m.nextMeetingDate}`),
          }));

        // Convert persistent db notifications
        const persistentNotifications = dbNotifs.map((n) => ({
          id: `db-${n.id}`,
          title: n.title,
          message: n.message,
          type: n.type,
          link: n.link || '/track',
          unread: !n.read && !seenIds.includes(`db-${n.id}`),
        }));

        // Deduplicate all by id
        const map = new Map();
        [
          ...persistentNotifications,
          ...nextSessionNotifications,
          ...mediationNotifications,
          ...announcementNotifications,
          ...escalationNotifications,
        ].forEach((item) => {
          if (!map.has(item.id)) map.set(item.id, item);
        });

        const allNotifications = Array.from(map.values());
        const unread = allNotifications.filter((n) => n.unread).length;

        // Check if any brand new notification arrived after initial load
        if (initialized.current) {
          const fresh = allNotifications.find((n) => !lastKnownIdsRef.current.has(n.id));
          if (fresh) {
            setNewNotification(fresh);
          }
        }

        allNotifications.forEach((n) => lastKnownIdsRef.current.add(n.id));
        setNotifications(allNotifications);
        setUnreadCount(unread);
        initialized.current = true;
      } catch {
        // Notifications are supplemental; the rest of the navbar remains usable.
      }
    };

    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 10000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  async function openNotifications() {
    setShowNotifications((isOpen) => !isOpen);
    setNewNotification(null);

    // Mark all as read locally and in the database
    const allIds = notifications.map((n) => n.id);
    localStorage.setItem('bp_seen_notifications', JSON.stringify(allIds));
    setNotifications((curr) => curr.map((n) => ({ ...n, unread: false })));
    setUnreadCount(0);

    try {
      await markNotificationsRead();
    } catch {
      // not fatal
    }
  }

  return (
    <nav className="navbar">
      <div className="brand">
        <img src="/barangay-seal.png" alt="Barangay Poblacion seal" className="brand-mark" />
        <span>Barangay Residents Portal</span>
      </div>
      <div className="nav-links">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>🏠 Home</NavLink>
        <NavLink to="/services" className={({ isActive }) => isActive ? 'active' : ''}>⚏ Services</NavLink>
        <NavLink to="/track" className={({ isActive }) => isActive ? 'active' : ''}>📈 Track</NavLink>
        <div className="notification-wrap">
          <button type="button" className="notification-button" onClick={openNotifications} aria-label="Open notifications">
            🔔
            {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
          </button>
          {showNotifications && (
            <div className="notification-menu">
              <div className="notification-menu-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Notifications</span>
                {notifications.length > 0 && (
                  <span style={{ fontSize: '0.72rem', color: '#6366f1', cursor: 'pointer', fontWeight: 600 }} onClick={openNotifications}>
                    Mark all read
                  </span>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="notification-empty">No notifications recorded.</div>
              ) : (
                notifications.map((notification) => (
                  <NavLink
                    to={notification.link || '/services'}
                    className={`notification-item ${notification.unread ? 'unread' : ''}`}
                    key={notification.id}
                    onClick={() => setShowNotifications(false)}
                    style={notification.unread ? { background: '#f5f3ff', borderLeft: '3px solid #7c3aed' } : {}}
                  >
                    <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {notification.unread && (
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }} />
                      )}
                      {notification.title}
                    </strong>
                    <span>{notification.message}</span>
                  </NavLink>
                ))
              )}
            </div>
          )}
        </div>
        <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>◎ Profile</NavLink>
      </div>
      {newNotification && (
        <div className="announcement-toast" role="status">
          <strong>{newNotification.title}</strong>
          <span>{newNotification.message}</span>
          <button type="button" onClick={() => setNewNotification(null)} aria-label="Dismiss notification">✕</button>
        </div>
      )}
    </nav>
  );
}
