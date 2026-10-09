import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "@/auth/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import AuditLog from "@/pages/AuditLog";
import FeatureFlags from "@/pages/FeatureFlags";
import KycDetail from "@/pages/KycDetail";
import KycQueue from "@/pages/KycQueue";
import Login from "@/pages/Login";
import Refunds from "@/pages/Refunds";

function Protected({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();
  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route path="/" element={<Navigate to="/kyc" replace />} />
        <Route path="/kyc" element={<KycQueue />} />
        <Route path="/kyc/:id" element={<KycDetail />} />
        <Route path="/refunds" element={<Refunds />} />
        <Route path="/flags" element={<FeatureFlags />} />
        <Route path="/audit" element={<AuditLog />} />
      </Route>
      <Route path="*" element={<Navigate to="/kyc" replace />} />
    </Routes>
  );
}
