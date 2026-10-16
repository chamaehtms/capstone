const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { hashPassword, verifyPassword } = require('../utils/password');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');
const { isResendConfigured, sendEmail } = require('../utils/mailer');
const { validateIdImage, verifyIdAndSelfieMatch } = require('../utils/aiIdValidator');
const {
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteLocalUpload,
} = require('../utils/cloudinary');

const router = express.Router();

// ---- Admin photo upload setup ----
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'admins');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${req.admin.id}-${Date.now()}${ext}`);
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

// ---- Admin registration ID photo upload setup ----
const ADMIN_ID_DIR = path.join(__dirname, '..', 'uploads', 'admin-ids');
fs.mkdirSync(ADMIN_ID_DIR, { recursive: true });

const adminIdStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ADMIN_ID_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `admin-id-${Date.now()}-${uuidv4().slice(0, 8)}${ext}`);
  },
});

const adminIdUpload = multer({
  storage: adminIdStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    if (!ok) {
      return cb(new Error('Only image or PDF files are allowed.'));
    }
    cb(null, true);
  },
});

const adminRegistrationUpload = adminIdUpload.fields([
  { name: 'idPhoto', maxCount: 1 },
  { name: 'selfiePhoto', maxCount: 1 },
]);

function hashVerificationCode(requestId, code) {
  return crypto.createHmac('sha256', JWT_SECRET).update(`${requestId}:${code}`).digest('hex');
}

async function sendAdminVerificationCode(request) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const codeHash = hashVerificationCode(request.id, code);

  await pool.query(
    `UPDATE access_requests
     SET email_verified = false,
         email_verification_code_hash = $1,
         email_verification_expires_at = now() + interval '15 minutes',
         email_verification_sent_at = now(),
         email_verification_attempts = 0
     WHERE id = $2`,
    [codeHash, request.id]
  );

  try {
    await sendEmail({
      to: request.email,
      subject: 'Your Barangay Poblacion System Verification Code',
      text: `Hello ${request.full_name || 'Administrator'},\n\nYour 6-digit verification code for Barangay Poblacion System is:\n\n${code}\n\nThis code will expire in 15 minutes. Enter this code on the registration page to verify your institutional email address.\n\nIf you did not request administrative access, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #0f172a; margin: 0; font-size: 20px; font-weight: 700;">Barangay Poblacion System</h2>
            <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">Official Administrative Access Verification</p>
          </div>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Hello <strong>${request.full_name || 'Applicant'}</strong>,
          </p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Use the following 6-digit verification code to verify your email address and complete your administrative enrollment request in <strong>Barangay Poblacion System</strong>:
          </p>
          <div style="text-align: center; margin: 28px 0; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 18px;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; font-family: monospace;">${code}</span>
          </div>
          <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
            ⏱️ This code expires in <strong>15 minutes</strong>. Check your inbox or spam folder. If you did not initiate this request, you can safely ignore this message.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 11px; text-align: center;">
            Barangay Poblacion System • Smart Profiling & Complaint Management
          </p>
        </div>
      `,
    });
    console.log(`[EMAIL DISPATCHED] 6-digit verification code sent to Gmail: ${request.email}`);
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to send admin verification code:', err.message);
    throw new Error('Unable to send verification code: ' + err.message);
  }

  return code;
}

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

    console.warn('[admin-auth] reCAPTCHA verification failed:', data['error-codes']);
    return { success: false, message: 'reCAPTCHA verification failed. Please try again.' };
  } catch (err) {
    console.error('[admin-auth] Error validating reCAPTCHA token:', err.message);
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[admin-auth] Allowing login in non-production due to network error reaching Google reCAPTCHA.');
      return { success: true };
    }
    return { success: false, message: 'Unable to verify reCAPTCHA at this time. Please check your internet connection.' };
  }
}

// In-memory tracker for admin login attempts: Map<normalizedKey, { attempts: number, lockUntil: number }>
const adminLoginAttempts = new Map();

// Periodically clean up expired login attempt records
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of adminLoginAttempts.entries()) {
    if (now > val.lockUntil && val.attempts === 0) {
      adminLoginAttempts.delete(key);
    }
  }
}, 60 * 1000);

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, institutionalId, password, recaptchaToken } = req.body;
  const loginEmail = String(email || institutionalId || '').trim();

  if (!loginEmail || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const attemptKey = `${loginEmail.toLowerCase()}_${clientIp}`;
  const now = Date.now();

  const attemptRecord = adminLoginAttempts.get(attemptKey) || { attempts: 0, lockUntil: 0 };

  // Check if admin is locked out due to 5 consecutive wrong attempts
  if (now < attemptRecord.lockUntil) {
    const secondsRemaining = Math.ceil((attemptRecord.lockUntil - now) / 1000);
    return res.status(429).json({
      message: `Too many failed login attempts. Please wait ${secondsRemaining} second${secondsRemaining > 1 ? 's' : ''} before trying again.`,
      locked: true,
      secondsRemaining,
    });
  }

  // If lockout expired, reset attempts counter
  if (attemptRecord.lockUntil > 0 && now >= attemptRecord.lockUntil) {
    attemptRecord.attempts = 0;
    attemptRecord.lockUntil = 0;
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM admins WHERE LOWER(email) = LOWER($1) OR institutional_id = $1 LIMIT 1',
      [loginEmail]
    );
    const admin = rows[0];

    // Check if account exists and password is correct first
    if (!admin || !verifyPassword(password, admin.password_hash)) {
      attemptRecord.attempts += 1;

      if (attemptRecord.attempts >= 5) {
        attemptRecord.lockUntil = now + 60 * 1000; // 1 minute lockout
        adminLoginAttempts.set(attemptKey, attemptRecord);
        return res.status(429).json({
          message: 'Too many failed login attempts (5/5). Your account login is temporarily locked for 1 minute.',
          locked: true,
          secondsRemaining: 60,
        });
      }

      adminLoginAttempts.set(attemptKey, attemptRecord);
      return res.status(401).json({
        message: 'Invalid email or password.',
      });
    }

    // On correct password, reset failed attempts
    adminLoginAttempts.delete(attemptKey);

    if (admin.status !== 'approved') {
      return res.status(403).json({ message: 'This account is still pending Institutional Board approval.' });
    }

    // Credentials are valid: if captcha has not been completed yet, prompt user for puzzle
    if (!recaptchaToken) {
      return res.json({ requiresCaptcha: true });
    }

    // Verify reCAPTCHA puzzle token
    const recaptchaCheck = await verifyRecaptcha(
      recaptchaToken,
      req.ip || req.connection?.remoteAddress
    );
    if (!recaptchaCheck.success) {
      return res.status(400).json({ message: recaptchaCheck.message });
    }

    const token = jwt.sign(
      { id: admin.id, institutionalId: admin.institutional_id, fullName: admin.full_name, role: admin.role, scope: 'admin' },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      admin: {
        id: admin.id,
        fullName: admin.full_name,
        institutionalId: admin.institutional_id,
        department: admin.department,
        role: admin.role,
        photoUrl: admin.photo_url,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error during login.' });
  }
});

// POST /api/auth/request-access
router.post('/request-access', (req, res) => {
  adminRegistrationUpload(req, res, async (uploadErr) => {
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
        firstName,
        middleName,
        lastName,
        fullName: rawFullName,
        sex,
        contactNo,
        email,
        department,
        employeeId,
        password,
      } = req.body;

      const fName = String(firstName || '').trim();
      const mName = String(middleName || '').trim();
      const lName = String(lastName || '').trim();
      const derivedFullName = [fName, mName, lName].filter(Boolean).join(' ');
      const finalFullName = derivedFullName || String(rawFullName || '').trim();
      const userSex = String(sex || '').trim();
      const userContact = String(contactNo || '').trim();
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const empId = String(employeeId || '').trim();
      const dept = String(department || '').trim();
      const pwd = String(password || '');

      const idPhotoFile = req.files?.['idPhoto']?.[0];
      const selfiePhotoFile = req.files?.['selfiePhoto']?.[0];

      if (!fName && !finalFullName) {
        cleanupFiles();
        return res.status(400).json({ message: 'First name is required.' });
      }
      if (!lName && !finalFullName) {
        cleanupFiles();
        return res.status(400).json({ message: 'Last name is required.' });
      }
      if (!userSex) {
        cleanupFiles();
        return res.status(400).json({ message: 'Sex is required.' });
      }
      if (!userContact) {
        cleanupFiles();
        return res.status(400).json({ message: 'Contact number is required.' });
      }
      if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        cleanupFiles();
        return res.status(400).json({ message: 'Enter a valid email address.' });
      }
      if (!empId) {
        cleanupFiles();
        return res.status(400).json({ message: 'Employee ID is required.' });
      }
      if (!dept) {
        cleanupFiles();
        return res.status(400).json({ message: 'Department is required.' });
      }
      if (!pwd || pwd.length < 8) {
        cleanupFiles();
        return res.status(400).json({ message: 'Password must be at least 8 characters.' });
      }
      if (!idPhotoFile) {
        cleanupFiles();
        return res.status(400).json({ message: 'Valid ID photo is required.' });
      }
      if (!selfiePhotoFile) {
        cleanupFiles();
        return res.status(400).json({ message: 'Selfie holding your valid ID is required.' });
      }

      const usesCloudinary = isCloudinaryConfigured();
      let idDocumentUrl = `/uploads/admin-ids/${idPhotoFile.filename}`;
      let selfieIdUrl = `/uploads/admin-ids/${selfiePhotoFile.filename}`;
      let uploadedIdUrl = null;
      let uploadedSelfieUrl = null;

      if (usesCloudinary) {
        uploadedIdUrl = await uploadToCloudinary(idPhotoFile, 'barangay/admin-requests/ids');
        uploadedSelfieUrl = await uploadToCloudinary(selfiePhotoFile, 'barangay/admin-requests/selfies');

        if (uploadedIdUrl) {
          idDocumentUrl = uploadedIdUrl;
        }
        if (uploadedSelfieUrl) {
          selfieIdUrl = uploadedSelfieUrl;
        }
      }

      // Check if approved admin exists with this email or employeeId
      const { rows: existingAdmins } = await pool.query(
        'SELECT id FROM admins WHERE LOWER(email) = $1 OR institutional_id = $2',
        [normalizedEmail, empId]
      );
      if (existingAdmins.length > 0) {
        cleanupFiles();
        return res.status(409).json({ message: 'An administrator account already exists for this email or Employee ID.' });
      }

      // Check existing access_requests
      const { rows: existingRequests } = await pool.query(
        'SELECT id, email_verified, email_verification_sent_at FROM access_requests WHERE LOWER(email) = $1 OR employee_id = $2',
        [normalizedEmail, empId]
      );

      // Verify ID validity and ensure selfie matches
      const matchVerification = await verifyIdAndSelfieMatch(idPhotoFile, selfiePhotoFile, { applicantName: finalFullName });
      if (!matchVerification.valid) {
        cleanupFiles();
        return res.status(400).json({
          message: matchVerification.reason || 'Invalid identification document or mismatch with selfie.',
          rejectedField: matchVerification.rejectedField || null,
        });
      }

      const aiIdResult = matchVerification.idScan || { status: 'likely_authentic', score: 0.05, summary: 'Verified ID document.' };

      let requestId;
      if (existingRequests.length > 0) {
        const existingReq = existingRequests[0];
        if (existingReq.email_verified) {
          cleanupFiles();
          return res.status(409).json({
            message: 'An access request for this email/Employee ID has already been verified and is awaiting Institutional Board review.',
          });
        }

        // Reuse unverified request: update details
        requestId = existingReq.id;
        await pool.query(
          `UPDATE access_requests
           SET first_name = $1, middle_name = $2, last_name = $3, full_name = $4,
               sex = $5, contact_no = $6, email = $7, department = $8, employee_id = $9,
               password_hash = $10,
               id_document_url = COALESCE($11, id_document_url),
               selfie_id_url = COALESCE($12, selfie_id_url),
               id_ai_status = $13,
               id_ai_score = $14,
               id_ai_summary = $15,
               id_ai_checked_at = now(),
               requested_at = now()
           WHERE id = $16`,
          [
            fName,
            mName,
            lName,
            finalFullName,
            userSex,
            userContact,
            normalizedEmail,
            dept,
            empId,
            hashPassword(pwd),
            idDocumentUrl,
            selfieIdUrl,
            aiIdResult.status,
            aiIdResult.score,
            aiIdResult.summary,
            requestId,
          ]
        );
      } else {
        requestId = uuidv4();
        await pool.query(
          `INSERT INTO access_requests
             (id, first_name, middle_name, last_name, full_name, sex, contact_no, email, department,
              employee_id, password_hash, id_document_url, selfie_id_url, status, email_verified,
              id_ai_status, id_ai_score, id_ai_summary, id_ai_checked_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',false,$14,$15,$16,now())`,
          [
            requestId,
            fName,
            mName,
            lName,
            finalFullName,
            userSex,
            userContact,
            normalizedEmail,
            dept,
            empId,
            hashPassword(pwd),
            idDocumentUrl,
            selfieIdUrl,
            aiIdResult.status,
            aiIdResult.score,
            aiIdResult.summary,
          ]
        );
      }

      if (!isResendConfigured()) {
        cleanupFiles();
        return res.status(503).json({
          message: 'Email delivery is not configured. Contact the system administrator.',
        });
      }

      await sendAdminVerificationCode(
        { id: requestId, email: normalizedEmail, full_name: finalFullName }
      );

      // Notify admin team about new staff access request
      try {
        await pool.query(
          `INSERT INTO notifications (id, target_role, title, message, type, link, actor_name, actor_avatar, created_at)
           VALUES ($1, 'admin', $2, $3, 'pending_access', '/pending-requests', $4, $5, now())`,
          [
            `notif-${uuidv4().slice(0, 8)}`,
            'New Staff Access Request',
            `${finalFullName} requested administrative access (${dept || 'Barangay Staff'}).`,
            finalFullName,
            selfieIdUrl || null,
          ]
        );
      } catch (adminNotifErr) {
        console.error('[notifications] Failed to log admin notification for access request:', adminNotifErr.message);
      }

      if (uploadedIdUrl) {
        await deleteLocalUpload(idPhotoFile);
      }
      if (uploadedSelfieUrl) {
        await deleteLocalUpload(selfiePhotoFile);
      }

      return res.status(201).json({
        verificationRequired: true,
        requestId,
        email: normalizedEmail,
        message: `A 6-digit verification code has been dispatched to your Gmail (${normalizedEmail}). Please open your Gmail app to view your code.`,
      });
    } catch (err) {
      console.error('Request access error:', err);
      cleanupFiles();
      return res.status(500).json({ message: 'Unable to submit request: ' + (err.message || 'Server error') });
    }
  });
});

