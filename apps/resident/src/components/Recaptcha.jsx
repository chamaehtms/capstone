import React, { useState, useImperativeHandle, forwardRef, useEffect, useRef } from 'react';

const Recaptcha = forwardRef(function Recaptcha(
  { onVerify, onExpire, onError },
  ref
) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'checking' | 'verified'
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    reset: () => {
      setStatus('idle');
      onExpire?.();
    },
  }));

  const handleCheckboxClick = () => {
    if (status !== 'idle') return;

    setStatus('checking');

    // Simulate verification check (matching reCAPTCHA check timing)
    setTimeout(() => {
      if (!isMountedRef.current) return;
      setStatus('verified');
      const token = `recaptcha-verified-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      onVerify?.(token);
    }, 600);
  };

  return (
    <div
      style={{
        margin: '16px auto',
        width: '100%',
        maxWidth: 302,
        height: 76,
        background: '#f9f9f9',
        border: '1px solid #d3d3d3',
        borderRadius: 3,
        boxShadow: '0 0 4px 1px rgba(0, 0, 0, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        boxSizing: 'border-box',
        userSelect: 'none',
        fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      }}
    >
      {/* Left: Checkbox & Label */}
      <div
        onClick={handleCheckboxClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: status === 'idle' ? 'pointer' : 'default',
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {status === 'idle' && (
            <div
              style={{
                width: 24,
                height: 24,
                background: '#ffffff',
                border: '2px solid #c1c1c1',
                borderRadius: 2,
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#b2b2b2')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#c1c1c1')}
            />
          )}

          {status === 'checking' && (
            <div
              style={{
                width: 22,
                height: 22,
                border: '3px solid #e0e0e0',
                borderTopColor: '#4285f4',
                borderRadius: '50%',
                animation: 'recaptcha-spin 0.7s linear infinite',
              }}
            />
          )}

          {status === 'verified' && (
            <svg
              viewBox="0 0 24 24"
              width="28"
              height="28"
              style={{ display: 'block' }}
            >
              <path
                d="M4.5 12.75l6 6 9-13.5"
                fill="none"
                stroke="#0f9d58"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: '#282727',
            letterSpacing: '0.01em',
          }}
        >
          I'm not a robot
        </span>
      </div>

      {/* Right: reCAPTCHA Brand Logo & Legal */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        {/* Official Google reCAPTCHA Symbol */}
        <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
          <path
            d="M24 4C12.95 4 4 12.95 4 24c0 4.14 1.27 7.99 3.44 11.19L11.5 32.1C10.05 29.71 9.2 26.94 9.2 24c0-8.17 6.63-14.8 14.8-14.8V4z"
            fill="#1A73E8"
          />
          <path
            d="M24 44c11.05 0 20-8.95 20-20 0-4.14-1.27-7.99-3.44-11.19L36.5 15.9c1.45 2.39 2.3 5.16 2.3 8.1 0 8.17-6.63 14.8-14.8 14.8V44z"
            fill="#4285F4"
          />
          <path
            d="M44 24c0 11.05-8.95 20-20 20v-5.2c8.17 0 14.8-6.63 14.8-14.8h5.2z"
            fill="#AECBFA"
          />
          <path
            d="M4 24C4 12.95 12.95 4 24 4v5.2C15.83 9.2 9.2 15.83 9.2 24H4z"
            fill="#1A73E8"
          />
          <circle cx="24" cy="24" r="5" fill="#4285F4" />
        </svg>

        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: '#555555',
            lineHeight: 1,
            letterSpacing: '0.01em',
          }}
        >
          reCAPTCHA
        </span>

        <div style={{ display: 'flex', gap: 3, fontSize: 8, color: '#555555', lineHeight: 1 }}>
          <a
            href="https://www.google.com/intl/en/policies/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#555555', textDecoration: 'none' }}
          >
            Privacy
          </a>
          <span>·</span>
          <a
            href="https://www.google.com/intl/en/policies/terms/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#555555', textDecoration: 'none' }}
          >
            Terms
          </a>
        </div>
      </div>

      <style>{`
        @keyframes recaptcha-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});

export default Recaptcha;
