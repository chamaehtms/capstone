const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../db/pool');
const { requireResidentAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireResidentAuth);

// Case ID prefixes by category, matching the resident-app mockups
// (e.g. "PS-2024-0891" for Public Safety/Nuisance, "BC-2024-00123" for a
// formal Barangay Complaint/blotter). Anything else falls back to "CASE".
const PREFIXES = {
  'Public Nuisance': 'PS',
  'Noise Complaint': 'PS',
  'Infrastructure': 'IN',
  'Public Works': 'IN',
  'Formal Complaint': 'BC',
};

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'complaint-evidence');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `evidence-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for video/document evidence
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/') ||
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/msword' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (!ok) {
      return cb(new Error('Only image, video, PDF, or document evidence files are allowed.'));
    }
    cb(null, true);
  },
});

async function hasValidFileSignature(file) {
  const header = await fs.promises.readFile(file.path, { encoding: null });
  if (file.mimetype === 'image/jpeg') return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (file.mimetype === 'image/png') return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimetype === 'image/gif') return header.subarray(0, 4).toString('ascii') === 'GIF8';
  if (file.mimetype === 'image/webp') return header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP';
  if (file.mimetype === 'application/pdf') return header.subarray(0, 5).toString('ascii') === '%PDF-';
  if (file.mimetype.startsWith('video/')) return true;
  if (file.mimetype.includes('word') || file.mimetype.includes('officedocument')) return true;
  return false;
}

async function scanWithSightengine(file) {
  if (!file || !file.mimetype.startsWith('image/')) return { status: 'manual_review', score: null };
  const userId = process.env.SIGHTENGINE_USER_ID;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;
  if (!userId || !apiSecret) return { status: 'not_configured', score: null };

  try {
    const buffer = await fs.promises.readFile(file.path);
    const form = new FormData();
    form.append('media', new Blob([buffer], { type: file.mimetype }), file.originalname);
    form.append('models', 'genai');
    form.append('api_user', userId);
    form.append('api_secret', apiSecret);
    const response = await fetch('https://api.sightengine.com/1.0/check.json', { method: 'POST', body: form });
    if (!response.ok) throw new Error(`Sightengine returned ${response.status}`);
    const data = await response.json();
    const score = Number(data.type?.ai_generated ?? data.ai_generated ?? data.genai?.ai_generated ?? data.genai?.score);
    if (!Number.isFinite(score)) return { status: 'manual_review', score: null };
    return { status: score >= 0.8 ? 'possibly_ai_generated' : score <= 0.2 ? 'likely_authentic' : 'manual_review', score };
  } catch (err) {
    console.error('[sightengine] scan failed:', err.message);
    return { status: 'provider_unavailable', score: null };
  }
}

function toComplaint(c, currentResidentId) {
  const isFiledByMe = c.filed_by_resident_id && c.filed_by_resident_id === currentResidentId;
  const isAgainstMe = !isFiledByMe;

  return {
    id: c.id,
    // Complainant identity is strictly masked if the resident is the respondent!
    resident: isAgainstMe ? 'Confidential Complainant' : c.resident,
    complainantName: isAgainstMe ? 'Confidential Complainant' : c.resident,
    category: c.category,
    status: c.status,
    filingDate: c.filing_date,
    description: c.description,
    priority: c.priority,
    aiScanStatus: c.ai_scan_status,
    aiScanScore: c.ai_scan_score,
    aiScanCheckedAt: c.ai_scan_checked_at,
    respondent: c.respondent,
    respondentAddress: c.respondent_address,
    complainantAddress: isAgainstMe ? null : c.complainant_address,
    narrative: c.narrative,
    reliefSought: c.relief_sought,
    attachmentUrl: isAgainstMe ? null : c.attachment_url,
    submittedAt: c.created_at,
    underReviewAt: c.under_review_at,
    inProgressAt: c.in_progress_at,
    resolvedAt: c.resolved_at,
    closedAt: c.closed_at,
    assignedTeam: c.assigned_team || 'Maintenance Team',
    mediationDate: c.mediation_date,
    mediationTime: c.mediation_time,
    mediationVenue: c.mediation_venue,
    mediator: c.mediator,
    hearingStage: c.hearing_stage,
    nextMediationDate: c.next_mediation_date || '',
    nextMediationTime: c.next_mediation_time || '',
    nextMediationVenue: c.next_mediation_venue || '',
    isFiledByMe,
    isAgainstMe,
    role: isAgainstMe ? 'respondent' : 'complainant',
  };
}

// POST /api/resident/complaints  (File Complaint - quick or formal blotter)
router.post('/', (req, res) => {
  upload.single('evidence')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ message: uploadErr.message || 'Unable to upload attachment.' });
    }

    try {
      if (req.file && !(await hasValidFileSignature(req.file))) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: 'The evidence file failed type validation. Please upload the original image or PDF.' });
      }
      const {
        category, description, respondent, respondentAddress, complainantAddress,
        narrative, reliefSought,
      } = req.body;

      if (!category) {
        return res.status(400).json({ message: 'Category is required.' });
      }

      const { rows: residentRows } = await pool.query('SELECT full_name FROM residents WHERE id = $1', [req.resident.id]);
      const residentName = residentRows[0]?.full_name || req.resident.fullName || 'Resident';

      const prefix = PREFIXES[category] || 'CASE';
      const year = new Date().getFullYear();
      const { rows: countRows } = await pool.query(
        "SELECT COUNT(*)::int AS count FROM complaints WHERE id LIKE $1",
        [`${prefix}-${year}-%`]
      );
      const seq = String(countRows[0].count + 1).padStart(prefix === 'BC' ? 5 : 4, '0');
      const id = `${prefix}-${year}-${seq}`;

      const attachmentUrl = req.file ? `/uploads/complaint-evidence/${req.file.filename}` : null;
      const aiScan = req.file ? await scanWithSightengine(req.file) : { status: 'not_scanned', score: null };

      const { rows } = await pool.query(
        `INSERT INTO complaints
          (id, resident, category, status, filing_date, description, priority, ai_scan_status, ai_scan_score, ai_scan_checked_at,
           respondent, respondent_address, complainant_address, narrative, relief_sought,
           attachment_url, filed_by_resident_id)
         VALUES ($1,$2,$3,'Pending',CURRENT_DATE,$4,'Normal',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          id, residentName, category, description || narrative || '', aiScan.status, aiScan.score, req.file ? new Date() : null, respondent || null,
          respondentAddress || null, complainantAddress || null, narrative || null,
          reliefSought || null, attachmentUrl, req.resident.id,
        ]
      );

      res.status(201).json(toComplaint(rows[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Database error filing complaint.' });
    }
  });
});

