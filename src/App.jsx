import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Rooms from "./pages/Rooms";
import OfflineMode from "./pages/OfflineMode";
import WheelOfNames from "./pages/WheelOfNames";
import CountdownClock from "./pages/CountdownClock";
import Subscription from "./pages/Subscription";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import VerifyEmail from "./pages/VerifyEmail";
import ResetPassword from "./pages/ResetPassword";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/offline-mode" element={<OfflineMode />} />
        <Route path="/wheel-of-names" element={<WheelOfNames />} />
        <Route path="/countdown-clock" element={<CountdownClock />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Layout>
  );
}
