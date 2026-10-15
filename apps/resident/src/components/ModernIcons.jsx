import React from 'react';

export default function ModernIcon({ name, size = 18, color = 'currentColor', className = '' }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    'aria-hidden': true,
  };

  switch (name) {
    case 'home':
      return (
        <svg {...props}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20h14V9.5" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );
    case 'file':
      return (
        <svg {...props}>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-4Z" />
          <path d="M14 3v4h4" />
          <path d="M9 13h6M9 17h6" />
        </svg>
      );
    case 'track':
      return (
        <svg {...props}>
          <path d="M4 19V6.5A1.5 1.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v12" />
          <path d="M7 9h10M7 13h6M7 17h8" />
          <path d="M4 19h16" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...props}>
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20a8 8 0 0 1 16 0" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case 'key':
      return (
        <svg {...props}>
          <circle cx="8" cy="15" r="4" />
          <path d="m11 12 8-8 2 2-2 2 2 2-3 3-2-2-2 2" />
        </svg>
      );
    case 'megaphone':
      return (
        <svg {...props}>
          <path d="M3 11v2l11 3V8l-11 3Z" />
          <path d="M14 9.5V14.5l5 2V7.5l-5 2Z" />
          <path d="M7 17v2a1 1 0 0 0 1 1h1" />
        </svg>
      );
    case 'tool':
      return (
        <svg {...props}>
          <path d="M14 4a3 3 0 0 1 3 3v1.2a2 2 0 0 1 0 4V12a3 3 0 0 1-4.8 2.4L7 17.5V14l4-4V8.2a2 2 0 0 1 0-4V3a3 3 0 0 1 3-3h0Z" />
          <path d="M7 17.5 4 20" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...props}>
          <path d="M12 3 19 6v6c0 4.4-3 8.2-7 9-4-1-7-4.6-7-9V6l7-3Z" />
          <path d="m9.5 12 1.6 1.6 3.4-4" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...props}>
          <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2h1.9a1.5 1.5 0 0 1 1.5 1.3l.3 2.3a1.5 1.5 0 0 1-1.1 1.7l-1.5.4a12 12 0 0 0 7.3 7.3l.4-1.5a1.5 1.5 0 0 1 1.7-1.1l2.3.3A1.5 1.5 0 0 1 22 10.6v1.9A2.5 2.5 0 0 1 19.5 15H18a12 12 0 0 1-12-12V4.5Z" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...props}>
          <path d="M4 18V6M10 18V10M16 18V4M22 18V8" />
          <path d="M2 18h20" />
        </svg>
      );
    case 'map-pin':
      return (
        <svg {...props}>
          <path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
      );
    case 'spark':
      return (
        <svg {...props}>
          <path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" />
        </svg>
      );
    case 'check':
      return (
        <svg {...props}>
          <path d="M5 12.5 9.5 17 19 7.5" />
        </svg>
      );
    case 'eye':
      return (
        <svg {...props}>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'eye-off':
      return (
        <svg {...props}>
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      );
    case 'id-card':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="2" />
          <path d="M15 8h2M15 12h2M7 16h10" />
        </svg>
      );
    case 'selfie':
      return (
        <svg {...props}>
          <rect x="5" y="2" width="14" height="20" rx="3" />
          <circle cx="12" cy="10" r="3" />
          <path d="M7.5 18a4.5 4.5 0 0 1 9 0" />
          <circle cx="12" cy="5" r="0.8" fill="currentColor" />
        </svg>
      );
    case 'document':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...props}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'check-circle':
      return (
        <svg {...props}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'lock':
      return (
        <svg {...props}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case 'copy':
      return (
        <svg {...props}>
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case 'scale':
      return (
        <svg {...props}>
          <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
          <path d="M7 21h10" />
          <path d="M12 3v18" />
          <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
        </svg>
      );
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'camera':
      return (
        <svg {...props}>
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...props}>
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
        </svg>
      );
    default:
      return null;
  }
}
