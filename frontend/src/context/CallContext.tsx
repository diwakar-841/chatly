import {
  createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode,
} from "react";
import toast from "react-hot-toast";
import { useSocket } from "@/context/SocketContext";

/** The kind of media a call carries. */
export type CallType = "audio" | "video";

/** Lifecycle phases for the active call state machine. */
export type CallStatus = "idle" | "outgoing" | "incoming" | "connecting" | "active" | "ended";

/** Minimal user shape needed to render the call UI. */
export interface CallPeer {
  _id: string;
  username: string;
  fullName?: string;
  avatar?: string;
}

interface CallContextValue {
  status: CallStatus;
  callType: CallType;
  peer: CallPeer | null;
  /** Local and remote media streams, exposed for the overlay's <video> elements. */
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micEnabled: boolean;
  camEnabled: boolean;
  /** Seconds elapsed since the call became active. */
  elapsed: number;
  /** Starts an outgoing call to a peer with the given media type. */
  startCall: (peer: CallPeer, chatId: string, type: CallType) => Promise<void>;
  /** Accepts the currently ringing incoming call. */
  acceptCall: () => Promise<void>;
  /** Rejects the currently ringing incoming call. */
  rejectCall: () => void;
  /** Hangs up an outgoing/active call or cancels a ringing one. */
  endCall: () => void;
  toggleMic: () => void;
  toggleCam: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

/** Public STUN servers — sufficient for most NAT traversal without a TURN server. */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/**
 * Owns all WebRTC + signaling logic for 1-to-1 voice and video calls. Mount
 * once inside the SocketProvider. Renders the call UI via <CallOverlay /> which
 * reads this context. Media never flows through the server — only SDP and ICE.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();

  const [status, setStatus] = useState<CallStatus>("idle");
  const [callType, setCallType] = useState<CallType>("video");
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const chatIdRef = useRef<string>("");
  const peerIdRef = useRef<string>("");
  /** ICE candidates received before remoteDescription is set are queued here. */
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  /** Holds the incoming SDP offer until the user accepts. */
  const incomingOffer = useRef<RTCSessionDescriptionInit | null>(null);
  const ringTimeout = useRef<number>();
  const elapsedTimer = useRef<number>();

