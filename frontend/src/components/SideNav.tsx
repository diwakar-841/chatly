import { NavLink } from "react-router-dom";
import { MessageCircle, Users, Bell, User, Shield, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { authApi } from "@/api/endpoints";
import { disconnectSocket } from "@/lib/socket";
import { useSocket } from "@/context/SocketContext";
import toast from "react-hot-toast";

const items = [
  { to: "/chats", icon: MessageCircle, label: "Chats" },
  { to: "/requests", icon: Users, label: "Requests" },
  { to: "/notifications", icon: Bell, label: "Alerts" },
  { to: "/blocked", icon: Shield, label: "Blocked" },
  { to: "/profile", icon: User, label: "Profile" },
];


export function SideNav() {
  const { refreshToken, clear } = useAuth();
  const { unreadNotifCount, pendingRequestCount, groupInviteCount } = useSocket();

  
  const badge = (to: string) => {
    if (to === "/notifications") {
      return unreadNotifCount;
    }
    if (to === "/requests") {
      return pendingRequestCount + groupInviteCount;
    }
    return 0;
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

  return (
    <aside className="hidden md:flex flex-col w-16 lg:w-20 bg-bg-elevated border-r border-border items-center py-4 gap-2">
      <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-black font-bold text-lg mb-4">
        C
      </div>

      <div className="flex-1 flex flex-col gap-1 w-full px-2">
        {items.map(({ to, icon: Icon, label }) => {
          const b = badge(to);
          return (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) => {
                return cn(
                  "relative flex items-center justify-center h-12 rounded-lg transition",
                  isActive
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:text-white hover:bg-bg-panel"
                );
              }}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {b > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-accent text-black text-[9px] font-bold rounded-full min-w-3.5 h-3.5 px-0.5 flex items-center justify-center">
                    {b > 99 ? "99+" : b}
                  </span>
                )}
              </div>
            </NavLink>
          );
        })}
      </div>

      <button
        onClick={logout}
        title="Logout"
        className="w-12 h-12 flex items-center justify-center rounded-lg text-muted hover:text-red-400 hover:bg-bg-panel transition"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </aside>
  );
}
