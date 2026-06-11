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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:shadow-lg"
        href="#main-content"
      >
        Skip to content
      </a>

      <LandingHeader
        isAuthenticated={isAuthenticated}
        isLoading={isLoading}
        onLogout={handleLogout}
        workspacePath={workspacePath}
      />

      <main id="main-content">
        <LandingHero />
        <TrendingDocuments />
        <LandingCTA />
      </main>

      <LandingFooter />
    </div>
  );
}
