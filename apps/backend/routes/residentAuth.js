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
const { sendResidentApprovalEmail, sendResidentPendingVerificationEmail } = require('../utils/mailer');

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
  const smtpUser = SMTP_USER?.trim();
  const smtpPass = SMTP_PASS?.replace(/\s+/g, '');
  if (!smtpUser || !smtpPass) return null;
  if (smtpUser.includes('your-sending-account') || smtpPass.includes('your-16-character')) return null;

  if (SMTP_SERVICE === 'gmail' || (!SMTP_HOST && smtpUser.includes('@gmail.com'))) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpUser, pass: smtpPass },
    });
  }

  return nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.gmail.com',
    port: Number(SMTP_PORT || 587),
    secure: SMTP_SECURE === 'true',
    auth: { user: smtpUser, pass: smtpPass },
  });
}

function hashVerificationCode(residentId, code) {
  return crypto.createHmac('sha256', JWT_SECRET).update(`${residentId}:${code}`).digest('hex');
}

function hashPasswordResetCode(residentId, code) {
  return crypto.createHmac('sha256', JWT_SECRET).update(`password-reset:${residentId}:${code}`).digest('hex');
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

function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function findRegistryMatch({ firstName, middleName, lastName, fullName, birthDate, zone, contact, email }) {
  const normFirst = normalizeText(firstName);
  const normLast = normalizeText(lastName);
  const normFull = normalizeText(fullName);

  // Search existing records in the Barangay Resident Database
  const { rows } = await pool.query(
    `SELECT * FROM residents
     WHERE (password_hash IS NULL OR self_registered = false OR status = 'Verified')`
  );

  let bestMatch = null;
  let bestScore = 0;

  for (const row of rows) {
    const rowFull = normalizeText(row.full_name);
    let score = 0;

    // 1. Full name matching
    if (rowFull && normFull && rowFull === normFull) {
      score += 70;
    } else if (normFirst && normLast && rowFull.includes(normFirst) && rowFull.includes(normLast)) {
      score += 55;
    }

    // 2. Birth date matching
    if (birthDate && row.birth_date) {
      try {
        const regBirth = new Date(row.birth_date).toISOString().slice(0, 10);
        const subBirth = String(birthDate).slice(0, 10);
        if (regBirth === subBirth) {
          score += 30;
        } else {
          const regYear = new Date(row.birth_date).getFullYear();
          const subYear = new Date(birthDate).getFullYear();
          if (regYear === subYear) {
            score += 15;
          } else {
            score -= 30;
          }
        }
      } catch (_) {}
    }

    // 3. Contact number matching
    if (contact && row.contact) {
      const cleanSub = contact.replace(/\D/g, '').slice(-10);
      const cleanReg = row.contact.replace(/\D/g, '').slice(-10);
      if (cleanSub && cleanReg && cleanSub === cleanReg) {
        score += 20;
      }
    }

    // 4. Email matching
    if (email && row.email) {
      if (email.toLowerCase().trim() === row.email.toLowerCase().trim()) {
        score += 25;
      }
    }

    // 5. Zone matching
    if (zone && row.zone) {
      if (normalizeText(zone) === normalizeText(row.zone)) {
        score += 10;
      }
    }

    if (score >= 50 && score > bestScore) {
      bestScore = score;
      bestMatch = row;
    }
  }

  return { match: bestMatch, score: bestScore };
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
        'SELECT id, full_name, email FROM residents WHERE LOWER(email) = $1 AND password_hash IS NOT NULL',
        [normalizedEmail]
      );
      if (existing.length > 0) {
        cleanupFiles();
        return res.status(409).json({ message: 'An account already exists for this email.' });
      }

      const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
      const age = birthDate ? Math.max(0, new Date().getFullYear() - new Date(birthDate).getFullYear()) : null;

      // Check Resident Registry for a matching resident record
      const { match: registryMatch, score: matchScore } = await findRegistryMatch({
        firstName, middleName, lastName, fullName, birthDate, zone, contact, email: normalizedEmail,
      });

      const isVerified = Boolean(registryMatch && matchScore >= 50);
      const residentStatus = isVerified ? 'Verified' : 'Pending';
      let residentRow;

      if (registryMatch && !registryMatch.password_hash) {
        // Link and claim the pre-enrolled registry record
        const { rows: updatedRows } = await pool.query(
          `UPDATE residents SET
            full_name = COALESCE(NULLIF($1, ''), full_name),
            birth_date = COALESCE($2, birth_date),
            age = COALESCE($3, age),
            gender = COALESCE(NULLIF($4, ''), gender),
            address = COALESCE(NULLIF($5, ''), address),
            zone = COALESCE(NULLIF($6, ''), zone),
            contact = COALESCE(NULLIF($7, ''), contact),
            email = $8,
            password_hash = $9,
            id_document_url = $10,
            selfie_id_url = $11,
            photo_url = COALESCE(photo_url, $11),
            status = 'Verified',
            self_registered = true,
            email_verified = true
           WHERE id = $12
           RETURNING *`,
          [
            fullName, birthDate || null, age, gender || 'Unspecified', zone || '', zone || '',
            contact || '', normalizedEmail, hashPassword(password), idDocumentUrl, selfieIdUrl,
            registryMatch.id,
          ]
        );
        residentRow = updatedRows[0];
      } else {
        // Insert new resident record
        const id = `res-${uuidv4().slice(0, 8)}`;
        const { rows: insertedRows } = await pool.query(
          `INSERT INTO residents
            (id, full_name, birth_date, age, gender, address, zone, contact, email, status,
             category, password_hash, id_document_url, selfie_id_url, photo_url, self_registered, email_verified)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true,true)
           RETURNING *`,
          [
            id, fullName, birthDate || null, age, gender || 'Unspecified', zone || '', zone || '',
            contact || '', normalizedEmail, residentStatus, JSON.stringify(['Resident']),
            hashPassword(password), idDocumentUrl, selfieIdUrl, selfieIdUrl,
          ]
        );
        residentRow = insertedRows[0];
      }

      // Generate login token for immediate portal access
      const token = jwt.sign(
        { id: residentRow.id, email: residentRow.email, fullName: residentRow.full_name, scope: 'resident' },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      // Send email notification in the background
      const loginUrl = (process.env.RESIDENT_FRONTEND_URL || 'http://localhost:5500').replace(/\/$/, '') + '/login';
      if (isVerified) {
        sendResidentApprovalEmail({
          to: normalizedEmail,
          residentName: fullName,
          residentId: residentRow.id,
          loginUrl,
        }).catch((err) => console.error('[registration] Error sending auto-approval email:', err.message));
      } else {
        sendResidentPendingVerificationEmail({
          to: normalizedEmail,
          residentName: fullName,
          residentId: residentRow.id,
          loginUrl,
        }).catch((err) => console.error('[registration] Error sending pending verification email:', err.message));
      }

      res.status(201).json({
        success: true,
        verified: isVerified,
        status: residentStatus,
        token,
        resident: toResidentAccount(residentRow),
        message: isVerified
          ? 'Your registration has been automatically verified against the Barangay Resident Database! Your account is approved and active.'
          : 'Your registration was received. Your details could not yet be automatically matched against the official Barangay Resident Database. Your account is set to Pending Verification with limited access to file complaints.',
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
router.post('/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  const mailTransport = createMailTransport();
  if (!mailTransport) {
    return res.status(503).json({ message: 'Email delivery is not configured. Contact the barangay administrator.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, full_name, email, password_reset_sent_at
       FROM residents WHERE LOWER(email) = $1 AND password_hash IS NOT NULL`,
      [email]
    );
    const resident = rows[0];
    const genericMessage = 'If an account matches that email, a 6-digit reset code has been sent. It expires in 10 minutes.';
    if (!resident) return res.json({ message: genericMessage });

    const lastSentAt = resident.password_reset_sent_at && new Date(resident.password_reset_sent_at).getTime();
    if (lastSentAt && Date.now() - lastSentAt < 60000) return res.json({ message: genericMessage });

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const codeHash = hashPasswordResetCode(resident.id, code);
    await pool.query(
      `UPDATE residents SET password_reset_code_hash = $1,
       password_reset_expires_at = now() + interval '10 minutes',
       password_reset_sent_at = now(), password_reset_attempts = 0
       WHERE id = $2`,
      [codeHash, resident.id]
    );

    try {
      await mailTransport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: resident.email,
        subject: 'Your Barangay Poblacion password reset code',
        text: `Hello ${resident.full_name || 'Resident'},\n\nYour password reset code is: ${code}\n\nThis code expires in 10 minutes and can only be used once. If you did not request a password reset, you can ignore this email.`,
      });
    } catch (mailError) {
      await pool.query(
        `UPDATE residents SET password_reset_code_hash = NULL,
         password_reset_expires_at = NULL, password_reset_sent_at = NULL
         WHERE id = $1`,
        [resident.id]
      );
      throw mailError;
    }

    return res.json({ message: genericMessage });
  } catch (err) {
    console.error('[resident-auth] Password reset code could not be sent:', err.message);
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      return res.status(503).json({ message: 'Password reset email is unavailable. Please contact the barangay administrator.' });
    }
    return res.status(500).json({ message: 'Unable to send a password reset code right now. Please try again later.' });
  }
});

router.post('/reset-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  const newPassword = String(req.body.newPassword || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code) || !newPassword) {
    return res.status(400).json({ message: 'Enter your email, the 6-digit code, and a new password.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, password_reset_code_hash, password_reset_expires_at, password_reset_attempts
       FROM residents WHERE LOWER(email) = $1 AND password_hash IS NOT NULL`,
      [email]
    );
    const resident = rows[0];
    if (!resident || !resident.password_reset_code_hash) {
      return res.status(400).json({ message: 'The reset code is invalid or expired. Request a new code.' });
    }
    if (resident.password_reset_attempts >= 5) {
      return res.status(429).json({ message: 'Too many incorrect codes. Request a new reset code.' });
    }
    if (!resident.password_reset_expires_at || new Date(resident.password_reset_expires_at) <= new Date()) {
      await pool.query(
        `UPDATE residents SET password_reset_code_hash = NULL, password_reset_expires_at = NULL,
         password_reset_attempts = 0 WHERE id = $1`,
        [resident.id]
      );
      return res.status(400).json({ message: 'The reset code has expired. Request a new code.' });
    }

    const suppliedHash = hashPasswordResetCode(resident.id, code);
    const expectedHash = resident.password_reset_code_hash;
    const matches = expectedHash.length === suppliedHash.length && crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'), Buffer.from(suppliedHash, 'hex')
    );
    if (!matches) {
      await pool.query(
        'UPDATE residents SET password_reset_attempts = password_reset_attempts + 1 WHERE id = $1',
        [resident.id]
      );
      return res.status(400).json({ message: 'The reset code is incorrect.' });
    }

    await pool.query(
      `UPDATE residents SET password_hash = $1, password_reset_code_hash = NULL,
       password_reset_expires_at = NULL, password_reset_sent_at = NULL,
       password_reset_attempts = 0 WHERE id = $2`,
      [hashPassword(newPassword), resident.id]
    );
    return res.json({ message: 'Your password has been reset. You can now sign in with your new password.' });
  } catch (err) {
    console.error('[resident-auth] Password reset failed:', err.message);
    return res.status(500).json({ message: 'Unable to reset your password right now. Please try again later.' });
  }
});

module.exports = router;
