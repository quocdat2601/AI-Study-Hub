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
        const result = await register({ email: form.email, password: form.password, fullName: form.fullName });

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
    const bubbleType = error
      ? "border-red-200 text-red-800"
      : "border-green-200 text-green-800";
    const bubblePosition = field
      ? "absolute left-0 top-[calc(100%+6px)] z-10 w-full"
      : "absolute left-1/2 top-[118px] z-10 w-[min(400px,calc(100%-48px))] -translate-x-1/2";
    const arrowPosition = field ? "top-[-5px] left-5" : "bottom-[-5px] left-6";

    return (
      <div
        className={`${bubblePosition} animate-[auth-bubble-in_180ms_ease_both] rounded-[10px] border bg-white px-3 py-2 shadow-[0_8px_22px_rgba(48,44,84,0.08)] motion-reduce:animate-none ${bubbleType}`}
        key={`message-${field}-${message}`}
        role="alert"
      >
        <span
          className={`absolute h-2 w-2 rotate-45 border-current bg-white opacity-40 ${field ? "border-l border-t" : "border-b border-r"} ${arrowPosition}`}
          aria-hidden="true"
        />
        <p className="m-0 text-[13px] font-bold leading-[1.35]">{message}</p>
      </div>
    );
  }

  return (
    <main className="relative flex h-screen select-none items-center justify-center overflow-hidden bg-[#f7fbff] bg-[url('/landing/soft-wave-bg.svg')] bg-cover bg-center px-3 pb-3 pt-[58px] text-[#24262d] sm:px-5 sm:pb-[18px]">
      <Link className="absolute left-5 top-[18px] inline-flex text-[#4648d4] no-underline sm:left-7 sm:top-[22px]" to="/">
        <span className="hidden">AI</span>
        <strong className="text-[19px] font-extrabold leading-6">AI Study Hub</strong>
      </Link>

      <section
        className={
          mode === "register"
            ? "relative flex max-h-[calc(100vh-80px)] min-h-0 w-full max-w-[760px] flex-col justify-center rounded-[18px] border border-[#c7c4d7]/45 bg-white px-5 pb-5 pt-6 shadow-[0_20px_58px_rgba(48,44,84,0.11)] transition-[max-width,min-height,padding] duration-200 ease-out sm:min-h-[540px] sm:rounded-[20px] sm:px-[52px] sm:pb-7 sm:pt-8"
            : "relative flex max-h-[calc(100vh-80px)] min-h-0 w-full max-w-[460px] flex-col justify-center rounded-[18px] border border-[#c7c4d7]/45 bg-white px-5 pb-5 pt-6 shadow-[0_20px_58px_rgba(48,44,84,0.11)] transition-[max-width,min-height,padding] duration-200 ease-out sm:min-h-[492px] sm:rounded-[20px] sm:px-10 sm:pb-7 sm:pt-8"
        }
      >
        <header className="mb-[18px] animate-[auth-content-in_180ms_ease_both] text-center motion-reduce:animate-none" key={`header-${mode}`}>
          <h1 className={mode === "register" ? "mx-auto m-0 max-w-[520px] text-[28px] font-extrabold leading-[1.08] tracking-normal sm:text-[32px]" : "m-0 text-[28px] font-extrabold leading-[1.08] tracking-normal sm:text-[32px]"}>
            {mode === "register" ? "Create your study workspace" : "Welcome back"}
          </h1>
          <p className="m-0 mt-2 text-[15px] leading-[1.45] text-[#526173]">
            {mode === "register"
              ? "Save notes, documents, and AI study chats in one place."
              : "Log in to continue to AI Study Hub."}
          </p>
        </header>

        {renderMessage()}

        <form
          className={
            mode === "register"
              ? "mx-auto grid w-full max-w-none animate-[auth-content-in_200ms_ease_35ms_both] grid-cols-1 gap-x-5 gap-y-3 motion-reduce:animate-none md:grid-cols-2"
              : "mx-auto grid w-full max-w-[400px] animate-[auth-content-in_200ms_ease_35ms_both] gap-[11px] motion-reduce:animate-none"
          }
          key={`form-${mode}`}
          onSubmit={submitForm}
        >
          {mode === "register" ? (
            <label className="relative grid gap-2 text-sm font-extrabold text-[#42526a]">
              Full name
              <input
                className="min-h-[46px] select-text rounded-[13px] border border-gray-400 bg-white px-[17px] text-[15px] text-[#172033] outline-none placeholder:text-gray-400 focus:border-[#4d4de1] focus:shadow-[0_0_0_4px_rgba(77,77,225,0.12)]"
                name="fullName"
                type="text"
                value={form.fullName}
                onChange={updateField}
                placeholder="Your full name"
                required
              />
            </label>
          ) : null}

          <label className="relative grid gap-2 text-sm font-extrabold text-[#42526a]">
            Email
            <input
              className="min-h-[46px] select-text rounded-[13px] border border-gray-400 bg-white px-[17px] text-[15px] text-[#172033] outline-none placeholder:text-gray-400 focus:border-[#4d4de1] focus:shadow-[0_0_0_4px_rgba(77,77,225,0.12)]"
              name="email"
              type="email"
              value={form.email}
              onChange={updateField}
              placeholder="you@example.com"
              required
            />
            {renderMessage("email")}
          </label>

          <label className="relative grid gap-2 text-sm font-extrabold text-[#42526a]">
            Password
            <input
              className="min-h-[46px] select-text rounded-[13px] border border-gray-400 bg-white px-[17px] text-[15px] text-[#172033] outline-none placeholder:text-gray-400 focus:border-[#4d4de1] focus:shadow-[0_0_0_4px_rgba(77,77,225,0.12)]"
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
            <label className="relative grid gap-2 text-sm font-extrabold text-[#42526a]">
              Confirm password
              <input
                className="min-h-[46px] select-text rounded-[13px] border border-gray-400 bg-white px-[17px] text-[15px] text-[#172033] outline-none placeholder:text-gray-400 focus:border-[#4d4de1] focus:shadow-[0_0_0_4px_rgba(77,77,225,0.12)]"
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
            <div className="flex items-center justify-between">
              <label className="flex flex-row items-center gap-[9px] text-[13px] font-medium text-[#526173]">
                <input className="h-4 w-4 select-auto p-0" type="checkbox" />
                Remember me
              </label>
              <a className="font-bold text-[#0f62fe] no-underline" href="#forgot">Forgot password?</a>
            </div>
          ) : (
            <label className="col-span-full mx-auto flex max-w-[560px] flex-row items-center gap-[9px] text-left text-[13px] font-medium text-[#526173]">
              <input className="h-4 w-4 select-auto p-0" type="checkbox" required />
              <span>
                I agree to the <a className="font-bold text-[#0f62fe] no-underline" href="#terms">Terms of Service</a> and{" "}
                <a className="font-bold text-[#0f62fe] no-underline" href="#privacy">Privacy Policy</a>
              </span>
            </label>
          )}

          <button
            className="col-span-full mt-0 flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-3 rounded-[14px] border-0 bg-[#4d4de1] text-[15px] font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#eef0f5] disabled:text-[#a8b0bf]"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Please wait..." : mode === "register" ? "Create account" : "Continue"}
          </button>
        </form>

        <div className="mx-auto my-[18px] grid w-full max-w-[460px] grid-cols-[1fr_auto_1fr] items-center gap-[18px] text-[#526173] before:h-px before:bg-[#d9dde6] before:content-[''] after:h-px after:bg-[#d9dde6] after:content-['']">
          <span>OR</span>
        </div>

        <button
          className="mx-auto flex min-h-[46px] w-full max-w-[460px] animate-[auth-content-in_180ms_ease_50ms_both] cursor-pointer items-center justify-center gap-3 rounded-[14px] border border-[#d5d9e1] bg-[#f7f8fa] text-[15px] font-extrabold text-[#172033] motion-reduce:animate-none"
          key={`google-${mode}`}
          type="button"
        >
          <span className="font-black text-[#ea4335]">G</span>
          {mode === "register" ? "Sign up with Google" : "Continue with Google"}
        </button>

        <p className="m-0 mt-[18px] animate-[auth-content-in_180ms_ease_70ms_both] text-center text-sm text-[#42526a] motion-reduce:animate-none" key={`switch-${mode}`}>
          {mode === "register" ? "Already have an account?" : "New to AI Study Hub?"}{" "}
          <button className="cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-[#0f62fe]" type="button" onClick={() => switchMode(mode === "register" ? "login" : "register")}>
            {mode === "register" ? "Log in" : "Create an account"}
          </button>
        </p>
      </section>
    </main>
  );
}
