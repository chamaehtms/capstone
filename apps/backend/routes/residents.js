const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { sendResidentApprovalEmail } = require('../utils/mailer');
const { validateIdImage, verifyIdDocumentStep, verifyIdAndSelfieMatch } = require('../utils/aiIdValidator');

const router = express.Router();
router.use(requireAuth);

// ---- Photo upload setup ----
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'residents');
const ID_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'resident-ids');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(ID_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${req.params.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  },
});

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ID_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${file.fieldname}-${Date.now()}${ext}`);
  },
});

const docUpload = multer({
  storage: docStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    if (!ok) return cb(new Error('Only image or PDF files are allowed.'));
    cb(null, true);
  },
});

const residentDocsUpload = docUpload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'idDocument', maxCount: 1 },
  { name: 'selfieWithId', maxCount: 1 },
]);

function toResident(r) {
  return {
    id: r.id,
    fullName: r.full_name,
    birthDate: r.birth_date,
    age: r.age,
    gender: r.gender,
    occupation: r.occupation,
    address: r.address,
    zone: r.zone,
    residencyYears: r.residency_years,
    contact: r.contact,
    email: r.email,
    status: r.status,
    category: r.category || [],
    education: r.education,
    bloodType: r.blood_type,
    placeOfBirth: r.place_of_birth,
    spouse: r.spouse,
    household: r.household || [],
    photoUrl: r.photo_url,
    idDocumentUrl: r.id_document_url,
    selfieIdUrl: r.selfie_id_url,
    idAiStatus: r.id_ai_status || 'not_scanned',
    idAiScore: r.id_ai_score != null ? Number(r.id_ai_score) : null,
    idAiSummary: r.id_ai_summary || '',
    idAiCheckedAt: r.id_ai_checked_at || null,
  };
}

// GET /api/residents  (supports ?search=&zone=&status=)
//
// Self-registered accounts still awaiting approval (self_registered=true AND
// status='Pending') are intentionally excluded here — they show up in
// Pending Requests (GET /api/residents/pending-registrations) instead, and
// only land in this list once an admin approves them (status flips to
// 'Verified', or they're otherwise edited off 'Pending'). Residents an
// admin enrolled directly always show up here immediately, Pending or not.
router.get('/', async (req, res) => {
  try {
    const { search, zone, status } = req.query;
    const conditions = [`NOT (self_registered = true AND status = 'Pending')`];
    const params = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conditions.push(`LOWER(full_name) LIKE $${params.length}`);
    }
    if (zone && zone !== 'All Zones') {
      params.push(zone);
      conditions.push(`zone = $${params.length}`);
    }
    if (status && status !== 'All Types') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const { rows } = await pool.query(
      `SELECT * FROM residents ${where} ORDER BY created_at DESC`,
      params
    );

    const { rows: statRows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE gender = 'Male')::int AS male,
        COUNT(*) FILTER (WHERE gender = 'Female')::int AS female,
        COUNT(*) FILTER (WHERE status = 'Verified')::int AS verified
      FROM residents
      WHERE NOT (self_registered = true AND status = 'Pending')
    `);

    res.json({
      residents: rows.map(toResident),
      stats: statRows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading residents.' });
  }
});

// GET /api/residents/all-directory
// Returns all registered residents (approved or pending) for mediation matching & email autofill
router.get('/all-directory', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, full_name, email, contact, address, zone, status
       FROM residents
       ORDER BY full_name ASC`
    );
    res.json(rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      email: r.email || '',
      contact: r.contact || '',
      address: r.address || '',
      zone: r.zone || '',
      status: r.status,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading resident directory.' });
  }
});

// GET /api/residents/pending-registrations
// Self-registered accounts awaiting admin approval before they can sign in
// or appear in the main Resident Records list.
router.get('/pending-registrations', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM residents WHERE self_registered = true AND status = 'Pending'
       ORDER BY created_at ASC`
    );

    // Auto-scan any existing pending residents that haven't been scanned yet
    for (const r of rows) {
      if ((!r.id_ai_status || r.id_ai_status === 'not_scanned') && r.id_document_url) {
        try {
          const scan = await validateIdImage(r.id_document_url);
          await pool.query(
            `UPDATE residents
             SET id_ai_status = $1, id_ai_score = $2, id_ai_summary = $3, id_ai_checked_at = now()
             WHERE id = $4`,
            [scan.status, scan.score, scan.summary, r.id]
          );
          r.id_ai_status = scan.status;
          r.id_ai_score = scan.score;
          r.id_ai_summary = scan.summary;
          r.id_ai_checked_at = new Date();
        } catch (err) {
          console.error(`[AI ID Auto-scan] Error scanning resident ${r.id}:`, err.message);
        }
      }
    }

    res.json(rows.map(toResident));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading pending registrations.' });
  }
});

