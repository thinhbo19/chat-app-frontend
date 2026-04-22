import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import {
  api,
  clearAuthData,
  setAuthData,
  setStoredUser,
} from "../services/api";
import type { AuthUser } from "../types";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setUser } from "../store/authSlice";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAuth(): AuthContextType {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

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
    dispatch(setUser(response.data.user));
  }, [dispatch]);

  const loadProfile = useCallback(async () => {
    try {
      const response = await api.get<{ user: AuthUser }>("/api/auth/me");
      const u = response.data.user;
      dispatch(setUser(u));
      setStoredUser(u);
    } catch (_error) {
      dispatch(setUser(null));
      clearAuthData();
    }
  }, [dispatch]);

  const updateCurrentUser = useCallback((u: AuthUser) => {
    dispatch(setUser(u));
    setStoredUser(u);
  }, [dispatch]);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout", {});
    } catch (_error) {
      // Ignore network errors on logout cleanup.
    }
    clearAuthData();
    dispatch(setUser(null));
  }, [dispatch]);

  return useMemo(
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
}
