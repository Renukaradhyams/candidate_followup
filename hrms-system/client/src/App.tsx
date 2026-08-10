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
const Openings = lazy(() => import('./pages/Openings'));
const Settings = lazy(() => import('./pages/Settings'));
const BroadcastCenter = lazy(() => import('./pages/BroadcastCenter'));
const DepartmentHiring = lazy(() => import('./pages/DepartmentHiring'));
const SectionAllocation = lazy(() => import('./pages/SectionAllocation'));
import QuickActionCenter from './components/ui/QuickActionCenter';

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
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/candidates" element={<Candidates />} />
          <Route path="/candidate-entry" element={<CandidateEntry />} />
          <Route path="/interview-panel" element={<InterviewPanel />} />
          <Route path="/interview-form" element={<InterviewForm />} />
          <Route path="/offer-process" element={<OfferProcess />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/department-hiring" element={<DepartmentHiring />} />
          <Route path="/section-allocation" element={<SectionAllocation />} />
          <Route path="/employee-exit" element={<EmployeeExit />} />
          <Route path="/openings" element={<Openings />} />
          <Route path="/broadcast-center" element={<BroadcastCenter />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <QuickActionCenter />
    </Router>
  );
}
