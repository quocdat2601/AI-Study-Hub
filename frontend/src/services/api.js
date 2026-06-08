import axios from 'axios';
import { supabase } from '../lib/supabase.js';
import { clearStaleAuthSession } from './authApi.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  const existingAuth = config.headers?.Authorization || config.headers?.authorization;
  if (existingAuth) {
    return config;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      await clearStaleAuthSession();
      return config;
    }

    const token = data.session?.access_token;
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    await clearStaleAuthSession();
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && error.config?.url !== '/auth/me') {
      await clearStaleAuthSession();
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
