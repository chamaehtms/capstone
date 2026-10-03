import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

function formatMeetingDate(dateStr) {
  if (!dateStr) return 'Date not specified';
  const cleanStr = String(dateStr).split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  }
  return dateStr;
}

export default function MeetingMinutes() {
  const [meetings, setMeetings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'council' | 'mediation'
  const [searchQuery, setSearchQuery] = useState('');

  // Complaints list for mediation link dropdown
  const [complaints, setComplaints] = useState([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);

  // Registered residents list for mediation autofill (e.g. auto-populating email by resident name)
  const [registeredResidents, setRegisteredResidents] = useState([]);

  // Edit / Council Modal state
  const [isCouncilModalOpen, setIsCouncilModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('edit'); // 'edit' | 'create'
  const [saving, setSaving] = useState(false);
  const [resendingNotice, setResendingNotice] = useState(false);

  // Council meeting form
  const [form, setForm] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    attendees: [],
    absentees: [],
    mainTopics: [],
    concernsRaised: '',
    minutes: '',
    resolutions: [],
    actionItems: [],
    nextMeetingDate: '',
    nextMeetingTime: '',
    nextMeetingVenue: '',
    meetingType: 'council',
  });

  // Mediation meeting modal state
  const [isMediationModalOpen, setIsMediationModalOpen] = useState(false);
  const [mediationModalMode, setMediationModalMode] = useState('create'); // 'create' | 'edit'
  const [mediationForm, setMediationForm] = useState({
    title: '',
    date: '',
    time: '10:00 AM',
    location: 'Barangay Poblacion Mediation Hall / Session Room',
    caseId: '',
    residentName: '',
    residentEmail: '',
    respondentName: '',
    mediator: 'Hon. Roberto Cruz (Barangay Captain / Lupon Chairman)',
    hearingStage: '1st Mediation Hearing',
    mainTopics: ['Review of filed complaint and relief sought', 'Exploration of amicable settlement'],
    concernsRaised: '',
    resolutions: [],
    actionItems: [],
    nextMeetingDate: '',
    nextMeetingTime: '10:00 AM',
    nextMeetingVenue: 'Barangay Poblacion Mediation Hall',
    sendNotification: true,
  });

  const loadMeetings = async (selectId = null) => {
    try {
      setLoading(true);
      const res = await api.get('/meetings');
      setMeetings(res.data);
      if (selectId) {
        const found = res.data.find((m) => m.id === selectId);
        setSelected(found || null);
      } else {
        setSelected((prev) => (prev ? res.data.find((m) => m.id === prev.id) || null : null));
      }
    } catch (err) {
      console.error(err);
      setError('Unable to load meeting minutes.');
    } finally {
      setLoading(false);
    }
  };

  const loadComplaints = async () => {
    try {
      setLoadingComplaints(true);
      const res = await api.get('/complaints');
      setComplaints(res.data.complaints || []);
    } catch (err) {
      console.error('Failed to load complaints for mediation selector:', err);
    } finally {
      setLoadingComplaints(false);
    }
  };

  const loadResidents = async () => {
    try {
      const res = await api.get('/residents/all-directory');
      setRegisteredResidents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load residents for mediation autofill:', err);
    }
  };

  useEffect(() => {
    loadMeetings();
    loadComplaints();
    loadResidents();
  }, []);

  const councilCount = meetings.filter((m) => (m.meetingType || 'council') === 'council').length;
  const mediationCount = meetings.filter((m) => m.meetingType === 'mediation').length;

  const filteredMeetings = meetings.filter((m) => {
    if (filterType === 'council' && (m.meetingType || 'council') !== 'council') return false;
    if (filterType === 'mediation' && m.meetingType !== 'mediation') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (m.title || '').toLowerCase().includes(q);
      const matchCase = (m.caseId || '').toLowerCase().includes(q);
      const matchResident = (m.residentName || '').toLowerCase().includes(q);
      const matchRespondent = (m.respondentName || '').toLowerCase().includes(q);
      const matchLocation = (m.location || '').toLowerCase().includes(q);
      const matchDate = (m.date || '').toLowerCase().includes(q);
      return matchTitle || matchCase || matchResident || matchRespondent || matchLocation || matchDate;
    }
    return true;
  });

  // Open Edit modal for existing record
  const openEditModal = (meeting) => {
    if (meeting.meetingType === 'mediation') {
      setMediationModalMode('edit');
      setMediationForm({
        title: meeting.title || '',
        date: meeting.date ? String(meeting.date).split('T')[0] : '',
        time: meeting.time || '10:00 AM',
        location: meeting.location || 'Barangay Poblacion Mediation Hall',
        caseId: meeting.caseId || '',
        residentName: meeting.residentName || '',
        residentEmail: meeting.residentEmail || '',
        respondentName: meeting.respondentName || '',
        mediator: meeting.mediator || 'Hon. Roberto Cruz (Barangay Captain / Lupon Chairman)',
        hearingStage: meeting.hearingStage || '1st Mediation Hearing',
        mainTopics: Array.isArray(meeting.mainTopics) && meeting.mainTopics.length > 0 ? [...meeting.mainTopics] : ['Review of filed complaint and relief sought', 'Exploration of amicable settlement'],
        concernsRaised: meeting.concernsRaised || '',
        resolutions: Array.isArray(meeting.resolutions) ? meeting.resolutions.map((r) => ({ ...r })) : [],
        actionItems: Array.isArray(meeting.actionItems) ? meeting.actionItems.map((a) => ({ ...a })) : [],
        nextMeetingDate: meeting.nextMeetingDate ? String(meeting.nextMeetingDate).split('T')[0] : '',
        nextMeetingTime: meeting.nextMeetingTime || '',
        nextMeetingVenue: meeting.nextMeetingVenue || '',
        sendNotification: false,
      });
      setIsMediationModalOpen(true);
      return;
    }

    setModalMode('edit');
    setForm({
      title: meeting.title || '',
      date: meeting.date ? String(meeting.date).split('T')[0] : '',
      time: meeting.time || '',
      location: meeting.location || '',
      attendees: Array.isArray(meeting.attendees) ? [...meeting.attendees] : [],
      absentees: Array.isArray(meeting.absentees) ? [...meeting.absentees] : [],
      mainTopics: Array.isArray(meeting.mainTopics) && meeting.mainTopics.length > 0
        ? [...meeting.mainTopics]
        : (Array.isArray(meeting.agenda) ? [...meeting.agenda] : []),
      concernsRaised: meeting.concernsRaised || '',
      minutes: meeting.minutes || '',
      resolutions: Array.isArray(meeting.resolutions) ? meeting.resolutions.map((r) => ({ ...r })) : [],
      actionItems: Array.isArray(meeting.actionItems) ? meeting.actionItems.map((a) => ({ ...a })) : [],
      nextMeetingDate: meeting.nextMeetingDate ? String(meeting.nextMeetingDate).split('T')[0] : '',
      nextMeetingTime: meeting.nextMeetingTime || '',
      nextMeetingVenue: meeting.nextMeetingVenue || '',
      meetingType: 'council',
    });
    setIsCouncilModalOpen(true);
  };

  // Open Create Council Session modal
  const openCreateCouncilModal = () => {
    setModalMode('create');
    const today = new Date().toISOString().split('T')[0];
    setForm({
      title: 'Barangay Poblacion Council Regular Session',
      date: today,
      time: '02:00 PM - 04:30 PM',
      location: 'Barangay Poblacion Session Hall',
      attendees: ['Hon. Roberto Cruz (Barangay Captain)', 'Sec. Juan Santos (Barangay Secretary)'],
      absentees: [],
      mainTopics: ['Review of Quarterly Barangay Programs', 'Public Safety & Peace and Order Updates'],
      concernsRaised: '',
      minutes: '',
      resolutions: [{ id: `R${new Date().getFullYear()}-001`, title: 'Approval of Meeting Agenda', status: 'Approved' }],
      actionItems: [{ id: 'ACT-001', task: 'Follow up on project implementation', responsible: 'Barangay Secretary', deadline: '', status: 'Pending' }],
      nextMeetingDate: '',
      nextMeetingTime: '02:00 PM',
      nextMeetingVenue: 'Barangay Poblacion Session Hall',
      meetingType: 'council',
    });
    setIsCouncilModalOpen(true);
  };

  // Open Create Mediation Meeting modal
  const openScheduleMediationModal = () => {
    loadComplaints();
    loadResidents();
    setMediationModalMode('create');
    const today = new Date();
    today.setDate(today.getDate() + 2); // Default to 2 days ahead
    const defaultDate = today.toISOString().split('T')[0];

    setMediationForm({
      title: 'Lupong Tagapamayapa Mediation Hearing',
      date: defaultDate,
      time: '10:00 AM',
      location: 'Barangay Poblacion Mediation Hall / Session Room',
      caseId: '',
      residentName: '',
      residentEmail: '',
      respondentName: '',
      mediator: 'Hon. Roberto Cruz (Barangay Captain / Lupon Chairman)',
      hearingStage: '1st Mediation Hearing',
      mainTopics: ['Review of filed complaint and relief sought', 'Exploration of amicable settlement'],
      concernsRaised: '',
      resolutions: [],
      actionItems: [],
      nextMeetingDate: '',
      nextMeetingTime: '10:00 AM',
      nextMeetingVenue: 'Barangay Poblacion Mediation Hall',
      sendNotification: true,
    });
    setIsMediationModalOpen(true);
  };

  // When a complaint is chosen from dropdown in mediation modal
  const handleSelectComplaint = (caseId) => {
    if (!caseId) {
      setMediationForm((prev) => ({
        ...prev,
        caseId: '',
      }));
      return;
    }
    const found = complaints.find((c) => c.id === caseId);
    if (found) {
      // Find registered email from complaint, or matching registered resident (e.g. Kent)
      let email = found.residentEmail || '';
      if (!email && registeredResidents.length > 0) {
        const cResident = (found.resident || '').trim().toLowerCase();
        const matched = registeredResidents.find((r) => {
          const rName = (r.fullName || '').trim().toLowerCase();
          return (
            (found.filedByResidentId && r.id === found.filedByResidentId) ||
            rName === cResident ||
            rName.startsWith(cResident) ||
            rName.includes(cResident) ||
            cResident.includes(rName)
          );
        });
        if (matched && matched.email) email = matched.email;
      }

      setMediationForm((prev) => ({
        ...prev,
        caseId: found.id,
        title: `Mediation Hearing: ${found.category || 'Dispute'} (${found.id})`,
        residentName: found.resident || '',
        residentEmail: email || prev.residentEmail || '',
        respondentName: found.respondent || '',
        concernsRaised: found.description || found.narrative || '',
        mainTopics: [
          `Discussion of ${found.category || 'complaint'} filed by ${found.resident || 'complainant'}`,
          `Relief sought: ${found.reliefSought || 'Amicable settlement under KP law'}`,
        ],
      }));
    }
  };

  // When resident name is typed or selected directly in the mediation modal
  const handleResidentNameChange = (name) => {
    setMediationForm((prev) => {
      let email = prev.residentEmail;
      const cleanName = name.trim().toLowerCase();
      if (cleanName && registeredResidents.length > 0) {
        const matched = registeredResidents.find((r) => {
          const rName = (r.fullName || '').trim().toLowerCase();
          return rName === cleanName || rName.startsWith(cleanName) || rName.includes(cleanName) || cleanName.includes(rName);
        });
        if (matched && matched.email) {
          email = matched.email;
        }
      }
      return {
        ...prev,
        residentName: name,
        residentEmail: email,
      };
    });
  };

  // Save Council Session
  const handleSaveCouncil = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) {
      alert('Title and Date are required.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const payload = {
      title: form.title.trim(),
      date: form.date,
      time: form.time.trim(),
      location: form.location.trim() || 'Barangay Poblacion Session Hall',
      attendees: form.attendees.filter(Boolean),
      absentees: form.absentees.filter(Boolean),
      mainTopics: form.mainTopics.filter(Boolean),
      concernsRaised: form.concernsRaised.trim(),
      minutes: form.minutes.trim(),
      resolutions: form.resolutions.filter((r) => r.title.trim()),
      actionItems: form.actionItems.filter((a) => a.task.trim()),
      nextMeetingDate: form.nextMeetingDate || '',
      nextMeetingTime: form.nextMeetingTime.trim() || '',
      nextMeetingVenue: form.nextMeetingVenue.trim() || '',
      meetingType: 'council',
    };

    try {
      if (modalMode === 'edit' && selected) {
        const { data } = await api.put(`/meetings/${selected.id}`, payload);
        setMessage('Meeting minutes updated successfully.');
        setIsCouncilModalOpen(false);
        await loadMeetings(data.id);
      } else {
        const { data } = await api.post('/meetings', payload);
        setMessage('New council meeting record created successfully.');
        setIsCouncilModalOpen(false);
        await loadMeetings(data.id);
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Unable to save meeting minutes.');
    } finally {
      setSaving(false);
    }
  };

  // Save Mediation Meeting
  const handleSaveMediation = async (e) => {
    e.preventDefault();
    if (!mediationForm.title.trim() || !mediationForm.date) {
      alert('Title and Hearing Date are required.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const attendees = [
      mediationForm.residentName ? `${mediationForm.residentName} (Complainant)` : '',
      mediationForm.respondentName ? `${mediationForm.respondentName} (Respondent)` : '',
      mediationForm.mediator ? `${mediationForm.mediator} (Presiding Officer)` : '',
    ].filter(Boolean);

    const payload = {
      title: mediationForm.title.trim(),
      date: mediationForm.date,
      time: mediationForm.time.trim(),
      location: mediationForm.location.trim() || 'Barangay Poblacion Mediation Hall',
      attendees,
      absentees: [],
      mainTopics: mediationForm.mainTopics.filter(Boolean),
      concernsRaised: mediationForm.concernsRaised.trim(),
      minutes: '',
      resolutions: mediationForm.resolutions.filter((r) => r.title.trim()),
      actionItems: mediationForm.actionItems.filter((a) => a.task.trim()),
      nextMeetingDate: mediationForm.nextMeetingDate || '',
      nextMeetingTime: mediationForm.nextMeetingTime.trim() || '',
      nextMeetingVenue: mediationForm.nextMeetingVenue.trim() || '',
      meetingType: 'mediation',
      caseId: mediationForm.caseId || null,
      residentName: mediationForm.residentName || '',
      residentEmail: mediationForm.residentEmail.trim(),
      respondentName: mediationForm.respondentName || '',
      mediator: mediationForm.mediator || '',
      hearingStage: mediationForm.hearingStage || '1st Mediation Hearing',
      sendNotification: mediationForm.sendNotification,
    };

    try {
      const isExistingMediation = (mediationModalMode === 'edit' && selected) || (selected && selected.id && selected.meetingType === 'mediation');
      if (isExistingMediation) {
        const { data } = await api.put(`/meetings/${selected.id}`, payload);
        let msg = 'Mediation proceedings and record updated successfully.';
        if (data.nextEmailSent) {
          msg += ` Official Notice of Next Session sent to ${mediationForm.residentEmail || 'resident'} and user account notified.`;
        } else if (payload.nextMeetingDate && data.nextEmailError) {
          msg += ` (Next session notice: ${data.nextEmailError})`;
        }
        setMessage(msg);
        setIsMediationModalOpen(false);
        await loadMeetings(data.id);
      } else {
        const { data } = await api.post('/meetings', payload);
        let noticeMsg = 'Mediation meeting recorded successfully.';
        if (data.emailSent) {
          noticeMsg = `Mediation meeting scheduled and official notification email sent to ${mediationForm.residentEmail}!`;
        }
        if (data.nextEmailSent) {
          noticeMsg += ` Official Notice of Next Hearing also sent to Gmail & resident portal notified!`;
        }
        setMessage(noticeMsg);
        setIsMediationModalOpen(false);
        await loadMeetings(data.id);
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Unable to save mediation meeting.');
    } finally {
      setSaving(false);
    }
  };

  // Resend notice email
  const handleResendNotice = async (meetingId) => {
    setResendingNotice(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post(`/meetings/${meetingId}/resend-notification`);
      setMessage(data.message || 'Notification notice resent to resident.');
      await loadMeetings(meetingId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend notice email.');
    } finally {
      setResendingNotice(false);
    }
  };

  // Resend next session notice email
  const handleResendNextNotice = async (meetingId) => {
    setResendingNotice(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post(`/meetings/${meetingId}/resend-notification`, { type: 'next' });
      setMessage(data.message || 'Next session notification dispatched to resident.');
      await loadMeetings(meetingId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to dispatch next session notice email.');
    } finally {
      setResendingNotice(false);
    }
  };

  // Helpers for council form
  const addAttendee = () => setForm((f) => ({ ...f, attendees: [...f.attendees, ''] }));
  const updateAttendee = (idx, val) =>
    setForm((f) => {
      const arr = [...f.attendees];
      arr[idx] = val;
      return { ...f, attendees: arr };
    });
  const removeAttendee = (idx) =>
    setForm((f) => ({ ...f, attendees: f.attendees.filter((_, i) => i !== idx) }));

  const addAbsentee = () => setForm((f) => ({ ...f, absentees: [...f.absentees, ''] }));
  const updateAbsentee = (idx, val) =>
    setForm((f) => {
      const arr = [...f.absentees];
      arr[idx] = val;
      return { ...f, absentees: arr };
    });
  const removeAbsentee = (idx) =>
    setForm((f) => ({ ...f, absentees: f.absentees.filter((_, i) => i !== idx) }));

  const addTopic = () => setForm((f) => ({ ...f, mainTopics: [...f.mainTopics, ''] }));
  const updateTopic = (idx, val) =>
    setForm((f) => {
      const arr = [...f.mainTopics];
      arr[idx] = val;
      return { ...f, mainTopics: arr };
    });
  const removeTopic = (idx) =>
    setForm((f) => ({ ...f, mainTopics: f.mainTopics.filter((_, i) => i !== idx) }));

  const addResolution = () =>
    setForm((f) => ({
      ...f,
      resolutions: [
        ...f.resolutions,
        { id: `R${new Date().getFullYear()}-${String(f.resolutions.length + 1).padStart(3, '0')}`, title: '', status: 'Approved' },
      ],
    }));
  const updateResolution = (idx, field, val) =>
    setForm((f) => {
      const arr = [...f.resolutions];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...f, resolutions: arr };
    });
  const removeResolution = (idx) =>
    setForm((f) => ({ ...f, resolutions: f.resolutions.filter((_, i) => i !== idx) }));

  const addActionItem = () =>
    setForm((f) => ({
      ...f,
      actionItems: [
        ...f.actionItems,
        { id: `ACT-${String(f.actionItems.length + 1).padStart(3, '0')}`, task: '', responsible: '', deadline: '', status: 'In Progress' },
      ],
    }));
  const updateActionItem = (idx, field, val) =>
    setForm((f) => {
      const arr = [...f.actionItems];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...f, actionItems: arr };
    });
  const removeActionItem = (idx) =>
    setForm((f) => ({ ...f, actionItems: f.actionItems.filter((_, i) => i !== idx) }));

  // Helpers for mediation form
  const addMediationTopic = () => setMediationForm((f) => ({ ...f, mainTopics: [...f.mainTopics, ''] }));
  const updateMediationTopic = (idx, val) =>
    setMediationForm((f) => {
      const arr = [...f.mainTopics];
      arr[idx] = val;
      return { ...f, mainTopics: arr };
    });
  const removeMediationTopic = (idx) =>
    setMediationForm((f) => ({ ...f, mainTopics: f.mainTopics.filter((_, i) => i !== idx) }));

  const addMediationResolution = () =>
    setMediationForm((f) => ({
      ...f,
      resolutions: [
        ...f.resolutions,
        { id: `KP-${new Date().getFullYear()}-${String(f.resolutions.length + 1).padStart(3, '0')}`, title: '', status: 'Agreed' },
      ],
    }));
  const updateMediationResolution = (idx, field, val) =>
    setMediationForm((f) => {
      const arr = [...f.resolutions];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...f, resolutions: arr };
    });
  const removeMediationResolution = (idx) =>
    setMediationForm((f) => ({ ...f, resolutions: f.resolutions.filter((_, i) => i !== idx) }));

  const addMediationActionItem = () =>
    setMediationForm((f) => ({
      ...f,
      actionItems: [
        ...f.actionItems,
        { id: `ACT-${String(f.actionItems.length + 1).padStart(3, '0')}`, task: '', responsible: '', deadline: '', status: 'In Progress' },
      ],
    }));
  const updateMediationActionItem = (idx, field, val) =>
    setMediationForm((f) => {
      const arr = [...f.actionItems];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...f, actionItems: arr };
    });
  const removeMediationActionItem = (idx) =>
    setMediationForm((f) => ({ ...f, actionItems: f.actionItems.filter((_, i) => i !== idx) }));

  if (loading && meetings.length === 0) {
    return <p className="text-slate-500 py-8 text-center">Loading meeting records…</p>;
  }

  const isSelectedMediation = selected?.meetingType === 'mediation';

  return (
    <div className="space-y-6">
      {/* TOP HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          {selected ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                title="Back to all meetings list"
              >
                <span>←</span>
                <span>All Meetings</span>
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900 line-clamp-1">{selected.title}</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selected.meetingType === 'mediation' ? '⚖️ Mediation Hearing Record' : '🏛️ Council Session Minutes'} · {formatMeetingDate(selected.date)}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">Meeting Minutes & Mediation</h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Official Session Records
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">Barangay Poblacion Municipal System</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {selected && meetings.length > 1 && (
            <select
              value={selected.id}
              onChange={(e) => {
                const found = meetings.find((m) => m.id === e.target.value);
                if (found) setSelected(found);
              }}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[220px] truncate"
              title="Switch to another meeting"
            >
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.meetingType === 'mediation' ? '⚖️ ' : '🏛️ '}
                  {m.title} ({String(m.date).split('T')[0]})
                </option>
              ))}
            </select>
          )}

          {selected && (
            <button
              type="button"
              onClick={() => openEditModal(selected)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-xs"
            >
              <span>✏️</span>
              <span>Edit Record</span>
            </button>
          )}

          <button
            type="button"
            onClick={openScheduleMediationModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg transition-colors shadow-xs"
            title="Schedule a Katarungang Pambarangay mediation hearing and notify resident via email"
          >
            <span>⚖️</span>
            <span>Schedule Mediation Meeting</span>
          </button>

          <button
            type="button"
            onClick={openCreateCouncilModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors shadow-xs"
          >
            <span>➕</span>
            <span>Record Council Session</span>
          </button>

          {selected && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg transition shadow-xs"
              title="Print meeting minutes"
            >
              <span>🖨️</span>
              <span>Print</span>
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center justify-between">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} className="text-emerald-600 hover:text-emerald-900">✕</button>
        </div>
      )}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-red-600 hover:text-red-900">✕</button>
        </div>
      )}

      {/* WHEN NO MEETING IS CLICKED: DISPLAY DIRECTORY REPOSITORY */}
      {!selected ? (
        <div className="space-y-6">
          {/* STATS SUMMARY */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center text-xl font-bold border border-blue-100">
                📋
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{meetings.length}</div>
                <div className="text-xs text-slate-500 font-medium">Total Meeting Records</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center text-xl font-bold border border-purple-100">
                ⚖️
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{mediationCount}</div>
                <div className="text-xs text-slate-500 font-medium">Mediation Hearings (KP)</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-slate-50 text-slate-700 flex items-center justify-center text-xl font-bold border border-slate-200">
                🏛️
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{councilCount}</div>
                <div className="text-xs text-slate-500 font-medium">Council Regular Sessions</div>
              </div>
            </div>
          </div>

          {/* FILTER TABS & SEARCH */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterType === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Records ({meetings.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('council')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterType === 'council' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                🏛️ Council Sessions ({councilCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('mediation')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterType === 'mediation' ? 'bg-purple-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ⚖️ Mediation Hearings ({mediationCount})
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search meeting, case #, resident..."
                className="w-full sm:w-72 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 transition shadow-2xs"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* SESSIONS & HEARINGS DIRECTORY TABLE */}
          {filteredMeetings.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <span className="text-4xl mb-3 block">📋</span>
              <h2 className="text-lg font-bold text-slate-800">
                {meetings.length === 0 ? 'No meeting records found' : 'No records match your filter / search'}
              </h2>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                {meetings.length === 0
                  ? 'Record council sessions or schedule mediation hearings with automatic email notices to parties.'
                  : 'Try adjusting your search terms or clearing the filter.'}
              </p>
              <div className="flex items-center justify-center gap-3 mt-4">
                {meetings.length === 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={openScheduleMediationModal}
                      className="px-4 py-2 text-xs font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition shadow-xs"
                    >
                      ⚖️ Schedule Mediation Meeting
                    </button>
                    <button
                      type="button"
                      onClick={openCreateCouncilModal}
                      className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-xs"
                    >
                      Record Council Session
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setFilterType('all'); setSearchQuery(''); }}
                    className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                  >
                    Clear Filter & Search
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-400 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-300 flex items-center justify-between bg-slate-50/70">
                <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span>📂</span>
                  <span>Session & Hearing Directory ({filteredMeetings.length})</span>
                </h3>
                <span className="text-xs text-slate-600 hidden sm:inline">
                  Click any row to open the complete minutes & sections (1 to 7)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-xs">
                      <th className="py-3.5 px-4 border-r border-slate-300">Date & Time</th>
                      <th className="py-3.5 px-4 border-r border-slate-300">Title / Purpose</th>
                      <th className="py-3.5 px-4 border-r border-slate-300">Type & Stage</th>
                      <th className="py-3.5 px-4 border-r border-slate-300">Parties / Attendees</th>
                      <th className="py-3.5 px-4 border-r border-slate-300">Agreements / Actions</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {filteredMeetings.map((m) => {
                      const isMed = m.meetingType === 'mediation';
                      const agreementCount = Array.isArray(m.resolutions) ? m.resolutions.length : 0;
                      const actionCount = Array.isArray(m.actionItems) ? m.actionItems.length : 0;
                      return (
                        <tr
                          key={m.id}
                          onClick={() => setSelected(m)}
                          className="hover:bg-purple-50/40 cursor-pointer transition group"
                        >
                          <td className="py-4 px-4 whitespace-nowrap border-r border-slate-300">
                            <div className="font-bold text-sm text-slate-900">{formatMeetingDate(m.date)}</div>
                            <div className="text-xs text-slate-600 mt-1 flex items-center gap-1 font-medium">
                              <span>⏰</span> {m.time || '10:00 AM'}
                            </div>
                          </td>
                          <td className="py-4 px-4 border-r border-slate-300">
                            <div className="font-bold text-sm text-slate-900 group-hover:text-purple-700 transition">
                              {m.title}
                            </div>
                            <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-2">
                              <span>📍 {m.location || 'Barangay Session Hall'}</span>
                              {m.caseId && (
                                <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-300">
                                  Case #{m.caseId}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap border-r border-slate-300">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full font-semibold text-xs border ${
                              isMed
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              <span>{isMed ? '⚖️' : '🏛️'}</span>
                              <span>{isMed ? (m.hearingStage || 'Mediation Hearing') : 'Council Session'}</span>
                            </span>
                          </td>
                          <td className="py-4 px-4 border-r border-slate-300">
                            {isMed ? (
                              <div className="text-xs space-y-1">
                                <div className="font-medium text-slate-800">
                                  <span className="text-slate-400">Complainant:</span> {m.residentName || 'Complainant'}
                                </div>
                                <div className="font-medium text-slate-800">
                                  <span className="text-slate-400">Respondent:</span> {m.respondentName || 'Respondent'}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-slate-700">
                                <span className="font-semibold text-slate-800">{m.attendees?.length || 0} attendees</span>
                                {m.attendees?.[0] && <div className="text-slate-500 truncate max-w-[200px] mt-1">{m.attendees[0]}</div>}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap border-r border-slate-300">
                            <div className="flex flex-col gap-1.5 text-xs">
                              <span className={`font-semibold ${agreementCount > 0 ? 'text-purple-700' : 'text-slate-400'}`}>
                                ⚖️ {agreementCount} {isMed ? 'Agreements (KP-16)' : 'Resolutions'}
                              </span>
                              <span className={`font-semibold ${actionCount > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                ✅ {actionCount} {isMed ? 'Undertakings' : 'Action Items'}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelected(m);
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-200 transition shadow-2xs"
                            >
                              <span>👁️</span>
                              <span>View (1–6)</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* WHEN A MEETING IS CLICKED: DISPLAY PROCEEDINGS & MINUTES (SECTIONS 1 TO 7) */
        <div className="space-y-6">
          {/* Detail Back Navigation Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                <span>←</span>
                <span>Back to All Meetings</span>
              </button>
              <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                Viewing official record · Sections 1 to 7
              </span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => openEditModal(selected)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-2xs"
              >
                <span>✏️</span>
                <span>Edit Record</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg transition shadow-2xs"
              >
                <span>🖨️</span>
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* NOTIFICATION STATUS BANNER (for Mediation Meetings) */}
          {isSelectedMediation && (
            <div className={`rounded-xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              selected.notificationSent
                ? 'bg-purple-50/80 border-purple-200 text-purple-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selected.notificationSent ? '✉️' : '⚠️'}</span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    {selected.notificationSent ? 'Official Hearing Notice Dispatched' : 'Hearing Notice Pending'}
                  </h4>
                  <p className="text-xs mt-0.5">
                    {selected.notificationSent
                      ? `An official email summons notification was sent to ${selected.residentEmail || 'the complainant'}.`
                      : `Email notification has not been sent yet. (${selected.residentEmail ? `Recipient: ${selected.residentEmail}` : 'No email address registered for complainant'})`}
                  </p>
                </div>
              </div>

              {selected.residentEmail && (
                <button
                  type="button"
                  onClick={() => handleResendNotice(selected.id)}
                  disabled={resendingNotice}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition shadow-xs whitespace-nowrap self-start sm:self-auto disabled:opacity-50"
                >
                  {resendingNotice ? 'Sending…' : (selected.notificationSent ? 'Resend Notice Email' : 'Send Notice Email Now')}
                </button>
              )}
            </div>
          )}

          {/* SECTION 1: Date, Time & Venue Bar */}
          <div className={`bg-white rounded-xl shadow-sm p-6 border-l-4 ${isSelectedMediation ? 'border-purple-600' : 'border-blue-600'}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900">{selected.title}</h2>
                  <span className={`text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded ${
                    isSelectedMediation ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {isSelectedMediation ? `⚖️ ${selected.hearingStage || 'Mediation Hearing'}` : 'Official Council Session'}
                  </span>
                  {selected.caseId && (
                    <Link
                      to={`/complaints/${selected.caseId}`}
                      className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-blue-700 hover:underline"
                    >
                      Case #{selected.caseId}
                    </Link>
                  )}
                </div>

                {/* 1. Date, Time and Venue */}
                <div className="flex flex-wrap items-center gap-y-2 gap-x-6 mt-3 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="text-base text-blue-600">📅</span>
                    <span className="font-semibold text-slate-800">Date:</span>
                    <span>{formatMeetingDate(selected.date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base text-blue-600">⏰</span>
                    <span className="font-semibold text-slate-800">Time:</span>
                    <span>{selected.time || 'Not specified'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base text-blue-600">📍</span>
                    <span className="font-semibold text-slate-800">Venue:</span>
                    <span className="font-medium text-slate-900">{selected.location || 'Barangay Session Hall'}</span>
                  </div>
                  {isSelectedMediation && selected.mediator && (
                    <div className="flex items-center gap-2">
                      <span className="text-base text-purple-600">👤</span>
                      <span className="font-semibold text-slate-800">Mediator:</span>
                      <span className="font-medium text-slate-900">{selected.mediator}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(selected)}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                >
                  Edit Record
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 2: Attendees & Parties Involved */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span>👥</span>
              <span>2. {isSelectedMediation ? 'Parties to the Dispute & Lupon Attendance' : 'Council Attendance'}</span>
            </h3>

            {isSelectedMediation ? (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Complainant Card */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                      Complainant (Filing Party)
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      Notified
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <p className="font-bold text-slate-900 text-sm">{selected.residentName || 'Complainant'}</p>
                    {selected.residentEmail && (
                      <p className="text-slate-600 flex items-center gap-1.5">
                        <span>✉️</span>
                        <span>{selected.residentEmail}</span>
                      </p>
                    )}
                    {selected.caseId && (
                      <p className="text-slate-500">
                        Reference: <Link to={`/complaints/${selected.caseId}`} className="text-blue-600 hover:underline font-mono">{selected.caseId}</Link>
                      </p>
                    )}
                  </div>
                </div>

                {/* Respondent Card */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-600 inline-block"></span>
                      Respondent (Summoned Party)
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                      Summons Issued
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <p className="font-bold text-slate-900 text-sm">{selected.respondentName || 'Respondent not named'}</p>
                    <p className="text-slate-500 italic">
                      Notice of hearing dispatched for attendance under Katarungang Pambarangay rules.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Attendees Present */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      Attendees Present ({selected.attendees?.length || 0})
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      Quorum Established
                    </span>
                  </div>
                  {selected.attendees && selected.attendees.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selected.attendees.map((name, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 text-xs font-medium bg-white text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs"
                        >
                          <span className="text-slate-400">👤</span>
                          <span>{name}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No attendees recorded.</p>
                  )}
                </div>

                {/* Absentees / Excused */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                      Absentees / Excused ({selected.absentees?.length || 0})
                    </span>
                    {(!selected.absentees || selected.absentees.length === 0) && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                        100% Attendance
                      </span>
                    )}
                  </div>
                  {selected.absentees && selected.absentees.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selected.absentees.map((name, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 text-xs font-medium bg-white text-amber-900 border border-amber-200 px-3 py-1.5 rounded-lg shadow-2xs"
                        >
                          <span className="text-amber-500">⚠️</span>
                          <span>{name}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg p-2.5 text-center">
                      All expected council members and officers were present.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3 & 4: Main Topics Discussed & Important Points Raised */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* SECTION 3: Main Topics Discussed */}
            <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <span>📌</span>
                  <span>3. {isSelectedMediation ? 'Dispute Topics & Matter for Conciliation' : 'Main Topics Discussed'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => openEditModal(selected)}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  ✏️ Edit
                </button>
              </div>
              <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl p-4">
                {selected.mainTopics && selected.mainTopics.length > 0 ? (
                  <ol className="space-y-2.5 text-sm text-slate-700">
                    {selected.mainTopics.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="font-medium leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-slate-400 italic">No topics recorded.</p>
                    <button
                      type="button"
                      onClick={() => openEditModal(selected)}
                      className="mt-1 text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      + Add Topics
                    </button>
                  </div>
                )}
              </div>

              {selected.minutes && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                    Summary Notes / Remarks:
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed bg-white border border-slate-200 rounded-lg p-3">
                    {selected.minutes}
                  </p>
                </div>
              )}
            </div>

            {/* SECTION 4: Important Points or Concerns Raised */}
            <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <span>💬</span>
                  <span>4. {isSelectedMediation ? 'Salient Points & Parties Statements' : 'Important Points & Concerns Raised'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => openEditModal(selected)}
                  className="text-xs font-semibold text-amber-700 hover:underline"
                >
                  ✏️ Edit
                </button>
              </div>
              <div className="flex-1 bg-amber-50/50 border border-amber-200/80 rounded-xl p-4 flex flex-col">
                {selected.concernsRaised ? (
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line font-medium">
                    {selected.concernsRaised}
                  </p>
                ) : (
                  <div className="text-center my-auto py-6">
                    <span className="text-2xl text-amber-400 block mb-1">💡</span>
                    <p className="text-xs text-slate-500">
                      {isSelectedMediation ? 'No special statements or concerns recorded yet.' : 'No citizen petitions or critical concerns were raised during this session.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => openEditModal(selected)}
                      className="mt-2 text-xs font-semibold text-amber-700 hover:underline"
                    >
                      + Add Important Points / Statements
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 5: Decisions / Resolutions Made */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <span>⚖️</span>
                  <span>5. {isSelectedMediation ? 'Amicable Settlement Terms & Formal Agreements (KP Form 16)' : 'Decisions & Resolutions Made'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isSelectedMediation
                    ? 'Agreed terms signed by complainant and respondent under the auspices of the Lupong Tagapamayapa.'
                    : 'Official council acts, policies approved, and formal resolutions adopted during the session.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openEditModal(selected)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition"
              >
                <span>✏️</span>
                <span>{isSelectedMediation ? 'Edit / Add Agreements' : 'Edit Resolutions'}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-100 bg-slate-50/50">
                    <th className="py-2.5 px-3 font-semibold w-36">{isSelectedMediation ? 'AGREEMENT #' : 'RESOLUTION ID'}</th>
                    <th className="py-2.5 px-3 font-semibold">TITLE / DESCRIPTION</th>
                    <th className="py-2.5 px-3 font-semibold w-28 text-center">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.resolutions && selected.resolutions.length > 0 ? (
                    selected.resolutions.map((r, idx) => (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/60 transition">
                        <td className="py-3 px-3 font-mono text-xs font-bold text-purple-700">
                          {r.id || `KP-${new Date().getFullYear()}-${String(idx + 1).padStart(3, '0')}`}
                        </td>
                        <td className="py-3 px-3 text-slate-800 font-medium">
                          {r.title || r.description}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                              r.status === 'Approved' || r.status === 'Adopted' || r.status === 'Agreed'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : r.status === 'Pending' || r.status === 'Under Review'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {r.status || 'Agreed'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-xs text-slate-400 italic">
                        <p>{isSelectedMediation ? 'No amicable settlement terms recorded yet.' : 'No formal resolutions recorded for this session.'}</p>
                        <button
                          type="button"
                          onClick={() => openEditModal(selected)}
                          className="mt-2 text-xs font-semibold text-purple-700 hover:underline inline-flex items-center gap-1"
                        >
                          <span>+</span>
                          <span>{isSelectedMediation ? 'Record Amicable Settlement Terms (KP Form 16)' : 'Add Resolutions'}</span>
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 6: Action Items — Who is Responsible and the Deadline */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <span>✅</span>
                  <span>6. {isSelectedMediation ? 'Party Undertakings & Compliance Deadlines' : 'Action Items & Follow-ups'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isSelectedMediation
                    ? 'Assigned commitments, designated responsible persons, deadlines, and tracking status.'
                    : 'Assigned action items, responsible persons, deadlines, and tracking status.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openEditModal(selected)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
              >
                <span>✏️</span>
                <span>{isSelectedMediation ? 'Edit / Add Commitments' : 'Edit Action Items'}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-100 bg-slate-50/50">
                    <th className="py-2.5 px-3 font-semibold w-24">ITEM #</th>
                    <th className="py-2.5 px-3 font-semibold">ACTION ITEM / COMMITMENT</th>
                    <th className="py-2.5 px-3 font-semibold">RESPONSIBLE PERSON</th>
                    <th className="py-2.5 px-3 font-semibold w-36">DEADLINE</th>
                    <th className="py-2.5 px-3 font-semibold w-28 text-center">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.actionItems && selected.actionItems.length > 0 ? (
                    selected.actionItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/60 transition">
                        <td className="py-3 px-3 font-mono text-xs font-semibold text-slate-500">
                          {item.id || `ACT-${String(idx + 1).padStart(3, '0')}`}
                        </td>
                        <td className="py-3 px-3 text-slate-800 font-medium">{item.task}</td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-100">
                            <span>👤</span>
                            <span>{item.responsible || 'Unassigned'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs font-medium text-slate-600">
                          {item.deadline ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                              <span>📅</span>
                              <span>{formatMeetingDate(item.deadline)}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No deadline</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                              item.status === 'Completed'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : item.status === 'In Progress'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {item.status || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-slate-400 italic">
                        <p>{isSelectedMediation ? 'No party undertakings or compliance commitments recorded yet.' : 'No action items or commitments recorded for this meeting.'}</p>
                        <button
                          type="button"
                          onClick={() => openEditModal(selected)}
                          className="mt-2 text-xs font-semibold text-emerald-600 hover:underline inline-flex items-center gap-1"
                        >
                          <span>+</span>
                          <span>{isSelectedMediation ? 'Record Party Undertakings & Deadlines' : 'Add Action Items'}</span>
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 7: Next Meeting Date, If Already Scheduled */}
          <div className={`text-white rounded-xl shadow-md p-6 ${
            isSelectedMediation
              ? 'bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950'
              : 'bg-gradient-to-r from-blue-900 to-indigo-950'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                  <span>🗓️</span>
                  <span>7. {isSelectedMediation ? 'Next Mediation / Conciliation Session' : 'Next Council Meeting Schedule'}</span>
                </span>

                {selected.nextMeetingDate ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-bold text-white">
                        Next Session: {formatMeetingDate(selected.nextMeetingDate)}
                      </h4>
                      {selected.nextNotificationSent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/25 text-emerald-300 border border-emerald-400/40">
                          ✓ Notice Sent to Gmail & User Account
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/25 text-purple-200 border border-purple-400/30">
                          ✉️ Alerts Enabled
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-blue-200 flex flex-wrap items-center gap-x-4">
                      {selected.nextMeetingTime && <span>⏰ {selected.nextMeetingTime}</span>}
                      {selected.nextMeetingVenue && <span>📍 {selected.nextMeetingVenue}</span>}
                      {selected.residentEmail && <span>✉️ {selected.residentEmail}</span>}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-blue-200 mt-1 italic">
                    {isSelectedMediation
                      ? 'No follow-up hearing scheduled (matter resolved or pending amicable settlement).'
                      : 'The schedule for the next council meeting has not yet been designated.'}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selected.nextMeetingDate && selected.residentEmail && (
                  <button
                    type="button"
                    disabled={resendingNotice}
                    onClick={() => handleResendNextNotice(selected.id)}
                    className="px-3.5 py-2 text-xs font-semibold bg-purple-600/40 hover:bg-purple-600/60 text-white border border-purple-400/50 rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
                    title="Resend Next Hearing Notice to Resident's Gmail"
                  >
                    <span>✉️</span>
                    <span>{resendingNotice ? 'Dispatching…' : 'Resend Next Notice'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEditModal(selected)}
                  className="px-4 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg transition"
                >
                  {selected.nextMeetingDate ? 'Update Next Schedule' : '+ Schedule Next Session'}
                </button>
              </div>
            </div>
          </div>

          {/* BOTTOM BACK BUTTON */}
          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition shadow-2xs"
            >
              <span>←</span>
              <span>Back to Meeting Records Directory</span>
            </button>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              ↑ Back to Top
            </button>
          </div>
        </div>
      )}

      {/* SCHEDULE / EDIT MEDIATION MODAL */}
      {isMediationModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsMediationModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-purple-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <span>⚖️</span>
                  <span>{mediationModalMode === 'edit' ? 'Edit Mediation Hearing & Settlement Terms' : 'Schedule Katarungang Pambarangay Mediation Meeting'}</span>
                </h3>
                <p className="text-xs text-purple-200 mt-0.5">
                  {mediationModalMode === 'edit'
                    ? 'Record amicable settlement terms (KP Form 16), party undertakings, and hearing proceedings.'
                    : 'Sends an automated Notice of Hearing email and in-app notification to the complainant.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMediationModalOpen(false)}
                className="text-purple-300 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMediation} className="p-6 space-y-5 text-xs max-h-[82vh] overflow-y-auto">
              {/* Link to Complaint */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Link to Filed Complaint / Case Reference (Optional)
                </label>
                <select
                  value={mediationForm.caseId}
                  onChange={(e) => handleSelectComplaint(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-medium focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- Select from Active Complaints (Auto-fills info & email) --</option>
                  {complaints.map((c) => {
                    const matchedResident = registeredResidents.find((r) =>
                      (c.filedByResidentId && r.id === c.filedByResidentId) ||
                      r.fullName.toLowerCase().trim() === (c.resident || '').toLowerCase().trim()
                    );
                    const email = c.residentEmail || matchedResident?.email || '';
                    return (
                      <option key={c.id} value={c.id}>
                        {c.id} · {c.resident} vs {c.respondent || 'Respondent'} ({c.category}){email ? ` — ✉️ ${email}` : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Selecting a case automatically sets the title, complainant, email, and respondent info.
                </p>
              </div>

              {/* Title & Stage */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Meeting Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={mediationForm.title}
                    onChange={(e) => setMediationForm({ ...mediationForm, title: e.target.value })}
                    placeholder="e.g. Mediation Hearing: Boundary Dispute (BC-2024-001)"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-purple-500 font-medium"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Hearing Stage <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={mediationForm.hearingStage}
                    onChange={(e) => setMediationForm({ ...mediationForm, hearingStage: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs font-medium focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="1st Mediation Hearing">1st Mediation Hearing (KP Form 7)</option>
                    <option value="2nd Mediation Hearing">2nd Mediation Hearing</option>
                    <option value="3rd Mediation Hearing">3rd Mediation Hearing</option>
                    <option value="Conciliation Proceedings">Conciliation Proceedings (Pangkat Tagapagkasundo)</option>
                    <option value="Arbitration Session">Arbitration Session</option>
                  </select>
                </div>
              </div>

              {/* Date, Time, Venue & Mediator */}
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Hearing Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={mediationForm.date}
                    onChange={(e) => setMediationForm({ ...mediationForm, date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Time Window <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={mediationForm.time}
                    onChange={(e) => setMediationForm({ ...mediationForm, time: e.target.value })}
                    placeholder="e.g. 10:00 AM"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Presiding Mediator / Lupon Chair
                  </label>
                  <input
                    type="text"
                    value={mediationForm.mediator}
                    onChange={(e) => setMediationForm({ ...mediationForm, mediator: e.target.value })}
                    placeholder="Hon. Roberto Cruz"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Hearing Venue / Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={mediationForm.location}
                  onChange={(e) => setMediationForm({ ...mediationForm, location: e.target.value })}
                  placeholder="Barangay Poblacion Mediation Hall / Session Room"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Complainant & Respondent */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 block">
                      Complainant Name
                    </label>
                    <span className="text-[10px] text-purple-700 font-medium hidden sm:inline">
                      💡 Select or type registered resident (auto-fills email)
                    </span>
                  </div>
                  <input
                    type="text"
                    list="registered-residents-list"
                    value={mediationForm.residentName}
                    onChange={(e) => handleResidentNameChange(e.target.value)}
                    placeholder="e.g. Kent Manuel Ramero"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-purple-500 font-medium"
                  />
                  <datalist id="registered-residents-list">
                    {registeredResidents.map((r) => (
                      <option key={r.id} value={r.fullName}>
                        {r.fullName} ({r.email || 'No email registered'}) · {r.status}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Respondent Name
                  </label>
                  <input
                    type="text"
                    value={mediationForm.respondentName}
                    onChange={(e) => setMediationForm({ ...mediationForm, respondentName: e.target.value })}
                    placeholder="e.g. Pedro Santos"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-purple-500 font-medium"
                  />
                </div>
              </div>

              {/* Resident Email & Notification Notice */}
              <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-purple-900 block">
                      Complainant Email (Recipient of Official Notice)
                    </label>
                    {mediationForm.residentEmail && (
                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300">
                        ✓ Registered Email Auto-Populated
                      </span>
                    )}
                  </div>
                  <input
                    type="email"
                    value={mediationForm.residentEmail}
                    onChange={(e) => setMediationForm({ ...mediationForm, residentEmail: e.target.value })}
                    placeholder="resident@gmail.com"
                    className="w-full bg-white border border-purple-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-purple-500 font-medium"
                  />
                  <p className="text-[11px] text-purple-700 mt-1">
                    {mediationForm.residentEmail
                      ? `Official Notice of Hearing will be automatically emailed to ${mediationForm.residentEmail}.`
                      : 'Selecting a filed case or typing a registered resident (e.g. Kent) automatically puts their registered email here.'}
                  </p>
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mediationForm.sendNotification}
                    onChange={(e) => setMediationForm({ ...mediationForm, sendNotification: e.target.checked })}
                    className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <span className="font-bold text-purple-900 block">
                      ✉️ Send Official Hearing Notification Email to Resident upon Saving
                    </span>
                    <span className="text-[11px] text-purple-700 block mt-0.5 leading-relaxed">
                      Sends an official Notice of Mediation Hearing directly to the resident's email inbox with the scheduled date, time, venue, and instructions.
                    </span>
                  </div>
                </label>
              </div>

              {/* SECTION 3: Main Topics & Disputed Matters */}
              <div className="bg-purple-50/50 border border-purple-200/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-purple-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <span>📌</span> 3. Main Topics & Disputed Points Discussed ({mediationForm.mainTopics.length})
                  </h4>
                  <button
                    type="button"
                    onClick={addMediationTopic}
                    className="text-[11px] font-semibold text-purple-700 hover:text-purple-900"
                  >
                    + Add Topic
                  </button>
                </div>
                <div className="space-y-2">
                  {mediationForm.mainTopics.map((topic, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="font-bold text-slate-400 py-2 w-5 text-center">{i + 1}.</span>
                      <input
                        type="text"
                        value={topic}
                        onChange={(e) => updateMediationTopic(i, e.target.value)}
                        placeholder="Dispute agenda or matter discussed..."
                        className="flex-1 bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeMediationTopic(i)}
                        className="text-red-500 hover:text-red-700 px-2"
                        title="Remove topic"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 4: Important Points, Statements & Dispute Summary */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  💬 4. Important Points, Parties' Statements & Summary
                </label>
                <textarea
                  rows={3}
                  value={mediationForm.concernsRaised}
                  onChange={(e) => setMediationForm({ ...mediationForm, concernsRaised: e.target.value })}
                  placeholder="Record complainant statements, respondent reply, facts established, and mediator remarks..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* SECTION 5: Amicable Settlement Terms & Formal Agreements (KP Form 16) */}
              <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-purple-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <span>⚖️</span> 5. Amicable Settlement Terms & Formal Agreements (KP Form 16) ({mediationForm.resolutions.length})
                    </h4>
                    <p className="text-[11px] text-purple-700 mt-0.5">
                      Agreed terms signed by complainant and respondent under the auspices of the Lupong Tagapamayapa.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addMediationResolution}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-purple-700 text-white hover:bg-purple-800 shadow-xs transition"
                  >
                    <span>+</span>
                    <span>Add Agreement Clause</span>
                  </button>
                </div>

                {mediationForm.resolutions.length === 0 ? (
                  <div className="text-center py-4 bg-white/70 border border-dashed border-purple-200 rounded-lg">
                    <p className="text-xs text-slate-500 italic">No settlement terms recorded yet. Click "+ Add Agreement Clause" to record agreed covenants.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mediationForm.resolutions.map((r, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-purple-200 shadow-2xs">
                        <div className="col-span-3">
                          <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">AGREEMENT #</label>
                          <input
                            type="text"
                            value={r.id}
                            onChange={(e) => updateMediationResolution(i, 'id', e.target.value)}
                            placeholder="KP-2024-001"
                            className="w-full border border-slate-300 rounded p-1.5 text-xs font-mono font-bold text-purple-900"
                          />
                        </div>
                        <div className="col-span-6">
                          <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">TERMS / DESCRIPTION</label>
                          <input
                            type="text"
                            value={r.title}
                            onChange={(e) => updateMediationResolution(i, 'title', e.target.value)}
                            placeholder="e.g. Respondent agrees to pay ₱5,000 damages by end of month..."
                            className="w-full border border-slate-300 rounded p-1.5 text-xs"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">STATUS</label>
                          <select
                            value={r.status}
                            onChange={(e) => updateMediationResolution(i, 'status', e.target.value)}
                            className="w-full border border-slate-300 rounded p-1.5 text-xs font-medium"
                          >
                            <option value="Agreed">Agreed</option>
                            <option value="Adopted">Adopted</option>
                            <option value="Pending">Pending</option>
                            <option value="Under Review">Under Review</option>
                          </select>
                        </div>
                        <div className="col-span-1 text-center pt-3">
                          <button
                            type="button"
                            onClick={() => removeMediationResolution(i)}
                            className="text-red-500 hover:text-red-700 text-sm"
                            title="Remove clause"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION 6: Party Undertakings & Compliance Deadlines */}
              <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-purple-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <span>✅</span> 6. Party Undertakings & Compliance Deadlines ({mediationForm.actionItems.length})
                    </h4>
                    <p className="text-[11px] text-purple-700 mt-0.5">
                      Assigned commitments, designated responsible persons, deadlines, and tracking status.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addMediationActionItem}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-purple-700 text-white hover:bg-purple-800 shadow-xs transition"
                  >
                    <span>+</span>
                    <span>Add Commitment</span>
                  </button>
                </div>

                {mediationForm.actionItems.length === 0 ? (
                  <div className="text-center py-4 bg-white/70 border border-dashed border-purple-200 rounded-lg">
                    <p className="text-xs text-slate-500 italic">No commitments recorded yet. Click "+ Add Commitment" to specify actions and deadlines.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mediationForm.actionItems.map((a, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-purple-200 shadow-2xs">
                        <div className="col-span-2">
                          <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">ITEM #</label>
                          <input
                            type="text"
                            value={a.id}
                            onChange={(e) => updateMediationActionItem(i, 'id', e.target.value)}
                            placeholder="ACT-001"
                            className="w-full border border-slate-300 rounded p-1.5 text-xs font-mono font-medium"
                          />
                        </div>
                        <div className="col-span-4">
                          <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">COMMITMENT / OBLIGATION</label>
                          <input
                            type="text"
                            value={a.task}
                            onChange={(e) => updateMediationActionItem(i, 'task', e.target.value)}
                            placeholder="Specific task or undertaking..."
                            className="w-full border border-slate-300 rounded p-1.5 text-xs"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">RESPONSIBLE PERSON</label>
                          <input
                            type="text"
                            value={a.responsible}
                            onChange={(e) => updateMediationActionItem(i, 'responsible', e.target.value)}
                            placeholder="e.g. Respondent"
                            className="w-full border border-slate-300 rounded p-1.5 text-xs"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">DEADLINE</label>
                          <input
                            type="date"
                            value={a.deadline}
                            onChange={(e) => updateMediationActionItem(i, 'deadline', e.target.value)}
                            className="w-full border border-slate-300 rounded p-1.5 text-xs"
                          />
                        </div>
                        <div className="col-span-1">
                          <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">STATUS</label>
                          <select
                            value={a.status}
                            onChange={(e) => updateMediationActionItem(i, 'status', e.target.value)}
                            className="w-full border border-slate-300 rounded p-1.5 text-xs font-medium"
                          >
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </div>
                        <div className="col-span-1 text-center pt-3">
                          <button
                            type="button"
                            onClick={() => removeMediationActionItem(i)}
                            className="text-red-500 hover:text-red-700 text-sm"
                            title="Remove commitment"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION 7: Next Mediation / Conciliation Session */}
              <div className="bg-purple-50/50 border border-purple-200/80 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h4 className="font-bold text-purple-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <span>🗓️</span> 7. Next Hearing / Follow-up Session (Optional)
                  </h4>
                  {mediationForm.nextMeetingDate && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-purple-200/70 text-purple-900 self-start sm:self-auto">
                      ✉️ Gmail + Portal Alerts Active
                    </span>
                  )}
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Next Session Date</label>
                    <input
                      type="date"
                      value={mediationForm.nextMeetingDate}
                      onChange={(e) => setMediationForm({ ...mediationForm, nextMeetingDate: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Next Session Time</label>
                    <input
                      type="text"
                      value={mediationForm.nextMeetingTime}
                      onChange={(e) => setMediationForm({ ...mediationForm, nextMeetingTime: e.target.value })}
                      placeholder="e.g. 10:00 AM"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Next Session Venue</label>
                    <input
                      type="text"
                      value={mediationForm.nextMeetingVenue}
                      onChange={(e) => setMediationForm({ ...mediationForm, nextMeetingVenue: e.target.value })}
                      placeholder="Barangay Poblacion Mediation Hall"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-purple-100/70 border border-purple-200/80 text-purple-950 text-xs">
                  <span className="text-sm">✉️</span>
                  <span>
                    <strong>Automated Resident Notification:</strong> Specifying a Next Session schedule will automatically notify the resident's user account in-app and dispatch an official <strong>Notice of Next Mediation Session</strong> to their registered Gmail ({mediationForm.residentEmail || 'complainant'}).
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsMediationModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Saving Proceedings…' : (mediationModalMode === 'edit' ? 'Update Mediation Record' : 'Schedule Mediation Meeting')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL COUNCIL SESSION MODAL */}
      {isCouncilModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsCouncilModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <span>🏛️</span>
                  <span>{modalMode === 'edit' ? 'Edit Council Meeting Minutes' : 'Record New Council Session'}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Barangay Poblacion Municipal System</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCouncilModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCouncil} className="p-6 space-y-6 text-xs max-h-[80vh] overflow-y-auto">
              {/* SECTION 1 Form */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span>📅</span> 1. Session Information
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">
                      Session Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Barangay Poblacion Council Regular Session"
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Time</label>
                    <input
                      type="text"
                      value={form.time}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                      placeholder="02:00 PM - 04:30 PM"
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">Venue / Location</label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      placeholder="Barangay Poblacion Session Hall"
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2 Form: Attendance */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span>👥</span> 2. Attendance (Quorum & Absentees)
                </h4>
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Attendees */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-semibold text-slate-700">Attendees Present ({form.attendees.length})</label>
                      <button
                        type="button"
                        onClick={addAttendee}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                      >
                        + Add Attendee
                      </button>
                    </div>
                    <div className="space-y-2">
                      {form.attendees.map((name, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => updateAttendee(i, e.target.value)}
                            placeholder="Council Member / Officer"
                            className="flex-1 border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => removeAttendee(i)}
                            className="text-red-500 hover:text-red-700 px-2"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Absentees */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-semibold text-slate-700">Absentees / Excused ({form.absentees.length})</label>
                      <button
                        type="button"
                        onClick={addAbsentee}
                        className="text-[11px] font-semibold text-amber-600 hover:text-amber-800"
                      >
                        + Add Absentee
                      </button>
                    </div>
                    <div className="space-y-2">
                      {form.absentees.map((name, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => updateAbsentee(i, e.target.value)}
                            placeholder="Absent Member"
                            className="flex-1 border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => removeAbsentee(i)}
                            className="text-red-500 hover:text-red-700 px-2"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3 Form: Main Topics */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <span>📌</span> 3. Main Topics Discussed ({form.mainTopics.length})
                  </h4>
                  <button
                    type="button"
                    onClick={addTopic}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                  >
                    + Add Topic
                  </button>
                </div>
                <div className="space-y-2">
                  {form.mainTopics.map((topic, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="font-bold text-slate-400 py-2 w-5 text-center">{i + 1}.</span>
                      <input
                        type="text"
                        value={topic}
                        onChange={(e) => updateTopic(i, e.target.value)}
                        placeholder="Agenda or discussed topic..."
                        className="flex-1 border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeTopic(i)}
                        className="text-red-500 hover:text-red-700 px-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1 mt-3">Summary Meeting Notes / Minutes Narrative</label>
                  <textarea
                    rows={3}
                    value={form.minutes}
                    onChange={(e) => setForm({ ...form, minutes: e.target.value })}
                    placeholder="Detailed summary notes of the session proceedings..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* SECTION 4 Form: Concerns Raised */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span>💬</span> 4. Important Points & Concerns Raised
                </h4>
                <textarea
                  rows={3}
                  value={form.concernsRaised}
                  onChange={(e) => setForm({ ...form, concernsRaised: e.target.value })}
                  placeholder="Citizen petitions, resident inquiries, floor debates, or critical concerns raised during the meeting..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* SECTION 5 Form: Resolutions */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <span>⚖️</span> 5. Decisions & Resolutions Made ({form.resolutions.length})
                  </h4>
                  <button
                    type="button"
                    onClick={addResolution}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                  >
                    + Add Resolution
                  </button>
                </div>
                <div className="space-y-2">
                  {form.resolutions.map((r, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={r.id}
                          onChange={(e) => updateResolution(i, 'id', e.target.value)}
                          placeholder="R2024-001"
                          className="w-full border border-slate-300 rounded p-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                      <div className="col-span-6">
                        <input
                          type="text"
                          value={r.title}
                          onChange={(e) => updateResolution(i, 'title', e.target.value)}
                          placeholder="Resolution title / approved decision..."
                          className="w-full border border-slate-300 rounded p-1.5 text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <select
                          value={r.status}
                          onChange={(e) => updateResolution(i, 'status', e.target.value)}
                          className="w-full border border-slate-300 rounded p-1.5 text-xs font-medium"
                        >
                          <option value="Approved">Approved</option>
                          <option value="Adopted">Adopted</option>
                          <option value="Pending">Pending</option>
                          <option value="Under Review">Under Review</option>
                        </select>
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeResolution(i)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 6 Form: Action Items */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <span>✅</span> 6. Action Items & Follow-ups ({form.actionItems.length})
                  </h4>
                  <button
                    type="button"
                    onClick={addActionItem}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                  >
                    + Add Action Item
                  </button>
                </div>
                <div className="space-y-2">
                  {form.actionItems.map((a, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={a.id}
                          onChange={(e) => updateActionItem(i, 'id', e.target.value)}
                          placeholder="ACT-001"
                          className="w-full border border-slate-300 rounded p-1.5 text-xs font-mono font-medium"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={a.task}
                          onChange={(e) => updateActionItem(i, 'task', e.target.value)}
                          placeholder="Task description..."
                          className="w-full border border-slate-300 rounded p-1.5 text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={a.responsible}
                          onChange={(e) => updateActionItem(i, 'responsible', e.target.value)}
                          placeholder="Responsible person"
                          className="w-full border border-slate-300 rounded p-1.5 text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="date"
                          value={a.deadline}
                          onChange={(e) => updateActionItem(i, 'deadline', e.target.value)}
                          className="w-full border border-slate-300 rounded p-1.5 text-xs"
                        />
                      </div>
                      <div className="col-span-1">
                        <select
                          value={a.status}
                          onChange={(e) => updateActionItem(i, 'status', e.target.value)}
                          className="w-full border border-slate-300 rounded p-1.5 text-xs font-medium"
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeActionItem(i)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 7 Form: Next Meeting Schedule */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span>🗓️</span> 7. Next Meeting Schedule (If Already Scheduled)
                </h4>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Next Meeting Date</label>
                    <input
                      type="date"
                      value={form.nextMeetingDate}
                      onChange={(e) => setForm({ ...form, nextMeetingDate: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Time</label>
                    <input
                      type="text"
                      value={form.nextMeetingTime}
                      onChange={(e) => setForm({ ...form, nextMeetingTime: e.target.value })}
                      placeholder="02:00 PM"
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Venue</label>
                    <input
                      type="text"
                      value={form.nextMeetingVenue}
                      onChange={(e) => setForm({ ...form, nextMeetingVenue: e.target.value })}
                      placeholder="Barangay Session Hall"
                      className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCouncilModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Saving…' : (modalMode === 'edit' ? 'Update Meeting Minutes' : 'Save Meeting Record')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
