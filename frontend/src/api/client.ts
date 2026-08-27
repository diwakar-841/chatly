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

/**
 * Extracts the most specific error message from an Axios error response and
 * maps technical or internal messages to friendly, user-facing text.
 */
export function apiError(e: unknown, fallback = "Something went wrong"): string {
  const err = e as AxiosError<{ message?: string; errors?: { msg: string }[] }> | undefined;

  // Prefer structured validation messages from the server (express-validator style)
  const validationMsg = err?.response?.data?.errors?.[0]?.msg;
  if (validationMsg) return validationMsg;

  // If server provided a user-friendly message, map common technical cases to safe text
  const serverMsg = err?.response?.data?.message;
  if (serverMsg) {
    if (/timeout|timed out/i.test(serverMsg) || err?.code === 'ECONNABORTED')
      return 'The request timed out. Please check your connection and try again.';
    if (/network error|ENOTFOUND|ECONNREFUSED|ECONNRESET/i.test(serverMsg))
      return 'Unable to reach the server. Please check your internet connection.';
    if (err?.response?.status && err.response.status >= 500)
      return 'Server error. Please try again later.';

    // Otherwise return the server message (it's assumed to be user-facing)
    return String(serverMsg);
  }

  // Network / timeout errors surfaced by Axios
  if ((err as any)?.code === 'ECONNABORTED' || /timeout/i.test((err as any)?.message || ''))
    return 'The request timed out. Please check your connection and try again.';
  if (/Network Error/i.test((err as any)?.message || ''))
    return 'Unable to reach the server. Please check your internet connection.';

  // Fall back to the Axios error message if short and non-technical, otherwise use fallback
  const raw = (err as any)?.message;
  if (raw && typeof raw === 'string' && raw.length > 0 && raw.length < 120) {
    return raw;
  }

  return fallback;
}
