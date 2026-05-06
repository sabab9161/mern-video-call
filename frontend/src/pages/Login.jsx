import { GoogleLogin } from "@react-oauth/google";
import { LockKeyhole, Video } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { isGoogleAuthEnabled } from "../utils/googleAuth.js";

export default function Login() {
  const { login } = useAuth();
  const { googleLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login({
        email: form.email.trim(),
        password: form.password
      });
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async ({ credential }) => {
    if (!credential) {
      setError("Google login did not return a credential");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await googleLogin(credential);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Google login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b1020] px-4 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-64px)] max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_440px]">
        <section className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 shadow-lg shadow-black/20">
            <Video className="h-4 w-4 text-cyan-300" />
            Secure meetings for teams
          </div>
          <h1 className="mt-8 text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Professional video meetings with chat, audio rooms, and screen sharing.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            Start focused calls from a clean dashboard, join by room ID, and keep every conversation organized with meeting history.
          </p>
          <div className="mt-8 grid max-w-lg grid-cols-3 gap-3 text-center">
            {["HD video", "Audio rooms", "Live chat"].map((item) => (
              <div key={item} className="rounded-lg border border-white/10 bg-white/5 px-3 py-4 shadow-lg shadow-black/10">
                <p className="text-sm font-medium text-slate-100">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.07] p-6 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-400 text-slate-950">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Welcome back</h2>
              <p className="text-sm text-slate-400">Sign in to start or join a meeting.</p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {error && <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
            <label className="block">
              <span className="text-sm font-medium text-slate-300">Email</span>
              <input
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-300">Password</span>
              <input
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                placeholder="Enter password"
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <button disabled={submitting} className="w-full rounded-lg bg-cyan-400 px-4 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300">
              {submitting ? "Logging in..." : "Login"}
            </button>
          </form>

          {isGoogleAuthEnabled && (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs uppercase tracking-wide text-slate-500">or</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="overflow-hidden rounded-lg bg-white p-1">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Google login failed")}
                  theme="outline"
                  size="large"
                  width="320"
                />
              </div>
            </>
          )}

          <p className="mt-5 text-center text-sm text-slate-400">
            No account? <Link className="font-medium text-cyan-300 hover:text-cyan-200" to="/register">Create one</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