// POST /api/auth/verify-code (verifies 6-digit OTP for admin requests)
router.post('/verify-code', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const requestId = String(req.body.requestId || '').trim();
  const code = String(req.body.code || '').trim();

  if (!code || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: 'Please enter a valid 6-digit verification code.' });
  }

  if (!email && !requestId) {
    return res.status(400).json({ message: 'Email address or request ID is required.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, full_name, email, email_verified, email_verification_code_hash,
              email_verification_expires_at, email_verification_attempts
       FROM access_requests
       WHERE (id = $1 OR LOWER(email) = LOWER($2)) AND status = 'pending'
       ORDER BY requested_at DESC LIMIT 1`,
      [requestId || '', email || '']
    );

    const request = rows[0];
    if (!request) {
      return res.status(404).json({ message: 'No pending access request was found for this email.' });
    }

    if (request.email_verified) {
      return res.json({
        success: true,
        message: 'Email verified. Your registration request is awaiting Institutional Board approval.',
      });
    }

    if (request.email_verification_attempts >= 5) {
      return res.status(429).json({ message: 'Too many incorrect attempts. Please request a new verification code.' });
    }

    if (!request.email_verification_expires_at || new Date(request.email_verification_expires_at) <= new Date()) {
      return res.status(400).json({ message: 'This verification code has expired. Please request a new code.' });
    }

    const suppliedHash = hashVerificationCode(request.id, code);
    const expectedHash = request.email_verification_code_hash || '';

    const matches =
      expectedHash.length === suppliedHash.length &&
      crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(suppliedHash, 'hex'));

    if (!matches) {
      await pool.query(
        'UPDATE access_requests SET email_verification_attempts = email_verification_attempts + 1 WHERE id = $1',
        [request.id]
      );
      return res.status(400).json({ message: 'The verification code is incorrect. Please check and try again.' });
    }

    await pool.query(
      `UPDATE access_requests
       SET email_verified = true,
           email_verification_code_hash = NULL,
           email_verification_expires_at = NULL,
           email_verification_attempts = 0
       WHERE id = $1`,
      [request.id]
    );

    return res.json({
      success: true,
      message: 'Email verified successfully! Your application is now Waiting for Approval by the Institutional Board.',
    });
  } catch (err) {
    console.error('Verify code error:', err);
    return res.status(500).json({ message: 'Unable to verify code: ' + (err.message || 'Server error') });
  }
});

// POST /api/auth/resend-code (resends 6-digit OTP with 60s cooldown)
router.post('/resend-code', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const requestId = String(req.body.requestId || '').trim();

  if (!email && !requestId) {
    return res.status(400).json({ message: 'Email address or request ID is required.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, full_name, email, email_verified, email_verification_sent_at
       FROM access_requests
       WHERE (id = $1 OR LOWER(email) = LOWER($2)) AND status = 'pending'
       ORDER BY requested_at DESC LIMIT 1`,
      [requestId || '', email || '']
    );

    const request = rows[0];
    if (!request) {
      return res.status(404).json({ message: 'No pending access request was found.' });
    }

    if (request.email_verified) {
      return res.json({
        message: 'Email is already verified. Your application is awaiting Institutional Board approval.',
      });
    }

    const lastSent = request.email_verification_sent_at && new Date(request.email_verification_sent_at).getTime();
    if (lastSent && Date.now() - lastSent < 60000) {
      const waitSec = Math.ceil((60000 - (Date.now() - lastSent)) / 1000);
      return res.status(429).json({ message: `Please wait ${waitSec} seconds before requesting a new code.` });
    }

    if (!isResendConfigured()) {
      return res.status(503).json({
        message: 'Email delivery is not configured. Contact the system administrator.',
      });
    }

    await sendAdminVerificationCode(request);

    return res.json({
      message: 'A new 6-digit verification code has been sent to your email. Please check your inbox.',
    });
  } catch (err) {
    console.error('Resend code error:', err);
    return res.status(500).json({ message: 'Unable to resend verification code: ' + (err.message || 'Server error') });
  }
});

