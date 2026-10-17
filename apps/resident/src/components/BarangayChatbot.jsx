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
  const [language, setLanguage] = useState('en'); // 'en' | 'fil' | 'ceb'

  const messagesEndRef = useRef(null);
  const adminMessagesEndRef = useRef(null);

  const user = Session.getUser();
  const token = Session.getToken();

  const DEFAULT_GREETING = {
    id: 'welcome-1',
    sender: 'ai',
    text: 'Good day. I am the official Barangay AI Assistant for Poblacion, Cordova. I can assist you with barangay clearances, complaint tracking, community announcements, and official office procedures. How may I help you today?',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  // Initial welcome greeting & persistence load
  useEffect(() => {
    try {
      const stored = localStorage.getItem('bp_chatbot_ai_messages');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAiMessages(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn('[BarangayChatbot] Error reading saved chat session:', e);
    }
    setAiMessages([DEFAULT_GREETING]);
  }, []);

  // Save AI messages to localStorage when updated
  useEffect(() => {
    if (aiMessages && aiMessages.length > 0) {
      try {
        localStorage.setItem('bp_chatbot_ai_messages', JSON.stringify(aiMessages));
      } catch (e) {
        console.warn('[BarangayChatbot] Error persisting chat session:', e);
      }
    }
  }, [aiMessages]);

  // Explicitly end/reset current chat session
  const handleEndChat = () => {
    if (window.confirm('Are you sure you want to end this conversation and start a new session?')) {
      try {
        localStorage.removeItem('bp_chatbot_ai_messages');
      } catch (e) {
        // ignore
      }
      setAiMessages([
        {
          ...DEFAULT_GREETING,
          id: `welcome-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setInput('');
    }
  };

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

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Server returned ${res.status}`);
      }

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
      console.error('[BarangayChatbot] Error querying AI assistant:', err);
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
      case 'Resolved/Escalated':
        return { bg: 'var(--green-bg, #ecfdf5)', text: 'var(--green-text, #059669)', border: '#a7f3d0' };
      case 'Mediation':
        return { bg: 'var(--indigo-bg, #f5f3ff)', text: 'var(--indigo-text, #4338ca)', border: '#c7d2fe' };
      case 'In Progress':
        return { bg: 'var(--sky, #e0f2fe)', text: '#0369a1', border: 'var(--sky-2, #bae6fd)' };
      case 'Under Review':
        return { bg: 'var(--amber-bg, #fffbeb)', text: 'var(--amber-text, #b45309)', border: '#fde68a' };
      default:
        return { bg: 'var(--gray-bg, #f1f5f9)', text: 'var(--gray-text, #475569)', border: 'var(--border, #e2e8f0)' };
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
              padding: '13px 20px',
              backgroundColor: 'var(--navy, #141b4d)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 'var(--radius-pill, 9999px)',
              boxShadow: '0 10px 25px -3px rgba(20, 27, 77, 0.4), 0 4px 6px -4px rgba(20, 27, 77, 0.2)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.9rem',
              fontFamily: 'var(--font-body, inherit)',
              letterSpacing: '0.01em',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.backgroundColor = 'var(--navy-2, #1b2364)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.backgroundColor = 'var(--navy, #141b4d)';
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </span>
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
            backgroundColor: 'var(--card, #ffffff)',
            borderRadius: 'var(--radius-lg, 14px)',
            boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.25), 0 0 0 1px var(--border, #e2e8f0)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 10000,
            border: '1px solid var(--border, #e2e8f0)',
            fontFamily: 'var(--font-body, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
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
              backgroundColor: 'var(--navy, #141b4d)',
              color: '#ffffff',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  flexShrink: 0,
                }}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.94rem', lineHeight: 1.25, letterSpacing: '-0.01em' }}>
                  Barangay Poblacion Assistant
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--sky-2, #bae6fd)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4ade80' }}></span>
                  <span>Official Civic Assistant • Poblacion, Cordova</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* End Chat Button (AI mode) */}
              {chatMode === 'ai' && aiMessages.length > 1 && (
                <button
                  type="button"
                  onClick={handleEndChat}
                  title="End conversation and start new session"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    color: '#ffffff',
                    borderRadius: 'var(--radius-sm, 6px)',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '5px 9px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--red-text, #dc2626)';
                    e.currentTarget.style.borderColor = 'var(--red-text, #dc2626)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                    <path d="M21 3v5h-5"></path>
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                    <path d="M3 21v-5h5"></path>
                  </svg>
                  <span>Reset</span>
                </button>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: 6,
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 'var(--radius-sm, 6px)',
                  opacity: 0.85,
                  transition: 'opacity 0.15s ease, background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.85';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          {/* Scope & Mode Switcher Bar */}
          <div
            style={{
              padding: '8px 14px',
              backgroundColor: 'var(--bg, #f8fafc)',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            {/* Segmented Switcher matching resident portal tabs */}
            <div
              style={{
                display: 'flex',
                background: '#eef0f6',
                borderRadius: 'var(--radius-pill, 9999px)',
                padding: 3,
                flex: 1,
                maxWidth: 260,
              }}
            >
              <button
                type="button"
                onClick={() => setChatMode('ai')}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: '0.74rem',
                  fontWeight: chatMode === 'ai' ? 800 : 600,
                  borderRadius: 'var(--radius-pill, 9999px)',
                  border: 'none',
                  backgroundColor: chatMode === 'ai' ? '#ffffff' : 'transparent',
                  color: chatMode === 'ai' ? 'var(--navy, #141b4d)' : 'var(--muted, #64748b)',
                  boxShadow: chatMode === 'ai' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
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
                  padding: '6px 12px',
                  fontSize: '0.74rem',
                  fontWeight: chatMode === 'admin' ? 800 : 600,
                  borderRadius: 'var(--radius-pill, 9999px)',
                  border: 'none',
                  backgroundColor: chatMode === 'admin' ? '#ffffff' : 'transparent',
                  color: chatMode === 'admin' ? 'var(--blue, #2563eb)' : 'var(--muted, #64748b)',
                  boxShadow: chatMode === 'admin' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
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
                      background: 'var(--red-text, #dc2626)',
                      color: '#ffffff',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      borderRadius: 'var(--radius-pill, 9999px)',
                      padding: '1px 6px',
                      lineHeight: 1.2,
                    }}
                  >
                    {unreadAdminCount}
                  </span>
                )}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <label htmlFor="chatbot-lang-select" style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted, #64748b)' }}>
                Language:
              </label>
              <select
                id="chatbot-lang-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: 'var(--navy, #141b4d)',
                  background: '#ffffff',
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="en">English</option>
                <option value="fil">Tagalog</option>
                <option value="ceb">Bisaya</option>
              </select>
            </div>
          </div>

          {/* TAB 1: AI ASSISTANT CHAT */}
          {chatMode === 'ai' && (
            <>
              {/* Messages Body */}
              <div
                style={{
                  flex: 1,
                  padding: 16,
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg, #f8fafc)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
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
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: isResident ? 'var(--muted, #64748b)' : 'var(--navy, #141b4d)',
                          marginBottom: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        {isResident ? (
                          <span>You</span>
                        ) : (
                          <>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue, #2563eb)' }}></span>
                            <span>Barangay AI Assistant</span>
                          </>
                        )}
                        <span style={{ color: '#94a3b8', fontWeight: 500 }}>• {m.timestamp}</span>
                      </div>

                      {/* Message Bubble */}
                      <div
                        style={{
                          maxWidth: '85%',
                          padding: '12px 16px',
                          borderRadius: isResident ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          fontSize: '0.86rem',
                          lineHeight: 1.55,
                          whiteSpace: 'pre-wrap',
                          backgroundColor: isResident ? 'var(--navy, #141b4d)' : 'var(--card, #ffffff)',
                          color: isResident ? '#ffffff' : 'var(--text, #0f172a)',
                          border: isResident ? 'none' : '1px solid var(--border, #e2e8f0)',
                          boxShadow: isResident
                            ? '0 4px 12px rgba(20, 27, 77, 0.15)'
                            : '0 2px 6px rgba(15, 23, 42, 0.04)',
                        }}
                      >
                        {cleanText(m.text)}

                        {/* Verified Complaint Card If Retrieved */}
                        {m.complaints && m.complaints.length > 0 && (
                          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {m.complaints.map((c) => {
                              const badge = statusBadgeColor(c.status);
                              return (
                                <div
                                  key={c.id}
                                  style={{
                                    padding: '12px 14px',
                                    background: 'var(--bg, #f8fafc)',
                                    borderRadius: 'var(--radius, 8px)',
                                    border: '1px solid var(--border, #e2e8f0)',
                                    fontSize: '0.8rem',
                                    color: 'var(--text, #0f172a)',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                    <strong style={{ color: 'var(--navy, #141b4d)', fontSize: '0.86rem' }}>Case #{c.id}</strong>
                                    <span
                                      style={{
                                        backgroundColor: badge.bg,
                                        color: badge.text,
                                        border: `1px solid ${badge.border}`,
                                        padding: '2px 8px',
                                        borderRadius: 'var(--radius-pill, 9999px)',
                                        fontWeight: 800,
                                        fontSize: '0.68rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.03em',
                                      }}
                                    >
                                      {c.status}
                                    </span>
                                  </div>
                                  <div style={{ color: 'var(--muted, #64748b)', marginBottom: 3 }}>
                                    Category: <strong style={{ color: 'var(--text, #0f172a)' }}>{c.category || 'General Concern'}</strong>
                                  </div>
                                  {c.hearingStage && (
                                    <div style={{ color: 'var(--blue, #2563eb)', fontWeight: 600 }}>
                                      Stage: {c.hearingStage}
                                    </div>
                                  )}
                                  {c.mediationDate && (
                                    <div style={{ color: 'var(--indigo-text, #4338ca)', fontSize: '0.76rem', marginTop: 4 }}>
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
                          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border, #e2e8f0)' }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (m.caseId) setTaggedCaseId(m.caseId);
                                setChatMode('admin');
                              }}
                              style={{
                                backgroundColor: 'var(--blue, #2563eb)',
                                color: '#ffffff',
                                border: 'none',
                                padding: '7px 14px',
                                borderRadius: 'var(--radius-pill, 9999px)',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--blue, #2563eb)')}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                              </svg>
                              <span>Direct Message Barangay Admin</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isTyping && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--muted, #64748b)', fontSize: '0.8rem', padding: '6px 10px' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--blue, #2563eb)', animation: 'pulse 1s infinite' }}></span>
                    <span>Barangay Assistant is checking official database...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Action Chips */}
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'var(--card, #ffffff)',
                  borderTop: '1px solid var(--border, #e2e8f0)',
                  display: 'flex',
                  gap: 7,
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
                      padding: '5px 12px',
                      backgroundColor: 'var(--gray-bg, #f1f5f9)',
                      color: 'var(--navy, #141b4d)',
                      border: '1px solid var(--border, #e2e8f0)',
                      borderRadius: 'var(--radius-pill, 9999px)',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--sky, #e0f2fe)';
                      e.currentTarget.style.borderColor = 'var(--sky-2, #bae6fd)';
                      e.currentTarget.style.color = 'var(--blue, #2563eb)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--gray-bg, #f1f5f9)';
                      e.currentTarget.style.borderColor = 'var(--border, #e2e8f0)';
                      e.currentTarget.style.color = 'var(--navy, #141b4d)';
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
                  padding: '12px 14px',
                  backgroundColor: 'var(--card, #ffffff)',
                  borderTop: '1px solid var(--border, #e2e8f0)',
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
                    padding: '10px 14px',
                    borderRadius: 'var(--radius, 8px)',
                    border: '1px solid var(--border, #e2e8f0)',
                    fontSize: '0.86rem',
                    outline: 'none',
                    backgroundColor: 'var(--bg, #f8fafc)',
                    fontFamily: 'var(--font-body, inherit)',
                    color: 'var(--text, #0f172a)',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--blue, #2563eb)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border, #e2e8f0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  aria-label="Send message to AI"
                  style={{
                    backgroundColor: 'var(--navy, #141b4d)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius, 8px)',
                    padding: '10px 16px',
                    cursor: !input.trim() || isTyping ? 'not-allowed' : 'pointer',
                    opacity: !input.trim() || isTyping ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (input.trim() && !isTyping) e.currentTarget.style.backgroundColor = 'var(--navy-2, #1b2364)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--navy, #141b4d)';
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
                  padding: '9px 16px',
                  backgroundColor: 'var(--green-bg, #ecfdf5)',
                  borderBottom: '1px solid #bbf7d0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.76rem',
                  color: 'var(--green-text, #059669)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></span>
                  <span style={{ fontWeight: 700 }}>Direct Line to Barangay Admin Staff</span>
                </div>
                {taggedCaseId && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--navy, #141b4d)', fontWeight: 800 }}>
                    Case #{taggedCaseId}
                  </span>
                )}
              </div>

              {/* Admin Messages Thread */}
              <div
                style={{
                  flex: 1,
                  padding: 16,
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg, #f8fafc)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                {adminMessages.length === 0 ? (
                  <div
                    style={{
                      margin: 'auto 0',
                      textAlign: 'center',
                      padding: '24px 16px',
                      color: 'var(--muted, #64748b)',
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        backgroundColor: 'var(--green-bg, #ecfdf5)',
                        color: 'var(--green-text, #059669)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 12px',
                        border: '1px solid #a7f3d0',
                      }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--navy, #141b4d)', fontSize: '0.94rem', marginBottom: 5 }}>
                      Direct Admin Inquiries
                    </div>
                    <p style={{ fontSize: '0.82rem', lineHeight: 1.5, maxWidth: 300, margin: '0 auto', color: 'var(--muted, #64748b)' }}>
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
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: isAdmin ? 'var(--green-text, #059669)' : 'var(--muted, #64748b)',
                            marginBottom: 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          {isAdmin ? (
                            <>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green-text, #059669)' }}></span>
                              <span>Barangay Official Admin</span>
                            </>
                          ) : (
                            <span>You</span>
                          )}
                          <span style={{ color: '#94a3b8', fontWeight: 500 }}>• {m.timestamp}</span>
                        </div>

                        {/* Bubble */}
                        <div
                          style={{
                            maxWidth: '85%',
                            padding: '12px 16px',
                            borderRadius: isResident ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            fontSize: '0.86rem',
                            lineHeight: 1.55,
                            whiteSpace: 'pre-wrap',
                            backgroundColor: isAdmin ? 'var(--card, #ffffff)' : 'var(--navy, #141b4d)',
                            color: isAdmin ? 'var(--text, #0f172a)' : '#ffffff',
                            border: isAdmin ? '1px solid var(--border, #e2e8f0)' : 'none',
                            boxShadow: isResident
                              ? '0 4px 12px rgba(20, 27, 77, 0.15)'
                              : '0 2px 6px rgba(15, 23, 42, 0.04)',
                          }}
                        >
                          {cleanText(m.text)}
                          {m.caseId && (
                            <div style={{ marginTop: 5, fontSize: '0.72rem', opacity: 0.85, fontWeight: 700 }}>
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
                      padding: '9px 14px',
                      backgroundColor: 'var(--green-bg, #ecfdf5)',
                      border: '1px solid #bbf7d0',
                      borderRadius: 'var(--radius, 8px)',
                      color: 'var(--green-text, #059669)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
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
                  padding: '12px 14px',
                  backgroundColor: 'var(--card, #ffffff)',
                  borderTop: '1px solid var(--border, #e2e8f0)',
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
                    padding: '10px 14px',
                    borderRadius: 'var(--radius, 8px)',
                    border: '1px solid var(--border, #e2e8f0)',
                    fontSize: '0.86rem',
                    outline: 'none',
                    backgroundColor: 'var(--bg, #f8fafc)',
                    fontFamily: 'var(--font-body, inherit)',
                    color: 'var(--text, #0f172a)',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--blue, #2563eb)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border, #e2e8f0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="submit"
                  disabled={!adminInput.trim() || sendingAdminMsg}
                  aria-label="Send message to Admin"
                  style={{
                    backgroundColor: 'var(--navy, #141b4d)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--radius, 8px)',
                    padding: '10px 16px',
                    cursor: !adminInput.trim() || sendingAdminMsg ? 'not-allowed' : 'pointer',
                    opacity: !adminInput.trim() || sendingAdminMsg ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (adminInput.trim() && !sendingAdminMsg) e.currentTarget.style.backgroundColor = 'var(--navy-2, #1b2364)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--navy, #141b4d)';
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
