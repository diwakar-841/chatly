import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, LogOut, Shield, Pencil, Check, X, Lock, BadgeCheck, MailCheck } from "lucide-react";
import toast from "react-hot-toast";
import { profileApi, authApi } from "@/api/endpoints";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/Spinner";
import { useAuth } from "@/store/auth";
import { disconnectSocket } from "@/lib/socket";
import { apiError } from "@/api/client";
import { cn } from "@/lib/utils";

/** Shows the current user's profile with editable name, bio, privacy toggle, and logout actions. */
export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, refreshToken, setUser, clear } = useAuth();
  const [editing, setEditing] = useState<"name" | "bio" | null>(null);
  const [name, setName] = useState(user?.fullName || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [uploading, setUploading] = useState(false);
  const [resending, setResending] = useState(false);

  if (!user) return null;

  /** Persists the given field to the API and refreshes local user state. */
  const save = async (field: "name" | "bio") => {
    try {
      const u = await profileApi.update(field === "name" ? { fullName: name } : { bio });
      setUser(u);
      toast.success("Updated");
      setEditing(null);
    } catch (e) { toast.error(apiError(e)); }
  };

  /** Uploads a new avatar file and updates the user record. */
  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try { const u = await profileApi.updateAvatar(f); setUser(u); toast.success("Avatar updated"); }
    catch (err) { toast.error(apiError(err)); }
    finally { setUploading(false); e.target.value = ""; }
  };

  /** Flips the isPrivate flag on the user's profile. */
  const togglePrivacy = async () => {
    try { const u = await profileApi.update({ isPrivate: !user.isPrivate }); setUser(u); }
    catch (e) { toast.error(apiError(e)); }
  };

  /** Requests a new verification email be sent to the user's address. */
  const resendVerification = async () => {
    setResending(true);
    try {
      await authApi.resendVerification();
      toast.success("Verification email sent!");
    } catch (e) { toast.error(apiError(e)); }
    finally { setResending(false); }
  };

  /** Logs out from the current session and clears local auth state. */
  const logout = async () => {
    try { await authApi.logout(refreshToken || undefined); } catch {/* */}
    disconnectSocket();
    clear();
    toast.success("Logged out");
  };

  /** Invalidates all active sessions for this account across every device. */
  const logoutAll = async () => {
    try { await authApi.logoutAll(); } catch {/* */}
    disconnectSocket();
    clear();
    toast.success("Logged out from all devices");
  };

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 md:px-6 pt-5 pb-3 border-b border-border bg-bg-elevated">
        <h1 className="text-2xl font-bold">Profile</h1>
      </header>
      <div className="flex-1 overflow-y-auto pb-24 md:pb-6">
        <div className="flex flex-col items-center py-8">
          <label className="relative cursor-pointer group">
            <Avatar src={user.avatar} name={user.fullName || user.username} size={120} />
            <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
              {uploading ? <Spinner /> : <Camera className="w-6 h-6" />}
            </div>
            <input type="file" accept="image/*" hidden onChange={onAvatar} disabled={uploading} />
          </label>
          <div className="mt-4 flex items-center gap-2">
            <h2 className="text-xl font-semibold">{user.fullName || user.username}</h2>
            {user.isVerified && (
              <BadgeCheck className="w-5 h-5 text-accent" title="Verified" />
            )}
          </div>
          <p className="text-muted text-sm">@{user.username}</p>
          <p className="text-muted text-sm mt-0.5">{user.email}</p>
        </div>

        {!user.isVerified && (
          <div className="mx-4 md:mx-6 mb-4 max-w-2xl md:mx-auto">
            <div className="card p-4 border-yellow-500/30 bg-yellow-500/5 flex items-start gap-3">
              <MailCheck className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-yellow-300">Email not verified</p>
                <p className="text-xs text-muted mt-0.5">Check your inbox or request a new link.</p>
              </div>
              <button
                onClick={resendVerification}
                disabled={resending}
                className={cn("text-xs text-accent hover:underline whitespace-nowrap", resending && "opacity-50 cursor-not-allowed")}
              >
                {resending ? "Sending…" : "Resend"}
              </button>
            </div>
          </div>
        )}

        <div className="px-4 md:px-6 space-y-4 max-w-2xl mx-auto w-full">
          <Field
            label="Full name"
            value={user.fullName || "—"}
            editing={editing === "name"}
            onEdit={() => { setName(user.fullName || ""); setEditing("name"); }}
            onCancel={() => setEditing(null)}
            onSave={() => save("name")}
          >
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field
            label="Bio"
            value={user.bio || "Tell people about yourself."}
            editing={editing === "bio"}
            onEdit={() => { setBio(user.bio || ""); setEditing("bio"); }}
            onCancel={() => setEditing(null)}
            onSave={() => save("bio")}
          >
            <textarea className="input min-h-20 resize-none" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} />
          </Field>

          <div className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-muted" />
              <div>
                <div className="font-medium">Private account</div>
                <div className="text-xs text-muted">People must request to message you.</div>
              </div>
            </div>
            <button
              onClick={togglePrivacy}
              className={`relative w-11 h-6 rounded-full transition ${user.isPrivate ? "bg-accent" : "bg-bg-panel"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${user.isPrivate ? "translate-x-5" : ""}`} />
            </button>
          </div>

          <button
            onClick={() => navigate("/blocked")}
            className="card w-full p-4 flex items-center gap-3 hover:bg-bg-panel transition"
          >
            <Shield className="w-5 h-5 text-muted" />
            <span className="font-medium">Blocked users</span>
          </button>

          <div className="border-t border-border pt-4 space-y-2">
            <button onClick={logout} className="card w-full p-4 flex items-center gap-3 hover:bg-bg-panel transition text-red-400">
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Log out</span>
            </button>
            <button onClick={logoutAll} className="card w-full p-4 flex items-center gap-3 hover:bg-bg-panel transition text-red-400/70">
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Log out of all devices</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Reusable editable field card — shows a label and read-only value, switches to
 * an editor slot when `editing` is true, exposing save/cancel controls.
 */
function Field({
  label, value, editing, children, onEdit, onCancel, onSave,
}: {
  label: string; value: string; editing: boolean; children: React.ReactNode;
  onEdit: () => void; onCancel: () => void; onSave: () => void;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase text-muted font-semibold tracking-wider mb-1">{label}</div>
          {editing ? children : <div className="text-sm">{value}</div>}
        </div>
        {editing ? (
          <div className="flex gap-1 shrink-0">
            <button onClick={onSave} className="p-1.5 bg-accent text-black rounded-lg"><Check className="w-4 h-4" /></button>
            <button onClick={onCancel} className="p-1.5 bg-bg-panel rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <button onClick={onEdit} className="p-1.5 hover:bg-bg-panel rounded-lg text-muted shrink-0">
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
