import React, { useState } from 'react';

const statusPillStyles = {
  Pending: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  'Under Review': 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  'In Progress': 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  Mediation: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
  Resolved: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
  Escalated: 'bg-rose-100 text-rose-700 hover:bg-rose-200',
  'Resolved/Escalated': 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
  Rejected: 'bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200',
};

export default function StatusDropdown({
  status,
  needsEscalation,
  disabled = false,
  onChange,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const isResolvedOrEscalated =
    status === 'Resolved/Escalated' ||
    status === 'Resolved / Escalated' ||
    status === 'Resolved' ||
    status === 'Escalated' ||
    status === 'Closed';

  let displayLabel = status || 'Pending';
  if (isResolvedOrEscalated) {
    displayLabel = needsEscalation || status === 'Escalated' ? 'Escalated' : 'Resolved';
  }

  const handleSelectStatus = (newStatus) => {
    setIsOpen(false);
    if (onChange) {
      onChange(newStatus, false);
    }
  };

  const handleSelectOutcome = (outcome) => {
    setIsOpen(false);
    if (onChange) {
      onChange('Resolved/Escalated', outcome === 'Escalated');
    }
  };

  return (
    <div className={`relative inline-block text-left ${isOpen ? 'z-50' : 'z-auto'}`}>
      {/* Clean Status Badge Pill Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`text-xs font-semibold px-3 py-1 rounded-full border-0 cursor-pointer inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 transition shadow-2xs ${
          statusPillStyles[displayLabel] || 'bg-slate-100 text-slate-700'
        }`}
      >
        <span>{displayLabel}</span>
        <svg
          className={`w-3 h-3 transition-transform duration-150 opacity-70 ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown Menu Options */}
      {isOpen && (
        <>
          {/* Click-outside backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute left-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 p-2.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            {/* Standard Stages */}
            <div className="space-y-0.5">
              {['Pending', 'Under Review', 'In Progress', 'Mediation'].map((opt) => {
                const isSelected = displayLabel === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSelectStatus(opt)}
                    className={`w-full text-left px-3 py-2 text-xs font-medium rounded-md transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'text-blue-600 bg-blue-50 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{opt}</span>
                    {isSelected && <span className="text-blue-600 font-bold">✓</span>}
                  </button>
                );
              })}
            </div>

            {/* Divider & RESOLVED / ESCALATED Section */}
            <div className="my-2 border-t border-slate-100" />

            <div className="px-1 pt-0.5 pb-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
                RESOLVED / ESCALATED
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectOutcome('Resolved')}
                  title="Mark as Amicably Resolved"
                  className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                    displayLabel === 'Resolved'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100'
                  }`}
                >
                  <span>✓</span>
                  <span>Resolved</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectOutcome('Escalated')}
                  title="Mark as Escalated for Formal Legal Action"
                  className={`py-2 px-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                    displayLabel === 'Escalated'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100'
                  }`}
                >
                  <span>↗</span>
                  <span>Escalated</span>
                </button>
              </div>
            </div>

            {/* Divider & REJECTED Section */}
            <div className="my-2 border-t border-slate-100" />

            <div className="px-1 pt-0.5 pb-1">
              <button
                type="button"
                onClick={() => handleSelectStatus('Rejected')}
                title="Mark case as Rejected"
                className={`w-full py-2 px-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  displayLabel === 'Rejected'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <span>✕</span>
                <span>{displayLabel === 'Rejected' ? 'Case Rejected' : 'Mark as Rejected'}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