// POST /api/residents/:id/scan-id (re-scan ID with AI validation)
router.post('/:id/scan-id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM residents WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Resident record not found.' });

    const resident = rows[0];
    if (!resident.id_document_url) {
      return res.status(400).json({ message: 'No ID document available to scan.' });
    }

    const scan = await validateIdImage(resident.id_document_url);
    const { rows: updatedRows } = await pool.query(
      `UPDATE residents
       SET id_ai_status = $1, id_ai_score = $2, id_ai_summary = $3, id_ai_checked_at = now()
       WHERE id = $4
       RETURNING *`,
      [scan.status, scan.score, scan.summary, resident.id]
    );

    res.json(toResident(updatedRows[0]));
  } catch (err) {
    console.error('[scan-id] Error:', err);
    res.status(500).json({ message: 'Unable to scan ID document.' });
  }
});

// POST /api/residents/:id/approve  (approve a resident account)
router.post('/:id/approve', async (req, res) => {
  try {
    const { rows: checkRows } = await pool.query('SELECT * FROM residents WHERE id = $1', [req.params.id]);
    if (checkRows.length === 0) {
      return res.status(404).json({ message: 'Resident not found.' });
    }
    const target = checkRows[0];
    if (target.id_ai_status === 'ai_detected') {
      return res.status(400).json({
        message: 'Cannot approve: The submitted ID has been flagged by AI validation as synthetic or fraudulent. Please reject or request authentic documents.',
      });
    }

    const { rows } = await pool.query(
      `UPDATE residents
       SET status = 'Verified', email_verified = true
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );
    const approved = rows[0];

    if (approved.email) {
      try {
        const loginUrl = (process.env.RESIDENT_FRONTEND_URL || 'http://localhost:5500').replace(/\/$/, '') + '/login';
        await sendResidentApprovalEmail({
          to: approved.email,
          residentName: approved.full_name,
          residentId: approved.id,
          loginUrl,
        });
      } catch (mailErr) {
        console.error('[residents] Failed to send approval email on approve:', mailErr);
      }
    }

    res.json(toResident(approved));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error approving resident.' });
  }
});

// POST /api/residents/:id/reject  (reject a self-registered account)
// Keeps the row (so the login route can show a clear "not approved"
// message rather than a generic account-not-found error) but it stays out
// of Resident Records and Pending Requests either way, since it's no
// longer 'Pending'.
router.post('/:id/reject', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE residents SET status = 'Rejected' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Resident not found.' });
    res.json(toResident(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error rejecting resident.' });
  }
});

// GET /api/residents/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM residents WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Resident not found.' });
    res.json(toResident(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading resident.' });
  }
});

// POST /api/residents  (Enroll New Resident)
router.post('/', async (req, res) => {
  try {
    const {
      fullName, birthDate, gender, occupation, address, zone, residencyYears,
      household, contact, email,
    } = req.body;

    if (!fullName || !address) {
      return res.status(400).json({ message: 'Full name and address are required.' });
    }

    // Contact validation: only numbers, starts with 09, exactly 11 digits
    if (contact) {
      const cleanContact = String(contact).trim();
      if (!/^\d+$/.test(cleanContact)) {
        return res.status(400).json({ message: 'Mobile number must contain digits only.' });
      }
      if (!cleanContact.startsWith('09')) {
        return res.status(400).json({ message: 'Mobile number must start with 09.' });
      }
      if (cleanContact.length !== 11) {
        return res.status(400).json({ message: `Mobile number must be exactly 11 digits starting with 09 (currently ${cleanContact.length}).` });
      }
    }

    const age = birthDate ? Math.max(0, new Date().getFullYear() - new Date(birthDate).getFullYear()) : null;
    const id = `res-${uuidv4().slice(0, 8)}`;

    const { rows } = await pool.query(
      `INSERT INTO residents
        (id, full_name, birth_date, age, gender, occupation, address, zone, residency_years,
         contact, email, status, category, household)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Pending',$12,$13)
       RETURNING *`,
      [
        id, fullName, birthDate || null, age, gender || 'Unspecified', occupation || '', address,
        zone || '', residencyYears || 0, contact || '', email || '',
        JSON.stringify(['Resident']), JSON.stringify(household || []),
      ]
    );

    res.status(201).json(toResident(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error enrolling resident.' });
  }
});

// POST /api/residents/:id/photo  (upload/replace a resident's photo)
router.post('/:id/photo', (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Unable to upload photo.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No photo file was provided.' });
    }

    try {
      const { rows: existingRows } = await pool.query('SELECT photo_url FROM residents WHERE id = $1', [req.params.id]);
      if (existingRows.length === 0) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ message: 'Resident not found.' });
      }

      // Clean up the old photo file, if any, now that we have a new one.
      const oldPhotoUrl = existingRows[0].photo_url;
      if (oldPhotoUrl) {
        const oldPath = path.join(__dirname, '..', oldPhotoUrl.replace(/^\//, ''));
        fs.unlink(oldPath, () => {});
      }

      const photoUrl = `/uploads/residents/${req.file.filename}`;
      const { rows } = await pool.query(
        'UPDATE residents SET photo_url = $1 WHERE id = $2 RETURNING *',
        [photoUrl, req.params.id]
      );

      res.json(toResident(rows[0]));
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ message: 'Database error saving photo.' });
    }
  });
});

// POST /api/residents/:id/documents (upload photo, idDocument, selfieWithId for enrolled resident)
router.post('/:id/documents', (req, res) => {
  residentDocsUpload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Unable to upload documents.' });
    }

    const cleanupUploadedFiles = () => {
      ['photo', 'idDocument', 'selfieWithId'].forEach((field) => {
        const file = req.files?.[field]?.[0];
        if (file && file.path) {
          fs.unlink(file.path, () => {});
        }
      });
    };

    try {
      const { rows: existingRows } = await pool.query('SELECT * FROM residents WHERE id = $1', [req.params.id]);
      if (existingRows.length === 0) {
        cleanupUploadedFiles();
        return res.status(404).json({ message: 'Resident not found.' });
      }

      const resident = existingRows[0];
      const idDocFile = req.files?.idDocument?.[0];
      const selfieFile = req.files?.selfieWithId?.[0];

      // Strict validation: If ID or selfie is uploaded, ensure validity
      if (idDocFile && selfieFile) {
        const verification = await verifyIdAndSelfieMatch(idDocFile, selfieFile, { applicantName: resident.full_name });
        if (!verification.valid) {
          cleanupUploadedFiles();
          return res.status(400).json({
            message: verification.reason || 'Invalid ID document or selfie verification failed.',
            rejectedField: verification.rejectedField || 'idDocument',
          });
        }
      } else if (idDocFile) {
        const idCheck = await verifyIdDocumentStep(idDocFile, { applicantName: resident.full_name });
        if (!idCheck.valid) {
          cleanupUploadedFiles();
          return res.status(400).json({
            message: idCheck.reason || 'Invalid government ID document.',
            rejectedField: idCheck.rejectedField || 'idDocument',
          });
        }
      }

      const updates = [];
      const values = [];
      let idx = 1;

      if (req.files?.photo?.[0]) {
        const pUrl = `/uploads/resident-ids/${req.files.photo[0].filename}`;
        updates.push(`photo_url = $${idx++}`);
        values.push(pUrl);
      }

      if (idDocFile) {
        const idDocUrl = `/uploads/resident-ids/${idDocFile.filename}`;
        updates.push(`id_document_url = $${idx++}`);
        values.push(idDocUrl);

        try {
          const scan = await validateIdImage(idDocFile, { isIdCard: true });
          updates.push(`id_ai_status = $${idx++}`);
          values.push(scan.status);
          updates.push(`id_ai_score = $${idx++}`);
          values.push(scan.score);
          updates.push(`id_ai_summary = $${idx++}`);
          values.push(scan.summary);
          updates.push(`id_ai_checked_at = now()`);
        } catch (aiErr) {
          console.warn('[AI SCAN SKIPPED]', aiErr.message);
        }
      }

      if (selfieFile) {
        const selfieUrl = `/uploads/resident-ids/${selfieFile.filename}`;
        updates.push(`selfie_id_url = $${idx++}`);
        values.push(selfieUrl);
      }

      if (updates.length === 0) {
        return res.json(toResident(resident));
      }

      values.push(req.params.id);
      const query = `UPDATE residents SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
      const { rows } = await pool.query(query, values);

      res.json(toResident(rows[0]));
    } catch (dbErr) {
      console.error(dbErr);
      cleanupUploadedFiles();
      res.status(500).json({ message: 'Database error saving verification documents: ' + dbErr.message });
    }
  });
});

