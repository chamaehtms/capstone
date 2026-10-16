import React, { createContext, useContext, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => {
    try {
      const stored = localStorage.getItem('admin');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = async (email, password, recaptchaToken) => {
    const { data } = await api.post('/auth/login', { email, password, recaptchaToken });
    localStorage.setItem('token', data.token);
    localStorage.setItem('admin', JSON.stringify(data.admin));
    setAdmin(data.admin);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    setAdmin(null);
  };

  const updateAdmin = (partial) => {
    setAdmin((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem('admin', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ admin, login, logout, updateAdmin, isAuthenticated: !!admin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
