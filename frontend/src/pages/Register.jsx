import { GoogleLogin } from "@react-oauth/google";
import { ShieldCheck, Video } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../utils/api.js";
import { isGoogleAuthEnabled } from "../utils/googleAuth.js";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_-])[A-Za-z\d@$!%*?&.#_-]{8,}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mobileRegex = /^\d{10}$/;

const getPasswordRules = (password) => [
  { label: "Minimum 8 characters", valid: password.length >= 8 },
  { label: "At least 1 uppercase letter", valid: /[A-Z]/.test(password) },
  { label: "At least 1 lowercase letter", valid: /[a-z]/.test(password) },
  { label: "At least 1 number", valid: /\d/.test(password) },
  { label: "At least 1 special character (@ $ ! % * ? & . # _ -)", valid: /[@$!%*?&.#_-]/.test(password) }
];

export default function Register() {
  const { googleLogin, updateStoredUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", mobile: "", password: "" });
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("details");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const passwordRules = getPasswordRules(form.password);
  const passwordValid = passwordRegex.test(form.password);
  const detailsValid =
    form.name.trim().length >= 2 &&
    emailRegex.test(form.email.trim()) &&
    mobileRegex.test(form.mobile.trim()) &&
    passwordValid;

  const validateDetails = () => {
    if (form.name.trim().length < 2) return "Name must be at least 2 characters";
    if (!emailRegex.test(form.email.trim())) return "Enter a valid email";
    if (!mobileRegex.test(form.mobile.trim())) return "Mobile number must be 10 digits";
    if (!passwordValid) return "Password is too weak. Complete all password rules before continuing.";
    return "";
  };

  const getApiErrorMessage = (err, fallback) => {
    const apiMessage = err.response?.data?.message;

    if (err.response?.status === 409) {
      return apiMessage || "This email or mobile number is already registered. Login or use different details.";
    }

    return apiMessage || err.message || fallback;
  };

  const sendOtp = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateDetails();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/send-register-otp", {
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        password: form.password
      });

      setSuccess(data.message || "OTP sent to your email. It is valid for 5 minutes.");
      setStep("otp");
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to send OTP"));
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("OTP must be 6 digits");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/verify-register-otp", {
        email: form.email.trim(),
        otp: otp.trim()
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("name", data.user.name || "");
      localStorage.setItem("email", data.user.email || "");
      updateStoredUser(data.user);
      navigate("/profile");
    } catch (err) {
      setError(getApiErrorMessage(err, "OTP verification failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const editDetails = () => {
    setStep("details");
    setOtp("");
    setError("");
    setSuccess("");
  };

  const handleGoogleSuccess = async ({ credential }) => {
    if (!credential) {
      setError("Google signup did not return a credential");
      return;
    }

    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      await googleLogin(credential);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Google signup failed");
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
            MeetMERN workspace
          </div>
          <h1 className="mt-8 text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Create your meeting account and start calls in seconds.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            Host video meetings, audio-only calls, share your screen, and keep chat available throughout every room.
          </p>
          <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-xl shadow-black/20">
            <p className="text-sm font-medium text-slate-100">Built for everyday collaboration</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">A focused interface with JWT auth, protected rooms, WebRTC media, and meeting history.</p>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.07] p-6 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-400 text-slate-950">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Create account</h2>
              <p className="text-sm text-slate-400">{step === "details" ? "Set up your profile for calls." : "Verify the OTP sent to your email."}</p>
            </div>
          </div>

          <form onSubmit={step === "details" ? sendOtp : verifyOtp} className="mt-7 space-y-4">
            {error && <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
            {success && <p className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">{success}</p>}

            {step === "details" ? (
              <>
                <label className="block">
                  <span className="text-sm font-medium text-slate-300">Name</span>
                  <input
                    className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                    placeholder="Your name"
                    autoComplete="name"
                    required
                    minLength={2}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
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
                  <span className="text-sm font-medium text-slate-300">Mobile number</span>
                  <input
                    className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                    placeholder="10 digit mobile number"
                    type="tel"
                    autoComplete="tel"
                    inputMode="numeric"
                    required
                    maxLength={10}
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-300">Password</span>
                  <input
                    className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                    placeholder="Strong password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </label>
                <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3">
                  <p className="text-xs font-medium text-slate-300">Password must contain:</p>
                  <ul className="mt-2 space-y-1">
                    {passwordRules.map((rule) => (
                      <li key={rule.label} className={`flex items-center gap-2 text-xs ${rule.valid ? "text-emerald-300" : "text-slate-500"}`}>
                        <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] ${rule.valid ? "bg-emerald-400 text-slate-950" : "bg-white/10 text-slate-500"}`}>
                          {rule.valid ? "OK" : "-"}
                        </span>
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <button disabled={submitting || !detailsValid} className="w-full rounded-lg bg-cyan-400 px-4 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300">
                  {submitting ? "Sending OTP..." : "Send OTP"}
                </button>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-3 text-sm text-slate-300">
                  OTP sent to <span className="font-medium text-cyan-200">{form.email}</span>
                </div>
                <label className="block">
                  <span className="text-sm font-medium text-slate-300">OTP</span>
                  <input
                    className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                    placeholder="6 digit OTP"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </label>
                <button disabled={submitting || otp.length !== 6} className="w-full rounded-lg bg-cyan-400 px-4 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300">
                  {submitting ? "Verifying..." : "Verify & Register"}
                </button>
                <button type="button" onClick={editDetails} className="w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15">
                  Edit details
                </button>
              </>
            )}
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
                  onError={() => setError("Google signup failed")}
                  theme="outline"
                  size="large"
                  width="320"
                />
              </div>
            </>
          )}

          <p className="mt-5 text-center text-sm text-slate-400">
            Already registered? <Link className="font-medium text-cyan-300 hover:text-cyan-200" to="/login">Login</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
