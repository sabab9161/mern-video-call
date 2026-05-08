import { Save, Upload, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../utils/api.js";
const API_ORIGIN =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const assetUrl = (value) => {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  return `${API_ORIGIN}${value}`;
};

export default function Profile() {
  const { updateStoredUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const previewUrl = useMemo(() => previewObjectUrl || assetUrl(avatar), [previewObjectUrl, avatar]);

  useEffect(() => {
    api.get("/users/profile")
      .then(({ data }) => {
        setName(data.user.name || "");
        setEmail(data.user.email || "");
        setAvatar(data.user.avatar || "");
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("name", data.user.name || "");
        localStorage.setItem("email", data.user.email || "");
        updateStoredUser(data.user);
      })
      .catch((err) => setError(err.response?.data?.message || "Unable to load profile"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewObjectUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewObjectUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const submit = async (event) => {
    event.preventDefault();
    setSuccess("");
    setError("");

    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }

    const formData = new FormData();
    formData.append("name", cleanName);
    if (selectedFile) {
      formData.append("avatar", selectedFile);
    }

    setSaving(true);
    try {
      const response = await api.put("/users/profile", formData);

      const updatedUser = response.data.user;
      localStorage.setItem("name", updatedUser.name);
      localStorage.setItem("email", updatedUser.email || "");
      localStorage.setItem("avatar", updatedUser.avatar || "");
      updateStoredUser(updatedUser);

      setName(updatedUser.name || "");
      setEmail(updatedUser.email || "");
      setAvatar(updatedUser.avatar || "");
      setSelectedFile(null);
      setSuccess("Profile updated");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b1020] px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl rounded-lg border border-white/10 bg-white/[0.07] p-6 shadow-2xl shadow-black/30">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-2 text-sm text-slate-400">Update the name and avatar shown in meetings, chat, and audio calls.</p>

        {loading ? (
          <p className="mt-8 text-sm text-slate-400">Loading profile...</p>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-5">
            <div className="flex items-center gap-4">
              {previewUrl ? (
                <img src={previewUrl} alt={name} className="h-24 w-24 rounded-full object-cover ring-2 ring-cyan-300/40" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-cyan-400 text-slate-950">
                  <UserRound className="h-10 w-10" />
                </div>
              )}
              <div>
                <p className="font-medium">{name || "Your profile"}</p>
                <p className="text-sm text-slate-500">Visible to participants</p>
              </div>
            </div>

            <label className="block">
              <span className="text-sm text-slate-300">Name</span>
              <input
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-300"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            </label>

            <label className="block">
              <span className="text-sm text-slate-300">Email</span>
              <input
                className="mt-2 w-full cursor-not-allowed rounded-lg border border-white/10 bg-slate-900/80 px-4 py-3 text-slate-300 outline-none"
                type="email"
                value={email}
                readOnly
                aria-readonly="true"
              />
            </label>

            <label className="block">
              <span className="text-sm text-slate-300">Profile photo</span>
              <div className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-white/15 bg-slate-950/70 px-4 py-4 text-sm text-slate-400 transition hover:border-cyan-300/60">
                <span>{selectedFile ? selectedFile.name : "Choose an image file"}</span>
                <Upload className="h-4 w-4 text-cyan-300" />
                <input
                  className="hidden"
                  type="file"
                  accept="image/*"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                />
              </div>
            </label>

            {success && <p className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">{success}</p>}
            {error && <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">{error}</p>}
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300">
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save profile"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
