import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** Stores the full auth result from login or register. */
  setAuth: (data: { user: User; accessToken: string; refreshToken: string }) => void;
  /** Updates both tokens independently of the user object (used by token refresh). */
  setTokens: (a: string, r: string) => void;
  /** Updates just the user object (used after profile changes). */
  setUser: (u: User) => void;
  /** Clears all auth state, effectively logging out. */
  clear: () => void;
}

/**
 * Persistent Zustand store for authentication state. Survives page reloads
 * via localStorage under the key `chatly-auth`.
 */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: "chatly-auth" }
  )
);
