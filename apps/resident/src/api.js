// api.js — shared fetch helper + auth/session utilities
//
// This portal now talks to the same backend that powers the admin
// dashboard: resident accounts live in the shared `residents` table and
// complaints filed here land in the shared `complaints` table, so barangay
// staff see them immediately and status updates they make flow back into
// this app.
//
// The admin backend's resident-facing routes (`/resident-auth/*`,
// `/resident/complaints`, `/announcements`) use slightly different field
// names and response shapes than this portal's original UI was built
// against. Rather than rewrite every page, the adapter functions below
// translate in both directions so the pages can keep working with the
// same field names as before (user.firstName, user.purok, complaint.nature,
// complaint.caseRef, etc).
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
// The backend also serves uploaded files (photos, evidence) as plain
// static paths like "/uploads/residents/xxx.jpg" — relative to the
// backend's own origin, not this frontend's dev server (they run on
// different ports). Derive that origin from API_BASE so <img src="...">
// resolves correctly wherever the backend actually runs.
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

// Turn a relative upload path returned by the backend (e.g. photoUrl,
// attachmentUrl) into an absolute URL this frontend can actually load.
export function toAssetUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  return API_ORIGIN + path;
}

export const Session = {
  getToken: () => localStorage.getItem('bp_token'),
  setToken: (t) => localStorage.setItem('bp_token', t),
  clear: () => { localStorage.removeItem('bp_token'); localStorage.removeItem('bp_user'); },
  getUser: () => { try { return JSON.parse(localStorage.getItem('bp_user')); } catch { return null; } },
  setUser: (u) => localStorage.setItem('bp_user', JSON.stringify(u)),
  isLoggedIn: () => !!localStorage.getItem('bp_token')
};

