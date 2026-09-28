import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

import Login from './pages/Login.jsx';
import RequestAccess from './pages/RequestAccess.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Layout from './components/Layout.jsx';
import Overview from './pages/Overview.jsx';
import ResidentRecords from './pages/ResidentRecords.jsx';
import EnrollResident from './pages/EnrollResident.jsx';
import ResidentProfile from './pages/ResidentProfile.jsx';
import EditResident from './pages/EditResident.jsx';
import ComplaintsRecord from './pages/ComplaintsRecord.jsx';
import CaseDetail from './pages/CaseDetail.jsx';
import CaseFiling from './pages/CaseFiling.jsx';
import MeetingMinutes from './pages/MeetingMinutes.jsx';
import Escalation from './pages/Escalation.jsx';
import EscalationDetail from './pages/EscalationDetail.jsx';
import EscalationCompose from './pages/EscalationCompose.jsx';
import LetterIssued from './pages/LetterIssued.jsx';
import PendingRequests from './pages/PendingRequests.jsx';
import Announcements from './pages/Announcements.jsx';
import Settings from './pages/Settings.jsx';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/request-access" element={<RequestAccess />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Overview />} />
        <Route path="residents" element={<ResidentRecords />} />
        <Route path="residents/enroll" element={<EnrollResident />} />
        <Route path="residents/:id" element={<ResidentProfile />} />
        <Route path="residents/:id/edit" element={<EditResident />} />
        <Route path="complaints" element={<ComplaintsRecord />} />
        <Route path="complaints/:id" element={<CaseDetail />} />
        <Route path="complaints/new" element={<CaseFiling />} />
        <Route path="meetings" element={<MeetingMinutes />} />
        <Route path="escalation" element={<Escalation />} />
        <Route path="escalation/new" element={<EscalationCompose />} />
        <Route path="escalation/:id" element={<EscalationDetail />} />
        <Route path="escalation/:id/issued" element={<LetterIssued />} />
        <Route path="pending-requests" element={<PendingRequests />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
