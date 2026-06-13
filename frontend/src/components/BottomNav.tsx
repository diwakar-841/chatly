import { NavLink } from "react-router-dom";
import { MessageCircle, Users, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { notificationApi, requestApi, chatApi } from "@/api/endpoints";
import { useSocket } from "@/context/SocketContext";

const items = [
  { to: "/chats", label: "Chats", icon: MessageCircle },
  { to: "/requests", label: "Requests", icon: Users },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

/**
 * Mobile-only bottom navigation bar. Polls unread counts every 60 seconds
 * and listens for socket-driven badge updates via SocketContext.
 */
export function BottomNav() {
  const {
    unreadNotifCount, pendingRequestCount, groupInviteCount,
    setUnreadNotifCount, setPendingRequestCount, setGroupInviteCount,
  } = useSocket();

  /** Fetches initial badge counts on mount and refreshes them every minute. */
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [n, r, inv] = await Promise.all([
          notificationApi.unreadCount().catch(() => ({ count: 0 })),
          requestApi.pending().catch(() => []),
          chatApi.getMyInvites().catch(() => []),
        ]);
        if (!mounted) return;
        setUnreadNotifCount(n.count || 0);
        setPendingRequestCount(Array.isArray(r) ? r.length : 0);
        setGroupInviteCount(Array.isArray(inv) ? inv.length : 0);
      } catch {/* ignore */}
    };
    load();
    const id = setInterval(load, 60000);
    return () => { mounted = false; clearInterval(id); };
  }, [setUnreadNotifCount, setPendingRequestCount, setGroupInviteCount]);

  /** Returns the badge count relevant to the given nav path. */
  const badge = (to: string) => {
    if (to === "/notifications") return unreadNotifCount;
    if (to === "/requests") return pendingRequestCount + groupInviteCount;
    return 0;
  };

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-bg-elevated border-t border-border">
      <div className="grid grid-cols-4 max-w-md mx-auto">
        {items.map(({ to, label, icon: Icon }) => {
          const b = badge(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn("flex flex-col items-center justify-center py-2.5 gap-1 text-xs transition-colors relative",
                  isActive ? "text-accent" : "text-muted hover:text-white")
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn("relative px-3 py-1 rounded-full transition", isActive && "bg-accent/15")}>
                    <Icon className="w-5 h-5" />
                    {b > 0 && (
                      <span className="absolute -top-1 -right-1 bg-accent text-black text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
                        {b > 99 ? "99+" : b}
                      </span>
                    )}
                  </div>
                  <span className="font-medium">{label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)] bg-bg-elevated" />
    </nav>
  );
}
