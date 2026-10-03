import React, { useState, useRef } from 'react';
import { fileComplaint } from '../api.js';

const CATEGORIES = [
  {
    id: 'Road Damage',
    label: 'Road Damage',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19L8 5M20 19L16 5M12 5V7M12 11V13M12 17V19" />
      </svg>
    ),
  },
  {
    id: 'Drainage / Flooding',
    label: 'Drainage / Flooding',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 11c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 5-2.5 7.5 0M2 16c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 5-2.5 7.5 0" />
      </svg>
    ),
  },
  {
    id: 'Streetlight',
    label: 'Streetlight',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
      </svg>
    ),
  },
  {
    id: 'Bridge / Footbridge',
    label: 'Bridge / Footbridge',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19V9l8-5 8 5v10M2 19h20M12 4v15M8 19v-6M16 19v-6" />
      </svg>
    ),
  },
  {
    id: 'Public Building',
    label: 'Public Building',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 10v2M15 10v2M9 16v2M15 16v2" />
      </svg>
    ),
  },
  {
    id: 'Water Facility',
    label: 'Water Facility',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      </svg>
    ),
  },
  {
    id: 'Sidewalk',
    label: 'Sidewalk',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="4" r="2" />
        <path d="M10 22v-6l-2-2 2-3 3 2 3-2M15 15l2 7" />
      </svg>
    ),
  },
  {
    id: 'Road Sign / Traffic Sign',
    label: 'Road Sign / Traffic Sign',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M5 5h14v8H5z" />
      </svg>
    ),
  },
  {
    id: 'Other',
    label: 'Other',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
        <circle cx="5" cy="12" r="1.5" />
      </svg>
    ),
  },
];

