import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

try {
  const storedTheme = window.localStorage.getItem("ash-theme");
  if (storedTheme === "dark") {
    document.documentElement.classList.add("dark");
  }
} catch {
  // Ignore storage errors.
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
