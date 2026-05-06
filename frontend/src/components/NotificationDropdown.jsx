import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import api from "../utils/api.js";

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const unread = notifications.filter((item) => !item.read).length;

  const loadNotifications = () => {
    api.get("/notifications")
      .then(({ data }) => setNotifications(data.notifications))
      .catch(() => setNotifications([]));
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`).catch(() => {});
    setNotifications((items) => items.map((item) => (item._id === id ? { ...item, read: true } : item)));
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((value) => !value)} className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-slate-200 transition hover:bg-white/10">
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-3 w-80 overflow-hidden rounded-lg border border-white/10 bg-[#111827] shadow-2xl shadow-black/40">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="font-semibold text-white">Notifications</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && <p className="px-4 py-5 text-sm text-slate-500">No notifications yet.</p>}
            {notifications.map((item) => (
              <button key={item._id} onClick={() => markRead(item._id)} className="block w-full border-b border-white/10 px-4 py-3 text-left last:border-b-0 hover:bg-white/[0.05]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-100">{item.title}</p>
                  {!item.read && <span className="mt-1 h-2 w-2 rounded-full bg-cyan-300" />}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">{item.message}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
