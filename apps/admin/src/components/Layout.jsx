import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import NotificationsMenu from './NotificationsMenu.jsx';
import ProfileMenu from './ProfileMenu.jsx';

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="admin-header sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Barangay Poblacion
            </p>
            <p className="text-sm text-slate-600">Local Government Unit Portal</p>
          </div>
          <div className="flex items-center gap-5">
            <NotificationsMenu />
            <div className="h-6 w-px bg-slate-200" />
            <ProfileMenu />
          </div>
        </header>
        <main className="admin-main flex-1 px-8 py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
