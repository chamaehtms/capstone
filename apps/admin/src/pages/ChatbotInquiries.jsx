import React, { useEffect, useState } from 'react';
import api from '../api';
import AdminIcon from '../components/AdminIcons.jsx';

export default function ChatbotInquiries() {
  const [activeTab, setActiveTab] = useState('messages'); // 'messages' | 'knowledge' | 'unanswered'
  const [messages, setMessages] = useState([]);
  const [knowledgeList, setKnowledgeList] = useState([]);
  const [unansweredLogs, setUnansweredLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Messaging state
  const [selectedResidentId, setSelectedResidentId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Knowledge base modal state
  const [isKbModalOpen, setIsKbModalOpen] = useState(false);
  const [kbMode, setKbMode] = useState('add'); // 'add' | 'edit'
  const [kbForm, setKbForm] = useState({
    id: '',
    category: 'clearance',
    title: '',
    keywords: '',
    answerEn: '',
    answerFil: '',
    answerCeb: '',
    isActive: true,
  });
  const [savingKb, setSavingKb] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ type: '', text: '' });

  // Load data based on active tab
  const loadMessages = async () => {
    try {
      const res = await api.get('/chatbot/messages');
      const allMsgs = res.data || [];
      setMessages(allMsgs);
      if (!selectedResidentId && allMsgs.length > 0) {
        setSelectedResidentId(allMsgs[0].resident_id);
      }
    } catch (err) {
      console.warn('Error loading chatbot messages:', err);
    }
  };

  // When admin selects or views a resident thread, mark unread messages as read
  useEffect(() => {
    if (!selectedResidentId) return;
    const hasUnread = messages.some(
      (m) => m.resident_id === selectedResidentId && !m.read_by_admin && m.sender_role === 'resident'
    );
    if (!hasUnread) return;

    api.put(`/chatbot/messages/read-by-admin/${selectedResidentId}`)
      .then(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.resident_id === selectedResidentId && m.sender_role === 'resident'
              ? { ...m, read_by_admin: true }
              : m
          )
        );
      })
      .catch((err) => console.warn('Could not mark thread as read:', err));
  }, [selectedResidentId, messages]);

  const loadKnowledge = async () => {
    try {
      const res = await api.get('/chatbot/knowledge');
      setKnowledgeList(res.data || []);
    } catch (err) {
      console.warn('Error loading knowledge base:', err);
    }
  };

  const loadUnanswered = async () => {
    try {
      const res = await api.get('/chatbot/unanswered');
      setUnansweredLogs(res.data || []);
    } catch (err) {
      console.warn('Error loading unanswered logs:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadMessages(), loadKnowledge(), loadUnanswered()]).finally(() => {
      setLoading(false);
    });
  }, []);

  // Group messages by resident_id
  const residentThreads = {};
  messages.forEach((m) => {
    if (!residentThreads[m.resident_id]) {
      residentThreads[m.resident_id] = {
        residentId: m.resident_id,
        residentName: m.resident_name || 'Resident',
        residentEmail: m.resident_email,
        messages: [],
        unreadCount: 0,
        latestDate: m.created_at,
      };
    }
    residentThreads[m.resident_id].messages.push(m);
    if (!m.read_by_admin && m.sender_role === 'resident') {
      residentThreads[m.resident_id].unreadCount += 1;
    }
    residentThreads[m.resident_id].latestDate = m.created_at;
  });

  const activeThread = selectedResidentId ? residentThreads[selectedResidentId] : null;

  // Send admin reply to resident
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedResidentId) return;

    setSendingReply(true);
    setFeedbackMsg({ type: '', text: '' });
    try {
      await api.post('/chatbot/admin-reply', {
        residentId: selectedResidentId,
        message: replyText.trim(),
        caseId: activeThread?.messages?.find((m) => m.case_id)?.case_id || null,
      });

      setReplyText('');
      setFeedbackMsg({ type: 'success', text: 'Official reply dispatched to resident.' });
      await loadMessages();
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.response?.data?.message || 'Failed to dispatch reply.' });
    } finally {
      setSendingReply(false);
    }
  };

  // Open Knowledge Base Modal
  const openAddKb = (initialTitle = '') => {
    setKbMode('add');
    setKbForm({
      id: '',
      category: 'clearance',
      title: initialTitle,
      keywords: '',
      answerEn: '',
      answerFil: '',
      answerCeb: '',
      isActive: true,
    });
    setIsKbModalOpen(true);
  };

  const openEditKb = (item) => {
    setKbMode('edit');
    const kw = Array.isArray(item.keywords) ? item.keywords.join(', ') : '';
    setKbForm({
      id: item.id,
      category: item.category,
      title: item.title,
      keywords: kw,
      answerEn: item.answer_en || '',
      answerFil: item.answer_fil || '',
      answerCeb: item.answer_ceb || '',
      isActive: item.is_active,
    });
    setIsKbModalOpen(true);
  };

  const handleSaveKb = async (e) => {
    e.preventDefault();
    setSavingKb(true);
    setFeedbackMsg({ type: '', text: '' });

    const kwArray = kbForm.keywords
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (kbMode === 'add') {
        await api.post('/chatbot/knowledge', {
          category: kbForm.category,
          title: kbForm.title.trim(),
          keywords: kwArray,
          answerEn: kbForm.answerEn.trim(),
          answerFil: kbForm.answerFil ? kbForm.answerFil.trim() : null,
          answerCeb: kbForm.answerCeb ? kbForm.answerCeb.trim() : null,
        });
        setFeedbackMsg({ type: 'success', text: 'Knowledge base entry created.' });
      } else {
        await api.put(`/chatbot/knowledge/${kbForm.id}`, {
          category: kbForm.category,
          title: kbForm.title.trim(),
          keywords: kwArray,
          answerEn: kbForm.answerEn.trim(),
          answerFil: kbForm.answerFil ? kbForm.answerFil.trim() : null,
          answerCeb: kbForm.answerCeb ? kbForm.answerCeb.trim() : null,
          isActive: kbForm.isActive,
        });
        setFeedbackMsg({ type: 'success', text: 'Knowledge base entry updated.' });
      }
      setIsKbModalOpen(false);
      await loadKnowledge();
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save knowledge item.' });
    } finally {
      setSavingKb(false);
    }
  };

  const handleDeleteKb = async (id, title) => {
    if (!window.confirm(`Delete "${title}" from the chatbot knowledge base?`)) return;
    try {
      await api.delete(`/chatbot/knowledge/${id}`);
      setFeedbackMsg({ type: 'success', text: 'Knowledge entry deleted.' });
      await loadKnowledge();
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: 'Failed to delete knowledge entry.' });
    }
  };

  const handleResolveUnanswered = async (id) => {
    try {
      await api.put(`/chatbot/unanswered/${id}`, { status: 'resolved' });
      await loadUnanswered();
    } catch (err) {
      console.warn('Error resolving log:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI Assistant & Resident Inquiries</h1>
          <p className="text-sm text-slate-500">
            Manage official chatbot knowledge records, respond to resident inquiries, and review logged questions.
          </p>
        </div>

        {activeTab === 'knowledge' && (
          <button
            type="button"
            onClick={() => openAddKb()}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors shadow-xs"
          >
            <AdminIcon name="document" size={16} />
            <span>Add Knowledge Item</span>
          </button>
        )}
      </div>

      {feedbackMsg.text && (
        <div
          className={`p-3 rounded-lg text-sm font-medium ${
            feedbackMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('messages')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'messages'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AdminIcon name="chat" size={16} />
          <span>Resident Inquiries</span>
          {Object.values(residentThreads).reduce((acc, t) => acc + t.unreadCount, 0) > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {Object.values(residentThreads).reduce((acc, t) => acc + t.unreadCount, 0)}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('knowledge')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'knowledge'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AdminIcon name="document" size={16} />
          <span>Chatbot Knowledge Base ({knowledgeList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('unanswered')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'unanswered'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AdminIcon name="warning" size={16} />
          <span>Unanswered Inquiries ({unansweredLogs.filter((l) => l.status === 'pending_review').length})</span>
        </button>
      </div>

      {/* TAB 1: RESIDENT INQUIRIES & MESSAGING */}
      {activeTab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs min-h-[520px]">
          {/* Thread List */}
          <div className="lg:col-span-4 border-r border-slate-200 flex flex-col">
            <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
              Resident Message Threads ({Object.keys(residentThreads).length})
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {Object.keys(residentThreads).length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No resident messages received yet.</div>
              ) : (
                Object.values(residentThreads).map((t) => {
                  const isSelected = selectedResidentId === t.residentId;
                  const latestMsg = t.messages[t.messages.length - 1];
                  return (
                    <div
                      key={t.residentId}
                      onClick={() => setSelectedResidentId(t.residentId)}
                      className={`p-3.5 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-sm">{t.residentName}</span>
                        {t.unreadCount > 0 && (
                          <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                            {t.unreadCount} new
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">{latestMsg?.message || 'Inquiry'}</p>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        {new Date(t.latestDate).toLocaleDateString()} {new Date(t.latestDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Conversation & Reply Pane */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            {activeThread ? (
              <>
                {/* Thread Header */}
                <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{activeThread.residentName}</h3>
                    <p className="text-xs text-slate-500">{activeThread.residentEmail || 'Barangay Poblacion Constituent'}</p>
                  </div>
                  {activeThread.messages.find((m) => m.case_id) && (
                    <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                      Case #{activeThread.messages.find((m) => m.case_id)?.case_id}
                    </span>
                  )}
                </div>

                {/* Messages Box */}
                <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-slate-50/40">
                  {activeThread.messages.map((m) => {
                    const isAdmin = m.sender_role === 'admin';
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                      >
                        <span className="text-[10px] font-semibold text-slate-400 mb-1">
                          {isAdmin ? 'Official Admin Response' : activeThread.residentName} •{' '}
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div
                          className={`max-w-[80%] p-3 rounded-xl text-sm ${
                            isAdmin
                              ? 'bg-blue-600 text-white rounded-br-none shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-900 rounded-bl-none shadow-xs'
                          }`}
                        >
                          {m.message}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Composer */}
                <form onSubmit={handleSendReply} className="p-3.5 border-t border-slate-200 bg-white flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Type official admin reply to constituent..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={sendingReply}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
                  >
                    {sendingReply ? 'Sending...' : 'Reply'}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-sm">
                Select a message thread to view constituent conversation.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CHATBOT KNOWLEDGE BASE */}
      {activeTab === 'knowledge' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {knowledgeList.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {item.category}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.is_active ? 'Active' : 'Draft'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-2">{item.title}</h3>
                  <p className="text-xs text-slate-600 line-clamp-4 leading-relaxed mb-3">
                    {item.answer_en}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    {Array.isArray(item.keywords) ? item.keywords.length : 0} keywords indexed
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditKb(item)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 rounded transition-colors"
                      title="Edit Entry"
                    >
                      <AdminIcon name="edit" size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteKb(item.id, item.title)}
                      className="p-1.5 text-slate-500 hover:text-red-600 rounded transition-colors"
                      title="Delete Entry"
                    >
                      <AdminIcon name="close" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: UNANSWERED INQUIRIES LOGS */}
      {activeTab === 'unanswered' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-800">Constituent Queries Without Verified Knowledge Matches</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review what citizens are asking about to continuously update and expand Barangay Poblacion's official knowledge base.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {unansweredLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No unanswered questions logged.</div>
            ) : (
              unansweredLogs.map((log) => (
                <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900 text-sm">"{log.query}"</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          log.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Asked by: {log.resident_name || 'Resident'} • Lang: {log.language?.toUpperCase() || 'EN'} •{' '}
                      {new Date(log.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openAddKb(log.query)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <AdminIcon name="document" size={13} />
                      <span>Create KB Entry</span>
                    </button>
                    {log.status !== 'resolved' && (
                      <button
                        type="button"
                        onClick={() => handleResolveUnanswered(log.id)}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Knowledge Modal */}
      {isKbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {kbMode === 'add' ? 'Add Official Knowledge Entry' : 'Edit Knowledge Entry'}
              </h3>
              <button
                type="button"
                onClick={() => setIsKbModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <AdminIcon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveKb} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    value={kbForm.category}
                    onChange={(e) => setKbForm({ ...kbForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="clearance">Clearances & Permits</option>
                    <option value="complaints">Complaints & Mediation</option>
                    <option value="officials_hours">Officials & Office Hours</option>
                    <option value="waste_peace_order">Waste & Peace/Order</option>
                    <option value="certificates">Certificates & Indigency</option>
                    <option value="general_faq">General FAQs</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={kbForm.isActive ? 'true' : 'false'}
                    onChange={(e) => setKbForm({ ...kbForm, isActive: e.target.value === 'true' })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="true">Active (Live in Chatbot)</option>
                    <option value="false">Draft (Disabled)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Topic Title *
                </label>
                <input
                  type="text"
                  required
                  value={kbForm.title}
                  onChange={(e) => setKbForm({ ...kbForm, title: e.target.value })}
                  placeholder="e.g. Barangay Clearance Requirements"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Trigger Keywords (Comma-separated)
                </label>
                <input
                  type="text"
                  value={kbForm.keywords}
                  onChange={(e) => setKbForm({ ...kbForm, keywords: e.target.value })}
                  placeholder="clearance, certificate, cedula, fees, requirements"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Verified Response (English) *
                </label>
                <textarea
                  rows={4}
                  required
                  value={kbForm.answerEn}
                  onChange={(e) => setKbForm({ ...kbForm, answerEn: e.target.value })}
                  placeholder="Official procedure, requirements, fees, and office location in English..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Verified Response (Filipino / Tagalog)
                </label>
                <textarea
                  rows={3}
                  value={kbForm.answerFil}
                  onChange={(e) => setKbForm({ ...kbForm, answerFil: e.target.value })}
                  placeholder="Opisyal na paliwanag sa Filipino..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Verified Response (Cebuano / Bisaya)
                </label>
                <textarea
                  rows={3}
                  value={kbForm.answerCeb}
                  onChange={(e) => setKbForm({ ...kbForm, answerCeb: e.target.value })}
                  placeholder="Opisyal nga tubag sa Cebuano/Bisaya..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsKbModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingKb}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  {savingKb ? 'Saving...' : 'Save Knowledge Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
