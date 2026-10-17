const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { sendMediationNoticeEmail } = require('../utils/mailer');
const { isCloudinaryConfigured, uploadToCloudinary, deleteLocalUpload } = require('../utils/cloudinary');

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

function normalizeDateString(value, createdAt) {
  if (createdAt) {
    const cad = new Date(createdAt);
    if (!Number.isNaN(cad.getTime())) return cad.toISOString();
  }
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString();
}

function toComplaint(c) {
  return {
    id: c.id,
    resident: c.resident,
    residentEmail: c.resident_account_email || c.resident_email || '',
    residentContact: c.resident_account_contact || '',
    category: c.category,
    status: c.status,
    filingDate: normalizeDateString(c.filing_date, c.created_at),
    submittedAt: c.created_at ? new Date(c.created_at).toISOString() : null,
    createdAt: c.created_at ? new Date(c.created_at).toISOString() : null,
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
    assignedTeam: c.assigned_team || '',
    mediationDate: c.mediation_date,
    mediationTime: c.mediation_time,
    mediationVenue: c.mediation_venue,
    mediator: c.mediator,
    hearingStage: c.hearing_stage,
    mediationStatus: c.mediation_status || (c.mediation_date ? 'Scheduled' : 'Pending'),
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
        COUNT(*) FILTER (WHERE status NOT IN ('Resolved', 'Escalated', 'Closed'))::int AS active,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'Resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE mediation_date IS NOT NULL AND status NOT IN ('Resolved', 'Escalated', 'Closed'))::int AS scheduled_hearings
      FROM complaints
    `);
    const { active, total, resolved, scheduled_hearings } = statRows[0];
    const resolutionRate = total ? Math.round((resolved / total) * 100) : 0;

    res.json({
      complaints: rows.map(toComplaint),
      stats: {
        active,
        resolved,
        resolutionRate,
        scheduledHearings: scheduled_hearings,
      },
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
              m.hearing_stage AS meeting_stage, m.mediation_status AS meeting_mediation_status,
              m.notification_sent, m.notification_sent_at
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
        mediationStatus: row.meeting_mediation_status || complaint.mediationStatus || 'Scheduled',
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

    let attachmentUrl = req.body.attachmentUrl || null;
    if (req.file) {
      if (isCloudinaryConfigured()) {
        const cloudUrl = await uploadToCloudinary(req.file, 'barangay/complaints');
        attachmentUrl = cloudUrl || `/uploads/complaint-evidence/${req.file.filename}`;
        await deleteLocalUpload(req.file);
      } else {
        attachmentUrl = `/uploads/complaint-evidence/${req.file.filename}`;
      }
    }

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
      mediator = '',
      hearingStage = '1st Mediation Hearing',
      notes = '',
      sendNotification = true,
      residentEmail = complaint.res_email || '',
    } = req.body;

    if (!date) {
      return res.status(400).json({ message: 'Mediation date is required.' });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const cleanDate = String(date).trim().slice(0, 10);
    if (cleanDate < todayStr) {
      return res.status(400).json({ message: 'Mediation hearings cannot be scheduled on past dates. Please select today or a future date.' });
    }

    let resolvedResidentEmail = (residentEmail || '').trim() || complaint.res_email || '';
    let residentId = complaint.filed_by_resident_id || null;

    // Fallback: If email is still empty, look up resident by full name matching complaint.resident
    if (!resolvedResidentEmail && complaint.resident) {
      const { rows: rRows } = await pool.query(
        `SELECT id, email, full_name FROM residents
         WHERE (LOWER(TRIM(full_name)) = LOWER(TRIM($1)) OR LOWER(TRIM(full_name)) LIKE LOWER(TRIM($2)))
           AND email IS NOT NULL AND email <> ''
         ORDER BY (LOWER(TRIM(full_name)) = LOWER(TRIM($1))) DESC
         LIMIT 1`,
        [complaint.resident, `%${complaint.resident}%`]
      );
      if (rRows.length > 0) {
        resolvedResidentEmail = rRows[0].email;
        residentId = residentId || rRows[0].id;
      }
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
        residentId,
        complaint.resident || complaint.res_name || '',
        resolvedResidentEmail,
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
           hearing_stage = $5,
           mediation_status = 'Scheduled'
       WHERE id = $6
       RETURNING *`,
      [date, time || '10:00 AM', venue, mediator, hearingStage, req.params.id]
    );

    // Send email notification to resident
    let mailResult = { success: false, reason: 'Recipient email not available' };
    if (sendNotification && resolvedResidentEmail) {
      mailResult = await sendMediationNoticeEmail({
        to: resolvedResidentEmail,
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

    // Add in-app notification in portal for the resident if residentId or residentEmail is present
    if (residentId || resolvedResidentEmail) {
      try {
        await pool.query(
          `INSERT INTO notifications (id, resident_id, resident_email, case_id, title, message, type, link)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            `notif-${uuidv4().slice(0, 8)}`,
            residentId,
            resolvedResidentEmail || null,
            complaint.id,
            `⚖️ Mediation Hearing: ${hearingStage || 'Lupon Session'}`,
            `Notice of hearing for Case #${complaint.id}: ${date}${time ? ` at ${time}` : ''} at ${venue}.`,
            'mediation',
            `/track?ref=${encodeURIComponent(complaint.id)}`,
          ]
        );
      } catch (notifErr) {
        console.error('[notifications] Failed to insert hearing notification:', notifErr.message);
      }
    }

    const updatedComp = toComplaint(updatedCompRows[0]);
    updatedComp.residentEmail = resolvedResidentEmail;
    updatedComp.scheduledMeeting = {
      id: meetingId,
      date,
      time: time || '10:00 AM',
      venue,
      mediator,
      hearingStage,
      mediationStatus: 'Scheduled',
      notificationSent: mailResult.success,
      notificationSentAt: mailResult.success ? new Date() : null,
    };

    res.json({
      complaint: updatedComp,
      meetingId,
      emailSent: mailResult.success,
      emailError: mailResult.error,
      message: mailResult.success
        ? `Mediation scheduled and notification email sent to ${resolvedResidentEmail}!`
        : (resolvedResidentEmail ? `Mediation scheduled (Notification error: ${mailResult.error || 'could not send'})` : 'Mediation scheduled successfully.'),
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

    const isTerminalStatus =
      merged.status === 'Resolved/Escalated' ||
      merged.status === 'Resolved / Escalated' ||
      merged.status === 'Resolved' ||
      merged.status === 'Escalated' ||
      merged.status === 'Closed';

    if ((merged.status === 'Under Review' || merged.status === 'In Progress' || isTerminalStatus) && !underReviewAt) {
      underReviewAt = new Date();
    }
    if ((merged.status === 'In Progress' || isTerminalStatus) && !inProgressAt) {
      inProgressAt = new Date();
    }
    if (isTerminalStatus && !resolvedAt) {
      resolvedAt = new Date();
    }
    if (merged.status === 'Escalated') {
      merged.needsEscalation = true;
    }

    const { rows } = await pool.query(
      `UPDATE complaints SET resident=$1, category=$2, status=$3, filing_date=$4, description=$5, priority=$6,
        needs_escalation=$7, under_review_at=$8, in_progress_at=$9, resolved_at=$10, closed_at=$11,
        assigned_team=COALESCE($12, assigned_team),
        mediation_date=$13, mediation_time=$14, mediation_venue=$15, mediator=$16, hearing_stage=$17,
        mediation_status=COALESCE($18, mediation_status)
       WHERE id=$19 RETURNING *`,
      [
        merged.resident, merged.category, merged.status, merged.filingDate, merged.description, merged.priority,
        merged.needsEscalation === true, underReviewAt, inProgressAt, resolvedAt, closedAt,
        merged.assignedTeam || null,
        merged.mediationDate || null, merged.mediationTime || null, merged.mediationVenue || null,
        merged.mediator || null, merged.hearingStage || null,
        merged.mediationStatus || null,
        req.params.id,
      ]
    );

    // Sync mediation_status to corresponding mediation meeting if present
    if (merged.mediationStatus) {
      await pool.query(
        `UPDATE meetings
         SET mediation_status = $1
         WHERE case_id = $2 AND meeting_type = 'mediation'`,
        [merged.mediationStatus, req.params.id]
      );
    }

    res.json(toComplaint(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error updating case.' });
  }
});

// DELETE /api/complaints/:id
// Deletes the complaint and cascades to its associated escalations, meetings, and notifications.
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: compRows } = await client.query('SELECT * FROM complaints WHERE id = $1', [req.params.id]);
    if (compRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Complaint record not found.' });
    }
    const complaint = compRows[0];

    // 1. Delete associated escalations (where case_ref matches complaint ID)
    await client.query('DELETE FROM escalations WHERE case_ref = $1', [req.params.id]);

    // 2. Delete associated meetings (where case_id matches complaint ID)
    await client.query('DELETE FROM meetings WHERE case_id = $1', [req.params.id]);

    // 3. Delete associated notifications (where case_id matches complaint ID)
    await client.query('DELETE FROM notifications WHERE case_id = $1', [req.params.id]);

    // 4. Delete the complaint record itself
    await client.query('DELETE FROM complaints WHERE id = $1', [req.params.id]);

    await client.query('COMMIT');

    // 5. Clean up attached evidence file if locally stored
    if (complaint.attachment_url && !complaint.attachment_url.startsWith('http')) {
      const oldPath = path.join(__dirname, '..', complaint.attachment_url.replace(/^\//, ''));
      fs.unlink(oldPath, () => {});
    }

    res.json({
      message: `Complaint #${req.params.id} and its associated escalation/hearing records were successfully deleted.`,
      id: req.params.id,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[complaints DELETE] Error:', err);
    res.status(500).json({ message: 'Database error deleting complaint: ' + (err.message || 'Server error') });
  } finally {
    client.release();
  }
});

module.exports = router;