  /** Stops all local media tracks and releases the camera/mic. */
  const stopLocalMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  }, []);

  /** Tears down the peer connection, media, timers, and resets all call state. */
  const cleanup = useCallback(() => {
    if (ringTimeout.current) window.clearTimeout(ringTimeout.current);
    if (elapsedTimer.current) window.clearInterval(elapsedTimer.current);
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    stopLocalMedia();
    pendingCandidates.current = [];
    incomingOffer.current = null;
    chatIdRef.current = "";
    peerIdRef.current = "";
    setLocalStream(null);
    setRemoteStream(null);
    setMicEnabled(true);
    setCamEnabled(true);
    setElapsed(0);
    setStatus("idle");
    setPeer(null);
  }, [stopLocalMedia]);

  /** Briefly shows the "ended" screen, then fully resets. */
  const finishCall = useCallback(() => {
    if (elapsedTimer.current) window.clearInterval(elapsedTimer.current);
    setStatus("ended");
    window.setTimeout(() => cleanup(), 1200);
  }, [cleanup]);

  /** Requests camera/mic access for the requested call type. */
  const getMedia = useCallback(async (type: CallType): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video" ? { facingMode: "user" } : false,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  /** Builds an RTCPeerConnection wired to emit ICE and surface the remote stream. */
  const createPeerConnection = useCallback(
    (targetId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket?.emit("call:ice-candidate", { to: targetId, candidate: e.candidate });
        }
      };

      pc.ontrack = (e) => {
        setRemoteStream(e.streams[0]);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setStatus("active");
        } else if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
          if (status !== "ended") finishCall();
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [socket, status, finishCall]
  );

  /** Caller flow: gets media, creates an offer, and rings the peer. */
  const startCall = useCallback(
    async (target: CallPeer, chatId: string, type: CallType) => {
      if (!socket) return;
      if (status !== "idle") {
        toast.error("You're already in a call");
        return;
      }
      try {
        setCallType(type);
        setPeer(target);
        setCamEnabled(type === "video");
        peerIdRef.current = target._id;
        chatIdRef.current = chatId;
        setStatus("outgoing");

        const stream = await getMedia(type);
        const pc = createPeerConnection(target._id);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("call:initiate", { to: target._id, chatId, callType: type, offer });

        // Auto-cancel if unanswered after 35s. The timer is cleared once the
        // call becomes active (see the elapsed-time effect).
        ringTimeout.current = window.setTimeout(() => {
          if (pcRef.current) {
            toast("No answer");
            socket.emit("call:end", { to: target._id });
            finishCall();
          }
        }, 35000);
      } catch (err) {
        toast.error("Could not access camera/microphone");
        cleanup();
      }
    },
    [socket, status, getMedia, createPeerConnection, cleanup, finishCall]
  );

  /** Callee flow: gets media, applies the stored offer, and sends an answer. */
  const acceptCall = useCallback(async () => {
    if (!socket || !incomingOffer.current || !peerIdRef.current) return;
    try {
      setStatus("connecting");
      const stream = await getMedia(callType);
      const pc = createPeerConnection(peerIdRef.current);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer.current));
      for (const c of pendingCandidates.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingCandidates.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:accept", { to: peerIdRef.current, answer });
      incomingOffer.current = null;
    } catch (err) {
      toast.error("Could not access camera/microphone");
      socket.emit("call:reject", { to: peerIdRef.current });
      cleanup();
    }
  }, [socket, callType, getMedia, createPeerConnection, cleanup]);

  /** Declines a ringing incoming call. */
  const rejectCall = useCallback(() => {
    if (peerIdRef.current) socket?.emit("call:reject", { to: peerIdRef.current });
    cleanup();
  }, [socket, cleanup]);

  /** Hangs up / cancels the current call and notifies the peer. */
  const endCall = useCallback(() => {
    if (peerIdRef.current) socket?.emit("call:end", { to: peerIdRef.current });
    finishCall();
  }, [socket, finishCall]);

  /** Toggles the local microphone track. */
  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicEnabled(track.enabled);
    }
  }, []);

  /** Toggles the local camera track (video calls only). */
  const toggleCam = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamEnabled(track.enabled);
    }
  }, []);

  /** Starts the elapsed-time counter once the call becomes active. */
  useEffect(() => {
    if (status === "active") {
      if (ringTimeout.current) window.clearTimeout(ringTimeout.current);
      elapsedTimer.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
      return () => window.clearInterval(elapsedTimer.current);
    }
  }, [status]);

  /** Registers all signaling listeners for the lifetime of the socket. */
  useEffect(() => {
    if (!socket) return;

    const onIncoming = ({ from, chatId, callType: type, offer, caller }: {
      from: string; chatId: string; callType: CallType;
      offer: RTCSessionDescriptionInit; caller: CallPeer;
    }) => {
      // Busy: auto-reject a second incoming call.
      if (status !== "idle") {
        socket.emit("call:reject", { to: from });
        return;
      }
      incomingOffer.current = offer;
      peerIdRef.current = from;
      chatIdRef.current = chatId;
      setCallType(type);
      setCamEnabled(type === "video");
      setPeer(caller);
      setStatus("incoming");
    };

    const onAccepted = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      setStatus("connecting");
      await pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(() => {});
      for (const c of pendingCandidates.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingCandidates.current = [];
    };

    const onRejected = () => {
      toast("Call declined");
      finishCall();
    };

    const onEnded = () => {
      toast("Call ended");
      finishCall();
    };

    const onIce = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      const pc = pcRef.current;
      if (pc?.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      } else {
        pendingCandidates.current.push(candidate);
      }
    };

    const onUnavailable = () => {
      toast.error("User is offline");
      cleanup();
    };

    const onFailed = ({ reason }: { reason: string }) => {
      toast.error(reason || "Call failed");
      cleanup();
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:accepted", onAccepted);
    socket.on("call:rejected", onRejected);
    socket.on("call:ended", onEnded);
    socket.on("call:ice-candidate", onIce);
    socket.on("call:unavailable", onUnavailable);
    socket.on("call:failed", onFailed);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:accepted", onAccepted);
      socket.off("call:rejected", onRejected);
      socket.off("call:ended", onEnded);
      socket.off("call:ice-candidate", onIce);
      socket.off("call:unavailable", onUnavailable);
      socket.off("call:failed", onFailed);
    };
  }, [socket, status, finishCall, cleanup]);

  return (
    <CallContext.Provider
      value={{
        status, callType, peer, localStream, remoteStream,
        micEnabled, camEnabled, elapsed,
        startCall, acceptCall, rejectCall, endCall, toggleMic, toggleCam,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

/** Hook for accessing the call context from any child component. */
export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within a CallProvider");
  return ctx;
}
