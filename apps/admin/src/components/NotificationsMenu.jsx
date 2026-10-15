import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import api from '../api';
import AdminIcon from './AdminIcons';

export default function NotificationsMenu() {
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = async () => {
    try {
      const { data } = await api.get('/dashboard/notifications');
      const seenIds = JSON.parse(localStorage.getItem('admin_seen_notifications') || '[]');
      const items = Array.isArray(data) ? data : [];
      const unread = items.filter((n) => !n.read && !seenIds.includes(n.id)).length;
      setUnreadCount(unread);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadUnreadCount();
    const intervalId = window.setInterval(loadUnreadCount, 12000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) =>
        `relative p-1.5 rounded-lg transition flex items-center justify-center ${
          isActive
            ? 'text-blue-600 bg-blue-50'
            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
        }`
      }
      aria-label="Notifications"
      title="View Notifications"
    >
      <AdminIcon name="bell" size={20} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-xs ring-2 ring-white">
          {unreadCount}
        </span>
      )}
    </NavLink>
  );
}

