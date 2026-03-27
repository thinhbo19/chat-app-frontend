import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  api,
  clearAuthData,
  getAccessToken,
  getStoredUser,
  getRefreshToken,
  setAuthData,
  setStoredUser,
} from "../services/api";
import type { AuthUser } from "../types";

type AuthContextType = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (payload: { emailOrUsername: string; password: string }) => Promise<void>;
  register: (payload: {
    username: string;
    email: string;
    password: string;
  }) => Promise<void>;
  loadProfile: () => Promise<void>;
  updateCurrentUser: (user: AuthUser) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser<AuthUser>());

  const register = useCallback(async (payload: {
    username: string;
    email: string;
    password: string;
  }) => {
    await api.post("/api/auth/register", payload);
  }, []);

  const login = useCallback(async (payload: {
    emailOrUsername: string;
    password: string;
  }) => {
    const response = await api.post("/api/auth/login", payload);
    setAuthData(response.data);
    setUser(response.data.user);
  }, []);

  const loadProfile = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      return;
    }

    const response = await api.get<{ user: AuthUser }>("/api/auth/me");
    const u = response.data.user;
    setUser(u);
    setStoredUser(u);
  }, []);

  const updateCurrentUser = useCallback((u: AuthUser) => {
    setUser(u);
    setStoredUser(u);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await api.post("/api/auth/logout", { refreshToken });
      } catch (_error) {
        // Ignore network errors on logout cleanup.
      }
    }
    clearAuthData();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      register,
      loadProfile,
      updateCurrentUser,
      logout,
    }),
    [login, logout, register, loadProfile, updateCurrentUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
