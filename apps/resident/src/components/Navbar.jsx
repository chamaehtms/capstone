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
        const [announcements, escalations, mediations, dbNotifs] = await Promise.all([
          isVerified ? getAnnouncements().catch(() => []) : Promise.resolve([]),
          getMyEscalations().catch(() => []),
          getMyMediations().catch(() => []),
          getMyNotifications().catch(() => []),
        ]);
        if (!active) return;

        const seenIds = JSON.parse(localStorage.getItem('bp_seen_notifications') || '[]');

        // Convert announcements into notification objects only for verified residents
        const announcementNotifications = isVerified
          ? announcements.map((announcement) => ({
              id: `announcement-${announcement.id}`,
              title: '📢 Community Announcement',
              message: announcement.title,
              type: 'announcement',
              link: '/services',
              unread: !seenIds.includes(`announcement-${announcement.id}`),
            }))
          : [];

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
          style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
        >
          <span className="nav-item-label">
            <ModernIcon name="bell" size={20} />
            Notifications
          </span>
          {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-item-label"><ModernIcon name="profile" size={20} />Profile</span>
        </NavLink>
      </div>
    </nav>
  );
}
