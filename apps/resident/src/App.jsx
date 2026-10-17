import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';

// Lazy-load module pages
const Register = lazy(() => import('./pages/Register.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Services = lazy(() => import('./pages/Services.jsx'));
const FileComplaint = lazy(() => import('./pages/FileComplaint.jsx'));
const SubmissionSuccess = lazy(() => import('./pages/SubmissionSuccess.jsx'));
const Track = lazy(() => import('./pages/Track.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const AnnouncementDetail = lazy(() => import('./pages/AnnouncementDetail.jsx'));

import BarangayChatbot from './components/BarangayChatbot.jsx';

function ResidentPageLoading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid #e2e8f0',
            borderTopColor: '#2b6ef2',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }}
        />
        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Loading...</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<ResidentPageLoading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
        <Route path="/file-complaint" element={<ProtectedRoute><FileComplaint /></ProtectedRoute>} />
        <Route path="/submission-success" element={<ProtectedRoute><SubmissionSuccess /></ProtectedRoute>} />
        <Route path="/track" element={<ProtectedRoute><Track /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/announcements/:id" element={<ProtectedRoute><AnnouncementDetail /></ProtectedRoute>} />
      </Routes>
      <BarangayChatbot />
    </Suspense>
  );
}
