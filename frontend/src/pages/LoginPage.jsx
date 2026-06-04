import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

function messageFromError(err) {
  return err.response?.data?.error || err.message || "Something went wrong. Please try again.";
}

export default function LoginPage() {
  const { isAuthenticated, isLoading, login, register, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialMode = searchParams.get("mode") === "register" ? "register" : "login";
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [messageField, setMessageField] = useState("");
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
    setMessageField("");
    setSuccess("");
    setSearchParams(nextMode === "register" ? { mode: "register" } : {});
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submitForm(event) {
    event.preventDefault();
    setError("");
    setMessageField("");
    setSuccess("");

    if (mode === "register") {
      if (form.password.length < 8) {
        setError("Password must be at least 8 characters");
        setMessageField("password");
        return;
      }

      if (form.password !== form.confirmPassword) {
        setError("Passwords do not match");
        setMessageField("confirmPassword");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === "register") {
        const result = await register({ email: form.email, password: form.password });

        if (result.requiresEmailConfirmation) {
          setForm({ fullName: "", email: form.email, password: "", confirmPassword: "" });
          switchMode("login");
          setSuccess("Account created. Check your email to confirm your account, then log in.");
        } else {
          navigate(result.user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
        }
      } else {
        const loggedInUser = await login({ email: form.email, password: form.password });
        navigate(loggedInUser.role === "admin" ? "/admin" : "/dashboard", { replace: true });
      }
    } catch (err) {
      const nextError = messageFromError(err);
      setError(nextError);
      setMessageField(mode === "login" ? "" : "password");
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderMessage(field = "") {
    const message = error || success;
    if (!message) return null;
    if (field !== messageField) return null;

    return (
      <div
        className={
          error
            ? "simple-auth__bubble simple-auth__bubble--error simple-auth__bubble--field"
            : "simple-auth__bubble simple-auth__bubble--success simple-auth__bubble--field"
        }
        key={`message-${field}-${message}`}
        role="alert"
      >
        <p>{message}</p>
      </div>
    );
  }

  return (
    <main className="simple-auth">
      <Link className="simple-auth__brand" to="/">
        <span>AI</span>
        <strong>AI Study Hub</strong>
      </Link>

      <section className={mode === "register" ? "simple-auth__card simple-auth__card--register" : "simple-auth__card"}>
        <header className="simple-auth__header" key={`header-${mode}`}>
          <h1>{mode === "register" ? "Create your study workspace" : "Welcome back"}</h1>
          <p>
            {mode === "register"
              ? "Save notes, documents, and AI study chats in one place."
              : "Log in to continue to AI Study Hub."}
          </p>
        </header>

        {renderMessage()}

        <form
          className={mode === "register" ? "simple-auth__form simple-auth__form--register" : "simple-auth__form"}
          key={`form-${mode}`}
          onSubmit={submitForm}
        >
          {mode === "register" ? (
            <label className="simple-auth__field">
              Full name
              <input
                name="fullName"
                type="text"
                value={form.fullName}
                onChange={updateField}
                placeholder="Your full name"
                required
              />
            </label>
          ) : null}

          <label className="simple-auth__field">
            Email
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={updateField}
              placeholder="you@example.com"
                  required
                />
            {renderMessage("email")}
          </label>

          <label className="simple-auth__field">
            Password
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={updateField}
              placeholder={mode === "register" ? "Create a password" : "Your password"}
                  required
                />
            {renderMessage("password")}
          </label>

          {mode === "register" ? (
            <label className="simple-auth__field">
              Confirm password
                <input
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={updateField}
                placeholder="Confirm your password"
                required
                />
              {renderMessage("confirmPassword")}
            </label>
          ) : null}

          {mode === "login" ? (
            <div className="simple-auth__options">
              <label className="simple-auth__check">
                <input type="checkbox" />
                Remember me
              </label>
              <a href="#forgot">Forgot password?</a>
            </div>
          ) : (
            <label className="simple-auth__check">
              <input type="checkbox" required />
              <span>
                I agree to the <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>
              </span>
            </label>
          )}

          <button className="simple-auth__submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Please wait..." : mode === "register" ? "Create account" : "Continue"}
            </button>
          </form>

        <div className="simple-auth__divider">
          <span>OR</span>
        </div>

        <button className="simple-auth__google" key={`google-${mode}`} type="button">
          <span>G</span>
          {mode === "register" ? "Sign up with Google" : "Continue with Google"}
        </button>

        <p className="simple-auth__switch" key={`switch-${mode}`}>
          {mode === "register" ? "Already have an account?" : "New to AI Study Hub?"}{" "}
          <button type="button" onClick={() => switchMode(mode === "register" ? "login" : "register")}>
            {mode === "register" ? "Log in" : "Create an account"}
          </button>
        </p>
      </section>
    </main>
  );
}
