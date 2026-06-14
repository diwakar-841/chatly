import { useEffect, useRef } from "react";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useCall } from "@/context/CallContext";

/** Formats a seconds count as m:ss for the in-call timer. */
function formatDuration(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Full-screen overlay that renders every call phase: outgoing ringing,
 * incoming ringing (accept/decline), and the active audio/video call with
 * mute, camera, and hang-up controls. Reads all state from CallContext.
 */
export function CallOverlay() {
  const {
    status, callType, peer, localStream, remoteStream,
    micEnabled, camEnabled, elapsed,
    acceptCall, rejectCall, endCall, toggleMic, toggleCam,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  /** Binds the local preview stream to its <video> element. */
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, status]);

  /** Binds the remote stream to the video element (video calls). */
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, status, callType]);

  /** Binds the remote stream to a hidden <audio> element for voice calls. */
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (status === "idle" || !peer) return null;

  const name = peer.fullName || peer.username;
  const isVideo = callType === "video";
  const showRemoteVideo = isVideo && status === "active" && remoteStream;

  const statusLabel =
    status === "outgoing" ? "Ringing…"
    : status === "incoming" ? `Incoming ${isVideo ? "video" : "voice"} call`
    : status === "connecting" ? "Connecting…"
    : status === "active" ? formatDuration(elapsed)
    : "Call ended";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: "#0b141a" }}
      role="dialog"
      aria-label={`${isVideo ? "Video" : "Voice"} call with ${name}`}
    >
      {/* Remote video fills the screen during an active video call */}
      {showRemoteVideo ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ background: "#0b141a" }}
        />
      ) : null}

      {/* Hidden audio sink so voice (and pre-video) audio always plays */}
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      {/* Local self-view (video calls only) */}
      {isVideo && localStream && status !== "ended" && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute top-4 right-4 w-28 h-40 md:w-36 md:h-52 rounded-2xl object-cover z-20 shadow-2xl"
          style={{ border: "2px solid rgba(255,255,255,0.15)", background: "#1f2c34" }}
        />
      )}

      {/* Identity + status — hidden behind the remote feed once video is active */}
      {!showRemoteVideo && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 relative z-10">
          <Avatar src={peer.avatar} name={name} size={128} />
          <div className="text-center">
            <h2 className="text-2xl font-semibold" style={{ color: "#e9edef" }}>{name}</h2>
            <p className="text-sm mt-1.5" style={{ color: "#8696a0" }}>{statusLabel}</p>
          </div>
        </div>
      )}

      {/* Active video: timer chip at top */}
      {showRemoteVideo && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <span
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: "rgba(0,0,0,0.55)", color: "#e9edef" }}
          >
            {name} · {formatDuration(elapsed)}
          </span>
        </div>
      )}

      {/* Controls */}
      <div className="relative z-20 pb-10 pt-6 px-6 flex items-center justify-center gap-5">
        {status === "incoming" ? (
          <>
            <button
              onClick={rejectCall}
              aria-label="Decline call"
              className="w-16 h-16 rounded-full flex items-center justify-center transition active:scale-95"
              style={{ background: "#ef4444" }}
            >
              <PhoneOff className="w-7 h-7" style={{ color: "#fff" }} />
            </button>
            <button
              onClick={acceptCall}
              aria-label="Accept call"
              className="w-16 h-16 rounded-full flex items-center justify-center transition active:scale-95"
              style={{ background: "#25d366" }}
            >
              <Phone className="w-7 h-7" style={{ color: "#0b141a" }} />
            </button>
          </>
        ) : status === "ended" ? null : (
          <>
            <button
              onClick={toggleMic}
              aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
              className="w-14 h-14 rounded-full flex items-center justify-center transition active:scale-95"
              style={{ background: micEnabled ? "rgba(255,255,255,0.12)" : "#e9edef" }}
            >
              {micEnabled
                ? <Mic className="w-6 h-6" style={{ color: "#e9edef" }} />
                : <MicOff className="w-6 h-6" style={{ color: "#0b141a" }} />}
            </button>

            {isVideo && (
              <button
                onClick={toggleCam}
                aria-label={camEnabled ? "Turn camera off" : "Turn camera on"}
                className="w-14 h-14 rounded-full flex items-center justify-center transition active:scale-95"
                style={{ background: camEnabled ? "rgba(255,255,255,0.12)" : "#e9edef" }}
              >
                {camEnabled
                  ? <Video className="w-6 h-6" style={{ color: "#e9edef" }} />
                  : <VideoOff className="w-6 h-6" style={{ color: "#0b141a" }} />}
              </button>
            )}

            <button
              onClick={endCall}
              aria-label="End call"
              className="w-16 h-16 rounded-full flex items-center justify-center transition active:scale-95"
              style={{ background: "#ef4444" }}
            >
              <PhoneOff className="w-7 h-7" style={{ color: "#fff" }} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
