import React from 'react';

/**
 * Formats a date/timestamp to match "Sep 29, 2026 | 10:24 AM"
 */
function formatTimelineDate(dateValue, defaultTime) {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return null;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();

  const isDateOnly = typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim());

  let timeFormatted = '';
  if (!isDateOnly) {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    timeFormatted = `${hours}:${minutes} ${ampm}`;
  } else {
    timeFormatted = defaultTime || '10:00 AM';
  }

  return `${month} ${day}, ${year} | ${timeFormatted}`;
}

export default function InfrastructureTimeline({ c }) {
  if (!c) return null;

  const status = String(c.status || '').trim();
  const normStatus = status.toLowerCase();

  // Determine numerical stage (1 to 5)
  let currentStage = 1;
  if (normStatus === 'closed') {
    currentStage = 5;
  } else if (normStatus === 'resolved') {
    currentStage = 4;
  } else if (normStatus === 'in progress' || normStatus === 'in_progress') {
    currentStage = 3;
  } else if (normStatus === 'under review' || normStatus === 'under_review') {
    currentStage = 2;
  } else {
    // 'Pending', 'Submitted', etc.
    currentStage = 1;
  }

  // 1. Submitted timestamp
  const submittedDateStr = formatTimelineDate(c.submittedAt || c.filingDate || c.createdAt, '10:24 AM') || 'Sep 29, 2026 | 10:24 AM';

  // 2. Under Review timestamp
  let underReviewDateStr = null;
  if (currentStage >= 2) {
    if (c.underReviewAt) {
      underReviewDateStr = formatTimelineDate(c.underReviewAt);
    } else {
      // Derive clean fallback from submitted date + 36 mins
      const baseD = c.createdAt || c.submittedAt ? new Date(c.createdAt || c.submittedAt) : new Date();
      const reviewD = new Date(baseD.getTime() + 36 * 60 * 1000);
      underReviewDateStr = formatTimelineDate(reviewD, '11:00 AM');
    }
  }

  // 3. In Progress timestamp & subtitle
  let inProgressSubtitle = 'Pending';
  if (currentStage >= 3) {
    const assignedTeamName = c.assignedTeam || 'Maintenance Team';
    let pDateStr = '';
    if (c.inProgressAt) {
      pDateStr = formatTimelineDate(c.inProgressAt)?.split('|')[0]?.trim() || '';
    }
    if (!pDateStr) {
      const baseD = c.createdAt ? new Date(c.createdAt) : new Date();
      const nextDay = new Date(baseD.getTime() + 24 * 60 * 60 * 1000);
      pDateStr = formatTimelineDate(nextDay)?.split('|')[0]?.trim() || 'Sep 30, 2026';
    }
    inProgressSubtitle = `${pDateStr} | Assigned to ${assignedTeamName}`;
  }

  // 4. Resolved timestamp & subtitle
  let resolvedSubtitle = 'Pending';
  if (currentStage >= 4) {
    const rDate = c.resolvedAt ? formatTimelineDate(c.resolvedAt) : formatTimelineDate(c.updatedAt || new Date());
    resolvedSubtitle = `${rDate} | Inspection Verified & Completed`;
  }

  // 5. Closed timestamp & subtitle
  let closedSubtitle = 'Pending';
  if (currentStage >= 5) {
    const clDate = c.closedAt ? formatTimelineDate(c.closedAt) : formatTimelineDate(c.updatedAt || new Date());
    closedSubtitle = `${clDate} | Official Report Closed`;
  }

  const steps = [
    {
      id: 'submitted',
      stepNum: 1,
      label: 'Submitted',
      subtitle: submittedDateStr,
      isCompleted: currentStage >= 1,
      isActive: currentStage === 1,
      color: '#10b981',
      titleColor: '#10b981',
      lineColorToNext: currentStage >= 2 ? '#10b981' : '#cbd5e1',
      renderIcon: () => (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            flexShrink: 0,
            zIndex: 1,
            boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      ),
    },
    {
      id: 'under_review',
      stepNum: 2,
      label: 'Under Review',
      subtitle: currentStage >= 2 ? underReviewDateStr : 'Pending',
      isCompleted: currentStage >= 2,
      isActive: currentStage === 2,
      color: '#2563eb',
      titleColor: currentStage >= 2 ? '#2563eb' : '#475569',
      lineColorToNext: currentStage >= 3 ? '#2563eb' : '#cbd5e1',
      renderIcon: () => {
        if (currentStage >= 2) {
          return (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
                zIndex: 1,
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          );
        }
        return (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '2px solid #cbd5e1',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              zIndex: 1,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8' }} />
          </div>
        );
      },
    },
    {
      id: 'in_progress',
      stepNum: 3,
      label: 'In Progress',
      subtitle: inProgressSubtitle,
      isCompleted: currentStage >= 4,
      isActive: currentStage === 3,
      color: '#f59e0b',
      titleColor: currentStage >= 3 ? '#d97706' : '#475569',
      lineColorToNext: currentStage >= 4 ? '#10b981' : '#cbd5e1',
      renderIcon: () => {
        if (currentStage === 3) {
          return (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
                zIndex: 1,
                fontWeight: 800,
                fontSize: 16,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                boxShadow: '0 2px 4px rgba(245, 158, 11, 0.25)',
              }}
            >
              !
            </div>
          );
        }
        if (currentStage >= 4) {
          return (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
                zIndex: 1,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          );
        }
        return (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '2px solid #cbd5e1',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              zIndex: 1,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8' }} />
          </div>
        );
      },
    },
    {
      id: 'resolved',
      stepNum: 4,
      label: 'Resolved',
      subtitle: resolvedSubtitle,
      isCompleted: currentStage >= 4,
      isActive: currentStage === 4,
      color: '#10b981',
      titleColor: currentStage >= 4 ? '#10b981' : '#475569',
      lineColorToNext: currentStage >= 5 ? '#10b981' : '#cbd5e1',
      renderIcon: () => {
        if (currentStage >= 4) {
          return (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
                zIndex: 1,
                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          );
        }
        return (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '2px solid #cbd5e1',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              zIndex: 1,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8' }} />
          </div>
        );
      },
    },
    {
      id: 'closed',
      stepNum: 5,
      label: 'Closed',
      subtitle: closedSubtitle,
      isCompleted: currentStage >= 5,
      isActive: currentStage === 5,
      color: '#10b981',
      titleColor: currentStage >= 5 ? '#10b981' : '#475569',
      lineColorToNext: null,
      renderIcon: () => {
        if (currentStage >= 5) {
          return (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
                zIndex: 1,
                boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          );
        }
        return (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '2px solid #cbd5e1',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              zIndex: 1,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8' }} />
          </div>
        );
      },
    },
  ];

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '22px 24px',
        marginTop: 18,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <path
            d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z"
            fill="#1e293b"
          />
          <path d="M14 2V8H20" fill="#334155" />
          <line x1="8" y1="12" x2="16" y2="12" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="8" y1="15.5" x2="16" y2="15.5" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="8" y1="19" x2="13" y2="19" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <h3
          style={{
            margin: 0,
            fontSize: '1.08rem',
            fontWeight: 800,
            color: '#1e293b',
            letterSpacing: '-0.01em',
          }}
        >
          Progress Timeline
        </h3>
      </div>

      {/* Timeline Steps */}
      <div style={{ paddingLeft: 4 }}>
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const isPending = step.subtitle === 'Pending';

          return (
            <div
              key={step.id}
              style={{
                display: 'flex',
                gap: 16,
                position: 'relative',
                paddingBottom: isLast ? 0 : 26,
              }}
            >
              {/* Connecting line */}
              {!isLast && (
                <div
                  style={{
                    position: 'absolute',
                    left: 13,
                    top: 28,
                    bottom: 0,
                    width: 2,
                    background: step.lineColorToNext,
                    transition: 'background 0.3s ease',
                  }}
                />
              )}

              {/* Icon Circle */}
              {step.renderIcon()}

              {/* Text Information */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 28 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '0.96rem',
                    color: step.titleColor,
                    lineHeight: 1.25,
                  }}
                >
                  {step.label}
                </div>
                <div
                  style={{
                    fontSize: '0.84rem',
                    color: isPending ? '#94a3b8' : '#64748b',
                    marginTop: 3,
                    fontWeight: isPending ? 500 : 400,
                  }}
                >
                  {step.subtitle}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
