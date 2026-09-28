import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(Boolean(token));
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Verification link is missing or invalid. Request a new link below.');
      return;
    }
    api.post('/auth/verify-email', { token })
      .then(({ data }) => setMessage(data.message))
      .catch((err) => setError(err.response?.data?.message || 'Unable to verify this email address.'))
      .finally(() => setChecking(false));
  }, [token]);

  const resendVerification = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setResending(true);
    try {
      const { data } = await api.post('/auth/resend-verification', { email });
      setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send a verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="admin-auth-scene admin-verify-scene min-h-screen flex items-center justify-center p-6">
      <section className="admin-verify-panel w-full max-w-lg rounded-2xl p-8 text-center">
        <img src="/barangay-seal.png" alt="Barangay Poblacion seal" className="mx-auto mb-4 h-20 w-20 object-contain drop-shadow" />
        <h1 className="text-2xl font-bold">Email Verification</h1>
        {checking ? (
          <p className="mt-4">Verifying your email address…</p>
        ) : (
          <>
            {message && <p className="mt-4 text-green-200">{message}</p>}
            {error && <p className="mt-4 text-red-200">{error}</p>}
            {error && (
              <form onSubmit={resendVerification} className="mt-6 space-y-4 text-left">
                <label htmlFor="resend-email" className="block text-sm font-semibold">Email address</label>
                <input
                  id="resend-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-white/30 bg-white/90 px-3 py-2.5 text-slate-900"
                  required
                />
                <button type="submit" disabled={resending} className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-60">
                  {resending ? 'Sending…' : 'Resend verification email'}
                </button>
              </form>
            )}
          </>
        )}
        <p className="mt-6"><Link to="/login" className="font-semibold text-blue-300 hover:underline">Return to sign in</Link></p>
      </section>
    </main>
  );
}