// Legacy POST /api/auth/verify-email (backward compatibility)
router.post('/verify-email', async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'Verification link is invalid or expired.' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  try {
    const { rows } = await pool.query(
      `UPDATE access_requests
        SET email_verified = true
       WHERE verification_token_hash = $1 AND verification_expires_at > now()
       RETURNING email`,
      [tokenHash]
    );
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Verification link is invalid, expired, or already used.' });
    }
    res.json({ message: 'Email verified. Your request is ready for Institutional Board review.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to verify this email address.' });
  }
});

// Legacy POST /api/auth/resend-verification (backward compatibility)
router.post('/resend-verification', async (req, res) => {
  const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  if (!isResendConfigured()) {
    return res.status(503).json({ message: 'Email verification is not configured. Contact the system administrator.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, full_name FROM access_requests
       WHERE LOWER(email) = $1 AND status = 'pending' AND email_verified = false`,
      [normalizedEmail]
    );
    if (rows.length === 0) {
      return res.json({ message: 'If an unverified access request matches this email, a new link has been sent.' });
    }

    const request = rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await pool.query(
      `UPDATE access_requests SET verification_token_hash = $1,
       verification_expires_at = now() + interval '24 hours' WHERE id = $2`,
      [tokenHash, request.id]
    );
    const verificationUrl = new URL('/verify-email', process.env.FRONTEND_URL || 'http://localhost:5173');
    verificationUrl.searchParams.set('token', token);
    await sendEmail({
      to: normalizedEmail,
      subject: 'Verify your Barangay Poblacion admin request',
      text: `Hello ${request.full_name},\n\nUse this link to verify your email address:\n${verificationUrl.toString()}\n\nThis link expires in 24 hours. If you did not request access, you can ignore this message.`,
    });
    res.json({ message: 'If an unverified access request matches this email, a new link has been sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to send a verification email.' });
  }
});

function hashAdminPasswordResetCode(adminId, code) {
  return crypto.createHmac('sha256', JWT_SECRET).update(`admin-password-reset:${adminId}:${code}`).digest('hex');
}

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  const genericMessage = 'If an account matches that email, a 6-digit reset code has been sent. It expires in 10 minutes.';

  try {
    const { rows } = await pool.query(
      `SELECT id, full_name, email, password_reset_sent_at
       FROM admins WHERE LOWER(email) = $1 AND password_hash IS NOT NULL`,
      [email]
    );
    const admin = rows[0];
    if (!admin) return res.json({ message: genericMessage });

    const lastSentAt = admin.password_reset_sent_at && new Date(admin.password_reset_sent_at).getTime();
    if (lastSentAt && Date.now() - lastSentAt < 60000) return res.json({ message: genericMessage });

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const codeHash = hashAdminPasswordResetCode(admin.id, code);
    await pool.query(
      `UPDATE admins SET password_reset_code_hash = $1,
       password_reset_expires_at = now() + interval '10 minutes',
       password_reset_sent_at = now(), password_reset_attempts = 0
       WHERE id = $2`,
      [codeHash, admin.id]
    );

    if (isResendConfigured()) {
      try {
        await sendEmail({
          to: admin.email,
          subject: 'Your Barangay Poblacion Admin password reset code',
          text: `Hello ${admin.full_name || 'Administrator'},\n\nYour administrative password reset code is: ${code}\n\nThis code expires in 10 minutes and can only be used once. If you did not request a password reset, you can ignore this email.`,
        });
      } catch (mailError) {
        console.error('[admin-auth] Mail delivery error:', mailError.message);
      }
    } else {
      console.log(`[admin-auth-dev] Password reset code for ${admin.email}: ${code}`);
    }

    return res.json({ message: genericMessage });
  } catch (err) {
    console.error('[admin-auth] Password reset code error:', err.message);
    return res.json({ message: genericMessage });
  }
});

// POST /api/auth/reset-password
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
       FROM admins WHERE LOWER(email) = $1 AND password_hash IS NOT NULL`,
      [email]
    );
    const admin = rows[0];
    if (!admin || !admin.password_reset_code_hash) {
      return res.status(400).json({ message: 'The reset code is invalid or expired. Request a new code.' });
    }
    if (admin.password_reset_attempts >= 5) {
      return res.status(429).json({ message: 'Too many incorrect codes. Request a new reset code.' });
    }
    if (!admin.password_reset_expires_at || new Date(admin.password_reset_expires_at) <= new Date()) {
      await pool.query(
        `UPDATE admins SET password_reset_code_hash = NULL, password_reset_expires_at = NULL,
         password_reset_attempts = 0 WHERE id = $1`,
        [admin.id]
      );
      return res.status(400).json({ message: 'The reset code has expired. Request a new code.' });
    }

    const suppliedHash = hashAdminPasswordResetCode(admin.id, code);
    const expectedHash = admin.password_reset_code_hash;
    const matches = expectedHash.length === suppliedHash.length && crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'), Buffer.from(suppliedHash, 'hex')
    );
    if (!matches) {
      await pool.query(
        'UPDATE admins SET password_reset_attempts = password_reset_attempts + 1 WHERE id = $1',
        [admin.id]
      );
      return res.status(400).json({ message: 'The reset code is incorrect.' });
    }

    await pool.query(
      `UPDATE admins SET password_hash = $1, password_reset_code_hash = NULL,
       password_reset_expires_at = NULL, password_reset_sent_at = NULL,
       password_reset_attempts = 0 WHERE id = $2`,
      [hashPassword(newPassword), admin.id]
    );
    return res.json({ message: 'Your password has been reset. You can now sign in with your new password.' });
  } catch (err) {
    console.error('[admin-auth] Password reset failed:', err.message);
    return res.status(500).json({ message: 'Unable to reset your password right now. Please try again later.' });
  }
});

