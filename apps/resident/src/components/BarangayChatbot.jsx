import React, { useState, useEffect, useRef } from 'react';
import { Session } from '../api.js';

export default function BarangayChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState('en'); // 'en' | 'fil' | 'ceb'
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showAdminComposer, setShowAdminComposer] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [taggedCaseId, setTaggedCaseId] = useState('');
  const [sendingAdminMsg, setSendingAdminMsg] = useState(false);
  const [adminSentSuccess, setAdminSentSuccess] = useState(false);

  const messagesEndRef = useRef(null);

  const user = Session.getUser();
  const token = Session.getToken();

  // Initial welcome greeting
  useEffect(() => {
    const greetingText =
      language === 'fil'
        ? 'Magandang araw! Ako ang Barangay AI Assistant para sa Poblacion, Cordova. Maaari kitang tulungan sa impormasyon ukol sa mga sertipiko, proseso ng reklamo, anunsyo, at mga alituntunin sa komunidad. Paano kita matutulungan ngayon?'
        : language === 'ceb'
        ? 'Maayong adlaw! Ako ang Barangay AI Assistant para sa Poblacion, Cordova. Makatabang ko nimo sa mga serbisyo sa barangay, clearance, pagsusi sa reklamo, ug mga patakaran sa komunidad. Unsay akong ikatabang nimo karon?'
        : 'Good day! I am the official Barangay AI Assistant for Poblacion, Cordova. I can assist you with barangay clearances, complaint tracking, community announcements, and official office procedures. How may I help you today?';

    setMessages([
      {
        id: 'welcome-1',
        sender: 'ai',
        text: greetingText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, [language]);

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
            timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isAdminReply: m.sender_role === 'admin',
          }));

          setMessages((prev) => {
            // Keep the initial welcome message from the AI
            const welcome = prev.filter((m) => m.id.startsWith('welcome-') || (m.sender === 'ai' && !m.id.startsWith('msg-')));
            
            // Collect any pending AI replies and temporary unsaved messages
            const map = new Map();
            welcome.forEach((m) => map.set(m.id, m));
            formattedHistory.forEach((m) => map.set(m.id, m));
            
            // Also preserve any conversational AI responses generated during this session
            prev.forEach((m) => {
              if (m.sender === 'ai' && !map.has(m.id)) {
                map.set(m.id, m);
              }
            });

            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.warn('[BarangayChatbot] Could not load message history:', err);
      }
    }

    loadAdminMessages();
    const interval = setInterval(loadAdminMessages, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

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

    setMessages((prev) => [...prev, userMsg]);
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
          conversationHistory: messages.slice(-6).map((m) => ({
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

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setIsTyping(false);
      setMessages((prev) => [
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
  const handleSendAdminMessage = async (e) => {
    e?.preventDefault();
    const activeToken = Session.getToken() || localStorage.getItem('bp_token');
    if (!adminNote.trim() || !activeToken) return;

    setSendingAdminMsg(true);
    try {
      const res = await fetch('/api/chatbot/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({
          message: adminNote.trim(),
          caseId: taggedCaseId || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to send message to admin');
      const saved = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: saved.id || `msg-${Date.now()}`,
          sender: 'resident',
          text: `[Sent to Barangay Admin]: ${adminNote.trim()}`,
          caseId: taggedCaseId || null,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        {
          id: `ai-ack-${Date.now()}`,
          sender: 'ai',
          text: 'Your inquiry has been officially dispatched to the Barangay Poblacion Administration. An administrator will review your message and reply directly to your account.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

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
    { label: 'Message Admin', action: () => setShowAdminComposer(true) },
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
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: '92vw',
            maxWidth: 420,
            height: '620px',
            maxHeight: '86vh',
            backgroundColor: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.22)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 10000,
            border: '1px solid #cbd5e1',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
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
              {/* Language Selector */}
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.15)', borderRadius: 6, padding: 2 }}>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  style={{
                    padding: '2px 6px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 4,
                    background: language === 'en' ? '#ffffff' : 'transparent',
                    color: language === 'en' ? '#1e3a8a' : '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('fil')}
                  style={{
                    padding: '2px 6px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 4,
                    background: language === 'fil' ? '#ffffff' : 'transparent',
                    color: language === 'fil' ? '#1e3a8a' : '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  FIL
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('ceb')}
                  style={{
                    padding: '2px 6px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 4,
                    background: language === 'ceb' ? '#ffffff' : 'transparent',
                    color: language === 'ceb' ? '#1e3a8a' : '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  CEB
                </button>
              </div>

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

          {/* Scope Notice Banner */}
          <div
            style={{
              padding: '6px 14px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              fontSize: '0.72rem',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Barangay Services & Complaint Assistant</span>
            <span style={{ fontWeight: 600, color: '#0284c7' }}>Poblacion Cordova</span>
          </div>

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
            {messages.map((m) => {
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
                      color: isAdmin ? '#059669' : isResident ? '#64748b' : '#1e3a8a',
                      marginBottom: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {isAdmin ? (
                      <>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }}></span>
                        <span>Official Barangay Admin Response</span>
                      </>
                    ) : isResident ? (
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
                      backgroundColor: isAdmin
                        ? '#ecfdf5'
                        : isResident
                        ? '#1e3a8a'
                        : '#ffffff',
                      color: isResident ? '#ffffff' : '#0f172a',
                      border: isAdmin
                        ? '1px solid #a7f3d0'
                        : isResident
                        ? 'none'
                        : '1px solid #e2e8f0',
                      boxShadow: isResident ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.04)',
                    }}
                  >
                    {m.text}

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

                    {/* Option to send message to admin */}
                    {m.canMessageAdmin && (
                      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (m.caseId) setTaggedCaseId(m.caseId);
                            setShowAdminComposer(true);
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
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                          </svg>
                          Message Barangay Admin
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

          {/* Admin Composer Drawer */}
          {showAdminComposer && (
            <div
              style={{
                padding: 12,
                backgroundColor: '#ffffff',
                borderTop: '2px solid #0284c7',
                boxShadow: '0 -4px 10px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                  Send Inquiry / Follow-up to Barangay Admin
                </span>
                <button
                  type="button"
                  onClick={() => setShowAdminComposer(false)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}
                >
                  Cancel
                </button>
              </div>

              {!token ? (
                <div style={{ fontSize: '0.78rem', color: '#b45309', background: '#fef3c7', padding: 8, borderRadius: 6, marginBottom: 8 }}>
                  Please sign in to your resident account to message the barangay administrator.
                </div>
              ) : (
                <form onSubmit={handleSendAdminMessage}>
                  {taggedCaseId && (
                    <div style={{ fontSize: '0.72rem', color: '#0284c7', marginBottom: 6, fontWeight: 600 }}>
                      Tagging Case Reference: #{taggedCaseId}
                    </div>
                  )}
                  <textarea
                    rows={3}
                    placeholder="Type your official question, clarification, or follow-up for the barangay admin..."
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '8px 10px',
                      fontSize: '0.82rem',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      resize: 'none',
                    }}
                    required
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button
                      type="submit"
                      disabled={sendingAdminMsg}
                      style={{
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: 6,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: sendingAdminMsg ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {sendingAdminMsg ? 'Sending...' : 'Send to Admin'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

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

          {/* Input Bar */}
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
              placeholder={
                language === 'fil'
                  ? 'Magtanong ukol sa serbisyo ng barangay...'
                  : language === 'ceb'
                  ? 'Pangutana mahitungod sa serbisyo sa barangay...'
                  : 'Ask about barangay services, clearance, complaints...'
              }
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
              aria-label="Send message"
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
        </div>
      )}
    </>
  );
}
