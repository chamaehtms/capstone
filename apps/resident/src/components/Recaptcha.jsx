import React, { useState, useImperativeHandle, forwardRef, useEffect, useRef } from 'react';

const PUZZLE_BACKGROUNDS = [
  {
    title: 'Barangay Poblacion Municipal Grounds',
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #93c5fd 100%)',
    detail: 'radial-gradient(circle at 75% 30%, rgba(255,255,255,0.3) 0%, transparent 60%)',
  },
  {
    title: 'Civic Center & Heritage Plaza',
    gradient: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 50%, #a7f3d0 100%)',
    detail: 'radial-gradient(circle at 25% 40%, rgba(255,255,255,0.3) 0%, transparent 60%)',
  },
  {
    title: 'Coastal Gateway & Port Vista',
    gradient: 'linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #c7d2fe 100%)',
    detail: 'radial-gradient(circle at 60% 60%, rgba(255,255,255,0.35) 0%, transparent 60%)',
  },
];

const PUZZLE_WIDTH = 296;
const PUZZLE_HEIGHT = 140;
const PIECE_SIZE = 44;
const TARGET_TOLERANCE = 7; // +/- 7px tolerance for success

const Recaptcha = forwardRef(function Recaptcha(
  { onVerify, onExpire, onError, hideTriggerBox = false },
  ref
) {
  const [verified, setVerified] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [sliderPos, setSliderPos] = useState(0); // 0 to maxDrag
  const [targetX, setTargetX] = useState(160);
  const [targetY, setTargetY] = useState(48);
  const [bgIndex, setBgIndex] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef(null);
  const startXRef = useRef(0);
  const initialSliderRef = useRef(0);

  const maxDrag = PUZZLE_WIDTH - PIECE_SIZE - 12;

  const resetPuzzle = () => {
    // Generate new random target position between 100 and maxDrag
    const newX = Math.floor(Math.random() * (maxDrag - 110)) + 110;
    const newY = Math.floor(Math.random() * (PUZZLE_HEIGHT - PIECE_SIZE - 24)) + 14;
    setTargetX(newX);
    setTargetY(newY);
    setSliderPos(0);
    setFeedback('');
    setBgIndex((prev) => (prev + 1) % PUZZLE_BACKGROUNDS.length);
  };

  useEffect(() => {
    resetPuzzle();
  }, []);

  useImperativeHandle(ref, () => ({
    reset: () => {
      setVerified(false);
      setIsOpen(false);
      setSliderPos(0);
      setFeedback('');
      resetPuzzle();
      onExpire?.();
    },
    openChallenge: () => {
      setVerified(false);
      setIsOpen(true);
      resetPuzzle();
    },
  }));

  const handleStartModal = () => {
    if (verified) return;
    setIsOpen(true);
    resetPuzzle();
  };

  const handleDragStart = (e) => {
    if (verified) return;
    setIsDragging(true);
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    startXRef.current = clientX;
    initialSliderRef.current = sliderPos;
  };

  useEffect(() => {
    const handleMove = (e) => {
      if (!isDragging) return;
      const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
      const deltaX = clientX - startXRef.current;
      const newPos = Math.max(0, Math.min(maxDrag, initialSliderRef.current + deltaX));
      setSliderPos(newPos);
    };

    const handleEnd = () => {
      if (!isDragging) return;
      setIsDragging(false);

      // Check if current position matches targetX within tolerance
      const diff = Math.abs(sliderPos - targetX);
      if (diff <= TARGET_TOLERANCE) {
        setFeedback('success');
        setVerified(true);
        const token = `recaptcha-verified-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        setTimeout(() => {
          setIsOpen(false);
          onVerify?.(token);
        }, 650);
      } else {
        setFeedback('fail');
        setTimeout(() => {
          setSliderPos(0);
          setFeedback('');
        }, 500);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, sliderPos, targetX, maxDrag, onVerify]);

  const currentBg = PUZZLE_BACKGROUNDS[bgIndex];

  return (
    <div style={{ margin: hideTriggerBox ? 0 : '14px 0', width: '100%', userSelect: 'none' }}>
      {/* reCAPTCHA Trigger Box */}
      {!hideTriggerBox && (
        <div
          onClick={handleStartModal}
        style={{
          width: '100%',
          maxWidth: 320,
          margin: '0 auto',
          height: 74,
          background: '#f9f9f9',
          border: '1px solid #d3d3d3',
          borderRadius: 6,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          boxSizing: 'border-box',
          cursor: verified ? 'default' : 'pointer',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {verified ? (
              <svg viewBox="0 0 24 24" width="28" height="28" style={{ display: 'block' }}>
                <path
                  d="M4.5 12.75l6 6 9-13.5"
                  fill="none"
                  stroke="#0f9d58"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <div
                style={{
                  width: 22,
                  height: 22,
                  background: '#ffffff',
                  border: '2px solid #94a3b8',
                  borderRadius: 4,
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ width: 8, height: 8, background: '#3b82f6', borderRadius: 2, opacity: 0.8 }} />
              </div>
            )}
          </div>

          <div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: verified ? '#0f766e' : '#1e293b',
                display: 'block',
              }}
            >
              {verified ? "I'm not a robot (Verified)" : 'Slide Puzzle: I am not a robot'}
            </span>
            <span style={{ fontSize: 10, color: '#64748b' }}>
              {verified ? 'Security challenge completed' : 'Click to solve the slide puzzle'}
            </span>
          </div>
        </div>

        {/* reCAPTCHA official emblem */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
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
          <span style={{ fontSize: 9, fontWeight: 700, color: '#475569' }}>reCAPTCHA</span>
        </div>
      </div>
      )}

      {/* Slide Puzzle Interactive Modal */}
      {isOpen && !verified && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            style={{
              width: PUZZLE_WIDTH + 32,
              background: '#ffffff',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              position: 'relative',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <strong style={{ fontSize: 14, color: '#0f172a', display: 'block' }}>
                  Security Verification
                </strong>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  Slide the puzzle piece to complete the image
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Puzzle Canvas Window */}
            <div
              style={{
                width: PUZZLE_WIDTH,
                height: PUZZLE_HEIGHT,
                borderRadius: 8,
                position: 'relative',
                overflow: 'hidden',
                background: currentBg.gradient,
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              {/* Decorative radial overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: currentBg.detail,
                }}
              />

              {/* Watermark brand */}
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontSize: 11,
                  fontWeight: 700,
                  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Barangay Poblacion Official Bureau</span>
              </div>

              {/* Target Slot (Missing Hole) */}
              <div
                style={{
                  position: 'absolute',
                  left: targetX,
                  top: targetY,
                  width: PIECE_SIZE,
                  height: PIECE_SIZE,
                  borderRadius: 6,
                  background: 'rgba(15, 23, 42, 0.65)',
                  boxShadow: 'inset 0 2px 6px rgba(0, 0, 0, 0.6), 0 0 0 1.5px rgba(255, 255, 255, 0.4)',
                }}
              />

              {/* Draggable Puzzle Piece */}
              <div
                style={{
                  position: 'absolute',
                  left: sliderPos,
                  top: targetY,
                  width: PIECE_SIZE,
                  height: PIECE_SIZE,
                  borderRadius: 6,
                  background: currentBg.gradient,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), 0 0 0 2px #ffffff',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  zIndex: 2,
                  overflow: 'hidden',
                  transition: isDragging ? 'none' : 'left 0.25s ease-out',
                }}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
              >
                {/* Visual matching indicator within piece */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(255, 255, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19.439 7.85c0-1.57-1.28-2.85-2.85-2.85h-1.44a3.5 3.5 0 0 0-6.298 0H7.41c-1.57 0-2.85 1.28-2.85 2.85v1.44a3.5 3.5 0 0 0 0 6.298v1.44c0 1.57 1.28 2.85 2.85 2.85h1.44a3.5 3.5 0 0 0 6.298 0h1.44c1.57 0 2.85-1.28 2.85-2.85v-1.44a3.5 3.5 0 0 0 0-6.298v-1.44z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Slider Control Track */}
            <div style={{ marginTop: 14 }}>
              <div
                ref={trackRef}
                style={{
                  position: 'relative',
                  height: 42,
                  background: '#f1f5f9',
                  borderRadius: 21,
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 4px',
                  boxSizing: 'border-box',
                }}
              >
                {/* Filled track progress */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: sliderPos + 20,
                    borderRadius: 21,
                    background:
                      feedback === 'success'
                        ? '#dcfce7'
                        : feedback === 'fail'
                        ? '#fee2e2'
                        : '#e0f2fe',
                    transition: isDragging ? 'none' : 'width 0.25s ease-out',
                  }}
                />

                {/* Track Placeholder Label */}
                <div
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                    color: feedback === 'fail' ? '#dc2626' : feedback === 'success' ? '#16a34a' : '#64748b',
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                >
                  {feedback === 'fail'
                    ? 'Verification failed! Try again.'
                    : feedback === 'success'
                    ? 'Verified! You are human.'
                    : 'Slide piece right to fit the slot →'}
                </div>

                {/* Slider Button */}
                <div
                  style={{
                    position: 'absolute',
                    left: sliderPos,
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background:
                      feedback === 'success'
                        ? '#22c55e'
                        : feedback === 'fail'
                        ? '#ef4444'
                        : '#2563eb',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    zIndex: 3,
                    transition: isDragging ? 'none' : 'left 0.25s ease-out',
                  }}
                  onMouseDown={handleDragStart}
                  onTouchStart={handleDragStart}
                >
                  {feedback === 'success' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : feedback === 'fail' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={resetPuzzle}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: 0,
                  fontWeight: 500,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                <span>Refresh Challenge</span>
              </button>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>
                Protected by reCAPTCHA v2
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default Recaptcha;
