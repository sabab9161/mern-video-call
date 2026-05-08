import cors from "cors";
import express from "express";

import authRoutes from "./routes/authRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import translateRoutes from "./routes/translateRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://mern-video-call-df2n.vercel.app",
  "https://mern-video-call-pd3s.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root test route
app.get("/", (_req, res) => {
  res.json({ message: "MeetBridge backend is running" });
});

// Health test route
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/translate", translateRoutes);

// API 404 handler
app.use("/api", (req, res) => {
  res.status(404).json({
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(err.status || 500).json({
    message: err.message || "Server error",
    ...(process.env.NODE_ENV !== "production"
      ? { error: err.stack }
      : {}),
  });
});

export default app;