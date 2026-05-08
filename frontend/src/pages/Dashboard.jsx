import {
  CalendarClock,
  Clock3,
  Copy,
  Headphones,
  Link as LinkIcon,
  LogIn,
  Mic,
  UserRound,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import NotificationDropdown from "../components/NotificationDropdown.jsx";
import ScheduledMeetings from "../components/ScheduledMeetings.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../utils/api.js";

const API_ORIGIN =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const assetUrl = (value) => {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  return `${API_ORIGIN}${value}`;
};

const copyToClipboard = async (text) => {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("Copy failed");
  }
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [roomId, setRoomId] = useState("");
  const [createdRoomId, setCreatedRoomId] = useState("");
  const [createdRoomType, setCreatedRoomType] = useState("");
  const [history, setHistory] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [scheduledResult, setScheduledResult] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [scheduleForm, setScheduleForm] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    roomType: "video",
    invitedEmail: "",
  });

  const loadDashboard = () => {
    api
      .get("/meetings/history")
      .then(({ data }) => setHistory(data.meetings || []))
      .catch(() => setHistory([]));

    api
      .get("/meetings/my-scheduled")
      .then(({ data }) => setScheduled(data.meetings || []))
      .catch(() => setScheduled([]));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const createRoom = async (roomType) => {
    setError("");
    setSuccess("");
    setCreatedRoomId("");
    setCreatedRoomType("");
    setScheduledResult(null);

    try {
      const res = await api.post("/rooms/create", {
        roomType,
        title: title.trim(),
      });

      const newRoomId = res.data?.roomId || res.data?.room?.roomId;

      if (!newRoomId) {
        setError("Room ID not received");
        return;
      }

      setCreatedRoomId(newRoomId);
      setCreatedRoomType(roomType);
      setSuccess(
        `${roomType === "audio" ? "Audio" : "Video"} meeting created successfully`
      );
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create room");
    }
  };

  const copyText = async (text, label) => {
    try {
      await copyToClipboard(text);
      setSuccess(`${label} copied`);
    } catch {
      setError(`Unable to copy ${label}`);
    }
  };

  const joinRoom = async (event) => {
    event.preventDefault();
    setError("");

    if (!roomId.trim()) {
      setError("Please enter room ID");
      return;
    }

    try {
      await api.post(`/rooms/${roomId}/join`);
      navigate(`/room/${roomId}`);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to join room");
    }
  };

  const scheduleMeeting = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setScheduledResult(null);

    try {
      const { data } = await api.post("/meetings/schedule", {
        ...scheduleForm,
        invitedEmail: scheduleForm.invitedEmail.trim(),
      });

      const meeting = data.meeting;
      const inviteLink =
        data.inviteLink ||
        meeting.joinLink ||
        `${window.location.origin}/room/${meeting.roomId}`;

      setScheduledResult({ meeting, inviteLink });
      setSuccess(data.message || "Meeting scheduled successfully");

      setScheduleForm({
        title: "",
        description: "",
        date: "",
        time: "",
        roomType: "video",
        invitedEmail: "",
      });

      loadDashboard();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to schedule meeting");
    }
  };

  return (
    <main className="min-h-screen bg-[#0b1020] px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-cyan-300">
              MeetMERN dashboard
            </p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
              Start, schedule, or review meetings
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-400">
              Create video and audio rooms, schedule meetings, invite teammates,
              and track activity.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <NotificationDropdown />
            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.07] px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              {user?.avatar ? (
                <img
                  src={assetUrl(user.avatar)}
                  alt={user.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <UserRound className="h-5 w-5 text-cyan-300" />
              )}
              <span className="hidden sm:inline">{user?.name}</span>
            </Link>
          </div>
        </section>

        {error && (
          <p className="mt-6 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        {success && (
          <p className="mt-6 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            {success}
          </p>
        )}

        {createdRoomId && (
          <section className="mt-6 rounded-lg border border-cyan-300/30 bg-cyan-400/10 p-5">
            <p className="text-sm font-medium text-cyan-200">
              {createdRoomType === "audio"
                ? "Audio meeting created"
                : "Video meeting created"}
            </p>

            <h2 className="mt-2 text-xl font-semibold">Room ID</h2>

            <p className="mt-3 break-all rounded-lg bg-slate-950/70 px-4 py-3 font-mono text-sm text-cyan-100">
              {createdRoomId}
            </p>

            <p className="mt-2 break-all text-xs text-slate-400">
              {`${window.location.origin}/room/${createdRoomId}`}
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => copyText(createdRoomId, "Room ID")}
                className="rounded-lg bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/15"
              >
                <Copy className="mr-2 inline h-4 w-4" />
                Copy Room ID
              </button>

              <button
                onClick={() =>
                  copyText(
                    `${window.location.origin}/room/${createdRoomId}`,
                    "Invite link"
                  )
                }
                className="rounded-lg bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/15"
              >
                <LinkIcon className="mr-2 inline h-4 w-4" />
                Copy Invite Link
              </button>

              <button
                onClick={() => navigate(`/room/${createdRoomId}`)}
                className="rounded-lg bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
              >
                <LogIn className="mr-2 inline h-4 w-4" />
                Open Meeting
              </button>
            </div>
          </section>
        )}

        <section className="mt-8 grid gap-4 lg:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.07] p-5">
            <Video className="h-8 w-8 text-cyan-300" />
            <h2 className="mt-5 text-lg font-semibold">
              Create Video Meeting
            </h2>
            <input
              className="mt-4 w-full rounded-lg bg-slate-950/70 px-3 py-2 text-sm outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting title"
            />
            <button
              onClick={() => createRoom("video")}
              className="mt-4 w-full rounded-lg bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950"
            >
              Create Video Meeting
            </button>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.07] p-5">
            <Mic className="h-8 w-8 text-emerald-300" />
            <h2 className="mt-5 text-lg font-semibold">
              Create Audio Meeting
            </h2>
            <input
              className="mt-4 w-full rounded-lg bg-slate-950/70 px-3 py-2 text-sm outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting title"
            />
            <button
              onClick={() => createRoom("audio")}
              className="mt-4 w-full rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950"
            >
              <Headphones className="mr-2 inline h-4 w-4" />
              Create Audio Meeting
            </button>
          </div>

          <form
            onSubmit={joinRoom}
            className="rounded-lg border border-white/10 bg-white/[0.07] p-5"
          >
            <LogIn className="h-8 w-8 text-violet-300" />
            <h2 className="mt-5 text-lg font-semibold">Join Meeting</h2>
            <input
              className="mt-4 w-full rounded-lg bg-slate-950/70 px-3 py-2 text-sm outline-none"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.trim())}
              placeholder="Paste room ID"
            />
            <button className="mt-4 w-full rounded-lg bg-white/10 px-4 py-3 text-sm font-semibold">
              Join Room
            </button>
          </form>

          <div className="rounded-lg border border-white/10 bg-white/[0.07] p-5">
            <CalendarClock className="h-8 w-8 text-slate-200" />
            <h2 className="mt-5 text-lg font-semibold">Meeting History</h2>

            <div className="mt-5 space-y-3">
              {history.length === 0 && (
                <p className="text-sm text-slate-500">No meetings yet.</p>
              )}

              {history.slice(0, 4).map((item) => (
                <div
                  key={item._id}
                  className="rounded-lg bg-slate-950/50 px-3 py-3"
                >
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Clock3 className="h-3 w-3" />
                    {item.roomType === "audio"
                      ? "Audio Meeting"
                      : "Video Meeting"}{" "}
                    - {Math.round((item.durationSeconds || 0) / 60)} min
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <form
            onSubmit={scheduleMeeting}
            className="rounded-lg border border-white/10 bg-white/[0.07] p-5"
          >
            <h2 className="text-lg font-semibold">Schedule meeting</h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                className="rounded-lg bg-slate-950/70 px-3 py-2 text-sm outline-none"
                placeholder="Title"
                value={scheduleForm.title}
                onChange={(e) =>
                  setScheduleForm({ ...scheduleForm, title: e.target.value })
                }
                required
              />

              <select
                className="rounded-lg bg-slate-950/70 px-3 py-2 text-sm outline-none"
                value={scheduleForm.roomType}
                onChange={(e) =>
                  setScheduleForm({
                    ...scheduleForm,
                    roomType: e.target.value,
                  })
                }
              >
                <option value="video">Video</option>
                <option value="audio">Audio</option>
              </select>

              <input
                type="date"
                className="rounded-lg bg-slate-950/70 px-3 py-2 text-sm outline-none"
                value={scheduleForm.date}
                onChange={(e) =>
                  setScheduleForm({ ...scheduleForm, date: e.target.value })
                }
                required
              />

              <input
                type="time"
                className="rounded-lg bg-slate-950/70 px-3 py-2 text-sm outline-none"
                value={scheduleForm.time}
                onChange={(e) =>
                  setScheduleForm({ ...scheduleForm, time: e.target.value })
                }
                required
              />

              <input
                type="email"
                className="rounded-lg bg-slate-950/70 px-3 py-2 text-sm outline-none sm:col-span-2"
                placeholder="Invited user email"
                value={scheduleForm.invitedEmail}
                onChange={(e) =>
                  setScheduleForm({
                    ...scheduleForm,
                    invitedEmail: e.target.value,
                  })
                }
                required
              />

              <textarea
                className="min-h-24 rounded-lg bg-slate-950/70 px-3 py-2 text-sm outline-none sm:col-span-2"
                placeholder="Description"
                value={scheduleForm.description}
                onChange={(e) =>
                  setScheduleForm({
                    ...scheduleForm,
                    description: e.target.value,
                  })
                }
              />
            </div>

            <button className="mt-4 rounded-lg bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950">
              Schedule meeting
            </button>
          </form>

          <ScheduledMeetings
            meetings={scheduled}
            onDeleted={(id) =>
              setScheduled((items) => items.filter((item) => item._id !== id))
            }
          />
        </section>
      </div>
    </main>
  );
}