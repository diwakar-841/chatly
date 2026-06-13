import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuth } from "@/store/auth";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

/** Shared Axios instance pre-configured with the API base URL. */
export const api = axios.create({ baseURL });

/** Attaches the current access token to every outgoing request. */
api.interceptors.request.use((config) => {
  const token = useAuth.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Tracks an in-flight refresh request to avoid issuing multiple parallel refresh calls. */
let refreshing: Promise<string | null> | null = null;

/** Exchanges the stored refresh token for a new token pair and persists the result. */
async function doRefresh(): Promise<string | null> {
  const { refreshToken, setTokens, clear } = useAuth.getState();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${baseURL}/auth/refresh-token`, { refreshToken });
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken as string;
  } catch {
    clear();
    return null;
  }
}

/**
 * On 401 responses (except auth endpoints), attempts a token refresh once.
 * Parallel requests share the same refresh promise to avoid token churn.
 */
api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true;
      if (!refreshing) refreshing = doRefresh();
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

/** Extracts the most specific error message from an Axios error response. */
export function apiError(e: unknown, fallback = "Something went wrong"): string {
  const err = e as AxiosError<{ message?: string; errors?: { msg: string }[] }>;
  return (
    err?.response?.data?.errors?.[0]?.msg ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}
