import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const goToSettings = () => {
    setOpen(false);
    navigate('/settings');
  };

  const initials = admin?.fullName ? admin.fullName.slice(0, 2).toUpperCase() : 'AD';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="h-9 w-9 rounded-full overflow-hidden bg-blue-600 text-white flex items-center justify-center text-sm font-semibold shrink-0"
        aria-label="Account menu"
      >
        {admin?.photoUrl ? (
          <img src={admin.photoUrl} alt={admin.fullName} className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-64 bg-white rounded-xl shadow-lg border border-slate-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
            {admin?.photoUrl ? (
              <img
                src={admin.photoUrl}
                alt={admin.fullName}
                className="h-10 w-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-sm text-slate-800 truncate">{admin?.fullName || 'Administrator'}</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{admin?.institutionalId}</p>
              {admin?.department && <p className="text-xs text-slate-400 mt-0.5 truncate">{admin.department}</p>}
            </div>
          </div>

          <button
            onClick={goToSettings}
            className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            ⚙️ Settings
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
          >
            ⎋ Logout
          </button>
        </div>
      )}
    </div>
  );
}
