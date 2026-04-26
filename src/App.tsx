import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { DataManagementPage } from "@/pages/DataManagementPage";
import { AuthGate } from "@/components/auth/AuthGate";
import { shouldUseMock } from "@/lib/dataverse";
import { isAuthConfigured } from "@/lib/auth/msal";

export default function App() {
  // Auth required when:
  //   - VITE_USE_MOCK=false (we're hitting real Dataverse)
  //   - AND auth env vars are configured (otherwise we can't login anyway)
  // In dev with VITE_USE_MOCK=true, the gate is bypassed entirely.
  const requireAuth = !shouldUseMock() && isAuthConfigured;

  const shellTree = (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectsPage />} />
        <Route path="data" element={<DataManagementPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );

  return requireAuth ? <AuthGate>{shellTree}</AuthGate> : shellTree;
}
