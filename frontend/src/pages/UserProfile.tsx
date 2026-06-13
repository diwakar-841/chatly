import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle, UserPlus, UserCheck, UserX, BadgeCheck, Loader2, Lock, Ban } from "lucide-react";
import toast from "react-hot-toast";
import { profileApi, chatApi, requestApi, blockApi } from "@/api/endpoints";
import type { User, RequestStatus } from "@/types";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/store/auth";
import { apiError } from "@/api/client";
import { useSocket } from "@/context/SocketContext";

/** Extends the public User shape with visibility flags returned by the profile endpoint. */
interface ProfileData extends User {
  canView?: boolean;
  canChat?: boolean;
}

/** Displays another user's public profile with friend-request, DM, and block actions. */
export default function UserProfilePage() {
  const { userId = "" } = useParams();
  const navigate = useNavigate();
  const me = useAuth((s) => s.user);
  const { onlineUsers, removeOnlineUser } = useSocket();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [status, setStatus] = useState<RequestStatus>("none");
  const [requestId, setRequestId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);

  useEffect(() => {
    if (me && userId === me._id) navigate("/profile", { replace: true });
  }, [userId, me, navigate]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setUnavailable(false);
    Promise.all([
      profileApi.get(userId),
      profileApi.requestStatus(userId),
      blockApi.checkBlock(userId),
    ])
      .then(([prof, req, blockStatus]) => {
        setProfile(prof as ProfileData);
        setStatus(req.status ?? "none");
        setRequestId(req.requestId);
        setBlockedByMe(blockStatus.blockedByMe);
      })
      .catch((e) => {
        const s = e?.response?.status;
        if (s === 403) {
          setUnavailable(true);
        } else {
          toast.error(apiError(e, "Could not load profile"));
          navigate(-1);
        }
      })
      .finally(() => setLoading(false));
  }, [userId, navigate]);

  /** Opens or creates a direct-message chat with this user and navigates to it. */
  const openDM = async () => {
    setActionLoading(true);
    try {
      const chat = await chatApi.dm(userId);
      navigate(`/chats/${chat._id}`);
    } catch (e) {
      toast.error(apiError(e, "Could not open chat"));
    } finally {
      setActionLoading(false);
    }
  };

  /** Sends a friend request to this user. */
  const sendRequest = async () => {
    setActionLoading(true);
    try {
      const req = await requestApi.send(userId);
      setStatus("pending_sent");
      setRequestId(req._id);
      toast.success("Friend request sent");
    } catch (e) {
      toast.error(apiError(e, "Failed to send request"));
    } finally {
      setActionLoading(false);
    }
  };

  /** Cancels a previously sent friend request. */
  const withdrawRequest = async () => {
    if (!requestId) return;
    setActionLoading(true);
    try {
      await requestApi.withdraw(requestId);
      setStatus("none");
      setRequestId(undefined);
      toast.success("Request withdrawn");
    } catch (e) {
      toast.error(apiError(e, "Failed to withdraw request"));
    } finally {
      setActionLoading(false);
    }
  };

  /** Accepts an incoming friend request from this user. */
  const acceptRequest = async () => {
    if (!requestId) return;
    setActionLoading(true);
    try {
      await requestApi.respond(requestId, "accept");
      setStatus("accepted");
      setProfile((p) => p ? { ...p, canChat: true } : p);
      toast.success("Request accepted");
    } catch (e) {
      toast.error(apiError(e, "Failed to accept request"));
    } finally {
      setActionLoading(false);
    }
  };

  /** Blocks this user and removes them from the online-users set. */
  const handleBlock = async () => {
    setActionLoading(true);
    try {
      await blockApi.block(userId);
      setBlockedByMe(true);
      removeOnlineUser(userId);
      toast.success("User blocked");
    } catch (e) {
      toast.error(apiError(e, "Failed to block user"));
    } finally {
      setActionLoading(false);
    }
  };

  /** Unblocks this user. */
  const handleUnblock = async () => {
    setActionLoading(true);
    try {
      await blockApi.unblock(userId);
      setBlockedByMe(false);
      toast.success("User unblocked");
    } catch (e) {
      toast.error(apiError(e, "Failed to unblock user"));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="flex flex-col h-full">
        <header className="px-4 pt-5 pb-3 border-b border-border bg-bg-elevated shrink-0 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-bg-panel rounded-lg text-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Profile</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="w-16 h-16 rounded-full bg-bg-panel flex items-center justify-center">
            <Ban className="w-8 h-8 text-muted" />
          </div>
          <div>
            <p className="font-semibold text-lg">This profile is unavailable</p>
            <p className="text-sm text-muted mt-1">You can't view this profile right now.</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="mt-2 btn-ghost px-6 py-2 rounded-xl border border-border text-sm"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const isOnline = !blockedByMe && (status === "accepted" || profile?.isPrivate === false) && onlineUsers.has(userId);
  const displayName = profile.fullName || profile.username;
  const canView = profile.canView !== false;
  const canChat = (profile.canChat === true || status === "accepted") && !blockedByMe;

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-5 pb-3 border-b border-border bg-bg-elevated shrink-0 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-bg-panel rounded-lg text-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold truncate">{displayName}</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-20 md:pb-6">
        <div className="flex flex-col items-center py-10 px-4">
          <div className="relative">
            <Avatar src={profile.avatar} name={displayName} size={100} online={isOnline} />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <h2 className="text-2xl font-bold">{displayName}</h2>
            {profile.isVerified && <BadgeCheck className="w-5 h-5 text-accent" />}
          </div>
          <p className="text-muted text-sm mt-1">@{profile.username}</p>
          {profile.isPrivate && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted">
              <Lock className="w-3.5 h-3.5" />
              Private account
            </div>
          )}
          {isOnline && <p className="text-xs text-accent mt-1">Online</p>}
        </div>

        {blockedByMe && (
          <div className="mx-4 mb-4 card p-4 flex flex-col items-center gap-2 text-center">
            <Ban className="w-6 h-6 text-muted" />
            <p className="text-sm text-muted">
              You blocked <strong className="text-foreground">{displayName}</strong>.
              They can't message you or see your online status.
            </p>
            <button
              onClick={handleUnblock}
              disabled={actionLoading}
              className="btn-ghost px-5 py-2 rounded-xl border border-border text-sm flex items-center gap-2"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Unblock
            </button>
          </div>
        )}

        {canView && profile.bio && (
          <div className="mx-4 mb-4 max-w-lg mx-auto">
            <div className="card p-4">
              <p className="text-xs uppercase text-muted font-semibold tracking-wider mb-1">Bio</p>
              <p className="text-sm">{profile.bio}</p>
            </div>
          </div>
        )}

        {!canView && (
          <div className="mx-4 mb-4 card p-6 flex flex-col items-center gap-2 text-center">
            <Lock className="w-8 h-8 text-muted" />
            <p className="font-medium">This account is private</p>
            <p className="text-sm text-muted">Send a friend request to see their profile and start chatting.</p>
          </div>
        )}

        <div className="px-4 max-w-lg mx-auto space-y-3">
          {canChat && (
            <button
              onClick={openDM}
              disabled={actionLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
              Message
            </button>
          )}

          {status === "none" && !blockedByMe && (
            <button
              onClick={sendRequest}
              disabled={actionLoading}
              className="btn-ghost w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Send Friend Request
            </button>
          )}

          {status === "pending_sent" && !blockedByMe && (
            <button
              onClick={withdrawRequest}
              disabled={actionLoading}
              className="btn-ghost w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-muted"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
              Withdraw Request
            </button>
          )}

          {status === "pending_received" && !blockedByMe && (
            <button
              onClick={acceptRequest}
              disabled={actionLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              Accept Request
            </button>
          )}

          {status === "accepted" && !canChat && !blockedByMe && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted">
              <UserCheck className="w-4 h-4 text-accent" />
              Friends
            </div>
          )}

          {!blockedByMe && (
            <button
              onClick={handleBlock}
              disabled={actionLoading}
              className="w-full py-3 rounded-xl text-red-400 text-sm hover:bg-red-400/10 transition"
            >
              Block user
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
