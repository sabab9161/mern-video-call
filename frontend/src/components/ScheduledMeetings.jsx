import { CalendarClock, LogIn, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api.js";

export default function ScheduledMeetings({ meetings, onDeleted }) {
  const navigate = useNavigate();

  const deleteMeeting = async (id) => {
    await api.delete(`/meetings/${id}`);
    onDeleted?.(id);
  };

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.07] p-5 shadow-xl shadow-black/20">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-cyan-300" />
        <h2 className="font-semibold text-white">Scheduled meetings</h2>
      </div>
      <div className="mt-4 space-y-3">
        {meetings.length === 0 && <p className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-4 text-sm text-slate-500">No scheduled meetings.</p>}
        {meetings.map((meeting) => {
          const scheduledAt = meeting.scheduledAt || meeting.scheduledFor;
          const inviteLink = meeting.joinLink || `${window.location.origin}/room/${meeting.roomId}`;

          return (
            <div key={meeting._id} className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">{meeting.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{meeting.roomType === "audio" ? "Audio" : "Video"} - {scheduledAt ? new Date(scheduledAt).toLocaleString() : `${meeting.scheduledDate} ${meeting.scheduledTime}`}</p>
                  <p className="mt-2 break-all font-mono text-xs text-cyan-200">{meeting.roomId}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{inviteLink}</p>
                </div>
                <button onClick={() => deleteMeeting(meeting._id)} className="rounded-full p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-300" type="button">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <button onClick={() => navigate(`/room/${meeting.roomId}`)} className="mt-3 inline-flex items-center gap-2 rounded-full bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300" type="button">
                <LogIn className="h-3.5 w-3.5" /> Join
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
