import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api.js";
import { supabase } from "../lib/supabase.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const manualAuthInProgressRef = useRef(false);
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  async function loadCurrentUser(accessToken) {
    const response = await api.get("/auth/me", accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined);

    return response.data.user || response.data;
  }

  useEffect(() => {
    let isMounted = true;

    async function hydrateFromSession(session) {
      try {
        if (!session?.access_token) {
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
        await supabase.auth.signOut();
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    async function initializeAuth() {
      const { data } = await supabase.auth.getSession();
      await hydrateFromSession(data.session);
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      if (event === "SIGNED_IN" && manualAuthInProgressRef.current) {
        return;
      }

      if (event === "TOKEN_REFRESHED" && userRef.current) {
        setIsLoading(false);
        return;
      }

      if (isMounted) {
        setIsLoading(true);
      }
      await hydrateFromSession(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function login(credentials) {
    manualAuthInProgressRef.current = true;

    try {
      const { data, error } = await supabase.auth.signInWithPassword(credentials);

      if (error) {
        throw error;
      }

      const currentUser = await loadCurrentUser(data.session.access_token);
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
      const { data, error } = await supabase.auth.signUp({
        ...details,
        options: {
          data: {
            name: details.fullName,
            full_name: details.fullName,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (!data.session?.access_token) {
        setIsLoading(false);
        return {
          user: data.user,
          requiresEmailConfirmation: true,
        };
      }

      const currentUser = await loadCurrentUser(data.session.access_token);
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

  function logout() {
    setUser(null);
    setIsLoading(false);
    supabase.auth.signOut().catch(() => {
      // Local auth is already cleared; the next session refresh will reconcile remote state.
    });
  }

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
    }),
    [user, isLoading]
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
