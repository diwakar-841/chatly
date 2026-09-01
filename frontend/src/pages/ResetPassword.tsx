import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { authApi } from "@/api/endpoints";
import { apiError } from "@/api/client";
import { Spinner } from "@/components/Spinner";


export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefilledEmail = (location.state as { email?: string } | null)?.email ?? "";
  const [email, setEmail] = useState(prefilledEmail);
  const [otp, setOtp] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) {
      return toast.error("Min 8 characters");
    }
    if (otp.length !== 6) {
      return toast.error("Enter the 6-digit code");
    }
    setLoading(true);
    try {
      await authApi.reset(email, otp, pw);
      toast.success("Password reset. Please log in.");
      navigate("/login");
    } catch (e) {
      toast.error(apiError(e, "Invalid or expired code."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md card p-6">
        <h1 className="text-xl font-bold mb-2">Set new password</h1>
        <p className="text-muted text-sm mb-6">
          Enter the code we emailed you and choose a strong password (min 8 characters).
        </p>
        <form onSubmit={submit} className="space-y-4">
          {!prefilledEmail && (
            <input
              type="email"
              required
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={e => {
                return setEmail(e.target.value);
              }}
            />
          )}
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            className="input text-center tracking-[0.5em]"
            placeholder="------"
            value={otp}
            onChange={e => {
              return setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
            }}
          />
          <input
            type="password"
            required
            className="input"
            placeholder="New password"
            value={pw}
            onChange={e => {
              return setPw(e.target.value);
            }}
          />
          <button disabled={loading} className="btn-primary w-full">
            {loading ? <Spinner /> : "Reset password"}
          </button>
        </form>
        <Link
          to="/forgot-password"
          className="text-muted hover:text-white text-xs mt-4 inline-block"
        >
          Didn't get a code? Request a new one
        </Link>
      </div>
    </div>
  );
}