// Low-level fetch helper. `body` may be a plain object (sent as JSON) or a
// FormData instance (sent as multipart — the admin backend uses multer for
// the ID-document and complaint-evidence uploads). FormData must NOT get a
// Content-Type header; the browser sets its own multipart boundary.
async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (auth && Session.getToken()) headers['Authorization'] = `Bearer ${Session.getToken()}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : (isFormData ? body : JSON.stringify(body))
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

// Kept for any direct/simple calls.
export const api = request;

export function initials(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export function statusBadgeClass(status) {
  if (status === 'Resolved') return 'resolved';
  if (status === 'Closed') return 'closed';
  return 'progress';
}

// ---------------------------------------------------------------------
// Shape adapters (admin backend  <->  this portal's original field names)
// ---------------------------------------------------------------------

function toLegacyUser(r) {
  const parts = (r.fullName || '').trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || '';
  const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
  const middleName = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';
  return {
    id: r.id,
    residentCode: r.id,
    email: r.email,
    firstName,
    middleName,
    lastName,
    fullName: r.fullName,
    dateOfBirth: r.birthDate,
    sex: r.gender,
    contactNumber: r.contact,
    purok: r.zone,
    civilStatus: r.civilStatus,
    residentId: r.id,
    communityPoints: r.communityPoints || 0,
    tier: r.tier,
    twoFactorEnabled: !!r.twoFactorEnabled,
    pushNotifications: !!r.pushNotifications,
    emailAnnouncements: !!r.emailAnnouncements,
    language: r.language,
    role: 'resident',
    photoUrl: r.photoUrl,
    idDocumentUrl: r.idDocumentUrl,
    selfieIdUrl: r.selfieIdUrl
  };
}

const STAGE_BY_STATUS = { Submitted: 1, Pending: 1, 'Under Review': 2, 'In Progress': 2, Mediation: 2, Resolved: 3, Closed: 3 };

function toLegacyComplaint(c) {
  const isAgainstMe = c.isAgainstMe === true;
  return {
    id: c.id,
    caseRef: c.id,       // the admin backend's complaint id IS the case/tracking ref (e.g. BC-2026-00001)
    trackingId: c.id,
    category: c.category,
    nature: c.description || c.narrative || c.category,
    barangayCaseNo: '',
    complainantName: isAgainstMe ? 'Confidential Complainant' : (c.resident || c.complainantName),
    complainantAddress: isAgainstMe ? null : c.complainantAddress,
    respondentName: c.respondent,
    narrative: c.narrative,
    reliefSought: c.reliefSought,
    status: c.status,
    stage: STAGE_BY_STATUS[c.status] || 1,
    mediationDate: c.mediationDate || null,
    mediationTime: c.mediationTime || null,
    mediationVenue: c.mediationVenue || null,
    mediator: c.mediator || null,
    hearingStage: c.hearingStage || null,
    nextMediationDate: c.nextMediationDate || null,
    nextMediationTime: c.nextMediationTime || null,
    nextMediationVenue: c.nextMediationVenue || null,
    createdAt: c.submittedAt || c.filingDate,
    filingDate: c.filingDate || c.submittedAt,
    isFiledByMe: c.isFiledByMe !== false && !isAgainstMe,
    isAgainstMe,
    role: c.role || (isAgainstMe ? 'respondent' : 'complainant'),
    updatedAt: c.resolvedAt || c.underReviewAt || c.submittedAt,
    events: [] // the admin backend drives progress off status/stage rather than a logged event timeline
  };
}

// This form's "category" query param (?category=complaint|infrastructure,
// set by Services.jsx) maps to the admin backend's category values, which
// control its BC-/IN- prefixed case IDs.
const CATEGORY_MAP = {
  complaint: 'Formal Complaint',
  infrastructure: 'Infrastructure'
};

// ---------------------------------------------------------------------
// Public API used by pages
// ---------------------------------------------------------------------

export async function login(identifier, password) {
  const data = await request('/resident-auth/login', { method: 'POST', body: { email: identifier, password }, auth: false });
  return { token: data.token, user: toLegacyUser(data.resident) };
}

export async function register(form) {
  const fd = new FormData();
  fd.append('firstName', form.firstName || '');
  fd.append('middleName', form.middleName || '');
  fd.append('lastName', form.lastName || '');
  fd.append('birthDate', form.dateOfBirth || '');
  fd.append('gender', form.sex || '');
  fd.append('contact', form.contactNumber || '');
  fd.append('zone', form.purok || '');
  fd.append('email', form.email || '');
  fd.append('password', form.password || '');
  if (form.idDocument) fd.append('idDocument', form.idDocument);
  if (form.selfieWithId) fd.append('selfieWithId', form.selfieWithId);
  const data = await request('/resident-auth/register', { method: 'POST', body: fd, auth: false });
  return {
    pending: !!data.pending,
    verificationRequired: !!data.verificationRequired,
    email: data.email,
    message: data.message,
    user: data.resident ? toLegacyUser(data.resident) : null,
  };
}

export async function verifyRegistrationEmail(email, code) {
  return request('/resident-auth/verify-email', {
    method: 'POST',
    body: { email, code },
    auth: false,
  });
}

export async function resendRegistrationCode(email) {
  return request('/resident-auth/resend-email-code', {
    method: 'POST',
    body: { email },
    auth: false,
  });
}

export async function getProfile() {
  const [resident, rawComplaints] = await Promise.all([
    request('/resident-auth/me'),
    request('/resident/complaints').catch(() => [])
  ]);
  const complaints = rawComplaints.map(toLegacyComplaint);
  const filedByMe = complaints.filter(c => !c.isAgainstMe);
  const againstMe = complaints.filter(c => c.isAgainstMe);
  const resolvedFiled = filedByMe.filter(c => c.status === 'Resolved').length;
  const activeAgainstMe = againstMe.filter(c => c.status !== 'Resolved' && c.status !== 'Closed').length;

  return {
    user: toLegacyUser(resident),
    complaintsFiled: filedByMe.length,
    complaintsResolved: resolvedFiled,
    complaintsAgainstMe: againstMe.length,
    activeComplaintsAgainstMe: activeAgainstMe,
    complaintsList: complaints,
    complaintsAgainstMeList: againstMe,
    filedByMeList: filedByMe,
  };
}

export async function updateSecurity({ twoFactorEnabled }) {
  const resident = await request('/resident-auth/preferences', { method: 'PUT', body: { twoFactorEnabled } });
  return { user: toLegacyUser(resident) };
}

export async function updatePreferences(patch) {
  const resident = await request('/resident-auth/preferences', { method: 'PUT', body: patch });
  return { user: toLegacyUser(resident) };
}

// Edit the resident's own profile fields (name, birthdate, gender, civil
// status, contact, purok/zone) — separate from updateSecurity/updatePreferences,
// which only touch account settings, not identity fields.
export async function updateProfile(form) {
  const resident = await request('/resident-auth/me', {
    method: 'PUT',
    body: {
      fullName: form.fullName,
      birthDate: form.dateOfBirth,
      gender: form.sex,
      civilStatus: form.civilStatus,
      contact: form.contactNumber,
      zone: form.purok,
    },
  });
  return { user: toLegacyUser(resident) };
}

export async function changePassword(currentPassword, newPassword) {
  return request('/resident-auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}

export async function uploadProfilePhoto(file) {
  const fd = new FormData();
  fd.append('photo', file);
  const resident = await request('/resident-auth/me/photo', { method: 'POST', body: fd });
  return { user: toLegacyUser(resident) };
}

export async function forgotPassword(email) {
  return request('/resident-auth/forgot-password', { method: 'POST', body: { email }, auth: false });
}

export async function fileComplaint(body) {
  const fd = new FormData();
  fd.append('category', CATEGORY_MAP[body.category] || 'Formal Complaint');
  fd.append('description', body.nature || '');
  fd.append('respondent', body.respondentName || '');
  fd.append('complainantAddress', body.complainantAddress || '');
  fd.append('narrative', body.narrative || '');
  fd.append('reliefSought', body.reliefSought || '');
  if (body.evidence) fd.append('evidence', body.evidence);
  const complaint = await request('/resident/complaints', { method: 'POST', body: fd });
  return toLegacyComplaint(complaint);
}

export async function getMyComplaints() {
  const rows = await request('/resident/complaints');
  return rows.map(toLegacyComplaint);
}

export async function getMyEscalations() {
  return request('/resident/complaints/escalations');
}

export async function getMyMediations() {
  return request('/resident/complaints/mediations').catch(() => []);
}

export async function trackComplaint(ref) {
  const c = await request(`/resident/complaints/${encodeURIComponent(ref)}`);
  return toLegacyComplaint(c);
}

export async function getAnnouncements() {
  return request('/announcements', { auth: false });
}

export async function getMyNotifications() {
  return request('/resident/complaints/notifications').catch(() => []);
}

export async function markNotificationsRead(id) {
  return request('/resident/complaints/notifications/mark-read', {
    method: 'POST',
    body: { id },
  }).catch(() => {});
}
