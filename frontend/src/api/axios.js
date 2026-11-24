import axios from "axios";
import { API_BASE_URL } from "../config";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// 🔐 Automatically attach valid ASCII token (skip public player/auth endpoints)
api.interceptors.request.use((config) => {
  const url = config.url || "";
  const isPublicEndpoint =
    url.includes("/auth/login") ||
    url.includes("/auth/register") ||
    url.includes("/auth/forgot-password") ||
    url.includes("/auth/setup-status") ||
    url.includes("/devices/by-token") ||
    url.includes("/devices/pair/request");

  if (isPublicEndpoint) {
    return config;
  }

  const token = localStorage.getItem("token");
  if (token) {
    if (/^[\x20-\x7E]+$/.test(token)) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }

  return config;
});

// 🔒 Clear expired/invalid auth and redirect to login (never redirect public TV screens)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";

    const isAuthOrPublicEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/forgot-password") ||
      url.includes("/devices/by-token");

    if (
      status === 401 &&
      !isAuthOrPublicEndpoint &&
      !window.location.pathname.startsWith("/screen") &&
      window.location.pathname !== "/login"
    ) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;
