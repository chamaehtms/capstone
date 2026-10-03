const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { sendMediationNoticeEmail } = require('../utils/mailer');

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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for video evidence
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

const router = express.Router();
router.use(requireAuth);

function toComplaint(c) {
  return {
    id: c.id,
    resident: c.resident,
    residentEmail: c.resident_account_email || c.resident_email || '',
    residentContact: c.resident_account_contact || '',
    category: c.category,
    status: c.status,
    filingDate: c.filing_date,
    description: c.description,
    priority: c.priority,
    aiScanStatus: c.ai_scan_status,
    aiScanScore: c.ai_scan_score,
    aiScanCheckedAt: c.ai_scan_checked_at,
    needsEscalation: !!c.needs_escalation,
    respondent: c.respondent,
    respondentAddress: c.respondent_address,
    complainantAddress: c.complainant_address,
    narrative: c.narrative,
    reliefSought: c.relief_sought,
    attachmentUrl: c.attachment_url,
    filedByResidentId: c.filed_by_resident_id,
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
  };
}

// GET /api/complaints
router.get('/', async (req, res) => {
  try {
    const { search, category, status } = req.query;
    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conditions.push(`(LOWER(c.id) LIKE $${params.length} OR LOWER(c.resident) LIKE $${params.length})`);
    }
    if (category && category !== 'All Categories') {
      params.push(category);
      conditions.push(`c.category = $${params.length}`);
    }
    if (status && status !== 'All') {
      params.push(status);
      conditions.push(`c.status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT c.*, r.email AS resident_account_email, r.contact AS resident_account_contact
       FROM complaints c
       LEFT JOIN residents r ON (r.id = c.filed_by_resident_id OR LOWER(TRIM(r.full_name)) = LOWER(TRIM(c.resident)))
       ${where}
       ORDER BY c.created_at DESC`,
      params
    );

    const { rows: statRows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status <> 'Resolved')::int AS active,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'Resolved')::int AS resolved
      FROM complaints
    `);
    const { active, total, resolved } = statRows[0];
    const resolutionRate = total ? Math.round((resolved / total) * 100) : 0;

    res.json({
      complaints: rows.map(toComplaint),
      stats: { active, resolutionRate },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading complaints.' });
  }
});

// GET /api/complaints/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, r.email AS resident_account_email, r.contact AS resident_account_contact,
              m.id AS meeting_id, m.date AS meeting_date, m.time AS meeting_time,
              m.location AS meeting_venue, m.mediator AS meeting_mediator,
              m.hearing_stage AS meeting_stage, m.notification_sent, m.notification_sent_at
       FROM complaints c
       LEFT JOIN residents r ON r.id = c.filed_by_resident_id
       LEFT JOIN LATERAL (
         SELECT * FROM meetings
         WHERE case_id = c.id AND meeting_type = 'mediation'
         ORDER BY date DESC, created_at DESC
         LIMIT 1
       ) m ON true
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'Case not found.' });

    const row = rows[0];
    const complaint = toComplaint(row);
    complaint.residentEmail = row.resident_account_email || '';
    complaint.residentContact = row.resident_account_contact || '';

    if (row.meeting_id) {
      complaint.scheduledMeeting = {
        id: row.meeting_id,
        date: row.meeting_date,
        time: row.meeting_time,
        venue: row.meeting_venue,
        mediator: row.meeting_mediator,
        hearingStage: row.meeting_stage,
        notificationSent: !!row.notification_sent,
        notificationSentAt: row.notification_sent_at,
      };
    }

    res.json(complaint);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading case.' });
  }
});

// POST /api/complaints (File New Case - Official KP Form / Lupong Tagapamayapa)
router.post('/', (req, res, next) => {
  upload.single('evidence')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Invalid evidence file upload.' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const resident = (req.body.resident || req.body.complainantName || '').trim();
    const category = (req.body.category || 'Formal Complaint').trim();
    const nature = (req.body.nature || req.body.description || '').trim();
    const narrative = (req.body.narrative || '').trim();
    const reliefSought = (req.body.reliefSought || '').trim();
    const respondent = (req.body.respondent || req.body.respondentName || '').trim();
    const complainantAddress = (req.body.complainantAddress || '').trim();
    const respondentAddress = (req.body.respondentAddress || '').trim();
    const priority = req.body.priority || 'Normal';
    const barangayCaseNo = (req.body.barangayCaseNo || '').trim();

    if (!resident) {
      return res.status(400).json({ message: 'Resident / Complainant name is required.' });
    }

    const year = new Date().getFullYear();
    let id = barangayCaseNo;

    if (!id) {
      const prefix = category === 'Infrastructure' || category === 'Public Works' ? 'IN' : 'BC';
      const { rows: countRows } = await pool.query(
        "SELECT COUNT(*)::int AS count FROM complaints WHERE id LIKE $1",
        [`${prefix}-${year}-%`]
      );
      const seq = String(countRows[0].count + 1).padStart(5, '0');
      id = `${prefix}-${year}-${seq}`;
    }

    // Attempt to link to resident account if exists
    let filedByResidentId = req.body.filedByResidentId || req.body.residentId || null;
    if (!filedByResidentId) {
      const { rows: matchedResidents } = await pool.query(
        'SELECT id FROM residents WHERE LOWER(TRIM(full_name)) = LOWER($1) LIMIT 1',
        [resident]
      );
      if (matchedResidents.length > 0) {
        filedByResidentId = matchedResidents[0].id;
      }
    }

    const attachmentUrl = req.file ? `/uploads/complaint-evidence/${req.file.filename}` : (req.body.attachmentUrl || null);

    const { rows } = await pool.query(
      `INSERT INTO complaints
        (id, resident, category, status, filing_date, description, priority,
         respondent, respondent_address, complainant_address, narrative, relief_sought,
         attachment_url, filed_by_resident_id)
       VALUES ($1,$2,$3,'Pending',CURRENT_DATE,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        id,
        resident,
        category,
        nature || narrative || 'Formal Complaint',
        priority,
        respondent || null,
        respondentAddress || null,
        complainantAddress || null,
        narrative || null,
        reliefSought || null,
        attachmentUrl,
        filedByResidentId,
      ]
    );

    res.status(201).json(toComplaint(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Database error filing case.' });
  }
});

