import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";

export default function AdminRoute({ children }) {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      {user?.role === "admin" ? children : <Navigate to="/dashboard" replace />}
    </ProtectedRoute>
  );
}
