import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { authApi } from "@/api/endpoints";
import { apiError } from "@/api/client";
import { Spinner } from "@/components/Spinner";

/**
 * Password-reset page. Reads the one-time token from the URL, accepts a new
 * password, and redirects to /login on success.
 */
export default function ResetPasswordPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  /** Validates the minimum length, calls the API, then navigates to login. */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Min 8 characters");
    setLoading(true);
    try {
      await authApi.reset(token, pw);
      toast.success("Password reset. Please log in.");
      navigate("/login");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md card p-6">
        <h1 className="text-xl font-bold mb-2">Set new password</h1>
        <p className="text-muted text-sm mb-6">Choose a strong password (min 8 characters).</p>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            required
            className="input"
            placeholder="New password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <button disabled={loading} className="btn-primary w-full">
            {loading ? <Spinner /> : "Reset password"}
          </button>
        </form>
      </div>
    </div>
  );
}
