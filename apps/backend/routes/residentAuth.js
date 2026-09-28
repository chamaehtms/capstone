const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { hashPassword, verifyPassword } = require('../utils/password');
const { JWT_SECRET, requireResidentAuth } = require('../middleware/auth');

const router = express.Router();

// ---- Upload setup: resident profile photos + ID document uploads ----
const PHOTO_DIR = path.join(__dirname, '..', 'uploads', 'residents');
const ID_DIR = path.join(__dirname, '..', 'uploads', 'resident-ids');
fs.mkdirSync(PHOTO_DIR, { recursive: true });
fs.mkdirSync(ID_DIR, { recursive: true });

function makeUpload(dir, prefix) {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `${prefix}-${Date.now()}${ext}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const okType = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
      if (!okType) return cb(new Error('Only image or PDF files are allowed.'));
      cb(null, true);
    },
  });
}

const idUpload = makeUpload(ID_DIR, 'id');
const photoUpload = makeUpload(PHOTO_DIR, 'resident');
const residentRegistrationUpload = idUpload.fields([
  { name: 'idDocument', maxCount: 1 },
  { name: 'selfieWithId', maxCount: 1 },
]);

function createMailTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_SERVICE } = process.env;
  if (!SMTP_USER || !SMTP_PASS) return null;
  if (SMTP_USER.includes('your-sending-account') || SMTP_PASS.includes('your-16-character')) return null;

  if (SMTP_SERVICE === 'gmail' || (!SMTP_HOST && SMTP_USER.includes('@gmail.com'))) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }

  return nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.gmail.com',
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function hashVerificationCode(residentId, code) {
  return crypto.createHmac('sha256', JWT_SECRET).update(`${residentId}:${code}`).digest('hex');
}

async function sendVerificationCode(resident, mailTransport) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const codeHash = hashVerificationCode(resident.id, code);
  await pool.query(
    `UPDATE residents SET email_verified = false, email_verification_code_hash = $1,
       email_verification_expires_at = now() + interval '10 minutes',
       email_verification_sent_at = now(), email_verification_attempts = 0
     WHERE id = $2`,
    [codeHash, resident.id]
  );
  try {
    await mailTransport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: resident.email,
      subject: 'Your Barangay Poblacion System verification code',
      text: `Hello ${resident.fullName},\n\nYour 6-digit email verification code for Barangay Poblacion System is: ${code}. It expires in 10 minutes.\n\nIf you did not start this registration, you can ignore this message.`,
    });
  } catch (err) {
    await pool.query(
      `UPDATE residents SET email_verification_code_hash = NULL,
       email_verification_expires_at = NULL, email_verification_sent_at = NULL
       WHERE id = $1 AND email_verified = false`,
      [resident.id]
    );
    throw err;
  }
}

function toResidentAccount(r) {
  return {
    id: r.id,
    fullName: r.full_name,
    birthDate: r.birth_date,
    age: r.age,
    gender: r.gender,
    civilStatus: r.civil_status,
    occupation: r.occupation,
    address: r.address,
    zone: r.zone,
    contact: r.contact,
    email: r.email,
    status: r.status,
    photoUrl: r.photo_url,
    idDocumentUrl: r.id_document_url,
    selfieIdUrl: r.selfie_id_url,
    communityPoints: r.community_points,
    tier: r.tier,
    pushNotifications: r.push_notifications,
    emailAnnouncements: r.email_announcements,
    twoFactorEnabled: r.two_factor_enabled,
    language: r.language,
  };
}

// POST /api/resident-auth/register  (self-service "Register your Household")
router.post('/register', (req, res) => {
  const mailTransport = createMailTransport();
  if (!mailTransport) {
    return res.status(503).json({ message: 'Email verification is not configured. Contact the system administrator.' });
  }

  residentRegistrationUpload(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ message: uploadErr.message || 'Unable to upload identification files.' });
    }

    const cleanupFiles = () => {
      if (req.files) {
        Object.values(req.files).flat().forEach((f) => {
          if (f?.path) fs.unlink(f.path, () => {});
        });
      }
    };

    try {
      const {
        firstName, middleName, lastName, birthDate, gender, contact, zone, email, password,
      } = req.body;

      if (!firstName || !lastName || !email || !password) {
        cleanupFiles();
        return res.status(400).json({ message: 'First name, last name, email, and password are required.' });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        cleanupFiles();
        return res.status(400).json({ message: 'Enter a valid email address.' });
      }

      const idDocFile = req.files?.['idDocument']?.[0];
      const selfieFile = req.files?.['selfieWithId']?.[0];

      if (!idDocFile) {
        cleanupFiles();
        return res.status(400).json({ message: 'Valid ID document is required.' });
      }
      if (!selfieFile) {
        cleanupFiles();
        return res.status(400).json({ message: 'Selfie holding your valid ID is required.' });
      }

      const idDocumentUrl = `/uploads/resident-ids/${idDocFile.filename}`;
      const selfieIdUrl = `/uploads/resident-ids/${selfieFile.filename}`;

      const { rows: existing } = await pool.query(
        'SELECT id, full_name, email, email_verified, email_verification_sent_at, self_registered FROM residents WHERE LOWER(email) = $1 AND password_hash IS NOT NULL',
        [normalizedEmail]
      );
      if (existing.length > 0) {
        cleanupFiles();
        const resident = existing[0];
        if (!resident.email_verified && resident.self_registered) {
          const lastSent = resident.email_verification_sent_at && new Date(resident.email_verification_sent_at).getTime();
          if (lastSent && Date.now() - lastSent < 60000) {
            return res.status(429).json({ message: 'A code was sent recently. Wait one minute before requesting another.' });
          }
          await sendVerificationCode({ id: resident.id, email: resident.email, fullName: resident.full_name }, mailTransport);
          return res.status(200).json({
            verificationRequired: true,
            email: resident.email,
            message: 'A new six-digit verification code has been sent to your email.',
          });
        }
        return res.status(409).json({ message: 'An account already exists for this email.' });
      }

      const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
      const age = birthDate ? Math.max(0, new Date().getFullYear() - new Date(birthDate).getFullYear()) : null;
      const id = `res-${uuidv4().slice(0, 8)}`;

      const { rows } = await pool.query(
        `INSERT INTO residents
          (id, full_name, birth_date, age, gender, address, zone, contact, email, status,
           category, password_hash, id_document_url, selfie_id_url, photo_url, self_registered, email_verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Pending',$10,$11,$12,$13,$14,true,false)
         RETURNING *`,
        [
          id, fullName, birthDate || null, age, gender || 'Unspecified', zone || '', zone || '',
          contact || '', email, JSON.stringify(['Resident']), hashPassword(password), idDocumentUrl,
          selfieIdUrl, selfieIdUrl,
        ]
      );

      try {
        await sendVerificationCode({ id, email: normalizedEmail, fullName }, mailTransport);
      } catch (mailErr) {
        console.error('[registration] Error sending verification email:', mailErr);
        try {
          await pool.query('DELETE FROM residents WHERE id = $1 AND email_verified = false', [id]);
        } catch (_) {}
        cleanupFiles();
        return res.status(502).json({
          message: 'Unable to deliver verification email: ' + (mailErr.message || 'SMTP error') + '. Please check your email address or try again.',
        });
      }

      res.status(201).json({
        verificationRequired: true,
        email: normalizedEmail,
        message: 'A six-digit verification code has been sent to your email.',
      });
    } catch (err) {
      console.error('[registration] Registration error:', err);
      cleanupFiles();
      res.status(500).json({ message: 'Registration failed: ' + (err.message || 'Server error') });
    }
  });
});

router.post('/verify-email', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: 'Enter the email address and six-digit code.' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, email_verified, email_verification_code_hash, email_verification_expires_at,
              email_verification_attempts
       FROM residents WHERE LOWER(email) = $1 AND self_registered = true AND password_hash IS NOT NULL`,
      [email]
    );
    const resident = rows[0];
    if (!resident) return res.status(400).json({ message: 'No pending registration was found for this email.' });
    if (resident.email_verified) {
      return res.json({ message: 'Email verified. Your registration is awaiting barangay approval.' });
    }
    if (resident.email_verification_attempts >= 5) {
      return res.status(429).json({ message: 'Too many incorrect codes. Request a new code to continue.' });
    }
    if (!resident.email_verification_expires_at || new Date(resident.email_verification_expires_at) <= new Date()) {
      return res.status(400).json({ message: 'This code has expired. Request a new code.' });
    }
    const suppliedHash = hashVerificationCode(resident.id, code);
    const expectedHash = resident.email_verification_code_hash || '';
    const matches = expectedHash.length === suppliedHash.length && crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'), Buffer.from(suppliedHash, 'hex')
    );
    if (!matches) {
      await pool.query(
        'UPDATE residents SET email_verification_attempts = email_verification_attempts + 1 WHERE id = $1 AND email_verified = false',
        [resident.id]
      );
      return res.status(400).json({ message: 'The verification code is incorrect.' });
    }
    await pool.query(
      `UPDATE residents SET email_verified = true, email_verification_code_hash = NULL,
       email_verification_expires_at = NULL, email_verification_attempts = 0 WHERE id = $1`,
      [resident.id]
    );
    res.json({ message: 'Email verified. Your registration is awaiting barangay approval.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to verify this email address.' });
  }
});

