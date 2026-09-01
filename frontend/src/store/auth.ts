import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  
  setAuth: (data: { user: User; accessToken: string; refreshToken: string }) => void;

  
  setTokens: (accessToken: string, refreshToken: string) => void;

  
  setUser: (user: User) => void;

  
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    set => {
      return {
        user: null,
        accessToken: null,
        refreshToken: null,

        setAuth: ({ user, accessToken, refreshToken }) => {
          return set({
            user,
            accessToken,
            refreshToken,
          });
        },

        setTokens: (accessToken, refreshToken) => {
          return set({
            accessToken,
            refreshToken,
          });
        },

        setUser: user => {
          return set({ user });
        },

        clear: () => {
          
          localStorage.removeItem("chatly-e2e-keys");

          
          localStorage.removeItem("chatly-auth");

          
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
          });

          window.location.href = "/login";
        },
      };
    },
    { name: "chatly-auth" }
  )
);
