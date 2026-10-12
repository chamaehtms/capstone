import React, { useState } from 'react';

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

  const isEscalated = isResolvedOrEscalated ? !!needsEscalation || status === 'Escalated' : false;
  const isResolved = isResolvedOrEscalated && !isEscalated;

  let displayLabel = status || 'Pending';
  if (isResolvedOrEscalated) {
    displayLabel = isEscalated ? 'Escalated' : 'Resolved';
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
    <div className="relative inline-block text-left">
      {/* Trigger Button - Matches visual mockup in media_1791776197600.png */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-44 bg-white border border-[#c4d1df] rounded-lg px-3.5 py-2 text-sm text-[#1e293b] font-normal flex items-center justify-between shadow-2xs hover:border-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-60 transition"
      >
        <span className="truncate">{displayLabel}</span>
        <svg
          className={`w-4 h-4 text-[#1e293b] transition-transform duration-150 shrink-0 ml-1.5 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Options Popup */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute left-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-[#dce5f0] p-2.5 z-40 animate-in fade-in zoom-in-95 duration-100">
            <div className="space-y-0.5">
              {['Pending', 'Under Review', 'In Progress', 'Mediation'].map((opt) => {
                const isSelected = !isResolvedOrEscalated && status === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSelectStatus(opt)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'text-[#1d6bf3] bg-[#edf4ff] font-medium'
                        : 'text-[#1e293b] hover:bg-slate-50'
                    }`}
                  >
                    <span>{opt}</span>
                    {isSelected && <span className="text-[#1d6bf3] font-bold text-xs">✓</span>}
                  </button>
                );
              })}
            </div>

            {/* Bottom 2 Option Buttons: Resolved and Escalated */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleSelectOutcome('Resolved')}
                title="Mark as Amicably Resolved"
                className={`py-2 px-3 rounded-lg text-sm font-medium transition text-center cursor-pointer ${
                  isResolved
                    ? 'bg-[#1d6bf3] text-white shadow-xs font-semibold'
                    : 'bg-[#edf4ff] text-[#1d6bf3] hover:bg-[#dbeafe]'
                }`}
              >
                Resolved
              </button>

              <button
                type="button"
                onClick={() => handleSelectOutcome('Escalated')}
                title="Mark as Escalated for Formal Legal Action"
                className={`py-2 px-3 rounded-lg text-sm font-medium transition text-center cursor-pointer ${
                  isEscalated
                    ? 'bg-[#1d6bf3] text-white shadow-xs font-semibold'
                    : 'bg-[#edf4ff] text-[#1d6bf3] hover:bg-[#dbeafe]'
                }`}
              >
                Escalated
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
