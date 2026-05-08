import {
  Camera,
  CameraOff,
  Copy,
  Languages,
  Link as LinkIcon,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Radio,
  Send,
  Shield,
  Square,
  UserMinus,
  UserRound
} from "lucide-react";
import Peer from "peerjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../utils/api.js";
const API_ORIGIN =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";
import { createSocket } from "../utils/socket.js";

const peerConfig = {
  host: "localhost",
  port: 5000,
  path: "/peerjs/myapp"
};

const normalizeRoomType = (roomType) => (roomType === "audio" ? "audio" : "video");

const getMediaConstraints = (roomType) => {
  const normalizedRoomType = normalizeRoomType(roomType);

  if (normalizedRoomType === "audio") {
    return { audio: true, video: false };
  }

  return { audio: true, video: true };
};

const getMediaErrorMessage = (error, roomType) => {
  const callType = normalizeRoomType(roomType) === "audio" ? "microphone" : "camera and microphone";

  if (typeof window !== "undefined" && !window.isSecureContext) {
    return `${callType} access requires HTTPS or localhost. Open the app with http://localhost:5173, or run the frontend with HTTPS for LAN/IP testing.`;
  }

  if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
    return `${callType} permission was blocked. Allow permission in the browser and try again.`;
  }

  if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
    return `No ${callType} device was found. Connect a device and try again.`;
  }

  if (error?.name === "NotSupportedError") {
    return `${callType} access is not available in this browser context. Use Chrome/Edge on http://localhost:5173 or enable HTTPS for IP/LAN access.`;
  }

  return error?.message || `Unable to start ${callType}`;
};

const formatDuration = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

const getInviteLink = (roomId) => {
  return `http://localhost:5173/room/${roomId}`;
};

