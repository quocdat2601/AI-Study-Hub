import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import LandingCTA from "../components/landing/LandingCTA.jsx";
import LandingFooter from "../components/landing/LandingFooter.jsx";
import LandingHeader from "../components/landing/LandingHeader.jsx";
import LandingHero from "../components/landing/LandingHero.jsx";
import TrendingDocuments from "../components/landing/TrendingDocuments.jsx";

export default function LandingPage() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const navigate = useNavigate();
  const workspacePath = user?.role === "admin" ? "/admin" : "/dashboard";

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen text-[#191c1e]" style={{ background: "#f7f9fb url('/landing/soft-wave-bg.svg') center top / cover fixed" }}>
      <LandingHeader
        isAuthenticated={isAuthenticated}
        isLoading={isLoading}
        onLogout={handleLogout}
        workspacePath={workspacePath}
      />
      <main>
        <LandingHero />
        <TrendingDocuments />
        <LandingCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
