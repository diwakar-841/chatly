import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { z } from "zod";
import toast from "react-hot-toast";
import { MessageCircle, Eye, EyeOff, Mail, Lock, User, AtSign, ArrowRight } from "lucide-react";
import { authApi } from "@/api/endpoints";
import { useAuth } from "@/store/auth";
import { apiError } from "@/api/client";
import { Spinner } from "@/components/Spinner";

const schema = z.object({
  fullName: z.string().min(1, "Full name required").max(60),
  username: z.string().min(3, "Min 3 characters").max(30),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type FormData = z.infer<typeof schema>;


function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) {
    return { score: 0, label: "", color: "#2a3942" };
  }
  let score = 0;
  if (pw.length >= 8) {
    score++;
  }
  if (/[A-Z]/.test(pw)) {
    score++;
  }
  if (/[0-9]/.test(pw)) {
    score++;
  }
  if (/[^a-zA-Z0-9]/.test(pw)) {
    score++;
  }
  if (score <= 1) {
    return { score, label: "Weak", color: "#ef4444" };
  }
  if (score === 2) {
    return { score, label: "Fair", color: "#f59e0b" };
  }
  if (score === 3) {
    return { score, label: "Good", color: "#3b82f6" };
  }
  return { score: 4, label: "Strong", color: "#00a884" };
}


