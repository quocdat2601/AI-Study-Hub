import React from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import LandingCTA from "../components/landing/LandingCTA.jsx";
import LandingFooter from "../components/landing/LandingFooter.jsx";
import LandingHeader from "../components/landing/LandingHeader.jsx";
import LandingHero from "../components/landing/LandingHero.jsx";
import TrendingDocuments from "../components/landing/TrendingDocuments.jsx";

export default function LandingPage() {
  const { isAuthenticated, user } = useAuth();
  const workspacePath = user?.role === "admin" ? "/admin" : "/dashboard";

  return (
    <div className="min-h-screen text-[#191c1e]" style={{ background: "#f7f9fb url('/landing/soft-wave-bg.svg') center top / cover fixed" }}>
      <LandingHeader isAuthenticated={isAuthenticated} workspacePath={workspacePath} />
      <main>
        <LandingHero />
        <TrendingDocuments />
        <LandingCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
