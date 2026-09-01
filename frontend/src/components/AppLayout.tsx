import { Outlet, useLocation } from "react-router-dom";
import { SideNav } from "./SideNav";
import { BottomNav } from "./BottomNav";
import { AiChat } from "./AiChat";

export function AppLayout() {
  const loc = useLocation();
  const inChat = /^\/chats\/[^/]+/.test(loc.pathname);

  return (
    <div className="h-screen flex bg-bg overflow-hidden">
      <SideNav />
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Outlet />
      </main>
      {!inChat && <BottomNav />}
      <AiChat />
    </div>
  );
}
