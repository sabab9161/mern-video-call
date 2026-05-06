import "dotenv/config";
import express from "express";
import http from "http";
import { ExpressPeerServer } from "peer";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { startReminderJob } from "./jobs/reminderJob.js";
import { configureSocket } from "./socket/index.js";

const port = process.env.PORT || 5000;
const server = http.createServer(app);
const uploadsDir = fileURLToPath(new URL("../uploads", import.meta.url));

app.use("/uploads", express.static(uploadsDir));

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["polling"],
  allowUpgrades: false
});

const peerServer = ExpressPeerServer(server, {
  path: "/myapp",
  proxied: true
});

app.use("/peerjs", peerServer);
configureSocket(io);

connectDB()
  .then(() => {
    server.listen(port, "0.0.0.0", () => {
      console.log(`Server running on port ${port}`);
      console.log(`PeerJS running on /peerjs`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });