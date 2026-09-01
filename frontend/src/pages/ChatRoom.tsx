import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Paperclip,
  Trash2,
  Reply,
  X,
  MoreVertical,
  Users,
  Pin,
  ChevronUp,
  EyeOff,
  UserMinus,
  Check,
  CheckCheck,
  Phone,
  Video,
  Pencil,
} from "lucide-react";
import toast from "react-hot-toast";
import { chatApi, messageApi, blockApi, requestApi, profileApi, authApi } from "@/api/endpoints";
import type { Chat, Message } from "@/types";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/Spinner";
import { useAuth } from "@/store/auth";
import { useSocket } from "@/context/SocketContext";
import { useCall } from "@/context/CallContext";
import { formatTime, cn } from "@/lib/utils";
import { apiError } from "@/api/client";
import { format, isToday, isYesterday } from "date-fns";
import {
  getOrCreateKeyPair,
  deriveSharedSecret,
  encryptForSend,
  decryptMessage,
  isKeyRegistered,
  markKeyRegistered,
} from "@/utils/encryption";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

function dateSeparator(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) {
    return "Today";
  }
  if (isYesterday(d)) {
    return "Yesterday";
  }
  return format(d, "MMMM d, yyyy");
}

function StatusTick({ status, mine }: { status?: string; mine: boolean }) {
  if (!mine || !status) {
    return null;
  }
  if (status === "read") {
    return <CheckCheck className="w-3 h-3 text-[#53bdeb] inline-block shrink-0" />;
  }
  if (status === "delivered") {
    return <CheckCheck className="w-3 h-3 text-muted inline-block shrink-0" />;
  }
  return <Check className="w-3 h-3 text-muted inline-block shrink-0" />;
}

