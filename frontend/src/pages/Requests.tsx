import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Check, X, Send, Trash2, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { requestApi, chatApi } from "@/api/endpoints";
import type { FriendRequest, Chat } from "@/types";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { Spinner } from "@/components/Spinner";
import { cn, formatRelative } from "@/lib/utils";
import { apiError } from "@/api/client";
import { useSocket } from "@/context/SocketContext";

export default function RequestsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"pending" | "sent" | "invites">("pending");
  const [pending, setPending] = useState<FriendRequest[]>([]);
  const [sent, setSent] = useState<FriendRequest[]>([]);
  const [invites, setInvites] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const { setPendingRequestCount, setGroupInviteCount } = useSocket();

  
  const load = async () => {
    setLoading(true);
    try {
      const [p, s, inv] = await Promise.all([
        requestApi.pending(),
        requestApi.sent(),
        chatApi.getMyInvites(),
      ]);
      setPending(p);
      setSent(s);
      setInvites(inv);
      setPendingRequestCount(p.length);
      setGroupInviteCount(inv.length);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  
  const respond = async (id: string, action: "accept" | "reject") => {
    const req = pending.find(r => {
      return r._id === id;
    });
    try {
      await requestApi.respond(id, action);
      toast.success(action === "accept" ? "Request accepted" : "Request rejected");
      setPending(p => {
        const updated = p.filter(r => {
          return r._id !== id;
        });
        setPendingRequestCount(updated.length);
        return updated;
      });
      if (action === "accept" && req) {
        try {
          const chat = await chatApi.dm(req.sender._id);
          navigate(`/chats/${chat._id}`);
        } catch {
          navigate("/chats");
        }
      }
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  
  const withdraw = async (id: string) => {
    try {
      await requestApi.withdraw(id);
      toast.success("Request withdrawn");
      setSent(s => {
        return s.filter(r => {
          return r._id !== id;
        });
      });
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  
  const acceptInvite = async (chatId: string) => {
    try {
      await chatApi.acceptInvite(chatId);
      toast.success("Joined the group!");
      setInvites(prev => {
        return prev.filter(c => {
          return c._id !== chatId;
        });
      });
      setGroupInviteCount(c => {
        return Math.max(0, c - 1);
      });
      navigate(`/chats/${chatId}`);
    } catch (e) {
      toast.error(apiError(e, "Failed to join"));
    }
  };

  
  const rejectInvite = async (chatId: string) => {
    try {
      await chatApi.rejectInvite(chatId);
      toast.success("Invite declined");
      setInvites(prev => {
        return prev.filter(c => {
          return c._id !== chatId;
        });
      });
      setGroupInviteCount(c => {
        return Math.max(0, c - 1);
      });
    } catch (e) {
      toast.error(apiError(e, "Failed to decline"));
    }
  };

  const tabs = [
    { key: "pending" as const, label: "Pending", count: pending.length },
    { key: "sent" as const, label: "Sent", count: sent.length },
    { key: "invites" as const, label: "Group Invites", count: invites.length },
  ];

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 md:px-6 pt-5 pb-3 border-b border-border bg-bg-elevated">
        <h1 className="text-2xl font-bold mb-4">Requests</h1>
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => {
            return (
              <button
                key={t.key}
                onClick={() => {
                  return setTab(t.key);
                }}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition",
                  tab === t.key ? "bg-accent text-black" : "bg-bg-panel text-muted hover:text-white"
                )}
              >
                {t.label}
                {t.count > 0 ? ` (${t.count})` : ""}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : tab === "invites" ? (
          invites.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="No group invites"
              description="When an admin invites you to a group, it will appear here."
            />
          ) : (
            invites.map(chat => {
              return (
                <div
                  key={chat._id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border/40"
                >
                  <Avatar src={chat.groupAvatar} name={chat.name || "Group"} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{chat.name}</div>
                    <div className="text-xs text-muted">{chat.members.length} members</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        return acceptInvite(chat._id);
                      }}
                      title="Join"
                      className="p-2 bg-accent text-black rounded-lg hover:bg-accent-hover transition"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        return rejectInvite(chat._id);
                      }}
                      title="Decline"
                      className="p-2 bg-bg-panel rounded-lg hover:bg-red-500/20 hover:text-red-400 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )
        ) : tab === "pending" ? (
          pending.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No pending requests"
              description="When someone wants to connect, you'll see them here."
            />
          ) : (
            pending.map(r => {
              return (
                <div
                  key={r._id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border/40"
                >
                  <Avatar src={r.sender.avatar} name={r.sender.fullName || r.sender.username} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {r.sender.fullName || r.sender.username}
                    </div>
                    <div className="text-xs text-muted">
                      @{r.sender.username} · {formatRelative(r.createdAt)}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        return respond(r._id, "accept");
                      }}
                      title="Accept"
                      className="p-2 bg-accent text-black rounded-lg hover:bg-accent-hover transition"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        return respond(r._id, "reject");
                      }}
                      title="Reject"
                      className="p-2 bg-bg-panel rounded-lg hover:bg-red-500/20 hover:text-red-400 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )
        ) : sent.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No sent requests"
            description="People you send requests to will appear here."
          />
        ) : (
          sent.map(r => {
            return (
              <div
                key={r._id}
                className="flex items-center gap-3 px-4 py-3 border-b border-border/40"
              >
                <Avatar
                  src={r.recipient.avatar}
                  name={r.recipient.fullName || r.recipient.username}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {r.recipient.fullName || r.recipient.username}
                  </div>
                  <div className="text-xs text-muted">
                    @{r.recipient.username} · {formatRelative(r.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-xs px-2 py-1 rounded-full",
                      r.status === "pending"
                        ? "bg-bg-panel text-muted"
                        : r.status === "accepted"
                          ? "bg-accent/20 text-accent"
                          : "bg-red-500/20 text-red-400"
                    )}
                  >
                    {r.status}
                  </span>
                  {r.status === "pending" && (
                    <button
                      onClick={() => {
                        return withdraw(r._id);
                      }}
                      title="Withdraw"
                      className="p-1.5 text-muted hover:text-red-400 hover:bg-bg-panel rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
