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
const { JWT_SECRET, requireAuth } = require('../middleware/auth');

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

function hashVerificationCode(requestId, code) {
  return crypto.createHmac('sha256', JWT_SECRET).update(`${requestId}:${code}`).digest('hex');
}

async function sendAdminVerificationCode(request, mailTransport) {
  if (!mailTransport) {
    throw new Error('Gmail sending is not configured. Please set your Gmail address and 16-character Google App Password in backend/.env.');
  }

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
    await mailTransport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
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
            Use the following 6-digit verification code to verify your Gmail address and complete your administrative enrollment request in <strong>Barangay Poblacion System</strong>:
          </p>
          <div style="text-align: center; margin: 28px 0; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 18px;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; font-family: monospace;">${code}</span>
          </div>
          <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
            ⏱️ This code expires in <strong>15 minutes</strong>. Check your Gmail inbox or spam folder. If you did not initiate this request, you can safely ignore this message.
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
    console.error('[SMTP ERROR] Failed to send email via Gmail:', err.message);
    throw new Error('Unable to send code to Gmail: ' + err.message);
  }

  return code;
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, institutionalId, password } = req.body;
  const loginEmail = String(email || institutionalId || '').trim();

  if (!loginEmail || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM admins WHERE LOWER(email) = LOWER($1) OR institutional_id = $1 LIMIT 1',
      [loginEmail]
    );
    const admin = rows[0];

    if (!admin || !verifyPassword(password, admin.password_hash)) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (admin.status !== 'approved') {
      return res.status(403).json({ message: 'This account is still pending Institutional Board approval.' });
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

      const idDocumentUrl = `/uploads/admin-ids/${idPhotoFile.filename}`;
      const selfieIdUrl = `/uploads/admin-ids/${selfiePhotoFile.filename}`;

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
               requested_at = now()
           WHERE id = $13`,
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
            requestId,
          ]
        );
      } else {
        requestId = uuidv4();
        await pool.query(
          `INSERT INTO access_requests
             (id, first_name, middle_name, last_name, full_name, sex, contact_no, email, department,
              employee_id, password_hash, id_document_url, selfie_id_url, status, email_verified)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',false)`,
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
          ]
        );
      }

      const mailTransport = createMailTransport();
      if (!mailTransport) {
        cleanupFiles();
        return res.status(503).json({
          message:
            'Gmail sending is not yet configured. Please add your real Gmail address and 16-character Google App Password to backend/.env so the code can be delivered to your Gmail app.',
        });
      }

      await sendAdminVerificationCode(
        { id: requestId, email: normalizedEmail, full_name: finalFullName },
        mailTransport
      );

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

    const mailTransport = createMailTransport();
    if (!mailTransport) {
      return res.status(503).json({
        message:
          'Gmail sending is not yet configured. Please add your real Gmail address and 16-character Google App Password to backend/.env so the code can be delivered to your Gmail app.',
      });
    }

    await sendAdminVerificationCode(request, mailTransport);

    return res.json({
      message: `A new 6-digit verification code has been dispatched to your Gmail (${request.email}). Please check your Gmail app.`,
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
  const mailTransport = createMailTransport();
  if (!mailTransport) {
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
    await mailTransport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
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

// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Institutional email is required.' });
  }

  // Always respond generically to avoid leaking which emails exist.
  res.json({
    message: 'If an account matches that institutional email, a secure reset link has been sent.',
  });
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

      const photoUrl = `/uploads/admins/${req.file.filename}`;
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
      `SELECT id, first_name, middle_name, last_name, full_name, sex, contact_no, email, department, employee_id, id_document_url, selfie_id_url, requested_at
       FROM access_requests WHERE status = 'pending' AND (email_verified = true OR email_verified IS NULL) ORDER BY requested_at ASC`
    );
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
        requestedAt: r.requested_at,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error loading requests.' });
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
