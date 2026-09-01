import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";
import { authApi } from "@/api/endpoints";
import { apiError } from "@/api/client";
import { Spinner } from "@/components/Spinner";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgot(email);
      setSent(true);
      toast.success("Check your email for the code");
      navigate("/reset-password", { state: { email } });
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link
          to="/login"
          className="text-muted hover:text-white inline-flex items-center gap-2 mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>
        <div className="card p-6">
          <h1 className="text-xl font-bold mb-2">Forgot password?</h1>
          <p className="text-muted text-sm mb-6">
            Enter your email and we'll send you a one-time code.
          </p>
          {sent ? (
            <p className="text-accent text-sm">
              If an account with that email exists, a code has been sent.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
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
              <button disabled={loading} className="btn-primary w-full">
                {loading ? <Spinner /> : "Send code"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
