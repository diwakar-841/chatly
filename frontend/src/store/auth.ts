import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  /** Stores the full auth result from login or register. */
  setAuth: (data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  }) => void;

  /** Updates both tokens independently of the user object (used by token refresh). */
  setTokens: (accessToken: string, refreshToken: string) => void;

  /** Updates just the user object (used after profile changes). */
  setUser: (user: User) => void;

  /** Clears all auth state, removes persisted auth and E2E keys. */
  clear: () => void;
}

/**
 * Persistent Zustand store for authentication state.
 * Survives page reloads via localStorage under the key `chatly-auth`.
 */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setAuth: ({ user, accessToken, refreshToken }) =>
        set({
          user,
          accessToken,
          refreshToken,
        }),

      setTokens: (accessToken, refreshToken) =>
        set({
          accessToken,
          refreshToken,
        }),

      setUser: (user) =>
        set({
          user,
        }),

      clear: () => {
        // Remove persisted E2E encryption keys
        localStorage.removeItem("chatly-e2e-keys");

        // Remove persisted auth storage
        localStorage.removeItem("chatly-auth");

        // Reset in-memory state
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
        });
        
        window.location.href = "/login";
        
      },
    }),
    {
      name: "chatly-auth",
    }
  )
);