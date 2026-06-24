import React from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import { PreferencesProvider } from "./contexts/PreferencesContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import { UploadDocProvider } from "./contexts/UploadDocContext.jsx";
import AdminRoute from "./components/AdminRoute.jsx";
import LandingHeader from "./components/landing/LandingHeader.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import AccountPage from "./pages/AccountPage.jsx";
import CommunityPage from "./pages/CommunityPage.jsx";
import CommunityCreatePostPage from "./pages/CommunityCreatePostPage.jsx";
import CommunityPostDetailPage from "./pages/CommunityPostDetailPage.jsx";
import CommunityUserProfilePage from "./pages/CommunityUserProfilePage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DocumentsPage from "./pages/DocumentsPage.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import WorkspacePage from "./pages/WorkspacePage.jsx";
import PublicDocumentsCatalogPage from "./pages/PublicDocumentsCatalogPage.jsx";
import PublicDocumentDetailPage from "./pages/PublicDocumentDetailPage.jsx";

function AppRoutes() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const publicAuthRoutes = ["/", "/login", "/forgot-password", "/reset-password"];
  const dashboardShellRoutes = ["/dashboard", "/account", "/documents", "/library", "/admin"];
  const shouldShowAppNav = !publicAuthRoutes.includes(location.pathname)
    && !dashboardShellRoutes.includes(location.pathname)
    && !location.pathname.startsWith("/public-documents");

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
          element={
            <ProtectedRoute>
              <CommunityCreatePostPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/community/posts/:id"
          element={<CommunityPostDetailPage />}
        />
        <Route
          path="/community/users/:userId"
          element={<CommunityUserProfilePage />}
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
          path="/workspace"
          element={
            <ProtectedRoute>
              <WorkspacePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/public-documents"
          element={
            <ProtectedRoute>
              <PublicDocumentsCatalogPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/public-documents/:id"
          element={
            <ProtectedRoute>
              <PublicDocumentDetailPage />
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
            <UploadDocProvider>
              <AppRoutes />
            </UploadDocProvider>
          </BrowserRouter>
        </ToastProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}
