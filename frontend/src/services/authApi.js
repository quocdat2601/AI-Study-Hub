import { supabase } from "../lib/supabase.js";

const RECOVERY_FLAG_KEY = "auth:password_recovery";

function safeSessionStorage(action, fallback = null) {
  try {
    return action(window.sessionStorage);
  } catch {
    return fallback;
  }
}

export function hasRecoveryParams(locationLike = window.location) {
  const hashParams = new URLSearchParams(String(locationLike.hash || "").replace(/^#/, ""));
  const searchParams = new URLSearchParams(locationLike.search || "");
  const recoveryType = hashParams.get("type") || searchParams.get("type");

  return recoveryType === "recovery";
}

export function markRecoveryMode() {
  safeSessionStorage((storage) => storage.setItem(RECOVERY_FLAG_KEY, "1"));
}

export function clearRecoveryMode() {
  safeSessionStorage((storage) => storage.removeItem(RECOVERY_FLAG_KEY));
}

export function hasRecoveryContext(locationLike = window.location) {
  return hasRecoveryParams(locationLike) || safeSessionStorage((storage) => storage.getItem(RECOVERY_FLAG_KEY) === "1", false);
}

export async function getAuthSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  return data.session;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function loginWithPassword(credentials) {
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error) {
    throw error;
  }

  return data;
}

export async function loginWithGoogle() {
  const redirectTo = new URL("/login", window.location.origin).toString();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function registerWithPassword(details) {
  const { fullName, ...credentials } = details;
  const { data, error } = await supabase.auth.signUp({
    ...credentials,
    options: fullName
      ? {
          data: {
            name: fullName,
            full_name: fullName,
          },
        }
      : undefined,
  });
  if (error) {
    throw error;
  }

  return data;
}

export async function logoutAuth() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function requestPasswordResetEmail(email, redirectTo) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) {
    throw error;
  }

  return data;
}

export async function updateUserPassword(password) {
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw error;
  }

  return data;
}
