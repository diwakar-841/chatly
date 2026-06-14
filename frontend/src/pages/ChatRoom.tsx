import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Send, Paperclip, Trash2, Reply, X, MoreVertical,
  Users, Pin, ChevronUp, EyeOff, UserMinus, Check, CheckCheck,
  Phone, Video,
} from "lucide-react";
import toast from "react-hot-toast";
import { chatApi, messageApi, blockApi, requestApi, profileApi } from "@/api/endpoints";
import type { Chat, Message } from "@/types";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/Spinner";
import { useAuth } from "@/store/auth";
import { useSocket } from "@/context/SocketContext";
import { useCall } from "@/context/CallContext";
import { formatTime, cn } from "@/lib/utils";
import { apiError } from "@/api/client";
import { format, isToday, isYesterday } from "date-fns";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

/** Converts an ISO timestamp to a human-readable date label for message group separators. */
function dateSeparator(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
}

/** Renders a delivery/read tick for messages sent by the current user. */
function StatusTick({ status, mine }: { status?: string; mine: boolean }) {
  if (!mine || !status) return null;
  if (status === "read")
    return <CheckCheck className="w-3 h-3 text-[#53bdeb] inline-block shrink-0" />;
  if (status === "delivered")
    return <CheckCheck className="w-3 h-3 text-muted inline-block shrink-0" />;
  return <Check className="w-3 h-3 text-muted inline-block shrink-0" />;
}