export default function ChatRoomPage() {
  const { chatId = "" } = useParams();
  const navigate = useNavigate();
  const me = useAuth(s => {
    return s.user;
  });
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

  
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const isBlocked = blockedByMe || blockedByThem;

  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number>();
  const editInputRef = useRef<HTMLInputElement>(null);

  
  const sharedSecretRef = useRef<Uint8Array | null>(null);
  const myKeyPairRef = useRef<{ publicKey: string; secretKey: string } | null>(null);
  
  const [e2eReady, setE2EReady] = useState(false);
  
  const [rederiveFailed, setRederiveFailed] = useState(false);

  
  const other = useMemo(() => {
    if (!chat || chat.isGroup) {
      return null;
    }
    return (
      chat.members.find(m => {
        return m._id !== me?._id;
      }) || chat.members[0]
    );
  }, [chat, me]);

  const title = chat?.isGroup ? chat.name : other?.fullName || other?.username || "";
  const online =
    other && !isBlocked && (isFriend || other.isPrivate === false) && onlineUsers.has(other._id);
  const isAdmin = chat?.admins?.includes(me?._id || "") || chat?.creator === me?._id;

  
  const rederivingRef = useRef(false);

  useEffect(() => {
    if (!me?._id || !other) {
      sharedSecretRef.current = null;
      setE2EReady(false);
      return;
    }

    setE2EReady(false);
    setRederiveFailed(false);
    sharedSecretRef.current = null;

    
    const kp = getOrCreateKeyPair(me._id);
    myKeyPairRef.current = kp;

    (async () => {
      
      try {
        const { publicKey: serverKey } = await authApi.getPublicKey(me._id);
        if (serverKey !== kp.publicKey) {
          await authApi.setPublicKey(kp.publicKey);
          markKeyRegistered(me._id, kp.publicKey);
        }
      } catch {
        
        if (!isKeyRegistered(me._id, kp.publicKey)) {
          try {
            await authApi.setPublicKey(kp.publicKey);
            markKeyRegistered(me._id, kp.publicKey);
          } catch {
            
          }
        }
      }

      
      try {
        const { publicKey: otherPub } = await authApi.getPublicKey(other._id);
        if (!otherPub || !myKeyPairRef.current) {
          return;
        }
        sharedSecretRef.current = deriveSharedSecret(otherPub, myKeyPairRef.current.secretKey);
        setE2EReady(true);
      } catch {
        sharedSecretRef.current = null;
        setE2EReady(false);
      }
    })();
  }, [me?._id, other]);

  
  
  const getDisplayContent = useCallback(
    (m: Message): string => {
      if (m.encryptedContent && m.nonce) {
        if (sharedSecretRef.current) {
          const decrypted = decryptMessage(m.encryptedContent, m.nonce, sharedSecretRef.current);
          if (decrypted !== null) {
            return decrypted;
          }

          
          
          
          if (!rederivingRef.current && !rederiveFailed && other) {
            rederivingRef.current = true;
            authApi
              .getPublicKey(other._id)
              .then(({ publicKey: freshPub }) => {
                if (!freshPub || !myKeyPairRef.current) {
                  setRederiveFailed(true);
                  return;
                }
                const newSecret = deriveSharedSecret(freshPub, myKeyPairRef.current.secretKey);
                const testDecrypt = decryptMessage(m.encryptedContent!, m.nonce!, newSecret);
                if (testDecrypt !== null) {
                  sharedSecretRef.current = newSecret;
                  setE2EReady(prev => {
                    return !prev;
                  }); 
                } else {
                  
                  setRederiveFailed(true);
                }
              })
              .catch(() => {
                setRederiveFailed(true);
              })
              .finally(() => {
                rederivingRef.current = false;
              });
          }

          
          
          
          return rederiveFailed ? "🔒 Encrypted message" : "";
        }
        
        return "";
      }
      return m.content ?? "";
    },
    [e2eReady, other, rederiveFailed]
  );

  
  const loadMessages = useCallback(async (chatId: string, pg: number, prepend = false) => {
    const result = await chatApi.messages(chatId, pg);
    const msgs = result.data;
    setHasMore(result.hasMore);
    if (prepend) {
      setMessages(prev => {
        return [...msgs, ...prev];
      });
    } else {
      setMessages(msgs);
    }
    return msgs;
  }, []);

  
  useEffect(() => {
    if (!chatId) {
      return;
    }
    setLoading(true);
    setPage(1);
    Promise.all([chatApi.get(chatId), loadMessages(chatId, 1)])
      .then(([c]) => {
        setChat(c);
        if (c && !c.isGroup) {
          const otherId = c.members.find(m => {
            return m._id !== me?._id;
          })?._id;
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
      .catch(e => {
        return toast.error(apiError(e, "Failed to load chat"));
      })
      .finally(() => {
        return setLoading(false);
      });
    messageApi.markRead(chatId).catch(() => {});
  }, [chatId, loadMessages, me?._id]);

  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [loading]);

  
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (nearBottom) {
      scrollToBottom();
    }
  }, [messages, typingUser, scrollToBottom]);

  
  useEffect(() => {
    if (!socket || !chatId) {
      return;
    }
    socket.emit("chat:join", chatId);

    const onNew = (msg: Message) => {
      if (msg.chat === chatId) {
        setMessages(p => {
          return p.some(m => {
            return m._id === msg._id;
          })
            ? p
            : [...p, msg];
        });
        messageApi.markRead(chatId).catch(() => {});
      }
    };
    const onDeleted = ({ messageId }: { messageId: string }) => {
      return setMessages(p => {
        return p.map(m => {
          return m._id === messageId ? { ...m, deleted: true, content: "" } : m;
        });
      });
    };
    const onEdited = (updated: Message) => {
      return setMessages(p => {
        return p.map(m => {
          return m._id === updated._id ? { ...m, ...updated } : m;
        });
      });
    };
    const onReaction = ({
      messageId,
      reactions,
    }: {
      messageId: string;
      reactions: Message["reactions"];
    }) => {
      return setMessages(p => {
        return p.map(m => {
          return m._id === messageId ? { ...m, reactions } : m;
        });
      });
    };
    const onTyping = (d: { chatId: string; username: string; isTyping: boolean }) => {
      if (d.chatId !== chatId) {
        return;
      }
      if (isBlocked) {
        return;
      }
      setTypingUser(d.isTyping ? d.username : null);
    };
    const onRead = ({ chatId: cId, readBy }: { chatId: string; readBy: string }) => {
      if (cId !== chatId) {
        return;
      }
      const id = String(readBy);
      setMessages(p => {
        return p.map(m => {
          const arr = (m.readBy ?? []).map(String);
          return arr.includes(id) ? m : { ...m, readBy: [...arr, id] };
        });
      });
    };
    const onDelivered = ({ chatId: cId, userId }: { chatId: string; userId: string }) => {
      if (cId !== chatId) {
        return;
      }
      const id = String(userId);
      setMessages(p => {
        return p.map(m => {
          const arr = (m.deliveredTo ?? []).map(String);
          return arr.includes(id) ? m : { ...m, deliveredTo: [...arr, id] };
        });
      });
    };
    const onPinned = (updatedChat: Chat) => {
      if (updatedChat._id === chatId) {
        setChat(updatedChat);
      }
    };
    const onCleared = ({
      forBoth,
      senderId,
    }: {
      chatId: string;
      forBoth: boolean;
      senderId?: string;
    }) => {
      if (forBoth && senderId) {
        setMessages(p => {
          return p.filter(m => {
            const msgSender = typeof m.sender === "string" ? m.sender : m.sender._id;
            return msgSender !== senderId;
          });
        });
      } else if (forBoth) {
        setMessages([]);
      }
    };
    const onStatusChanged = ({
      chatId: cId,
      status,
      by,
    }: {
      chatId: string;
      status: string;
      by: string;
    }) => {
      if (cId !== chatId) {
        return;
      }
      if (status === "blocked") {
        if (by === me?._id) {
          setBlockedByMe(true);
        } else {
          setBlockedByThem(true);
          setTypingUser(null);
        }
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
    socket.on("message:edited", onEdited);
    socket.on("message:reaction", onReaction);
    socket.on("chat:typing", onTyping);
    socket.on("chat:pinned", onPinned);
    socket.on("chat:cleared", onCleared);
    socket.on("chat:status_changed", onStatusChanged);
    socket.on("message:read", onRead);
    socket.on("message:delivered", onDelivered);

    return () => {
      socket.emit("chat:leave", chatId);
      socket.off("message:new", onNew);
      socket.off("message:deleted", onDeleted);
      socket.off("message:edited", onEdited);
      socket.off("message:reaction", onReaction);
      socket.off("chat:typing", onTyping);
      socket.off("chat:pinned", onPinned);
      socket.off("chat:cleared", onCleared);
      socket.off("chat:status_changed", onStatusChanged);
      socket.off("message:read", onRead);
      socket.off("message:delivered", onDelivered);
    };
  }, [socket, chatId, isBlocked, me?._id, removeOnlineUser]);

  
  const loadMore = async () => {
    if (loadingMore || !hasMore) {
      return;
    }
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const el = scrollRef.current;
      const prevScrollHeight = el?.scrollHeight || 0;
      await loadMessages(chatId, nextPage, true);
      setPage(nextPage);
      if (el) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight - prevScrollHeight;
        });
      }
    } catch (e) {
      toast.error(apiError(e, "Failed to load more messages"));
    } finally {
      setLoadingMore(false);
    }
  };

  
  const onType = (v: string) => {
    setText(v);
    if (!socket) {
      return;
    }
    socket.emit("chat:typing", { chatId, isTyping: true });
    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current);
    }
    typingTimer.current = window.setTimeout(() => {
      socket.emit("chat:typing", { chatId, isTyping: false });
    }, 1500);
  };

  
  const send = async (e?: React.FormEvent, file?: File) => {
    e?.preventDefault();
    if (!file && !text.trim()) {
      return;
    }
    setSending(true);
    try {
      const isE2E = !file && !chat?.isGroup && !!sharedSecretRef.current && !!text.trim();
      let sendData: Parameters<typeof messageApi.send>[0];

      if (isE2E) {
        const { encrypted, nonce } = encryptForSend(text.trim(), sharedSecretRef.current!);
        
        sendData = {
          chatId,
          type: "text",
          replyTo: replyTo?._id,
          encryptedContent: encrypted,
          nonce,
        };
      } else {
        sendData = {
          chatId,
          content: text.trim() || undefined,
          type: file ? (file.type.startsWith("image/") ? "image" : "file") : "text",
          replyTo: replyTo?._id,
          file,
        };
      }

      const msg = await messageApi.send(sendData);
      setMessages(p => {
        return p.some(m => {
          return m._id === msg._id;
        })
          ? p
          : [...p, msg];
      });
      setText("");
      setReplyTo(null);
      scrollToBottom();
    } catch (e) {
      toast.error(apiError(e, "Failed to send"));
    } finally {
      setSending(false);
    }
  };

  
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      send(undefined, f);
    }
    e.target.value = "";
  };

  
  const removeMessage = async (id: string) => {
    try {
      await messageApi.delete(id);
      setMessages(p => {
        return p.map(m => {
          return m._id === id ? { ...m, deleted: true, content: "" } : m;
        });
      });
    } catch (e) {
      toast.error(apiError(e));
    }
    setOpenMenu(null);
  };

  
  const startEdit = (m: Message) => {
    if (m.encryptedContent && m.nonce) {
      if (!sharedSecretRef.current) {
        toast.error("Cannot edit: encryption keys not ready yet.");
        setOpenMenu(null);
        return;
      }
      const decrypted = decryptMessage(m.encryptedContent, m.nonce, sharedSecretRef.current);
      if (decrypted === null) {
        toast.error("Cannot edit: message was encrypted by a different session.");
        setOpenMenu(null);
        return;
      }
      setEditingMessage(m);
      setEditText(decodeHtmlEntities(decrypted));
    } else {
      setEditingMessage(m);
      setEditText(decodeHtmlEntities(m.content || ""));
    }
    setOpenMenu(null);
    setTimeout(() => {
      return editInputRef.current?.focus();
    }, 50);
  };

  
  const cancelEdit = () => {
    setEditingMessage(null);
    setEditText("");
  };

  
  const submitEdit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editingMessage || !editText.trim() || editSaving) {
      return;
    }
    setEditSaving(true);
    try {
      const isE2E = !chat?.isGroup && !!sharedSecretRef.current;
      let editData: { content?: string; encryptedContent?: string; nonce?: string };

      if (isE2E) {
        const { encrypted, nonce } = encryptForSend(editText.trim(), sharedSecretRef.current!);
        
        editData = { encryptedContent: encrypted, nonce };
      } else {
        editData = { content: editText.trim() };
      }

      const updated = await messageApi.edit(editingMessage._id, editData);
      setMessages(p => {
        return p.map(m => {
          return m._id === updated._id ? { ...m, ...updated } : m;
        });
      });
      setEditingMessage(null);
      setEditText("");
    } catch (e) {
      toast.error(apiError(e, "Failed to edit message"));
    } finally {
      setEditSaving(false);
    }
  };

  
  const react = async (id: string, emoji: string) => {
    try {
      const updated = await messageApi.react(id, emoji);
      setMessages(p => {
        return p.map(m => {
          return m._id === id ? { ...m, reactions: updated.reactions } : m;
        });
      });
    } catch (e) {
      toast.error(apiError(e));
    }
    setOpenMenu(null);
  };

  
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

  
  const clearForMe = async () => {
    if (!confirm("Delete all messages for you? This can't be undone.")) {
      return;
    }
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

  
  const clearForBoth = async () => {
    if (!confirm("Delete all messages for EVERYONE? This can't be undone.")) {
      return;
    }
    setMenuLoading("clear-both");
    try {
      await messageApi.clearChat(chatId, true);
      setMessages(p => {
        return p.filter(m => {
          const msgSender = typeof m.sender === "string" ? m.sender : m.sender._id;
          return msgSender !== me?._id;
        });
      });
      toast.success("Chat cleared for everyone");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setMenuLoading(null);
      setShowMenu(false);
    }
  };

  
  const toggleBlock = async () => {
    if (!other) {
      return;
    }
    setMenuLoading("block");
    try {
      if (blockedByMe) {
        await blockApi.unblock(other._id);
        setBlockedByMe(false);
        profileApi
          .requestStatus(other._id)
          .then(r => {
            return setIsFriend(r.status === "accepted");
          })
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

  
  const unfriend = async () => {
    if (!other) {
      return;
    }
    if (
      !confirm(
        `Remove ${other.fullName || other.username} as a friend? This will also clear the chat.`
      )
    ) {
      return;
    }
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

  
  const removeChat = async () => {
    if (!confirm("Remove this chat from your list? You can start it again by searching them.")) {
      return;
    }
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

  
  const leaveGroup = async () => {
    if (!confirm("Leave this group? You'll stop receiving messages.")) {
      return;
    }
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

  
  const removeGroupChat = async () => {
    if (
      !confirm(
        "Remove from your chat list? You're still a member and can find it again by searching."
      )
    ) {
      return;
    }
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

  
  const isMine = (m: Message) => {
    return (typeof m.sender === "string" ? m.sender : m.sender._id) === me?._id;
  };

  const computeStatus = (m: Message): "sent" | "delivered" | "read" => {
    const others = (chat?.members ?? [])
      .map(mem => {
        return typeof mem === "string" ? mem : mem._id;
      })
      .filter(id => {
        return id !== me?._id;
      });
    if (others.length === 0) {
      return "sent";
    }
    const readBy = (m.readBy ?? []).map(String);
    const deliveredTo = (m.deliveredTo ?? []).map(String);
    if (
      others.every(id => {
        return readBy.includes(id);
      })
    ) {
      return "read";
    }
    if (
      others.some(id => {
        return deliveredTo.includes(id);
      })
    ) {
      return "delivered";
    }
    return "sent";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="w-6 h-6 text-accent" />
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted">
        <p>Chat not found</p>
        <button
          onClick={() => {
            return navigate("/chats");
          }}
          className="btn-ghost text-sm"
        >
          Back to chats
        </button>
      </div>
    );
  }

  const pinnedMessages = chat.pinnedMessages ?? [];

  return (
    <div className="flex flex-col h-full" style={{ background: "#0b141a" }}>
      {}
      <header
        className="flex items-center gap-3 px-3 py-2.5 shrink-0 z-10"
        style={{ background: "#1f2c34", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={() => {
            return navigate("/chats");
          }}
          className="md:hidden p-1.5 rounded-full hover:bg-white/10 transition"
          style={{ color: "#aebac1" }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <button
          className="shrink-0"
          onClick={() => {
            return chat.isGroup
              ? navigate(`/chats/${chatId}/info`)
              : other && navigate(`/profile/${other._id}`);
          }}
        >
          <Avatar
            src={chat.isGroup ? chat.groupAvatar : other?.avatar}
            name={title || ""}
            online={!!online}
            size={40}
          />
        </button>

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => {
            return chat.isGroup
              ? navigate(`/chats/${chatId}/info`)
              : other && navigate(`/profile/${other._id}`);
          }}
        >
          <div
            className="font-semibold text-[15px] leading-tight truncate"
            style={{ color: "#e9edef" }}
          >
            {title}
          </div>
          {!chat.isGroup && (
            <div className="text-xs leading-tight" style={{ color: "#8696a0" }}>
              {online ? "online" : other?.lastSeen ? `last seen ${formatTime(other.lastSeen)}` : ""}
            </div>
          )}
          {chat.isGroup && (
            <div className="text-xs leading-tight truncate" style={{ color: "#8696a0" }}>
              {chat.members
                .map(m => {
                  return m.fullName || m.username;
                })
                .join(", ")}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!chat.isGroup && !isBlocked && (isFriend || other?.isPrivate === false) && (
            <>
              <button
                onClick={() => {
                  return other && startCall(other, chat._id, "audio");
                }}
                disabled={callStatus !== "idle"}
                className="p-2 rounded-full hover:bg-white/10 transition disabled:opacity-40"
                style={{ color: "#aebac1" }}
                title="Voice call"
              >
                <Phone className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  return other && startCall(other, chat._id, "video");
                }}
                disabled={callStatus !== "idle"}
                className="p-2 rounded-full hover:bg-white/10 transition disabled:opacity-40"
                style={{ color: "#aebac1" }}
                title="Video call"
              >
                <Video className="w-5 h-5" />
              </button>
            </>
          )}
          <div className="relative">
            <button
              onClick={() => {
                return setShowMenu(s => {
                  return !s;
                });
              }}
              className="p-2 rounded-full hover:bg-white/10 transition"
              style={{ color: "#aebac1" }}
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {showMenu && (
              <div
                className="absolute right-0 top-full mt-1 rounded-lg shadow-xl z-50 overflow-hidden"
                style={{
                  background: "#233138",
                  border: "1px solid rgba(255,255,255,0.08)",
                  minWidth: "180px",
                }}
                onMouseLeave={() => {
                  return setShowMenu(false);
                }}
              >
                {chat.isGroup ? (
                  <>
                    <button
                      onClick={() => {
                        navigate(`/chats/${chatId}/info`);
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition"
                      style={{ color: "#e9edef" }}
                    >
                      <Users className="w-4 h-4" /> Group info
                    </button>
                    <button
                      onClick={clearForMe}
                      disabled={menuLoading === "clear-me"}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition"
                      style={{ color: "#e9edef" }}
                    >
                      <EyeOff className="w-4 h-4" />{" "}
                      {menuLoading === "clear-me" ? "Clearing…" : "Clear for me"}
                    </button>
                    {isAdmin && (
                      <button
                        onClick={clearForBoth}
                        disabled={menuLoading === "clear-both"}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition"
                        style={{ color: "#e9edef" }}
                      >
                        <Trash2 className="w-4 h-4" />{" "}
                        {menuLoading === "clear-both" ? "Clearing…" : "Clear for all"}
                      </button>
                    )}
                    <button
                      onClick={leaveGroup}
                      disabled={menuLoading === "leave-group"}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition"
                      style={{ color: "#ef4444" }}
                    >
                      <UserMinus className="w-4 h-4" />{" "}
                      {menuLoading === "leave-group" ? "Leaving…" : "Leave group"}
                    </button>
                    <button
                      onClick={removeGroupChat}
                      disabled={menuLoading === "remove-group-chat"}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition"
                      style={{ color: "#8696a0" }}
                    >
                      <X className="w-4 h-4" />{" "}
                      {menuLoading === "remove-group-chat" ? "Removing…" : "Remove from list"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={clearForMe}
                      disabled={menuLoading === "clear-me"}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition"
                      style={{ color: "#e9edef" }}
                    >
                      <EyeOff className="w-4 h-4" />{" "}
                      {menuLoading === "clear-me" ? "Clearing…" : "Clear for me"}
                    </button>
                    <button
                      onClick={clearForBoth}
                      disabled={menuLoading === "clear-both"}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition"
                      style={{ color: "#e9edef" }}
                    >
                      <Trash2 className="w-4 h-4" />{" "}
                      {menuLoading === "clear-both" ? "Clearing…" : "Clear for both"}
                    </button>
                    <button
                      onClick={toggleBlock}
                      disabled={menuLoading === "block"}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition"
                      style={{ color: blockedByMe ? "#25d366" : "#ef4444" }}
                    >
                      <UserMinus className="w-4 h-4" />{" "}
                      {menuLoading === "block" ? "…" : blockedByMe ? "Unblock" : "Block user"}
                    </button>
                    <button
                      onClick={unfriend}
                      disabled={menuLoading === "unfriend"}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition"
                      style={{ color: "#ef4444" }}
                    >
                      <UserMinus className="w-4 h-4" />{" "}
                      {menuLoading === "unfriend" ? "Removing…" : "Unfriend"}
                    </button>
                    <button
                      onClick={removeChat}
                      disabled={menuLoading === "remove-chat"}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition"
                      style={{ color: "#8696a0" }}
                    >
                      <X className="w-4 h-4" />{" "}
                      {menuLoading === "remove-chat" ? "Removing…" : "Remove chat"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {}
      {pinnedMessages.length > 0 && (
        <div
          className="flex items-center gap-2 px-4 py-2 shrink-0 cursor-pointer"
          style={{ background: "#1a2632", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <Pin className="w-3.5 h-3.5 shrink-0" style={{ color: "#25d366" }} />
          <span className="text-xs truncate flex-1" style={{ color: "#8696a0" }}>
            {pinnedMessages.length} pinned message{pinnedMessages.length !== 1 ? "s" : ""}
          </span>
          <ChevronUp className="w-3.5 h-3.5 shrink-0" style={{ color: "#8696a0" }} />
        </div>
      )}

      {}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {hasMore && (
          <div className="flex justify-center py-2">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="text-xs px-3 py-1.5 rounded-full transition"
              style={{ background: "#1f2c34", color: "#8696a0" }}
            >
              {loadingMore ? <Spinner className="w-3.5 h-3.5" /> : "Load earlier messages"}
            </button>
          </div>
        )}

        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-sm" style={{ color: "#8696a0" }}>
              No messages yet. Say hello!
            </p>
            {!chat.isGroup && (
              <p className="text-xs" style={{ color: "#4a5568" }}>
                🔒 Messages in this chat are end-to-end encrypted
              </p>
            )}
          </div>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showDate = !prev || dateSeparator(m.createdAt) !== dateSeparator(prev.createdAt);
          const mine = isMine(m);
          const status = mine ? computeStatus(m) : undefined;
          const senderName =
            typeof m.sender === "object" ? m.sender.fullName || m.sender.username : "";
          const senderAvatar = typeof m.sender === "object" ? m.sender.avatar : undefined;
          const isPinned = pinnedMessages.includes(m._id);

          if (m.deleted) {
            return (
              <div key={m._id}>
                {showDate && (
                  <div className="flex justify-center my-3">
                    <span
                      className="text-[11px] px-3 py-1 rounded-full"
                      style={{ background: "#1f2c34", color: "#8696a0" }}
                    >
                      {dateSeparator(m.createdAt)}
                    </span>
                  </div>
                )}
                <div
                  className={cn(
                    "flex items-end gap-1.5 mb-0.5",
                    mine ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className="px-3 py-2 rounded-lg text-sm italic"
                    style={{
                      background: mine ? "#1f4b3f" : "#1f2c34",
                      color: "#8696a0",
                      maxWidth: "70%",
                    }}
                  >
                    This message was deleted
                  </div>
                </div>
              </div>
            );
          }

          const displayContent = getDisplayContent(m);
          const replyMsg =
            m.replyTo && typeof m.replyTo === "object" ? (m.replyTo as Message) : null;

          return (
            <div key={m._id}>
              {showDate && (
                <div className="flex justify-center my-3">
                  <span
                    className="text-[11px] px-3 py-1 rounded-full"
                    style={{ background: "#1f2c34", color: "#8696a0" }}
                  >
                    {dateSeparator(m.createdAt)}
                  </span>
                </div>
              )}

              <div
                className={cn(
                  "flex items-end gap-1.5 group mb-0.5 relative",
                  mine ? "justify-end" : "justify-start"
                )}
              >
                {!mine && chat.isGroup && (
                  <div className="shrink-0 w-7 h-7 mb-1">
                    <Avatar src={senderAvatar} name={senderName} size={28} />
                  </div>
                )}

                <div className={cn("relative max-w-[70%]")}>
                  {}
                  <button
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 z-10 p-1 rounded-full opacity-0 group-hover:opacity-100 transition",
                      mine ? "-left-8" : "-right-8"
                    )}
                    style={{ background: "#1f2c34" }}
                    onClick={() => {
                      return setOpenMenu(openMenu === m._id ? null : m._id);
                    }}
                  >
                    <MoreVertical className="w-3.5 h-3.5" style={{ color: "#8696a0" }} />
                  </button>

                  {}
                  {openMenu === m._id && (
                    <div
                      className={cn(
                        "absolute z-20 rounded-lg shadow-xl overflow-hidden",
                        mine ? "right-full mr-2" : "left-full ml-2",
                        "top-0"
                      )}
                      style={{
                        background: "#233138",
                        border: "1px solid rgba(255,255,255,0.08)",
                        minWidth: "160px",
                      }}
                    >
                      <div
                        className="flex gap-2 px-3 py-2 border-b"
                        style={{ borderColor: "rgba(255,255,255,0.06)" }}
                      >
                        {EMOJIS.map(emoji => {
                          return (
                            <button
                              key={emoji}
                              onClick={() => {
                                return react(m._id, emoji);
                              }}
                              className="text-lg hover:scale-125 transition-transform"
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => {
                          setReplyTo(m);
                          setOpenMenu(null);
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/5 transition"
                        style={{ color: "#e9edef" }}
                      >
                        <Reply className="w-4 h-4" /> Reply
                      </button>
                      {mine && m.type === "text" && (
                        <button
                          onClick={() => {
                            return startEdit(m);
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/5 transition"
                          style={{ color: "#e9edef" }}
                        >
                          <Pencil className="w-4 h-4" /> Edit
                        </button>
                      )}
                      {chat.isGroup && isAdmin && (
                        <button
                          onClick={() => {
                            return pinMessage(m._id);
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/5 transition"
                          style={{ color: "#e9edef" }}
                        >
                          <Pin className="w-4 h-4" /> {isPinned ? "Unpin" : "Pin"}
                        </button>
                      )}
                      {mine && (
                        <button
                          onClick={() => {
                            return removeMessage(m._id);
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/5 transition"
                          style={{ color: "#ef4444" }}
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      )}
                    </div>
                  )}

                  {}
                  <div
                    className="px-3 py-2 rounded-lg text-[14.5px] leading-relaxed break-words"
                    style={{
                      background: mine ? "#1f4b3f" : "#1f2c34",
                      color: "#e9edef",
                      borderRadius: mine ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                    }}
                  >
                    {chat.isGroup && !mine && (
                      <div className="text-xs font-semibold mb-0.5" style={{ color: "#25d366" }}>
                        {senderName}
                      </div>
                    )}

                    {replyMsg && (
                      <div
                        className="mb-1.5 px-2 py-1 rounded text-xs border-l-2"
                        style={{
                          background: "rgba(0,0,0,0.2)",
                          borderColor: "#25d366",
                          color: "#aebac1",
                        }}
                      >
                        <div
                          className="font-semibold text-[11px] mb-0.5"
                          style={{ color: "#25d366" }}
                        >
                          {typeof replyMsg.sender === "object"
                            ? replyMsg.sender.fullName || replyMsg.sender.username
                            : ""}
                        </div>
                        <div className="truncate">
                          {replyMsg.encryptedContent
                            ? getDisplayContent(replyMsg) || "(Encrypted message)"
                            : replyMsg.content || "Attachment"}
                        </div>
                      </div>
                    )}

                    {m.type === "image" && m.mediaUrl ? (
                      <img
                        src={m.mediaUrl}
                        alt="attachment"
                        className="rounded max-w-full max-h-60 object-cover mb-1"
                      />
                    ) : m.type === "file" && m.mediaUrl ? (
                      <a
                        href={m.mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 underline text-sm"
                        style={{ color: "#53bdeb" }}
                      >
                        <Paperclip className="w-4 h-4 shrink-0" /> Download file
                      </a>
                    ) : (
                      <span style={{ whiteSpace: "pre-wrap" }}>{displayContent}</span>
                    )}

                    {}
                    {(m.reactions ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {m.reactions!.map((r, ri) => {
                          return (
                            <span
                              key={ri}
                              className="text-sm px-1.5 py-0.5 rounded-full"
                              style={{ background: "rgba(255,255,255,0.08)" }}
                            >
                              {r.emoji}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {}
                    <div
                      className="flex items-center justify-end gap-1 mt-1"
                      style={{ color: "#8696a0" }}
                    >
                      {m.isEdited && <span className="text-[10px] italic">edited</span>}
                      {isPinned && <Pin className="w-2.5 h-2.5" />}
                      <span className="text-[11px]">{formatTime(m.createdAt)}</span>
                      <StatusTick status={status} mine={mine} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {typingUser && (
          <div className="flex items-end gap-1.5 mb-0.5">
            <div
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: "#1f2c34", color: "#8696a0" }}
            >
              {typingUser} is typing…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {}
      {editingMessage && (
        <form
          onSubmit={submitEdit}
          className="flex items-center gap-3 px-4 py-2.5 shrink-0"
          style={{ background: "#1a2632", borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <Pencil className="w-4 h-4 shrink-0" style={{ color: "#25d366" }} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium mb-0.5" style={{ color: "#25d366" }}>
              Edit message
            </div>
            <input
              ref={editInputRef}
              value={editText}
              onChange={e => {
                return setEditText(e.target.value);
              }}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitEdit();
                }
                if (e.key === "Escape") {
                  cancelEdit();
                }
              }}
              className="w-full bg-transparent text-[14px] outline-none"
              style={{ color: "#e9edef" }}
            />
          </div>
          <button
            type="button"
            onClick={cancelEdit}
            className="p-1 rounded-full hover:bg-white/10 transition"
            style={{ color: "#8696a0" }}
          >
            <X className="w-4 h-4" />
          </button>
          <button
            type="submit"
            disabled={editSaving || !editText.trim()}
            className="p-1.5 rounded-full hover:bg-white/10 transition disabled:opacity-50"
            style={{ color: "#25d366" }}
          >
            {editSaving ? <Spinner className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          </button>
        </form>
      )}

      {replyTo && !editingMessage && (
        <div
          className="flex items-center gap-3 px-4 py-2.5 shrink-0"
          style={{ background: "#1a2632", borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <Reply className="w-4 h-4 shrink-0" style={{ color: "#25d366" }} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium" style={{ color: "#25d366" }}>
              Replying to{" "}
              {typeof replyTo.sender === "object"
                ? replyTo.sender.fullName || replyTo.sender.username
                : ""}
            </div>
            <div className="text-sm truncate" style={{ color: "#8696a0" }}>
              {replyTo.encryptedContent
                ? getDisplayContent(replyTo) || "(Encrypted message)"
                : replyTo.content || "Attachment"}
            </div>
          </div>
          <button
            onClick={() => {
              return setReplyTo(null);
            }}
            className="p-1 rounded-full hover:bg-white/10 transition"
            style={{ color: "#8696a0" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!chat?.isGroup &&
        (blockedByMe || blockedByThem || (!isFriend && other?.isPrivate !== false)) && (
          <div
            className="px-4 py-3 text-center shrink-0"
            style={{ background: "#1a2632", borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            {blockedByMe && (
              <p className="text-sm" style={{ color: "#8696a0" }}>
                You blocked{" "}
                <strong style={{ color: "#e9edef" }}>{other?.fullName || other?.username}</strong>
                {" · "}
                <button onClick={toggleBlock} style={{ color: "#25d366" }}>
                  Unblock
                </button>
              </p>
            )}
            {blockedByThem && !blockedByMe && (
              <p className="text-sm" style={{ color: "#8696a0" }}>
                <strong style={{ color: "#e9edef" }}>{other?.fullName || other?.username}</strong>{" "}
                blocked you
              </p>
            )}
            {!blockedByMe && !blockedByThem && !isFriend && other?.isPrivate !== false && (
              <p className="text-sm" style={{ color: "#8696a0" }}>
                You are no longer friends with{" "}
                <strong style={{ color: "#e9edef" }}>{other?.fullName || other?.username}</strong>
                {" · "}
                <button
                  onClick={() => {
                    return navigate(`/profile/${other?._id}`);
                  }}
                  style={{ color: "#25d366" }}
                >
                  Add friend
                </button>
              </p>
            )}
          </div>
        )}

      {(chat?.isGroup ||
        (!blockedByMe && !blockedByThem && (isFriend || other?.isPrivate === false))) &&
        !editingMessage && (
          <form
            onSubmit={send}
            className="flex items-end gap-2 px-2 py-2 shrink-0"
            style={{
              background: "#0b141a",
              paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
            }}
          >
            <input ref={fileRef} type="file" hidden onChange={onFile} />

            <button
              type="button"
              onClick={() => {
                return fileRef.current?.click();
              }}
              className="p-2.5 rounded-full hover:bg-white/10 transition shrink-0"
              style={{ color: "#8696a0" }}
            >
              <Paperclip className="w-[22px] h-[22px]" />
            </button>

            <div
              className="flex-1 flex items-center px-4 py-2.5 rounded-full"
              style={{
                background: "#1f2c34",
                border: "1px solid rgba(255,255,255,0.06)",
                minHeight: "44px",
              }}
            >
              <input
                value={text}
                onChange={e => {
                  return onType(e.target.value);
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Message"
                className="flex-1 bg-transparent text-[15px] outline-none placeholder-[#8696a0]"
                style={{ color: "#e9edef" }}
              />
            </div>

            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 active:scale-95 disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #00a884, #008069)",
                boxShadow: text.trim() ? "0 2px 12px rgba(0,168,132,0.35)" : "none",
              }}
            >
              {sending ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <Send className="w-5 h-5 text-white" style={{ transform: "translateX(1px)" }} />
              )}
            </button>
          </form>
        )}
    </div>
  );
}
