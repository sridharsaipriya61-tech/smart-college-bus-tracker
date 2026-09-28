import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import api, { getToken, setToken, setUnauthorizedHandler } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });
  }, []);

  // Restore the session on any device/browser from the saved token.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setBooting(false);
        return;
      }
      try {
        const { user } = await api.auth.me();
        if (!cancelled) setUser(user);
      } catch {
        setToken(null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (emailOrUsername, password) => {
    const { token, user } = await api.auth.login({ emailOrUsername, password });
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const signup = useCallback(async (payload) => {
    const { token, user } = await api.auth.signup(payload);
    setToken(token);
    setUser(user);
    return user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      booting,
      login,
      signup,
      logout,
      setUser,
      isAdmin: user?.role === 'admin',
      isDriver: user?.role === 'driver',
      isStudent: user?.role === 'student',
    }),
    [user, booting, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
