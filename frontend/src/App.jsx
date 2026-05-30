import React from "react";
import { BrowserRouter, Routes, Route, Link, NavLink } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import AdminRoute from "./components/AdminRoute.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import ChatSessionsPage from "./pages/ChatSessionsPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";

function Navigation() {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <nav className="nav">
      <Link className="brand" to="/">
        AI Study Hub
      </Link>
      <div className="nav__links">
        {isAuthenticated ? (
          <>
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/library">Library</NavLink>
            <NavLink to="/chat">Chat</NavLink>
            {user?.role === "admin" ? <NavLink to="/admin">Admin</NavLink> : null}
            <button className="nav__button" onClick={logout} type="button">
              Logout
            </button>
          </>
        ) : (
          <NavLink to="/login">Login / Register</NavLink>
        )}
      </div>
    </nav>
  );
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Navigation />

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
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatSessionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:sessionId"
          element={
            <ProtectedRoute>
              <ChatPage />
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
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
