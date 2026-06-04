import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

function messageFromError(err) {
  return err.response?.data?.error || err.message || "Something went wrong. Please try again.";
}

function NoticeBubble({ message, tone = "error" }) {
  const bubbleTone = tone === "error" ? "border-red-200 text-red-800" : "border-green-200 text-green-800";

  return (
    <div
      className={`relative mx-auto mb-4 w-full max-w-[400px] animate-[auth-bubble-in_180ms_ease_both] rounded-[10px] border bg-white px-3 py-2 shadow-[0_8px_22px_rgba(48,44,84,0.08)] motion-reduce:animate-none ${bubbleTone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <span
        className="absolute bottom-[-5px] left-6 h-2 w-2 rotate-45 border-b border-r border-current bg-white opacity-40"
        aria-hidden="true"
      />
      <p className="m-0 text-[13px] font-bold leading-[1.35]">{message}</p>
    </div>
  );
}

function AuthShell({ children }) {
  return (
    <main className="relative flex h-screen select-none items-center justify-center overflow-hidden bg-[#f7fbff] bg-[url('/landing/soft-wave-bg.svg')] bg-cover bg-center px-3 pb-3 pt-[58px] text-[#24262d] sm:px-5 sm:pb-[18px]">
      <Link className="absolute left-5 top-[18px] inline-flex text-[#4648d4] no-underline sm:left-7 sm:top-[22px]" to="/">
        <span className="hidden">AI</span>
        <strong className="text-[19px] font-extrabold leading-6">AI Study Hub</strong>
      </Link>
      {children}
    </main>
  );
}

export default function ResetPasswordPage() {
  const { hasSession, isLoading, isRecoveryMode, logout, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submitForm(event) {
    event.preventDefault();
    setError("");

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      await updatePassword(form.password);
      await logout();
      navigate("/login", {
        replace: true,
        state: { authMessage: "Password updated successfully. Please log in with your new password." },
      });
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isLoading && (!isRecoveryMode || !hasSession)) {
    return (
      <AuthShell>
        <section className="relative flex max-h-[calc(100vh-80px)] min-h-0 w-full max-w-[460px] flex-col justify-center rounded-[18px] border border-[#c7c4d7]/45 bg-white px-5 pb-5 pt-6 shadow-[0_20px_58px_rgba(48,44,84,0.11)] transition-[max-width,min-height,padding] duration-200 ease-out sm:min-h-[492px] sm:rounded-[20px] sm:px-10 sm:pb-7 sm:pt-8">
          <header className="mb-[18px] animate-[auth-content-in_180ms_ease_both] text-center motion-reduce:animate-none">
            <h1 className="m-0 text-[28px] font-extrabold leading-[1.08] tracking-normal sm:text-[32px]">Reset link unavailable</h1>
            <p className="m-0 mt-2 text-[15px] leading-[1.45] text-[#526173]">
              Your password recovery link is invalid or has expired. Request a new one to continue.
            </p>
          </header>

          <NoticeBubble message="We could not verify your recovery session." />

          <p className="m-0 mt-[18px] animate-[auth-content-in_180ms_ease_70ms_both] text-center text-sm text-[#42526a] motion-reduce:animate-none">
            <Link className="font-bold text-[#0f62fe] no-underline" to="/forgot-password">
              Request a new reset link
            </Link>
          </p>
        </section>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <section className="relative flex max-h-[calc(100vh-80px)] min-h-0 w-full max-w-[460px] flex-col justify-center rounded-[18px] border border-[#c7c4d7]/45 bg-white px-5 pb-5 pt-6 shadow-[0_20px_58px_rgba(48,44,84,0.11)] transition-[max-width,min-height,padding] duration-200 ease-out sm:min-h-[492px] sm:rounded-[20px] sm:px-10 sm:pb-7 sm:pt-8">
        <header className="mb-[18px] animate-[auth-content-in_180ms_ease_both] text-center motion-reduce:animate-none">
          <h1 className="m-0 text-[28px] font-extrabold leading-[1.08] tracking-normal sm:text-[32px]">Create a new password</h1>
          <p className="m-0 mt-2 text-[15px] leading-[1.45] text-[#526173]">
            Choose a strong new password for your AI Study Hub account.
          </p>
        </header>

        {error ? <NoticeBubble message={error} /> : null}

        <form
          className="mx-auto grid w-full max-w-[400px] animate-[auth-content-in_200ms_ease_35ms_both] gap-[11px] motion-reduce:animate-none"
          onSubmit={submitForm}
        >
          <label className="relative grid gap-2 text-sm font-extrabold text-[#42526a]">
            New password
            <input
              className="min-h-[46px] select-text rounded-[13px] border border-gray-400 bg-white px-[17px] text-[15px] text-[#172033] outline-none placeholder:text-gray-400 focus:border-[#4d4de1] focus:shadow-[0_0_0_4px_rgba(77,77,225,0.12)]"
              name="password"
              type="password"
              value={form.password}
              onChange={updateField}
              placeholder="Create a new password"
              required
            />
          </label>

          <label className="relative grid gap-2 text-sm font-extrabold text-[#42526a]">
            Confirm new password
            <input
              className="min-h-[46px] select-text rounded-[13px] border border-gray-400 bg-white px-[17px] text-[15px] text-[#172033] outline-none placeholder:text-gray-400 focus:border-[#4d4de1] focus:shadow-[0_0_0_4px_rgba(77,77,225,0.12)]"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={updateField}
              placeholder="Confirm your new password"
              required
            />
          </label>

          <button
            className="mt-0 flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-3 rounded-[14px] border-0 bg-[#4d4de1] text-[15px] font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#eef0f5] disabled:text-[#a8b0bf]"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Updating..." : "Update password"}
          </button>
        </form>
      </section>
    </AuthShell>
  );
}
