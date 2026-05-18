import React from "react";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <main className="page">
      <p className="eyebrow">Dashboard</p>
      <h1>Welcome, {user?.email}</h1>
      <p>Document analytics and recent activity will appear here in the next build.</p>
    </main>
  );
}
