import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, http, setUnauthorizedHandler, tokenStore } from '../api/http';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));
  const [socket, setSocket] = useState(null);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await http.get('/auth/me');
    setUser(data.user);
    return data.user;
  }, []);

  // Restore the session on page load.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    refreshUser()
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout, refreshUser]);

  // One socket per logged-in user, for notifications and live gig updates.
  const userId = user?._id;
  useEffect(() => {
    if (!userId) return undefined;
    const s = io(API_URL || undefined, { auth: { token: tokenStore.get() } });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [userId]);

  const login = useCallback(async (email, password) => {
    const { data } = await http.post('/auth/login', { email, password });
    tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (body) => {
    const { data } = await http.post('/auth/register', body);
    tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({ user, loading, socket, login, register, logout, refreshUser }),
    [user, loading, socket, login, register, logout, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
