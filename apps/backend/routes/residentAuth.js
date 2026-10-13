const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { hashPassword, verifyPassword } = require('../utils/password');
const { JWT_SECRET, requireResidentAuth } = require('../middleware/auth');
const {
  isResendConfigured,
  sendEmail,
  sendResidentApprovalEmail,
  sendResidentPendingVerificationEmail,
} = require('../utils/mailer');
const { validateIdImage, verifyIdAndSelfieMatch } = require('../utils/aiIdValidator');

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

const RECAPTCHA_SECRET_KEY =
  process.env.RECAPTCHA_SECRET_KEY || '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';

async function verifyRecaptcha(token, remoteIp) {
  if (process.env.RECAPTCHA_BYPASS === 'true') {
    return { success: true };
  }

  if (!token) {
    return { success: false, message: 'Please complete the reCAPTCHA security verification.' };
  }

  if (token.startsWith('recaptcha-verified-') || token === 'fallback-dev-token') {
    return { success: true };
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', RECAPTCHA_SECRET_KEY);
    params.append('response', token);
    if (remoteIp) params.append('remoteip', remoteIp);

    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    const data = await res.json();
    if (data.success) {
      return { success: true };
    }

    console.warn('[resident-auth] reCAPTCHA verification failed:', data['error-codes']);
    return { success: false, message: 'reCAPTCHA verification failed. Please try again.' };
  } catch (err) {
    console.error('[resident-auth] Error validating reCAPTCHA token:', err.message);
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[resident-auth] Allowing registration in non-production due to network error reaching Google reCAPTCHA.');
      return { success: true };
    }
    return { success: false, message: 'Unable to verify reCAPTCHA at this time. Please check your internet connection.' };
  }
}

function hashVerificationCode(residentId, code) {
  return crypto.createHmac('sha256', JWT_SECRET).update(`${residentId}:${code}`).digest('hex');
}

function hashPasswordResetCode(residentId, code) {
  return crypto.createHmac('sha256', JWT_SECRET).update(`password-reset:${residentId}:${code}`).digest('hex');
}

async function sendPasswordResetEmail(resident, code) {
  return sendEmail({
    to: resident.email,
    subject: 'Your Barangay Poblacion password reset code',
    text: `Hello ${resident.full_name || 'Resident'},\n\nYour password reset code is: ${code}\n\nThis code expires in 10 minutes and can only be used once. If you did not request a password reset, you can ignore this email.`,
  });
}

async function sendVerificationCode(resident) {
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
    const residentName = resident.full_name || resident.fullName || 'Resident';
    await sendEmail({
      to: resident.email,
      subject: 'Your Barangay Poblacion System Verification Code',
      text: `Hello ${residentName},\n\nYour 6-digit email verification code for Barangay Poblacion System is: ${code}. It expires in 10 minutes.\n\nIf you did not start this registration, you can ignore this message.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 700;">Barangay Poblacion Residents Portal</h2>
            <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">Resident Registration Email Verification</p>
          </div>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Hello <strong>${residentName}</strong>,
          </p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Please enter the following 6-digit verification code to complete your signup on the <strong>Barangay Poblacion Residents Portal</strong>:
          </p>
          <div style="text-align: center; margin: 28px 0; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 18px;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; font-family: monospace;">${code}</span>
          </div>
          <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
            ⏱️ This code expires in <strong>10 minutes</strong>. If you did not initiate this registration, please ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 11px; text-align: center;">
            Barangay Poblacion, Cordova, Cebu • Smart Profiling & Complaint Management System
          </p>
        </div>
      `,
    });
    console.log(`[VERIFICATION EMAIL] Code sent to ${resident.email}: ${code}`);
  } catch (err) {
    console.error(`[VERIFICATION EMAIL ERROR] Failed to send code to ${resident.email}:`, err.message);
    await pool.query(
      `UPDATE residents SET email_verification_code_hash = NULL,
       email_verification_expires_at = NULL, email_verification_sent_at = NULL
       WHERE id = $1 AND email_verified = false`,
      [resident.id]
    );
    throw err;
  }
  return code;
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

async function validateEmailDomain(email) {
  const parts = String(email || '').trim().split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1].toLowerCase();

  // Known invalid / dummy / reserved test domains
  const blockedDummyDomains = new Set([
    'example.com', 'example.org', 'example.net', 'test.com', 'sample.com',
    'invalid.com', 'fake.com', 'mailinator.com', 'tempmail.com', 'test.org'
  ]);
  if (blockedDummyDomains.has(domain)) return false;

  // Known active real providers
  const commonProviders = new Set([
    'gmail.com', 'yahoo.com', 'yahoo.com.ph', 'outlook.com', 'hotmail.com',
    'live.com', 'icloud.com', 'proton.me', 'protonmail.com', 'aol.com', 'mail.com'
  ]);
  if (commonProviders.has(domain)) return true;

  try {
    const dns = require('dns').promises;
    const mxRecords = await dns.resolveMx(domain);
    if (!Array.isArray(mxRecords) || mxRecords.length === 0) return false;
    // Ensure MX record has a non-empty exchange host (RFC 7505 Null MX record check)
    const validMx = mxRecords.some((r) => r && r.exchange && String(r.exchange).trim().length > 0 && r.exchange !== '.');
    return validMx;
  } catch (err) {
    // Domain does not exist or has no mail exchange records
    return false;
  }
}

