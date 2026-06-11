import React from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import { PreferencesProvider } from "./contexts/PreferencesContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import AdminRoute from "./components/AdminRoute.jsx";
import LandingHeader from "./components/landing/LandingHeader.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DocumentsPage from "./pages/DocumentsPage.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import AiWorkspacePage from "./pages/AiWorkspacePage.jsx";

function AppRoutes() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const publicAuthRoutes = ["/", "/login", "/forgot-password", "/reset-password"];
  const dashboardShellRoutes = ["/dashboard", "/account", "/documents", "/library", "/ai-workspace"];
  const shouldShowAppNav = !publicAuthRoutes.includes(location.pathname)
    && !dashboardShellRoutes.includes(location.pathname);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <>
      {shouldShowAppNav ? (
        <LandingHeader
          isAuthenticated={isAuthenticated}
          isLoading={isLoading}
          onLogout={handleLogout}
          workspacePath={user?.role === "admin" ? "/admin" : "/dashboard"}
        />
      ) : null}

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <ProtectedRoute>
              <DocumentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/library"
          element={
            <ProtectedRoute>
              <LibraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-workspace"
          element={
            <ProtectedRoute>
              <AiWorkspacePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}