// ---- Account (requires a logged-in admin) ----

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, institutional_id, first_name, middle_name, last_name, full_name, sex, contact_no, email, department, role, photo_url, id_document_url, selfie_id_url FROM admins WHERE id = $1',
      [req.admin.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Admin not found.' });

    const a = rows[0];
    res.json({
      id: a.id,
      institutionalId: a.institutional_id,
      firstName: a.first_name,
      middleName: a.middle_name,
      lastName: a.last_name,
      fullName: a.full_name,
      sex: a.sex,
      contactNo: a.contact_no,
      email: a.email,
      department: a.department,
      role: a.role,
      photoUrl: a.photo_url,
      idDocumentUrl: a.id_document_url,
      selfieIdUrl: a.selfie_id_url,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading account.' });
  }
});

// POST /api/auth/me/photo  (upload/replace the logged-in admin's profile picture)
router.post('/me/photo', requireAuth, (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Unable to upload photo.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No photo file was provided.' });
    }

    try {
      const { rows: existingRows } = await pool.query('SELECT photo_url FROM admins WHERE id = $1', [req.admin.id]);
      if (existingRows.length === 0) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ message: 'Admin not found.' });
      }

      const oldPhotoUrl = existingRows[0].photo_url;
      if (oldPhotoUrl) {
        const oldPath = path.join(__dirname, '..', oldPhotoUrl.replace(/^\//, ''));
        fs.unlink(oldPath, () => {});
      }

      const usesCloudinary = isCloudinaryConfigured();
      let photoUrl = `/uploads/admins/${req.file.filename}`;

      if (usesCloudinary) {
        const uploadedUrl = await uploadToCloudinary(req.file, 'barangay/admin/profile');
        if (uploadedUrl) {
          photoUrl = uploadedUrl;
          await deleteLocalUpload(req.file);
        }
      }

      const { rows } = await pool.query(
        'UPDATE admins SET photo_url = $1 WHERE id = $2 RETURNING id, institutional_id, full_name, email, department, role, photo_url',
        [photoUrl, req.admin.id]
      );

      const a = rows[0];
      res.json({
        id: a.id,
        institutionalId: a.institutional_id,
        fullName: a.full_name,
        email: a.email,
        department: a.department,
        role: a.role,
        photoUrl: a.photo_url,
      });
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ message: 'Database error saving photo.' });
    }
  });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters.' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM admins WHERE id = $1', [req.admin.id]);
    const admin = rows[0];
    if (!admin || !verifyPassword(currentPassword, admin.password_hash)) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    await pool.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [
      hashPassword(newPassword),
      admin.id,
    ]);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error updating password.' });
  }
});

