import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL;

const ACCESS_TOKEN_KEY = "chat_access_token";
const REFRESH_TOKEN_KEY = "chat_refresh_token";
const USER_KEY = "chat_user";

/** CustomEvent trên window sau khi access token được làm mới (để Socket.IO reconnect). */
export const ACCESS_TOKEN_REFRESHED_EVENT = "chat:access-token-refreshed";

function dispatchAccessTokenRefreshed() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ACCESS_TOKEN_REFRESHED_EVENT));
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || "";
}

export function setAuthData(data: {
  accessToken: string;
  refreshToken: string;
  user: object;
}) {
  localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

/** Cập nhật user đã đăng nhập (sau khi sửa hồ sơ) mà không đổi token. */
export function setStoredUser(user: object) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthData() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser<T>() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (_error) {
    return null;
  }
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let waitingQueue: Array<(token: string) => void> = [];

function resolveQueue(token: string) {
  waitingQueue.forEach((callback) => callback(token));
  waitingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;
    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      throw error;
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearAuthData();
      throw error;
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        waitingQueue.push((token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
        refreshToken,
      });
      const nextAccessToken = response.data.accessToken as string;
      localStorage.setItem(ACCESS_TOKEN_KEY, nextAccessToken);
      dispatchAccessTokenRefreshed();
      resolveQueue(nextAccessToken);
      originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      clearAuthData();
      throw refreshError;
    } finally {
      isRefreshing = false;
    }
  },
);
