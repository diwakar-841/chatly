import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/store/auth";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useAuth(s => {
    return s.accessToken;
  });
  const user = useAuth(s => {
    return s.user;
  });
  const loc = useLocation();
  if (!token) {
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }
  if (user && !user.isVerified) {
    return <Navigate to="/verify-email" replace />;
  }
  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const token = useAuth(s => {
    return s.accessToken;
  });
  if (token) {
    return <Navigate to="/chats" replace />;
  }
  return <>{children}</>;
}
