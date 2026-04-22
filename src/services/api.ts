import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL;

const USER_KEY = "chat_user";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export function getAccessToken() {
  return "";
}

export function getRefreshToken() {
  return "";
}

export function setAuthData(data: {
  user: object;
}) {
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

/** Cập nhật user đã đăng nhập (sau khi sửa hồ sơ) mà không đổi token. */
export function setStoredUser(user: object) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthData() {
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

api.interceptors.request.use((config: InternalAxiosRequestConfig) => config);

let isRefreshing = false;
let waitingQueue: Array<() => void> = [];

function resolveQueue() {
  waitingQueue.forEach((callback) => callback());
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

    if (isRefreshing) {
      return new Promise((resolve) => {
        waitingQueue.push(() => {
          resolve(api(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;
    try {
      await axios.post(
        `${API_BASE_URL}/api/auth/refresh`,
        {},
        {
          withCredentials: true,
        },
      );
      resolveQueue();
      return api(originalRequest);
    } catch (refreshError) {
      clearAuthData();
      throw refreshError;
    } finally {
      isRefreshing = false;
    }
  },
);
