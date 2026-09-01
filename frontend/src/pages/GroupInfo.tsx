import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  UserMinus,
  Camera,
  LogOut,
  Pin,
  UserPlus,
  Check,
  X,
  Globe,
  Lock,
  Users,
  Search,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { chatApi, profileApi } from "@/api/endpoints";
import type { Chat, User } from "@/types";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/Spinner";
import { useAuth } from "@/store/auth";
import { apiError } from "@/api/client";
import { cn } from "@/lib/utils";


export default function GroupInfoPage() {
  const { chatId = "" } = useParams();
  const me = useAuth(s => {
    return s.user;
  });
  const navigate = useNavigate();

  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [handlingRequest, setHandlingRequest] = useState<string | null>(null);
  const [showAddSearch, setShowAddSearch] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingMember, setAddingMember] = useState<string | null>(null);
  const searchTimer = useRef<number>();

  useEffect(() => {
    chatApi
      .get(chatId)
      .then(c => {
        setChat(c);
        setName(c?.name || "");
        setDescription(c?.description || "");
      })
      .catch(() => {
        return setChat(null);
      })
      .finally(() => {
        return setLoading(false);
      });
  }, [chatId]);

  const adminIds = (chat?.admins || []).map(a => {
    return typeof a === "string" ? a : (a as unknown as { _id: string })._id;
  });

  const isAdmin = adminIds.includes(me?._id || "") || chat?.creator === me?._id;
  const isMember = chat?.members.some(m => {
    return m._id === me?._id;
  });
  const hasRequested = chat?.joinRequests?.includes(me?._id || "") ?? false;
  const pinnedCount = chat?.pinnedMessages?.length || 0;
  const joinRequests = (chat?.joinRequests as unknown as User[]) || [];

  
  useEffect(() => {
    if (!showAddSearch) {
      return;
    }
    window.clearTimeout(searchTimer.current);
    if (!searchQ.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const result = await profileApi.search(searchQ.trim(), 1);
        const memberIds = new Set(
          chat?.members.map(m => {
            return m._id;
          }) || []
        );
        setSearchResults(
          result.data.filter(u => {
            return !memberIds.has(u._id);
          })
        );
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      return window.clearTimeout(searchTimer.current);
    };
  }, [searchQ, showAddSearch, chat?.members]);

  
  const addMember = async (user: User) => {
    setAddingMember(user._id);
    try {
      await chatApi.addMembers(chatId, [user._id]);
      setSearchResults(p => {
        return p.filter(u => {
          return u._id !== user._id;
        });
      });
      toast.success(`Invite sent to ${user.fullName || user.username}`);
    } catch (e) {
      toast.error(apiError(e, "Failed to send invite"));
    } finally {
      setAddingMember(null);
    }
  };

  
  const updateName = async () => {
    if (!name.trim() || name === chat?.name) {
      return;
    }
    try {
      const c = await chatApi.update(chatId, { name });
      setChat(c);
      toast.success("Name updated");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  
  const updateDescription = async () => {
    if (description === (chat?.description || "")) {
      return;
    }
    try {
      const { api } = await import("@/api/client");
      const res = await api.put<Chat>(`/chats/${chatId}`, { description });
      setChat(res.data);
      toast.success("Description updated");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  
  const updateAvatar = async (file: File) => {
    try {
      const c = await chatApi.update(chatId, { file });
      setChat(c);
      toast.success("Avatar updated");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  
  const removeMember = async (memberId: string) => {
    if (!confirm("Remove this member?")) {
      return;
    }
    try {
      const c = await chatApi.removeMember(chatId, memberId);
      setChat(c);
      toast.success("Member removed");
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  
  const leaveGroup = async () => {
    if (!confirm("Leave this group?")) {
      return;
    }
    setLeaving(true);
    try {
      await chatApi.leave(chatId);
      toast.success("You left the group");
      navigate("/chats");
    } catch (e) {
      toast.error(apiError(e));
      setLeaving(false);
    }
  };

  
  const requestJoin = async () => {
    try {
      const result = (await chatApi.requestJoin(chatId)) as { joined: boolean; message: string };
      if (result.joined) {
        toast.success("Joined the group!");
      } else {
        toast.success("Join request sent!");
      }
      const c = await chatApi.get(chatId);
      setChat(c);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  
  const handleJoinRequest = async (userId: string, action: "accept" | "reject") => {
    setHandlingRequest(userId);
    try {
      const updated = await chatApi.handleJoinRequest(chatId, userId, action);
      setChat(updated);
      toast.success(action === "accept" ? "Member added!" : "Request rejected");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setHandlingRequest(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  if (!chat) {
    return <div className="p-8 text-muted text-center">Group not found</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-elevated">
        <button
          onClick={() => {
            return navigate(-1);
          }}
          className="p-1.5 hover:bg-bg-panel rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Group info</h1>
      </header>

      <div className="overflow-y-auto pb-20">
        <div className="flex flex-col items-center py-8 border-b border-border px-4">
          <label className={cn("relative", isAdmin && "cursor-pointer")}>
            <Avatar src={chat.groupAvatar} name={chat.name} size={120} />
            {isAdmin && (
              <>
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition">
                  <Camera className="w-6 h-6" />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={e => {
                    return e.target.files?.[0] && updateAvatar(e.target.files[0]);
                  }}
                />
              </>
            )}
          </label>

          <div className="mt-4 w-full max-w-sm">
            <input
              className="input text-center text-lg font-semibold"
              value={name}
              onChange={e => {
                return setName(e.target.value);
              }}
              onBlur={updateName}
              disabled={!isAdmin}
              placeholder="Group name"
            />
          </div>

          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-muted flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {chat.members.length} members
            </span>
            <span
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                chat.isPublic ? "bg-accent/10 text-accent" : "bg-bg-panel text-muted"
              )}
            >
              {chat.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {chat.isPublic ? "Public" : "Private"}
            </span>
          </div>

          <div className="w-full max-w-sm mt-3">
            <textarea
              className="input resize-none text-sm min-h-[60px]"
              value={description}
              onChange={e => {
                return setDescription(e.target.value);
              }}
              onBlur={updateDescription}
              disabled={!isAdmin}
              placeholder={isAdmin ? "Add a group description…" : "No description"}
              maxLength={300}
            />
          </div>
        </div>

        {pinnedCount > 0 && (
          <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3 text-sm text-muted">
            <Pin className="w-4 h-4 text-accent" />
            <span>
              {pinnedCount} pinned message{pinnedCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {isAdmin && joinRequests.length > 0 && (
          <div className="p-4 border-b border-border">
            <div className="text-xs uppercase font-semibold text-accent tracking-wider mb-3 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" />
              Join Requests ({joinRequests.length})
            </div>
            {joinRequests.map(u => {
              return (
                <div key={u._id} className="flex items-center gap-3 py-2.5">
                  <Avatar src={u.avatar} name={u.fullName || u.username} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{u.fullName || u.username}</div>
                    <div className="text-sm text-muted truncate">@{u.username}</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => {
                        return handleJoinRequest(u._id, "accept");
                      }}
                      disabled={handlingRequest === u._id}
                      className="w-8 h-8 rounded-full bg-accent/10 text-accent hover:bg-accent hover:text-black flex items-center justify-center transition"
                      title="Accept"
                    >
                      {handlingRequest === u._id ? (
                        <Spinner className="w-4 h-4" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        return handleJoinRequest(u._id, "reject");
                      }}
                      disabled={handlingRequest === u._id}
                      className="w-8 h-8 rounded-full bg-red-400/10 text-red-400 hover:bg-red-400 hover:text-white flex items-center justify-center transition"
                      title="Reject"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase font-semibold text-muted tracking-wider">Members</div>
            {isAdmin && (
              <button
                onClick={() => {
                  setShowAddSearch(p => {
                    return !p;
                  });
                  setSearchQ("");
                  setSearchResults([]);
                }}
                className="flex items-center gap-1 text-xs text-accent hover:underline"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {showAddSearch ? "Close" : "Add member"}
              </button>
            )}
          </div>

          {isAdmin && showAddSearch && (
            <div className="mb-3 rounded-xl bg-bg-panel p-3 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  autoFocus
                  value={searchQ}
                  onChange={e => {
                    return setSearchQ(e.target.value);
                  }}
                  placeholder="Search by name or @username…"
                  className="input pl-9 rounded-full text-sm"
                />
                {searching && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted absolute right-3 top-1/2 -translate-y-1/2" />
                )}
              </div>
              {searchQ.trim() && !searching && searchResults.length === 0 && (
                <p className="text-sm text-muted text-center py-2">No users found</p>
              )}
              {searchResults.map(u => {
                return (
                  <div key={u._id} className="flex items-center gap-3 py-1.5">
                    <Avatar src={u.avatar} name={u.fullName || u.username} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{u.fullName || u.username}</div>
                      <div className="text-xs text-muted truncate">@{u.username}</div>
                    </div>
                    <button
                      onClick={() => {
                        return addMember(u);
                      }}
                      disabled={addingMember === u._id}
                      className="shrink-0 w-8 h-8 rounded-full bg-accent/10 text-accent hover:bg-accent hover:text-black flex items-center justify-center transition"
                      title="Add"
                    >
                      {addingMember === u._id ? (
                        <Spinner className="w-4 h-4" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {chat.members.map(m => {
            return (
              <div key={m._id} className="flex items-center gap-3 py-2.5">
                <Avatar src={m.avatar} name={m.fullName || m.username} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate flex items-center gap-1.5">
                    {m.fullName || m.username}
                    {(adminIds.includes(m._id) || chat.creator === m._id) && (
                      <span className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted truncate">@{m.username}</div>
                </div>
                {isAdmin && m._id !== me?._id && (
                  <button
                    onClick={() => {
                      return removeMember(m._id);
                    }}
                    className="p-2 text-red-400 hover:bg-bg-panel rounded-lg transition"
                    title="Remove"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!isMember && chat.isPublic && (
          <div className="px-4 pb-4">
            <button
              onClick={requestJoin}
              disabled={hasRequested}
              className="w-full btn-primary py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <UserPlus className="w-4 h-4" />
              Join Group
            </button>
          </div>
        )}

        {!isMember && !chat.isPublic && (
          <div className="px-4 pb-4">
            {hasRequested ? (
              <div className="card p-4 flex items-center gap-3 text-sm text-accent">
                <UserPlus className="w-4 h-4 shrink-0" />
                Request sent — waiting for admin approval
              </div>
            ) : (
              <button
                onClick={requestJoin}
                className="w-full btn-primary py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Request to Join
              </button>
            )}
          </div>
        )}

        {isMember && (
          <div className="px-4 pb-4">
            <button
              onClick={leaveGroup}
              disabled={leaving}
              className="w-full card p-4 flex items-center gap-3 hover:bg-bg-panel transition text-red-400"
            >
              {leaving ? <Spinner className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
              <span className="font-medium">Leave group</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
