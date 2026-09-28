import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';

export default function Settings() {
  const { admin, updateAdmin } = useAuth();
  const [account, setAccount] = useState(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoMessage, setPhotoMessage] = useState('');

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setAccount(res.data))
      .catch(() => setAccount(admin));
  }, [admin]);

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handlePhotoUpload = async () => {
    if (!photoFile) return;
    setPhotoError('');
    setPhotoMessage('');
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', photoFile);
      const { data } = await api.post('/auth/me/photo', formData);
      setAccount(data);
      updateAdmin({ photoUrl: data.photoUrl });
      setPhotoFile(null);
      setPhotoPreview('');
      setPhotoMessage('Profile picture updated.');
    } catch (err) {
      setPhotoError(err.response?.data?.message || 'Unable to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/change-password', { currentPassword, newPassword });
      setMessage(data.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update password.');
    } finally {
      setLoading(false);
    }
  };

  const initials = account?.fullName ? account.fullName.slice(0, 2).toUpperCase() : 'AD';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Manage your account details and security.</p>
      </div>

      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Profile Picture</h2>
        <div className="flex items-center gap-5">
          {photoPreview || account?.photoUrl ? (
            <img
              src={photoPreview || account.photoUrl}
              alt="Profile"
              className="h-20 w-20 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-semibold">
              {initials}
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="inline-block px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer">
                Choose Photo
                <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
              </label>
              {photoFile && (
                <button
                  onClick={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-60"
                >
                  {uploadingPhoto ? 'Uploading…' : 'Save Photo'}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400">JPG or PNG, up to 5MB.</p>
            {photoError && <p className="text-sm text-red-600">{photoError}</p>}
            {photoMessage && <p className="text-sm text-green-600">{photoMessage}</p>}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Account Information</h2>
        <div className="grid grid-cols-2 gap-y-4 text-sm">
          <div>
            <p className="text-xs text-slate-400">FULL NAME</p>
            <p className="font-medium text-slate-800">{account?.fullName || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">INSTITUTIONAL ID</p>
            <p className="font-medium text-slate-800">{account?.institutionalId || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">EMAIL</p>
            <p className="font-medium text-slate-800">{account?.email || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">DEPARTMENT</p>
            <p className="font-medium text-slate-800">{account?.department || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">ROLE</p>
            <p className="font-medium text-slate-800">{account?.role || '—'}</p>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-600">CURRENT PASSWORD</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">NEW PASSWORD</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">CONFIRM NEW PASSWORD</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                minLength={8}
                required
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium disabled:opacity-60"
            >
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
