import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api.js";
import { supabase } from "../lib/supabase.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
    const { data, error } = await supabase.auth.signInWithPassword(credentials);

    if (error) {
      throw error;
    }

    const currentUser = await loadCurrentUser(data.session.access_token);
    setUser(currentUser);
    return currentUser;
  }

  async function register(details) {
    const { data, error } = await supabase.auth.signUp(details);

    if (error) {
      throw error;
    }

    if (!data.session?.access_token) {
      return {
        user: data.user,
        requiresEmailConfirmation: true,
      };
    }

    const currentUser = await loadCurrentUser(data.session.access_token);
    setUser(currentUser);

    return {
      user: currentUser,
      requiresEmailConfirmation: false,
    };
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
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
