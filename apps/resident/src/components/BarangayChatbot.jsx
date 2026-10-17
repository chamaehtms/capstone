import React, { useState, useEffect, useRef } from 'react';
import { Session } from '../api.js';

function cleanText(text) {
  if (!text) return '';
  return String(text)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
    .replace(/^\s*>\s+/gm, '')
    .replace(/^(\s*[-*_]){3,}\s*$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^\s*\*\s+/gm, '• ')
    .replace(/^\s*-\s+/gm, '• ')
    .replace(/\*+/g, '')
    .trim();
}

export default function BarangayChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [chatMode, setChatMode] = useState('ai'); // 'ai' | 'admin'
  const [aiMessages, setAiMessages] = useState([]);
  const [adminMessages, setAdminMessages] = useState([]);
  const [input, setInput] = useState('');
  const [adminInput, setAdminInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showAdminComposer, setShowAdminComposer] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [taggedCaseId, setTaggedCaseId] = useState('');
  const [sendingAdminMsg, setSendingAdminMsg] = useState(false);
  const [adminSentSuccess, setAdminSentSuccess] = useState(false);
  const [unreadAdminCount, setUnreadAdminCount] = useState(0);

  const messagesEndRef = useRef(null);
  const adminMessagesEndRef = useRef(null);

  const user = Session.getUser();
  const token = Session.getToken();

  // Initial welcome greeting
  useEffect(() => {
    const greetingText =
      'Good day. I am the official Barangay AI Assistant for Poblacion, Cordova. I can assist you with barangay clearances, complaint tracking, community announcements, and official office procedures. How may I help you today?';

    setAiMessages([
      {
        id: 'welcome-1',
        sender: 'ai',
        text: greetingText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, []);

  // Load message thread from admin if resident is authenticated with periodic polling (every 4 seconds)
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadAdminMessages() {
      const activeToken = Session.getToken() || localStorage.getItem('bp_token');
      if (!activeToken) return;

      try {
        const res = await fetch('/api/chatbot/messages', {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        if (!res.ok) return;
        const history = await res.json();
        if (isMounted && Array.isArray(history)) {
          const formattedHistory = history.map((m) => ({
            id: m.id,
            sender: m.sender_role, // 'resident' or 'admin'
            text: m.message,
            caseId: m.case_id,
            readByResident: m.read_by_resident,
            timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isAdminReply: m.sender_role === 'admin',
          }));

          setAdminMessages(formattedHistory);

          // Calculate unread admin messages when resident is on AI tab or drawer closed
          const unreadCount = formattedHistory.filter(
            (m) => m.sender === 'admin' && m.readByResident === false
          ).length;
          setUnreadAdminCount(unreadCount);
        }
      } catch (err) {
        console.warn('[BarangayChatbot] Could not load admin message history:', err);
      }
    }

    loadAdminMessages();
    const interval = setInterval(loadAdminMessages, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen]);

  // Auto-scroll AI Assistant messages
  useEffect(() => {
    if (isOpen && chatMode === 'ai') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, isTyping, isOpen, chatMode]);

  // Auto-scroll Admin messages
  useEffect(() => {
    if (isOpen && chatMode === 'admin') {
      adminMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [adminMessages, isOpen, chatMode]);

  // Send message to AI Assistant
  const handleSend = async (queryToSend = input) => {
    const text = (queryToSend || '').trim();
    if (!text) return;

    const userMsg = {
      id: `usr-${Date.now()}`,
      sender: 'resident',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setAiMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const activeToken = Session.getToken() || localStorage.getItem('bp_token');
      const headers = { 'Content-Type': 'application/json' };
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }

      const res = await fetch('/api/chatbot/ask', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: text,
          language,
          conversationHistory: aiMessages.slice(-6).map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
        }),
      });

      const data = await res.json();
      setIsTyping(false);

      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.reply || 'Thank you for reaching out. Please contact the Barangay Poblacion Hall for further details.',
        complaints: data.complaints || null,
        canMessageAdmin: data.canMessageAdmin || false,
        caseId: data.caseId || null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setAiMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setIsTyping(false);
      setAiMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: 'Unable to connect to the barangay network at the moment. Please try again shortly or contact the Barangay Poblacion Hall at brgypoblacion@admin.gov.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  // Submit direct resident-to-admin message
  const handleSendAdminMessage = async (e, textOverride = null) => {
    e?.preventDefault();
    const activeToken = Session.getToken() || localStorage.getItem('bp_token');
    const msgToSend = (textOverride || adminInput || adminNote || '').trim();
    if (!msgToSend || !activeToken) return;

    setSendingAdminMsg(true);
    try {
      const res = await fetch('/api/chatbot/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({
          message: msgToSend,
          caseId: taggedCaseId || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to send message to admin');
      const saved = await res.json();

      setAdminMessages((prev) => [
        ...prev,
        {
          id: saved.id || `msg-${Date.now()}`,
          sender: 'resident',
          text: msgToSend,
          caseId: taggedCaseId || null,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      setAdminInput('');
      setAdminNote('');
      setShowAdminComposer(false);
      setAdminSentSuccess(true);
      setTimeout(() => setAdminSentSuccess(false), 4000);
    } catch (err) {
      alert('Could not dispatch message. Please ensure you are logged in.');
    } finally {
      setSendingAdminMsg(false);
    }
  };

  // Quick Action Prompts
  const QUICK_PROMPTS = [
    { label: 'Check My Complaint Status', query: 'How is my complaint going?' },
    { label: 'Barangay Clearance Info', query: 'What are the requirements for Barangay Clearance?' },
    { label: 'Office Hours & Officials', query: 'What are the office hours and officials of Barangay Poblacion?' },
    { label: 'Curfew & Noise Rules', query: 'What are the rules on curfew and noise regulations?' },
    {
      label: 'Message Admin',
      action: () => setChatMode('admin'),
    },
  ];

  const statusBadgeColor = (status) => {
    switch (status) {
      case 'Resolved':
        return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' };
      case 'Mediation':
        return { bg: '#e0e7ff', text: '#4338ca', border: '#c7d2fe' };
      case 'In Progress':
        return { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' };
      case 'Under Review':
        return { bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
      default:
        return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
    }
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Open Barangay AI Assistant"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 18px',
              backgroundColor: '#1e3a8a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 30,
              boxShadow: '0 4px 14px rgba(30, 58, 138, 0.35)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.88rem',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Barangay Assistant</span>
          </button>
        )}
      </div>

      {/* Chat Window Modal */}
      {isOpen && (
        <div
          className="barangay-chatbot-window"
          style={{
            position: 'fixed',
            bottom: 'var(--chat-bottom, 24px)',
            right: 'var(--chat-right, 24px)',
            width: 'var(--chat-width, 420px)',
            maxWidth: 'calc(100vw - 20px)',
            height: 'var(--chat-height, 620px)',
            maxHeight: 'calc(100dvh - 30px)',
            backgroundColor: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 12px 36px rgba(15, 23, 42, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 10000,
            border: '1px solid #cbd5e1',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <style>{`
            @media (max-width: 640px) {
              .barangay-chatbot-window {
                --chat-bottom: 0px !important;
                --chat-right: 0px !important;
                --chat-width: 100vw !important;
                --chat-height: 100dvh !important;
                border-radius: 0px !important;
                max-height: 100dvh !important;
                max-width: 100vw !important;
                border: none !important;
              }
            }
          `}</style>
          {/* Header */}
          <div
            style={{
              backgroundColor: '#1e3a8a',
              color: '#ffffff',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #1e40af',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1e3a8a',
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', lineHeight: 1.2 }}>
                  Barangay Poblacion Assistant
                </div>
                <div style={{ fontSize: '0.72rem', color: '#93c5fd', marginTop: 2 }}>
                  Verified RAG Assistant • Poblacion, Cordova
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0.85,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          {/* Scope & Mode Switcher Bar */}
          <div
            style={{
              padding: '6px 12px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            {/* Segmented Switcher */}
            <div
              style={{
                display: 'flex',
                background: '#e2e8f0',
                borderRadius: 8,
                padding: 2,
                flex: 1,
                maxWidth: 280,
              }}
            >
              <button
                type="button"
                onClick={() => setChatMode('ai')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: '0.74rem',
                  fontWeight: chatMode === 'ai' ? 700 : 500,
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: chatMode === 'ai' ? '#ffffff' : 'transparent',
                  color: chatMode === 'ai' ? '#1e3a8a' : '#64748b',
                  boxShadow: chatMode === 'ai' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  transition: 'all 0.15s ease',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                <span>AI Assistant</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setChatMode('admin');
                  setUnreadAdminCount(0);
                }}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: '0.74rem',
                  fontWeight: chatMode === 'admin' ? 700 : 500,
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: chatMode === 'admin' ? '#ffffff' : 'transparent',
                  color: chatMode === 'admin' ? '#047857' : '#64748b',
                  boxShadow: chatMode === 'admin' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  position: 'relative',
                  transition: 'all 0.15s ease',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>Admin Chat</span>
                {unreadAdminCount > 0 && (
                  <span
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      borderRadius: 10,
                      padding: '1px 5px',
                      lineHeight: 1,
                    }}
                  >
                    {unreadAdminCount}
                  </span>
                )}
              </button>
            </div>

            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#0284c7', flexShrink: 0 }}>
              Poblacion, Cordova
            </span>
          </div>

          {/* TAB 1: AI ASSISTANT CHAT */}
          {chatMode === 'ai' && (
            <>
              {/* Messages Body */}
              <div
                style={{
                  flex: 1,
                  padding: 14,
                  overflowY: 'auto',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {aiMessages.map((m) => {
                  const isResident = m.sender === 'resident';

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isResident ? 'flex-end' : 'flex-start',
                        maxWidth: '100%',
                      }}
                    >
                      {/* Sender Label */}
                      <div
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          color: isResident ? '#64748b' : '#1e3a8a',
                          marginBottom: 3,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {isResident ? (
                          <span>You</span>
                        ) : (
                          <>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb' }}></span>
                            <span>Barangay AI Assistant</span>
                          </>
                        )}
                        <span style={{ color: '#94a3b8', fontWeight: 400 }}>• {m.timestamp}</span>
                      </div>

                      {/* Message Bubble */}
                      <div
                        style={{
                          maxWidth: '85%',
                          padding: '10px 14px',
                          borderRadius: 12,
                          fontSize: '0.84rem',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          backgroundColor: isResident ? '#1e3a8a' : '#ffffff',
                          color: isResident ? '#ffffff' : '#0f172a',
                          border: isResident ? 'none' : '1px solid #e2e8f0',
                          boxShadow: isResident ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.04)',
                        }}
                      >
                        {cleanText(m.text)}

                        {/* Verified Complaint Card If Retrieved */}
                        {m.complaints && m.complaints.length > 0 && (
                          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {m.complaints.map((c) => {
                              const badge = statusBadgeColor(c.status);
                              return (
                                <div
                                  key={c.id}
                                  style={{
                                    padding: 10,
                                    background: '#f8fafc',
                                    borderRadius: 8,
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.78rem',
                                    color: '#1e293b',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <strong style={{ color: '#1e3a8a' }}>Case #{c.id}</strong>
                                    <span
                                      style={{
                                        backgroundColor: badge.bg,
                                        color: badge.text,
                                        border: `1px solid ${badge.border}`,
                                        padding: '2px 8px',
                                        borderRadius: 12,
                                        fontWeight: 700,
                                        fontSize: '0.7rem',
                                      }}
                                    >
                                      {c.status}
                                    </span>
                                  </div>
                                  <div style={{ color: '#475569', marginBottom: 2 }}>
                                    Category: {c.category || 'General Concern'}
                                  </div>
                                  {c.hearingStage && (
                                    <div style={{ color: '#0284c7', fontWeight: 600 }}>
                                      Stage: {c.hearingStage}
                                    </div>
                                  )}
                                  {c.mediationDate && (
                                    <div style={{ color: '#4338ca', fontSize: '0.74rem', marginTop: 3 }}>
                                      Mediation: {c.mediationDate} at {c.mediationVenue || 'Barangay Hall'}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Switch to Admin Chat Button if requested */}
                        {m.canMessageAdmin && (
                          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (m.caseId) setTaggedCaseId(m.caseId);
                                setChatMode('admin');
                              }}
                              style={{
                                backgroundColor: '#0284c7',
                                color: '#ffffff',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: 6,
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                              </svg>
                              Switch to Barangay Admin Chat
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isTyping && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: '0.78rem', padding: '4px 8px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8', animation: 'pulse 1s infinite' }}></span>
                    <span>Barangay Assistant is checking official database...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Action Chips */}
              <div
                style={{
                  padding: '6px 10px',
                  backgroundColor: '#ffffff',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  gap: 6,
                  overflowX: 'auto',
                  whiteSpace: 'nowrap',
                }}
              >
                {QUICK_PROMPTS.map((qp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (qp.action) qp.action();
                      else handleSend(qp.query);
                    }}
                    style={{
                      padding: '4px 10px',
                      backgroundColor: '#f1f5f9',
                      color: '#334155',
                      border: '1px solid #e2e8f0',
                      borderRadius: 16,
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {qp.label}
                  </button>
                ))}
              </div>

              {/* AI Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#ffffff',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  placeholder="Ask about barangay services, clearance, complaints..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    outline: 'none',
                    backgroundColor: '#f8fafc',
                  }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  aria-label="Send message to AI"
                  style={{
                    backgroundColor: '#1e3a8a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '9px 14px',
                    cursor: !input.trim() || isTyping ? 'not-allowed' : 'pointer',
                    opacity: !input.trim() || isTyping ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </form>
            </>
          )}

          {/* TAB 2: OFFICIAL BARANGAY ADMIN CHAT */}
          {chatMode === 'admin' && (
            <>
              {/* Admin Chat Banner */}
              <div
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#ecfdf5',
                  borderBottom: '1px solid #a7f3d0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.74rem',
                  color: '#065f46',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span>
                  <span style={{ fontWeight: 600 }}>Direct Line to Barangay Admin Staff</span>
                </div>
                {taggedCaseId && (
                  <span style={{ fontSize: '0.7rem', color: '#047857', fontWeight: 700 }}>
                    Case #{taggedCaseId}
                  </span>
                )}
              </div>

              {/* Admin Messages Thread */}
              <div
                style={{
                  flex: 1,
                  padding: 14,
                  overflowY: 'auto',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {adminMessages.length === 0 ? (
                  <div
                    style={{
                      margin: 'auto 0',
                      textAlign: 'center',
                      padding: '24px 16px',
                      color: '#64748b',
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        backgroundColor: '#d1fae5',
                        color: '#059669',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 10px',
                      }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem', marginBottom: 4 }}>
                      Direct Admin Inquiries
                    </div>
                    <p style={{ fontSize: '0.78rem', lineHeight: 1.4, maxWidth: 280, margin: '0 auto' }}>
                      Send official concerns, blotter inquiries, or follow-ups directly to the Barangay Poblacion administration.
                    </p>
                  </div>
                ) : (
                  adminMessages.map((m) => {
                    const isResident = m.sender === 'resident';
                    const isAdmin = m.isAdminReply || m.sender === 'admin';

                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isResident ? 'flex-end' : 'flex-start',
                          maxWidth: '100%',
                        }}
                      >
                        {/* Sender Label */}
                        <div
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            color: isAdmin ? '#059669' : '#64748b',
                            marginBottom: 3,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {isAdmin ? (
                            <>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }}></span>
                              <span>Barangay Official Admin</span>
                            </>
                          ) : (
                            <span>You</span>
                          )}
                          <span style={{ color: '#94a3b8', fontWeight: 400 }}>• {m.timestamp}</span>
                        </div>

                        {/* Bubble */}
                        <div
                          style={{
                            maxWidth: '85%',
                            padding: '10px 14px',
                            borderRadius: 12,
                            fontSize: '0.84rem',
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap',
                            backgroundColor: isAdmin ? '#ecfdf5' : '#047857',
                            color: isAdmin ? '#065f46' : '#ffffff',
                            border: isAdmin ? '1px solid #a7f3d0' : 'none',
                            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                          }}
                        >
                          {cleanText(m.text)}
                          {m.caseId && (
                            <div style={{ marginTop: 4, fontSize: '0.68rem', opacity: 0.85, fontWeight: 600 }}>
                              Ref: #{m.caseId}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {adminSentSuccess && (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: 8,
                      color: '#15803d',
                      fontSize: '0.75rem',
                      textAlign: 'center',
                    }}
                  >
                    Your message has been dispatched to Barangay Poblacion staff.
                  </div>
                )}

                <div ref={adminMessagesEndRef} />
              </div>

              {/* Admin Input Bar */}
              <form
                onSubmit={(e) => handleSendAdminMessage(e, adminInput)}
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#ffffff',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  placeholder="Type an official message or follow-up for the admin..."
                  value={adminInput}
                  onChange={(e) => setAdminInput(e.target.value)}
                  disabled={sendingAdminMsg}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    outline: 'none',
                    backgroundColor: '#f8fafc',
                  }}
                />
                <button
                  type="submit"
                  disabled={!adminInput.trim() || sendingAdminMsg}
                  aria-label="Send message to Admin"
                  style={{
                    backgroundColor: '#047857',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '9px 14px',
                    cursor: !adminInput.trim() || sendingAdminMsg ? 'not-allowed' : 'pointer',
                    opacity: !adminInput.trim() || sendingAdminMsg ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
