import React, { useEffect, useState } from 'react';
import api from '../api';

const TAGS = ['General', 'Advisory', 'Event', 'Health', 'Safety', 'Utilities'];

const emptyForm = { title: '', tag: 'General', body: '', eventDate: '' };

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const load = () =>
    api.get('/announcements').then((res) => {
      setAnnouncements(res.data);
      setLoading(false);
    });

  useEffect(() => {
    load();
  }, []);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  function handleImageSelect(e) {
    const file = e.target.files?.[0];
    setError('');
    if (!file) { setImage(null); setImagePreview(''); return; }
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image is too large — max size is 5MB.'); return; }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handlePost(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('tag', form.tag);
      fd.append('body', form.body);
      fd.append('eventDate', form.eventDate);
      if (image) fd.append('image', image);
      await api.post('/announcements', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm(emptyForm);
      setImage(null);
      setImagePreview('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to post announcement.');
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      await api.delete(`/announcements/${id}`);
      await load();
    } catch {
      setError('Unable to delete that announcement.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
        <p className="text-sm text-slate-500">
          Posted here, these appear immediately on every resident's Dashboard in the Residents Portal.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Post a New Announcement</h2>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</div>}
        <form onSubmit={handlePost} className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-slate-500">Title</label>
              <input
                value={form.title}
                onChange={update('title')}
                placeholder="e.g. Water Interruption Notice"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Tag</label>
              <select
                value={form.tag}
                onChange={update('tag')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TAGS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Details</label>
            <textarea
              value={form.body}
              onChange={update('body')}
              rows={3}
              placeholder="What residents need to know…"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Photo (optional)</label>
            <div className="mt-1 flex items-center gap-3">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-slate-200" />
              ) : (
                <div className="w-16 h-16 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-300 text-xl">🖼️</div>
              )}
              <label className="text-sm text-blue-600 hover:underline cursor-pointer">
                {imagePreview ? 'Change photo' : 'Upload a photo'}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              </label>
              {imagePreview && (
                <button
                  type="button"
                  onClick={() => { setImage(null); setImagePreview(''); }}
                  className="text-xs text-slate-400 hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">JPG or PNG, up to 5MB. Shown on the resident Dashboard.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-xs font-medium text-slate-500">Event Date (optional)</label>
              <input
                type="date"
                value={form.eventDate}
                onChange={update('eventDate')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={posting}
                className="bg-navy-900 hover:bg-navy-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-5 py-2.5"
              >
                {posting ? 'Posting…' : 'Post Announcement'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Posted Announcements</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {loading && <p className="px-5 py-6 text-center text-slate-400 text-sm">Loading announcements…</p>}
          {!loading && announcements.length === 0 && (
            <p className="px-5 py-6 text-center text-slate-400 text-sm">
              Nothing posted yet — residents won't see anything on their Dashboard until you post one.
            </p>
          )}
          {announcements.map((a) => (
            <div key={a.id} className="px-5 py-4 flex items-start justify-between gap-4">
              {a.imageUrl && (
                <img src={a.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-100 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{a.tag || 'General'}</span>
                  <p className="font-medium text-slate-800">{a.title}</p>
                </div>
                {a.body && <p className="text-sm text-slate-500 mt-1">{a.body}</p>}
                <p className="text-xs text-slate-400 mt-1">
                  {a.eventDate ? `Event: ${a.eventDate} · ` : ''}
                  Posted {new Date(a.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => handleDelete(a.id)}
                disabled={deletingId === a.id}
                className="text-xs text-red-600 hover:underline whitespace-nowrap disabled:opacity-60"
              >
                {deletingId === a.id ? 'Removing…' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