// PUT /api/residents/:id
router.put('/:id', async (req, res) => {
  try {
    const { rows: existingRows } = await pool.query('SELECT * FROM residents WHERE id = $1', [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ message: 'Resident not found.' });

    const existing = toResident(existingRows[0]);
    const merged = { ...existing, ...req.body };

    const birthDateStr = merged.birthDate && String(merged.birthDate).trim() ? String(merged.birthDate).slice(0, 10) : null;
    let age = null;
    if (birthDateStr) {
      const birth = new Date(birthDateStr);
      if (!Number.isNaN(birth.getTime())) {
        age = Math.max(0, new Date().getFullYear() - birth.getFullYear());
      }
    } else if (merged.age !== undefined && merged.age !== null && merged.age !== '') {
      age = parseInt(merged.age, 10);
      if (Number.isNaN(age)) age = null;
    }

    const residencyYears = merged.residencyYears !== undefined && merged.residencyYears !== null && merged.residencyYears !== ''
      ? (parseInt(merged.residencyYears, 10) || 0)
      : 0;

    const photoUrl = req.body.photoUrl !== undefined ? (req.body.photoUrl || null) : existing.photoUrl;

    const wasPending = existing.status === 'Pending';
    const isNowVerified = (merged.status === 'Verified');
    const emailVerifiedVal = isNowVerified ? true : (existing.emailVerified !== undefined ? existing.emailVerified : true);

    const { rows } = await pool.query(
      `UPDATE residents SET
        full_name=$1, birth_date=$2, age=$3, gender=$4, occupation=$5, address=$6, zone=$7,
        residency_years=$8, contact=$9, email=$10, status=$11, category=$12, education=$13,
        blood_type=$14, place_of_birth=$15, spouse=$16, household=$17, photo_url=$18,
        email_verified=$19
       WHERE id=$20 RETURNING *`,
      [
        merged.fullName, birthDateStr, age, merged.gender || 'Unspecified', merged.occupation || '', merged.address,
        merged.zone || '', residencyYears, merged.contact || '', merged.email || '', merged.status || 'Pending',
        JSON.stringify(merged.category || []), merged.education || '', merged.bloodType || '', merged.placeOfBirth || '',
        merged.spouse || '', JSON.stringify(merged.household || []), photoUrl, emailVerifiedVal, req.params.id,
      ]
    );

    if (wasPending && isNowVerified && rows[0]?.email) {
      try {
        const loginUrl = (process.env.RESIDENT_FRONTEND_URL || 'http://localhost:5500').replace(/\/$/, '') + '/login';
        await sendResidentApprovalEmail({
          to: rows[0].email,
          residentName: rows[0].full_name,
          residentId: rows[0].id,
          loginUrl,
        });
      } catch (mailErr) {
        console.error('[residents] Failed to send approval email on PUT:', mailErr);
      }
    }

    res.json(toResident(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error updating resident.' });
  }
});

// DELETE /api/residents/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM residents WHERE id = $1 RETURNING *', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Resident not found.' });

    if (rows[0].photo_url) {
      const oldPath = path.join(__dirname, '..', rows[0].photo_url.replace(/^\//, ''));
      fs.unlink(oldPath, () => {});
    }

    res.json(toResident(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error deleting resident.' });
  }
});

module.exports = router;
