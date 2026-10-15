import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';

// Eagerly load lightweight auth and overview pages
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';

// Lazy-load heavier module pages on demand
const RequestAccess = lazy(() => import('./pages/RequestAccess.jsx'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResidentRecords = lazy(() => import('./pages/ResidentRecords.jsx'));
const Households = lazy(() => import('./pages/Households.jsx'));
const EnrollResident = lazy(() => import('./pages/EnrollResident.jsx'));
const ResidentProfile = lazy(() => import('./pages/ResidentProfile.jsx'));
const EditResident = lazy(() => import('./pages/EditResident.jsx'));
const ComplaintsRecord = lazy(() => import('./pages/ComplaintsRecord.jsx'));
const CaseDetail = lazy(() => import('./pages/CaseDetail.jsx'));
const CaseFiling = lazy(() => import('./pages/CaseFiling.jsx'));
const MeetingMinutes = lazy(() => import('./pages/MeetingMinutes.jsx'));
const Escalation = lazy(() => import('./pages/Escalation.jsx'));
const EscalationDetail = lazy(() => import('./pages/EscalationDetail.jsx'));
const EscalationCompose = lazy(() => import('./pages/EscalationCompose.jsx'));
const LetterIssued = lazy(() => import('./pages/LetterIssued.jsx'));
const PendingRequests = lazy(() => import('./pages/PendingRequests.jsx'));
const Announcements = lazy(() => import('./pages/Announcements.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));

function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        <span className="text-xs text-slate-400 font-medium">Loading page...</span>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
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
          <Route path="households" element={<Households />} />
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
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
