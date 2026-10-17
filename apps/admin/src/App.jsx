import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';

// Eagerly load lightweight auth and overview pages
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';

// Helper to auto-retry dynamic module imports if a network drop or new deployment occurred
function lazyWithRetry(componentImport) {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (err) {
      // If a deploy occurred or network dropped, retry loading the chunk
      const hasRetried = sessionStorage.getItem(`admin_retry_${componentImport.toString()}`);
      if (!hasRetried) {
        sessionStorage.setItem(`admin_retry_${componentImport.toString()}`, 'true');
        window.location.reload();
      }
      throw err;
    }
  });
}

// Lazy-load heavier module pages on demand with recovery
const RequestAccess = lazyWithRetry(() => import('./pages/RequestAccess.jsx'));
const VerifyEmail = lazyWithRetry(() => import('./pages/VerifyEmail.jsx'));
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword.jsx'));
const ResidentRecords = lazyWithRetry(() => import('./pages/ResidentRecords.jsx'));
const EnrollResident = lazyWithRetry(() => import('./pages/EnrollResident.jsx'));
const ResidentProfile = lazyWithRetry(() => import('./pages/ResidentProfile.jsx'));
const EditResident = lazyWithRetry(() => import('./pages/EditResident.jsx'));
const ComplaintsRecord = lazyWithRetry(() => import('./pages/ComplaintsRecord.jsx'));
const CaseDetail = lazyWithRetry(() => import('./pages/CaseDetail.jsx'));
const CaseFiling = lazyWithRetry(() => import('./pages/CaseFiling.jsx'));
const MeetingMinutes = lazyWithRetry(() => import('./pages/MeetingMinutes.jsx'));
const Escalation = lazyWithRetry(() => import('./pages/Escalation.jsx'));
const EscalationDetail = lazyWithRetry(() => import('./pages/EscalationDetail.jsx'));
const EscalationCompose = lazyWithRetry(() => import('./pages/EscalationCompose.jsx'));
const LetterIssued = lazyWithRetry(() => import('./pages/LetterIssued.jsx'));
const PendingRequests = lazyWithRetry(() => import('./pages/PendingRequests.jsx'));
const Announcements = lazyWithRetry(() => import('./pages/Announcements.jsx'));
const ChatbotInquiries = lazyWithRetry(() => import('./pages/ChatbotInquiries.jsx'));
const Settings = lazyWithRetry(() => import('./pages/Settings.jsx'));
const Notifications = lazyWithRetry(() => import('./pages/Notifications.jsx'));

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
          <Route path="chatbot-inquiries" element={<ChatbotInquiries />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