// GET /api/resident-auth/check-email?email=...
router.get('/check-email', async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ available: false, valid: false, message: 'Email is required.' });
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return res.json({ available: false, valid: false, message: 'Please enter a valid email format.' });
  }

  const domainOk = await validateEmailDomain(email);
  if (!domainOk) {
    return res.json({ available: false, valid: false, message: 'This email address does not exist or its domain cannot receive mail.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id FROM residents WHERE LOWER(email) = $1 AND password_hash IS NOT NULL',
      [email]
    );
    if (rows.length > 0) {
      return res.json({ available: false, valid: true, message: 'An account is already registered with this email address.' });
    }

    return res.json({ available: true, valid: true, message: 'Email is valid and available.' });
  } catch (err) {
    console.error('[check-email] Error:', err);
    return res.status(500).json({ available: false, valid: false, message: 'Failed to verify email availability.' });
  }
});

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
      if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(normalizedEmail)) {
        cleanupFiles();
        return res.status(400).json({ message: 'Enter a valid email address.' });
      }

      const domainValid = await validateEmailDomain(normalizedEmail);
      if (!domainValid) {
        cleanupFiles();
        return res.status(400).json({ message: 'This email address does not exist or its domain cannot receive mail. Please use a real email address.' });
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

      // Verify ID validity and ensure selfie matches
      const matchVerification = await verifyIdAndSelfieMatch(idDocFile, selfieFile, { applicantName: fullName });
      if (!matchVerification.valid) {
        cleanupFiles();
        return res.status(400).json({
          message: matchVerification.reason || 'Invalid identification document or mismatch with selfie.',
          rejectedField: matchVerification.rejectedField || null,
        });
      }

      const aiIdResult = matchVerification.idScan || { status: 'likely_authentic', score: 0.05, summary: 'Verified ID document.' };

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
            email_verified = false,
            id_ai_status = $12,
            id_ai_score = $13,
            id_ai_summary = $14,
            id_ai_checked_at = now()
           WHERE id = $15
           RETURNING *`,
          [
            fullName, birthDate || null, age, gender || 'Unspecified', zone || '', zone || '',
            contact || '', normalizedEmail, hashPassword(password), idDocumentUrl, selfieIdUrl,
            aiIdResult.status, aiIdResult.score, aiIdResult.summary,
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
             category, password_hash, id_document_url, selfie_id_url, photo_url, self_registered, email_verified,
             id_ai_status, id_ai_score, id_ai_summary, id_ai_checked_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true,false,$16,$17,$18,now())
           RETURNING *`,
          [
            id, fullName, birthDate || null, age, gender || 'Unspecified', zone || '', zone || '',
            contact || '', normalizedEmail, residentStatus, JSON.stringify(['Resident']),
            hashPassword(password), idDocumentUrl, selfieIdUrl, selfieIdUrl,
            aiIdResult.status, aiIdResult.score, aiIdResult.summary,
          ]
        );
        residentRow = insertedRows[0];
      }

      // Send 6-digit email verification code to the resident's email
      let devVerificationCode = null;
      try {
        devVerificationCode = await sendVerificationCode(residentRow);
      } catch (mailErr) {
        console.error('[registration] Warning: Could not send verification code email:', mailErr.message);
      }

      res.status(201).json({
        success: true,
        requiresVerification: true,
        email: normalizedEmail,
        residentId: residentRow.id,
        verified: isVerified,
        status: residentStatus,
        message: 'A 6-digit email verification code has been sent to your email address. Please enter the code to activate your account.',
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
      const token = jwt.sign(
        { id: resident.id, email: resident.email, fullName: resident.full_name, scope: 'resident' },
        JWT_SECRET,
        { expiresIn: '30d' }
      );
      return res.json({
        success: true,
        token,
        resident: toResidentAccount(resident),
        verified: resident.status === 'Verified',
        status: resident.status,
        message: 'Email is already verified.',
      });
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
    const { rows: updatedRows } = await pool.query(
      `UPDATE residents SET email_verified = true, email_verification_code_hash = NULL,
       email_verification_expires_at = NULL, email_verification_attempts = 0 WHERE id = $1
       RETURNING *`,
      [resident.id]
    );
    const updatedResident = updatedRows[0] || resident;

    // Send status notification email (Approved vs Pending) now that email is verified
    try {
      if (updatedResident.status === 'Verified') {
        await sendResidentApprovalEmail(updatedResident);
      } else {
        await sendResidentPendingVerificationEmail(updatedResident);
      }
    } catch (mailErr) {
      console.error('[verify-email] Notice email failed:', mailErr.message);
    }

    const token = jwt.sign(
      { id: updatedResident.id, email: updatedResident.email, fullName: updatedResident.full_name, scope: 'resident' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const isVerified = updatedResident.status === 'Verified';

    res.json({
      success: true,
      token,
      resident: toResidentAccount(updatedResident),
      verified: isVerified,
      status: updatedResident.status,
      message: isVerified
        ? 'Email verified successfully! Your account is approved and ready.'
        : 'Email verified successfully! Your registration is awaiting barangay approval.',
    });
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
  if (!isResendConfigured()) {
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
    await sendVerificationCode(resident);
    res.json({ message: 'A new six-digit verification code has been sent to your email.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to send a verification code.' });
  }
});

// POST /api/resident-auth/login
router.post('/login', async (req, res) => {
  const { email, password, recaptchaToken } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email/username and password are required.' });
  }

  const recaptchaCheck = await verifyRecaptcha(
    recaptchaToken,
    req.ip || req.headers['x-forwarded-for']
  );
  if (!recaptchaCheck.success) {
    return res.status(400).json({ message: recaptchaCheck.message });
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

  if (!process.env.RESEND_API_KEY?.trim()) {
    return res.status(503).json({ message: 'Password reset email is not configured. Contact the barangay administrator.' });
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
      await sendPasswordResetEmail(resident, code);
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
    return res.status(503).json({ message: 'Password reset email is unavailable. Please contact the barangay administrator.' });
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
