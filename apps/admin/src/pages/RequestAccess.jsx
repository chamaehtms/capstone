import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import AdminIcon from '../components/AdminIcons.jsx';

export default function RequestAccess() {
  const [step, setStep] = useState('form'); // 'form' | 'verify' | 'completed'

  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    sex: '',
    contactNo: '',
    email: '',
    department: 'Internal Oversight',
    employeeId: '',
    password: '',
  });
  const [idPhoto, setIdPhoto] = useState(null);
  const [idPhotoPreview, setIdPhotoPreview] = useState('');
  const [idPhotoError, setIdPhotoError] = useState('');
  const [selfiePhoto, setSelfiePhoto] = useState(null);
  const [selfiePhotoPreview, setSelfiePhotoPreview] = useState('');
  const [selfiePhotoError, setSelfiePhotoError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP Verification state
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationRequestId, setVerificationRequestId] = useState('');
  const [devCode, setDevCode] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);

  const inputRefs = useRef([]);

  // Cooldown timer for resending OTP code
  useEffect(() => {
    if (step !== 'verify' || cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, cooldown]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    setIdPhotoError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setIdPhotoError('Please select a valid image file (JPG, PNG, or WebP) for your ID.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setIdPhotoError('ID image file size must be less than 5MB.');
      return;
    }

    const screenshotPatterns = [/screenshot/i, /screen_shot/i, /screen-shot/i, /screen_capture/i, /screencap/i, /capture_\d+/i, /snip(?:ping)?/i, /prntscr/i, /printscreen/i];
    if (screenshotPatterns.some(p => p.test(file.name || ''))) {
      setIdPhoto(null);
      setIdPhotoPreview('');
      setIdPhotoError('Screenshots are not accepted. Please upload an original physical photograph of your valid government ID.');
      return;
    }

    setError('');
    setIdPhoto(file);
    setIdPhotoPreview(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setIdPhoto(null);
    setIdPhotoPreview('');
    setIdPhotoError('');
  };

  const handleSelfieSelect = (e) => {
    const file = e.target.files?.[0];
    setSelfiePhotoError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSelfiePhotoError('Please select a valid image file (JPG, PNG, or WebP) for your selfie holding ID.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSelfiePhotoError('Selfie image file size must be less than 5MB.');
      return;
    }

    const screenshotPatterns = [/screenshot/i, /screen_shot/i, /screen-shot/i, /screen_capture/i, /screencap/i, /capture_\d+/i, /snip(?:ping)?/i, /prntscr/i, /printscreen/i];
    if (screenshotPatterns.some(p => p.test(file.name || ''))) {
      setSelfiePhoto(null);
      setSelfiePhotoPreview('');
      setSelfiePhotoError('Screenshots are not accepted. Please take and upload an original live photo of yourself holding your physical ID.');
      return;
    }

    setError('');
    setSelfiePhoto(file);
    setSelfiePhotoPreview(URL.createObjectURL(file));
  };

  const handleRemoveSelfie = () => {
    setSelfiePhoto(null);
    setSelfiePhotoPreview('');
    setSelfiePhotoError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!form.firstName.trim()) {
      setError('First name is required.');
      return;
    }
    if (!form.lastName.trim()) {
      setError('Last name is required.');
      return;
    }
    if (!form.sex) {
      setError('Please select your sex.');
      return;
    }
    if (!form.contactNo.trim()) {
      setError('Contact number is required.');
      return;
    }
    if (!idPhoto) {
      setError('Please upload your valid government or institutional ID photo.');
      return;
    }
    if (!selfiePhoto) {
      setError('Please upload a selfie holding your ID to confirm your identity.');
      return;
    }
    const pwd = form.password || '';
    if (pwd.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(pwd)) {
      setError('Password must include at least one uppercase letter (A-Z).');
      return;
    }
    if (!/[a-z]/.test(pwd)) {
      setError('Password must include at least one lowercase letter (a-z).');
      return;
    }
    if (!/[0-9]/.test(pwd)) {
      setError('Password must include at least one number (0-9).');
      return;
    }
    if (!agreed) {
      setError('You must agree to the Security Protocols before submitting.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('firstName', form.firstName.trim());
      formData.append('middleName', form.middleName.trim());
      formData.append('lastName', form.lastName.trim());
      formData.append('sex', form.sex);
      formData.append('contactNo', form.contactNo.trim());
      formData.append('email', form.email.trim());
      formData.append('department', form.department);
      formData.append('employeeId', form.employeeId.trim());
      formData.append('password', form.password);
      formData.append('idPhoto', idPhoto);
      formData.append('selfiePhoto', selfiePhoto);

      const { data } = await api.post('/auth/request-access', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (data.verificationRequired) {
        setVerificationEmail(form.email.trim().toLowerCase());
        setVerificationRequestId(data.requestId || '');
        if (data.devCode) {
          setDevCode(data.devCode);
        }
        setOtp(['', '', '', '', '', '']);
        setCooldown(60);
        setOtpError('');
        setOtpMessage(data.message || `A verification code was sent to ${form.email.trim()}`);
        setStep('verify');
        // Auto focus first OTP input box shortly after render
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 150);
      } else {
        setMessage(data.message);
        setStep('completed');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Unable to submit request.';
      const rejectedField = err.response?.data?.rejectedField;
      setError(errMsg);
      if (rejectedField === 'idPhoto' || rejectedField === 'idDocument') {
        setIdPhoto(null);
        setIdPhotoPreview('');
        setIdPhotoError(errMsg);
      } else if (rejectedField === 'selfiePhoto' || rejectedField === 'selfieWithId') {
        setSelfiePhoto(null);
        setSelfiePhotoPreview('');
        setSelfiePhotoError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const cleaned = value.replace(/\D/g, '');

    // Pasted full 6-digit code or multiple digits
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

    // Auto advance
    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
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
  };

  const handleVerifyOtp = async (e) => {
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
      const { data } = await api.post('/auth/verify-code', {
        requestId: verificationRequestId,
        email: verificationEmail,
        code: fullCode,
      });

      setMessage(data.message || 'Email verified successfully!');
      setStep('completed');
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Verification failed. Please check the code.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setOtpError('');
    setOtpMessage('');

    try {
      const { data } = await api.post('/auth/resend-code', {
        requestId: verificationRequestId,
        email: verificationEmail,
      });
      setOtpMessage(data.message || 'A new verification code has been sent to your email.');
      if (data.devCode) {
        setDevCode(data.devCode);
      }
      setCooldown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Unable to resend verification code.');
    } finally {
      setResending(false);
    }
  };

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
              <AdminIcon name="mail" size={26} color="#2563eb" />
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
              <strong style={{ color: '#0f172a' }}>{verificationEmail}</strong>.
              Enter it below to confirm your request.
            </p>

            {otpError && <div className="error-msg">{otpError}</div>}
            {otpMessage && <div className="success-msg">{otpMessage}</div>}

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
                Code expires in 15 minutes. Check your spam/junk folder if needed.
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
                {otpLoading ? 'Verifying Code…' : 'Verify Email & Submit for Approval →'}
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
                ← Back to request form
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'completed') {
    return (
      <div className="auth-scene auth-register-page">
        <div className="form-wrap">
          <div className="card auth-register-panel" style={{ padding: 36, textAlign: 'center', maxWidth: 540, margin: '0 auto' }}>
            <img src="/barangay-seal.png" alt="Barangay Poblacion seal" className="auth-logo" style={{ margin: '0 auto 12px' }} />

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <AdminIcon name="clock" size={48} color="#d97706" />
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
              <AdminIcon name="clock" size={14} color="#92400e" /> Waiting for Approval
            </div>

            <h2 style={{ color: 'var(--navy)', margin: '0 0 10px', fontSize: '1.5rem', fontWeight: 800 }}>
              Request Submitted
            </h2>
            <p style={{ color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.6, fontSize: '0.92rem' }}>
              Your email (<strong style={{ color: '#0f172a' }}>{verificationEmail || form.email}</strong>) has been verified. Your registration is now pending review by the Barangay Poblacion administration.
            </p>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '16px 20px',
              textAlign: 'left',
              marginBottom: 20,
              fontSize: '0.86rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#64748b' }}>Applicant:</span>
                <strong style={{ color: '#0f172a' }}>
                  {[form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ') || 'Administrator'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#64748b' }}>Employee ID:</span>
                <strong style={{ color: '#0f172a' }}>{form.employeeId || 'CL-8848-00X'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#64748b' }}>Department:</span>
                <strong style={{ color: '#0f172a' }}>{form.department}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#64748b' }}>Email Verification:</span>
                <strong style={{ color: '#16a34a' }}>✓ Verified</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b' }}>Status:</span>
                <strong style={{ color: '#d97706' }}>● Waiting for Approval</strong>
              </div>
            </div>

            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1e40af',
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: '0.82rem',
              textAlign: 'left',
              marginBottom: 24,
              lineHeight: 1.5
            }}>
              Your application details and ID credentials have been forwarded to the <strong>Pending Requests</strong> queue. You will be able to sign in once an active Administrator approves your account.
            </div>

            <Link to="/login">
              <button className="btn btn-navy btn-block" style={{ padding: '12px 20px', fontSize: '0.95rem', fontWeight: 700 }}>
                Return to Sign In →
              </button>
            </Link>
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
              <h2 style={{ color: 'var(--navy)', margin: '0 0 2px', fontSize: '1.4rem', fontWeight: 800 }}>Administrative Access</h2>
              <span style={{ color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.04em' }}>BARANGAY POBLACION • SYSTEM CREDENTIALS REQUEST</span>
            </div>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '.9rem', margin: '0 0 24px', lineHeight: 1.6 }}>
            Please provide your official institutional credentials as verified by the Civil Oversight and Administrative Board.
          </p>

          {error && <div className="error-msg">{error}</div>}
          {message && <div className="success-msg">{message}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field-row-3">
              <div className="field">
                <label className="field-label">First Name *</label>
                <input
                  value={form.firstName}
                  onChange={update('firstName')}
                  placeholder="e.g. Maria"
                  required
                />
              </div>
              <div className="field">
                <label className="field-label">Middle Name</label>
                <input
                  value={form.middleName}
                  onChange={update('middleName')}
                  placeholder="e.g. Cruz (Optional)"
                />
              </div>
              <div className="field">
                <label className="field-label">Last Name *</label>
                <input
                  value={form.lastName}
                  onChange={update('lastName')}
                  placeholder="e.g. Santos"
                  required
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label className="field-label">Sex *</label>
                <select value={form.sex} onChange={update('sex')} required>
                  <option value="">Select Sex</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label">Contact Number *</label>
                <input
                  value={form.contactNo}
                  onChange={update('contactNo')}
                  placeholder="e.g. 0917 123 4567"
                  required
                />
              </div>
            </div>

            {/* Field 1: Valid ID Card Photo */}
            <div style={{ margin: '20px 0 6px' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
                1. Valid Government or Institutional ID *
              </div>
              <p style={{ fontSize: '.84rem', color: '#64748b', margin: '4px 0 12px' }}>
                Clear front-facing photo of your Employee ID or Government-issued valid ID.
              </p>

              {idPhotoPreview ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <img
                    src={idPhotoPreview}
                    alt="ID Preview"
                    style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {idPhoto?.name}
                    </div>
                    <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: 2 }}>
                      {(idPhoto?.size / (1024 * 1024)).toFixed(2)} MB • ID Document Ready
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 14, alignItems: 'center' }}>
                      <label style={{ fontSize: '.82rem', color: '#2563eb', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                        Change Photo
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handlePhotoSelect}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        style={{ background: 'none', border: 'none', padding: 0, fontSize: '.82rem', color: '#dc2626', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="upload-box" htmlFor="adminIdInput">
                  <div className="icon">
                    <AdminIcon name="id-card" size={24} color="#64748b" />
                  </div>
                  <strong>Click to upload your ID card</strong>
                  <small>JPG, PNG, or WebP up to 5MB (Clear physical photo • Screenshots rejected)</small>
                  <input
                    id="adminIdInput"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handlePhotoSelect}
                  />
                </label>
              )}
              {idPhotoError && (
                <div style={{ marginTop: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: '.84rem' }}>
                  <strong>ID Document Error: </strong>{idPhotoError}
                </div>
              )}
            </div>

            {/* Field 2: Selfie Holding ID */}
            <div style={{ margin: '20px 0 6px' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
                2. Selfie Holding Your Valid ID *
              </div>
              <p style={{ fontSize: '.84rem', color: '#64748b', margin: '4px 0 12px' }}>
                Hold your ID card next to your face so your face and ID details are clearly visible.
              </p>

              {selfiePhotoPreview ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <img
                    src={selfiePhotoPreview}
                    alt="Selfie Preview"
                    style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selfiePhoto?.name}
                    </div>
                    <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: 2 }}>
                      {(selfiePhoto?.size / (1024 * 1024)).toFixed(2)} MB • Selfie Attached
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 14, alignItems: 'center' }}>
                      <label style={{ fontSize: '.82rem', color: '#2563eb', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>
                        Change Photo
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleSelfieSelect}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleRemoveSelfie}
                        style={{ background: 'none', border: 'none', padding: 0, fontSize: '.82rem', color: '#dc2626', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="upload-box" htmlFor="adminSelfieInput">
                  <div className="icon">
                    <AdminIcon name="camera" size={24} color="#64748b" />
                  </div>
                  <strong>Click to upload selfie holding your ID</strong>
                  <small>JPG, PNG, or WebP up to 5MB (Clear face + ID card in frame)</small>
                  <input
                    id="adminSelfieInput"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleSelfieSelect}
                  />
                </label>
              )}
              {selfiePhotoError && (
                <div style={{ marginTop: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: '.84rem' }}>
                  <strong>Selfie Error: </strong>{selfiePhotoError}
                </div>
              )}
            </div>

            <div className="field-row" style={{ marginTop: 20 }}>
              <div className="field">
                <label className="field-label">Official / Gmail Address *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={update('email')}
                  placeholder="you@gmail.com"
                  required
                />
              </div>
              <div className="field">
                <label className="field-label">Employee ID *</label>
                <input
                  value={form.employeeId}
                  onChange={update('employeeId')}
                  placeholder="CL-8848-00X"
                  required
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label className="field-label">Department *</label>
                <select value={form.department} onChange={update('department')}>
                  <option>Internal Oversight</option>
                  <option>Urban Infrastructure & Planning</option>
                  <option>Community Health</option>
                  <option>Peace & Order</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label">Password *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={update('password')}
                  placeholder="Create a strong password"
                  required
                  minLength={8}
                />
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: '0.74rem' }}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontWeight: 600,
                    backgroundColor: form.password.length >= 8 ? '#ecfdf5' : '#f1f5f9',
                    color: form.password.length >= 8 ? '#059669' : '#64748b',
                    border: `1px solid ${form.password.length >= 8 ? '#a7f3d0' : '#e2e8f0'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    {form.password.length >= 8 ? '✓' : '•'} At least 8 characters
                  </span>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontWeight: 600,
                    backgroundColor: /[A-Z]/.test(form.password) ? '#ecfdf5' : '#f1f5f9',
                    color: /[A-Z]/.test(form.password) ? '#059669' : '#64748b',
                    border: `1px solid ${/[A-Z]/.test(form.password) ? '#a7f3d0' : '#e2e8f0'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    {/[A-Z]/.test(form.password) ? '✓' : '•'} 1 uppercase (A-Z)
                  </span>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontWeight: 600,
                    backgroundColor: /[a-z]/.test(form.password) ? '#ecfdf5' : '#f1f5f9',
                    color: /[a-z]/.test(form.password) ? '#059669' : '#64748b',
                    border: `1px solid ${/[a-z]/.test(form.password) ? '#a7f3d0' : '#e2e8f0'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    {/[a-z]/.test(form.password) ? '✓' : '•'} 1 lowercase (a-z)
                  </span>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontWeight: 600,
                    backgroundColor: /[0-9]/.test(form.password) ? '#ecfdf5' : '#f1f5f9',
                    color: /[0-9]/.test(form.password) ? '#059669' : '#64748b',
                    border: `1px solid ${/[0-9]/.test(form.password) ? '#a7f3d0' : '#e2e8f0'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    {/[0-9]/.test(form.password) ? '✓' : '•'} 1 number (0-9)
                  </span>
                </div>
              </div>
            </div>

            <div className="checkbox-row" style={{ marginTop: 14 }}>
              <input
                type="checkbox"
                id="agreeProtocols"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ width: 'auto' }}
              />
              <label htmlFor="agreeProtocols">
                I agree to the <span style={{ color: 'var(--blue)', fontWeight: 600 }}>Security Protocols &amp; Institutional Governance</span>
              </label>
            </div>

            <div style={{
              background: '#eaf3fd',
              border: '1px solid #cfe4f9',
              borderRadius: 12,
              padding: '16px 18px',
              margin: '20px 0 24px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12
            }}>
              <span style={{ marginTop: 2 }}>
                <AdminIcon name="shield" size={18} color="var(--navy)" />
              </span>
              <div>
                <strong style={{ color: 'var(--navy)', fontSize: '.9rem' }}>Secured Administrative Protocol</strong>
                <p style={{ margin: '4px 0 0', fontSize: '.84rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                  A 6-digit confirmation code will be dispatched to your email upon submission. All institutional requests are recorded in the encrypted administrative ledger.
                </p>
              </div>
            </div>

            <button type="submit" className="btn btn-navy btn-block" disabled={loading}>
              {loading ? 'Sending Verification Code…' : 'CONTINUE TO EMAIL VERIFICATION →'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--muted)', fontSize: '.9rem' }}>
              Already have an account? <Link to="/login" className="link-blue">Sign In</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
