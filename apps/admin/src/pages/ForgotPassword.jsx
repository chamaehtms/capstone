import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setMessage(data.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <div className="border-b border-slate-200 px-8 py-4 text-xs font-semibold tracking-wide text-slate-500 bg-white">
        SMART PROFILING AND COMPLAINT MANAGEMENT SYSTEM FOR BARANGAY POBLACION
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-sm text-center">
          <img src="/barangay-seal.png" alt="Barangay Poblacion seal" className="h-16 w-16 mx-auto mb-3 object-contain drop-shadow-sm" />
          <h1 className="text-xl font-bold text-slate-900">Recover Access</h1>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            Enter your institutional email address to receive a secure reset link.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600">INSTITUTIONAL EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@civicledger.gov"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {message && <p className="text-sm text-green-600">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-navy-900 hover:bg-navy-800 text-white font-medium rounded-lg px-4 py-3 disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send Reset Link →'}
            </button>

            <Link to="/login" className="block text-center text-sm text-slate-600 hover:underline">
              ← Back to login
            </Link>
          </form>

          <div className="mt-6 bg-slate-50 text-slate-500 text-xs rounded-lg p-3">
            <p className="font-semibold text-slate-600 mb-1">INSTITUTIONAL PROTOCOL</p>
            If you no longer have access to your institutional inbox, please contact your Departmental
            Administrator or file a ticket with Central IT Support.
          </div>
        </div>
      </div>
    </div>
  );
}
