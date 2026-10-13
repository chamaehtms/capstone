import React, { createContext, useContext, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => {
    try {
      const stored = localStorage.getItem('admin');
      const parsed = stored ? JSON.parse(stored) : null;
      if (
        parsed &&
        (parsed.email?.toLowerCase().includes('elena') ||
          parsed.fullName?.toLowerCase().includes('elena') ||
          parsed.full_name?.toLowerCase().includes('elena'))
      ) {
        localStorage.removeItem('token');
        localStorage.removeItem('admin');
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
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
