import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import NotificationsMenu from './NotificationsMenu.jsx';
import ProfileMenu from './ProfileMenu.jsx';
import AdminIcon from './AdminIcons.jsx';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="admin-header sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Open navigation menu"
            >
              <AdminIcon name="menu" size={20} />
            </button>
            <div>
              <p className="text-[11px] sm:text-xs font-semibold tracking-wide text-slate-400 uppercase leading-none">
                Barangay Poblacion
              </p>
              <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">Local Government Unit Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <NotificationsMenu />
            <div className="h-5 sm:h-6 w-px bg-slate-200" />
            <ProfileMenu />
          </div>
        </header>
        <main className="admin-main flex-1 px-4 sm:px-6 lg:px-8 py-5 sm:py-7 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
