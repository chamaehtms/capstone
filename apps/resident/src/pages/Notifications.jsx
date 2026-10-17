import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import ModernIcon from '../components/ModernIcons.jsx';
import { getMyNotifications, markNotificationsRead } from '../api.js';

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
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function getNotificationBadge(type) {
  switch (type) {
    case 'mediation':
    case 'hearing':
      return { icon: 'scale', iconColor: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', label: 'Mediation' };
    case 'case':
    case 'complaint':
      return { icon: 'file', iconColor: '#b45309', bg: '#fef3c7', border: '#fde68a', label: 'Case Update' };
    case 'escalation':
      return { icon: 'file', iconColor: '#be185d', bg: '#fce7f3', border: '#fbcfe8', label: 'Certificate' };
    case 'announcement':
      return { icon: 'megaphone', iconColor: '#047857', bg: '#ecfdf5', border: '#a7f3d0', label: 'Announcement' };
    default:
      return { icon: 'bell', iconColor: '#334155', bg: '#f1f5f9', border: '#cbd5e1', label: 'Notice' };
  }
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' or 'unread'
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function fetchNotifications() {
      try {
        const data = await getMyNotifications();
        if (active) {
          setNotifications(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 12000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await markNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleItemClick = async (notif) => {
    if (!notif.read) {
      try {
        await markNotificationsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
        );
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }

    if (notif.link) {
      navigate(notif.link);
    }
  };

  const displayedNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  return (
    <>
      <Navbar />
      <main className="page" style={{ paddingTop: '28px', maxWidth: '780px' }}>
        {/* Facebook-style Card Container */}
        <div
          className="notification-card-container"
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            className="notification-header-wrap"
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: '1.45rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                }}
              >
                Notifications
              </h1>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  {markingAll ? 'Marking...' : 'Mark all as read'}
                </button>
              )}
            </div>
          </div>

          {/* Facebook-style All / Unread Filter Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              padding: '12px 24px',
              borderBottom: '1px solid #f8fafc',
              background: '#ffffff',
            }}
          >
            <button
              type="button"
              onClick={() => setFilter('all')}
              style={{
                border: 'none',
                borderRadius: '999px',
                padding: '8px 16px',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: filter === 'all' ? '#e0f2fe' : '#f1f5f9',
                color: filter === 'all' ? '#0284c7' : '#64748b',
                transition: 'all 0.15s ease',
              }}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              style={{
                border: 'none',
                borderRadius: '999px',
                padding: '8px 16px',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: filter === 'unread' ? '#e0f2fe' : '#f1f5f9',
                color: filter === 'unread' ? '#0284c7' : '#64748b',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    borderRadius: '999px',
                    fontSize: '0.72rem',
                    padding: '1px 6px',
                    fontWeight: 800,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Notifications Feed */}
          {loading ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid #e2e8f0',
                  borderTopColor: '#2563eb',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 12px',
                }}
              />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Loading notifications...</p>
            </div>
          ) : displayedNotifications.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center', color: '#64748b' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#94a3b8',
                }}
              >
                <ModernIcon name="inbox" size={30} color="#94a3b8" />
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#1e293b' }}>
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8' }}>
                {filter === 'unread'
                  ? 'You are all caught up on your barangay updates and hearing notices.'
                  : 'Hearing notices, complaint tracking, and announcements will appear here.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {displayedNotifications.map((notif) => {
                const badge = getNotificationBadge(notif.type);
                const isUnread = !notif.read;

                return (
                  <div
                    key={notif.id}
                    className="notification-item-row"
                    onClick={() => handleItemClick(notif)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '14px',
                      padding: '16px 24px',
                      borderBottom: '1px solid #f1f5f9',
                      background: isUnread ? '#f8faff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isUnread ? '#f0f5ff' : '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isUnread ? '#f8faff' : '#ffffff';
                    }}
                  >
                    {/* Left: Avatar with type icon badge */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          background: '#e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: '#475569',
                          overflow: 'hidden',
                          border: '2px solid #ffffff',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                        }}
                      >
                        {notif.actorAvatar ? (
                          <img
                            src={notif.actorAvatar}
                            alt="Actor"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : notif.actorName ? (
                          notif.actorName.charAt(0).toUpperCase()
                        ) : (
                          <ModernIcon name="building" size={20} color="#64748b" />
                        )}
                      </div>

                      {/* Small Bottom-Right Action Type Badge */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '-2px',
                          right: '-2px',
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: badge.bg,
                          border: `1.5px solid ${badge.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        }}
                        title={badge.label}
                      >
                        <ModernIcon name={badge.icon} size={12} color={badge.iconColor} />
                      </div>
                    </div>

                    {/* Middle: Content */}
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                      <div
                        style={{
                          fontSize: '0.92rem',
                          color: '#0f172a',
                          lineHeight: 1.4,
                          marginBottom: '4px',
                        }}
                      >
                        <strong
                          style={{
                            fontWeight: isUnread ? 800 : 600,
                            color: isUnread ? '#0f172a' : '#334155',
                          }}
                        >
                          {notif.title}
                        </strong>
                      </div>

                      <p
                        style={{
                          margin: '0 0 6px',
                          fontSize: '0.85rem',
                          color: isUnread ? '#334155' : '#64748b',
                          lineHeight: 1.45,
                          wordBreak: 'break-word',
                        }}
                      >
                        {notif.message}
                      </p>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.78rem',
                          color: isUnread ? '#2563eb' : '#94a3b8',
                          fontWeight: isUnread ? 600 : 500,
                        }}
                      >
                        <span>{formatRelativeTime(notif.createdAt)}</span>
                        {notif.caseId && (
                          <>
                            <span>•</span>
                            <span style={{ color: '#64748b' }}>Case #{notif.caseId}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right: Blue Unread Indicator Dot */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        alignSelf: 'center',
                        flexShrink: 0,
                        width: '18px',
                        height: '18px',
                      }}
                    >
                      {isUnread && (
                        <div
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: '#2563eb',
                            boxShadow: '0 0 0 2px #dbeafe',
                          }}
                          title="Unread"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
