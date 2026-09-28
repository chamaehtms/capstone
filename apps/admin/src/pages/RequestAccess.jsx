import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

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
  const [selfiePhoto, setSelfiePhoto] = useState(null);
  const [selfiePhotoPreview, setSelfiePhotoPreview] = useState('');
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
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, or WebP) for your ID.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('ID image file size must be less than 5MB.');
      return;
    }
    setError('');
    setIdPhoto(file);
    setIdPhotoPreview(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setIdPhoto(null);
    setIdPhotoPreview('');
  };

  const handleSelfieSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, or WebP) for your selfie holding ID.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Selfie image file size must be less than 5MB.');
      return;
    }
    setError('');
    setSelfiePhoto(file);
    setSelfiePhotoPreview(URL.createObjectURL(file));
  };

  const handleRemoveSelfie = () => {
    setSelfiePhoto(null);
    setSelfiePhotoPreview('');
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
      setError(err.response?.data?.message || 'Unable to submit request.');
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

  return (
    <div className="admin-auth-scene admin-request-scene min-h-screen">
      <div className="admin-request-header px-8 py-4 text-xs font-semibold tracking-wide text-slate-500 flex items-center gap-3">
        <img src="/barangay-seal.png" alt="Barangay Poblacion seal" className="h-7 w-7 object-contain drop-shadow-xs" />
        <span>SMART PROFILING AND COMPLAINT MANAGEMENT SYSTEM FOR BARANGAY POBLACION</span>
      </div>
      <div
        className={`admin-request-shell mx-auto px-8 py-10 ${
          step === 'form'
            ? 'max-w-6xl grid md:grid-cols-2 gap-10'
            : 'admin-request-single max-w-xl block my-10'
        }`}
      >
        {/* Left Information Section - only visible in form step */}
        {step === 'form' && (
          <div>
            <span className="inline-block text-[11px] font-semibold tracking-wide bg-orange-100 text-orange-600 px-2 py-1 rounded">
              ACCESS PROTOCOL
            </span>
            <h1 className="text-4xl font-extrabold mt-4 leading-tight text-slate-900">
              Administrative Authority Enrollment.
            </h1>
            <p className="text-slate-500 mt-4 leading-relaxed">
              Secure the integrity of regional governance. Request access to the Civic Ledger portal to
              manage institutional records and oversight.
            </p>

            <div className="mt-8 space-y-6">
              <div className="flex gap-3">
                <span className="text-2xl">🛡️</span>
                <div>
                  <p className="font-semibold text-slate-800">Identity Verification</p>
                  <p className="text-sm text-slate-500">
                    Official ID photo validation and departmental credential checks are required for all
                    administrative tiers.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-2xl">✉️</span>
                <div>
                  <p className="font-semibold text-slate-800">Gmail Verification Code</p>
                  <p className="text-sm text-slate-500">
                    A 6-digit verification code is delivered directly to your Gmail inbox to confirm ownership
                    before board submission.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-2xl">🔒</span>
                <div>
                  <p className="font-semibold text-slate-800">Encrypted Ledger</p>
                  <p className="text-sm text-slate-500">
                    All institutional interactions are logged on an immutable, AES-256 encrypted framework.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Right Form / Verification / Completed Panel */}
        <div className={`admin-request-panel ${step === 'form' ? 'p-8' : 'p-6 sm:p-8 border-0'}`}>
          {step === 'form' && (
            <>
              <h2 className="font-bold text-xl text-slate-900">Request Admin Credentials</h2>
              <p className="text-sm text-slate-500 mb-6">Please provide your official institutional details.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name Breakdown: First, Middle, Last Name */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      FIRST NAME <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={form.firstName}
                      onChange={update('firstName')}
                      placeholder="e.g. Julian"
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      MIDDLE NAME
                    </label>
                    <input
                      value={form.middleName}
                      onChange={update('middleName')}
                      placeholder="e.g. Cruz (Optional)"
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      LAST NAME <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={form.lastName}
                      onChange={update('lastName')}
                      placeholder="e.g. Montgomery"
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Sex & Contact No */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      SEX <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.sex}
                      onChange={update('sex')}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Sex</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      CONTACT NO. <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={form.contactNo}
                      onChange={update('contactNo')}
                      placeholder="e.g. 0917 123 4567"
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Field 1: Valid ID Card Photo */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    1. VALID ID CARD PHOTO <span className="text-red-500">*</span>
                  </label>
                  <p className="text-[11px] text-slate-400 mb-1.5">
                    Clear front-facing photo of your Employee ID or Government-issued ID.
                  </p>
                  {idPhotoPreview ? (
                    <div className="flex items-center gap-3 p-3 bg-white/70 backdrop-blur-xs border border-slate-200 rounded-lg">
                      <img
                        src={idPhotoPreview}
                        alt="ID Preview"
                        className="w-16 h-16 rounded-md object-cover border border-slate-300 shadow-xs"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{idPhoto?.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {(idPhoto?.size / (1024 * 1024)).toFixed(2)} MB • ID Photo Attached
                        </p>
                        <div className="mt-1 flex gap-2">
                          <label className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer">
                            Change Photo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoSelect}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="text-xs text-red-600 hover:text-red-700 font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-lg p-4 bg-white/60 hover:bg-white/80 transition-colors cursor-pointer text-center group">
                      <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">🪪</span>
                      <span className="text-xs font-semibold text-slate-700">
                        Click to upload your ID card
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5">
                        JPG, PNG, or WebP up to 5MB (Clear front photo of your ID)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Field 2: Selfie Holding Your Valid ID */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    2. SELFIE HOLDING YOUR VALID ID <span className="text-red-500">*</span>
                  </label>
                  <p className="text-[11px] text-slate-400 mb-1.5">
                    Hold your ID card next to your face so your face and ID details are both clearly visible.
                  </p>
                  {selfiePhotoPreview ? (
                    <div className="flex items-center gap-3 p-3 bg-white/70 backdrop-blur-xs border border-slate-200 rounded-lg">
                      <img
                        src={selfiePhotoPreview}
                        alt="Selfie with ID Preview"
                        className="w-16 h-16 rounded-md object-cover border border-slate-300 shadow-xs"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{selfiePhoto?.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {(selfiePhoto?.size / (1024 * 1024)).toFixed(2)} MB • Selfie Attached
                        </p>
                        <div className="mt-1 flex gap-2">
                          <label className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer">
                            Change Photo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleSelfieSelect}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={handleRemoveSelfie}
                            className="text-xs text-red-600 hover:text-red-700 font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-lg p-4 bg-white/60 hover:bg-white/80 transition-colors cursor-pointer text-center group">
                      <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">🤳</span>
                      <span className="text-xs font-semibold text-slate-700">
                        Click to upload selfie holding your ID
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5">
                        JPG, PNG, or WebP up to 5MB (Clear face + ID card in frame)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSelfieSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Email Address & Employee ID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      GMAIL / OFFICIAL EMAIL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={update('email')}
                      placeholder="you@gmail.com"
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      EMPLOYEE ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={form.employeeId}
                      onChange={update('employeeId')}
                      placeholder="CL-8848-00X"
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Department & Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      DEPARTMENT <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.department}
                      onChange={update('department')}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option>Internal Oversight</option>
                      <option>Urban Infrastructure & Planning</option>
                      <option>Community Health</option>
                      <option>Peace & Order</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      PASSWORD <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={update('password')}
                      placeholder="••••••••••••"
                      className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      minLength={8}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 -mt-2">
                  Password must be at least 8 characters.
                </p>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">
                    {error}
                  </div>
                )}
                {message && (
                  <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg p-3">
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-navy-900 hover:bg-navy-800 text-white font-medium rounded-lg px-4 py-3 disabled:opacity-60 transition-colors shadow-sm cursor-pointer"
                >
                  {loading ? 'Sending Verification Code…' : 'CONTINUE TO EMAIL VERIFICATION →'}
                </button>

                <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>
                    I agree to the <span className="text-blue-600 underline">Security Protocols</span>
                  </span>
                </label>

                <p className="text-xs text-slate-500 text-right">
                  Already have an account?{' '}
                  <Link to="/login" className="font-semibold text-slate-800 hover:underline">
                    Log in
                  </Link>
                </p>
              </form>

              <div className="mt-6 bg-blue-50 text-blue-800 text-xs rounded-lg p-3 flex gap-2 border border-blue-200">
                <span>ℹ️</span>
                <p>
                  A 6-digit confirmation code will be dispatched to your Gmail upon submission. You must
                  verify this code to queue your request for Institutional Board review.
                </p>
              </div>
            </>
          )}

          {/* Step 2: 6-Digit Verification Code (OTP) */}
          {step === 'verify' && (
            <div className="space-y-6">
              <div>
                <span className="inline-block text-[10px] font-bold tracking-wider bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase">
                  Step 2 of 2: Email Verification
                </span>
                <h2 className="font-bold text-2xl text-slate-900 mt-2">Enter Verification Code</h2>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  We sent a 6-digit code to{' '}
                  <strong className="text-slate-900 font-semibold">{verificationEmail}</strong>.
                  Please check your inbox (and spam folder) and enter it below.
                </p>
              </div>

              {otpError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">
                  {otpError}
                </div>
              )}

              {otpMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg p-3">
                  {otpMessage}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2 text-center tracking-wide uppercase">
                    6-Digit Verification Code
                  </label>
                  <div className="flex justify-center gap-2 sm:gap-3" onPaste={handleOtpPaste}>
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
                        className="w-11 h-13 sm:w-12 sm:h-14 text-center text-2xl font-bold font-mono border-2 border-slate-300 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all"
                        required={idx === 0}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 text-center mt-2">
                    Code expires in 15 minutes.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={otpLoading || otp.join('').length !== 6}
                  className="w-full bg-navy-900 hover:bg-navy-800 text-white font-semibold rounded-lg px-4 py-3 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                >
                  {otpLoading ? 'Verifying Code…' : 'VERIFY & SUBMIT FOR APPROVAL →'}
                </button>
              </form>

              <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200 gap-2">
                <div>
                  Didn't receive the email?{' '}
                  {cooldown > 0 ? (
                    <span className="text-slate-400 font-medium">Resend code in {cooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resending}
                      className="text-blue-600 hover:text-blue-700 font-semibold underline cursor-pointer disabled:opacity-60"
                    >
                      {resending ? 'Sending…' : 'Resend Code'}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="text-slate-500 hover:text-slate-700 underline cursor-pointer"
                >
                  ← Edit details / email
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Completed & Queued for Approval */}
          {step === 'completed' && (
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-3xl shadow-xs">
                ⏳
              </div>

              <div>
                <span className="inline-block text-[11px] font-bold tracking-wider bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 rounded-full uppercase">
                  ⏳ Waiting for Approval
                </span>
                <h2 className="font-extrabold text-2xl text-slate-900 mt-3">
                  Waiting for Approval
                </h2>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                  Your email (<strong className="text-slate-800">{verificationEmail || form.email}</strong>) has been verified successfully.
                  Your registration is now <strong className="text-amber-700">Waiting for Approval</strong> by the Barangay Poblacion System administration.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 text-left space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Applicant:</span>
                  <span className="text-slate-900 font-semibold">
                    {[form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ') || 'Administrator'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Employee ID:</span>
                  <span className="text-slate-800 font-medium">{form.employeeId || 'CL-8848-00X'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Department:</span>
                  <span className="text-slate-800 font-medium">{form.department}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Email Verification:</span>
                  <span className="text-green-600 font-bold flex items-center gap-1">
                    <span>✓</span> Verified
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-500">Account Status:</span>
                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 font-bold text-[11px] px-2.5 py-0.5 rounded-full border border-amber-300">
                    ⏳ Waiting for Approval
                  </span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 text-blue-900 text-xs rounded-lg p-3 text-left flex gap-2.5">
                <span className="text-base">📋</span>
                <p>
                  Your registration details and ID document have been sent to the <strong>Pending Requests</strong> queue. You will be able to log in once an active Administrator approves your request.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  to="/login"
                  className="inline-block w-full bg-navy-900 hover:bg-navy-800 text-white font-semibold rounded-lg px-4 py-3 transition-colors shadow-sm text-center"
                >
                  RETURN TO LOGIN
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
