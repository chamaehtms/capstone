import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import AdminIcon from '../components/AdminIcons';

export default function PendingRequests() {
  const [requests, setRequests] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState(null);
  const [message, setMessage] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/auth/access-requests').then((res) => res.data),
      api.get('/residents/pending-registrations').then((res) => res.data),
    ])
      .then(([accessRequests, pendingResidents]) => {
        setRequests(accessRequests);
        setRegistrations(pendingResidents);
      })
      .catch(() => setError('Unable to load pending requests.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleApprove = async (id) => {
    setActioningId(id);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post(`/auth/access-requests/${id}/approve`);
      setMessage(data.message);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to approve this request.');
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (id) => {
    setActioningId(id);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post(`/auth/access-requests/${id}/reject`);
      setMessage(data.message);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reject this request.');
    } finally {
      setActioningId(null);
    }
  };

  const handleApproveResident = async (id, fullName) => {
    setActioningId(id);
    setError('');
    setMessage('');
    try {
      await api.post(`/residents/${id}/approve`);
      setMessage(`${fullName} has been approved and can now sign in to the Residents Portal.`);
      setRegistrations((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to approve this registration.');
    } finally {
      setActioningId(null);
    }
  };

  const handleRejectResident = async (id, fullName) => {
    setActioningId(id);
    setError('');
    setMessage('');
    try {
      await api.post(`/residents/${id}/reject`);
      setMessage(`Registration from ${fullName} has been rejected.`);
      setRegistrations((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reject this registration.');
    } finally {
      setActioningId(null);
    }
  };

  const [scanningId, setScanningId] = useState(null);

  const handleScanResidentId = async (id) => {
    setScanningId(id);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post(`/residents/${id}/scan-id`);
      setRegistrations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...data } : r))
      );
      setMessage(`AI ID validation complete for ${data.fullName}.`);
      if (previewDoc && previewDoc.id === id) {
        setPreviewDoc((p) => ({
          ...p,
          idAiStatus: data.idAiStatus,
          idAiScore: data.idAiScore,
          idAiSummary: data.idAiSummary,
        }));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to run AI ID validation.');
    } finally {
      setScanningId(null);
    }
  };

  const handleScanAdminId = async (id) => {
    setScanningId(id);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post(`/auth/access-requests/${id}/scan-id`);
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...data } : r))
      );
      setMessage('AI ID validation completed for access request.');
      if (previewDoc && previewDoc.id === id) {
        setPreviewDoc((p) => ({
          ...p,
          idAiStatus: data.idAiStatus,
          idAiScore: data.idAiScore,
          idAiSummary: data.idAiSummary,
        }));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to run AI ID validation.');
    } finally {
      setScanningId(null);
    }
  };

  const openPreview = (person, defaultTab = 'compare', type = 'resident') => {
    const hasId = !!person.idDocumentUrl;
    const hasSelfie = !!person.selfieIdUrl;
    let tab = defaultTab;
    if (tab === 'compare' && (!hasId || !hasSelfie)) {
      tab = hasId ? 'id' : 'selfie';
    }
    setPreviewDoc({
      id: person.id,
      name: person.fullName,
      idUrl: person.idDocumentUrl,
      selfieUrl: person.selfieIdUrl,
      idAiStatus: person.idAiStatus,
      idAiScore: person.idAiScore,
      idAiSummary: person.idAiSummary,
      idAiCheckedAt: person.idAiCheckedAt,
      type,
      tab,
    });
  };

  const renderAiBadge = (item, onReScan) => {
    const status = item.idAiStatus || 'not_scanned';
    const isScanning = scanningId === item.id;

    if (isScanning) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          <span>AI Analyzing…</span>
        </span>
      );
    }

    if (status === 'likely_authentic') {
      const percent = item.idAiScore != null ? Math.round((1 - item.idAiScore) * 100) : 100;
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs"
            title={item.idAiSummary || 'Likely Authentic ID'}
          >
            <AdminIcon name="check" size={12} color="#065f46" />
            <span>Authentic ({percent}%)</span>
          </span>
          <span className="text-[10px] text-emerald-700 font-medium">Valid Physical ID</span>
        </div>
      );
    }

    if (status === 'ai_detected') {
      const percent = item.idAiScore != null ? Math.round(item.idAiScore * 100) : 95;
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs animate-pulse"
            title={item.idAiSummary || 'AI Generated / Deepfake Warning'}
          >
            <AdminIcon name="warning" size={12} color="#9f1239" />
            <span>AI Fake ({percent}%)</span>
          </span>
          <span className="text-[10px] text-rose-700 font-semibold">Flagged: Deepfake / AI</span>
        </div>
      );
    }

    if (status === 'suspicious') {
      const percent = item.idAiScore != null ? Math.round(item.idAiScore * 100) : 50;
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs"
            title={item.idAiSummary || 'Suspicious ID Artifacts'}
          >
            <AdminIcon name="warning" size={12} color="#92400e" />
            <span>Suspicious ({percent}%)</span>
          </span>
          <span className="text-[10px] text-amber-700 font-medium">Inspect Carefully</span>
        </div>
      );
    }

    if (status === 'blurry') {
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
            title={item.idAiSummary || 'Blurry Image'}
          >
            <AdminIcon name="eye" size={12} color="#78350f" />
            <span>Blurry Image</span>
          </span>
          <span className="text-[10px] text-amber-700 font-medium">Unreadable / Low Focus</span>
        </div>
      );
    }

    if (status === 'expired') {
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs"
            title={item.idAiSummary || 'Expired ID'}
          >
            <AdminIcon name="calendar" size={12} color="#9f1239" />
            <span>Expired ID</span>
          </span>
          <span className="text-[10px] text-rose-700 font-medium">Past Expiry Date</span>
        </div>
      );
    }

    if (status === 'unsupported_id') {
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-900 border border-orange-300 shadow-2xs"
            title={item.idAiSummary || 'Unsupported ID document'}
          >
            <AdminIcon name="x" size={12} color="#9a3412" />
            <span>Unsupported ID</span>
          </span>
          <span className="text-[10px] text-orange-700 font-medium">Not A Valid Gov ID</span>
        </div>
      );
    }

    if (status === 'document_pdf') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
          <AdminIcon name="document" size={12} color="#334155" />
          <span>PDF Document</span>
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onReScan(item.id)}
        disabled={isScanning}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 transition"
        title="Trigger AI scan on this ID"
      >
        <AdminIcon name="robot" size={13} color="#2563eb" />
        <span>Run AI Check</span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pending Requests</h1>
        <p className="text-sm text-slate-500">
          Review and approve or reject requests for administrative access, and household registrations
          submitted through the Residents Portal. Inspect both the Valid ID and the Selfie holding ID to confirm identity.
        </p>
      </div>

      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">Resident Registrations</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Self-registered through the Residents Portal — not visible in Resident Records until approved.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[850px]">
            <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">FULL NAME</th>
              <th className="px-5 py-3 font-medium">EMAIL</th>
              <th className="px-5 py-3 font-medium">ZONE</th>
              <th className="px-5 py-3 font-medium">CONTACT</th>
              <th className="px-5 py-3 font-medium">VALID ID</th>
              <th className="px-5 py-3 font-medium">AI ID VALIDATION</th>
              <th className="px-5 py-3 font-medium">SELFIE W/ ID</th>
              <th className="px-5 py-3 font-medium">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-5 py-6 text-center text-slate-400">
                  Loading registrations…
                </td>
              </tr>
            )}
            {!loading && registrations.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-6 text-center text-slate-400">
                  No pending registrations.
                </td>
              </tr>
            )}
            {registrations.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">
                  <Link to={`/residents/${r.id}`} className="hover:underline">{r.fullName}</Link>
                </td>
                <td className="px-5 py-3 text-slate-500">{r.email}</td>
                <td className="px-5 py-3 text-slate-500">{r.zone}</td>
                <td className="px-5 py-3 text-slate-500">{r.contact}</td>
                <td className="px-5 py-3">
                  {r.idDocumentUrl ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openPreview(r, 'id', 'resident')}
                        className="relative group w-9 h-9 rounded-lg overflow-hidden border border-slate-200 hover:border-blue-500 transition shrink-0 cursor-pointer shadow-xs bg-slate-100"
                        title="Click to preview ID card"
                      >
                        <img
                          src={r.idDocumentUrl}
                          alt="ID"
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                          <AdminIcon name="search" size={14} color="#ffffff" />
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => openPreview(r, 'id', 'resident')}
                        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition"
                      >
                        <AdminIcon name="id-card" size={13} color="#1d4ed8" />
                        <span>ID</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">None</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {renderAiBadge(r, handleScanResidentId)}
                </td>
                <td className="px-5 py-3">
                  {r.selfieIdUrl ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openPreview(r, 'selfie')}
                        className="relative group w-9 h-9 rounded-lg overflow-hidden border border-slate-200 hover:border-purple-500 transition shrink-0 cursor-pointer shadow-xs bg-slate-100"
                        title="Click to preview selfie holding ID"
                      >
                        <img
                          src={r.selfieIdUrl}
                          alt="Selfie"
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                          <AdminIcon name="search" size={14} color="#ffffff" />
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => openPreview(r, 'selfie')}
                        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md transition"
                      >
                        <AdminIcon name="selfie" size={13} color="#6d28d9" />
                        <span>Selfie</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">None</span>
                  )}
                </td>
                <td className="px-5 py-3 space-x-2 whitespace-nowrap">
                  {r.idDocumentUrl && r.selfieIdUrl && (
                    <button
                      type="button"
                      onClick={() => openPreview(r, 'compare')}
                      className="text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded-lg border border-blue-200 transition"
                      title="Compare ID and Selfie side-by-side"
                    >
                      Compare
                    </button>
                  )}
                  <button
                    onClick={() => handleApproveResident(r.id, r.fullName)}
                    disabled={actioningId === r.id}
                    className="text-xs font-medium bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleRejectResident(r.id, r.fullName)}
                    disabled={actioningId === r.id}
                    className="text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg disabled:opacity-60"
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Staff Access Requests</h2>
          <p className="text-xs text-slate-500 mt-0.5">Requests for administrative access to the Civic Ledger portal.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[950px]">
            <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">FULL NAME</th>
              <th className="px-5 py-3 font-medium">SEX</th>
              <th className="px-5 py-3 font-medium">CONTACT</th>
              <th className="px-5 py-3 font-medium">EMAIL</th>
              <th className="px-5 py-3 font-medium">DEPARTMENT</th>
              <th className="px-5 py-3 font-medium">EMPLOYEE ID</th>
              <th className="px-5 py-3 font-medium">ID CARD</th>
              <th className="px-5 py-3 font-medium">AI ID VALIDATION</th>
              <th className="px-5 py-3 font-medium">SELFIE W/ ID</th>
              <th className="px-5 py-3 font-medium">REQUESTED</th>
              <th className="px-5 py-3 font-medium">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={11} className="px-5 py-6 text-center text-slate-400">
                  Loading requests…
                </td>
              </tr>
            )}
            {!loading && requests.length === 0 && (
              <tr>
                <td colSpan={11} className="px-5 py-6 text-center text-slate-400">
                  No pending requests.
                </td>
              </tr>
            )}
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">
                  <div>{r.fullName}</div>
                  {(r.firstName || r.lastName) && (
                    <div className="text-[11px] text-slate-400">
                      {[r.firstName, r.middleName, r.lastName].filter(Boolean).join(' ')}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-600">{r.sex || '—'}</td>
                <td className="px-5 py-3 text-slate-600">{r.contactNo || '—'}</td>
                <td className="px-5 py-3 text-slate-500">{r.email}</td>
                <td className="px-5 py-3 text-slate-500">{r.department}</td>
                <td className="px-5 py-3 text-slate-500">{r.employeeId}</td>
                <td className="px-5 py-3">
                  {r.idDocumentUrl ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openPreview(r, 'id', 'staff')}
                        className="relative group w-9 h-9 rounded-lg overflow-hidden border border-slate-200 hover:border-blue-500 transition shrink-0 cursor-pointer shadow-xs bg-slate-100"
                        title="Click to preview ID photo"
                      >
                        <img
                          src={r.idDocumentUrl}
                          alt={r.fullName}
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                          <AdminIcon name="search" size={14} color="#ffffff" />
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => openPreview(r, 'id', 'staff')}
                        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition"
                      >
                        <AdminIcon name="id-card" size={13} color="#1d4ed8" />
                        <span>ID</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">None</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {renderAiBadge(r, handleScanAdminId)}
                </td>
                <td className="px-5 py-3">
                  {r.selfieIdUrl ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openPreview(r, 'selfie')}
                        className="relative group w-9 h-9 rounded-lg overflow-hidden border border-slate-200 hover:border-purple-500 transition shrink-0 cursor-pointer shadow-xs bg-slate-100"
                        title="Click to preview selfie holding ID"
                      >
                        <img
                          src={r.selfieIdUrl}
                          alt="Selfie"
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                          <AdminIcon name="search" size={14} color="#ffffff" />
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => openPreview(r, 'selfie')}
                        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md transition"
                      >
                        <AdminIcon name="selfie" size={13} color="#6d28d9" />
                        <span>Selfie</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">None</span>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                  {new Date(r.requestedAt).toLocaleString()}
                </td>
                <td className="px-5 py-3 space-x-2 whitespace-nowrap">
                  {r.idDocumentUrl && r.selfieIdUrl && (
                    <button
                      type="button"
                      onClick={() => openPreview(r, 'compare')}
                      className="text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded-lg border border-blue-200 transition"
                      title="Compare ID and Selfie side-by-side"
                    >
                      Compare
                    </button>
                  )}
                  <button
                    onClick={() => handleApprove(r.id)}
                    disabled={actioningId === r.id}
                    className="text-xs font-medium bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(r.id)}
                    disabled={actioningId === r.id}
                    className="text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg disabled:opacity-60"
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {previewDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className={`bg-white rounded-2xl ${
              previewDoc.tab === 'compare' ? 'max-w-4xl' : 'max-w-2xl'
            } w-full p-6 shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Identity Verification Review</h3>
                <p className="text-xs text-slate-500">Applicant: <strong className="text-slate-700">{previewDoc.name}</strong></p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center text-lg font-bold"
              >
                <AdminIcon name="close" size={18} color="#64748b" />
              </button>
            </div>

            {/* Tab switchers if both photos exist */}
            {previewDoc.idUrl && previewDoc.selfieUrl && (
              <div className="flex items-center gap-2 pt-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewDoc((p) => ({ ...p, tab: 'compare' }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                    previewDoc.tab === 'compare'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <AdminIcon name="search" size={13} color={previewDoc.tab === 'compare' ? '#ffffff' : '#475569'} />
                  <span>Side-by-Side Comparison</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc((p) => ({ ...p, tab: 'id' }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                    previewDoc.tab === 'id'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <AdminIcon name="id-card" size={13} color={previewDoc.tab === 'id' ? '#ffffff' : '#475569'} />
                  <span>Valid ID Card Only</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc((p) => ({ ...p, tab: 'selfie' }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                    previewDoc.tab === 'selfie'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <AdminIcon name="selfie" size={13} color={previewDoc.tab === 'selfie' ? '#ffffff' : '#475569'} />
                  <span>Selfie Holding ID Only</span>
                </button>
              </div>
            )}

            {/* AI ID Validation Insight Banner */}
            <div className="mt-3 p-3 rounded-xl border flex items-center justify-between gap-3 bg-slate-50 border-slate-200">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                  {previewDoc.idAiStatus === 'likely_authentic' ? (
                    <AdminIcon name="shield" size={18} color="#059669" />
                  ) : previewDoc.idAiStatus === 'ai_detected' ? (
                    <AdminIcon name="alert" size={18} color="#e11d48" />
                  ) : previewDoc.idAiStatus === 'suspicious' ? (
                    <AdminIcon name="warning" size={18} color="#d97706" />
                  ) : (
                    <AdminIcon name="robot" size={18} color="#2563eb" />
                  )}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">AI ID Authenticity Analysis:</span>
                    {previewDoc.idAiStatus === 'likely_authentic' && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Likely Authentic Physical ID ({previewDoc.idAiScore != null ? Math.round((1 - previewDoc.idAiScore) * 100) : 100}%)
                      </span>
                    )}
                    {previewDoc.idAiStatus === 'ai_detected' && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                        High AI Generation / Deepfake Risk ({previewDoc.idAiScore != null ? Math.round(previewDoc.idAiScore * 100) : 90}%)
                      </span>
                    )}
                    {previewDoc.idAiStatus === 'suspicious' && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        Suspicious Image Artifacts ({previewDoc.idAiScore != null ? Math.round(previewDoc.idAiScore * 100) : 50}%)
                      </span>
                    )}
                    {previewDoc.idAiStatus === 'blurry' && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                        Blurry Image / Low Sharpness
                      </span>
                    )}
                    {previewDoc.idAiStatus === 'expired' && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300">
                        Expired Document
                      </span>
                    )}
                    {previewDoc.idAiStatus === 'unsupported_id' && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-300">
                        Unsupported Non-ID Document
                      </span>
                    )}
                    {(!previewDoc.idAiStatus || previewDoc.idAiStatus === 'not_scanned') && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                        Pending Scan
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {previewDoc.idAiSummary || 'Automated ID fraud and AI generation check protects against fraudulent documents.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => previewDoc.type === 'staff' ? handleScanAdminId(previewDoc.id) : handleScanResidentId(previewDoc.id)}
                disabled={scanningId === previewDoc.id}
                className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 transition flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
              >
                <AdminIcon name={scanningId === previewDoc.id ? 'clock' : 'refresh'} size={13} color="#475569" />
                <span>{scanningId === previewDoc.id ? 'Scanning…' : 'Re-check AI'}</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="my-4 overflow-y-auto flex-1">
              {previewDoc.tab === 'compare' && previewDoc.idUrl && previewDoc.selfieUrl ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: ID Card */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-col">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <AdminIcon name="id-card" size={14} color="#1d4ed8" />
                        <span>Valid ID Card</span>
                      </span>
                      <a
                        href={previewDoc.idUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-600 hover:underline font-medium"
                      >
                        ↗ Open original
                      </a>
                    </div>
                    <div className="flex-1 flex items-center justify-center min-h-[300px] max-h-[50vh] bg-slate-900/5 rounded-lg p-2 overflow-hidden">
                      <img
                        src={previewDoc.idUrl}
                        alt="Valid ID Card"
                        className="max-h-[46vh] w-auto object-contain rounded shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Right: Selfie Holding ID */}
                  <div className="border border-purple-200 rounded-xl p-3 bg-purple-50/40 flex flex-col">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-purple-200">
                      <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                        <AdminIcon name="selfie" size={14} color="#6d28d9" />
                        <span>Selfie Holding ID</span>
                      </span>
                      <a
                        href={previewDoc.selfieUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-purple-700 hover:underline font-medium"
                      >
                        ↗ Open original
                      </a>
                    </div>
                    <div className="flex-1 flex items-center justify-center min-h-[300px] max-h-[50vh] bg-slate-900/5 rounded-lg p-2 overflow-hidden">
                      <img
                        src={previewDoc.selfieUrl}
                        alt="Selfie Holding ID"
                        className="max-h-[46vh] w-auto object-contain rounded shadow-xs"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-full flex items-center justify-center max-h-[60vh] overflow-auto rounded-xl bg-slate-900/5 p-3">
                    <img
                      src={previewDoc.tab === 'selfie' ? previewDoc.selfieUrl : previewDoc.idUrl}
                      alt="Verification Document"
                      className="max-h-[55vh] w-auto object-contain rounded-lg shadow-sm"
                    />
                  </div>
                  <div className="mt-2 text-center">
                    <span className="text-xs font-semibold text-slate-600 flex items-center justify-center gap-1.5">
                      {previewDoc.tab === 'selfie' ? (
                        <>
                          <AdminIcon name="selfie" size={14} color="#6d28d9" />
                          <span>Selfie Holding Valid ID</span>
                        </>
                      ) : (
                        <>
                          <AdminIcon name="id-card" size={14} color="#1d4ed8" />
                          <span>Valid ID Card</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
              <span className="text-xs text-slate-400">
                Barangay Poblacion Verification System
              </span>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              >
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
