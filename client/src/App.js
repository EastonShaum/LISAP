import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import PasswordPage from "./pages/Password";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ManagePhones from "./pages/ManagePhones";
import Onboarding from "./pages/Onboarding";
import Join from "./pages/Join";

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<PasswordPage />} />
        <Route path="/login" element={<Login navigateTo="/onboarding" />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/join/:ownerTag" element={<Join />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/managephones" element={<ManagePhones />} />
      </Routes>
    </Router>
  );
}

export default App;