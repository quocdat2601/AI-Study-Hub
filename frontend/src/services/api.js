import axios from 'axios';
import { supabase } from '../lib/supabase.js';
import { clearStaleAuthSession, isInvalidRefreshTokenError } from './authApi.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS) || 120000,
});

api.interceptors.request.use(async (config) => {
  const existingAuth = config.headers?.Authorization || config.headers?.authorization;
  if (existingAuth) {
    return config;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      if (isInvalidRefreshTokenError(error)) {
        await clearStaleAuthSession();
      }
      return config;
    }

    const token = data.session?.access_token;
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    if (isInvalidRefreshTokenError(err)) {
      await clearStaleAuthSession();
    }
  }

  return config;
});

async function redirectToLogin() {
  await clearStaleAuthSession();
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && error.config?.url !== "/auth/me" && !error.config?.suppressAuthRedirect) {
      const originalRequest = error.config || {};

      try {
        const authCode = error.response?.data?.code;
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          if (isInvalidRefreshTokenError(sessionError)) {
            await redirectToLogin();
          }
          return Promise.reject(error);
        }

        const token = data.session?.access_token;
        if (token && !originalRequest._authRetry) {
          originalRequest._authRetry = true;
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }

        if (token && originalRequest._authRetry && authCode === "AUTH_INVALID_OR_EXPIRED_TOKEN") {
          await redirectToLogin();
        }

        if (!token) {
          await redirectToLogin();
        }
      } catch {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
