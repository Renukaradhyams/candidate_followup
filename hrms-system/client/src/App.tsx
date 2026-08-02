import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CandidateEntry from './pages/CandidateEntry';
import Candidates from './pages/Candidates';
import InterviewPanel from './pages/InterviewPanel';
import InterviewForm from './pages/InterviewForm';
import OfferProcess from './pages/OfferProcess';
import Onboarding from './pages/Onboarding';
import EmployeeExit from './pages/EmployeeExit';
import Openings from './pages/Openings';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Router>
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
        <Route path="/employee-exit" element={<EmployeeExit />} />
        <Route path="/openings" element={<Openings />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

