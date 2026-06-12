import React from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import AdminRoute from "./components/AdminRoute.jsx";
import LandingHeader from "./components/landing/LandingHeader.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import CommunityPage from "./pages/CommunityPage.jsx";
import CommunityCreatePostPage from "./pages/CommunityCreatePostPage.jsx";
import CommunityPostDetailPage from "./pages/CommunityPostDetailPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";

function AppRoutes() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const publicAuthRoutes = ["/", "/login", "/forgot-password", "/reset-password"];
  const shouldShowAppNav = !publicAuthRoutes.includes(location.pathname);
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
          path="/community"
          element={<CommunityPage />}
        />
        <Route
          path="/community/subjects/:code"
          element={<CommunityPage />}
        />
        <Route
          path="/community/new"
          element={<CommunityCreatePostPage />}
        />
        <Route
          path="/community/posts/:id"
          element={<CommunityPostDetailPage />}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
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
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
