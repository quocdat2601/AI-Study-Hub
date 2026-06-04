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
    <div className="figma-landing">
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
