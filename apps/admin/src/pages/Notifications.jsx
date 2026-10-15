import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import AdminIcon from '../components/AdminIcons';

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

function getNotificationTypeBadge(type) {
  switch (type) {
    case 'pending_resident':
      return {
        iconName: 'user-plus',
        bg: 'bg-emerald-100',
        textColor: 'text-emerald-700',
        borderColor: 'border-emerald-300',
        label: 'Resident Registration',
      };
    case 'pending_access':
      return {
        iconName: 'shield',
        bg: 'bg-amber-100',
        textColor: 'text-amber-700',
        borderColor: 'border-amber-300',
        label: 'Staff Access',
      };
    case 'case':
    case 'complaint':
      return {
        iconName: 'document',
        bg: 'bg-blue-100',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-300',
        label: 'Dispute / Case',
      };
    case 'mediation':
    case 'meeting':
      return {
        iconName: 'scale',
        bg: 'bg-purple-100',
        textColor: 'text-purple-700',
        borderColor: 'border-purple-300',
        label: 'Mediation Session',
      };
    default:
      return {
        iconName: 'bolt',
        bg: 'bg-slate-100',
        textColor: 'text-slate-700',
        borderColor: 'border-slate-300',
        label: 'Activity',
      };
  }
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' or 'unread'
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const navigate = useNavigate();

  const loadNotifications = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const { data } = await api.get('/dashboard/notifications');
      const seenIds = JSON.parse(localStorage.getItem('admin_seen_notifications') || '[]');
      // augment with local read tracking if needed
      const items = (Array.isArray(data) ? data : []).map((item) => ({
        ...item,
        read: Boolean(item.read || seenIds.includes(item.id)),
      }));
      setNotifications(items);
    } catch (err) {
      console.error('Failed to load admin notifications:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications(true);
    const interval = setInterval(() => loadNotifications(false), 12000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await api.post('/dashboard/notifications/mark-read', {});
      const allIds = notifications.map((n) => n.id);
      localStorage.setItem('admin_seen_notifications', JSON.stringify(allIds));
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
        await api.post('/dashboard/notifications/mark-read', { id: notif.id });
        const seenIds = JSON.parse(localStorage.getItem('admin_seen_notifications') || '[]');
        if (!seenIds.includes(notif.id)) {
          localStorage.setItem('admin_seen_notifications', JSON.stringify([...seenIds, notif.id]));
        }
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
    <div className="max-w-3xl mx-auto py-4">
      {/* Facebook-style Notifications Feed Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-blue-600 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-sm">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition"
              >
                {markingAll ? 'Marking...' : 'Mark all as read'}
              </button>
            )}
          </div>
        </div>

        {/* Facebook-style Pill Tabs (All / Unread) */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              filter === 'all'
                ? 'bg-blue-50 text-blue-600 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
              filter === 'unread'
                ? 'bg-blue-50 text-blue-600 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="bg-blue-600 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Notification Feed List */}
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs">Loading notifications...</p>
          </div>
        ) : displayedNotifications.length === 0 ? (
          <div className="py-20 text-center px-4">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <AdminIcon name="check-circle" size={26} />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {filter === 'unread'
                ? 'All resident complaints, staff access requests, and registrations have been reviewed.'
                : 'Incoming citizen complaints, household registrations, and Lupon schedules will appear here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayedNotifications.map((notif) => {
              const badge = getNotificationTypeBadge(notif.type);
              const isUnread = !notif.read;

              return (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`flex items-start gap-3.5 px-6 py-4 transition cursor-pointer group ${
                    isUnread ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  {/* Left: Avatar with Category Action Badge */}
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-slate-700 font-bold text-sm shadow-xs">
                      {notif.actorAvatar ? (
                        <img
                          src={notif.actorAvatar}
                          alt="Actor"
                          className="w-full h-full object-cover"
                        />
                      ) : notif.actorName ? (
                        notif.actorName.charAt(0).toUpperCase()
                      ) : (
                        <AdminIcon name="user" size={18} className="text-slate-400" />
                      )}
                    </div>

                    {/* Small action type badge bottom right */}
                    <div
                      className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${badge.bg} ${badge.borderColor} border flex items-center justify-center shadow-xs`}
                      title={badge.label}
                    >
                      <AdminIcon name={badge.iconName} size={10} className={badge.textColor} />
                    </div>
                  </div>

                  {/* Middle: Title, Detail & Time */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="text-xs leading-snug mb-1">
                      <span
                        className={`font-semibold group-hover:text-blue-600 transition ${
                          isUnread ? 'text-slate-900 font-bold' : 'text-slate-800'
                        }`}
                      >
                        {notif.title}
                      </span>
                    </div>

                    <p
                      className={`text-xs leading-relaxed mb-1.5 break-words ${
                        isUnread ? 'text-slate-700' : 'text-slate-500'
                      }`}
                    >
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                      <span className={isUnread ? 'text-blue-600 font-semibold' : ''}>
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                      {notif.actorName && (
                        <>
                          <span>•</span>
                          <span className="text-slate-500">{notif.actorName}</span>
                        </>
                      )}
                      {notif.caseId && (
                        <>
                          <span>•</span>
                          <span className="text-slate-500">Case #{notif.caseId}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Vibrant Blue Unread Dot */}
                  <div className="shrink-0 flex items-center justify-center self-center w-5 h-5">
                    {isUnread && (
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-blue-100"
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
    </div>
  );
}
