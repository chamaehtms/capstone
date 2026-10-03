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
    default:
      return null;
  }
}
