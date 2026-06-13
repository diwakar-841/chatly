import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Trash2, Users, MessageCircle, UserPlus, AlertCircle, UserCheck } from "lucide-react";
import toast from "react-hot-toast";
import { notificationApi } from "@/api/endpoints";
import type { Notification } from "@/types";
import { EmptyState } from "@/components/EmptyState";
import { Spinner } from "@/components/Spinner";
import { formatRelative, cn } from "@/lib/utils";
import { apiError } from "@/api/client";
import { useSocket } from "@/context/SocketContext";

/** Renders a contextual icon for the given notification type. */
function NotifIcon({ type }: { type: Notification["type"] }) {
  const cls = "w-4 h-4";
  if (type === "request") return <UserPlus className={cls} />;
  if (type === "request_accepted") return <UserCheck className={cls} />;
  if (type === "message") return <MessageCircle className={cls} />;
  if (type === "group_add") return <Users className={cls} />;
  if (type === "group_invite") return <UserPlus className={cls} />;
  if (type === "group_join_request") return <Users className={cls} />;
  return <AlertCircle className={cls} />;
}

/** Shows all notifications with mark-as-read and delete actions. */
export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { setUnreadNotifCount } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    notificationApi.list()
      .then((ns) => {
        setItems(ns);
        setUnreadNotifCount(ns.filter((n) => !n.isRead).length);
      })
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  /** Marks a single notification as read then navigates to its link if present. */
  const handleClick = async (n: Notification) => {
    if (!n.isRead) {
      try {
        await notificationApi.markOneRead(n._id);
        setItems((p) => p.map((x) => x._id === n._id ? { ...x, isRead: true } : x));
        setUnreadNotifCount((c) => Math.max(0, c - 1));
      } catch { /* non-fatal */ }
    }
    if (n.link) navigate(n.link);
  };

  /** Marks all notifications as read in a single API call. */
  const markAll = async () => {
    try {
      await notificationApi.markAllRead();
      setItems((p) => p.map((n) => ({ ...n, isRead: true })));
      setUnreadNotifCount(0);
      toast.success("All marked as read");
    } catch (e) { toast.error(apiError(e)); }
  };

  /** Deletes a single notification; also decrements the unread badge if it was unread. */
  const deleteOne = async (id: string, wasRead: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationApi.deleteOne(id);
      setItems((p) => p.filter((n) => n._id !== id));
      if (!wasRead) setUnreadNotifCount((c) => Math.max(0, c - 1));
    } catch (err) { toast.error(apiError(err)); }
  };

  /** Deletes every notification for the current user. */
  const clearAll = async () => {
    try {
      await notificationApi.clearAll();
      setItems([]);
      setUnreadNotifCount(0);
      toast.success("All notifications cleared");
    } catch (e) { toast.error(apiError(e)); }
  };

  const unread = items.filter((i) => !i.isRead).length;

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 md:px-6 pt-5 pb-3 border-b border-border bg-bg-elevated">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Notifications</h1>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button onClick={markAll} className="btn-ghost text-sm gap-1.5">
                <CheckCheck className="w-4 h-4" /> Mark all read
              </button>
            )}
            {items.length > 0 && (
              <button onClick={clearAll} className="btn-ghost text-sm text-red-400 hover:text-red-300 gap-1.5">
                <Trash2 className="w-4 h-4" /> Clear all
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications yet" description="You're all caught up." />
        ) : (
          items.map((n) => (
            <div
              key={n._id}
              onClick={() => handleClick(n)}
              className={cn(
                "group w-full flex items-start gap-3 px-4 py-3 border-b border-border/40 text-left hover:bg-bg-panel transition",
                n.link ? "cursor-pointer" : "cursor-default",
                !n.isRead && "bg-accent/5"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                n.isRead ? "bg-bg-panel text-muted" : "bg-accent/20 text-accent"
              )}>
                <NotifIcon type={n.type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">{n.message}</p>
                <p className="text-xs text-muted mt-0.5">{formatRelative(n.createdAt)}</p>
                {n.type === "group_invite" && (
                  <p className="text-xs text-accent mt-1">Tap to view invite →</p>
                )}
                {n.type === "group_join_request" && (
                  <p className="text-xs text-accent mt-1">Tap to review request →</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!n.isRead && <span className="w-2 h-2 rounded-full bg-accent" />}
                <button
                  onClick={(e) => deleteOne(n._id, n.isRead, e)}
                  title="Delete"
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-red-400 rounded transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
