import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";
import OfficialRace from "./pages/OfficialRace";
import History from "./pages/History";
import Credits from "./pages/Credits";
import Checkout from "./pages/Checkout";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Verify from "./pages/Verify";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/race/:id" element={<OfficialRace />} />
        <Route path="/race" element={<OfficialRace />} />
        <Route path="/history" element={<History />} />
        <Route path="/verify/:id" element={<Verify />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/credits" element={<Credits />} />
        <Route path="/checkout/:paymentId" element={<Checkout />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
