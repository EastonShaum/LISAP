import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import Overview from "./pages/Overview";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Join from "./pages/Join";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <Router>
      <a className="skip" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/join/:ownerTag" element={<Join />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </Router>
  );
}
