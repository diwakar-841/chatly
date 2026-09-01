import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  LogOut,
  Shield,
  Pencil,
  Check,
  X,
  Lock,
  BadgeCheck,
  MailCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { profileApi, authApi } from "@/api/endpoints";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/Spinner";
import { useAuth } from "@/store/auth";
import { disconnectSocket } from "@/lib/socket";
import { apiError } from "@/api/client";
import { cn } from "@/lib/utils";


export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, refreshToken, setUser, clear } = useAuth();
  const [editing, setEditing] = useState<"name" | "bio" | null>(null);
  const [name, setName] = useState(user?.fullName || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [uploading, setUploading] = useState(false);
  const [resending, setResending] = useState(false);

  if (!user) {
    return null;
  }

  
  const save = async (field: "name" | "bio") => {
    try {
      const u = await profileApi.update(field === "name" ? { fullName: name } : { bio });
      setUser(u);
      toast.success("Updated");
      setEditing(null);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  
  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) {
      return;
    }
    setUploading(true);
    try {
      const u = await profileApi.updateAvatar(f);
      setUser(u);
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  
  const togglePrivacy = async () => {
    try {
      const u = await profileApi.update({ isPrivate: !user.isPrivate });
      setUser(u);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  
  const resendVerification = async () => {
    setResending(true);
    try {
      await authApi.resendVerification();
      toast.success("Verification email sent!");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setResending(false);
    }
  };

  
  const logout = async () => {
    try {
      await authApi.logout(refreshToken || undefined);
    } catch {
      
    }
    disconnectSocket();
    clear();
    toast.success("Logged out");
  };

  
  const logoutAll = async () => {
    try {
      await authApi.logoutAll();
    } catch {
      
    }
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
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onAvatar}
              disabled={uploading}
            />
          </label>
          <div className="mt-4 flex items-center gap-2">
            <h2 className="text-xl font-bold">{user.fullName || user.username}</h2>
            {user.isVerified && <BadgeCheck className="w-5 h-5 text-accent" />}
          </div>
          <p className="text-muted text-sm mt-1">@{user.username}</p>
        </div>

        <div className="px-4 max-w-lg mx-auto space-y-3">
          <Field
            label="Full name"
            value={user.fullName || "Add your name"}
            editing={editing === "name"}
            onEdit={() => {
              return setEditing("name");
            }}
            onCancel={() => {
              setName(user.fullName || "");
              setEditing(null);
            }}
            onSave={() => {
              return save("name");
            }}
          >
            <input
              value={name}
              onChange={e => {
                return setName(e.target.value);
              }}
              className="input w-full text-sm"
              placeholder="Your name"
              autoFocus
            />
          </Field>

          <Field
            label="Bio"
            value={user.bio || "Add a bio"}
            editing={editing === "bio"}
            onEdit={() => {
              return setEditing("bio");
            }}
            onCancel={() => {
              setBio(user.bio || "");
              setEditing(null);
            }}
            onSave={() => {
              return save("bio");
            }}
          >
            <textarea
              value={bio}
              onChange={e => {
                return setBio(e.target.value);
              }}
              className="input w-full resize-none text-sm min-h-[60px]"
              placeholder="Tell people about yourself"
              maxLength={300}
              autoFocus
            />
          </Field>

          <div className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase text-muted font-semibold tracking-wider mb-1">
                  Email
                </div>
                <div className="text-sm truncate">{user.email}</div>
              </div>
              {user.isVerified ? (
                <span className="flex items-center gap-1 text-xs text-accent shrink-0">
                  <MailCheck className="w-4 h-4" />
                  Verified
                </span>
              ) : (
                <button
                  onClick={resendVerification}
                  disabled={resending}
                  className="flex items-center gap-1.5 text-xs text-accent shrink-0 disabled:opacity-50"
                >
                  {resending ? <Spinner className="w-4 h-4" /> : <MailCheck className="w-4 h-4" />}
                  Resend
                </button>
              )}
            </div>
          </div>

          <div className="card p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {user.isPrivate ? (
                <Lock className="w-4 h-4 text-muted" />
              ) : (
                <Shield className="w-4 h-4 text-muted" />
              )}
              <div>
                <div className="text-sm font-medium">Private account</div>
                <div className="text-xs text-muted">
                  {user.isPrivate
                    ? "Only friends can see your profile and message you"
                    : "Anyone can view your profile and send you a message"}
                </div>
              </div>
            </div>
            <button
              onClick={togglePrivacy}
              className={cn(
                "relative w-11 h-6 rounded-full transition shrink-0",
                user.isPrivate ? "bg-accent" : "bg-bg-panel"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform",
                  user.isPrivate ? "translate-x-5" : ""
                )}
              />
            </button>
          </div>

          <button
            onClick={logout}
            className="btn-ghost w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>

          <button
            onClick={logoutAll}
            className="w-full py-3 rounded-xl text-red-400 text-sm hover:bg-red-400/10 transition"
          >
            Log out from all devices
          </button>
        </div>
      </div>
    </div>
  );
}


function Field({
  label,
  value,
  editing,
  children,
  onEdit,
  onCancel,
  onSave,
}: {
  label: string;
  value: string;
  editing: boolean;
  children: React.ReactNode;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase text-muted font-semibold tracking-wider mb-1">
            {label}
          </div>
          {editing ? children : <div className="text-sm">{value}</div>}
        </div>
        {editing ? (
          <div className="flex gap-1 shrink-0">
            <button onClick={onSave} className="p-1.5 bg-accent text-black rounded-lg">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={onCancel} className="p-1.5 bg-bg-panel rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-bg-panel rounded-lg text-muted shrink-0"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
