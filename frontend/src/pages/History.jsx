import { CalendarClock, Clock3, Headphones, Video } from "lucide-react";
import { useEffect, useState } from "react";
import api from "../utils/api.js";

export default function History() {
  const [history, setHistory] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/meetings/history"),
      api.get("/meetings/my-scheduled")
    ])
      .then(([historyResponse, scheduledResponse]) => {
        setHistory(historyResponse.data.meetings);
        setScheduled(scheduledResponse.data.meetings);
      })
      .catch(() => {
        setHistory([]);
        setScheduled([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#0b1020] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-cyan-300">Meeting records</p>
            <h1 className="mt-2 text-3xl font-semibold">History</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Review previous meetings, room IDs, and call durations.</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.07] shadow-xl shadow-black/20">
            <CalendarClock className="h-6 w-6 text-cyan-300" />
          </div>
        </div>

        <section className="mt-8 overflow-hidden rounded-lg border border-white/10 bg-white/[0.07] shadow-2xl shadow-black/20">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="font-semibold text-white">Scheduled meetings</h2>
          </div>
          {loading && <p className="px-5 py-8 text-sm text-slate-400">Loading scheduled meetings...</p>}
          {!loading && scheduled.length === 0 && <p className="px-5 py-8 text-sm text-slate-400">No scheduled meetings.</p>}
          {!loading && scheduled.map((item) => (
            <div key={item._id} className="grid gap-3 border-b border-white/10 px-5 py-4 last:border-b-0 sm:grid-cols-[1fr_160px_120px]">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-950 ${item.roomType === "audio" ? "bg-emerald-400" : "bg-cyan-400"}`}>
                  {item.roomType === "audio" ? <Headphones className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">Scheduled {item.roomType === "audio" ? "Audio" : "Video"} Meeting</p>
                </div>
              </div>
              <p className="text-sm text-slate-300 sm:self-center">Room {item.roomId}</p>
              <p className="text-sm text-slate-300 sm:self-center">{new Date(item.scheduledAt || item.scheduledFor).toLocaleString()}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 overflow-hidden rounded-lg border border-white/10 bg-white/[0.07] shadow-2xl shadow-black/20">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="font-semibold text-white">Completed meetings</h2>
          </div>
          <div className="grid grid-cols-[1fr_140px_120px] gap-3 border-b border-white/10 px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500 max-sm:hidden">
            <span>Meeting</span>
            <span>Room</span>
            <span>Duration</span>
          </div>
          {loading && <p className="px-5 py-8 text-sm text-slate-400">Loading history...</p>}
          {!loading && history.length === 0 && <p className="px-5 py-8 text-sm text-slate-400">No meetings yet.</p>}
          {!loading && history.map((item) => {
            const roomType = item.roomType === "audio" ? "audio" : "video";
            const label = roomType === "audio" ? "Audio Meeting" : "Video Meeting";

            return (
              <div key={item._id} className="grid gap-3 border-b border-white/10 px-5 py-4 last:border-b-0 sm:grid-cols-[1fr_140px_120px]">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-950 ${roomType === "audio" ? "bg-emerald-400" : "bg-cyan-400"}`}>
                    {roomType === "audio" ? <Headphones className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{label}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-300 sm:self-center">Room {item.roomId}</p>
                <p className="flex items-center gap-2 text-sm text-slate-300 sm:self-center">
                  <Clock3 className="h-4 w-4 text-slate-500" />
                  {Math.round((item.durationSeconds || 0) / 60)} min
                </p>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
