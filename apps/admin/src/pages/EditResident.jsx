import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api';

export default function EditResident() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    api
      .get(`/residents/${id}`)
      .then((res) => {
        const r = res.data;
        setForm({
          fullName: r.fullName || '',
          birthDate: r.birthDate ? r.birthDate.slice(0, 10) : '',
          gender: r.gender || '',
          occupation: r.occupation || '',
          address: r.address || '',
          zone: r.zone || '',
          residencyYears: r.residencyYears || 0,
          contact: r.contact || '',
          email: r.email || '',
          status: r.status || 'Pending',
          placeOfBirth: r.placeOfBirth || '',
          bloodType: r.bloodType || '',
          education: r.education || '',
        });
        setPhotoUrl(r.photoUrl || '');
      })
      .catch(() => setLoadError('Resident not found.'));
  }, [id]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.put(`/residents/${id}`, form);

      if (photoFile) {
        setUploadingPhoto(true);
        const formData = new FormData();
        formData.append('photo', photoFile);
        await api.post(`/residents/${id}/photo`, formData);
        setUploadingPhoto(false);
      }

      navigate(`/residents/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save changes.');
    } finally {
      setLoading(false);
      setUploadingPhoto(false);
    }
  };

  if (loadError) return <p className="text-red-600">{loadError}</p>;
  if (!form) return <p className="text-slate-500">Loading resident…</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <Link to={`/residents/${id}`} className="text-sm text-blue-600 hover:underline">
        ← Back to Resident Profile
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Edit Resident</h1>
        <p className="text-sm text-slate-500">Update this resident's records below.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-4">📷 Photo</h2>
          <div className="flex items-center gap-4">
            {photoPreview || photoUrl ? (
              <img
                src={photoPreview || photoUrl}
                alt="Resident"
                className="h-20 w-20 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                No Photo
              </div>
            )}
            <div>
              <label className="inline-block px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer">
                Choose Photo
                <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
              </label>
              <p className="text-xs text-slate-400 mt-1">JPG or PNG, up to 5MB.</p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-4">👤 Personal Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">
                FULL NAME <span className="text-red-500">*</span>
              </label>
              <input
                value={form.fullName}
                onChange={update('fullName')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">BIRTH DATE</label>
              <input
                type="date"
                value={form.birthDate}
                onChange={update('birthDate')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">GENDER</label>
              <select
                value={form.gender}
                onChange={update('gender')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Gender</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">OCCUPATION</label>
              <input
                value={form.occupation}
                onChange={update('occupation')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">PLACE OF BIRTH</label>
              <input
                value={form.placeOfBirth}
                onChange={update('placeOfBirth')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">BLOOD TYPE</label>
              <input
                value={form.bloodType}
                onChange={update('bloodType')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">EDUCATION</label>
              <input
                value={form.education}
                onChange={update('education')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">STATUS</label>
              <select
                value={form.status}
                onChange={update('status')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Pending</option>
                <option>Verified</option>
              </select>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-4">📍 Residential Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600">
                PERMANENT ADDRESS <span className="text-red-500">*</span>
              </label>
              <input
                value={form.address}
                onChange={update('address')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">ZONE / PUROK</label>
              <input
                value={form.zone}
                onChange={update('zone')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">LENGTH OF RESIDENCY (YEARS)</label>
              <input
                type="number"
                min="0"
                value={form.residencyYears}
                onChange={update('residencyYears')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-4">📞 Contact Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">MOBILE NUMBER</label>
              <input
                value={form.contact}
                onChange={update('contact')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">EMAIL</label>
              <input
                type="email"
                value={form.email}
                onChange={update('email')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <Link
            to={`/residents/${id}`}
            className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-60"
          >
            {loading ? (uploadingPhoto ? 'Uploading photo…' : 'Saving…') : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
