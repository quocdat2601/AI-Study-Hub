import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api.js";
import {
  clearRecoveryMode,
  getAuthSession,
  hasRecoveryContext,
  loginWithPassword,
  logoutAuth,
  markRecoveryMode,
  onAuthStateChange,
  registerWithPassword,
  requestPasswordResetEmail,
  updateUserPassword,
} from "../services/authApi.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [hasSession, setHasSession] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => hasRecoveryContext());
  const [isLoading, setIsLoading] = useState(true);
  const manualAuthInProgressRef = useRef(false);
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  async function loadCurrentUser(accessToken) {
    const response = await api.get(
      "/auth/me",
      accessToken
        ? {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        : undefined
    );

    return response.data.user || response.data;
  }

  useEffect(() => {
    let isMounted = true;

    async function hydrateFromSession(session, recoveryMode = hasRecoveryContext()) {
      try {
        if (!session?.access_token) {
          if (isMounted) {
            setUser(null);
            setHasSession(false);
            setIsRecoveryMode(recoveryMode);
          }
          return;
        }

        if (isMounted) {
          setHasSession(true);
          setIsRecoveryMode(recoveryMode);
        }

        if (recoveryMode) {
          if (isMounted) {
            setUser(null);
          }
          return;
        }

        const currentUser = await loadCurrentUser(session.access_token);
        if (isMounted) {
          setUser(currentUser);
        }
      } catch (err) {
        await logoutAuth().catch(() => {});
        if (isMounted) {
          setUser(null);
          setHasSession(false);
          setIsRecoveryMode(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    async function initializeAuth() {
      const session = await getAuthSession();
      await hydrateFromSession(session, hasRecoveryContext());
    }

    initializeAuth();

    const {
      data: { subscription },
    } = onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        markRecoveryMode();
      }

      if (event === "SIGNED_OUT") {
        clearRecoveryMode();
        if (isMounted) {
          setUser(null);
          setHasSession(false);
          setIsRecoveryMode(false);
          setIsLoading(false);
        }
        return;
      }

      if (event === "SIGNED_IN" && manualAuthInProgressRef.current) {
        return;
      }

      if (event === "TOKEN_REFRESHED" && userRef.current && !hasRecoveryContext()) {
        if (isMounted) {
          setHasSession(true);
          setIsRecoveryMode(false);
          setIsLoading(false);
        }
        return;
      }

      if (isMounted) {
        setIsLoading(true);
      }

      await hydrateFromSession(session, hasRecoveryContext());
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function login(credentials) {
    clearRecoveryMode();
    setIsRecoveryMode(false);
    manualAuthInProgressRef.current = true;

    try {
      const data = await loginWithPassword(credentials);
      const currentUser = await loadCurrentUser(data.session.access_token);
      setHasSession(true);
      setUser(currentUser);
      setIsLoading(false);
      return currentUser;
    } finally {
      manualAuthInProgressRef.current = false;
    }
  }

  async function register(details) {
    manualAuthInProgressRef.current = true;

    try {
      const data = await registerWithPassword(details);

      if (!data.session?.access_token) {
        setHasSession(false);
        setIsLoading(false);
        return {
          user: data.user,
          requiresEmailConfirmation: true,
        };
      }

      const currentUser = await loadCurrentUser(data.session.access_token);
      setHasSession(true);
      setIsRecoveryMode(false);
      setUser(currentUser);
      setIsLoading(false);

      return {
        user: currentUser,
        requiresEmailConfirmation: false,
      };
    } finally {
      manualAuthInProgressRef.current = false;
    }
  }

  async function requestPasswordReset(email) {
    const redirectTo = new URL("/reset-password", window.location.origin).toString();
    await requestPasswordResetEmail(email, redirectTo);
  }

  async function updatePassword(newPassword) {
    await updateUserPassword(newPassword);
  }

  async function logout() {
    clearRecoveryMode();
    setUser(null);
    setHasSession(false);
    setIsRecoveryMode(false);
    setIsLoading(false);
    await logoutAuth().catch(() => {});
  }

  async function refreshUser() {
    const session = await getAuthSession();
    if (!session?.access_token) {
      setUser(null);
      setHasSession(false);
      return null;
    }

    const currentUser = await loadCurrentUser(session.access_token);
    setUser(currentUser);
    setHasSession(true);
    return currentUser;
  }

  const value = useMemo(
    () => ({
      user,
      hasSession,
      isLoading,
      isRecoveryMode,
      isAuthenticated: Boolean(user),
      login,
      register,
      requestPasswordReset,
      updatePassword,
      logout,
      refreshUser,
    }),
    [user, hasSession, isLoading, isRecoveryMode]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
