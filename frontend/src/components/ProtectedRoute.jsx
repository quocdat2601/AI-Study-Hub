import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import RouteSkeleton from "./RouteSkeleton.jsx";

const STUDENT_ONLY_PREFIXES = [
  "/dashboard",
  "/documents",
  "/library",
  "/workspace",
  "/public-documents",
  "/shared",
  "/onboarding",
];

function isStudentOnlyPath(pathname) {
  return STUDENT_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

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

  if (user?.role === "admin" && isStudentOnlyPath(location.pathname)) {
    return <Navigate to="/admin" replace />;
  }

  if (user && user.role !== "admin" && !user.onboarded && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}