const assetUrl = (value) => {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  return `${API_ORIGIN}${value}`;
};

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const localStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const currentStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const callsRef = useRef(new Map());
  const activeCallsRef = useRef([]);
  const membersRef = useRef(new Map());
  const meetingRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [room, setRoom] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [duration, setDuration] = useState(0);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState(new Set());
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [localPeerId, setLocalPeerId] = useState("");

  const isAudioRoom = room?.roomType === "audio";
  const hostId = room?.createdBy?._id || room?.createdBy;
  const isHost = Boolean(user?.id && hostId && user.id === String(hostId));
  const participants = useMemo(() => remoteParticipants.length + 1, [remoteParticipants.length]);
  const inviteLink = getInviteLink(roomId);

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      setError("");
      console.log("Opening room:", roomId);

      const { data: roomData } = await api.get(`/rooms/${roomId}`);
      console.log("Room details response:", roomData);

      const rawRoom = roomData.room || roomData;
      const currentRoom = {
        ...rawRoom,
        roomType: normalizeRoomType(rawRoom?.roomType)
      };

      if (!currentRoom?.roomId) {
        throw new Error("Room details not received");
      }

      if (!mounted) return;
      setRoom(currentRoom);

      if (currentRoom.status === "ended") {
        throw new Error("This meeting has ended");
      }

      const mediaConstraints = getMediaConstraints(currentRoom.roomType);
      console.log("Starting media with constraints:", mediaConstraints);

      let stream;
      if (!navigator.mediaDevices?.getUserMedia) {
        const message = getMediaErrorMessage({ name: "NotSupportedError" }, currentRoom.roomType);
        console.log("Media unavailable:", message);
        setError(message);
        stream = new MediaStream();
        setMuted(true);
        setCameraOff(true);
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        } catch (mediaError) {
          const message = getMediaErrorMessage(mediaError, currentRoom.roomType);
          console.log("Media permission error:", mediaError);
          setError(message);
          stream = new MediaStream();
          setMuted(true);
          setCameraOff(true);
        }
      }

      if (!mounted) return;

      setLocalStream(stream);
      localStreamRef.current = stream;
      cameraStreamRef.current = stream;
      currentStreamRef.current = stream;

      const peer = new Peer(undefined, peerConfig);
      const socket = createSocket();
      peerRef.current = peer;
      socketRef.current = socket;

      const { data } = await api.post("/meetings/start", { roomId });
      meetingRef.current = data.meeting._id;

      socket.on("connect", () => {
        socket.emit("join-room", { roomId, peerId: peerRef.current?.id || null, user });
      });
      if (socket.connected) {
        socket.emit("join-room", { roomId, peerId: peerRef.current?.id || null, user });
      }
      socket.on("disconnect", () => setError("Realtime connection disconnected"));

      peer.on("open", (peerId) => {
        setLocalPeerId(peerId);
        socket.emit("join-room", { roomId, peerId, user });
      });
      peer.on("call", (call) => {
        call.answer(currentStreamRef.current || localStreamRef.current || new MediaStream());
        registerCall(call);
      });

      socket.on("room-users", (members) => {
        members.filter((member) => member.peerId).forEach((member) => upsertParticipant(member));
        members.filter((member) => member.peerId).forEach((member) => callUser(member.peerId, member));
      });
      socket.on("user-joined", (member) => {
        if (!member?.peerId) return;
        upsertParticipant(member);
        callUser(member.peerId, member);
      });
      socket.on("user-left", ({ peerId }) => removeRemote(peerId));
      socket.on("receive-message", (payload) => setMessages((items) => [...items, { ...payload, originalMessage: payload.message }]));
      socket.on("receive-reaction", (payload) => {
        setFloatingReactions((items) => [...items, payload]);
        window.setTimeout(() => {
          setFloatingReactions((items) => items.filter((item) => item.id !== payload.id));
        }, 2500);
      });
      socket.on("active-speaker", ({ peerId, speaking }) => {
        setActiveSpeakers((current) => {
          const next = new Set(current);
          if (speaking) next.add(peerId);
          else next.delete(peerId);
          return next;
        });
      });
      socket.on("force-muted", () => forceMute());
      socket.on("force-removed", ({ message: adminMessage }) => {
        setError(adminMessage || "You were removed from the meeting");
        leave(false).finally(() => navigate("/dashboard"));
      });
      socket.on("meeting-ended", ({ message: adminMessage }) => {
        setError(adminMessage || "Meeting ended");
        leave(false).finally(() => navigate("/dashboard"));
      });
      socket.on("participant-muted", ({ peerId }) => {
        setRemoteParticipants((items) => items.map((item) => (item.peerId === peerId ? { ...item, forcedMuted: true } : item)));
      });
      socket.on("admin-error", ({ message: adminMessage }) => setError(adminMessage || "Admin action failed"));
    };

    start().catch((err) => {
      console.log("Room startup error:", err);
      setError(err.message || "Unable to join room");
    });

    return () => {
      mounted = false;
      leave(false);
    };
  }, [roomId]);

  useEffect(() => {
    const timer = window.setInterval(() => setDuration((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!localStreamRef.current || !socketRef.current || !localPeerId) return undefined;
    return watchSpeaker(localStreamRef.current, (speaking) => {
      setActiveSpeakers((current) => {
        const next = new Set(current);
        if (speaking) next.add("local");
        else next.delete("local");
        return next;
      });
      socketRef.current?.emit("active-speaker", { roomId, peerId: localPeerId, speaking });
    });
  }, [localStream, localPeerId, roomId]);

  useEffect(() => {
    const cleanups = remoteParticipants
      .filter((participant) => participant.stream)
      .map((participant) =>
        watchSpeaker(participant.stream, (speaking) => {
          setActiveSpeakers((current) => {
            const next = new Set(current);
            if (speaking) next.add(participant.peerId);
            else next.delete(participant.peerId);
            return next;
          });
        })
      );

    return () => cleanups.forEach((cleanup) => cleanup?.());
  }, [remoteParticipants]);

  const upsertParticipant = (member) => {
    membersRef.current.set(member.peerId, member);
    setRemoteParticipants((items) => {
      const existing = items.find((item) => item.peerId === member.peerId);
      if (existing) {
        return items.map((item) => (item.peerId === member.peerId ? { ...item, ...member, stream: item.stream } : item));
      }

      return [...items, { ...member, stream: null }];
    });
  };

  const registerCall = (call, member) => {
    callsRef.current.set(call.peer, call);
    if (!activeCallsRef.current.includes(call)) {
      activeCallsRef.current.push(call);
    }
    call.on("stream", (stream) => {
      const participant = member || membersRef.current.get(call.peer) || { peerId: call.peer, user: { name: "Participant" } };
      membersRef.current.set(call.peer, participant);
      setRemoteParticipants((items) => {
        const existing = items.find((item) => item.peerId === call.peer);
        if (existing) {
          return items.map((item) => (item.peerId === call.peer ? { ...item, ...participant, stream } : item));
        }

        return [...items, { ...participant, peerId: call.peer, stream }];
      });
    });
    call.on("close", () => removeRemote(call.peer));
    call.on("error", () => {
      activeCallsRef.current = activeCallsRef.current.filter((activeCall) => activeCall !== call);
    });
  };

  const callUser = (peerId, member) => {
    if (!peerId || peerId === peerRef.current?.id || !peerRef.current || callsRef.current.has(peerId)) return;
    const call = peerRef.current.call(peerId, currentStreamRef.current || localStreamRef.current || new MediaStream());
    registerCall(call, member);
  };

  const removeRemote = (peerId) => {
    const call = callsRef.current.get(peerId);
    call?.close();
    callsRef.current.delete(peerId);
    if (call) {
      activeCallsRef.current = activeCallsRef.current.filter((activeCall) => activeCall !== call);
    }
    membersRef.current.delete(peerId);
    setRemoteParticipants((items) => items.filter((item) => item.peerId !== peerId));
  };

  const replaceVideoTrackForActiveCalls = (track) => {
    activeCallsRef.current = activeCallsRef.current.filter((call) => call?.open !== false);
    activeCallsRef.current.forEach((call) => {
      const sender = call.peerConnection
        ?.getSenders()
        .find((item) => item.track && item.track.kind === "video");

      if (sender) {
        sender.replaceTrack(track).catch((err) => {
          console.log("Video track replacement failed:", err);
        });
      }
    });
  };

  const forceMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    setMuted(true);
  };

  const toggleMute = () => {
    const enabled = muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
    setMuted(!muted);
  };

  const toggleCamera = () => {
    if (isAudioRoom) return;
    const enabled = cameraOff;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
    setCameraOff(!cameraOff);
  };

  const shareScreen = async () => {
    if (isAudioRoom) return;
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error("Screen sharing requires HTTPS or localhost. Open the app with http://localhost:5173 or enable HTTPS for LAN/IP testing.");
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) {
        throw new Error("No screen video track selected");
      }

      screenStreamRef.current = screenStream;
      replaceVideoTrackForActiveCalls(screenTrack);

      const audioTracks = cameraStreamRef.current?.getAudioTracks() || currentStreamRef.current?.getAudioTracks() || [];
      currentStreamRef.current = new MediaStream([...audioTracks, screenTrack]);
      localStreamRef.current = currentStreamRef.current;
      setLocalStream(screenStream);
      setSharing(true);

      screenTrack.onended = () => {
        if (normalizeRoomType(room?.roomType) !== "video") return;
        const cameraTrack = cameraStreamRef.current?.getVideoTracks()[0];
        if (cameraTrack) {
          replaceVideoTrackForActiveCalls(cameraTrack);
          currentStreamRef.current = cameraStreamRef.current;
          localStreamRef.current = cameraStreamRef.current;
          setLocalStream(cameraStreamRef.current);
          setSharing(false);
          screenStreamRef.current?.getTracks().forEach((track) => track.stop());
          screenStreamRef.current = null;
          return;
        }

        console.log("Unable to restore camera track after screen share ended");
        setSharing(false);
        screenStreamRef.current?.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      };
    } catch (err) {
      console.log("Screen share error:", err);
      alert("Screen sharing was blocked or could not be started.");
      setError(err.message || "Unable to share screen");
    }
  };

  const copyInviteLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied("Invite link copied");
    window.setTimeout(() => setCopied(""), 2000);
  };

  const copyRoomId = async () => {
    await navigator.clipboard.writeText(roomId);
    setCopied("Room ID copied");
    window.setTimeout(() => setCopied(""), 2000);
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`Join my meeting: ${inviteLink}`)}`, "_blank", "noopener,noreferrer");
  };

  const startRecording = () => {
    try {
      if (recording) return;
      if (!window.MediaRecorder) {
        setError("Recording is not supported in this browser");
        return;
      }

      const tracks = [
        ...(currentStreamRef.current?.getTracks() || []),
        ...remoteParticipants.flatMap((participant) => participant.stream?.getTracks() || [])
      ];
      if (!tracks.length) {
        setError("No media stream available to record");
        return;
      }

      const stream = new MediaStream(tracks);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = downloadRecording;
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      setError(err.message || "Recording is not supported in this browser");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const downloadRecording = () => {
    if (!recordedChunksRef.current.length) return;
    const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meeting-${roomId}-${Date.now()}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    recordedChunksRef.current = [];
  };

  const muteParticipant = (targetPeerId) => {
    socketRef.current?.emit("mute-participant", { roomId, targetPeerId });
  };

  const removeParticipant = (targetPeerId) => {
    socketRef.current?.emit("remove-participant", { roomId, targetPeerId });
  };

  const endMeeting = () => {
    socketRef.current?.emit("end-meeting", { roomId });
  };

  const sendMessage = (event) => {
    event.preventDefault();
    if (!message.trim()) return;
    if (!socketRef.current?.connected) {
      setError("Chat is still connecting. Try again in a moment.");
      return;
    }
    socketRef.current.emit("send-message", { roomId, message: message.trim() });
    setMessage("");
  };

  const translateMessage = async (id, text, target) => {
    try {
      const { data } = await api.post("/translate", { text, target });
      setMessages((items) => items.map((item) => (item.id === id ? { ...item, translatedText: data.translatedText, translatedTarget: target } : item)));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to translate message");
    }
  };

  const sendReaction = (emoji) => {
    if (!socketRef.current?.connected) {
      setError("Reactions are still connecting. Try again in a moment.");
      return;
    }
    const normalizedEmoji = emoji === "\u270B" || String(emoji).includes("\u0153") ? "\u270B" : "\u2764\uFE0F";
    let storedUser = {};
    try {
      storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      storedUser = {};
    }
    const sender = localStorage.getItem("name") || storedUser.name || user?.name || "Guest";
    socketRef.current.emit("send-reaction", { roomId, emoji: normalizedEmoji, sender });
  };

  const leave = async (redirect = true) => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
    socketRef.current?.emit("leave-room");
    socketRef.current?.off();
    socketRef.current?.disconnect();
    peerRef.current?.destroy();
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    currentStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    for (const call of callsRef.current.values()) call.close();
    callsRef.current.clear();
    activeCallsRef.current = [];
    if (meetingRef.current) {
      await api.patch(`/meetings/${meetingRef.current}/end`).catch(() => {});
      meetingRef.current = null;
    }
    if (redirect) navigate("/dashboard");
  };

  if (!room) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080d1a] px-4 text-white">
        <div className="max-w-md rounded-lg border border-white/10 bg-white/[0.07] px-6 py-5 text-center text-sm text-slate-300 shadow-2xl shadow-black/30">
          <p>{error || "Preparing meeting..."}</p>
          {error && (
            <button onClick={() => navigate("/dashboard")} className="mt-4 rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300">
              Back to dashboard
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080d1a] text-white">
      <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        {floatingReactions.map((reaction, index) => (
          <div key={reaction.id} className="absolute bottom-24 text-5xl animate-bounce" style={{ left: `${20 + ((index * 17) % 60)}%` }}>
            {reaction.emoji}
          </div>
        ))}
      </div>
      <div className={`grid min-h-screen ${chatOpen ? "lg:grid-cols-[1fr_360px]" : "lg:grid-cols-1"}`}>
        <section className="flex min-h-screen flex-col px-3 py-3 sm:px-5 sm:py-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-semibold sm:text-lg">{room.title || `Room ${roomId}`}</h1>
                {isHost && <span className="inline-flex items-center gap-1 rounded-full bg-cyan-400/15 px-2 py-1 text-xs font-medium text-cyan-200"><Shield className="h-3 w-3" /> Host</span>}
                {recording && <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-1 text-xs font-medium text-red-200"><Radio className="h-3 w-3" /> Recording</span>}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {isAudioRoom ? "Audio call" : "Video call"} - {participants} participant{participants === 1 ? "" : "s"} - {formatDuration(duration)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={copyRoomId} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200 shadow-lg shadow-black/20 transition hover:bg-white/15">
                <Copy className="h-4 w-4" /> {roomId}
              </button>
              <button onClick={copyInviteLink} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200 shadow-lg shadow-black/20 transition hover:bg-white/15">
                <LinkIcon className="h-4 w-4" /> Copy Invite Link
              </button>
              <button onClick={shareWhatsApp} className="inline-flex items-center rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-400/15">
                WhatsApp
              </button>
            </div>
          </header>

          {(copied || error) && (
            <div className={`mt-3 rounded-lg border px-4 py-2 text-sm ${error ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"}`}>
              {error || copied}
            </div>
          )}

          <div className="flex flex-1 items-center py-5">
            {isAudioRoom ? (
              <AudioStage user={user} muted={muted} duration={duration} remoteParticipants={remoteParticipants} activeSpeakers={activeSpeakers} isHost={isHost} onMuteParticipant={muteParticipant} onRemoveParticipant={removeParticipant} />
            ) : (
              <div className="grid w-full auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                <VideoTile stream={localStream} label={`${user?.name || "You"} (you)`} muted cameraOff={cameraOff && !sharing} isHost={isHost} avatar={user?.avatar} speaking={activeSpeakers.has("local")} />
                {remoteParticipants.map((participant) => (
                  <VideoTile
                    key={participant.peerId}
                    stream={participant.stream}
                    label={participant.user?.name || "Participant"}
                    avatar={participant.user?.avatar}
                    isHost={participant.isHost}
                    forcedMuted={participant.forcedMuted}
                    speaking={activeSpeakers.has(participant.peerId)}
                    adminControls={isHost && !participant.isHost}
                    onMute={() => muteParticipant(participant.peerId)}
                    onRemove={() => removeParticipant(participant.peerId)}
                  />
                ))}
              </div>
            )}
          </div>

          <ControlBar
            muted={muted}
            cameraOff={cameraOff}
            sharing={sharing}
            chatOpen={chatOpen}
            isAudioRoom={isAudioRoom}
            isHost={isHost}
            recording={recording}
            onMute={toggleMute}
            onCamera={toggleCamera}
            onShare={shareScreen}
            onChat={() => setChatOpen((value) => !value)}
            onRecord={recording ? stopRecording : startRecording}
            onReaction={sendReaction}
            onEndMeeting={endMeeting}
            onLeave={() => leave(true)}
          />
        </section>

        {chatOpen && (
          <aside className="flex max-h-screen min-h-[420px] flex-col border-t border-white/10 bg-[#0f172a] shadow-2xl shadow-black/30 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="font-semibold">Chat</h2>
                <p className="mt-1 text-xs text-slate-500">Messages in this room</p>
              </div>
              <button onClick={() => setChatOpen(false)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 transition hover:bg-white/10">Close</button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && <p className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-5 text-sm text-slate-500">No messages yet.</p>}
              {messages.map((item) => (
                <div key={item.id} className="rounded-lg bg-white/[0.07] px-3 py-2 shadow-lg shadow-black/10">
                  <p className="text-xs font-medium text-cyan-300">{item.user?.name || "Guest"}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-100">{item.message}</p>
                  {item.translatedText && <p className="mt-2 rounded-md bg-cyan-400/10 px-2 py-1 text-sm leading-6 text-cyan-100">{item.translatedText}</p>}
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => translateMessage(item.id, item.originalMessage || item.message, "hi")} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/15">
                      <Languages className="h-3 w-3" /> Hindi
                    </button>
                    <button onClick={() => translateMessage(item.id, item.originalMessage || item.message, "en")} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/15">
                      <Languages className="h-3 w-3" /> English
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={sendMessage} className="flex gap-2 border-t border-white/10 p-3">
              <input className="min-w-0 flex-1 rounded-full border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Send a message" />
              <button className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-400 text-slate-950 transition hover:bg-cyan-300">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </aside>
        )}
      </div>
    </main>
  );
}

