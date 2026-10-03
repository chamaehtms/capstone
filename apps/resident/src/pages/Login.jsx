import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, Session } from '../api.js';
import ModernIcon from '../components/ModernIcons.jsx';

export default function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (Session.isLoggedIn()) navigate('/dashboard');
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(identifier, password);
      Session.setToken(data.token);
      Session.setUser(data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="center-page auth-scene">
      <div className="auth-card auth-login-card">
        <img src="/barangay-seal.png" alt="Barangay Poblacion seal" className="auth-logo" />
        <h1 className="auth-title">Barangay Poblacion</h1>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field input-icon">
            <label className="field-label">Email</label>
            <ModernIcon name="mail" size={18} className="icon" />
            <input type="email" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="field input-icon login-password-field">
            <div className="row-between" style={{ marginBottom: 6 }}>
              <label className="field-label" style={{ margin: 0 }}>Password</label>
              <Link to="/forgot-password" className="link-blue">Forgot Password?</Link>
            </div>
            <ModernIcon name="key" size={18} className="icon" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <div className="checkbox-row">
            <input type="checkbox" id="staySignedIn" style={{ width: 'auto' }} />
            <label htmlFor="staySignedIn">Stay signed in for 30 days</label>
          </div>
          <button type="submit" className="btn btn-navy btn-block" disabled={loading}>
            {loading ? 'Signing in…' : 'Secure Login →'}
          </button>
        </form>

        <p className="footer-note">Don't have an account? <Link to="/register" className="link-blue">Register your Household</Link></p>

        <p className="footer-note">© 2024 Barangay Poblacion Digital Bureau</p>
      </div>
    </div>
  );
}
