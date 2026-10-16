import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { login, Session } from '../api.js';
import ModernIcon from '../components/ModernIcons.jsx';
import Recaptcha from '../components/Recaptcha.jsx';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(
    searchParams.get('reason') === 'account_removed'
      ? 'Your account has been removed or deactivated by the barangay administrator. You have been logged out.'
      : ''
  );
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const recaptchaRef = useRef(null);

  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  useEffect(() => {
    if (Session.isLoggedIn()) navigate('/dashboard');
  }, [navigate]);

  // Handle active 1-minute lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);



  async function handleSubmit(e) {
    e.preventDefault();
    if (lockoutSeconds > 0) return;
    setError('');
    setUnverifiedEmail('');
    setLoading(true);

    try {
      const data = await login(identifier, password, recaptchaToken || undefined);
      if (data?.requiresCaptcha) {
        setLoading(false);
        recaptchaRef.current?.openChallenge();
        return;
      }
      Session.setToken(data.token);
      Session.setUser(data.user);
      navigate('/dashboard');
    } catch (err) {
      recaptchaRef.current?.reset();
      setRecaptchaToken('');
      if (err.data?.secondsRemaining) {
        setLockoutSeconds(err.data.secondsRemaining);
      }
      if (err.data?.requiresVerification) {
        setUnverifiedEmail(err.data.email || identifier.trim());
      }
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleRecaptchaVerify(token) {
    if (lockoutSeconds > 0) return;
    setRecaptchaToken(token);
    setError('');
    setUnverifiedEmail('');
    setLoading(true);
    try {
      const data = await login(identifier, password, token);
      if (!data?.requiresCaptcha) {
        Session.setToken(data.token);
        Session.setUser(data.user);
        navigate('/dashboard');
      }
    } catch (err) {
      recaptchaRef.current?.reset();
      setRecaptchaToken('');
      if (err.data?.secondsRemaining) {
        setLockoutSeconds(err.data.secondsRemaining);
      }
      if (err.data?.requiresVerification) {
        setUnverifiedEmail(err.data.email || identifier.trim());
      }
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="center-page auth-scene">
      <div className="auth-card auth-login-card">
        <img src="/barangay-seal.png" alt="Barangay Poblacion seal" className="auth-logo" />
        <h1 className="auth-title" style={{ color: '#000000', textShadow: 'none', fontWeight: 800 }}>
          Barangay Poblacion
        </h1>

        {error && (
          <div className="error-msg" style={{ textAlign: 'left' }}>
            <div>{error}</div>
            {unverifiedEmail && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(220, 38, 38, 0.2)' }}>
                <Link
                  to={`/register?step=verify&email=${encodeURIComponent(unverifiedEmail)}`}
                  style={{
                    color: '#991b1b',
                    fontWeight: 700,
                    textDecoration: 'underline',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  Verify your email with your 6-digit code now →
                </Link>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="field">
            <label className="field-label" style={{ margin: 0, textAlign: 'left' }}>Email</label>
            <div className="input-icon">
              <ModernIcon name="mail" size={18} className="icon" />
              <input
                type="email"
                name="resident_auth_email"
                autoComplete="new-password"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
          </div>
          <div className="field">
            <div className="row-between" style={{ marginBottom: 6 }}>
              <label className="field-label" style={{ margin: 0 }}>Password</label>
              <Link to="/forgot-password" className="link-blue">Forgot Password?</Link>
            </div>
            <div className="input-icon">
              <ModernIcon name="key" size={18} className="icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="resident_auth_password"
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="show-password-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <ModernIcon name={showPassword ? 'eye' : 'eye-off'} size={18} />
              </button>
            </div>
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="staySignedIn" style={{ width: 'auto' }} />
            <label htmlFor="staySignedIn">Stay signed in for 30 days</label>
          </div>

          <Recaptcha
            ref={recaptchaRef}
            hideTriggerBox={true}
            onVerify={handleRecaptchaVerify}
            onExpire={() => setRecaptchaToken('')}
            onError={() => {
              setRecaptchaToken('');
              setError('reCAPTCHA encountered an issue. Please try again.');
            }}
          />

          <button
            type="submit"
            className="btn btn-navy btn-block"
            disabled={loading || lockoutSeconds > 0}
            style={lockoutSeconds > 0 ? { opacity: 0.75, cursor: 'not-allowed', background: '#dc2626' } : {}}
          >
            {lockoutSeconds > 0
              ? `Locked out — Try again in ${lockoutSeconds}s`
              : loading
              ? 'Signing in…'
              : 'Secure Login →'}
          </button>
        </form>

        <p className="footer-note">Don't have an account? <Link to="/register" className="link-blue">Register here</Link></p>

        <p className="footer-note">© 2026 Barangay Poblacion Digital Bureau</p>
      </div>
    </div>
  );
}
