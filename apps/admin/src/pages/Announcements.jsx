import React, { useEffect, useState } from 'react';
import api, { toAssetUrl } from '../api';
import AdminIcon from '../components/AdminIcons.jsx';

const TAGS = ['General', 'Advisory', 'Event', 'Health', 'Safety', 'Utilities'];

const emptyForm = { title: '', tag: 'General', body: '', eventDate: '' };

function getTodayManilaDateString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingOriginalDate, setEditingOriginalDate] = useState('');
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const todayManila = getTodayManilaDateString();

  const load = () => {
    setLoading(true);
    api.get('/announcements')
      .then((res) => {
        setAnnouncements(res.data);
      })
      .catch((err) => {
        console.error(err);
        setError('Unable to load announcements.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  function handleDateChange(e) {
    const selectedDate = e.target.value;
    setError('');

    // If an existing announcement originally had a past date and the user keeps it, allow it.
    // Otherwise, prevent selecting or manually entering any past date.
    if (selectedDate && selectedDate < todayManila && selectedDate !== editingOriginalDate) {
      setError('Event date cannot be in the past. Please select today or a future date.');
      return;
    }

    setForm({ ...form, eventDate: selectedDate });
  }

  function handleImageSelect(e) {
    const file = e.target.files?.[0];
    setError('');
    if (!file) { setImage(null); setImagePreview(''); return; }
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image is too large — max size is 5MB.'); return; }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    setRemoveExistingImage(false);
  }

  function handleStartEdit(a) {
    const rawDate = a.eventDate ? a.eventDate.split('T')[0] : '';
    setEditingId(a.id);
    setEditingOriginalDate(rawDate);
    setForm({
      title: a.title || '',
      tag: a.tag || 'General',
      body: a.body || '',
      eventDate: rawDate,
    });
    setImage(null);
    setImagePreview(a.imageUrl || '');
    setRemoveExistingImage(false);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditingOriginalDate('');
    setForm(emptyForm);
    setImage(null);
    setImagePreview('');
    setRemoveExistingImage(false);
    setError('');
  }

  async function handlePost(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }

    // Validate date against current Philippine date
    if (form.eventDate) {
      const cleanDate = form.eventDate.split('T')[0];
      if (cleanDate < todayManila && cleanDate !== editingOriginalDate) {
        setError('Event date cannot be in the past. Please select today or a future date.');
        return;
      }
    }

    setPosting(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('tag', form.tag);
      fd.append('body', form.body);
      fd.append('eventDate', form.eventDate);
      if (image) {
        fd.append('image', image);
      } else if (editingId && removeExistingImage) {
        fd.append('removeImage', 'true');
      }

      if (editingId) {
        await api.put(`/announcements/${editingId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/announcements', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      handleCancelEdit();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || (editingId ? 'Unable to update announcement.' : 'Unable to post announcement.'));
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/announcements/${id}`);
      if (editingId === id) {
        handleCancelEdit();
      }
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

      <div className={`bg-white rounded-xl shadow-sm p-6 transition-all ${editingId ? 'ring-2 ring-blue-500' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-800">
              {editingId ? 'Edit Announcement' : 'Post a New Announcement'}
            </h2>
            {editingId && (
              <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-md">
                Editing
              </span>
            )}
          </div>
          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium underline"
            >
              Cancel Edit
            </button>
          )}
        </div>
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
                <div className="w-16 h-16 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 bg-slate-50">
                  <AdminIcon name="image" size={24} />
                </div>
              )}
              <label className="text-sm text-blue-600 hover:underline cursor-pointer">
                {imagePreview ? 'Change photo' : 'Upload a photo'}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              </label>
              {imagePreview && (
                <button
                  type="button"
                  onClick={() => {
                    setImage(null);
                    setImagePreview('');
                    setRemoveExistingImage(true);
                  }}
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
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500">Event Date (optional)</label>
                {form.eventDate && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, eventDate: '' })}
                    className="text-[11px] text-slate-400 hover:text-red-500"
                  >
                    Clear date
                  </button>
                )}
              </div>
              <input
                type="date"
                min={editingId && editingOriginalDate && editingOriginalDate < todayManila ? editingOriginalDate : todayManila}
                value={form.eventDate}
                onChange={handleDateChange}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {editingId && editingOriginalDate && editingOriginalDate < todayManila && form.eventDate === editingOriginalDate ? (
                  <span className="text-amber-600 font-medium">Historical date preserved. To change, pick today or a future date.</span>
                ) : (
                  <span>Only today and future dates (PH Time) can be selected.</span>
                )}
              </p>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={posting}
                  className="border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={posting}
                className="bg-navy-900 hover:bg-navy-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-5 py-2.5 transition-colors flex items-center gap-2"
              >
                {posting ? (
                  editingId ? 'Saving…' : 'Posting…'
                ) : (
                  editingId ? 'Save Changes' : 'Post Announcement'
                )}
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
            <div
              key={a.id}
              className={`px-5 py-4 flex items-start justify-between gap-4 transition-colors ${
                editingId === a.id ? 'bg-blue-50/60' : ''
              }`}
            >
              {a.imageUrl && (
                <img src={toAssetUrl(a.imageUrl)} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-100 flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">{a.tag || 'General'}</span>
                  <p className="font-medium text-slate-800">{a.title}</p>
                </div>
                {a.body && <p className="text-sm text-slate-500 mt-1">{a.body}</p>}
                <p className="text-xs text-slate-400 mt-1">
                  {a.eventDate ? `Event: ${a.eventDate} · ` : ''}
                  Posted {new Date(a.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleStartEdit(a)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 hover:underline"
                >
                  <AdminIcon name="edit" size={13} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="text-xs text-red-600 hover:underline whitespace-nowrap disabled:opacity-60"
                >
                  {deletingId === a.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