export default function InfrastructureReportCard({ user, onSuccess, onCancel }) {
  // 1. Reporter Information
  const [residentName, setResidentName] = useState(user?.fullName || '');
  const [contactNumber, setContactNumber] = useState(user?.contactNumber || '');
  const [zone, setZone] = useState(user?.purok || 'Zone 4, Poblacion');
  const [residentId, setResidentId] = useState(user?.residentId || user?.id || '');

  // 2. Infrastructure Details
  const [category, setCategory] = useState('Road Damage');
  const [specificLocation, setSpecificLocation] = useState('');
  const [landmark, setLandmark] = useState('');

  // 3. Description of Issue
  const [problemDescription, setProblemDescription] = useState('');
  const [firstNoticed, setFirstNoticed] = useState('Within the past week');
  const [severityLevel, setSeverityLevel] = useState('High - May affect public safety');

  // 4. Supporting Evidence
  const [photos, setPhotos] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [numAttachments, setNumAttachments] = useState('2');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const photoInputRef = useRef(null);
  const docInputRef = useRef(null);

  function handlePhotoFiles(files) {
    if (!files || files.length === 0) return;
    const added = Array.from(files).map((file) => ({
      file,
      name: file.name,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));
    setPhotos((prev) => {
      const next = [...prev, ...added].slice(0, 5);
      setNumAttachments(String(next.length || 1));
      return next;
    });
  }

  function removePhoto(index) {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setNumAttachments(String(next.length || 1));
      return next;
    });
  }

  function handleDocFiles(files) {
    if (!files || files.length === 0) return;
    const added = Array.from(files).map((file) => ({
      file,
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
    }));
    setDocuments((prev) => [...prev, ...added].slice(0, 3));
  }

  function removeDoc(index) {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!residentName.trim()) {
      setError('Resident Name is required.');
      return;
    }
    if (!contactNumber.trim()) {
      setError('Contact Number is required.');
      return;
    }
    if (!zone) {
      setError('Address / Zone is required.');
      return;
    }
    if (!specificLocation.trim()) {
      setError('Specific Location is required.');
      return;
    }
    if (!problemDescription.trim()) {
      setError('Please provide a description of the problem.');
      return;
    }

    setLoading(true);

    try {
      const formattedNarrative = [
        `[INFRASTRUCTURE REPORT CARD]`,
        `• Category: ${category}`,
        `• Specific Location: ${specificLocation}`,
        `• Landmark / Nearby Area: ${landmark || 'None provided'}`,
        `• When First Noticed: ${firstNoticed}`,
        `• Severity Level: ${severityLevel}`,
        `• Reporter Name: ${residentName}`,
        `• Contact: ${contactNumber}`,
        `• Address / Zone: ${zone}`,
        `• Resident ID: ${residentId || 'None'}`,
        ``,
        `Problem Description:`,
        problemDescription,
      ].join('\n');

      const body = {
        category: 'infrastructure',
        nature: `[${category}] ${specificLocation}`,
        description: `[${category}] ${specificLocation}`,
        respondentName: landmark ? `Nearby: ${landmark}` : 'Barangay Engineering & Public Works',
        complainantName: residentName,
        complainantAddress: `${zone} • ${contactNumber}`,
        narrative: formattedNarrative,
        reliefSought: `Action / repair requested for ${category} at ${specificLocation} (${severityLevel}).`,
        evidence: photos[0]?.file || documents[0]?.file || null,
      };

      const complaint = await fileComplaint(body);
      if (onSuccess) {
        onSuccess(complaint);
      }
    } catch (err) {
      setError(err.message || 'Failed to submit report. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 860,
        margin: '0 auto',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: '34px 38px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 28 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem',
            color: '#ffffff',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(30, 41, 59, 0.15)',
          }}
        >
          📋
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
            Infrastructure Report Card
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#64748b' }}>
            Report infrastructure concerns and help us build a safer and better community.
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: '0.88rem',
            marginBottom: 24,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ================= 1. Reporter Information ================= */}
        <div style={{ marginBottom: 30 }}>
          <h3
            style={{
              margin: '0 0 16px',
              fontSize: '1.02rem',
              fontWeight: 700,
              color: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>👤</span> 1. Reporter Information
          </h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div>
              <label style={labelStyle}>
                Resident Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={residentName}
                onChange={(e) => setResidentName(e.target.value)}
                placeholder="e.g. Charle Mae S. Hatamosa"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                Contact Number <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="0912 345 6789"
                required
                style={inputStyle}
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            <div>
              <label style={labelStyle}>
                Address / Zone <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                required
                style={inputStyle}
              >
                <option value="Zone 1, Poblacion">Zone 1, Poblacion</option>
                <option value="Zone 2, Poblacion">Zone 2, Poblacion</option>
                <option value="Zone 3, Poblacion">Zone 3, Poblacion</option>
                <option value="Zone 4, Poblacion">Zone 4, Poblacion</option>
                <option value="Zone 5, Poblacion">Zone 5, Poblacion</option>
                <option value="Camulinas Purok Centro">Camulinas Purok Centro</option>
                <option value="Purok Rizal">Purok Rizal</option>
                <option value="Purok Mabini">Purok Mabini</option>
                <option value="Purok Bonifacio">Purok Bonifacio</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Resident ID (Optional)</label>
              <input
                type="text"
                value={residentId}
                onChange={(e) => setResidentId(e.target.value)}
                placeholder="e.g. BRGY-ID-2026-001"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* ================= 2. Infrastructure Details ================= */}
        <div style={{ marginBottom: 30 }}>
          <h3
            style={{
              margin: '0 0 16px',
              fontSize: '1.02rem',
              fontWeight: 700,
              color: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>🔧</span> 2. Infrastructure Details
          </h3>

          <label style={labelStyle}>
            Infrastructure Category <span style={{ color: '#ef4444' }}>*</span>
          </label>

          {/* Category Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 12,
              marginBottom: 18,
            }}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.id;
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  style={{
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    color: isSelected ? '#1d4ed8' : '#334155',
                    borderRadius: 10,
                    padding: '16px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontSize: '0.8rem',
                    fontWeight: isSelected ? 700 : 500,
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 2px 6px rgba(37, 99, 235, 0.12)' : 'none',
                  }}
                >
                  <div style={{ color: isSelected ? '#2563eb' : '#64748b' }}>{cat.icon}</div>
                  <span style={{ lineHeight: 1.25 }}>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            <div>
              <label style={labelStyle}>
                Specific Location <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={specificLocation}
                onChange={(e) => setSpecificLocation(e.target.value)}
                placeholder="Brgy. Poblacion, near the market"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Landmark / Nearby Area</label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="Beside the old market"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* ================= 3. Description of the Issue ================= */}
        <div style={{ marginBottom: 30 }}>
          <h3
            style={{
              margin: '0 0 16px',
              fontSize: '1.02rem',
              fontWeight: 700,
              color: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>📄</span> 3. Description of the Issue
          </h3>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              What is the problem? <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              placeholder="The road is damaged with large potholes. It causes difficulty for vehicles and pedestrians, especially during rainy days."
              rows={4}
              required
              style={{ ...inputStyle, minHeight: 96, resize: 'vertical' }}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            <div>
              <label style={labelStyle}>
                When was the problem first noticed? <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={firstNoticed}
                onChange={(e) => setFirstNoticed(e.target.value)}
                required
                style={inputStyle}
              >
                <option value="Within the past week">Within the past week</option>
                <option value="Today">Today</option>
                <option value="A few days ago">A few days ago</option>
                <option value="Within the past month">Within the past month</option>
                <option value="More than a month ago">More than a month ago</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>
                Severity Level <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={severityLevel}
                onChange={(e) => setSeverityLevel(e.target.value)}
                required
                style={inputStyle}
              >
                <option value="High - May affect public safety">🔴 High - May affect public safety</option>
                <option value="Medium - Needs attention soon">🟡 Medium - Needs attention soon</option>
                <option value="Low - Minor inconvenience">🟢 Low - Minor inconvenience</option>
              </select>
            </div>
          </div>
        </div>

        {/* ================= 4. Supporting Evidence ================= */}
        <div style={{ marginBottom: 32 }}>
          <h3
            style={{
              margin: '0 0 16px',
              fontSize: '1.02rem',
              fontWeight: 700,
              color: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>🖼️</span> 4. Supporting Evidence
          </h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              marginBottom: 16,
            }}
          >
            {/* Upload Photo / Video */}
            <div>
              <label style={labelStyle}>
                Upload Photo / Video <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div
                onClick={() => photoInputRef.current?.click()}
                style={uploadDropzoneStyle}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handlePhotoFiles(e.dataTransfer.files);
                }}
              >
                <div style={{ fontSize: '1.6rem', color: '#3b82f6', marginBottom: 6 }}>🖼️</div>
                <div style={{ fontSize: '0.86rem', color: '#1e293b' }}>
                  Click to <span style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'underline' }}>upload</span> or drag and drop
                </div>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 4 }}>
                  PNG, JPG, MP4 (Max 10MB)
                </div>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*,video/mp4"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handlePhotoFiles(e.target.files)}
              />

              <div style={{ marginTop: 12 }}>
                <label style={{ ...labelStyle, fontSize: '0.75rem' }}>Number of Attachments</label>
                <select
                  value={numAttachments}
                  onChange={(e) => setNumAttachments(e.target.value)}
                  style={{ ...inputStyle, padding: '8px 12px', fontSize: '0.85rem' }}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </div>
            </div>

            {/* Additional Documents */}
            <div>
              <label style={labelStyle}>Additional Documents (Optional)</label>
              <div
                onClick={() => docInputRef.current?.click()}
                style={uploadDropzoneStyle}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDocFiles(e.dataTransfer.files);
                }}
              >
                <div style={{ fontSize: '1.6rem', color: '#64748b', marginBottom: 6 }}>📄</div>
                <div style={{ fontSize: '0.86rem', color: '#1e293b' }}>
                  Click to <span style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'underline' }}>upload</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 4 }}>
                  PDF, DOC, DOCX (Max 10MB)
                </div>
              </div>
              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleDocFiles(e.target.files)}
              />

              {documents.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {documents.map((doc, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 12px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        fontSize: '0.78rem',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                        📄 {doc.name} ({doc.size})
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDoc(idx)}
                        style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 700 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Photos thumbnail preview row with '+ Add more' */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginTop: 12 }}>
            {photos.map((item, index) => (
              <div
                key={index}
                style={{
                  position: 'relative',
                  width: 90,
                  height: 75,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f1f5f9',
                }}
              >
                {item.preview ? (
                  <img
                    src={item.preview}
                    alt="attachment"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                    📹 Video
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    color: '#ffffff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 800,
                  }}
                  aria-label="Remove photo"
                >
                  ✕
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              style={{
                width: 90,
                height: 75,
                borderRadius: 8,
                border: '2px dashed #cbd5e1',
                backgroundColor: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                cursor: 'pointer',
                color: '#64748b',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span>
              <span>Add more</span>
            </button>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '12px 28px',
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            <span>🚀</span> {loading ? 'Submitting Report…' : 'Submit Report'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            style={{
              backgroundColor: '#ffffff',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '12px 24px',
              fontSize: '0.92rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '0.84rem',
  fontWeight: 600,
  color: '#334155',
  marginBottom: 6,
};

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  fontSize: '0.9rem',
  color: '#1e293b',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const uploadDropzoneStyle = {
  border: '2px dashed #cbd5e1',
  borderRadius: 10,
  padding: '24px 16px',
  textAlign: 'center',
  backgroundColor: '#f8fafc',
  cursor: 'pointer',
  transition: 'border-color 0.15s ease',
};