function ControlBar({ muted, cameraOff, sharing, chatOpen, isAudioRoom, isHost, recording, onMute, onCamera, onShare, onChat, onRecord, onReaction, onEndMeeting, onLeave }) {
  return (
    <div className="mx-auto flex max-w-full flex-wrap items-center justify-center gap-3 rounded-full border border-white/10 bg-slate-950/80 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur">
      <CircleButton label={muted ? "Unmute" : "Mute"} active={muted} onClick={onMute}>
        {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </CircleButton>
      {!isAudioRoom && (
        <>
          <CircleButton label={cameraOff ? "Camera on" : "Camera off"} active={cameraOff} onClick={onCamera}>
            {cameraOff ? <CameraOff className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
          </CircleButton>
          <CircleButton label={sharing ? "Sharing" : "Share"} active={sharing} disabled={sharing} onClick={onShare}>
            <MonitorUp className="h-5 w-5" />
          </CircleButton>
        </>
      )}
      <CircleButton label={recording ? "Stop recording" : "Start recording"} active={recording} onClick={onRecord}>
        {recording ? <Square className="h-5 w-5" /> : <Radio className="h-5 w-5" />}
      </CircleButton>
      <CircleButton label="Chat" active={chatOpen} onClick={onChat}>
        <MessageSquare className="h-5 w-5" />
      </CircleButton>
      <button onClick={() => onReaction("❤️")} title="Heart reaction" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-xl shadow-lg shadow-black/20 transition hover:bg-white/15">❤️</button>
      <button onClick={() => onReaction("✋")} title="Raise hand" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-xl shadow-lg shadow-black/20 transition hover:bg-white/15">✋</button>
      {isHost && (
        <button onClick={onEndMeeting} title="End meeting for everyone" className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/20 bg-amber-400/15 text-amber-100 shadow-lg shadow-black/20 transition hover:bg-amber-400/25">
          <PhoneOff className="h-5 w-5" />
        </button>
      )}
      <button onClick={onLeave} title="Leave" className="flex h-12 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500">
        <LogOut className="h-5 w-5" />
      </button>
    </div>
  );
}

function CircleButton({ children, label, active, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex h-12 w-12 items-center justify-center rounded-full border text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${active ? "border-cyan-300 bg-cyan-400/20 text-cyan-200" : "border-white/10 bg-white/10 hover:bg-white/15"}`}
    >
      {children}
    </button>
  );
}

function VideoTile({ stream, label, muted, cameraOff, avatar, isHost, forcedMuted, speaking, adminControls, onMute, onRemove }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className={`relative min-h-[220px] overflow-hidden rounded-lg border bg-slate-950 shadow-2xl shadow-black/30 transition ${speaking ? "border-cyan-300 shadow-cyan-500/30" : "border-white/10"}`}>
      {stream && !cameraOff ? (
        <video ref={ref} autoPlay playsInline muted={muted} className="h-full min-h-[220px] w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Avatar name={label} avatar={avatar} size="large" />
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">{label}</span>
        {isHost && <span className="rounded-full bg-cyan-400/90 px-2 py-1 text-xs font-semibold text-slate-950">Host</span>}
        {forcedMuted && <span className="rounded-full bg-red-500/90 px-2 py-1 text-xs font-semibold text-white">Muted</span>}
        {speaking && <span className="rounded-full bg-emerald-400/90 px-2 py-1 text-xs font-semibold text-slate-950">Speaking</span>}
      </div>
      {adminControls && (
        <div className="absolute right-3 top-3 flex gap-2">
          <button onClick={onMute} title="Mute participant" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80">
            <MicOff className="h-4 w-4" />
          </button>
          <button onClick={onRemove} title="Remove participant" className="flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-500">
            <UserMinus className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function AudioStage({ user, muted, duration, remoteParticipants, activeSpeakers, isHost, onMuteParticipant, onRemoveParticipant }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] px-5 py-10 text-center shadow-2xl shadow-black/30">
      <div className={activeSpeakers.has("local") ? "rounded-full ring-4 ring-cyan-300 ring-offset-4 ring-offset-[#111827]" : ""}>
        <Avatar name={user?.name || "You"} avatar={user?.avatar} size="hero" />
      </div>
      <h2 className="mt-6 text-2xl font-semibold">{user?.name || "You"}</h2>
      <p className="mt-2 text-sm text-slate-400">{muted ? "Muted" : "Audio connected"} - {formatDuration(duration)}</p>
      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {remoteParticipants.map((participant) => (
          <RemoteAudio
            key={participant.peerId}
            stream={participant.stream}
            participant={participant}
            speaking={activeSpeakers.has(participant.peerId)}
            adminControls={isHost && !participant.isHost}
            onMute={() => onMuteParticipant(participant.peerId)}
            onRemove={() => onRemoveParticipant(participant.peerId)}
          />
        ))}
      </div>
    </div>
  );
}

function RemoteAudio({ stream, participant, speaking, adminControls, onMute, onRemove }) {
  const ref = useRef(null);
  const name = participant.user?.name || "Participant";

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className={`relative rounded-lg border bg-slate-950/70 p-4 text-center shadow-lg shadow-black/20 ${speaking ? "border-cyan-300 shadow-cyan-500/20" : "border-white/10"}`}>
      <audio ref={ref} autoPlay playsInline />
      <Avatar name={name} avatar={participant.user?.avatar} />
      <p className="mt-3 truncate text-sm font-medium text-slate-100">{name}</p>
      {participant.isHost && <p className="mt-1 text-xs font-medium text-cyan-300">Host</p>}
      {participant.forcedMuted && <p className="mt-1 text-xs font-medium text-red-300">Muted by host</p>}
      {speaking && <p className="mt-1 text-xs font-medium text-emerald-300">Speaking</p>}
      {adminControls && (
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={onMute} className="rounded-full bg-white/10 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/15">Mute</button>
          <button onClick={onRemove} className="rounded-full bg-red-600 px-3 py-2 text-xs text-white transition hover:bg-red-500">Remove</button>
        </div>
      )}
    </div>
  );
}

function watchSpeaker(stream, onChange) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass || !stream?.getAudioTracks().length) return undefined;

  const audioContext = new AudioContextClass();
  const analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(stream);
  const data = new Uint8Array(analyser.fftSize);
  let lastSpeaking = false;
  let frameId;

  source.connect(analyser);

  const tick = () => {
    analyser.getByteTimeDomainData(data);
    const volume = data.reduce((sum, value) => sum + Math.abs(value - 128), 0) / data.length;
    const speaking = volume > 8;
    if (speaking !== lastSpeaking) {
      lastSpeaking = speaking;
      onChange(speaking);
    }
    frameId = requestAnimationFrame(tick);
  };

  tick();

  return () => {
    cancelAnimationFrame(frameId);
    source.disconnect();
    audioContext.close();
  };
}

function Avatar({ name, avatar, size = "normal" }) {
  const initials = name
    .replace("(you)", "")
    .trim()
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const sizeClass = size === "hero" ? "h-32 w-32 text-3xl" : size === "large" ? "h-24 w-24 text-2xl" : "h-16 w-16 text-lg";

  if (avatar) {
    return <img src={assetUrl(avatar)} alt={name} className={`mx-auto ${sizeClass} rounded-full object-cover shadow-xl shadow-black/30`} />;
  }

  return (
    <div className={`mx-auto flex ${sizeClass} items-center justify-center rounded-full bg-cyan-400 text-slate-950 shadow-xl shadow-cyan-950/30`}>
      {initials || <UserRound className="h-8 w-8" />}
    </div>
  );
}