export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuth(s => {
    return s.setAuth;
  });
  const [show, setShow] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const strength = getPasswordStrength(password);

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authApi.register(data);
      setAuth(res);
      toast.success("Account created! Enter the code we emailed you to verify.");
      navigate("/verify-email");
    } catch (e) {
      toast.error(apiError(e, "Registration failed"));
    }
  };

  
  const inputStyle = (field: string): React.CSSProperties => {
    return {
      width: "100%",
      boxSizing: "border-box",
      background: "#111b21",
      border: `1.5px solid ${focused === field ? "#00a884" : "#2a3942"}`,
      borderRadius: "12px",
      padding: "13px 14px 13px 42px",
      fontSize: "14px",
      color: "#e9edef",
      outline: "none",
      transition: "border-color 0.2s, box-shadow 0.2s",
      boxShadow: focused === field ? "0 0 0 3px rgba(0,168,132,0.12)" : "none",
    };
  };

  
  const iconStyle = (field: string): React.CSSProperties => {
    return {
      position: "absolute",
      left: "14px",
      top: "50%",
      transform: "translateY(-50%)",
      color: focused === field ? "#00a884" : "#556b7a",
      transition: "color 0.2s",
      pointerEvents: "none",
      display: "flex",
    };
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        fontFamily: "'Inter', system-ui, sans-serif",
        background: "#0b141a",
        color: "#e9edef",
      }}
    >
      {}
      <div
        style={{
          width: "45%",
          background: "linear-gradient(160deg, #0d1f28 0%, #0b2d2d 40%, #0a1f1a 100%)",
          padding: "3rem",
          position: "relative",
          overflow: "hidden",
        }}
        className="hidden lg:flex lg:flex-col lg:justify-between"
      >
        <div
          style={{
            position: "absolute",
            top: "-80px",
            right: "-80px",
            width: "320px",
            height: "320px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,168,132,0.18) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "80px",
            left: "-60px",
            width: "260px",
            height: "260px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(0,168,132,0.12) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.06,
            backgroundImage: "radial-gradient(circle, #00a884 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              background: "rgba(0,168,132,0.12)",
              border: "1px solid rgba(0,168,132,0.25)",
              borderRadius: "12px",
              padding: "8px 12px",
            }}
          >
            <MessageCircle size={20} color="#00a884" />
            <span
              style={{
                fontWeight: 700,
                fontSize: "15px",
                color: "#00a884",
                letterSpacing: "-0.02em",
              }}
            >
              Chatly
            </span>
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2
            style={{
              fontSize: "2.4rem",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              marginBottom: "1rem",
              color: "#e9edef",
            }}
          >
            Join thousands
            <br />
            <span style={{ color: "#00a884" }}>already chatting.</span>
          </h2>
          <p style={{ color: "#8696a0", fontSize: "15px", lineHeight: 1.65, maxWidth: "340px" }}>
            Create your free account and start messaging instantly. No ads, no tracking — just
            conversations.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "2rem" }}>
            {[
              { step: "01", text: "Create your account in seconds" },
              { step: "02", text: "Verify your email address" },
              { step: "03", text: "Start chatting right away" },
            ].map(({ step, text }) => {
              return (
                <div key={step} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      flexShrink: 0,
                      background: "rgba(0,168,132,0.15)",
                      border: "1px solid rgba(0,168,132,0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      color: "#00a884",
                    }}
                  >
                    {step}
                  </div>
                  <span style={{ fontSize: "13px", color: "#adbac7" }}>{text}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div
          style={{
            position: "relative",
            zIndex: 1,
            borderTop: "1px solid rgba(255,255,255,0.07)",
            paddingTop: "1.25rem",
          }}
        >
          <p style={{ fontSize: "12px", color: "#556b7a" }}>
            Free forever — no credit card required
          </p>
        </div>
      </div>

      {}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          overflowY: "auto",
        }}
      >
        <div
          style={{ width: "100%", maxWidth: "400px", paddingTop: "1rem", paddingBottom: "1rem" }}
        >
          <div className="lg:hidden" style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "52px",
                height: "52px",
                borderRadius: "16px",
                background: "#00a884",
                marginBottom: "12px",
              }}
            >
              <MessageCircle size={26} color="#0b141a" />
            </div>
            <div style={{ fontWeight: 700, fontSize: "18px" }}>Chatly</div>
          </div>
          <div style={{ marginBottom: "1.75rem" }}>
            <h1
              style={{
                fontSize: "1.7rem",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                marginBottom: "6px",
                color: "#e9edef",
              }}
            >
              Create your account
            </h1>
            <p style={{ color: "#8696a0", fontSize: "14px" }}>Join Chatly — it's free, forever.</p>
          </div>
          <form
            onSubmit={handleSubmit(onSubmit)}
            style={{ display: "flex", flexDirection: "column", gap: "13px" }}
          >
            <div>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#8696a0",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: "7px",
                }}
              >
                Full Name
              </label>
              <div style={{ position: "relative" }}>
                <span style={iconStyle("fullName")}>
                  <User size={16} />
                </span>
                <input
                  type="text"
                  placeholder="Jane Doe"
                  style={inputStyle("fullName")}
                  onFocus={() => {
                    return setFocused("fullName");
                  }}
                  {...register("fullName")}
                />
              </div>
              {errors.fullName && (
                <p style={{ color: "#ef4444", fontSize: "12px", marginTop: "5px" }}>
                  {errors.fullName.message}
                </p>
              )}
            </div>
            <div>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#8696a0",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: "7px",
                }}
              >
                Username
              </label>
              <div style={{ position: "relative" }}>
                <span style={iconStyle("username")}>
                  <AtSign size={16} />
                </span>
                <input
                  type="text"
                  placeholder="janedoe"
                  style={inputStyle("username")}
                  onFocus={() => {
                    return setFocused("username");
                  }}
                  {...register("username")}
                />
              </div>
              {errors.username && (
                <p style={{ color: "#ef4444", fontSize: "12px", marginTop: "5px" }}>
                  {errors.username.message}
                </p>
              )}
            </div>
            <div>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#8696a0",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: "7px",
                }}
              >
                Email
              </label>
              <div style={{ position: "relative" }}>
                <span style={iconStyle("email")}>
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  placeholder="you@example.com"
                  style={inputStyle("email")}
                  onFocus={() => {
                    return setFocused("email");
                  }}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p style={{ color: "#ef4444", fontSize: "12px", marginTop: "5px" }}>
                  {errors.email.message}
                </p>
              )}
            </div>
            <div>
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#8696a0",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: "7px",
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <span style={iconStyle("password")}>
                  <Lock size={16} />
                </span>
                <input
                  type={show ? "text" : "password"}
                  placeholder="At least 8 characters"
                  style={{ ...inputStyle("password"), paddingRight: "46px" }}
                  onFocus={() => {
                    return setFocused("password");
                  }}
                  {...register("password", {
                    onChange: e => {
                      return setPassword(e.target.value);
                    },
                  })}
                />
                <button
                  type="button"
                  onClick={() => {
                    return setShow(!show);
                  }}
                  style={{
                    position: "absolute",
                    right: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#8696a0",
                    padding: 0,
                    display: "flex",
                  }}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p style={{ color: "#ef4444", fontSize: "12px", marginTop: "5px" }}>
                  {errors.password.message}
                </p>
              )}
              {password.length > 0 && (
                <div style={{ marginTop: "8px" }}>
                  <div style={{ display: "flex", gap: "4px", marginBottom: "5px" }}>
                    {[1, 2, 3, 4].map(i => {
                      return (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            height: "3px",
                            borderRadius: "2px",
                            background: i <= strength.score ? strength.color : "#1f2c33",
                            transition: "background 0.3s",
                          }}
                        />
                      );
                    })}
                  </div>
                  <span style={{ fontSize: "11px", color: strength.color, fontWeight: 600 }}>
                    {strength.label} password
                  </span>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: "100%",
                background: "#00a884",
                border: "none",
                borderRadius: "12px",
                padding: "14px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#0b141a",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
              }}
              onMouseEnter={e => {
                if (!isSubmitting) {
                  (e.currentTarget as HTMLButtonElement).style.background = "#00c49a";
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = "#00a884";
              }}
            >
              {isSubmitting ? (
                <Spinner />
              ) : (
                <>
                  <span>Create account</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
            <p
              style={{
                textAlign: "center",
                fontSize: "11px",
                color: "#556b7a",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              By signing up you agree to our{" "}
              <a href="#" style={{ color: "#00a884", textDecoration: "none" }}>
                Terms
              </a>{" "}
              and{" "}
              <a href="#" style={{ color: "#00a884", textDecoration: "none" }}>
                Privacy Policy
              </a>
              .
            </p>
          </form>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "1.25rem 0" }}>
            <div style={{ flex: 1, height: "1px", background: "#1f2c33" }} />
            <span style={{ fontSize: "12px", color: "#556b7a" }}>Already have an account?</span>
            <div style={{ flex: 1, height: "1px", background: "#1f2c33" }} />
          </div>
          <Link
            to="/login"
            style={{
              display: "block",
              textAlign: "center",
              border: "1.5px solid #2a3942",
              borderRadius: "12px",
              padding: "13px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#e9edef",
              textDecoration: "none",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.borderColor = "#3b4a54";
              el.style.background = "#111b21";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.borderColor = "#2a3942";
              el.style.background = "transparent";
            }}
          >
            Sign in instead
          </Link>
        </div>
      </div>
    </div>
  );
}
