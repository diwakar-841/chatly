import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle, XCircle, Loader2, MessageCircle } from "lucide-react";
import toast from "react-hot-toast";
import { authApi } from "@/api/endpoints";
import { apiError } from "@/api/client";

/** Handles the email verification link — calls the API with the URL token and renders success or error. */
export default function VerifyEmailPage() {
  const { token = "" } = useParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMsg("Invalid verification link.");
      setStatus("error");
      return;
    }
    authApi
      .verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((e) => {
        setErrorMsg(apiError(e, "Verification failed. Please try again."));
        setStatus("error");
      });
  }, [token]);

  const handleResend = async () => {
    setResending(true);
    try {
      await authApi.resendVerification();
      toast.success("Verification email sent. Please check your inbox.");
    } catch (e) {
      toast.error(apiError(e, "Unable to resend verification email."));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-bg via-bg-elevated to-bg">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-6">
          <MessageCircle className="w-7 h-7 text-black" />
        </div>
        {status === "loading" && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-accent mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Verifying your email…</h1>
            <p className="text-muted text-sm">Please wait a moment.</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-accent mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Email verified!</h1>
            <p className="text-muted text-sm mb-6">Your account is now fully activated.</p>
            <Link to="/login" className="btn-primary inline-flex">
              Go to login
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Verification failed</h1>
            <p className="text-muted text-sm mb-4">{errorMsg || "The link may be expired or invalid."}</p>
            <div className="flex items-center justify-center gap-3">
              <Link to="/login" className="btn-primary inline-flex">
                Back to login
              </Link>
              <button
                onClick={handleResend}
                disabled={resending}
                className="btn-ghost text-sm"
              >
                {resending ? "..." : "Resend verification"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
