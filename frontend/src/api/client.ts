import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuth } from "@/store/auth";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const api = axios.create({ baseURL });

api.interceptors.request.use(config => {
  const token = useAuth.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const { refreshToken, setTokens, clear } = useAuth.getState();
  if (!refreshToken) {
    return null;
  }
  try {
    const { data } = await axios.post(`${baseURL}/auth/refresh-token`, { refreshToken });
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken as string;
  } catch {
    clear();
    return null;
  }
}

api.interceptors.response.use(
  r => {
    return r;
  },
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true;
      if (!refreshing) {
        refreshing = doRefresh();
      }
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

const TECHNICAL_MESSAGE_PATTERN =
  /timeout|timed out|network error|ECONNABORTED|ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|socket|hang up|stack|exception|undefined is not|cannot read propert|is not a function|status code|CORS|failed to fetch|ETIMEDOUT|ERR_|at\s+\S+\s*\(|\.(js|ts):\d+/i;

export function apiError(e: unknown, fallback = "Something went wrong. Please try again later."): string {
  const err = e as AxiosError<{ message?: string; errors?: { msg: string }[] }> | undefined;

  if (err?.code === "ECONNABORTED" || /timeout/i.test((err as any)?.message || "")) {
    return "The request timed out. Please check your connection and try again.";
  }
  if (!err?.response || /network error/i.test((err as any)?.message || "")) {
    return "Unable to reach the server. Please check your internet connection.";
  }
  if (err.response.status >= 500) {
    return "Something went wrong on our end. Please try again later.";
  }

  const validationMsg = err.response.data?.errors?.[0]?.msg;
  if (validationMsg && typeof validationMsg === "string" && !TECHNICAL_MESSAGE_PATTERN.test(validationMsg)) {
    return validationMsg;
  }

  const serverMsg = err.response.data?.message;
  if (serverMsg && typeof serverMsg === "string" && !TECHNICAL_MESSAGE_PATTERN.test(serverMsg)) {
    return serverMsg;
  }

  return fallback;
}
