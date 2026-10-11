import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-auth-scene min-h-screen flex items-center justify-center p-6">
      <div className="admin-login-shell w-full max-w-4xl grid md:grid-cols-2 gap-6">
        <div className="admin-login-welcome flex flex-col items-center justify-center text-center text-white">
          <img src="/barangay-seal.png" alt="Barangay Poblacion seal" className="mb-6 h-28 w-28 rounded-full bg-transparent object-contain p-0 drop-shadow-md" />
          <h1 className="text-lg font-bold leading-snug">
            Welcome to Smart Profiling and Complaint Management System for Barangay Poblacion
          </h1>
        </div>

        <div className="admin-login-form">
          <div className="flex flex-col items-center mb-6">
            <img
              src="/barangay-seal.png"
              alt="Barangay Poblacion seal"
              className="mb-3 h-16 w-16 rounded-full object-contain drop-shadow-sm"
            />
            <h2 className="font-bold tracking-wide text-slate-800">INTERNAL ACCESS</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold tracking-wide text-slate-600">
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin@civicledger.gov"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold tracking-wide text-slate-600">PASSWORD</label>
                <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-16 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-navy-900 hover:bg-navy-800 text-white font-medium rounded-lg px-4 py-3 transition-colors disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Secure Login →'}
            </button>

            <p className="text-center text-xs text-slate-500 pt-2">
              New system administrator?{' '}
              <Link to="/request-access" className="font-semibold text-blue-600 hover:underline">
                Request Account Access
              </Link>
            </p>
          </form>

          <p className="mt-6 text-center text-[11px] text-slate-400">
            Demo credentials — Email: <span className="font-mono">admin@civicledger.gov</span> · Password:{' '}
            <span className="font-mono">admin123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
