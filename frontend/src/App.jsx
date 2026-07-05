import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import Planner from './pages/Planner';
import Mentor from './pages/Mentor';
import Notifications from './pages/Notifications';
import CheckEmail from './pages/CheckEmail';
import VerifyEmail from './pages/VerifyEmail';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';
import DSAEngine from './pages/InterviewHub/DSAEngine';
import DSAProblemDetail from './pages/InterviewHub/DSAProblemDetail';
import InterviewQAEngine from './pages/InterviewHub/InterviewQAEngine';
import QuizEngine from './pages/InterviewHub/QuizEngine';
import VaultDashboard from './pages/Vault/VaultDashboard';
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/auth/verify" element={<VerifyEmail />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/mentor" element={<Mentor />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/interview-hub/dsa" element={<DSAEngine />} />
          <Route path="/interview-hub/dsa/:id" element={<DSAProblemDetail />} />
          <Route path="/interview-hub/qa" element={<InterviewQAEngine />} />
          <Route path="/interview-hub/quiz" element={<QuizEngine />} />
          <Route path="/vault" element={<VaultDashboard />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
