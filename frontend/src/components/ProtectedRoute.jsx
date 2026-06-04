import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import RouteSkeleton from "./RouteSkeleton.jsx";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    const variant = location.pathname.startsWith("/dashboard")
      ? "dashboard"
      : location.pathname.startsWith("/admin")
        ? "admin"
        : location.pathname.startsWith("/library")
          ? "library"
          : "page";

    return <RouteSkeleton variant={variant} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