// GET /api/resident/complaints  (Portal Activity / Recent History for the logged-in resident)
router.get('/', async (req, res) => {
  try {
    const residentId = req.resident.id;
    const { rows: rRows } = await pool.query('SELECT id, full_name, email FROM residents WHERE id = $1', [residentId]);
    const resident = rRows[0] || {};
    const fullName = (resident.full_name || req.resident.fullName || '').trim();
    const firstName = fullName.split(/\s+/)[0] || '';

    const { rows } = await pool.query(
      `SELECT * FROM complaints
       WHERE filed_by_resident_id = $1
          OR (
            respondent IS NOT NULL AND TRIM(respondent) <> '' AND (
              LOWER(TRIM(respondent)) = LOWER(TRIM($2))
              OR (LENGTH($3) >= 3 AND LOWER(TRIM(respondent)) = LOWER(TRIM($3)))
              OR (LENGTH(TRIM(respondent)) >= 3 AND LOWER(TRIM($2)) LIKE '%' || LOWER(TRIM(respondent)) || '%')
              OR respondent = $1
            )
          )
       ORDER BY created_at DESC`,
      [residentId, fullName, firstName]
    );
    res.json(rows.map((c) => toComplaint(c, residentId)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading complaints.' });
  }
});

// GET /api/resident/complaints/escalations
// Returns formal escalation letters linked to the logged-in resident's cases.
router.get('/escalations', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.category, e.reason, e.priority, e.status, e.subject, e.case_ref,
              e.created_at, c.id AS complaint_id
       FROM escalations e
       INNER JOIN complaints c ON c.id = e.case_ref
       WHERE c.filed_by_resident_id = $1
       ORDER BY e.created_at DESC`,
      [req.resident.id]
    );
    res.json(rows.map((e) => ({
      id: e.id,
      category: e.category,
      reason: e.reason,
      priority: e.priority,
      status: e.status,
      subject: e.subject,
      caseRef: e.case_ref,
      complaintId: e.complaint_id,
      createdAt: e.created_at,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading escalation updates.' });
  }
});

// GET /api/resident/complaints/mediations
// Returns scheduled mediation hearings for complaints filed by or involving the logged-in resident
router.get('/mediations', async (req, res) => {
  try {
    const residentId = req.resident.id;
    const { rows: rRows } = await pool.query('SELECT id, full_name, email FROM residents WHERE id = $1', [residentId]);
    const resident = rRows[0] || {};
    const residentEmail = resident.email || req.resident.email || '';
    const residentName = (resident.full_name || req.resident.fullName || '').trim();
    const firstName = residentName.split(/\s+/)[0] || '';

    const { rows } = await pool.query(
      `SELECT m.id, m.title, m.date, m.time, m.location, m.case_id,
              m.mediator, m.hearing_stage, m.concerns_raised, m.created_at,
              m.next_meeting_date, m.next_meeting_time, m.next_meeting_venue,
              c.category, c.filed_by_resident_id,
              COALESCE(c.resident, m.resident_name) AS complainant_name,
              COALESCE(c.respondent, m.respondent_name) AS respondent,
              COALESCE(c.status, 'Mediation') AS case_status
       FROM meetings m
       LEFT JOIN complaints c ON c.id = m.case_id
       WHERE m.meeting_type = 'mediation'
         AND (
           c.filed_by_resident_id = $1
           OR m.resident_id = $1
           OR (m.resident_email IS NOT NULL AND m.resident_email <> '' AND LOWER(m.resident_email) = LOWER($2))
           OR (c.resident IS NOT NULL AND LOWER(TRIM(c.resident)) = LOWER(TRIM($3)))
           OR (m.resident_name IS NOT NULL AND LOWER(TRIM(m.resident_name)) = LOWER(TRIM($3)))
           OR (
             c.respondent IS NOT NULL AND TRIM(c.respondent) <> '' AND (
               LOWER(TRIM(c.respondent)) = LOWER(TRIM($3))
               OR (LENGTH($4) >= 3 AND LOWER(TRIM(c.respondent)) = LOWER(TRIM($4)))
               OR (LENGTH(TRIM(c.respondent)) >= 3 AND LOWER(TRIM($3)) LIKE '%' || LOWER(TRIM(c.respondent)) || '%')
             )
           )
           OR (
             m.respondent_name IS NOT NULL AND TRIM(m.respondent_name) <> '' AND (
               LOWER(TRIM(m.respondent_name)) = LOWER(TRIM($3))
               OR (LENGTH($4) >= 3 AND LOWER(TRIM(m.respondent_name)) = LOWER(TRIM($4)))
               OR (LENGTH(TRIM(m.respondent_name)) >= 3 AND LOWER(TRIM($3)) LIKE '%' || LOWER(TRIM(m.respondent_name)) || '%')
             )
           )
         )
       ORDER BY m.date ASC, m.time ASC`,
      [residentId, residentEmail, residentName, firstName]
    );

    res.json(rows.map((m) => {
      const isFiledByMe = m.filed_by_resident_id && m.filed_by_resident_id === residentId;
      const isAgainstMe = !isFiledByMe;
      return {
        id: m.id,
        title: m.title,
        date: m.date,
        time: m.time,
        location: m.location,
        caseId: m.case_id,
        mediator: m.mediator,
        hearingStage: m.hearing_stage,
        notes: m.concerns_raised,
        category: m.category,
        complainantName: isAgainstMe ? 'Confidential Complainant' : m.complainant_name,
        respondent: m.respondent,
        caseStatus: m.case_status,
        nextMeetingDate: m.next_meeting_date || '',
        nextMeetingTime: m.next_meeting_time || '',
        nextMeetingVenue: m.next_meeting_venue || '',
        createdAt: m.created_at,
        isAgainstMe,
      };
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading mediation schedules.' });
  }
});

// GET /api/resident/complaints/notifications
// Returns in-app notifications for the logged-in resident
router.get('/notifications', async (req, res) => {
  try {
    const residentEmail = req.resident.email || '';
    const { rows } = await pool.query(
      `SELECT id, resident_id, resident_email, case_id, title, message, type, link, read, created_at
       FROM notifications
       WHERE resident_id = $1
          OR (resident_email IS NOT NULL AND resident_email <> '' AND LOWER(resident_email) = LOWER($2))
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.resident.id, residentEmail]
    );

    res.json(rows.map((n) => ({
      id: n.id,
      residentId: n.resident_id,
      residentEmail: n.resident_email,
      caseId: n.case_id,
      title: n.title,
      message: n.message,
      type: n.type,
      link: n.link,
      read: !!n.read,
      createdAt: n.created_at,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading notifications.' });
  }
});

// POST /api/resident/complaints/notifications/mark-read
// Marks specific or all notifications as read
router.post('/notifications/mark-read', async (req, res) => {
  try {
    const { id } = req.body || {};
    const residentEmail = req.resident.email || '';
    if (id) {
      await pool.query(
        `UPDATE notifications SET read = true
         WHERE id = $1
           AND (resident_id = $2 OR (resident_email IS NOT NULL AND LOWER(resident_email) = LOWER($3)))`,
        [id, req.resident.id, residentEmail]
      );
    } else {
      await pool.query(
        `UPDATE notifications SET read = true
         WHERE resident_id = $1
            OR (resident_email IS NOT NULL AND resident_email <> '' AND LOWER(resident_email) = LOWER($2))`,
        [req.resident.id, residentEmail]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error marking notifications read.' });
  }
});

// GET /api/resident/complaints/:id  (Track Your Request - lookup by reference ID)
// Scoped to the logged-in resident's own complaints or complaints where they are named respondent
router.get('/:id', async (req, res) => {
  try {
    const residentId = req.resident.id;
    const { rows: rRows } = await pool.query('SELECT id, full_name, email FROM residents WHERE id = $1', [residentId]);
    const resident = rRows[0] || {};
    const fullName = (resident.full_name || req.resident.fullName || '').trim();
    const firstName = fullName.split(/\s+/)[0] || '';

    const { rows } = await pool.query(
      `SELECT * FROM complaints
       WHERE id = $1
         AND (
           filed_by_resident_id = $2
           OR (
             respondent IS NOT NULL AND TRIM(respondent) <> '' AND (
               LOWER(TRIM(respondent)) = LOWER(TRIM($3))
               OR (LENGTH($4) >= 3 AND LOWER(TRIM(respondent)) = LOWER(TRIM($4)))
               OR (LENGTH(TRIM(respondent)) >= 3 AND LOWER(TRIM($3)) LIKE '%' || LOWER(TRIM(respondent)) || '%')
               OR respondent = $2
             )
           )
         )`,
      [req.params.id, residentId, fullName, firstName]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No request found with that reference ID on your account.' });
    }
    res.json(toComplaint(rows[0], residentId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading request.' });
  }
});

module.exports = router;
