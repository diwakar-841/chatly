import { useEffect, useState } from "react";
import { ArrowLeft, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "@/api/client";
import type { User } from "@/types";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { Spinner } from "@/components/Spinner";
import { apiError } from "@/api/client";

interface BlockedUserEntry {
  _id: string;
  blocker: string;
  blocked: User;
  createdAt: string;
}

export default function BlockedPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<BlockedUserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<BlockedUserEntry[]>("/block")
      .then(r => {
        return setEntries(r.data);
      })
      .catch(e => {
        return toast.error(apiError(e));
      })
      .finally(() => {
        return setLoading(false);
      });
  }, []);

  
  const unblock = async (blockedUserId: string) => {
    setUnblocking(blockedUserId);
    try {
      await api.delete(`/block/${blockedUserId}`);
      setEntries(prev => {
        return prev.filter(e => {
          return e.blocked._id !== blockedUserId;
        });
      });
      toast.success("Unblocked");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setUnblocking(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-elevated shrink-0">
        <button
          onClick={() => {
            return navigate(-1);
          }}
          className="p-1.5 hover:bg-bg-panel rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Blocked users</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No blocked users"
            description="People you block will appear here."
          />
        ) : (
          entries.map(entry => {
            const u = entry.blocked;
            return (
              <div
                key={entry._id}
                className="flex items-center gap-3 px-4 py-3 border-b border-border/40"
              >
                <Avatar src={u.avatar} name={u.fullName || u.username} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{u.fullName || u.username}</div>
                  <div className="text-sm text-muted truncate">@{u.username}</div>
                </div>
                <button
                  onClick={() => {
                    return unblock(u._id);
                  }}
                  disabled={unblocking === u._id}
                  className="btn-ghost text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  {unblocking === u._id ? "..." : "Unblock"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