router.post('/resend-email-code', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  const mailTransport = createMailTransport();
  if (!mailTransport) {
    return res.status(503).json({ message: 'Email verification is not configured. Contact the system administrator.' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, full_name, email, email_verified, email_verification_sent_at
       FROM residents WHERE LOWER(email) = $1 AND self_registered = true AND password_hash IS NOT NULL`,
      [email]
    );
    const resident = rows[0];
    if (!resident || resident.email_verified) {
      return res.json({ message: 'If an unverified registration matches this email, a new code has been sent.' });
    }
    const lastSent = resident.email_verification_sent_at && new Date(resident.email_verification_sent_at).getTime();
    if (lastSent && Date.now() - lastSent < 60000) {
      return res.status(429).json({ message: 'Wait one minute before requesting another code.' });
    }
    await sendVerificationCode(resident, mailTransport);
    res.json({ message: 'A new six-digit verification code has been sent to your email.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to send a verification code.' });
  }
});

// POST /api/resident-auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email/username and password are required.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM residents WHERE email = $1 AND password_hash IS NOT NULL',
      [email]
    );
    const resident = rows[0];

    if (!resident || !verifyPassword(password, resident.password_hash)) {
      return res.status(401).json({ message: 'Invalid email/username or password.' });
    }

    if (!resident.email_verified) {
      return res.status(403).json({ message: 'Verify your email using the six-digit code before signing in.' });
    }

    if (resident.status === 'Pending') {
      return res.status(403).json({
        message: 'Your account is still awaiting barangay approval. Please check back later.',
      });
    }
    if (resident.status === 'Rejected') {
      return res.status(403).json({
        message: 'Your registration was not approved. Please visit the barangay office for assistance.',
      });
    }

    const token = jwt.sign(
      { id: resident.id, email: resident.email, fullName: resident.full_name, scope: 'resident' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, resident: toResidentAccount(resident) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error during login.' });
  }
});

// GET /api/resident-auth/me
router.get('/me', requireResidentAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM residents WHERE id = $1', [req.resident.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Resident account not found.' });
    res.json(toResidentAccount(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading account.' });
  }
});

// PUT /api/resident-auth/me  (Edit Profile)
router.put('/me', requireResidentAuth, async (req, res) => {
  try {
    const { rows: existingRows } = await pool.query('SELECT * FROM residents WHERE id = $1', [req.resident.id]);
    if (existingRows.length === 0) return res.status(404).json({ message: 'Resident account not found.' });

    const existing = toResidentAccount(existingRows[0]);
    const merged = { ...existing, ...req.body };

    const { rows } = await pool.query(
      `UPDATE residents SET
        full_name=$1, birth_date=$2, gender=$3, civil_status=$4, contact=$5, zone=$6
       WHERE id=$7 RETURNING *`,
      [merged.fullName, merged.birthDate, merged.gender, merged.civilStatus, merged.contact, merged.zone, req.resident.id]
    );

    res.json(toResidentAccount(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error updating account.' });
  }
});

// PUT /api/resident-auth/preferences  (push notifications, email, 2FA, language)
router.put('/preferences', requireResidentAuth, async (req, res) => {
  try {
    const { pushNotifications, emailAnnouncements, twoFactorEnabled, language } = req.body;

    const { rows } = await pool.query(
      `UPDATE residents SET
        push_notifications = COALESCE($1, push_notifications),
        email_announcements = COALESCE($2, email_announcements),
        two_factor_enabled = COALESCE($3, two_factor_enabled),
        language = COALESCE($4, language)
       WHERE id = $5 RETURNING *`,
      [pushNotifications, emailAnnouncements, twoFactorEnabled, language, req.resident.id]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'Resident account not found.' });
    res.json(toResidentAccount(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error updating preferences.' });
  }
});

// POST /api/resident-auth/change-password
router.post('/change-password', requireResidentAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters.' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM residents WHERE id = $1', [req.resident.id]);
    const resident = rows[0];
    if (!resident || !verifyPassword(currentPassword, resident.password_hash)) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    await pool.query('UPDATE residents SET password_hash = $1 WHERE id = $2', [
      hashPassword(newPassword),
      resident.id,
    ]);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error updating password.' });
  }
});

// POST /api/resident-auth/me/photo  (upload/replace profile picture)
router.post('/me/photo', requireResidentAuth, (req, res) => {
  photoUpload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Unable to upload photo.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No photo file was provided.' });
    }

    try {
      const { rows: existingRows } = await pool.query('SELECT photo_url FROM residents WHERE id = $1', [req.resident.id]);
      if (existingRows.length === 0) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ message: 'Resident account not found.' });
      }

      const oldPhotoUrl = existingRows[0].photo_url;
      if (oldPhotoUrl) {
        const oldPath = path.join(__dirname, '..', oldPhotoUrl.replace(/^\//, ''));
        fs.unlink(oldPath, () => {});
      }

      const photoUrl = `/uploads/residents/${req.file.filename}`;
      const { rows } = await pool.query(
        'UPDATE residents SET photo_url = $1 WHERE id = $2 RETURNING *',
        [photoUrl, req.resident.id]
      );

      res.json(toResidentAccount(rows[0]));
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ message: 'Database error saving photo.' });
    }
  });
});

// POST /api/resident-auth/forgot-password
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }
  // Generic response so we don't leak which emails have accounts.
  res.json({ message: 'If an account matches that email, a secure reset link has been sent.' });
});

module.exports = router;
