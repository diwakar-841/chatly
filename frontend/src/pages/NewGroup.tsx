import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Check, Loader2, Lock, Globe } from "lucide-react";
import toast from "react-hot-toast";
import { chatApi, profileApi } from "@/api/endpoints";
import type { User } from "@/types";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/Spinner";
import { apiError } from "@/api/client";
import { cn } from "@/lib/utils";

/** Wizard page for creating a new group chat with optional member invites. */
export default function NewGroupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);

  /** Debounced user search — fires 300 ms after the last keystroke. */
  useEffect(() => {
    const id = setTimeout(async () => {
      if (!q.trim()) return setUsers([]);
      setSearching(true);
      try {
        const result = await profileApi.search(q.trim(), 1);
        setUsers(result.data);
      } catch {/* */}
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  /** Toggles a user into or out of the selected-members list. */
  const toggle = (u: User) =>
    setSelected((p) => (p.some((x) => x._id === u._id) ? p.filter((x) => x._id !== u._id) : [...p, u]));

  /** Submits the group creation request and navigates to the new chat room. */
  const create = async () => {
    if (!name.trim()) return toast.error("Group name required");
    setCreating(true);
    try {
      const chat = await chatApi.createGroup({
        name: name.trim(),
        description: description.trim(),
        isPublic,
        members: selected.map((u) => u._id),
      });
      if (selected.length > 0) {
        toast.success(`Group created — ${selected.length} invite${selected.length > 1 ? "s" : ""} sent`);
      } else {
        toast.success("Group created");
      }
      navigate(`/chats/${chat._id}`);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-elevated shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-bg-panel rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">New Group</h1>
      </header>

      <div className="p-4 space-y-3 border-b border-border shrink-0">
        <input
          className="input"
          placeholder="Group name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <textarea
          className="input min-h-[72px] resize-none text-sm"
          placeholder="Group description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
        />

        <div className="card p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isPublic
              ? <Globe className="w-4 h-4 text-accent" />
              : <Lock className="w-4 h-4 text-muted" />}
            <div>
              <div className="text-sm font-medium">{isPublic ? "Public group" : "Private group"}</div>
              <div className="text-xs text-muted">
                {isPublic
                  ? "Anyone can join directly; you can invite by sending an invite"
                  : "Invite-only; users can also request to join"}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsPublic((p) => !p)}
            className={cn(
              "relative w-11 h-6 rounded-full transition",
              isPublic ? "bg-accent" : "bg-bg-panel"
            )}
          >
            <span className={cn(
              "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform",
              isPublic ? "translate-x-5" : ""
            )} />
          </button>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.map((u) => (
              <button
                key={u._id}
                onClick={() => toggle(u)}
                className="bg-bg-panel rounded-full pl-1 pr-3 py-1 flex items-center gap-1.5 text-sm hover:bg-red-500/10 hover:text-red-400 transition"
              >
                <Avatar src={u.avatar} name={u.username} size={24} />
                {u.username}
                <span className="text-muted">×</span>
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            className="input pl-10 rounded-full"
            placeholder="Search users to invite… (optional)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {searching && (
            <Loader2 className="w-4 h-4 animate-spin text-muted absolute right-3.5 top-1/2 -translate-y-1/2" />
          )}
        </div>

        {selected.length > 0 && (
          <p className="text-xs text-muted px-1">
            Selected users will receive an invite and must accept to join.
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-36">
        {users.map((u) => {
          const sel = selected.some((s) => s._id === u._id);
          return (
            <button
              key={u._id}
              onClick={() => toggle(u)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-panel text-left transition"
            >
              <Avatar src={u.avatar} name={u.fullName || u.username} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{u.fullName || u.username}</div>
                <div className="text-sm text-muted truncate">@{u.username}</div>
              </div>
              {sel && (
                <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 text-black" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 bg-gradient-to-t from-bg to-transparent pt-6 pointer-events-none">
        <button
          onClick={create}
          disabled={creating || !name.trim()}
          className="pointer-events-auto w-full py-3.5 rounded-2xl bg-accent text-black font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95"
        >
          {creating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating…
            </>
          ) : selected.length > 0 ? (
            `Create & Invite ${selected.length} User${selected.length > 1 ? "s" : ""}`
          ) : (
            "Create Group"
          )}
        </button>
      </div>
    </div>
  );
}
