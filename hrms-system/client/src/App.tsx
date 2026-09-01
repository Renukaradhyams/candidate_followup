import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CandidateEntry = lazy(() => import('./pages/CandidateEntry'));
const Candidates = lazy(() => import('./pages/Candidates'));
const InterviewPanel = lazy(() => import('./pages/InterviewPanel'));
const InterviewForm = lazy(() => import('./pages/InterviewForm'));
const OfferProcess = lazy(() => import('./pages/OfferProcess'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const EmployeeExit = lazy(() => import('./pages/EmployeeExit'));
const Employees = lazy(() => import('./pages/Employees'));
const JoinedStoreEmployees = lazy(() => import('./pages/JoinedStoreEmployees'));
const Openings = lazy(() => import('./pages/Openings'));
const Settings = lazy(() => import('./pages/Settings'));
const BroadcastCenter = lazy(() => import('./pages/BroadcastCenter'));
const DepartmentHiring = lazy(() => import('./pages/DepartmentHiring'));
const SectionAllocation = lazy(() => import('./pages/SectionAllocation'));
const JoiningCallDesk = lazy(() => import('./pages/JoiningCallDesk'));
const WorkforceAnalytics = lazy(() => import('./pages/WorkforceAnalytics'));
const DOJPlanning = lazy(() => import('./pages/DOJPlanning'));
import QuickActionCenter from './components/ui/QuickActionCenter';
import PWAController from './components/PWAController';

function PageFallback() {
  return (
    <div className="min-h-screen bg-[#F4F1EA] flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-[#1E2D4E] border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs font-black uppercase text-[#1E2D4E] tracking-wider">Loading BSC Candidate CRM...</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <PWAController />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login.html" element={<Navigate to="/login" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard.html" element={<Navigate to="/dashboard" replace />} />
          <Route path="/candidates" element={<Candidates />} />
          <Route path="/candidates.html" element={<Navigate to="/candidates" replace />} />
          <Route path="/candidate-entry" element={<CandidateEntry />} />
          <Route path="/candidate-entry.html" element={<Navigate to="/candidate-entry" replace />} />
          <Route path="/interview-panel" element={<InterviewPanel />} />
          <Route path="/interview-panel.html" element={<Navigate to="/interview-panel" replace />} />
          <Route path="/interview-form" element={<InterviewForm />} />
          <Route path="/interview-form.html" element={<Navigate to="/interview-form" replace />} />
          <Route path="/offer-process" element={<OfferProcess />} />
          <Route path="/offer-process.html" element={<Navigate to="/offer-process" replace />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/onboarding.html" element={<Navigate to="/onboarding" replace />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/employees.html" element={<Navigate to="/employees" replace />} />
          <Route path="/joined-store" element={<JoinedStoreEmployees />} />
          <Route path="/joined-store.html" element={<Navigate to="/joined-store" replace />} />
          <Route path="/department-hiring" element={<DepartmentHiring />} />
          <Route path="/department-hiring.html" element={<Navigate to="/department-hiring" replace />} />
          <Route path="/section-allocation" element={<SectionAllocation />} />
          <Route path="/section-allocation.html" element={<Navigate to="/section-allocation" replace />} />
          <Route path="/employee-exit" element={<EmployeeExit />} />
          <Route path="/employee-exit.html" element={<Navigate to="/employee-exit" replace />} />
          <Route path="/joining-call-desk" element={<JoiningCallDesk />} />
          <Route path="/joining-call-desk.html" element={<Navigate to="/joining-call-desk" replace />} />
          <Route path="/doj-planning" element={<DOJPlanning />} />
          <Route path="/date-of-joining" element={<Navigate to="/doj-planning" replace />} />
          <Route path="/doj-planning.html" element={<Navigate to="/doj-planning" replace />} />
          <Route path="/workforce-analytics" element={<WorkforceAnalytics />} />
          <Route path="/workforce-analytics.html" element={<Navigate to="/workforce-analytics" replace />} />
          <Route path="/openings" element={<Openings />} />
          <Route path="/openings.html" element={<Navigate to="/openings" replace />} />
          <Route path="/broadcast-center" element={<BroadcastCenter />} />
          <Route path="/broadcast-center.html" element={<Navigate to="/broadcast-center" replace />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings.html" element={<Navigate to="/settings" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <QuickActionCenter />
    </Router>
  );
}
