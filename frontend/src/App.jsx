import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <nav className="nav">
        <Link to="/">Dashboard</Link>
        <Link to="/library">Library</Link>
        <Link to="/login">Login</Link>
      </nav>

      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}