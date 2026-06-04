import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import AdminRoute from "./components/AdminRoute.jsx";
import LandingHeader from "./components/landing/LandingHeader.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";

function AppRoutes() {
  const { isAuthenticated, logout, user } = useAuth();
  const location = useLocation();
  const shouldShowAppNav = !["/", "/login"].includes(location.pathname);

  return (
    <>
      {shouldShowAppNav ? (
        <LandingHeader
          isAdmin={user?.role === "admin"}
          isAuthenticated={isAuthenticated}
          onLogout={logout}
          showAppLinks
          workspacePath={user?.role === "admin" ? "/admin" : "/dashboard"}
        />
      ) : null}

      <Routes>
        <Route path="/" element={<LandingPage />} />
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