// ---- Access request management (requires a logged-in admin) ----

// GET /api/auth/access-requests
router.get('/access-requests', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, middle_name, last_name, full_name, sex, contact_no, email, department, employee_id, id_document_url, selfie_id_url, id_ai_status, id_ai_score, id_ai_summary, id_ai_checked_at, requested_at
       FROM access_requests WHERE status = 'pending' AND (email_verified = true OR email_verified IS NULL) ORDER BY requested_at ASC`
    );

    // Auto-scan any un-scanned access requests
    for (const r of rows) {
      if ((!r.id_ai_status || r.id_ai_status === 'not_scanned') && r.id_document_url) {
        try {
          const scan = await validateIdImage(r.id_document_url);
          await pool.query(
            `UPDATE access_requests
             SET id_ai_status = $1, id_ai_score = $2, id_ai_summary = $3, id_ai_checked_at = now()
             WHERE id = $4`,
            [scan.status, scan.score, scan.summary, r.id]
          );
          r.id_ai_status = scan.status;
          r.id_ai_score = scan.score;
          r.id_ai_summary = scan.summary;
          r.id_ai_checked_at = new Date();
        } catch (err) {
          console.error(`[AI ID Auto-scan] Error scanning access request ${r.id}:`, err.message);
        }
      }
    }

    res.json(
      rows.map((r) => ({
        id: r.id,
        firstName: r.first_name,
        middleName: r.middle_name,
        lastName: r.last_name,
        fullName: r.full_name || [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' '),
        sex: r.sex,
        contactNo: r.contact_no,
        email: r.email,
        department: r.department,
        employeeId: r.employee_id,
        idDocumentUrl: r.id_document_url,
        selfieIdUrl: r.selfie_id_url,
        idAiStatus: r.id_ai_status || 'not_scanned',
        idAiScore: r.id_ai_score != null ? Number(r.id_ai_score) : null,
        idAiSummary: r.id_ai_summary || '',
        idAiCheckedAt: r.id_ai_checked_at || null,
        requestedAt: r.requested_at,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading requests.' });
  }
});

// POST /api/auth/access-requests/:id/scan-id (re-scan ID with AI validation)
router.post('/access-requests/:id/scan-id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM access_requests WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Request not found.' });

    const request = rows[0];
    if (!request.id_document_url) {
      return res.status(400).json({ message: 'No ID document available to scan.' });
    }

    const scan = await validateIdImage(request.id_document_url);
    await pool.query(
      `UPDATE access_requests
       SET id_ai_status = $1, id_ai_score = $2, id_ai_summary = $3, id_ai_checked_at = now()
       WHERE id = $4`,
      [scan.status, scan.score, scan.summary, request.id]
    );

    res.json({
      id: request.id,
      idAiStatus: scan.status,
      idAiScore: scan.score,
      idAiSummary: scan.summary,
      idAiCheckedAt: new Date(),
    });
  } catch (err) {
    console.error('[scan-id] Error:', err);
    res.status(500).json({ message: 'Unable to scan ID document.' });
  }
});

// POST /api/auth/access-requests/:id/approve
router.post('/access-requests/:id/approve', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: reqRows } = await client.query(
      'SELECT * FROM access_requests WHERE id = $1',
      [req.params.id]
    );
    const request = reqRows[0];
    if (!request) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Request not found.' });
    }
    if (request.id_ai_status === 'ai_detected') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'Cannot approve: The submitted ID has been flagged by AI validation as synthetic or fraudulent. Please reject or request authentic documents.',
      });
    }
    if (request.email_verified === false) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'The applicant must verify their email before approval.' });
    }

    const { rows: idTakenRows } = await client.query(
      'SELECT id FROM admins WHERE institutional_id = $1',
      [request.employee_id]
    );
    if (idTakenRows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'An admin with this Employee ID already exists.' });
    }

    const newAdminId = `adm-${uuidv4().slice(0, 8)}`;
    await client.query(
      `INSERT INTO admins (id, institutional_id, first_name, middle_name, last_name, full_name, sex, contact_no, email, department, password_hash, status, role, photo_url, id_document_url, selfie_id_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'approved','Administrator',$12,$13,$14)`,
      [
        newAdminId,
        request.employee_id,
        request.first_name || '',
        request.middle_name || '',
        request.last_name || '',
        request.full_name,
        request.sex || '',
        request.contact_no || '',
        request.email,
        request.department,
        request.password_hash,
        request.selfie_id_url || request.id_document_url || null,
        request.id_document_url || null,
        request.selfie_id_url || null,
      ]
    );

    await client.query('DELETE FROM access_requests WHERE id = $1', [request.id]);
    await client.query('COMMIT');

    res.json({
      message: `${request.full_name} has been approved and can now log in with their email address.`,
      admin: { id: newAdminId, institutionalId: request.employee_id, fullName: request.full_name },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Database error approving request.' });
  } finally {
    client.release();
  }
});

// POST /api/auth/access-requests/:id/reject
router.post('/access-requests/:id/reject', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM access_requests WHERE id = $1 RETURNING full_name',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Request not found.' });

    res.json({ message: `Request from ${rows[0].full_name} has been rejected and removed.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error rejecting request.' });
  }
});

module.exports = router;
