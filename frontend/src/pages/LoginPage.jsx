import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

function messageFromError(err) {
  return err.response?.data?.error || "Something went wrong. Please try again.";
}

export default function LoginPage() {
  const { isAuthenticated, isLoading, login, register, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMode(searchParams.get("mode") === "register" ? "register" : "login");
  }, [searchParams]);

  const destination = useMemo(() => {
    if (location.state?.from?.pathname) return location.state.from.pathname;
    return user?.role === "admin" ? "/admin" : "/dashboard";
  }, [location.state, user]);

  if (!isLoading && isAuthenticated) {
    return <Navigate to={destination} replace />;
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setSearchParams(nextMode === "register" ? { mode: "register" } : {});
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submitForm(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (mode === "register") {
      if (form.password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }

      if (form.password !== form.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === "register") {
        await register({ email: form.email, password: form.password });
        setForm({ email: form.email, password: "", confirmPassword: "" });
        switchMode("login");
        setSuccess("Account created. You can log in now.");
      } else {
        const loggedInUser = await login({ email: form.email, password: form.password });
        navigate(loggedInUser.role === "admin" ? "/admin" : "/dashboard", { replace: true });
      }
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="back-link" to="/">
          AI Study Hub
        </Link>
        <h1>{mode === "register" ? "Create your account" : "Welcome back"}</h1>
        <p className="muted">
          {mode === "register"
            ? "Register with your email to start storing study materials."
            : "Log in to access your study workspace."}
        </p>

        <div className="mode-switch">
          <button className={mode === "login" ? "mode-switch__item active" : "mode-switch__item"} onClick={() => switchMode("login")}>
            Login
          </button>
          <button
            className={mode === "register" ? "mode-switch__item active" : "mode-switch__item"}
            onClick={() => switchMode("register")}
          >
            Register
          </button>
        </div>

        {error ? <div className="alert alert--error">{error}</div> : null}
        {success ? <div className="alert alert--success">{success}</div> : null}

        <form className="stack-form" onSubmit={submitForm}>
          <label>
            Email
            <input name="email" type="email" value={form.email} onChange={updateField} required />
          </label>
          <label>
            Password
            <input name="password" type="password" value={form.password} onChange={updateField} required />
          </label>
          {mode === "register" ? (
            <label>
              Confirm password
              <input
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={updateField}
                required
              />
            </label>
          ) : null}
          <button className="button button--primary button--full" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Please wait..." : mode === "register" ? "Create account" : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}
