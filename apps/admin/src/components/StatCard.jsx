import React from 'react';

export default function StatCard({ label, value, accent = 'blue', sub, children, onClick, className = '' }) {
  const accentStyles = {
    blue: { bar: 'bg-blue-500', chip: 'bg-blue-50 text-blue-600' },
    red: { bar: 'bg-red-500', chip: 'bg-red-50 text-red-600' },
    green: { bar: 'bg-green-500', chip: 'bg-green-50 text-green-600' },
    orange: { bar: 'bg-orange-500', chip: 'bg-orange-50 text-orange-600' },
  }[accent];

  const isClickable = typeof onClick === 'function';

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`relative bg-white rounded-xl shadow-sm border border-slate-100 p-5 overflow-hidden transition-all ${
        isClickable
          ? 'cursor-pointer hover:shadow-md hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 active:scale-[0.99] select-none'
          : 'hover:shadow-md'
      } ${className}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${accentStyles.bar}`} aria-hidden />
      <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1.5">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      {children}
    </div>
  );
}
