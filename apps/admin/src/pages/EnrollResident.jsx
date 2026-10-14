import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import AdminIcon from '../components/AdminIcons.jsx';

export default function EnrollResident() {
  const [form, setForm] = useState({
    fullName: '',
    birthDate: '',
    gender: '',
    occupation: '',
    address: '',
    zone: '',
    residencyYears: '',
    contact: '',
    email: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  
  // ID Upload State
  const [idFile, setIdFile] = useState(null);
  const [idPreview, setIdPreview] = useState('');

  // Live Camera Selfie Capture State
  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [rejectedField, setRejectedField] = useState(null);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const navigate = useNavigate();

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleContactChange = (e) => {
    // Only accept numeric digits
    let digits = e.target.value.replace(/\D/g, '');

    // Must start with '09'
    if (digits.length > 0 && !digits.startsWith('0')) {
      digits = '09' + digits.replace(/^0+/, '');
    } else if (digits.length >= 2 && !digits.startsWith('09')) {
      digits = '09' + digits.slice(2);
    }

    // Limit to exactly 11 digits
    if (digits.length > 11) {
      digits = digits.slice(0, 11);
    }

    setForm((prev) => ({ ...prev, contact: digits }));
    if (error && error.includes('Mobile number')) {
      setError('');
    }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleIdSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const screenshotPatterns = [/screenshot/i, /screen_shot/i, /screen-shot/i, /screen_capture/i, /screencap/i, /capture_\d+/i, /snip(?:ping)?/i, /prntscr/i, /printscreen/i];
    if (screenshotPatterns.some(p => p.test(file.name || ''))) {
      setIdFile(null);
      setIdPreview('');
      setRejectedField('idDocument');
      setError('Screenshots are not accepted. Please upload an original, clear photograph of an authentic physical government ID card.');
      return;
    }

    setIdFile(file);
    setIdPreview(URL.createObjectURL(file));
    if (rejectedField === 'idDocument') {
      setRejectedField(null);
      setError('');
    }
  };

  // Live Camera Functions
  const startCamera = async () => {
    setCameraError('');
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Unable to access camera. Please check permissions.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setSelfieFile(file);
      setSelfiePreview(URL.createObjectURL(blob));
      if (rejectedField === 'selfieWithId') {
        setRejectedField(null);
        setError('');
      }
      stopCamera();
    }, 'image/jpeg', 0.92);
  };

  const handleSelfieFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const screenshotPatterns = [/screenshot/i, /screen_shot/i, /screen-shot/i, /screen_capture/i, /screencap/i, /capture_\d+/i, /snip(?:ping)?/i, /prntscr/i, /printscreen/i];
    if (screenshotPatterns.some(p => p.test(file.name || ''))) {
      setSelfieFile(null);
      setSelfiePreview('');
      setRejectedField('selfieWithId');
      setError('Screenshots are not accepted. Please take and upload an authentic live camera selfie of the resident holding their physical ID card.');
      return;
    }

    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
    if (rejectedField === 'selfieWithId') {
      setRejectedField(null);
      setError('');
    }
  };

  const clearSelfie = () => {
    stopCamera();
    setSelfieFile(null);
    setSelfiePreview('');
  };

  const clearId = () => {
    setIdFile(null);
    setIdPreview('');
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setRejectedField(null);

    // Proper ID Validation: An authentic government ID document is mandatory for enrollment
    if (!idFile) {
      setError('A valid government or institutional ID document is required for enrollment. Please upload a clear photo of the resident\'s ID.');
      setRejectedField('idDocument');
      return;
    }

    // Mobile Number Validation: Only numbers, exactly 11 digits, must start with 09
    const cleanContact = String(form.contact || '').trim();
    if (!/^\d+$/.test(cleanContact)) {
      setError('Mobile number must contain digits only.');
      return;
    }
    if (!cleanContact.startsWith('09')) {
      setError('Mobile number must start with 09 (e.g. 09123456789).');
      return;
    }
    if (cleanContact.length !== 11) {
      setError(`Mobile number must be exactly 11 digits starting with 09 (currently ${cleanContact.length} digits). Example: 09123456789.`);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/residents', form);

      // Upload profile photo and verification documents
      const formData = new FormData();
      if (photoFile) formData.append('photo', photoFile);
      formData.append('idDocument', idFile);
      if (selfieFile) formData.append('selfieWithId', selfieFile);

      await api.post(`/residents/${data.id}/documents`, formData);

      navigate(`/residents/${data.id}`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Unable to enroll resident.';
      const field = err.response?.data?.rejectedField || null;
      setError(msg);
      setRejectedField(field);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Enroll New Resident</h1>
        <p className="text-sm text-slate-500">
          Ensure all administrative data, identification documents, and live selfie verification match municipal standards.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Photo */}
        <section className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <AdminIcon name="camera" size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800">Profile Photo</h2>
          </div>
          <div className="flex items-center gap-4">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Resident preview"
                className="h-20 w-20 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                No Photo
              </div>
            )}
            <div>
              <label className="inline-block px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer">
                Choose Profile Photo
                <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
              </label>
              <p className="text-xs text-slate-400 mt-1">JPG or PNG, up to 5MB. Standard portrait.</p>
            </div>
          </div>
        </section>

        {/* Identity Verification Documents & Live Selfie */}
        <section className={`bg-white rounded-xl shadow-sm p-6 space-y-5 border-l-4 ${rejectedField ? 'border-l-red-500' : 'border-l-blue-600'}`}>
          <div>
            <div className="flex items-center gap-2">
              <AdminIcon name="id-card" size={18} className={rejectedField ? 'text-red-500' : 'text-blue-600'} />
              <h2 className="font-semibold text-slate-800">Identity Verification Documents</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Upload the resident's valid government-issued ID and capture a live camera selfie to verify identity authenticity.
            </p>
          </div>

          {/* Validation Rejection Alert Banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800 space-y-1.5 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 font-bold text-red-900 text-sm">
                <AdminIcon name="alert" size={16} className="text-red-600 shrink-0" />
                <span>Verification Failed — Upload Rejected</span>
              </div>
              <p className="pl-6 font-medium leading-relaxed">{error}</p>
              <p className="pl-6 text-[11px] text-red-600 italic">
                Please review the reason above, replace or re-capture the rejected document, and confirm enrollment again.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Valid ID Upload Box */}
            <div className={`border rounded-xl p-4 flex flex-col justify-between transition ${rejectedField === 'idDocument' ? 'border-red-400 bg-red-50/40 ring-2 ring-red-200' : 'border-slate-200 bg-slate-50/50'}`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <AdminIcon name="id-card" size={14} className="text-blue-600" />
                    <span>Government Valid ID <span className="text-red-500">*</span></span>
                  </span>
                  {idPreview && (
                    <button
                      type="button"
                      onClick={clearId}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                    >
                      <AdminIcon name="x" size={12} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Upload an original physical photo of PhilSys, Driver's License, Passport, UMID, Voter's ID, PRC, or Barangay ID. Screenshots and non-ID images are rejected.
                </p>

                {idPreview ? (
                  <div className="relative rounded-lg overflow-hidden border border-slate-300 bg-white h-44 flex items-center justify-center p-2">
                    <img src={idPreview} alt="Valid ID Preview" className="max-h-full max-w-full object-contain rounded" />
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-300 rounded-lg h-44 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition p-4 text-center">
                    <AdminIcon name="id-card" size={32} className="text-slate-400 mb-2" />
                    <span className="text-xs font-semibold text-blue-600">Click to upload Valid ID</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">PNG or JPG up to 5MB (Screenshots rejected)</span>
                    <input type="file" accept="image/*" onChange={handleIdSelect} className="hidden" />
                  </label>
                )}
              </div>

              {idPreview && (
                <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className={`text-[11px] font-medium flex items-center gap-1 ${rejectedField === 'idDocument' ? 'text-red-700 font-bold' : 'text-green-700'}`}>
                    <AdminIcon name={rejectedField === 'idDocument' ? 'alert' : 'check'} size={12} className={rejectedField === 'idDocument' ? 'text-red-600' : 'text-green-600'} />
                    <span>{rejectedField === 'idDocument' ? 'ID Rejected — Please Re-upload' : 'Ready for ID AI Scan'}</span>
                  </span>
                  <label className={`text-[11px] font-semibold cursor-pointer px-2 py-0.5 rounded transition ${rejectedField === 'idDocument' ? 'bg-red-600 text-white hover:bg-red-700' : 'text-blue-600 hover:underline'}`}>
                    {rejectedField === 'idDocument' ? 'Re-upload Valid ID' : 'Change ID'}
                    <input type="file" accept="image/*,.pdf" onChange={handleIdSelect} className="hidden" />
                  </label>
                </div>
              )}
            </div>

            {/* Live Camera Selfie Capture Box */}
            <div className={`border rounded-xl p-4 flex flex-col justify-between transition ${rejectedField === 'selfieWithId' ? 'border-red-400 bg-red-50/40 ring-2 ring-red-200' : 'border-slate-200 bg-slate-50/50'}`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <AdminIcon name="selfie" size={14} className="text-blue-600" />
                    <span>Live Selfie with ID</span>
                  </span>
                  {selfiePreview && (
                    <button
                      type="button"
                      onClick={clearSelfie}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                    >
                      <AdminIcon name="x" size={12} />
                      <span>Retake</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Capture a live photo holding the exact ID to ensure face matching and liveness validation.
                </p>

                {/* Camera Viewfinder */}
                {isCameraActive ? (
                  <div className="relative rounded-lg overflow-hidden border border-slate-900 bg-black h-44 flex flex-col items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full shadow-lg flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <AdminIcon name="camera" size={13} />
                        <span>Snap Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-white text-xs rounded-full cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : selfiePreview ? (
                  <div className="relative rounded-lg overflow-hidden border border-slate-300 bg-white h-44 flex items-center justify-center p-2">
                    <img src={selfiePreview} alt="Selfie Preview" className="max-h-full max-w-full object-contain rounded" />
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-300 rounded-lg h-44 flex flex-col items-center justify-center p-4 text-center">
                    <AdminIcon name="selfie" size={32} className="text-slate-400 mb-2" />
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer mb-2"
                    >
                      <AdminIcon name="camera" size={14} />
                      <span>Open Live Camera</span>
                    </button>
                    <label className="text-[11px] text-slate-500 hover:text-blue-600 cursor-pointer">
                      or <span className="underline font-medium">upload image file</span>
                      <input type="file" accept="image/*" onChange={handleSelfieFileUpload} className="hidden" />
                    </label>
                  </div>
                )}
                {cameraError && <p className="text-xs text-red-600 mt-2">{cameraError}</p>}
              </div>

              {selfiePreview && (
                <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className={`text-[11px] font-medium flex items-center gap-1 ${rejectedField === 'selfieWithId' ? 'text-red-700 font-bold' : 'text-green-700'}`}>
                    <AdminIcon name={rejectedField === 'selfieWithId' ? 'alert' : 'check'} size={12} className={rejectedField === 'selfieWithId' ? 'text-red-600' : 'text-green-600'} />
                    <span>{rejectedField === 'selfieWithId' ? 'Selfie Rejected — Please Retake' : 'Selfie Captured'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={startCamera}
                    className={`text-[11px] font-semibold cursor-pointer px-2 py-0.5 rounded transition ${rejectedField === 'selfieWithId' ? 'bg-red-600 text-white hover:bg-red-700' : 'text-blue-600 hover:underline'}`}
                  >
                    {rejectedField === 'selfieWithId' ? 'Re-capture Live Selfie' : 'Open Camera Again'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <AdminIcon name="user" size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800">Personal Information</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">
                FULL NAME <span className="text-red-500">*</span>
              </label>
              <input
                value={form.fullName}
                onChange={update('fullName')}
                placeholder="e.g. Juan De La Cruz"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                BIRTH DATE <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={form.birthDate}
                onChange={update('birthDate')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                GENDER <span className="text-red-500">*</span>
              </label>
              <select
                value={form.gender}
                onChange={update('gender')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Gender</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                OCCUPATION <span className="text-red-500">*</span>
              </label>
              <input
                value={form.occupation}
                onChange={update('occupation')}
                placeholder="e.g. Civil Engineer"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <AdminIcon name="pin" size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800">Residential Details</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600">
                PERMANENT ADDRESS <span className="text-red-500">*</span>
              </label>
              <input
                value={form.address}
                onChange={update('address')}
                placeholder="House No, Street, Barangay"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                ZONE / PUROK <span className="text-red-500">*</span>
              </label>
              <input
                value={form.zone}
                onChange={update('zone')}
                placeholder="e.g. Zone 2 - Bravo"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                LENGTH OF RESIDENCY (YEARS) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={form.residencyYears}
                onChange={update('residencyYears')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <AdminIcon name="phone" size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800">Contact Details</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">
                MOBILE NUMBER <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={11}
                pattern="09[0-9]{9}"
                value={form.contact}
                onChange={handleContactChange}
                placeholder="09XXXXXXXXX (11 digits)"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Numbers only. Must start with <strong>09</strong> and be exactly <strong>11 digits</strong> (e.g. 09123456789).
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">
                EMAIL <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={update('email')}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
          >
            Save Draft
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-60 flex items-center gap-2"
          >
            {loading ? (
              <>
                <AdminIcon name="clock" size={14} className="animate-spin" />
                <span>Enrolling & Uploading Documents…</span>
              </>
            ) : (
              <span>Confirm Enrollment</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
