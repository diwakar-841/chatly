import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { z } from "zod";
import toast from "react-hot-toast";
import { MessageCircle, Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import { authApi } from "@/api/endpoints";
import { useAuth } from "@/store/auth";
import { apiError } from "@/api/client";
import { Spinner } from "@/components/Spinner";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
});
type FormData = z.infer<typeof schema>;

/** Login page with email/password form, inline validation, and branding panel. */
export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    const parsed = schema.safeParse(data);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    try {
      const res = await authApi.login(parsed.data);
      setAuth(res);
      toast.success("Welcome back!");
      navigate("/chats");
    } catch (e) { toast.error(apiError(e, "Login failed")); }
  };

  /** Generates the inline style for an input field, highlighting it when focused. */
  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%", boxSizing: "border-box", background: "#111b21",
    border: `1.5px solid ${focused === field ? "#00a884" : "#2a3942"}`,
    borderRadius: "12px", padding: "13px 14px 13px 42px",
    fontSize: "14px", color: "#e9edef", outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxShadow: focused === field ? "0 0 0 3px rgba(0,168,132,0.12)" : "none",
  });

  /** Generates the inline style for the icon inside an input field. */
  const iconStyle = (field: string): React.CSSProperties => ({
    position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)",
    color: focused === field ? "#00a884" : "#556b7a",
    transition: "color 0.2s", pointerEvents: "none", display: "flex",
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Inter', system-ui, sans-serif", background: "#0b141a", color: "#e9edef" }}>

      {/* Desktop branding panel */}
      <div style={{ width: "45%", background: "linear-gradient(160deg, #0d1f28 0%, #0b2d2d 40%, #0a1f1a 100%)", padding: "3rem", position: "relative", overflow: "hidden" }}
        className="hidden lg:flex lg:flex-col lg:justify-between"
      >
        <div style={{ position: "absolute", top: "-80px", right: "-80px", width: "320px", height: "320px", borderRadius: "50%", background: "radial-gradient(circle, rgba(0,168,132,0.18) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "80px", left: "-60px", width: "260px", height: "260px", borderRadius: "50%", background: "radial-gradient(circle, rgba(0,168,132,0.12) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", inset: 0, opacity: 0.06, backgroundImage: "radial-gradient(circle, #00a884 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", background: "rgba(0,168,132,0.12)", border: "1px solid rgba(0,168,132,0.25)", borderRadius: "12px", padding: "8px 16px" }}>
            <MessageCircle size={20} color="#00a884" />
            <span style={{ fontWeight: 700, fontSize: "15px", color: "#00a884", letterSpacing: "-0.02em" }}>Chatly</span>
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{ fontSize: "2.4rem", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.03em", marginBottom: "1rem", color: "#e9edef" }}>
            Every conversation<br /><span style={{ color: "#00a884" }}>starts here.</span>
          </h2>
          <p style={{ color: "#8696a0", fontSize: "15px", lineHeight: 1.65, maxWidth: "340px" }}>
            Connect with friends and teammates in real time. Chatly keeps your conversations private, fast, and always in sync.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "2rem" }}>
            {["End-to-end encrypted", "Real-time messaging", "Group chats & AI assistant"].map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#00a884", flexShrink: 0 }} />
                <span style={{ fontSize: "13px", color: "#adbac7" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "1.25rem" }}>
          <p style={{ fontSize: "12px", color: "#556b7a" }}>Trusted by 50,000+ users worldwide</p>
        </div>
      </div>

      {/* Form panel */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ width: "100%", maxWidth: "400px" }}>
          <div className="lg:hidden" style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "52px", height: "52px", borderRadius: "16px", background: "#00a884", marginBottom: "12px" }}>
              <MessageCircle size={26} color="#0b141a" />
            </div>
            <div style={{ fontWeight: 700, fontSize: "18px" }}>Chatly</div>
          </div>
          <div style={{ marginBottom: "2rem" }}>
            <h1 style={{ fontSize: "1.7rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "6px", color: "#e9edef" }}>Welcome back</h1>
            <p style={{ color: "#8696a0", fontSize: "14px" }}>Sign in to your Chatly account</p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#8696a0", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Email</label>
              <div style={{ position: "relative" }}>
                <span style={iconStyle("email")}><Mail size={16} /></span>
                <input type="email" placeholder="you@example.com" style={{ ...inputStyle("email"), paddingLeft: "42px" }} onFocus={() => setFocused("email")} {...register("email")} />
              </div>
              {errors.email && <p style={{ color: "#ef4444", fontSize: "12px", marginTop: "5px" }}>{errors.email.message}</p>}
            </div>
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#8696a0", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Password</label>
              <div style={{ position: "relative" }}>
                <span style={iconStyle("password")}><Lock size={16} /></span>
                <input type={show ? "text" : "password"} placeholder="••••••••" style={{ ...inputStyle("password"), paddingLeft: "42px", paddingRight: "46px" }} onFocus={() => setFocused("password")} {...register("password")} />
                <button type="button" onClick={() => setShow(!show)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8696a0", padding: 0, display: "flex" }}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p style={{ color: "#ef4444", fontSize: "12px", marginTop: "5px" }}>{errors.password.message}</p>}
              <div style={{ textAlign: "right", marginTop: "6px" }}>
                <Link to="/forgot-password" style={{ fontSize: "12px", color: "#00a884", textDecoration: "none", fontWeight: 500 }}>Forgot password?</Link>
              </div>
            </div>
            <button type="submit" disabled={isSubmitting}
              style={{ width: "100%", background: "#00a884", border: "none", borderRadius: "12px", padding: "14px", fontSize: "14px", fontWeight: 700, color: "#0b141a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "4px", opacity: isSubmitting ? 0.7 : 1, transition: "background 0.2s" }}
              onMouseEnter={(e) => { if (!isSubmitting) (e.currentTarget as HTMLButtonElement).style.background = "#00c49a"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#00a884"; }}
            >
              {isSubmitting ? <Spinner /> : <><span>Sign in</span><ArrowRight size={16} /></>}
            </button>
          </form>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "1.5rem 0" }}>
            <div style={{ flex: 1, height: "1px", background: "#1f2c33" }} />
            <span style={{ fontSize: "12px", color: "#556b7a" }}>New to Chatly?</span>
            <div style={{ flex: 1, height: "1px", background: "#1f2c33" }} />
          </div>
          <Link to="/register"
            style={{ display: "block", textAlign: "center", border: "1.5px solid #2a3942", borderRadius: "12px", padding: "13px", fontSize: "14px", fontWeight: 600, color: "#e9edef", textDecoration: "none", transition: "border-color 0.2s, background 0.2s" }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = "#3b4a54"; el.style.background = "#111b21"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = "#2a3942"; el.style.background = "transparent"; }}
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
