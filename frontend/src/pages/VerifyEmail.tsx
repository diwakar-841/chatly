import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CheckCircle, MessageCircle } from "lucide-react";
import toast from "react-hot-toast";
import { authApi } from "@/api/endpoints";
import { apiError } from "@/api/client";
import { useAuth } from "@/store/auth";
import { disconnectSocket } from "@/lib/socket";
import { Spinner } from "@/components/Spinner";

/**
 * Email verification page — user enters the 6-digit OTP that was emailed to them.
 * Always operates on the signed-in account's email; there's no manual email field,
 * since this page is only reachable while logged in (see ProtectedRoute).
 */
export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const storedUser = useAuth((s) => s.user);
  const refreshToken = useAuth((s) => s.refreshToken);
  const setUser = useAuth((s) => s.setUser);
  const clear = useAuth((s) => s.clear);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);

  // No logged-in account to verify — send them to log in first.
  if (!storedUser) return <Navigate to="/login" replace />;
  // Already verified (and not just now, in this session) — nothing to do here.
  if (storedUser.isVerified && !verified) return <Navigate to="/chats" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    try {
      await authApi.verifyEmail(storedUser.email, otp);
      setUser({ ...storedUser, isVerified: true });
      setVerified(true);
    } catch (e) {
      toast.error(apiError(e, "Invalid or expired OTP."));
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authApi.resendVerification();
      toast.success("A new OTP was sent to your email.");
    } catch (e) {
      toast.error(apiError(e, "Unable to resend verification email."));
    } finally {
      setResending(false);
    }
  };

  /**
   * Signs out of this unverified account and returns to /login. A plain link
   * to /login won't work here: PublicOnlyRoute would immediately bounce a
   * still-logged-in user back to /chats, which ProtectedRoute would then
   * send right back to /verify-email since they're still unverified — so
   * this has to actually clear the session first.
   */
  const backToLogin = async () => {
    try { await authApi.logout(refreshToken || undefined); } catch { /* best-effort */ }
    disconnectSocket();
    clear();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-bg via-bg-elevated to-bg">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-6">
          <MessageCircle className="w-7 h-7 text-black" />
        </div>
        {verified ? (
          <>
            <CheckCircle className="w-12 h-12 text-accent mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Email verified!</h1>
            <p className="text-muted text-sm mb-6">Your account is now fully activated.</p>
            <button onClick={() => navigate("/chats")} className="btn-primary inline-flex">
              Continue
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-2">Verify your email</h1>
            <p className="text-muted text-sm mb-6">
              Enter the 6-digit code we emailed to <span className="text-fg">{storedUser.email}</span>. It expires in 10 minutes.
            </p>
            <form onSubmit={submit} className="space-y-4 text-left">
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                className="input text-center tracking-[0.5em]"
                placeholder="------"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <button disabled={verifying || otp.length !== 6} className="btn-primary w-full">
                {verifying ? <Spinner /> : "Verify"}
              </button>
            </form>
            <div className="flex items-center justify-center gap-3 mt-4">
              <button onClick={backToLogin} className="btn-ghost text-sm">
                Back to login
              </button>
              <button onClick={handleResend} disabled={resending} className="btn-ghost text-sm">
                {resending ? "..." : "Resend code"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
