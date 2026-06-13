import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";
import { authApi } from "@/api/endpoints";
import { apiError } from "@/api/client";
import { Spinner } from "@/components/Spinner";

/** Forgot-password page — submits an email address to trigger a reset link. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgot(email);
      setSent(true);
      toast.success("Check your email");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/login" className="text-muted hover:text-white inline-flex items-center gap-2 mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>
        <div className="card p-6">
          <h1 className="text-xl font-bold mb-2">Forgot password?</h1>
          <p className="text-muted text-sm mb-6">Enter your email and we'll send you a reset link.</p>
          {sent ? (
            <p className="text-accent text-sm">If an account with that email exists, a reset link has been sent.</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <input type="email" required className="input" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
              <button disabled={loading} className="btn-primary w-full">
                {loading ? <Spinner /> : "Send reset link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
