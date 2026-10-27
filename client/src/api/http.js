import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'skillgig_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const http = axios.create({ baseURL: `${API_URL}/api`, timeout: 15000 });

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Lets the auth context log the user out when any request says the session is invalid.
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

http.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && tokenStore.get()) onUnauthorized();
    return Promise.reject(err);
  },
);

/** Turns any axios error into a sentence a user can act on. */
export function errorMessage(err) {
  if (err?.response?.data?.error?.message) return err.response.data.error.message;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
  if (err?.request && !err.response) return 'Cannot reach the server. Check your connection and try again.';
  return err?.message || 'Something went wrong';
}