/** Full-screen chat room — handles messages, real-time events, reactions, replies, and moderation. */
export default function ChatRoomPage() {
  const { chatId = "" } = useParams();
  const navigate = useNavigate();
  const me = useAuth((s) => s.user);
  const { socket, onlineUsers, removeOnlineUser } = useSocket();
  const { startCall, status: callStatus } = useCall();

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedByThem, setBlockedByThem] = useState(false);
  const [isFriend, setIsFriend] = useState(true);
  const [menuLoading, setMenuLoading] = useState<string | null>(null);

  const isBlocked = blockedByMe || blockedByThem;

  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number>();

  /** Resolves the other participant for 1-to-1 chats. */
  const other = useMemo(() => {
    if (!chat || chat.isGroup) return null;
    return chat.members.find((m) => m._id !== me?._id) || chat.members[0];
  }, [chat, me]);

  const title = chat?.isGroup ? chat.name : other?.fullName || other?.username || "";
  const online = other && !isBlocked && (isFriend || other.isPrivate === false) && onlineUsers.has(other._id);
  const isAdmin = chat?.admins?.includes(me?._id || "") || chat?.creator === me?._id;

  /** Fetches a page of messages, optionally prepending them for infinite-scroll. */
  const loadMessages = useCallback(
    async (chatId: string, pg: number, prepend = false) => {
      const result = await chatApi.messages(chatId, pg);
      const msgs = result.data;
      setHasMore(result.hasMore);
      if (prepend) {
        setMessages((prev) => [...msgs, ...prev]);
      } else {
        setMessages(msgs);
      }
      return msgs;
    },
    []
  );

  /** Loads the chat metadata, first page of messages, and block/friendship status on mount. */
  useEffect(() => {
    if (!chatId) return;
    setLoading(true);
    setPage(1);
    Promise.all([chatApi.get(chatId), loadMessages(chatId, 1)])
      .then(([c]) => {
        setChat(c);
        if (c && !c.isGroup) {
          const otherId = c.members.find((m) => m._id !== me?._id)?._id;
          if (otherId) {
            Promise.all([blockApi.checkBlock(otherId), profileApi.requestStatus(otherId)])
              .then(([b, req]) => {
                setBlockedByMe(b.blockedByMe);
                setBlockedByThem(b.blockedByThem);
                setIsFriend(req.status === "accepted");
              })
              .catch(() => {});
          }
        }
      })
      .catch((e) => toast.error(apiError(e, "Failed to load chat")))
      .finally(() => setLoading(false));
    messageApi.markRead(chatId).catch(() => {});
  }, [chatId, loadMessages, me?._id]);

  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [loading]);

  /** Scrolls smoothly to the bottom anchor element. */
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (nearBottom) scrollToBottom();
  }, [messages, typingUser, scrollToBottom]);

  /** Registers socket event listeners and joins the chat room channel. */
  useEffect(() => {
    if (!socket || !chatId) return;
    socket.emit("chat:join", chatId);

    const onNew = (msg: Message) => {
      if (msg.chat === chatId) {
        setMessages((p) => p.some((m) => m._id === msg._id) ? p : [...p, msg]);
        messageApi.markRead(chatId).catch(() => {});
      }
    };
    const onDeleted = ({ messageId }: { messageId: string }) =>
      setMessages((p) => p.map((m) => m._id === messageId ? { ...m, deleted: true, content: "" } : m));
    const onReaction = ({ messageId, reactions }: { messageId: string; reactions: Message["reactions"] }) =>
      setMessages((p) => p.map((m) => m._id === messageId ? { ...m, reactions } : m));
    const onTyping = (d: { chatId: string; username: string; isTyping: boolean }) => {
      if (d.chatId !== chatId) return;
      if (isBlocked) return;
      setTypingUser(d.isTyping ? d.username : null);
    };
    const onPinned = (updatedChat: Chat) => {
      if (updatedChat._id === chatId) setChat(updatedChat);
    };
    const onCleared = ({ forBoth, senderId }: { chatId: string; forBoth: boolean; senderId?: string }) => {
      if (forBoth && senderId) {
        setMessages((p) => p.filter((m) => {
          const msgSender = typeof m.sender === "string" ? m.sender : m.sender._id;
          return msgSender !== senderId;
        }));
      } else if (forBoth) {
        setMessages([]);
      }
    };
    const onStatusChanged = ({ chatId: cId, status, by }: { chatId: string; status: string; by: string }) => {
      if (cId !== chatId) return;
      if (status === "blocked") {
        if (by === me?._id) setBlockedByMe(true);
        else { setBlockedByThem(true); setTypingUser(null); }
        removeOnlineUser(by);
      } else if (status === "unblocked") {
        if (by === me?._id) {
          setBlockedByMe(false);
        } else {
          setBlockedByThem(false);
        }
        setIsFriend(true);
      } else if (status === "unfriended") {
        setIsFriend(false);
        setTypingUser(null);
        removeOnlineUser(by);
      }
    };

    socket.on("message:new", onNew);
    socket.on("message:deleted", onDeleted);
    socket.on("message:reaction", onReaction);
    socket.on("chat:typing", onTyping);
    socket.on("chat:pinned", onPinned);
    socket.on("chat:cleared", onCleared);
    socket.on("chat:status_changed", onStatusChanged);

    return () => {
      socket.emit("chat:leave", chatId);
      socket.off("message:new", onNew);
      socket.off("message:deleted", onDeleted);
      socket.off("message:reaction", onReaction);
      socket.off("chat:typing", onTyping);
      socket.off("chat:pinned", onPinned);
      socket.off("chat:cleared", onCleared);
      socket.off("chat:status_changed", onStatusChanged);
    };
  }, [socket, chatId, isBlocked, me?._id, removeOnlineUser]);

  /** Loads the next older page of messages, preserving the current scroll position. */
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const el = scrollRef.current;
      const prevScrollHeight = el?.scrollHeight || 0;
      await loadMessages(chatId, nextPage, true);
      setPage(nextPage);
      if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - prevScrollHeight; });
    } catch (e) {
      toast.error(apiError(e, "Failed to load more messages"));
    } finally {
      setLoadingMore(false);
    }
  };

  /** Updates input text and emits a typing indicator with auto-stop after 1.5 s. */
  const onType = (v: string) => {
    setText(v);
    if (!socket) return;
    socket.emit("chat:typing", { chatId, isTyping: true });
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      socket.emit("chat:typing", { chatId, isTyping: false });
    }, 1500);
  };

  /** Sends a text or file message and appends it optimistically to the list. */
  const send = async (e?: React.FormEvent, file?: File) => {
    e?.preventDefault();
    if (!file && !text.trim()) return;
    setSending(true);
    try {
      const msg = await messageApi.send({
        chatId,
        content: text.trim() || undefined,
        type: file ? (file.type.startsWith("image/") ? "image" : "file") : "text",
        replyTo: replyTo?._id,
        file,
      });
      setMessages((p) => (p.some((m) => m._id === msg._id) ? p : [...p, msg]));
      setText("");
      setReplyTo(null);
      scrollToBottom();
    } catch (e) {
      toast.error(apiError(e, "Failed to send"));
    } finally {
      setSending(false);
    }
  };

  /** Handles file input change and forwards the selected file to `send`. */
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) send(undefined, f);
    e.target.value = "";
  };

  /** Soft-deletes a message by ID and marks it as deleted in local state. */
  const removeMessage = async (id: string) => {
    try {
      await messageApi.delete(id);
      setMessages((p) => p.map((m) => m._id === id ? { ...m, deleted: true, content: "" } : m));
    } catch (e) {
      toast.error(apiError(e));
    }
    setOpenMenu(null);
  };

  /** Adds or toggles a reaction emoji on a message. */
  const react = async (id: string, emoji: string) => {
    try {
      const updated = await messageApi.react(id, emoji);
      setMessages((p) => p.map((m) => m._id === id ? { ...m, reactions: updated.reactions } : m));
    } catch (e) {
      toast.error(apiError(e));
    }
    setOpenMenu(null);
  };

  /** Pins or unpins a message in the group chat. */
  const pinMessage = async (messageId: string) => {
    try {
      const updatedChat = await chatApi.pinMessage(chatId, messageId);
      setChat(updatedChat);
      toast.success("Message pin toggled");
    } catch (e) {
      toast.error(apiError(e));
    }
    setOpenMenu(null);
  };

  /** Clears all messages visible only to the current user. */
  const clearForMe = async () => {
    if (!confirm("Delete all messages for you? This can't be undone.")) return;
    setMenuLoading("clear-me");
    try {
      await messageApi.clearChat(chatId, false);
      setMessages([]);
      toast.success("Chat cleared for you");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setMenuLoading(null);
      setShowMenu(false);
    }
  };

  /** Clears all messages for every participant and filters out own messages locally. */
  const clearForBoth = async () => {
    if (!confirm("Delete all messages for EVERYONE? This can't be undone.")) return;
    setMenuLoading("clear-both");
    try {
      await messageApi.clearChat(chatId, true);
      setMessages((p) => p.filter((m) => {
        const msgSender = typeof m.sender === "string" ? m.sender : m.sender._id;
        return msgSender !== me?._id;
      }));
      toast.success("Chat cleared for everyone");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setMenuLoading(null);
      setShowMenu(false);
    }
  };

  /** Blocks or unblocks the other participant, updating UI state accordingly. */
  const toggleBlock = async () => {
    if (!other) return;
    setMenuLoading("block");
    try {
      if (blockedByMe) {
        await blockApi.unblock(other._id);
        setBlockedByMe(false);
        profileApi.requestStatus(other._id)
          .then((r) => setIsFriend(r.status === "accepted"))
          .catch(() => {});
        toast.success("User unblocked");
      } else {
        await blockApi.block(other._id);
        setBlockedByMe(true);
        setTypingUser(null);
        removeOnlineUser(other._id);
        toast.success("User blocked");
      }
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setMenuLoading(null);
      setShowMenu(false);
    }
  };

  /** Removes the other user as a friend, hides the chat, and navigates away. */
  const unfriend = async () => {
    if (!other) return;
    if (!confirm(`Remove ${other.fullName || other.username} as a friend? This will also clear the chat.`)) return;
    setMenuLoading("unfriend");
    try {
      await requestApi.unfriend(other._id);
      removeOnlineUser(other._id);
      await Promise.allSettled([messageApi.clearChat(chatId, false), chatApi.hide(chatId)]);
      toast.success("Removed from friends");
      navigate("/chats");
    } catch (e) {
      toast.error(apiError(e, "Failed to unfriend"));
    } finally {
      setMenuLoading(null);
      setShowMenu(false);
    }
  };

  /** Hides this DM from the chat list without deleting any messages. */
  const removeChat = async () => {
    if (!confirm("Remove this chat from your list? You can start it again by searching them.")) return;
    setMenuLoading("remove-chat");
    try {
      await chatApi.hide(chatId);
      toast.success("Chat removed");
      navigate("/chats");
    } catch (e) {
      toast.error(apiError(e, "Failed to remove chat"));
    } finally {
      setMenuLoading(null);
    }
  };

  /** Leaves the group and navigates back to the chats list. */
  const leaveGroup = async () => {
    if (!confirm("Leave this group? You'll stop receiving messages.")) return;
    setMenuLoading("leave-group");
    try {
      await chatApi.leave(chatId);
      toast.success("Left the group");
      navigate("/chats");
    } catch (e) {
      toast.error(apiError(e, "Failed to leave group"));
    } finally {
      setMenuLoading(null);
      setShowMenu(false);
    }
  };

  /** Hides a group chat from the list while remaining a member. */
  const removeGroupChat = async () => {
    if (!confirm("Remove from your chat list? You're still a member and can find it again by searching.")) return;
    setMenuLoading("remove-group-chat");
    try {
      await chatApi.hide(chatId);
      toast.success("Chat removed from list");
      navigate("/chats");
    } catch (e) {
      toast.error(apiError(e, "Failed to remove chat"));
    } finally {
      setMenuLoading(null);
      setShowMenu(false);
    }
  };

  /** Returns true when the message was sent by the current user. */
  const isMine = (m: Message) =>
    (typeof m.sender === "string" ? m.sender : m.sender._id) === me?._id;

  /** Starts a voice or video call with the other DM participant. */
  const placeCall = (type: "audio" | "video") => {
    if (!other) return;
    if (isBlocked) {
      toast.error("You can't call a blocked user");
      return;
    }
    if (callStatus !== "idle") return;
    startCall(
      { _id: other._id, username: other.username, fullName: other.fullName, avatar: other.avatar },
      chatId,
      type
    );
  };

  /** Groups messages by calendar date for separator rendering. */
  const grouped = useMemo(() => {
    const result: { date: string; messages: Message[] }[] = [];
    for (const msg of messages) {
      const label = dateSeparator(msg.createdAt);
      const last = result[result.length - 1];
      if (last && last.date === label) {
        last.messages.push(msg);
      } else {
        result.push({ date: label, messages: [msg] });
      }
    }
    return result;
  }, [messages]);

  const pinnedCount = chat?.pinnedMessages?.length || 0;

  return (
    <div className="flex flex-col h-full" style={{ background: "#0b141a" }}>

      <header
        className="flex items-center gap-2 px-2 md:px-3 py-2 shrink-0"
        style={{ background: "#1f2c34", borderBottom: "1px solid rgba(255,255,255,0.05)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
      >
        <button
          onClick={() => navigate("/chats")}
          className="p-2 rounded-full hover:bg-white/10 transition shrink-0"
          style={{ color: "#aebac1" }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <button onClick={() => other && navigate(`/profile/${other._id}`)} className="shrink-0">
          <Avatar
            src={chat?.isGroup ? chat.groupAvatar : other?.avatar}
            name={title || ""}
            online={!!online}
            size={40}
          />
        </button>

        <div className="flex-1 min-w-0 pl-1">
          <div className="font-semibold text-[15px] truncate leading-tight" style={{ color: "#e9edef" }}>
            {title}
          </div>
          <div className="text-[12px] leading-tight truncate" style={{ color: "#8696a0" }}>
            {typingUser && !isBlocked ? (
              <span style={{ color: "#25d366" }}>{typingUser} is typing…</span>
            ) : chat?.isGroup ? (
              `${chat.members.length} members`
            ) : online ? (
              <span style={{ color: "#25d366" }}>online</span>
            ) : (
              "offline"
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {chat?.isGroup && pinnedCount > 0 && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs mr-1"
              style={{ background: "rgba(0,168,132,0.15)", color: "#25d366" }}
            >
              <Pin className="w-3 h-3" />
              <span>{pinnedCount}</span>
            </div>
          )}

          {!chat?.isGroup && !isBlocked && (
            <>
              <button
                onClick={() => placeCall("audio")}
                disabled={callStatus !== "idle"}
                aria-label="Start voice call"
                title="Voice call"
                className="p-2 rounded-full hover:bg-white/10 transition disabled:opacity-40"
                style={{ color: "#aebac1" }}
              >
                <Phone className="w-5 h-5" />
              </button>
              <button
                onClick={() => placeCall("video")}
                disabled={callStatus !== "idle"}
                aria-label="Start video call"
                title="Video call"
                className="p-2 rounded-full hover:bg-white/10 transition disabled:opacity-40"
                style={{ color: "#aebac1" }}
              >
                <Video className="w-5 h-5" />
              </button>
            </>
          )}

          {chat?.isGroup && (
            <button
              onClick={() => navigate(`/chats/${chatId}/info`)}
              className="p-2 rounded-full hover:bg-white/10 transition"
              style={{ color: "#aebac1" }}
            >
              <Users className="w-5 h-5" />
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowMenu((p) => !p)}
              className="p-2 rounded-full hover:bg-white/10 transition"
              style={{ color: "#aebac1" }}
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div
                  className="absolute right-0 top-11 z-20 min-w-[200px] rounded-xl overflow-hidden py-1 shadow-2xl"
                  style={{ background: "#233138", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  {[
                    { key: "clear-me", label: "Delete for me", icon: <Trash2 className="w-4 h-4" />, color: "#aebac1", onClick: clearForMe, show: !chat?.isGroup },
                    { key: "clear-both", label: "Delete for everyone", icon: <EyeOff className="w-4 h-4" />, color: "#aebac1", onClick: clearForBoth, show: !chat?.isGroup },
                    { key: "block", label: blockedByMe ? `Unblock ${other?.fullName || other?.username}` : "Block user", icon: <UserMinus className="w-4 h-4" />, color: blockedByMe ? "#25d366" : "#ef4444", onClick: toggleBlock, show: !chat?.isGroup },
                    { key: "unfriend", label: "Remove friend", icon: <UserMinus className="w-4 h-4" />, color: "#ef4444", onClick: unfriend, show: !chat?.isGroup && other?.isPrivate !== false },
                    { key: "remove-chat", label: "Remove chat", icon: <X className="w-4 h-4" />, color: "#aebac1", onClick: removeChat, show: !chat?.isGroup },
                    { key: "leave-group", label: "Leave group", icon: <UserMinus className="w-4 h-4" />, color: "#ef4444", onClick: leaveGroup, show: !!chat?.isGroup },
                    { key: "remove-group-chat", label: "Remove from list", icon: <X className="w-4 h-4" />, color: "#aebac1", onClick: removeGroupChat, show: !!chat?.isGroup },
                  ]
                    .filter((item) => item.show)
                    .map((item) => (
                      <button
                        key={item.key}
                        onClick={item.onClick}
                        disabled={!!menuLoading}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-left disabled:opacity-50"
                        style={{ color: item.color }}
                      >
                        {menuLoading === item.key ? <Spinner className="w-4 h-4" /> : item.icon}
                        <span className="text-sm">{item.label}</span>
                      </button>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {chat?.pinnedMessages && chat.pinnedMessages.length > 0 && (
        <div
          className="flex items-center gap-2 px-4 py-2 shrink-0 cursor-pointer hover:bg-white/5 transition"
          style={{ background: "#1a2632", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
        >
          <Pin className="w-3.5 h-3.5 shrink-0" style={{ color: "#25d366" }} />
          <span className="text-xs truncate" style={{ color: "#8696a0" }}>
            {pinnedCount} pinned message{pinnedCount > 1 ? "s" : ""}
          </span>
          <ChevronUp className="w-3.5 h-3.5 ml-auto shrink-0" style={{ color: "#8696a0" }} />
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 md:px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner className="w-6 h-6" style={{ color: "#25d366" }} />
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-xs px-4 py-1.5 rounded-full transition"
                  style={{ background: "#1f2c34", color: "#8696a0", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  {loadingMore ? "Loading…" : "Load older messages"}
                </button>
              </div>
            )}

            {grouped.map(({ date, messages: msgs }) => (
              <div key={date}>
                <div className="flex justify-center my-3">
                  <span
                    className="text-[11px] px-3 py-1 rounded-full"
                    style={{ background: "#1f2c34", color: "#8696a0", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    {date}
                  </span>
                </div>

                {msgs.map((m, idx) => {
                  const mine = isMine(m);
                  const sender = m.sender;
                  const senderId = typeof sender === "string" ? sender : sender._id;
                  const prevMsg = msgs[idx - 1];
                  const nextMsg = msgs[idx + 1];
                  const prevSender = prevMsg ? (typeof prevMsg.sender === "string" ? prevMsg.sender : prevMsg.sender._id) : null;
                  const nextSender = nextMsg ? (typeof nextMsg.sender === "string" ? nextMsg.sender : nextMsg.sender._id) : null;
                  const isFirst = senderId !== prevSender;
                  const isLast = senderId !== nextSender;
                  const showAvatar = !mine && chat?.isGroup;
                  const isPinned = chat?.pinnedMessages?.includes(m._id);
                  const borderRadius = mine
                    ? `${isFirst ? 18 : 18}px ${isFirst ? 4 : 18}px ${isLast ? 4 : 18}px 18px`
                    : `${isFirst ? 4 : 18}px ${isFirst ? 18 : 18}px 18px ${isLast ? 4 : 18}px`;

                  return (
                    <div
                      key={m._id}
                      className={cn(
                        "flex items-end gap-1.5 mb-0.5",
                        mine ? "justify-end" : "justify-start",
                        isFirst && idx > 0 ? "mt-3" : "mt-0.5"
                      )}
                    >
                      {showAvatar ? (
                        <div className="shrink-0 mb-1">
                          {isLast ? (
                            <Avatar
                              src={sender && typeof sender === "object" ? sender.avatar : undefined}
                              name={sender && typeof sender === "object" ? sender.fullName || sender.username : "?"}
                              size={26}
                            />
                          ) : (
                            <div className="w-[26px]" />
                          )}
                        </div>
                      ) : null}

                      <div className="relative group max-w-[72%]">
                        <div
                          className={cn("relative px-3 pt-2 pb-1.5 text-[14.5px] leading-relaxed break-words", m.deleted && "opacity-50 italic")}
                          style={{ background: mine ? "#015243" : "#1f2c34", color: "#e9edef", borderRadius, boxShadow: "0 1px 3px rgba(0,0,0,0.25)", minWidth: "60px" }}
                        >
                          {isPinned && <Pin className="w-3 h-3 inline mr-1 -mt-0.5" style={{ color: "#25d366" }} />}

                          {!mine && chat?.isGroup && sender && typeof sender === "object" && isFirst && (
                            <div className="text-[11px] font-semibold mb-0.5" style={{ color: "#25d366" }}>
                              {sender.fullName || sender.username}
                            </div>
                          )}

                          {!m.deleted && m.replyTo && typeof m.replyTo === "object" && (
                            <div
                              className="mb-2 pl-2 py-1 pr-2 rounded-lg text-xs line-clamp-2"
                              style={{ background: "rgba(0,0,0,0.2)", borderLeft: "3px solid #25d366", color: "#8696a0" }}
                            >
                              {(m.replyTo as Message).content || "Attachment"}
                            </div>
                          )}

                          {m.deleted ? (
                            <span className="text-xs italic" style={{ color: "#8696a0" }}>Message deleted</span>
                          ) : (
                            <>
                              {m.type === "image" && m.mediaUrl && (
                                <img src={m.mediaUrl} alt="img" className="rounded-xl max-w-full mb-1 max-h-60 object-cover w-full" />
                              )}
                              {m.type === "file" && m.mediaUrl && (
                                <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs underline py-1" style={{ color: "#53bdeb" }}>
                                  📎 Download file
                                </a>
                              )}
                              {m.content && <span className="whitespace-pre-wrap">{m.content}</span>}
                            </>
                          )}

                          <div className="flex items-center justify-end gap-1 float-right ml-2 mt-0.5 -mb-0.5">
                            <span className="text-[10px] leading-none" style={{ color: "rgba(134,150,160,0.9)" }}>
                              {formatTime(m.createdAt)}
                            </span>
                            <StatusTick status={(m as unknown as { status?: string }).status} mine={mine} />
                          </div>
                          <div style={{ clear: "both" }} />

                          {!m.deleted && (
                            <button
                              onClick={() => setOpenMenu(openMenu === m._id ? null : m._id)}
                              className="absolute -top-2 opacity-0 group-hover:opacity-100 rounded-full p-1 transition"
                              style={{
                                right: mine ? "auto" : "-8px",
                                left: mine ? "-8px" : "auto",
                                background: "#233138",
                                border: "1px solid rgba(255,255,255,0.07)",
                                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                              }}
                            >
                              <MoreVertical className="w-3 h-3" style={{ color: "#8696a0" }} />
                            </button>
                          )}
                        </div>

                        {!!m.reactions?.length && (
                          <div className={cn("flex gap-1 mt-1 flex-wrap", mine ? "justify-end" : "justify-start")}>
                            {m.reactions.map((r, j) => (
                              <span
                                key={j}
                                className="px-1.5 py-0.5 rounded-full text-xs"
                                style={{ background: "#1f2c34", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
                              >
                                {r.emoji}
                              </span>
                            ))}
                          </div>
                        )}

                        {openMenu === m._id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                            <div
                              className={cn("absolute z-20 mt-1 p-2 flex gap-1 flex-wrap shadow-2xl rounded-2xl", mine ? "right-0" : "left-0")}
                              style={{ background: "#233138", border: "1px solid rgba(255,255,255,0.07)" }}
                            >
                              {EMOJIS.map((e) => (
                                <button key={e} onClick={() => react(m._id, e)} className="hover:bg-white/10 rounded-full p-1.5 text-base transition">{e}</button>
                              ))}
                              <div className="w-px self-stretch mx-0.5" style={{ background: "rgba(255,255,255,0.08)" }} />
                              <button onClick={() => { setReplyTo(m); setOpenMenu(null); }} className="p-1.5 rounded-full hover:bg-white/10 transition" title="Reply" style={{ color: "#aebac1" }}>
                                <Reply className="w-4 h-4" />
                              </button>
                              {(isAdmin || mine) && chat?.isGroup && (
                                <button onClick={() => pinMessage(m._id)} className="p-1.5 rounded-full hover:bg-white/10 transition" title={isPinned ? "Unpin" : "Pin"} style={{ color: isPinned ? "#25d366" : "#aebac1" }}>
                                  <Pin className="w-4 h-4" />
                                </button>
                              )}
                              {mine && (
                                <button onClick={() => removeMessage(m._id)} className="p-1.5 rounded-full hover:bg-white/10 transition" title="Delete" style={{ color: "#ef4444" }}>
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {typingUser && !isBlocked && (
              <div className="flex items-center gap-2 mt-3 ml-1">
                <div className="flex gap-1 px-4 py-3 rounded-2xl rounded-bl-sm items-center" style={{ background: "#1f2c34", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }}>
                  {[0, 150, 300].map((delay) => (
                    <span key={delay} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#8696a0", animationDelay: `${delay}ms`, animationDuration: "1.2s" }} />
                  ))}
                </div>
                <span className="text-xs" style={{ color: "#8696a0" }}>{typingUser}</span>
              </div>
            )}

            <div ref={bottomRef} />
          </>
        )}
      </div>

      {replyTo && (
        <div className="flex items-center gap-3 px-4 py-2.5 shrink-0" style={{ background: "#1a2632", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <Reply className="w-4 h-4 shrink-0" style={{ color: "#25d366" }} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium" style={{ color: "#25d366" }}>
              Replying to {typeof replyTo.sender === "object" ? replyTo.sender.fullName || replyTo.sender.username : ""}
            </div>
            <div className="text-sm truncate" style={{ color: "#8696a0" }}>{replyTo.content || "Attachment"}</div>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1 rounded-full hover:bg-white/10 transition" style={{ color: "#8696a0" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!chat?.isGroup && (blockedByMe || blockedByThem || (!isFriend && other?.isPrivate !== false)) && (
        <div className="px-4 py-3 text-center shrink-0" style={{ background: "#1a2632", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {blockedByMe && (
            <p className="text-sm" style={{ color: "#8696a0" }}>
              You blocked <strong style={{ color: "#e9edef" }}>{other?.fullName || other?.username}</strong>
              {" · "}
              <button onClick={toggleBlock} style={{ color: "#25d366" }}>Unblock</button>
            </p>
          )}
          {blockedByThem && !blockedByMe && (
            <p className="text-sm" style={{ color: "#8696a0" }}>
              <strong style={{ color: "#e9edef" }}>{other?.fullName || other?.username}</strong> blocked you
            </p>
          )}
          {!blockedByMe && !blockedByThem && !isFriend && other?.isPrivate !== false && (
            <p className="text-sm" style={{ color: "#8696a0" }}>
              You are no longer friends with{" "}
              <strong style={{ color: "#e9edef" }}>{other?.fullName || other?.username}</strong>
              {" · "}
              <button onClick={() => navigate(`/profile/${other?._id}`)} style={{ color: "#25d366" }}>Add friend</button>
            </p>
          )}
        </div>
      )}

      {(chat?.isGroup || (!blockedByMe && !blockedByThem && (isFriend || other?.isPrivate === false))) && (
        <form
          onSubmit={send}
          className="flex items-end gap-2 px-2 py-2 shrink-0"
          style={{ background: "#0b141a", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
        >
          <input ref={fileRef} type="file" hidden onChange={onFile} />

          <button type="button" onClick={() => fileRef.current?.click()} className="p-2.5 rounded-full hover:bg-white/10 transition shrink-0" style={{ color: "#8696a0" }}>
            <Paperclip className="w-[22px] h-[22px]" />
          </button>

          <div className="flex-1 flex items-center px-4 py-2.5 rounded-full" style={{ background: "#1f2c34", border: "1px solid rgba(255,255,255,0.06)", minHeight: "44px" }}>
            <input
              value={text}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Message"
              className="flex-1 bg-transparent text-[15px] outline-none placeholder-[#8696a0]"
              style={{ color: "#e9edef" }}
            />
          </div>

          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 active:scale-95 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #00a884, #008069)", boxShadow: text.trim() ? "0 2px 12px rgba(0,168,132,0.35)" : "none" }}
          >
            {sending ? <Spinner className="w-4 h-4" /> : <Send className="w-5 h-5 text-white" style={{ transform: "translateX(1px)" }} />}
          </button>
        </form>
      )}
    </div>
  );
}
