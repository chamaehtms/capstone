import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function EnrollResident() {
  const [form, setForm] = useState({
    fullName: '',
    birthDate: '',
    gender: '',
    occupation: '',
    address: '',
    zone: '',
    residencyYears: '',
    contact: '',
    email: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const navigate = useNavigate();

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
      const { data } = await api.post('/residents', form);

      if (photoFile) {
        setUploadingPhoto(true);
        const formData = new FormData();
        formData.append('photo', photoFile);
        await api.post(`/residents/${data.id}/photo`, formData);
        setUploadingPhoto(false);
      }

      navigate(`/residents/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to enroll resident.');
    } finally {
      setLoading(false);
      setUploadingPhoto(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Enroll New Resident</h1>
        <p className="text-sm text-slate-500">
          Please ensure all administrative data matches the provided physical documentation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-4">📷 Photo</h2>
          <div className="flex items-center gap-4">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Resident preview"
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
              <p className="text-xs text-slate-400 mt-1">JPG or PNG, up to 5MB. Optional.</p>
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
                placeholder="e.g. Juan De La Cruz"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                BIRTH DATE <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.birthDate}
                onChange={update('birthDate')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                GENDER <span className="text-red-500">*</span>
              </label>
              <select
                value={form.gender}
                onChange={update('gender')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Gender</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                OCCUPATION <span className="text-red-500">*</span>
              </label>
              <input
                value={form.occupation}
                onChange={update('occupation')}
                placeholder="e.g. Civil Engineer"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
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
                placeholder="House No, Street, Barangay"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                ZONE / PUROK <span className="text-red-500">*</span>
              </label>
              <input
                value={form.zone}
                onChange={update('zone')}
                placeholder="e.g. Zone 2 - Bravo"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                LENGTH OF RESIDENCY (YEARS) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={form.residencyYears}
                onChange={update('residencyYears')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-4">📞 Contact Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">
                MOBILE NUMBER <span className="text-red-500">*</span>
              </label>
              <input
                value={form.contact}
                onChange={update('contact')}
                placeholder="+63 9XX XXX XXXX"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                EMAIL <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={update('email')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
          >
            Save Draft
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-60"
          >
            {loading ? (uploadingPhoto ? 'Uploading photo…' : 'Confirming…') : 'Confirm Enrollment'}
          </button>
        </div>
      </form>
    </div>
  );
}
