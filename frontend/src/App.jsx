import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import AdminRoute from "./components/AdminRoute.jsx";
import LandingHeader from "./components/landing/LandingHeader.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DocumentsPage from "./pages/DocumentsPage.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";

function AppRoutes() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const location = useLocation();
  const publicAuthRoutes = ["/", "/login", "/forgot-password", "/reset-password"];
  const dashboardShellRoutes = ["/dashboard"];
  const shouldShowAppNav = !publicAuthRoutes.includes(location.pathname)
    && !dashboardShellRoutes.includes(location.pathname);

  return (
    <>
      {shouldShowAppNav ? (
        <LandingHeader
          isAuthenticated={isAuthenticated}
          isLoading={isLoading}
          onLogout={logout}
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
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
