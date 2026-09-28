import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

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

  const openPreview = (person, defaultTab = 'compare') => {
    const hasId = !!person.idDocumentUrl;
    const hasSelfie = !!person.selfieIdUrl;
    let tab = defaultTab;
    if (tab === 'compare' && (!hasId || !hasSelfie)) {
      tab = hasId ? 'id' : 'selfie';
    }
    setPreviewDoc({
      name: person.fullName,
      idUrl: person.idDocumentUrl,
      selfieUrl: person.selfieIdUrl,
      tab,
    });
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
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">FULL NAME</th>
              <th className="px-5 py-3 font-medium">EMAIL</th>
              <th className="px-5 py-3 font-medium">ZONE</th>
              <th className="px-5 py-3 font-medium">CONTACT</th>
              <th className="px-5 py-3 font-medium">VALID ID</th>
              <th className="px-5 py-3 font-medium">SELFIE W/ ID</th>
              <th className="px-5 py-3 font-medium">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                  Loading registrations…
                </td>
              </tr>
            )}
            {!loading && registrations.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
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
                        onClick={() => openPreview(r, 'id')}
                        className="relative group w-9 h-9 rounded-lg overflow-hidden border border-slate-200 hover:border-blue-500 transition shrink-0 cursor-pointer shadow-xs bg-slate-100"
                        title="Click to preview ID card"
                      >
                        <img
                          src={r.idDocumentUrl}
                          alt="ID"
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                          🔍
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => openPreview(r, 'id')}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition"
                      >
                        <span>🪪</span>
                        <span>ID</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">None</span>
                  )}
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
                          🔍
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => openPreview(r, 'selfie')}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md transition"
                      >
                        <span>🤳</span>
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

      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Staff Access Requests</h2>
          <p className="text-xs text-slate-500 mt-0.5">Requests for administrative access to the Civic Ledger portal.</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">FULL NAME</th>
              <th className="px-5 py-3 font-medium">SEX</th>
              <th className="px-5 py-3 font-medium">CONTACT</th>
              <th className="px-5 py-3 font-medium">EMAIL</th>
              <th className="px-5 py-3 font-medium">DEPARTMENT</th>
              <th className="px-5 py-3 font-medium">EMPLOYEE ID</th>
              <th className="px-5 py-3 font-medium">ID CARD</th>
              <th className="px-5 py-3 font-medium">SELFIE W/ ID</th>
              <th className="px-5 py-3 font-medium">REQUESTED</th>
              <th className="px-5 py-3 font-medium">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="px-5 py-6 text-center text-slate-400">
                  Loading requests…
                </td>
              </tr>
            )}
            {!loading && requests.length === 0 && (
              <tr>
                <td colSpan={10} className="px-5 py-6 text-center text-slate-400">
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
                        onClick={() => openPreview(r, 'id')}
                        className="relative group w-9 h-9 rounded-lg overflow-hidden border border-slate-200 hover:border-blue-500 transition shrink-0 cursor-pointer shadow-xs bg-slate-100"
                        title="Click to preview ID photo"
                      >
                        <img
                          src={r.idDocumentUrl}
                          alt={r.fullName}
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                          🔍
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => openPreview(r, 'id')}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition"
                      >
                        <span>🪪</span>
                        <span>ID</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">None</span>
                  )}
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
                          🔍
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => openPreview(r, 'selfie')}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md transition"
                      >
                        <span>🤳</span>
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
                ✕
              </button>
            </div>

            {/* Tab switchers if both photos exist */}
            {previewDoc.idUrl && previewDoc.selfieUrl && (
              <div className="flex items-center gap-2 pt-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewDoc((p) => ({ ...p, tab: 'compare' }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    previewDoc.tab === 'compare'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  🔍 Side-by-Side Comparison
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc((p) => ({ ...p, tab: 'id' }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    previewDoc.tab === 'id'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  🪪 Valid ID Card Only
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc((p) => ({ ...p, tab: 'selfie' }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    previewDoc.tab === 'selfie'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  🤳 Selfie Holding ID Only
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div className="my-4 overflow-y-auto flex-1">
              {previewDoc.tab === 'compare' && previewDoc.idUrl && previewDoc.selfieUrl ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: ID Card */}
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-col">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <span>🪪</span> Valid ID Card
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
                        <span>🤳</span> Selfie Holding ID
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
                    <span className="text-xs font-semibold text-slate-600">
                      {previewDoc.tab === 'selfie' ? '🤳 Selfie Holding Valid ID' : '🪪 Valid ID Card'}
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