// POST /api/complaints/:id/schedule-mediation
router.post('/:id/schedule-mediation', async (req, res) => {
  try {
    const { rows: compRows } = await pool.query(
      `SELECT c.*, r.email AS res_email, r.full_name AS res_name
       FROM complaints c
       LEFT JOIN residents r ON r.id = c.filed_by_resident_id
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (compRows.length === 0) return res.status(404).json({ message: 'Case not found.' });
    const complaint = compRows[0];

    const {
      date,
      time,
      venue = 'Barangay Poblacion Mediation Hall',
      mediator = 'Hon. Roberto Cruz (Barangay Captain / Lupon Chairman)',
      hearingStage = '1st Mediation Hearing',
      notes = '',
      sendNotification = true,
      residentEmail = complaint.res_email || '',
    } = req.body;

    if (!date) {
      return res.status(400).json({ message: 'Mediation date is required.' });
    }

    const meetingTitle = `Mediation Session: ${complaint.category || 'Dispute'} (${complaint.id})`;
    const meetingId = `mtg-${uuidv4().slice(0, 8)}`;

    const { rows: meetingRows } = await pool.query(
      `INSERT INTO meetings
        (id, title, date, time, location, attendees, absentees, agenda, main_topics, concerns_raised,
         minutes, resolutions, action_items, next_meeting_date, next_meeting_time, next_meeting_venue,
         meeting_type, case_id, resident_id, resident_name, resident_email, respondent_name, mediator,
         hearing_stage, notification_sent, notification_sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'mediation',$17,$18,$19,$20,$21,$22,$23,false,null)
       RETURNING *`,
      [
        meetingId,
        meetingTitle,
        date,
        time || '10:00 AM',
        venue,
        JSON.stringify([complaint.resident, complaint.respondent || 'Respondent', mediator].filter(Boolean)),
        JSON.stringify([]),
        JSON.stringify([`Katarungang Pambarangay mediation for Case ${complaint.id}`, `Discussion of relief sought: ${complaint.relief_sought || 'Amicable settlement'}`]),
        JSON.stringify([complaint.description || complaint.narrative || 'Barangay dispute mediation']),
        notes || '',
        '',
        JSON.stringify([]),
        JSON.stringify([]),
        '',
        '',
        '',
        complaint.id,
        complaint.filed_by_resident_id || null,
        complaint.resident || complaint.res_name || '',
        residentEmail || '',
        complaint.respondent || '',
        mediator,
        hearingStage,
      ]
    );

    // Update complaint status
    const { rows: updatedCompRows } = await pool.query(
      `UPDATE complaints
       SET status = 'Mediation',
           under_review_at = COALESCE(under_review_at, now()),
           mediation_date = $1,
           mediation_time = $2,
           mediation_venue = $3,
           mediator = $4,
           hearing_stage = $5
       WHERE id = $6
       RETURNING *`,
      [date, time || '10:00 AM', venue, mediator, hearingStage, req.params.id]
    );

    // Send email notification to resident
    let mailResult = { success: false, reason: 'Recipient email not available' };
    if (sendNotification && residentEmail) {
      mailResult = await sendMediationNoticeEmail({
        to: residentEmail,
        residentName: complaint.resident || complaint.res_name,
        respondentName: complaint.respondent,
        caseId: complaint.id,
        date,
        time,
        venue,
        mediator,
        hearingStage,
        notes,
      });

      if (mailResult.success) {
        await pool.query(
          'UPDATE meetings SET notification_sent = true, notification_sent_at = now() WHERE id = $1',
          [meetingId]
        );
      }
    }

    const updatedComp = toComplaint(updatedCompRows[0]);
    updatedComp.residentEmail = residentEmail;
    updatedComp.scheduledMeeting = {
      id: meetingId,
      date,
      time: time || '10:00 AM',
      venue,
      mediator,
      hearingStage,
      notificationSent: mailResult.success,
      notificationSentAt: mailResult.success ? new Date() : null,
    };

    res.json({
      complaint: updatedComp,
      meetingId,
      emailSent: mailResult.success,
      emailError: mailResult.error,
      message: mailResult.success
        ? `Mediation scheduled and notification email sent to ${residentEmail}!`
        : (residentEmail ? `Mediation scheduled (Notification error: ${mailResult.error || 'could not send'})` : 'Mediation scheduled successfully.'),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error scheduling mediation: ' + (err.message || 'Server error') });
  }
});

// PUT /api/complaints/:id
router.put('/:id', async (req, res) => {
  try {
    const { rows: existingRows } = await pool.query('SELECT * FROM complaints WHERE id = $1', [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ message: 'Case not found.' });

    const existingRaw = existingRows[0];
    const existing = toComplaint(existingRaw);
    const merged = { ...existing, ...req.body };

    let underReviewAt = existingRaw.under_review_at;
    let inProgressAt = existingRaw.in_progress_at;
    let resolvedAt = existingRaw.resolved_at;
    let closedAt = existingRaw.closed_at;

    if ((merged.status === 'Under Review' || merged.status === 'In Progress' || merged.status === 'Resolved' || merged.status === 'Closed') && !underReviewAt) {
      underReviewAt = new Date();
    }
    if ((merged.status === 'In Progress' || merged.status === 'Resolved' || merged.status === 'Closed') && !inProgressAt) {
      inProgressAt = new Date();
    }
    if ((merged.status === 'Resolved' || merged.status === 'Closed') && !resolvedAt) {
      resolvedAt = new Date();
    }
    if (merged.status === 'Closed' && !closedAt) {
      closedAt = new Date();
    }

    const { rows } = await pool.query(
      `UPDATE complaints SET resident=$1, category=$2, status=$3, filing_date=$4, description=$5, priority=$6,
        needs_escalation=$7, under_review_at=$8, in_progress_at=$9, resolved_at=$10, closed_at=$11,
        assigned_team=COALESCE($12, assigned_team),
        mediation_date=$13, mediation_time=$14, mediation_venue=$15, mediator=$16, hearing_stage=$17
       WHERE id=$18 RETURNING *`,
      [
        merged.resident, merged.category, merged.status, merged.filingDate, merged.description, merged.priority,
        merged.needsEscalation === true, underReviewAt, inProgressAt, resolvedAt, closedAt,
        merged.assignedTeam || null,
        merged.mediationDate || null, merged.mediationTime || null, merged.mediationVenue || null,
        merged.mediator || null, merged.hearingStage || null,
        req.params.id,
      ]
    );

    res.json(toComplaint(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error updating case.' });
  }
});

module.exports = router;
