import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { register, checkEmailAvailability, verifyRegistrationEmail, resendRegistrationCode, Session } from '../api.js';
import ModernIcon from '../components/ModernIcons.jsx';

export default function Register() {
  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '', dateOfBirth: '', sex: '',
    contactNumber: '', purok: '', email: '', password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [emailStatus, setEmailStatus] = useState({ checking: false, available: null, valid: null, message: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationResult, setRegistrationResult] = useState(null);
  const [idFile, setIdFile] = useState(null);
  const [idPhotoPreview, setIdPhotoPreview] = useState('');
  const [idFileError, setIdFileError] = useState('');

  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePhotoPreview, setSelfiePhotoPreview] = useState('');
  const [selfieFileError, setSelfieFileError] = useState('');
  const [aiValidatingStep, setAiValidatingStep] = useState('');

  // 6-digit email verification state
  const [step, setStep] = useState('form'); // 'form' | 'verify' | 'completed'
  const [verifyEmail, setVerifyEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  function handleIdFile(file) {
    setIdFileError('');
    if (!file) {
      setIdFile(null);
      setIdPhotoPreview('');
      return;
    }
    const okType = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!okType) { setIdFileError('Only image or PDF files are allowed.'); return; }
    if (file.size > 5 * 1024 * 1024) { setIdFileError('File is too large — max size is 5MB.'); return; }

    const screenshotPatterns = [/screenshot/i, /screen_shot/i, /screen-shot/i, /screen_capture/i, /screencap/i, /capture_\d+/i, /snip(?:ping)?/i, /prntscr/i, /printscreen/i];
    if (screenshotPatterns.some(p => p.test(file.name || ''))) {
      setIdFile(null);
      setIdPhotoPreview('');
      setIdFileError('Screenshots are not accepted. Please upload an original, clear photograph of your physical government-issued valid ID card (e.g. PhilSys, Driver\'s License, Passport, UMID, Voter\'s ID, or Barangay ID).');
      return;
    }

    setIdFile(file);
    if (file.type.startsWith('image/')) {
      setIdPhotoPreview(URL.createObjectURL(file));
    } else {
      setIdPhotoPreview('');
    }
  }

  function handleRemoveIdFile() {
    setIdFile(null);
    setIdPhotoPreview('');
    setIdFileError('');
  }

  function handleSelfieFile(file) {
    setSelfieFileError('');
    if (!file) {
      setSelfieFile(null);
      setSelfiePhotoPreview('');
      return;
    }
    const okType = file.type.startsWith('image/');
    if (!okType) { setSelfieFileError('Please select a valid image file (JPG, PNG, or WebP).'); return; }
    if (file.size > 5 * 1024 * 1024) { setSelfieFileError('Image file size must be less than 5MB.'); return; }

    const screenshotPatterns = [/screenshot/i, /screen_shot/i, /screen-shot/i, /screen_capture/i, /screencap/i, /capture_\d+/i, /snip(?:ping)?/i, /prntscr/i, /printscreen/i];
    if (screenshotPatterns.some(p => p.test(file.name || ''))) {
      setSelfieFile(null);
      setSelfiePhotoPreview('');
      setSelfieFileError('Screenshots are not accepted. Please take and upload an original live photo or camera selfie of yourself holding your physical ID card to verify your identity.');
      return;
    }

    setSelfieFile(file);
    setSelfiePhotoPreview(URL.createObjectURL(file));
  }

  function handleRemoveSelfieFile() {
    setSelfieFile(null);
    setSelfiePhotoPreview('');
    setSelfieFileError('');
  }

  function update(field, value) {
    if (field === 'contactNumber') {
      const clean = value.replace(/\D/g, '').slice(0, 10);
      setForm(f => ({ ...f, [field]: clean }));
      return;
    }
    if (field === 'email') {
      const lower = String(value || '').toLowerCase();
      if (lower.includes('elena') || lower.includes('ytytyt')) {
        setForm(f => ({ ...f, [field]: '' }));
        return;
      }
    }
    setForm(f => ({ ...f, [field]: value }));
  }

  // Prevent browser autofill from inserting Elena's credentials
  useEffect(() => {
    const scrub = () => {
      setForm((prev) => {
        const emailLower = (prev.email || '').toLowerCase();
        const passLower = (prev.password || '').toLowerCase();
        if (
          emailLower.includes('elena') ||
          emailLower.includes('ytytyt') ||
          passLower.includes('elena') ||
          passLower === 'password123'
        ) {
          return {
            ...prev,
            email: emailLower.includes('elena') || emailLower.includes('ytytyt') ? '' : prev.email,
            password: passLower.includes('elena') || passLower === 'password123' ? '' : prev.password,
          };
        }
        return prev;
      });

      const emailInput = document.querySelector('input[name="resident_reg_email"]');
      if (
        emailInput &&
        emailInput.value &&
        (emailInput.value.toLowerCase().includes('elena') || emailInput.value.toLowerCase().includes('ytytyt'))
      ) {
        emailInput.value = '';
      }

      const passInput = document.querySelector('input[name="resident_reg_password"]');
      if (
        passInput &&
        (passInput.value === 'password123' || passInput.value.toLowerCase().includes('elena'))
      ) {
        passInput.value = '';
      }
    };

    scrub();
    const timers = [50, 150, 300, 600, 1000, 1500].map((t) => setTimeout(scrub, t));
    return () => timers.forEach(clearTimeout);
  }, []);

  // Real-time email validation and availability verification
  useEffect(() => {
    const rawEmail = form.email.trim();
    if (!rawEmail) {
      setEmailStatus({ checking: false, available: null, valid: null, message: '' });
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(rawEmail)) {
      setEmailStatus({
        checking: false,
        available: false,
        valid: false,
        message: 'Invalid email format (e.g., resident@example.com).',
      });
      return;
    }

    setEmailStatus(prev => ({ ...prev, checking: true }));
    const timer = setTimeout(async () => {
      try {
        const res = await checkEmailAvailability(rawEmail);
        setEmailStatus({
          checking: false,
          available: Boolean(res.available),
          valid: Boolean(res.valid),
          message: res.message || '',
        });
      } catch (err) {
        setEmailStatus({
          checking: false,
          available: false,
          valid: false,
          message: err.message || 'Unable to verify email availability.',
        });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [form.email]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.purok) { setError('Please select your Purok / Zone.'); return; }
    const emailValue = form.email.trim();
    if (!emailValue) { setError('Email is required — it doubles as your login and login recovery address.'); return; }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailValue)) {
      setError('Please enter a valid email address (e.g., resident@example.com).');
      return;
    }

    // Do not register if email is invalid or already taken / unavailable
    try {
      const check = await checkEmailAvailability(emailValue);
      if (!check.valid) {
        setError(check.message || 'The email address is invalid.');
        return;
      }
      if (!check.available) {
        setError(check.message || 'This email is already in use or unavailable. Please use another email.');
        return;
      }
    } catch (checkErr) {
      setError(checkErr.message || 'Failed to verify email availability.');
      return;
    }

    if (!/^\+?\d{10,13}$/.test('+63' + form.contactNumber.trim())) {
      setError('Contact number must start with +63 and contain 10 digits after the country code.');
      return;
    }
    if (!idFile) { setError('Please upload your valid ID card or document.'); return; }
    if (!selfieFile) { setError('Please upload a selfie holding your ID to confirm your identity.'); return; }

    setLoading(true);
    setAiValidatingStep('Step 1 of 2: AI Document Authenticity & Readability Scan…');
    try {
      const body = {
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth,
        sex: form.sex,
        contactNumber: '+63 ' + form.contactNumber.trim(),
        purok: form.purok,
        email: form.email.trim(),
        password: form.password,
        idDocument: idFile,
        selfieWithId: selfieFile,
      };

      const stepTimer = setTimeout(() => {
        setAiValidatingStep('Step 2 of 2: AI Facial Biometrics & Cross-Verification…');
      }, 1500);

      const data = await register(body);
      clearTimeout(stepTimer);

      if (data.requiresVerification) {
        setVerifyEmail(data.email || form.email.trim().toLowerCase());
        setOtp(['', '', '', '', '', '']);
        setCooldown(60);
        setOtpError('');
        setOtpMessage(data.message || `A 6-digit verification code was sent to ${form.email.trim()}`);
        setStep('verify');
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 150);
      } else {
        if (data.token && data.user) {
          Session.setToken(data.token);
          Session.setUser(data.user);
        }
        setRegistrationResult(data);
        setStep('completed');
      }
    } catch (err) {
      setError(err.message);
      if (err.rejectedField === 'idDocument') {
        setIdFile(null);
        setIdPhotoPreview('');
        setIdFileError(err.message);
      } else if (err.rejectedField === 'selfieWithId') {
        setSelfieFile(null);
        setSelfiePhotoPreview('');
        setSelfieFileError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index, value) {
    const cleaned = value.replace(/\D/g, '');

    // Pasted full code or multiple digits
    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, 6).split('');
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = chars[i] || '';
      }
      setOtp(newOtp);
      const nextIdx = Math.min(chars.length, 5);
      inputRefs.current[nextIdx]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = cleaned;
    setOtp(newOtp);

    // Auto advance to next box
    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || '';
    }
    setOtp(newOtp);
    const nextIdx = Math.min(pasted.length, 5);
    inputRefs.current[nextIdx]?.focus();
  }

  async function handleVerifyOtp(e) {
    if (e) e.preventDefault();
    setOtpError('');
    setOtpMessage('');

    const fullCode = otp.join('');
    if (fullCode.length !== 6) {
      setOtpError('Please enter all 6 digits of your verification code.');
      return;
    }

    setOtpLoading(true);
    try {
      const data = await verifyRegistrationEmail(verifyEmail, fullCode);
      if (data.token && data.user) {
        Session.setToken(data.token);
        Session.setUser(data.user);
      }
      setRegistrationResult(data);
      setStep('completed');
    } catch (err) {
      setOtpError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResendCode() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setOtpError('');
    setOtpMessage('');
    try {
      const res = await resendRegistrationCode(verifyEmail);
      setCooldown(60);
      setOtpMessage(res.message || 'A new verification code has been sent to your email.');
    } catch (err) {
      setOtpError(err.message || 'Unable to resend verification code. Please try again later.');
    } finally {
      setResending(false);
    }
  }

  if (step === 'verify') {
    return (
      <div className="auth-scene auth-register-page">
        <div className="form-wrap">
          <div className="card auth-register-panel" style={{ padding: 36, textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
            <img src="/barangay-seal.png" alt="Barangay Poblacion seal" className="auth-logo" style={{ margin: '0 auto 12px' }} />

            <div style={{
              width: 54,
              height: 54,
              background: '#eff6ff',
              color: '#2563eb',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              boxShadow: '0 2px 8px rgba(37,99,235,0.15)'
            }}>
              <ModernIcon name="mail" size={26} color="#2563eb" />
            </div>

            <div style={{
              display: 'inline-block',
              background: '#dbeafe',
              color: '#1d4ed8',
              border: '1px solid #93c5fd',
              padding: '4px 14px',
              borderRadius: 9999,
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              marginBottom: 12
            }}>
              Step 2: Email Verification
            </div>

            <h2 style={{ color: 'var(--navy)', margin: '0 0 8px', fontSize: '1.45rem', fontWeight: 800 }}>
              Verify Your Email Address
            </h2>
            <p style={{ color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.55, fontSize: '0.9rem' }}>
              We've sent a 6-digit confirmation code to{' '}
              <strong style={{ color: '#0f172a' }}>{verifyEmail}</strong>.
              Enter it below to complete your registration.
            </p>

            {otpError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: '0.85rem',
                marginBottom: 16,
                textAlign: 'left'
              }}>
                {otpError}
              </div>
            )}

            {otpMessage && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: '0.85rem',
                marginBottom: 16,
                textAlign: 'left'
              }}>
                {otpMessage}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} style={{ marginBottom: 20 }}>
              <label style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#64748b',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 12
              }}>
                6-Digit Verification Code
              </label>

              <div
                style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}
                onPaste={handleOtpPaste}
              >
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    style={{
                      width: 44,
                      height: 52,
                      textAlign: 'center',
                      fontSize: '1.5rem',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      border: '2px solid #cbd5e1',
                      borderRadius: 8,
                      outline: 'none',
                      background: '#ffffff',
                      color: '#0f172a',
                      transition: 'border-color 0.2s, box-shadow 0.2s'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--navy, #1e3a8a)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(30, 58, 138, 0.15)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#cbd5e1';
                      e.target.style.boxShadow = 'none';
                    }}
                    required={idx === 0}
                  />
                ))}
              </div>

              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 20px' }}>
                Code expires in 10 minutes. Check your spam/junk folder if needed.
              </p>

              <button
                type="submit"
                disabled={otpLoading || otp.join('').length !== 6}
                className="btn btn-navy btn-block"
                style={{
                  padding: '12px 20px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  opacity: otpLoading || otp.join('').length !== 6 ? 0.6 : 1,
                  cursor: otpLoading || otp.join('').length !== 6 ? 'not-allowed' : 'pointer'
                }}
              >
                {otpLoading ? 'Verifying Code…' : 'Verify Email & Complete Registration →'}
              </button>
            </form>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              paddingTop: 16,
              borderTop: '1px solid #f1f5f9',
              fontSize: '0.85rem',
              color: '#64748b'
            }}>
              <div>
                Didn't receive the email?{' '}
                {cooldown > 0 ? (
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Resend in {cooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resending}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontWeight: 700,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {resending ? 'Sending code…' : 'Resend Code'}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setStep('form')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '0.82rem'
                }}
              >
                ← Back to registration form
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (registrationResult) {
    const isVerified = registrationResult.verified;
    const user = registrationResult.user;

    return (
      <div className="auth-scene auth-register-page">
        <div className="form-wrap">
          <div className="card auth-register-panel" style={{ padding: 36, textAlign: 'center' }}>
            <img src="/barangay-seal.png" alt="Barangay Poblacion seal" className="auth-logo" style={{ margin: '0 auto 12px' }} />

            {isVerified ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                  <ModernIcon name="check-circle" size={48} color="#16a34a" />
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #86efac',
                  padding: '4px 14px',
                  borderRadius: 9999,
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: 14
                }}>
                  <ModernIcon name="check" size={14} color="#15803d" /> Account Verified &amp; Approved
                </div>
                <h2 style={{ color: 'var(--navy)', margin: '0 0 10px', fontSize: '1.5rem', fontWeight: 800 }}>
                  Account Verified &amp; Approved!
                </h2>
                <p style={{ color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.6, fontSize: '0.92rem' }}>
                  A matching resident record was verified in the official <strong>Barangay Resident Database</strong>. Your account has been automatically approved for full portal access.
                </p>

                {user && (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '16px 20px',
                    textAlign: 'left',
                    marginBottom: 24,
                    fontSize: '0.88rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: '#64748b' }}>Resident Name:</span>
                      <strong style={{ color: '#0f172a' }}>{user.fullName}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: '#64748b' }}>Resident ID:</span>
                      <strong style={{ color: '#0f172a' }}>{user.id}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: '#64748b' }}>Purok / Zone:</span>
                      <strong style={{ color: '#0f172a' }}>{user.purok || '—'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Access Level:</span>
                      <strong style={{ color: '#16a34a' }}>● Full Resident Access</strong>
                    </div>
                  </div>
                )}

                <Link to="/dashboard">
                  <button className="btn btn-navy btn-block" style={{ padding: '12px 20px', fontSize: '0.95rem', fontWeight: 700 }}>
                    Enter Resident Portal →
                  </button>
                </Link>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                  <ModernIcon name="clock" size={48} color="#d97706" />
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#fef3c7',
                  color: '#92400e',
                  border: '1px solid #fcd34d',
                  padding: '4px 14px',
                  borderRadius: 9999,
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginBottom: 14
                }}>
                  <ModernIcon name="clock" size={14} color="#92400e" /> Account Pending Verification
                </div>
                <h2 style={{ color: 'var(--navy)', margin: '0 0 10px', fontSize: '1.5rem', fontWeight: 800 }}>
                  Registration Received
                </h2>
                <p style={{ color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.6, fontSize: '0.92rem' }}>
                  Your details could not yet be automatically matched against the pre-existing Barangay Resident Database.
                </p>

                <div style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 10,
                  padding: '14px 18px',
                  textAlign: 'left',
                  marginBottom: 20,
                  fontSize: '0.85rem',
                  color: '#92400e',
                  lineHeight: 1.5
                }}>
                  <strong>Limited Access Active:</strong> You can access the system and submit complaints, incident reports, and blotter filings immediately. Full resident services will become active once barangay staff confirms your resident records.
                </div>

                {user && (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '14px 18px',
                    textAlign: 'left',
                    marginBottom: 22,
                    fontSize: '0.86rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#64748b' }}>Account Name:</span>
                      <strong style={{ color: '#0f172a' }}>{user.fullName}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ color: '#64748b' }}>Status:</span>
                      <strong style={{ color: '#d97706' }}>Pending Verification</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Permitted Action:</span>
                      <strong style={{ color: '#0f172a' }}>Submit Complaints / Reports</strong>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Link to="/file-complaint">
                    <button className="btn btn-navy btn-block" style={{ padding: '12px 20px', fontSize: '0.95rem', fontWeight: 700 }}>
                      Submit a Complaint / Report →
                    </button>
                  </Link>
                  <Link to="/dashboard">
                    <button className="btn btn-outline btn-block" style={{ padding: '10px 16px' }}>
                      Go to Dashboard
                    </button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-scene auth-register-page">
      <div className="form-wrap">
        <div className="card auth-register-panel" style={{ padding: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <img src="/barangay-seal.png" alt="Barangay Poblacion seal" style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0 }} />
            <div>
              <h2 style={{ color: 'var(--navy)', margin: '0 0 2px', fontSize: '1.4rem' }}>Personal Information</h2>
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.04em' }}>BARANGAY POBLACION • RESIDENT ENROLLMENT</span>
            </div>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '.9rem', margin: '0 0 24px' }}>
            Please provide your official details as they appear on your government-issued identification cards.
          </p>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field-row">
              <div className="field">
                <label className="field-label">First Name</label>
                <input value={form.firstName} onChange={e => update('firstName', e.target.value)} placeholder="e.g. Alexander" required />
              </div>
              <div className="field">
                <label className="field-label">Middle Name</label>
                <input value={form.middleName} onChange={e => update('middleName', e.target.value)} placeholder="e.g. Sterling" />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">Last Name</label>
                <input value={form.lastName} onChange={e => update('lastName', e.target.value)} placeholder="e.g. Montgomery" required />
              </div>
              <div className="field">
                <label className="field-label">Date of Birth</label>
                <input type="date" value={form.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">Sex</label>
                <select value={form.sex} onChange={e => update('sex', e.target.value)}>
                  <option value="">Select option</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label">Contact Number</label>
                <div className="phone-row">
                  <input value="+63" disabled />
                  <input
                    value={form.contactNumber}
                    onChange={e => update('contactNumber', e.target.value)}
                    placeholder="917 123 4567"
                    maxLength={10}
                    inputMode="numeric"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="field">
              <label className="field-label">Purok / Zone</label>
              <select value={form.purok} onChange={e => update('purok', e.target.value)} required>
                <option value="">Select location</option>
                <option value="Camolinas Centro">Camolinas Centro</option>
                <option value="Atabay">Atabay</option>
                <option value="Calan">Calan</option>
                <option value="Housing">Housing</option>
                <option value="Puso">Puso</option>
                <option value="Intra">Intra</option>
                <option value="Crossroad">Crossroad</option>
              </select>
            </div>

            <div className="field">
              <label className="field-label">Email (used to sign in)</label>
              <input
                type="email"
                name="resident_reg_email"
                autoComplete="new-password"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="you@example.com"
                required
                style={{
                  borderColor:
                    emailStatus.valid === false || emailStatus.available === false
                      ? '#ef4444'
                      : emailStatus.available === true
                      ? '#10b981'
                      : undefined,
                }}
              />
              {emailStatus.checking && (
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                  Checking email availability…
                </div>
              )}
              {!emailStatus.checking && emailStatus.message && (
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: emailStatus.available && emailStatus.valid ? '#10b981' : '#ef4444',
                    marginTop: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {emailStatus.available && emailStatus.valid ? (
                      <ModernIcon name="check" size={14} color="#15803d" />
                    ) : (
                      <ModernIcon name="warning" size={14} color="#b45309" />
                    )}
                  </span>
                  <span>{emailStatus.message}</span>
                </div>
              )}
            </div>
            <div className="field">
              <label className="field-label">Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="resident_reg_password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  placeholder="Create a password"
                  required
                  minLength={6}
                  style={{ width: '100%', paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="show-password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 6,
                  }}
                >
                  <ModernIcon name={showPassword ? 'eye' : 'eye-off'} size={18} />
                </button>
              </div>
            </div>

            {/* Field 1: Valid Government ID */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 6px' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
                1. Valid ID Card or Document <span style={{ color: '#dc2626' }}>*</span>
              </div>
              <span style={{ fontSize: '.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ModernIcon name="sparkles" size={14} color="#2563eb" /> AI Verified
              </span>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '.92rem', color: '#475569', lineHeight: 1.5 }}>
              Clear front photo of your valid Government ID (PhilSys ID, Driver's License, Passport, Voter's ID, PRC, or Barangay ID).
            </p>
            {idFile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                {idPhotoPreview ? (
                  <img
                    src={idPhotoPreview}
                    alt="ID Preview"
                    style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: 8, background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fecaca', flexShrink: 0 }}>
                    <ModernIcon name="document" size={28} color="#dc2626" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {idFile.name}
                  </div>
                  <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: 2 }}>
                    {(idFile.size / (1024 * 1024)).toFixed(2)} MB • ID Document Attached
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 14 }}>
                    <label style={{ fontSize: '.82rem', color: '#2563eb', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                      Change Photo
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        style={{ display: 'none' }}
                        onChange={e => handleIdFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveIdFile}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '.82rem', color: '#dc2626', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label className="upload-box" htmlFor="idDocumentInput" style={{ cursor: 'pointer', display: 'block' }}>
                <div className="icon">
                  <ModernIcon name="id-card" size={24} color="#2563eb" />
                </div>
                <strong>Click to upload your valid ID card</strong>
                <small>JPG or PNG up to 5MB • Must be a clear photo of an authentic physical government ID (Screenshots & non-ID pictures are rejected)</small>
                <input
                  id="idDocumentInput"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => handleIdFile(e.target.files?.[0] || null)}
                />
              </label>
            )}
            {idFileError && (
              <div style={{ marginTop: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: '.84rem', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ flexShrink: 0, marginTop: 2 }}>
                  <ModernIcon name="warning" size={18} color="#dc2626" />
                </span>
                <div>
                  <strong style={{ display: 'block', color: '#7f1d1d' }}>Step 1: ID Document Verification Failed</strong>
                  <span>{idFileError}</span>
                  <div style={{ marginTop: 4, fontSize: '.78rem', color: '#b91c1c' }}>
                    Tip: Please choose another clear photo or valid document to re-upload. Your other form entries have been preserved.
                  </div>
                </div>
              </div>
            )}

            {/* Field 2: Selfie Holding Your ID */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 6px' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
                2. Live Photo Holding Your Valid ID <span style={{ color: '#dc2626' }}>*</span>
              </div>
              <span style={{ fontSize: '.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ModernIcon name="sparkles" size={14} color="#7c3aed" /> AI Biometrics
              </span>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '.92rem', color: '#475569', lineHeight: 1.5 }}>
              Take an original photo of yourself holding your physical ID next to your face. Your face must match the portrait on your valid ID. <strong>Screenshots are strictly prohibited.</strong>
            </p>
            {selfieFile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                {selfiePhotoPreview ? (
                  <img
                    src={selfiePhotoPreview}
                    alt="Selfie with ID Preview"
                    style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: 8, background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #bae6fd', flexShrink: 0 }}>
                    <ModernIcon name="selfie" size={28} color="#0284c7" />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selfieFile.name}
                  </div>
                  <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: 2 }}>
                    {(selfieFile.size / (1024 * 1024)).toFixed(2)} MB • Selfie Attached
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 14 }}>
                    <label style={{ fontSize: '.82rem', color: '#2563eb', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                      Change Photo
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => handleSelfieFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveSelfieFile}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '.82rem', color: '#dc2626', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label className="upload-box" htmlFor="selfieWithIdInput" style={{ cursor: 'pointer', display: 'block' }}>
                <div className="icon">
                  <ModernIcon name="selfie" size={24} color="#2563eb" />
                </div>
                <strong>Click to upload photo holding your ID</strong>
                <small>JPG, PNG, or WebP up to 5MB • Direct camera selfie (Screenshots rejected • Face must match ID)</small>
                <input
                  id="selfieWithIdInput"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => handleSelfieFile(e.target.files?.[0] || null)}
                />
              </label>
            )}
            {selfieFileError && (
              <div style={{ marginTop: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: '.84rem', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ flexShrink: 0, marginTop: 2 }}>
                  <ModernIcon name="warning" size={18} color="#dc2626" />
                </span>
                <div>
                  <strong style={{ display: 'block', color: '#7f1d1d' }}>Step 2: Selfie Holding ID Verification Failed</strong>
                  <span>{selfieFileError}</span>
                  <div style={{ marginTop: 4, fontSize: '.78rem', color: '#b91c1c' }}>
                    Tip: Hold the exact same approved ID card next to your face in a well-lit space and take a steady, clear selfie.
                  </div>
                </div>
              </div>
            )}

            <div className="card" style={{ background: '#eaf3fd', borderColor: '#cfe4f9', margin: '22px 0 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--navy)', fontWeight: 700 }}>
                <ModernIcon name="shield" size={18} color="var(--navy)" />
                <strong>Secured Transmission</strong>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '.85rem', color: 'var(--muted)' }}>
                Your data is encrypted using AES-256 standards. Only authorized civil personnel can access this information for verification purposes.
              </p>
            </div>

            {loading && (
              <div style={{ marginBottom: 14, padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, color: '#1e40af', fontSize: '.88rem' }}>
                <span className="spinner-border spinner-border-sm" style={{ width: 18, height: 18, borderWidth: 2, display: 'inline-block', border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <div>
                  <strong>AI Identity Verification in Progress:</strong>
                  <div style={{ fontSize: '.8rem', color: '#1d4ed8', marginTop: 2 }}>
                    {aiValidatingStep || 'Verifying ID document authenticity, readability, and facial biometrics…'}
                  </div>
                </div>
              </div>
            )}

            <button type="submit" className="btn btn-navy btn-block" disabled={loading}>
              {loading ? (aiValidatingStep ? 'AI Validating Documents…' : 'Submitting…') : 'SUBMIT & VERIFY WITH AI →'}
            </button>
            <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--muted)', fontSize: '.9rem' }}>
              Already registered? <Link to="/" className="link-blue">Sign In</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
