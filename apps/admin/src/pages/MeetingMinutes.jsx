import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Video,
  Paperclip,
  Upload,
  UserCheck,
  UserPlus,
  MinusCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Bell,
  Search,
  Info,
  CheckCircle2,
  Edit3,
  Trash2,
  Printer,
  Share2,
  ShieldCheck,
  AlertTriangle,
  PenTool,
  Download,
  Users,
  Building2,
  X,
  Plus,
  ArrowLeft,
  Scale
} from 'lucide-react';
import api from '../api';

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const cleanStr = String(dateStr).split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }
  return dateStr;
}

export default function MeetingMinutes() {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'schedule' | 'minutes'
  const [meetings, setMeetings] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'Scheduled' | 'Settled' | 'Pending'
  const [deletingId, setDeletingId] = useState(null);

  // Selected existing mediation or active drafting state
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [referenceCase, setReferenceCase] = useState({
    id: 'CMP-2024-001',
    title: 'Formal dispute resolution',
    category: 'Property & Boundary Dispute'
  });

  // Calendar State
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState(now.getDate());

  // Logistics & Schedule
  const [sessionStartTime, setSessionStartTime] = useState('02:00 PM');
  const [duration, setDuration] = useState('60 Minutes');
  const [logisticalFormat, setLogisticalFormat] = useState('in-person'); // 'in-person' | 'virtual'
  const [facility, setFacility] = useState('Barangay Poblacion Mediation Hall, Level 2');
  const [virtualLink, setVirtualLink] = useState('https://brgy-poblacion.site/room/CMP-2024-001');
  const [primaryObjectives, setPrimaryObjectives] = useState(
    '1. Formal inquiry into neighbor boundary noise & encroachment dispute.\n2. Review photographic evidence of setback line compliance.\n3. Establish amicably agreed quiet hours and remedial fencing arrangement.'
  );
  const [uploadedFiles, setUploadedFiles] = useState([
    'Survey_Map_Boundary_Exhibit_A.pdf',
    'CCTV_Timestamp_AudioLogs.jpeg'
  ]);
  const [isUploading, setIsUploading] = useState(false);

  // Participants State
  const [participants, setParticipants] = useState([
    {
      id: 'p1',
      name: 'Elena Rodriguez',
      role: 'COMPLAINANT',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      present: true,
      signed: true,
      statement: 'Respondent continues loud machinery operation past 10:00 PM and constructed an unauthorized perimeter awning extending over the shared property line.'
    },
    {
      id: 'p2',
      name: 'Marcus Thorne',
      role: 'RESPONDENT',
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
      present: true,
      signed: false,
      statement: 'Work was necessary for structural reinforcement following storm damages. Agreeable to restricting generator use to 8:00 AM - 6:00 PM and trimming the overhang.'
    }
  ]);

  const [assignedMediator, setAssignedMediator] = useState({
    name: 'Hon. Arthur Pendelton',
    title: 'Certified Lupon Tagapamayapa / Accredited Neutral Mediator',
    license: 'MED-NCR-2024-914',
    signed: true
  });
  const [showMediatorModal, setShowMediatorModal] = useState(false);
  const [showCaseSelectorModal, setShowCaseSelectorModal] = useState(false);

  // Minutes State (Tab 2)
  const [minutesData, setMinutesData] = useState({
    hearingNumber: '1st Official Hearing',
    commencedAt: '02:08 PM',
    adjournedAt: '03:15 PM',
    presidingOfficer: 'Hon. Arthur Pendelton (Lupon Head)',
    recordingSecretary: 'Barangay Secretary',
    discussionSummary: 'Both parties demonstrated willingness to find common ground. Complainant highlighted persistent disturbance of minor children during school evenings. Respondent presented repair permit and acknowledged boundary error without willful malice.',
    termsList: [
      'Respondent shall halt all loud power equipment and generator operations strictly after 6:00 PM daily.',
      'Perimeter awning overhang of 1.2 meters shall be retrofitted and recessed back within legal setback by scheduled completion date.',
      'Complainant agrees to dismiss complaint formal escalation pending municipal inspection on scheduled completion date.',
      'Both parties commit to direct barangay notification before undertaking exterior construction.'
    ],
    statusOutcome: 'Amicable Settlement Signed (Kasunduan)',
    notes: 'Next compliance check scheduled for verification.'
  });

  const [newTermInput, setNewTermInput] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);

  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch Existing Meetings and Complaints from API
  const loadData = async () => {
    setLoading(true);
    try {
      const [resMeetings, resComplaints] = await Promise.all([
        api.get('/meetings'),
        api.get('/complaints')
      ]);

      const allMeetings = resMeetings.data || [];
      setMeetings(allMeetings);

      const allComplaints = resComplaints.data?.complaints || [];
      setComplaints(allComplaints);

      // Pick first mediation meeting if available
      const firstMediation = allMeetings.find((m) => m.meetingType === 'mediation');
      if (firstMediation) {
        loadMeetingIntoState(firstMediation, allComplaints);
      } else if (allComplaints.length > 0) {
        linkComplaintToForm(allComplaints[0]);
      }
    } catch (err) {
      console.error('Error loading mediation data:', err);
      showNotification('Unable to sync live mediation records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const linkComplaintToForm = (c) => {
    if (!c) return;
    setReferenceCase({
      id: c.id,
      title: c.title || 'Barangay Dispute',
      category: c.category || 'Mediation'
    });
    setParticipants([
      {
        id: 'p1',
        name: c.residentName || 'Complainant',
        role: 'COMPLAINANT',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        present: true,
        signed: true,
        statement: c.details || c.description || 'Complainant requests barangay intervention to resolve this dispute peacefully.'
      },
      {
        id: 'p2',
        name: c.respondentName || 'Respondent Party',
        role: 'RESPONDENT',
        avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
        present: true,
        signed: false,
        statement: 'Respondent acknowledges receipt of summon and appears to present counter-proposals.'
      }
    ]);
  };

  const loadMeetingIntoState = (m, complaintList = complaints) => {
    setSelectedMeetingId(m.id);
    const dateObj = m.date ? new Date(m.date) : new Date();
    if (!isNaN(dateObj.getTime())) {
      setCurrentYear(dateObj.getFullYear());
      setCurrentMonth(dateObj.getMonth());
      setSelectedDay(dateObj.getDate());
    }
    setSessionStartTime(m.time || '02:00 PM');
    setFacility(m.location || 'Barangay Poblacion Mediation Hall');
    setPrimaryObjectives(
      Array.isArray(m.mainTopics) && m.mainTopics.length > 0
        ? m.mainTopics.join('\n')
        : (m.concernsRaised || '1. Formal inquiry into dispute.\n2. Review settlement possibilities.')
    );

    const comp = complaintList.find((c) => c.id === m.caseId);
    setReferenceCase({
      id: m.caseId || (comp ? comp.id : 'CMP-MED'),
      title: m.title || (comp ? comp.title : 'Mediation Hearing'),
      category: comp?.category || 'Community Dispute'
    });

    setParticipants([
      {
        id: 'p1',
        name: m.residentName || (comp?.residentName) || 'Complainant',
        role: 'COMPLAINANT',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        present: true,
        signed: true,
        statement: m.concernsRaised || 'Complainant is seeking resolution on this matter.'
      },
      {
        id: 'p2',
        name: m.respondentName || (comp?.respondentName) || 'Respondent',
        role: 'RESPONDENT',
        avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
        present: true,
        signed: m.mediationStatus === 'Settled',
        statement: 'Respondent agrees to mediation conditions.'
      }
    ]);

    if (m.mediator) {
      setAssignedMediator(prev => ({
        ...prev,
        name: m.mediator
      }));
    }

    setMinutesData(prev => ({
      ...prev,
      hearingNumber: m.hearingStage || '1st Mediation Hearing',
      presidingOfficer: m.mediator ? `${m.mediator} (Lupon Head)` : prev.presidingOfficer,
      discussionSummary: m.minutes || prev.discussionSummary,
      termsList: Array.isArray(m.resolutions) && m.resolutions.length > 0
        ? m.resolutions.map(r => r.title || r)
        : prev.termsList,
      statusOutcome: m.mediationStatus ? `${m.mediationStatus} (Kasunduan)` : prev.statusOutcome
    }));
  };

  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const fileName = e.target.files[0].name;
      setIsUploading(true);
      setTimeout(() => {
        setUploadedFiles(prev => [...prev, fileName]);
        setIsUploading(false);
        showNotification(`File "${fileName}" attached successfully.`);
      }, 600);
    }
  };

  const removeFile = (idx) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const removeParticipant = (id) => {
    setParticipants(prev => prev.filter(p => p.id !== id));
    showNotification('Participant removed from hearing list.');
  };

  const handleAddTerm = () => {
    if (!newTermInput.trim()) return;
    setMinutesData(prev => ({
      ...prev,
      termsList: [...prev.termsList, newTermInput.trim()]
    }));
    setNewTermInput('');
  };

  const removeTerm = (index) => {
    setMinutesData(prev => ({
      ...prev,
      termsList: prev.termsList.filter((_, i) => i !== index)
    }));
  };

  const toggleParticipantPresent = (id) => {
    setParticipants(prev =>
      prev.map(p => p.id === id ? { ...p, present: !p.present } : p)
    );
  };

  const toggleParticipantSign = (id) => {
    setParticipants(prev =>
      prev.map(p => p.id === id ? { ...p, signed: !p.signed } : p)
    );
    showNotification('Digital signature authorization updated.');
  };

  // Today boundary comparison
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const canGoPrevMonth =
    currentYear > todayDate.getFullYear() ||
    (currentYear === todayDate.getFullYear() && currentMonth > todayDate.getMonth());

  // Month navigation
  const prevMonth = () => {
    if (!canGoPrevMonth) return;
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Calendar days builder
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7; // Monday = 0
  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  // Selected date ISO string
  const pad = (n) => String(n).padStart(2, '0');
  const selectedDateISO = `${currentYear}-${pad(currentMonth + 1)}-${pad(selectedDay)}`;

  const handleSaveMediation = async (confirmMinutes = false) => {
    setSaving(true);
    try {
      const complainant = participants.find(p => p.role === 'COMPLAINANT') || participants[0];
      const respondent = participants.find(p => p.role === 'RESPONDENT') || participants[1];

      const payload = {
        title: `Mediation Hearing: Case ${referenceCase.id}`,
        date: selectedDateISO,
        time: sessionStartTime,
        location: logisticalFormat === 'in-person' ? facility : `Virtual: ${virtualLink}`,
        meetingType: 'mediation',
        caseId: referenceCase.id,
        residentName: complainant?.name || '',
        respondentName: respondent?.name || '',
        mediator: assignedMediator.name,
        hearingStage: minutesData.hearingNumber,
        mainTopics: primaryObjectives.split('\n').filter(Boolean),
        concernsRaised: complainant?.statement || '',
        minutes: minutesData.discussionSummary,
        resolutions: minutesData.termsList.map((t, idx) => ({
          id: `RES-${idx + 1}`,
          title: t,
          status: 'Agreed'
        })),
        actionItems: [
          {
            task: 'Conduct compliance verification check',
            responsible: assignedMediator.name,
            deadline: selectedDateISO,
            status: 'Pending'
          }
        ],
        mediationStatus: confirmMinutes ? 'Settled' : 'Scheduled',
        sendNotification: true
      };

      if (selectedMeetingId) {
        await api.put(`/meetings/${selectedMeetingId}`, payload);
        showNotification('Mediation record updated successfully.');
      } else {
        const { data } = await api.post('/meetings', payload);
        setSelectedMeetingId(data.id);
        showNotification('Mediation scheduled and calendar slot reserved!');
      }

      const res = await api.get('/meetings');
      setMeetings(res.data || []);
      if (confirmMinutes) {
        showNotification('Minutes and Kasunduan officially certified and saved.');
      }

      // Directly navigate to the Mediation List
      setActiveTab('list');
    } catch (err) {
      console.error(err);
      showNotification(err.response?.data?.message || 'Failed to save mediation record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMediation = async (id, e) => {
    if (e) e.stopPropagation();
    const confirmed = window.confirm('Are you sure you want to delete this scheduled mediation hearing? This action cannot be undone.');
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await api.delete(`/meetings/${id}`);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
      if (selectedMeetingId === id) {
        setSelectedMeetingId(null);
      }
      showNotification('Mediation hearing deleted successfully.');
    } catch (err) {
      console.error('Delete mediation error:', err);
      showNotification(err.response?.data?.message || 'Failed to delete mediation hearing.');
    } finally {
      setDeletingId(null);
    }
  };

  const mediatorList = [
    { name: 'Hon. Arthur Pendelton', title: 'Accredited Senior Mediator / Lupon Chair', license: 'MED-NCR-2024-914' },
    { name: 'Atty. Sofia Guanzon', title: 'Barangay Legal Consultant & Mediator', license: 'MED-NCR-2023-402' },
    { name: 'Engr. Danilo Ramos', title: 'Certified Community Mediator (Property & Setbacks)', license: 'MED-NCR-2021-118' }
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-800 font-sans pb-24 antialiased selection:bg-slate-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#0A1A2F] text-white px-4 py-3 rounded-lg shadow-xl text-sm flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-2 sm:px-4 pt-4">
        {/* Header Title Section & Reference Case Badge */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-amber-100 text-amber-900 font-bold tracking-wider text-[11px] px-2.5 py-0.5 rounded uppercase">
                Action Required
              </span>
              <span className="text-slate-500 text-sm font-medium">Case Filing / Katarungang Pambarangay Hearing</span>
            </div>
            <h1 className="text-3xl sm:text-[34px] font-extrabold text-slate-900 tracking-tight leading-none">
              Schedule Mediation Hearing
            </h1>
            <p className="text-slate-500 text-sm mt-2 max-w-2xl">
              Initialize a formal mediation session for community dispute resolution. All participants will be notified upon confirmation.
            </p>
          </div>

          {/* Reference Case Card */}
          <div 
            onClick={() => setShowCaseSelectorModal(true)}
            className="flex items-center gap-3.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-5 py-3 shadow-sm self-start md:self-center cursor-pointer transition-all group"
            title="Click to switch or link a different case"
          >
            <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg group-hover:bg-[#0A1A2F] group-hover:text-white transition-colors">
              <FileText className="w-5 h-5 text-[#0A1A2F] group-hover:text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">REFERENCE CASE</p>
                <span className="text-[10px] text-blue-600 font-semibold underline">Change</span>
              </div>
              <p className="text-lg font-black text-slate-900 tracking-tight">{referenceCase.id}</p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-slate-200 mb-6 gap-6 sm:gap-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('list')}
            className={`pb-3.5 text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'list'
                ? 'text-[#0A1A2F] border-b-2 border-[#0A1A2F]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Mediation Hearings List</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
              {meetings.filter(m => m.meetingType === 'mediation').length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            className={`pb-3.5 text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'schedule'
                ? 'text-[#0A1A2F] border-b-2 border-[#0A1A2F]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Schedule Hearing</span>
          </button>

          <button
            onClick={() => setActiveTab('minutes')}
            className={`pb-3.5 text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'minutes'
                ? 'text-[#0A1A2F] border-b-2 border-[#0A1A2F]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Formal Meeting Minutes</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider">
              Live Record
            </span>
          </button>
        </div>

        {/* TAB 0: MEDIATION HEARINGS LIST */}
        {activeTab === 'list' && (
          <div className="space-y-5">
            {/* Action Bar: Filters, Search, and New Schedule Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex flex-1 items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search case #, complainant, respondent, or mediator..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-slate-400 text-slate-800"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:bg-white focus:border-slate-400 font-medium"
                >
                  <option value="all">All Mediation Statuses</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Pending">Pending</option>
                  <option value="Settled">Settled (Kasunduan)</option>
                </select>
              </div>

              <button
                onClick={() => {
                  setSelectedMeetingId(null);
                  setActiveTab('schedule');
                }}
                className="px-4 py-2 bg-[#0A1A2F] hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule New Hearing</span>
              </button>
            </div>

            {/* Mediation Hearings Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Case # / Stage</th>
                      <th className="py-3.5 px-4">Hearing Date & Time</th>
                      <th className="py-3.5 px-4">Parties Involved</th>
                      <th className="py-3.5 px-4">Venue</th>
                      <th className="py-3.5 px-4">Mediator</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {(() => {
                      const mediationMeetings = meetings
                        .filter((m) => m.meetingType === 'mediation')
                        .filter((m) => {
                          if (statusFilter !== 'all') {
                            const curStatus = m.mediationStatus || 'Scheduled';
                            if (curStatus.toLowerCase() !== statusFilter.toLowerCase()) return false;
                          }
                          if (searchTerm.trim()) {
                            const q = searchTerm.toLowerCase();
                            const matchCase = (m.caseId || '').toLowerCase().includes(q);
                            const matchTitle = (m.title || '').toLowerCase().includes(q);
                            const matchRes = (m.residentName || '').toLowerCase().includes(q);
                            const matchResp = (m.respondentName || '').toLowerCase().includes(q);
                            const matchMed = (m.mediator || '').toLowerCase().includes(q);
                            return matchCase || matchTitle || matchRes || matchResp || matchMed;
                          }
                          return true;
                        });

                      if (mediationMeetings.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-slate-400">
                              <Scale className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
                              <p className="font-semibold text-slate-600">No scheduled mediation hearings found.</p>
                              <p className="text-xs text-slate-400 mt-1">
                                {searchTerm ? 'Try adjusting your search criteria.' : 'Click "Schedule New Hearing" to book a session.'}
                              </p>
                            </td>
                          </tr>
                        );
                      }

                      return mediationMeetings.map((m) => {
                        const isSettled = m.mediationStatus === 'Settled';
                        return (
                          <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900">{m.caseId || 'Direct Hearing'}</div>
                              <span className="text-[10px] text-slate-500 font-medium">
                                {m.hearingStage || '1st Mediation Hearing'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                                <CalendarIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>{formatDisplayDate(m.date)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-0.5">
                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{m.time || '10:00 AM'}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-slate-900">
                                <span className="text-[10px] text-slate-400 uppercase font-bold mr-1">C:</span>
                                {m.residentName || 'Complainant'}
                              </div>
                              <div className="text-slate-600 text-[11px] mt-0.5">
                                <span className="text-[10px] text-slate-400 uppercase font-bold mr-1">R:</span>
                                {m.respondentName || 'Respondent Party'}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 max-w-[200px] truncate" title={m.location}>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{m.location || 'Barangay Poblacion Mediation Hall'}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-700">
                              <div className="font-medium">{m.mediator || 'Unassigned'}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${
                                  isSettled
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-blue-50 text-blue-800 border-blue-200'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isSettled ? 'bg-emerald-500' : 'bg-blue-500'
                                  }`}
                                />
                                <span>{m.mediationStatus || 'Scheduled'}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    loadMeetingIntoState(m);
                                    setActiveTab('minutes');
                                  }}
                                  className="px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                                  title="Record or review minutes & settlement"
                                >
                                  Minutes
                                </button>
                                <button
                                  onClick={() => {
                                    loadMeetingIntoState(m);
                                    setActiveTab('schedule');
                                  }}
                                  className="px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                                  title="Edit schedule & logistics"
                                >
                                  Reschedule
                                </button>
                                <button
                                  onClick={(e) => handleDeleteMediation(m.id, e)}
                                  disabled={deletingId === m.id}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                                  title="Delete mediation hearing"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: SCHEDULE & LOGISTICS */}
        {activeTab === 'schedule' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Date & Objectives */}
            <div className="lg:col-span-7 space-y-6">
              {/* Date Selection Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5 font-bold text-slate-900 text-base">
                    <CalendarIcon className="w-5 h-5 text-slate-800" />
                    <span>Date Selection</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={prevMonth}
                      disabled={!canGoPrevMonth}
                      className="p-1.5 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent rounded text-slate-600 transition-colors"
                      title={canGoPrevMonth ? 'Previous Month' : 'Past months disabled'}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-semibold text-slate-700 px-1">
                      {monthNames[currentMonth]} {currentYear}
                    </span>
                    <button 
                      onClick={nextMonth}
                      className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition-colors"
                      title="Next Month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Day Header */}
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">
                  <span>MON</span>
                  <span>TUE</span>
                  <span>WED</span>
                  <span>THU</span>
                  <span>FRI</span>
                  <span>SAT</span>
                  <span>SUN</span>
                </div>

                {/* Calendar Days Grid */}
                <div className="grid grid-cols-7 gap-2 text-center text-sm font-semibold mb-6">
                  {calendarDays.map((day, idx) => {
                    if (!day) {
                      return <span key={`empty-${idx}`} className="py-2.5 text-slate-300 select-none">·</span>;
                    }
                    const dayDate = new Date(currentYear, currentMonth, day);
                    dayDate.setHours(0, 0, 0, 0);
                    const isPast = dayDate < todayDate;
                    const isSelected = selectedDay === day;

                    return (
                      <button
                        key={day}
                        onClick={() => !isPast && setSelectedDay(day)}
                        disabled={isPast}
                        title={isPast ? 'Previous dates cannot be selected' : `Select ${monthNames[currentMonth]} ${day}, ${currentYear}`}
                        className={`py-2.5 rounded-lg transition-all ${
                          isPast
                            ? 'text-slate-300 cursor-not-allowed line-through'
                            : isSelected
                            ? 'bg-[#0A1A2F] text-white font-bold shadow-md ring-2 ring-slate-900/10'
                            : 'hover:bg-slate-100 text-slate-700 font-medium'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                {/* Start Time & Duration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      SESSION START
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={sessionStartTime}
                        onChange={(e) => setSessionStartTime(e.target.value)}
                        className="w-full bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-slate-300 rounded-lg px-3.5 py-2.5 font-bold text-slate-800 text-sm outline-none"
                      />
                      <Clock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      ESTIMATED DURATION
                    </label>
                    <div className="relative">
                      <select
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full appearance-none bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-slate-300 rounded-lg px-3.5 py-2.5 font-bold text-slate-800 text-sm outline-none cursor-pointer"
                      >
                        <option>30 Minutes</option>
                        <option>60 Minutes</option>
                        <option>90 Minutes</option>
                        <option>120 Minutes</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Primary Objectives & Evidence Attachment */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center gap-2.5 font-bold text-slate-900 text-base mb-4">
                  <CalendarIcon className="w-5 h-5 text-slate-800" />
                  <span>Hearing Scope & Objectives</span>
                </div>

                <div className="mb-5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    PRIMARY OBJECTIVES
                  </label>
                  <textarea
                    rows={4}
                    value={primaryObjectives}
                    onChange={(e) => setPrimaryObjectives(e.target.value)}
                    placeholder="Outline the key points for mediation..."
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-lg p-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:bg-white transition-all placeholder:text-slate-400 resize-none font-normal leading-relaxed"
                  />
                </div>

                {/* Evidence Upload Area */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    ATTACH EVIDENCE DOCUMENTS (PDF, JPEG)
                  </label>
                  <label className="border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/70 rounded-lg p-4 flex items-center justify-between cursor-pointer transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-md border border-slate-200 text-slate-600 group-hover:text-slate-900">
                        <Paperclip className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-slate-600">
                        {isUploading ? 'Uploading file...' : 'Drop files here or click to browse'}
                      </span>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-800 hover:text-black">
                      UPLOAD
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                  </label>

                  {/* Attached Files List */}
                  {uploadedFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {uploadedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-100/80 px-3 py-2 rounded text-xs text-slate-700 font-medium">
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="truncate">{file}</span>
                          </div>
                          <button
                            onClick={() => removeFile(idx)}
                            className="text-slate-400 hover:text-rose-600 ml-2"
                            title="Remove file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Logistical Format & Attendees */}
            <div className="lg:col-span-5 space-y-6">
              {/* Participants & Mediator Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5 font-bold text-slate-900 text-base">
                    <CalendarIcon className="w-5 h-5 text-slate-800" />
                    <span>Hearing Parties & Mediator</span>
                  </div>
                  <button
                    onClick={() => setShowCaseSelectorModal(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    Load from Case
                  </button>
                </div>

                {/* Parties list */}
                <div className="space-y-4 mb-6">
                  {participants.map((person) => (
                    <div key={person.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <img
                          src={person.avatar}
                          alt={person.name}
                          className="w-10 h-10 rounded-md object-cover border border-slate-200"
                        />
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 leading-snug">
                            {person.name}
                          </h4>
                          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                            {person.role}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => removeParticipant(person.id)}
                          className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                          title="Remove party"
                        >
                          <MinusCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Neutral Mediator Section */}
                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    NEUTRAL MEDIATOR
                  </label>

                  {assignedMediator ? (
                    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                          {assignedMediator.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{assignedMediator.name}</p>
                          <p className="text-[11px] text-slate-500">{assignedMediator.license}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowMediatorModal(true)}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowMediatorModal(true)}
                      className="w-full border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-lg py-4 px-3 flex items-center justify-center gap-2 text-slate-400 hover:text-slate-700 transition-all text-sm font-medium"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Assign Certified Mediator...</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FORMAL MEETING MINUTES & SETTLEMENT */}
        {activeTab === 'minutes' && (
          <div className="space-y-6">
            {/* Top Toolbar for Minutes */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  Active Proceedings
                </span>
                <span className="text-xs text-slate-500">
                  Hearing Stage: <strong className="text-slate-700">{minutesData.hearingNumber}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-xs text-slate-500">
                  Date: <strong className="text-slate-700">{formatDisplayDate(selectedDateISO)} ({sessionStartTime})</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Minutes</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#0A1A2F] hover:bg-[#12233b] rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Official Kasunduan</span>
                </button>
              </div>
            </div>

            {/* Attendance & Officers Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Presiding & Officers */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-700" />
                  Presiding Officers
                </h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 font-medium">Mediator / Officer in Charge</label>
                    <input
                      type="text"
                      value={minutesData.presidingOfficer}
                      onChange={(e) => setMinutesData({ ...minutesData, presidingOfficer: e.target.value })}
                      className="w-full mt-1 font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 font-medium">Recording Secretary</label>
                    <input
                      type="text"
                      value={minutesData.recordingSecretary}
                      onChange={(e) => setMinutesData({ ...minutesData, recordingSecretary: e.target.value })}
                      className="w-full mt-1 font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded p-2 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Attendance Checklist */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm md:col-span-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-700" />
                  Attendance Verification
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {participants.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50/50"
                    >
                      <div className="flex items-center gap-2.5">
                        <img src={person.avatar} alt="" className="w-7 h-7 rounded-md object-cover" />
                        <div>
                          <p className="text-xs font-bold text-slate-900 leading-tight">{person.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{person.role}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleParticipantPresent(person.id)}
                        className={`text-xs px-2.5 py-1 rounded font-bold transition-all ${
                          person.present
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {person.present ? '✓ Present' : '✗ Absent'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Statements & Findings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Complainant Statement */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Complainant's Statement & Claims
                  </h4>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    {participants[0]?.name || 'Complainant'}
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={participants[0]?.statement || ''}
                  onChange={(e) => {
                    const text = e.target.value;
                    setParticipants(prev => [
                      { ...prev[0], statement: text },
                      prev[1]
                    ]);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 leading-relaxed outline-none focus:bg-white"
                />
              </div>

              {/* Respondent Statement */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Respondent's Answer & Settlement Offer
                  </h4>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    {participants[1]?.name || 'Respondent'}
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={participants[1]?.statement || ''}
                  onChange={(e) => {
                    const text = e.target.value;
                    setParticipants(prev => [
                      prev[0],
                      { ...prev[1], statement: text }
                    ]);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 leading-relaxed outline-none focus:bg-white"
                />
              </div>
            </div>

            {/* Terms of Agreement (Amicable Settlement / Kasunduan) */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Terms of Amicable Settlement (Kasunduan)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Legally enforceable conditions stipulated under Chapter VII, Title I, Book III of Republic Act No. 7160 (Katarungang Pambarangay).
                  </p>
                </div>
                <span className="self-start sm:self-center text-xs font-bold bg-blue-50 text-blue-800 px-3 py-1 rounded-full border border-blue-200">
                  {minutesData.statusOutcome}
                </span>
              </div>

              {/* Clauses List */}
              <div className="mt-4 space-y-2.5">
                {minutesData.termsList.map((term, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-medium text-slate-800"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="font-bold text-slate-400 shrink-0">{index + 1}.</span>
                      <p className="leading-relaxed">{term}</p>
                    </div>
                    <button
                      onClick={() => removeTerm(index)}
                      className="text-slate-400 hover:text-rose-500 transition-colors shrink-0"
                      title="Remove term"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Term Input */}
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Draft another binding stipulation or term..."
                  value={newTermInput}
                  onChange={(e) => setNewTermInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTerm()}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs outline-none focus:bg-white focus:border-slate-400"
                />
                <button
                  onClick={handleAddTerm}
                  className="px-4 py-2 bg-[#0A1A2F] text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Term</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Floating Bar */}
        <div className="mt-8 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-slate-600 text-xs">
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-full shrink-0">
              <Info className="w-4 h-4" />
            </div>
            <span>
              Invitations will be dispatched via official digital channels immediately upon confirmation.
            </span>
          </div>

          {activeTab !== 'list' ? (
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                onClick={() => setActiveTab('list')}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors"
              >
                Back to Mediation List
              </button>
              <button
                onClick={() => showNotification('Draft state saved locally.')}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors"
              >
                Save Draft
              </button>
              <button
                onClick={() => showNotification('Official summons notification dispatched to parties via email.')}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors"
              >
                Send Invitations
              </button>
              <button
                onClick={() => {
                  if (activeTab === 'schedule') {
                    handleSaveMediation(false);
                  } else {
                    handleSaveMediation(true);
                  }
                }}
                disabled={saving}
                className="px-5 py-2.5 bg-[#0A1A2F] hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? 'Processing...' : (activeTab === 'schedule' ? 'Confirm Schedule' : 'Finalize & Archive Record')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                onClick={() => {
                  setSelectedMeetingId(null);
                  setActiveTab('schedule');
                }}
                className="px-5 py-2.5 bg-[#0A1A2F] hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule New Hearing</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* MODAL: Mediator Directory */}
      {showMediatorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-slate-900 text-base">Select Certified Mediator</h3>
              <button
                onClick={() => setShowMediatorModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Choose an accredited peace officer or legal mediator for Case #{referenceCase.id}.
            </p>
            <div className="space-y-3">
              {mediatorList.map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setAssignedMediator({
                      name: m.name,
                      title: m.title,
                      license: m.license,
                      signed: true
                    });
                    setShowMediatorModal(false);
                    showNotification(`Assigned ${m.name} as Neutral Mediator.`);
                  }}
                  className="p-3 border border-slate-200 hover:border-[#0A1A2F] hover:bg-slate-50/70 rounded-lg cursor-pointer transition-all"
                >
                  <p className="text-xs font-bold text-slate-900">{m.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{m.title}</p>
                  <span className="text-[10px] text-slate-400 font-mono mt-1 inline-block">
                    {m.license}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Case Selector */}
      {showCaseSelectorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Select Complaint to Mediate</h3>
                <p className="text-xs text-slate-500">Pick an active resident complaint to link to this hearing.</p>
              </div>
              <button
                onClick={() => setShowCaseSelectorModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
              {complaints.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400">No complaints found.</p>
              ) : (
                complaints.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      linkComplaintToForm(c);
                      setShowCaseSelectorModal(false);
                      showNotification(`Linked to case #${c.id}`);
                    }}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      referenceCase.id === c.id
                        ? 'border-[#0A1A2F] bg-slate-50 ring-1 ring-[#0A1A2F]'
                        : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-bold text-slate-800">{c.id}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        {c.status || 'Active'}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900">{c.title || 'Untitled Case'}</p>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                      Complainant: {c.residentName || 'Anonymous'} vs. Respondent: {c.respondentName || 'TBD'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Printable Official Minutes Preview */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl border border-slate-200 p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">OFFICIAL TRANSCRIPT</p>
                <h3 className="text-lg font-black text-slate-900">Mediation Record & Settlement Agreement</h3>
              </div>
              <button
                onClick={() => setShowPrintModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-700 leading-relaxed font-serif">
              <div className="bg-slate-50 p-3 rounded border border-slate-200 font-sans text-[11px] grid grid-cols-2 gap-2">
                <div><strong>Case Reference:</strong> {referenceCase.id}</div>
                <div><strong>Hearing Date:</strong> {formatDisplayDate(selectedDateISO)} ({sessionStartTime})</div>
                <div><strong>Venue:</strong> {logisticalFormat === 'in-person' ? facility : virtualLink}</div>
                <div><strong>Presiding:</strong> {minutesData.presidingOfficer}</div>
              </div>

              <div>
                <h5 className="font-bold text-slate-900 uppercase font-sans text-[11px] tracking-wide mb-1">
                  1. Matter of Dispute
                </h5>
                <p className="whitespace-pre-line">{primaryObjectives}</p>
              </div>

              <div>
                <h5 className="font-bold text-slate-900 uppercase font-sans text-[11px] tracking-wide mb-1">
                  2. Summary of Proceedings & Admissions
                </h5>
                <p>{minutesData.discussionSummary}</p>
              </div>

              <div>
                <h5 className="font-bold text-slate-900 uppercase font-sans text-[11px] tracking-wide mb-1">
                  3. Binding Covenants (Kasunduan)
                </h5>
                <ol className="list-decimal pl-5 space-y-1">
                  {minutesData.termsList.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ol>
              </div>

              <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 font-sans text-[11px]">
                <div className="text-center pt-8 border-t border-slate-400">
                  <p className="font-bold">{participants[0]?.name || 'Complainant'}</p>
                  <p className="text-slate-500 text-[10px]">Complainant (Signed)</p>
                </div>
                <div className="text-center pt-8 border-t border-slate-400">
                  <p className="font-bold">{participants[1]?.name || 'Respondent'}</p>
                  <p className="text-slate-500 text-[10px]">Respondent (Attested)</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200 font-sans">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 border border-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-[#0A1A2F] text-white text-xs font-bold rounded-lg hover:bg-slate-900 flex items-center gap-2"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Confirm & Print Document</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
