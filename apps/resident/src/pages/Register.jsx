import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { register, checkEmailAvailability, verifyRegistrationEmail, resendRegistrationCode, Session } from '../api.js';
import ModernIcon from '../components/ModernIcons.jsx';

export default function Register() {
  const [searchParams] = useSearchParams();
  const initialVerifyEmail = searchParams.get('email') || '';
  const initialStep = searchParams.get('step') === 'verify' && initialVerifyEmail ? 'verify' : 'form';

  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '', dateOfBirth: '', sex: '',
    contactNumber: '', purok: '', email: initialVerifyEmail || '', password: ''
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
  const [step, setStep] = useState(initialStep); // 'form' | 'verify' | 'completed'
  const [verifyEmail, setVerifyEmail] = useState(initialVerifyEmail);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpMessage, setOtpMessage] = useState(initialStep === 'verify' ? 'Please enter the 6-digit verification code sent to your email.' : '');
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

  const [isIdCameraActive, setIsIdCameraActive] = useState(false);
  const [idCameraError, setIdCameraError] = useState('');
  const [idCameraFacing, setIdCameraFacing] = useState('environment'); // 'environment' (back) or 'user' (front)
  const idVideoRef = useRef(null);
  const idStreamRef = useRef(null);

  // Stop ID Camera stream
  const stopIdCamera = () => {
    if (idStreamRef.current) {
      idStreamRef.current.getTracks().forEach((track) => track.stop());
      idStreamRef.current = null;
    }
    setIsIdCameraActive(false);
  };

  // Start ID Camera stream
  const startIdCamera = async (facing = idCameraFacing) => {
    stopIdCamera();
    setIdCameraError('');
    setIsIdCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: { ideal: facing },
        },
        audio: false,
      });
      idStreamRef.current = stream;
      if (idVideoRef.current) {
        idVideoRef.current.srcObject = stream;
        idVideoRef.current.play();
      }
    } catch (err) {
      console.error('ID Camera error:', err);
      // Fallback to any available video device if specific facingMode fails
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        idStreamRef.current = fallbackStream;
        if (idVideoRef.current) {
          idVideoRef.current.srcObject = fallbackStream;
          idVideoRef.current.play();
        }
      } catch (fallbackErr) {
        setIdCameraError('Unable to access camera. Please allow camera permissions in your browser or upload an image file.');
        setIsIdCameraActive(false);
      }
    }
  };

  const switchIdCamera = () => {
    const nextFacing = idCameraFacing === 'environment' ? 'user' : 'environment';
    setIdCameraFacing(nextFacing);
    startIdCamera(nextFacing);
  };

  // Capture Photo from ID Camera
  const captureIdPhoto = () => {
    if (!idVideoRef.current) return;
    const video = idVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `valid-id-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setIdFile(file);
      setIdPhotoPreview(URL.createObjectURL(blob));
      setIdFileError('');
      stopIdCamera();
    }, 'image/jpeg', 0.95);
  };

  // Live Selfie Camera State
  const [isSelfieCameraActive, setIsSelfieCameraActive] = useState(false);
  const [selfieCameraError, setSelfieCameraError] = useState('');
  const [selfieCameraFacing, setSelfieCameraFacing] = useState('user'); // front camera by default for selfie
  const selfieVideoRef = useRef(null);
  const selfieStreamRef = useRef(null);

  // Stop Selfie Camera stream
  const stopSelfieCamera = () => {
    if (selfieStreamRef.current) {
      selfieStreamRef.current.getTracks().forEach((track) => track.stop());
      selfieStreamRef.current = null;
    }
    setIsSelfieCameraActive(false);
  };

  // Start Selfie Camera stream
  const startSelfieCamera = async (facing = selfieCameraFacing) => {
    stopSelfieCamera();
    setSelfieCameraError('');
    setIsSelfieCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: { ideal: facing },
        },
        audio: false,
      });
      selfieStreamRef.current = stream;
      if (selfieVideoRef.current) {
        selfieVideoRef.current.srcObject = stream;
        selfieVideoRef.current.play();
      }
    } catch (err) {
      console.error('Selfie Camera error:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        selfieStreamRef.current = fallbackStream;
        if (selfieVideoRef.current) {
          selfieVideoRef.current.srcObject = fallbackStream;
          selfieVideoRef.current.play();
        }
      } catch (fallbackErr) {
        setSelfieCameraError('Unable to access camera. Please allow camera permissions in your browser or upload a photo.');
        setIsSelfieCameraActive(false);
      }
    }
  };

  const switchSelfieCamera = () => {
    const nextFacing = selfieCameraFacing === 'user' ? 'environment' : 'user';
    setSelfieCameraFacing(nextFacing);
    startSelfieCamera(nextFacing);
  };

  // Capture Photo from Selfie Camera
  const captureSelfiePhoto = () => {
    if (!selfieVideoRef.current) return;
    const video = selfieVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `selfie-with-id-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setSelfieFile(file);
      setSelfiePhotoPreview(URL.createObjectURL(blob));
      setSelfieFileError('');
      stopSelfieCamera();
    }, 'image/jpeg', 0.95);
  };

  // Cleanup camera streams on unmount
  useEffect(() => {
    return () => {
      if (idStreamRef.current) {
        idStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (selfieStreamRef.current) {
        selfieStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  function handleRemoveIdFile() {
    stopIdCamera();
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
    stopSelfieCamera();
    setSelfieFile(null);
    setSelfiePhotoPreview('');
    setSelfieFileError('');
  }

  function update(field, value) {
    if (field === 'contactNumber') {
      let digits = String(value || '').replace(/\D/g, '');
      if (digits.startsWith('09')) {
        digits = digits.slice(1);
      } else if (digits.startsWith('639')) {
        digits = digits.slice(2);
      }
      setForm(f => ({ ...f, [field]: digits.slice(0, 10) }));
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

    const cleanDigits = (form.contactNumber || '').trim().replace(/\D/g, '');
    if (!/^9\d{9}$/.test(cleanDigits)) {
      setError('Contact number must be 10 digits starting with 9 (e.g., 9171234567).');
      return;
    }

    if (form.dateOfBirth) {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (form.dateOfBirth > todayStr) {
        setError('Date of birth cannot be in the future. Please select a valid date of birth.');
        return;
      }
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
        contactNumber: `+63${cleanDigits}`,
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
                <input value={form.firstName} onChange={e => update('firstName', e.target.value)} placeholder="e.g. Juan" required />
              </div>
              <div className="field">
                <label className="field-label">Middle Name</label>
                <input value={form.middleName} onChange={e => update('middleName', e.target.value)} placeholder="e.g. Santos (Optional)" />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">Last Name</label>
                <input value={form.lastName} onChange={e => update('lastName', e.target.value)} placeholder="e.g. Dela Cruz" required />
              </div>
              <div className="field">
                <label className="field-label">Date of Birth</label>
                <input
                  type="date"
                  min="1900-01-01"
                  max={new Date().toISOString().slice(0, 10)}
                  value={form.dateOfBirth}
                  onChange={e => update('dateOfBirth', e.target.value)}
                />
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
                  <input
                    value="+63"
                    disabled
                    aria-label="Country Code"
                    style={{
                      textAlign: 'center',
                      fontWeight: 700,
                      cursor: 'not-allowed',
                      userSelect: 'none',
                    }}
                  />
                  <input
                    type="tel"
                    value={form.contactNumber}
                    onChange={e => update('contactNumber', e.target.value)}
                    placeholder="9171234567"
                    maxLength={10}
                    inputMode="numeric"
                    required
                    aria-label="10-digit mobile number"
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
            <div style={{ margin: '24px 0 6px' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
                1. Valid ID Card or Document <span style={{ color: '#dc2626' }}>*</span>
              </div>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '.92rem', color: '#475569', lineHeight: 1.5 }}>
              Clear front photo of your valid Government ID (PhilSys ID, Driver's License, Passport, Voter's ID, PRC, or Barangay ID).
            </p>
            {isIdCameraActive ? (
              <div style={{ background: '#0f172a', borderRadius: 14, overflow: 'hidden', padding: 14, textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: 440, margin: '0 auto', borderRadius: 10, overflow: 'hidden', background: '#000', aspectRatio: '4/3' }}>
                  <video
                    ref={idVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* ID card alignment guide overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '12%',
                      left: '8%',
                      right: '8%',
                      bottom: '12%',
                      border: '2px dashed rgba(255, 255, 255, 0.85)',
                      borderRadius: 12,
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                      pointerEvents: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ color: '#fff', fontSize: '.78rem', fontWeight: 700, background: 'rgba(0,0,0,0.65)', padding: '4px 10px', borderRadius: 20 }}>
                      Align ID inside this frame
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={captureIdPhoto}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 22px',
                      borderRadius: 999,
                      fontWeight: 700,
                      fontSize: '.92rem',
                      cursor: 'pointer',
                      boxShadow: '0 2px 10px rgba(37, 99, 235, 0.4)',
                    }}
                  >
                    <ModernIcon name="camera" size={18} color="#fff" />
                    Take Picture of ID
                  </button>

                  <button
                    type="button"
                    onClick={switchIdCamera}
                    title="Flip camera"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 42,
                      height: 42,
                      background: 'rgba(255,255,255,0.15)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.25)',
                      borderRadius: '50%',
                      cursor: 'pointer',
                    }}
                  >
                    <ModernIcon name="refresh" size={18} color="#fff" />
                  </button>

                  <button
                    type="button"
                    onClick={stopIdCamera}
                    style={{
                      background: 'transparent',
                      color: '#cbd5e1',
                      border: 'none',
                      padding: '8px 14px',
                      fontSize: '.85rem',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : idFile ? (
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
                    {(idFile.size / (1024 * 1024)).toFixed(2)} MB • ID Document Ready
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 14, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => startIdCamera()}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '.82rem', color: '#2563eb', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <ModernIcon name="camera" size={14} color="#2563eb" />
                      Retake with Camera
                    </button>
                    <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                      Choose file
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Primary Action: Direct Camera Photo */}
                <button
                  type="button"
                  onClick={() => startIdCamera()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '16px 20px',
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <ModernIcon name="camera" size={22} color="#fff" />
                  <span>Take Picture of ID with Camera</span>
                </button>

                {/* Secondary Option: Or upload from files */}
                <label
                  className="upload-box"
                  htmlFor="idDocumentInput"
                  style={{ cursor: 'pointer', display: 'block', margin: 0, padding: '16px 12px' }}
                >
                  <div className="icon" style={{ marginBottom: 6 }}>
                    <ModernIcon name="id-card" size={22} color="#64748b" />
                  </div>
                  <strong style={{ fontSize: '.88rem', color: '#334155' }}>Or upload an existing ID photo file</strong>
                  <small style={{ fontSize: '.78rem' }}>JPG or PNG up to 5MB (Screenshots & non-ID pictures are rejected)</small>
                  <input
                    id="idDocumentInput"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => handleIdFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            )}
            {idCameraError && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: '.82rem' }}>
                {idCameraError}
              </div>
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
            <div style={{ margin: '24px 0 6px' }}>
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
                2. Live Photo Holding Your Valid ID <span style={{ color: '#dc2626' }}>*</span>
              </div>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '.92rem', color: '#475569', lineHeight: 1.5 }}>
              Take an original photo of yourself holding your physical ID next to your face. Your face must match the portrait on your valid ID. <strong>Screenshots are strictly prohibited.</strong>
            </p>
            {isSelfieCameraActive ? (
              <div style={{ background: '#0f172a', borderRadius: 14, overflow: 'hidden', padding: 14, textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: 440, margin: '0 auto', borderRadius: 10, overflow: 'hidden', background: '#000', aspectRatio: '4/3' }}>
                  <video
                    ref={selfieVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: selfieCameraFacing === 'user' ? 'scaleX(-1)' : 'none' }}
                  />
                  {/* Portrait & ID alignment overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '10%',
                      left: '12%',
                      right: '12%',
                      bottom: '10%',
                      border: '2px dashed rgba(255, 255, 255, 0.85)',
                      borderRadius: 16,
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                      pointerEvents: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                    }}
                  >
                    <span style={{ color: '#fff', fontSize: '.78rem', fontWeight: 700, background: 'rgba(0,0,0,0.65)', padding: '4px 10px', borderRadius: 20 }}>
                      Keep your face & ID inside the frame
                    </span>
                    <span style={{ color: '#fed7aa', fontSize: '.72rem', fontWeight: 600, background: 'rgba(0,0,0,0.65)', padding: '3px 8px', borderRadius: 16 }}>
                      Hold physical ID next to your cheek
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={captureSelfiePhoto}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 22px',
                      borderRadius: 999,
                      fontWeight: 700,
                      fontSize: '.92rem',
                      cursor: 'pointer',
                      boxShadow: '0 2px 10px rgba(2, 132, 199, 0.35)',
                    }}
                  >
                    <ModernIcon name="camera" size={18} color="#fff" />
                    Take Live Photo
                  </button>

                  <button
                    type="button"
                    onClick={switchSelfieCamera}
                    title="Flip camera"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 42,
                      height: 42,
                      background: 'rgba(255,255,255,0.15)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.25)',
                      borderRadius: '50%',
                      cursor: 'pointer',
                    }}
                  >
                    <ModernIcon name="refresh" size={18} color="#fff" />
                  </button>

                  <button
                    type="button"
                    onClick={stopSelfieCamera}
                    style={{
                      background: 'transparent',
                      color: '#cbd5e1',
                      border: 'none',
                      padding: '8px 14px',
                      fontSize: '.85rem',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : selfieFile ? (
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
                  <div style={{ marginTop: 8, display: 'flex', gap: 14, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => startSelfieCamera()}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '.82rem', color: '#0284c7', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <ModernIcon name="camera" size={14} color="#0284c7" />
                      Retake with Camera
                    </button>
                    <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                      Choose file
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Primary Action: Direct Live Camera Photo */}
                <button
                  type="button"
                  onClick={() => startSelfieCamera()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '16px 20px',
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: '1rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.25)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <ModernIcon name="camera" size={22} color="#fff" />
                  <span>Take Live Photo Holding Valid ID</span>
                </button>

                {/* Secondary Option: Or upload from files */}
                <label
                  className="upload-box"
                  htmlFor="selfieWithIdInput"
                  style={{ cursor: 'pointer', display: 'block', margin: 0, padding: '16px 12px' }}
                >
                  <div className="icon" style={{ marginBottom: 6 }}>
                    <ModernIcon name="selfie" size={22} color="#64748b" />
                  </div>
                  <strong style={{ fontSize: '.88rem', color: '#334155' }}>Or upload an existing photo file</strong>
                  <small style={{ fontSize: '.78rem' }}>JPG, PNG, or WebP up to 5MB (Screenshots rejected • Face must match ID)</small>
                  <input
                    id="selfieWithIdInput"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => handleSelfieFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            )}
            {selfieCameraError && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: '.82rem' }}>
                {selfieCameraError}
              </div>
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
                  <strong>Identity Verification in Progress:</strong>
                  <div style={{ fontSize: '.8rem', color: '#1d4ed8', marginTop: 2 }}>
                    {aiValidatingStep || 'Verifying ID document authenticity, readability, and facial biometrics…'}
                  </div>
                </div>
              </div>
            )}

            <button type="submit" className="btn btn-navy btn-block" disabled={loading}>
              {loading ? (aiValidatingStep ? 'Validating Documents…' : 'Submitting…') : 'SUBMIT & VERIFY EMAIL →'}
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
