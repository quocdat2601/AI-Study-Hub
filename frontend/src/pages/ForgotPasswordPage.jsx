import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

function messageFromError(err) {
  return err.response?.data?.error || err.message || "Something went wrong. Please try again.";
}

function NoticeBubble({ message, tone = "success" }) {
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

export default function ForgotPasswordPage() {
  const { isAuthenticated, isLoading, requestPasswordReset, user } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Navigate to={user?.role === "admin" ? "/admin" : "/dashboard"} replace />;
  }

  async function submitForm(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      setSuccess("If an account exists for that email, a password reset link has been sent.");
    } catch (err) {
      setError(messageFromError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex h-screen select-none items-center justify-center overflow-hidden bg-[#f7fbff] bg-[url('/landing/soft-wave-bg.svg')] bg-cover bg-center px-3 pb-3 pt-[58px] text-[#24262d] sm:px-5 sm:pb-[18px]">
      <Link className="absolute left-5 top-[18px] inline-flex text-[#4648d4] no-underline sm:left-7 sm:top-[22px]" to="/">
        <span className="hidden">AI</span>
        <strong className="text-[19px] font-extrabold leading-6">AI Study Hub</strong>
      </Link>

      <section className="relative flex max-h-[calc(100vh-80px)] min-h-0 w-full max-w-[460px] flex-col justify-center rounded-[18px] border border-[#c7c4d7]/45 bg-white px-5 pb-5 pt-6 shadow-[0_20px_58px_rgba(48,44,84,0.11)] transition-[max-width,min-height,padding] duration-200 ease-out sm:min-h-[492px] sm:rounded-[20px] sm:px-10 sm:pb-7 sm:pt-8">
        <header className="mb-[18px] animate-[auth-content-in_180ms_ease_both] text-center motion-reduce:animate-none">
          <h1 className="m-0 text-[28px] font-extrabold leading-[1.08] tracking-normal sm:text-[32px]">Reset your password</h1>
          <p className="m-0 mt-2 text-[15px] leading-[1.45] text-[#526173]">
            Enter your account email and we will send you a password reset link.
          </p>
        </header>

        {error ? <NoticeBubble message={error} tone="error" /> : null}
        {success ? <NoticeBubble message={success} /> : null}

        <form
          className="mx-auto grid w-full max-w-[400px] animate-[auth-content-in_200ms_ease_35ms_both] gap-[11px] motion-reduce:animate-none"
          onSubmit={submitForm}
        >
          <label className="relative grid gap-2 text-sm font-extrabold text-[#42526a]">
            Email
            <input
              className="min-h-[46px] select-text rounded-[13px] border border-gray-400 bg-white px-[17px] text-[15px] text-[#172033] outline-none placeholder:text-gray-400 focus:border-[#4d4de1] focus:shadow-[0_0_0_4px_rgba(77,77,225,0.12)]"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <button
            className="mt-0 flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-3 rounded-[14px] border-0 bg-[#4d4de1] text-[15px] font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#eef0f5] disabled:text-[#a8b0bf]"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p className="m-0 mt-[18px] animate-[auth-content-in_180ms_ease_70ms_both] text-center text-sm text-[#42526a] motion-reduce:animate-none">
          Remembered your password?{" "}
          <Link className="font-bold text-[#0f62fe] no-underline" to="/login">
            Back to login
          </Link>
        </p>
      </section>
    </main>
  );
}
