import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Search, MessageCircle, UserPlus, Loader2, X, Users, Globe, Lock } from "lucide-react";
import { chatApi, profileApi, requestApi, blockApi } from "@/api/endpoints";
import type { Chat, User, GroupResult } from "@/types";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/store/auth";
import { useSocket } from "@/context/SocketContext";
import { formatChatTime, cn } from "@/lib/utils";
import { apiError } from "@/api/client";
import toast from "react-hot-toast";

type FilterTab = "all" | "unread" | "groups" | "blocked";

/** Main chats list — shows existing conversations and lets users search for contacts and groups. */
export default function ChatsPage() {
  const me = useAuth((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const { socket, onlineUsers } = useSocket();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [contactResults, setContactResults] = useState<User[]>([]);
  const [groupResults, setGroupResults] = useState<GroupResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [contactHasMore, setContactHasMore] = useState(false);
  const [contactPage, setContactPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Set<string> | null>(null);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [groupActions, setGroupActions] = useState<Record<string, "joined" | "requested">>({});

  /** Loads the chat list and blocked-user IDs on each navigation to this page. */
  useEffect(() => {
    setLoading(true);
    chatApi.list()
      .then(setChats)
      .catch((e) => toast.error(apiError(e, "Failed to load chats")))
      .finally(() => setLoading(false));
    blockApi
      .list()
      .then((list) => setBlockedIds(new Set(list.map((u: { _id: string }) => u._id))))
      .catch(() => {});
  }, [location.key]);

  /** Keeps the chat list in sync with real-time socket events (new messages, read receipts, new chats). */
  useEffect(() => {
    if (!socket) return;

    const onNew = (msg: { chat: string; content?: string; type?: string; createdAt: string }) => {
      setChats((prev) => {
        const idx = prev.findIndex((c) => c._id === msg.chat);
        if (idx === -1) return prev;
        const updated = {
          ...prev[idx],
          lastMessage: msg as unknown as Chat["lastMessage"],
          updatedAt: msg.createdAt,
          unreadCount: (prev[idx].unreadCount || 0) + 1,
        };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      });
    };

    const onRead = ({ chatId }: { chatId: string }) => {
      setChats((prev) => prev.map((c) => (c._id === chatId ? { ...c, unreadCount: 0 } : c)));
    };

    const onNewChat = (newChat: Chat) => {
      setChats((prev) => prev.find((c) => c._id === newChat._id) ? prev : [newChat, ...prev]);
    };

    socket.on("message:new", onNew);
    socket.on("chat:read", onRead);
    socket.on("chat:new", onNewChat);

    return () => {
      socket.off("message:new", onNew);
      socket.off("chat:read", onRead);
      socket.off("chat:new", onNewChat);
    };
  }, [socket]);

  /** Debounced dual search — runs user and group searches independently in parallel. */
  useEffect(() => {
    if (!q.trim()) {
      setContactResults([]);
      setGroupResults([]);
      setContactHasMore(false);
      setContactPage(1);
      return;
    }
    setSearching(true);
    setContactPage(1);
    const id = setTimeout(async () => {
      try {
        const userResult = await profileApi.search(q.trim(), 1);
        const existingIds = new Set(
          chats.filter((c) => !c.isGroup).flatMap((c) => c.members.map((m) => m._id))
        );
        setContactResults(userResult.data.filter((u) => u._id !== me?._id && !existingIds.has(u._id)));
        setContactHasMore(userResult.hasMore);
      } catch {
        setContactResults([]);
      }

      try {
        const groupResult = await chatApi.searchGroups(q.trim(), 1);
        const existingGroupIds = new Set(chats.filter((c) => c.isGroup).map((c) => c._id));
        setGroupResults(groupResult.data.filter((g: GroupResult) => !existingGroupIds.has(g._id)));
      } catch {
        setGroupResults([]);
      }

      setSearching(false);
    }, 300);
    return () => clearTimeout(id);
  }, [q, chats, me]);

  /** Fetches the next page of user search results and appends them to the list. */
  const loadMoreContacts = async () => {
    if (loadingMore || !contactHasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = contactPage + 1;
      const result = await profileApi.search(q.trim(), nextPage);
      setContactResults((prev) => [...prev, ...result.data]);
      setContactHasMore(result.hasMore);
      setContactPage(nextPage);
    } catch {/* */}
    finally { setLoadingMore(false); }
  };

  /** Opens or creates a DM with the given user and navigates into it. */
  const openDM = async (userId: string) => {
    setActionLoading(userId);
    try {
      const chat = await chatApi.dm(userId);
      navigate(`/chats/${chat._id}`);
    } catch (e) {
      toast.error(apiError(e, "Could not open chat"));
    } finally {
      setActionLoading(null);
    }
  };

  /** Sends a friend request to a private user found in search results. */
  const sendRequest = async (userId: string) => {
    setActionLoading(userId);
    try {
      await requestApi.send(userId);
      setSentRequests((p) => new Set(p).add(userId));
      toast.success("Friend request sent");
    } catch (e) {
      toast.error(apiError(e, "Failed to send request"));
    } finally {
      setActionLoading(null);
    }
  };

  /** Requests to join (or directly joins if public) a group found in search results. */
  const joinGroup = async (group: GroupResult) => {
    setActionLoading(group._id);
    try {
      const result = await chatApi.requestJoin(group._id) as { joined: boolean; message: string };
      if (result.joined) {
        toast.success("Joined the group!");
        navigate(`/chats/${group._id}`);
      } else {
        setGroupActions((p) => ({ ...p, [group._id]: "requested" }));
        toast.success("Join request sent");
      }
    } catch (e) {
      toast.error(apiError(e, "Action failed"));
    } finally {
      setActionLoading(null);
    }
  };

  const otherMember = (c: Chat) => c.members.find((m) => m._id !== me?._id) || c.members[0];
  const unreadCount = chats.filter((c) => (c.unreadCount || 0) > 0).length;

  const tabFilteredChats = chats.filter((c) => {
    if (activeTab === "unread") return (c.unreadCount || 0) > 0;
    if (activeTab === "groups") return c.isGroup;
    return true;
  });

  const visibleChats = q.trim()
    ? tabFilteredChats.filter((c) => {
        const name = c.isGroup
          ? c.name?.toLowerCase()
          : (otherMember(c)?.fullName || otherMember(c)?.username || "").toLowerCase();
        return name?.includes(q.toLowerCase());
      })
    : tabFilteredChats;

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: unreadCount > 0 ? `Unread ${unreadCount}` : "Unread" },
    { key: "groups", label: "Groups" },
    { key: "blocked", label: "Blocked" },
  ];

  /** Renders a single row in the existing chats list. */
  const renderChatRow = (c: Chat) => {
    const other = c.isGroup ? null : otherMember(c);
    const title = c.isGroup ? c.name : other?.fullName || other?.username || "Unknown";
    const online =
      other &&
      blockedIds !== null &&
      !blockedIds.has(other._id) &&
      onlineUsers.has(other._id);
    const lastMsg = c.lastMessage;
    const lastText = lastMsg?.content ||
      (lastMsg?.type === "image" ? "📷 Photo" : lastMsg?.type === "file" ? "📎 File" : "No messages yet");
    const hasUnread = (c.unreadCount || 0) > 0;
    const avatarPath = c.isGroup ? `/chats/${c._id}/info` : other ? `/profile/${other._id}` : null;

    return (
      <div
        key={c._id}
        className="flex items-center gap-3 px-4 border-b border-border/40 hover:bg-bg-panel transition"
      >
        {avatarPath ? (
          <Link to={avatarPath} className="shrink-0 py-3" onClick={(e) => e.stopPropagation()}>
            <Avatar src={c.isGroup ? c.groupAvatar : other?.avatar} name={title || ""} online={online ?? false} size={48} />
          </Link>
        ) : (
          <div className="shrink-0 py-3">
            <Avatar src={c.isGroup ? c.groupAvatar : other?.avatar} name={title || ""} online={online ?? false} size={48} />
          </div>
        )}
        <Link to={`/chats/${c._id}`} className="flex-1 min-w-0 py-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className={cn("truncate", hasUnread ? "font-bold text-white" : "font-medium")}>{title}</h3>
            <span className={cn("text-xs shrink-0", hasUnread ? "text-accent font-semibold" : "text-muted")}>
              {formatChatTime(c.updatedAt)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className={cn("text-sm truncate", hasUnread ? "text-white/80" : "text-muted")}>{lastText}</p>
            {hasUnread && (
              <span className="bg-accent text-black text-[11px] font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center shrink-0">
                {c.unreadCount! > 99 ? "99+" : c.unreadCount}
              </span>
            )}
          </div>
        </Link>
      </div>
    );
  };

  /** Renders a user row in the search results with context-aware action button. */
  const renderContactRow = (u: User) => {
    const isLoading = actionLoading === u._id;
    const requestSent = sentRequests.has(u._id);
    const friendStatus = u.friendStatus ?? "none";
    const isAccepted = friendStatus === "accepted";
    const isPending = friendStatus === "pending" || requestSent;

    return (
      <div
        key={u._id}
        className="flex items-center gap-3 px-4 py-3 border-b border-border/40 hover:bg-bg-panel transition"
      >
        <Link to={`/profile/${u._id}`} className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <Avatar src={u.avatar} name={u.fullName || u.username} />
        </Link>
        <Link to={`/profile/${u._id}`} className="flex-1 min-w-0">
          <div className="font-medium truncate flex items-center gap-1">
            {u.fullName || u.username}
            {u.isVerified && <span className="text-accent text-xs">✓</span>}
          </div>
          <div className="text-sm text-muted truncate">@{u.username}</div>
        </Link>
        {isAccepted ? (
          <button
            onClick={() => openDM(u._id)}
            disabled={isLoading}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent/10 text-accent hover:bg-accent hover:text-black transition"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><MessageCircle className="w-3.5 h-3.5" /> Message</>}
          </button>
        ) : isPending ? (
          <button disabled className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-bg-panel text-muted cursor-default">
            Sent
          </button>
        ) : u.isPrivate ? (
          <button
            onClick={() => sendRequest(u._id)}
            disabled={isLoading}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent/10 text-accent hover:bg-accent hover:text-black transition"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><UserPlus className="w-3.5 h-3.5" /> Add</>}
          </button>
        ) : (
          <button
            onClick={() => openDM(u._id)}
            disabled={isLoading}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent/10 text-accent hover:bg-accent hover:text-black transition"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><MessageCircle className="w-3.5 h-3.5" /> Message</>}
          </button>
        )}
      </div>
    );
  };

  /** Renders a group row in the search results with join/message/request button. */
  const renderGroupSearchRow = (g: GroupResult) => {
    const isLoading = actionLoading === g._id;
    const action = groupActions[g._id];
    const isMember = g.isMember || action === "joined";
    let buttonContent: React.ReactNode;
    let buttonClass = "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition";
    let onClickHandler: (() => void) | undefined;
    let isDisabled = false;

    if (isMember) {
      buttonContent = <><MessageCircle className="w-3.5 h-3.5" /> Message</>;
      buttonClass += " bg-accent/10 text-accent hover:bg-accent hover:text-black";
      onClickHandler = () => navigate(`/chats/${g._id}`);
    } else if (action === "requested" || g.hasRequested) {
      buttonContent = "Requested";
      buttonClass += " bg-bg-panel text-muted cursor-default";
      isDisabled = true;
    } else if (g.isPublic) {
      buttonContent = isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Users className="w-3.5 h-3.5" /> Join</>;
      buttonClass += " bg-accent/10 text-accent hover:bg-accent hover:text-black";
      onClickHandler = () => joinGroup(g);
      isDisabled = isLoading;
    } else {
      buttonContent = isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><UserPlus className="w-3.5 h-3.5" /> Request</>;
      buttonClass += " bg-accent/10 text-accent hover:bg-accent hover:text-black";
      onClickHandler = () => joinGroup(g);
      isDisabled = isLoading;
    }

    return (
      <div key={g._id} className="flex items-center gap-3 px-4 py-3 border-b border-border/40 hover:bg-bg-panel transition">
        <div className="shrink-0">
          <Avatar src={g.groupAvatar} name={g.name} size={48} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate flex items-center gap-1.5">
            {g.name}
            {g.isPublic ? <Globe className="w-3 h-3 text-accent shrink-0" /> : <Lock className="w-3 h-3 text-muted shrink-0" />}
          </div>
          <div className="text-sm text-muted truncate">
            {g.memberCount} member{g.memberCount !== 1 ? "s" : ""}{g.description ? ` · ${g.description}` : ""}
          </div>
        </div>
        <button onClick={onClickHandler} disabled={isDisabled} className={buttonClass}>
          {buttonContent}
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 md:px-6 pt-5 pb-3 border-b border-border bg-bg-elevated shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Chatly</h1>
          <Link to="/new-group" className="btn-ghost p-2" title="New group">
            <UserPlus className="w-5 h-5" />
          </Link>
        </div>
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users or groups…"
            className="input pl-10 pr-9 rounded-full"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => tab.key === "blocked" ? navigate("/blocked") : setActiveTab(tab.key)}
              className={cn(
                "shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition",
                activeTab === tab.key && tab.key !== "blocked"
                  ? "bg-accent text-black"
                  : "bg-bg-panel text-muted hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {q.trim() ? (
          <div>
            {visibleChats.filter((c) => !c.isGroup).length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 text-xs uppercase text-muted font-semibold tracking-wider">Chats</div>
                {visibleChats.filter((c) => !c.isGroup).map(renderChatRow)}
              </>
            )}
            {visibleChats.filter((c) => c.isGroup).length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1 text-xs uppercase text-muted font-semibold tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> My Groups
                </div>
                {visibleChats.filter((c) => c.isGroup).map(renderChatRow)}
              </>
            )}
            {(groupResults.length > 0 || (searching && q.trim().length > 0)) && (
              <>
                <div className="px-4 pt-3 pb-1 text-xs uppercase text-muted font-semibold tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Groups {searching && <Loader2 className="w-3 h-3 animate-spin" />}
                </div>
                {groupResults.map(renderGroupSearchRow)}
              </>
            )}
            <div className="px-4 pt-3 pb-1 text-xs uppercase text-muted font-semibold tracking-wider flex items-center gap-1.5">
              People {searching && <Loader2 className="w-3 h-3 animate-spin" />}
            </div>
            {contactResults.length === 0 && !searching ? (
              visibleChats.length === 0 && groupResults.length === 0
                ? <EmptyState icon={Search} title="No results found" />
                : <p className="px-4 py-2 text-sm text-muted">No new contacts found</p>
            ) : (
              <>
                {contactResults.map(renderContactRow)}
                {contactHasMore && (
                  <div className="flex justify-center py-3">
                    <button onClick={loadMoreContacts} disabled={loadingMore} className="btn-ghost text-sm text-muted">
                      {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load more"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : visibleChats.length === 0 ? (
          <EmptyState
            icon={activeTab === "groups" ? Users : MessageCircle}
            title={activeTab === "unread" ? "No unread chats" : activeTab === "groups" ? "No groups yet" : "No chats yet"}
            description={activeTab === "all" ? "Search for a user or group above to start a conversation." : undefined}
          />
        ) : (
          visibleChats.map(renderChatRow)
        )}
      </div>
    </div>
  );
}
