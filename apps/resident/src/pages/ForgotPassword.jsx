import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword, resetPassword } from '../api.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!codeSent) {
        const data = await forgotPassword(email.trim());
        setMessage(data.message);
        setCodeSent(true);
      } else {
        if (newPassword !== confirmPassword) {
          setError('The passwords do not match.');
          return;
        }
        const data = await resetPassword(email.trim(), code.trim(), newPassword);
        setMessage(data.message);
        setResetComplete(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-page">
      <div className="auth-card">
        <img src="/barangay-seal.png" alt="Barangay Poblacion seal" className="auth-logo" />
        <h1 className="auth-title">{resetComplete ? 'Password Updated' : 'Reset Your Password'}</h1>
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '.9rem', margin: '0 0 20px' }}>
          {resetComplete
            ? 'Your password has been changed successfully.'
            : codeSent
              ? 'Enter the 6-digit code sent to your email and choose a new password.'
              : "Enter your account email and we'll send you a reset code."}
        </p>

        {error && <div className="error-msg">{error}</div>}
        {resetComplete ? (
          <div className="card" style={{ background: '#eaf6ec', borderColor: '#cdead2', textAlign: 'center' }}>
            <p style={{ margin: '0 0 14px', color: 'var(--navy)' }}>{message}</p>
            <Link to="/login" className="btn btn-navy btn-block">Return to Sign In</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {!codeSent ? (
              <>
                <div className="field input-icon">
                  <label className="field-label">Email</label>
                  <span className="icon">👤</span>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
                </div>
                <button type="submit" className="btn btn-navy btn-block" disabled={loading}>
                  {loading ? 'Sending code…' : 'Email Reset Code'}
                </button>
              </>
            ) : (
              <>
                {message && <div className="success-msg">{message}</div>}
                <div className="field">
                  <label className="field-label" htmlFor="resetCode">6-digit code</label>
                  <input
                    id="resetCode"
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="newPassword">New password</label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="confirmPassword">Confirm new password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-navy btn-block" disabled={loading}>
                  {loading ? 'Resetting password…' : 'Reset Password'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-block"
                  style={{ marginTop: 10 }}
                  onClick={() => { setCodeSent(false); setMessage(''); setError(''); }}
                >
                  Use a different email
                </button>
              </>
            )}
          </form>
        )}

        <p className="footer-note" style={{ marginTop: 16 }}>
          <Link to="/" className="link-blue">← Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
