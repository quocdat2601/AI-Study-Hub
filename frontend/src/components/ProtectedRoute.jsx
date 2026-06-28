import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import RouteSkeleton from "./RouteSkeleton.jsx";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading && !isAuthenticated) {
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

  // User mới (không phải admin) chưa hoàn tất onboarding → ép qua /onboarding
  if (user && user.role !== "admin" && !user.onboarded && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}
