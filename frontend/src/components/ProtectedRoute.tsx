import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/store/auth";

/**
 * Redirects unauthenticated users to /login, preserving the intended destination.
 * Also redirects signed-in users who haven't verified their email yet to
 * /verify-email, so the OTP step can't be bypassed by navigating elsewhere.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.accessToken);
  const user = useAuth((s) => s.user);
  const loc = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (user && !user.isVerified) return <Navigate to="/verify-email" replace />;
  return <>{children}</>;
}

/** Redirects already-authenticated users to /chats, keeping public pages login-free. */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.accessToken);
  if (token) return <Navigate to="/chats" replace />;
  return <>{children}</>;
}
