import { io } from "socket.io-client";

export const createSocket = () =>
  io("http://localhost:5000", {
    transports: ["polling"],
    upgrade: false,
    reconnectionAttempts: 5
  });
