import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ResidentProfile() {
  const { id } = useParams();
  const [resident, setResident] = useState(null);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState(false);

  const load = () => api
    .get(`/residents/${id}`)
    .then((res) => setResident(res.data))
    .catch(() => setError('Resident not found.'));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function approve() {
    setApproving(true);
    try {
      await api.put(`/residents/${id}`, { status: 'Verified' });
      await load();
    } catch {
      setError('Unable to approve this resident. Please try again.');
    } finally {
      setApproving(false);
    }
  }

  if (error) return <p className="text-red-600">{error}</p>;
  if (!resident) return <p className="text-slate-500">Loading resident…</p>;

  return (
    <div className="space-y-6">
      <Link to="/residents" className="text-sm text-blue-600 hover:underline">
        ← Back to Resident Records
      </Link>

      {resident.status === 'Pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-800">Pending Approval</p>
            <p className="text-xs text-amber-700">
              This resident self-registered through the portal and can't sign in until approved.
            </p>
          </div>
          <button
            onClick={approve}
            disabled={approving}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2 whitespace-nowrap"
          >
            {approving ? 'Approving…' : '✓ Approve Account'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {resident.photoUrl ? (
            <img
              src={resident.photoUrl}
              alt={resident.fullName}
              className="h-16 w-16 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-semibold">
              {resident.fullName ? resident.fullName.slice(0, 2).toUpperCase() : '?'}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-900">{resident.fullName}</h1>
            <p className="text-sm text-slate-500">
              Registry ID: {resident.id} · {resident.address}
            </p>
          </div>
        </div>
        <Link
          to={`/residents/${resident.id}/edit`}
          className="bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium rounded-lg px-4 py-2"
        >
          Edit Profile
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Constituent Records</h2>
          <div className="grid grid-cols-2 gap-y-4 text-sm">
            <div>
              <p className="text-xs text-slate-400">FULL LEGAL NAME</p>
              <p className="font-medium text-slate-800">{resident.fullName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">DATE OF BIRTH</p>
              <p className="font-medium text-slate-800">
                {formatDate(resident.birthDate) || '-'} {resident.age ? `(Age: ${resident.age})` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">PLACE OF BIRTH</p>
              <p className="font-medium text-slate-800">{resident.placeOfBirth || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">BLOOD TYPE</p>
              <p className="font-medium text-slate-800">{resident.bloodType || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">OCCUPATION</p>
              <p className="font-medium text-slate-800">{resident.occupation || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">EDUCATION</p>
              <p className="font-medium text-slate-800">{resident.education || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">CONTACT EMAIL</p>
              <p className="font-medium text-blue-600">{resident.email || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">MOBILE NUMBER</p>
              <p className="font-medium text-slate-800">{resident.contact || '-'}</p>
            </div>
          </div>

          {(resident.idDocumentUrl || resident.selfieIdUrl) && (
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Identity Verification Documents
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {resident.idDocumentUrl && (
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700">🪪 Valid ID Document</span>
                      <a
                        href={resident.idDocumentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-600 hover:underline"
                      >
                        ↗ Open full
                      </a>
                    </div>
                    <div className="h-40 w-full flex items-center justify-center bg-white rounded-lg border border-slate-200 p-1.5 overflow-hidden">
                      <img
                        src={resident.idDocumentUrl}
                        alt="Valid ID"
                        className="h-full w-auto object-contain rounded"
                      />
                    </div>
                  </div>
                )}
                {resident.selfieIdUrl && (
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700">🤳 Selfie Holding Valid ID</span>
                      <a
                        href={resident.selfieIdUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-purple-700 hover:underline"
                      >
                        ↗ Open full
                      </a>
                    </div>
                    <div className="h-40 w-full flex items-center justify-center bg-white rounded-lg border border-slate-200 p-1.5 overflow-hidden">
                      <img
                        src={resident.selfieIdUrl}
                        alt="Selfie Holding ID"
                        className="h-full w-auto object-contain rounded"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-xs text-slate-400">RESIDENTIAL ZONE</p>
            <p className="font-semibold text-slate-800">{resident.zone}</p>
            <p className="text-xs text-slate-400 mt-3">RESIDENCY PERIOD</p>
            <p className="text-sm text-slate-600">{resident.residencyYears || 0} yrs, Barangay Poblacion</p>
          </div>

          <div className="bg-navy-900 text-white rounded-xl shadow-sm p-5">
            <p className="text-xs text-slate-300">COMPLIANCE</p>
            <div className="flex items-center justify-between mt-2 text-sm">
              <span>Voter Registration</span>
              <span className="text-green-400 font-medium">Active</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-sm">
              <span>Barangay Clearance</span>
              <span className="text-green-400 font-medium">Active</span>
            </div>
            <button className="w-full mt-4 bg-white/10 hover:bg-white/20 rounded-lg py-2 text-xs font-medium">
              Request Renewal Visit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
