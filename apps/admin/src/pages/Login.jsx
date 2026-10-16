import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Recaptcha from '../components/Recaptcha.jsx';
import AdminIcon from '../components/AdminIcons.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const recaptchaRef = useRef(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Handle active 1-minute lockout countdown timer
  React.useEffect(() => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;
    setError('');
    setLoading(true);

    try {
      // Check credentials first: only if true account credentials are confirmed, trigger puzzle
      const res = await login(email, password, recaptchaToken || undefined);
      if (res?.requiresCaptcha) {
        setLoading(false);
        recaptchaRef.current?.openChallenge();
        return;
      }
      navigate('/');
    } catch (err) {
      recaptchaRef.current?.reset();
      setRecaptchaToken('');
      if (err.response?.data?.secondsRemaining) {
        setLockoutSeconds(err.response.data.secondsRemaining);
      }
      setError(err.response?.data?.message || err.message || 'Unable to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecaptchaVerify = async (token) => {
    setRecaptchaToken(token);
    setError('');
    // Automatically complete login now that captcha is solved
    setLoading(true);
    try {
      const res = await login(email, password, token);
      if (!res?.requiresCaptcha) {
        navigate('/');
      }
    } catch (err) {
      recaptchaRef.current?.reset();
      setRecaptchaToken('');
      setError(err.response?.data?.message || err.message || 'Unable to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="center-page auth-scene">
      <div className="auth-card auth-login-card">
        <img src="/barangay-seal.png" alt="Barangay Poblacion seal" className="auth-logo" />
        <h1 className="auth-title" style={{ color: '#000000', textShadow: 'none', fontWeight: 800 }}>
          Barangay Poblacion
        </h1>
        <p style={{ marginTop: -14, marginBottom: 20, fontSize: '.82rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--muted)', textTransform: 'uppercase' }}>
          Administrative Portal
        </p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="field">
            <label className="field-label" style={{ margin: 0, textAlign: 'left' }}>Email</label>
            <div className="input-icon">
              <AdminIcon name="mail" size={18} className="icon" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="brgypoblacion@admin.gov"
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
              <AdminIcon name="key" size={18} className="icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="show-password-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <AdminIcon name={showPassword ? 'eye' : 'eye-off'} size={18} />
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

        <p className="footer-note">
          New system administrator?{' '}
          <Link to="/request-access" className="link-blue">
            Request Account Access
          </Link>
        </p>

        <p className="footer-note">© 2026 Barangay Poblacion Digital Bureau</p>
      </div>
    </div>
  );
}
