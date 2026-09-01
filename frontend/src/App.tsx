import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { authApi } from "@/api/endpoints";
import { SocketProvider } from "@/context/SocketContext";
import { CallProvider } from "@/context/CallContext";
import { AppLayout } from "@/components/AppLayout";
import { CallOverlay } from "@/components/CallOverlay";
import { ProtectedRoute, PublicOnlyRoute } from "@/components/ProtectedRoute";
import { FullScreenLoader } from "@/components/Spinner";

import LoginPage from "@/pages/Login";
import RegisterPage from "@/pages/Register";
import ForgotPasswordPage from "@/pages/ForgotPassword";
import ResetPasswordPage from "@/pages/ResetPassword";
import VerifyEmailPage from "@/pages/VerifyEmail";
import ChatsPage from "@/pages/Chats";
import ChatRoomPage from "@/pages/ChatRoom";
import NewGroupPage from "@/pages/NewGroup";
import UserProfilePage from "@/pages/UserProfile";
import GroupInfoPage from "@/pages/GroupInfo";
import RequestsPage from "@/pages/Requests";
import NotificationsPage from "@/pages/Notifications";
import ProfilePage from "@/pages/Profile";
import BlockedPage from "@/pages/Blocked";


export default function App() {
  const { accessToken, setUser, clear } = useAuth();
  const [booting, setBooting] = useState(!!accessToken);

  useEffect(() => {
    if (!accessToken) {
      setBooting(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => {
        return clear();
      })
      .finally(() => {
        return setBooting(false);
      });
  }, []);

  if (booting) {
    return <FullScreenLoader />;
  }

  return (
    <SocketProvider>
      <CallProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicOnlyRoute>
                <ForgotPasswordPage />
              </PublicOnlyRoute>
            }
          />

          {}
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/chats" element={<ChatsPage />} />
            <Route path="/chats/:chatId" element={<ChatRoomPage />} />
            <Route path="/chats/:chatId/info" element={<GroupInfoPage />} />
            <Route path="/new-group" element={<NewGroupPage />} />
            <Route path="/requests" element={<RequestsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/:userId" element={<UserProfilePage />} />
            <Route path="/blocked" element={<BlockedPage />} />
          </Route>

          <Route path="/" element={<Navigate to="/chats" replace />} />
          <Route path="*" element={<Navigate to="/chats" replace />} />
        </Routes>
        <CallOverlay />
      </CallProvider>
    </SocketProvider>
  );
}
