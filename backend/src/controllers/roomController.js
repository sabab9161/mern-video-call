import crypto from "crypto";
import { validationResult } from "express-validator";
import Room from "../models/Room.js";

export const createRoom = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

  const roomId = crypto.randomBytes(4).toString("hex");
  const roomType = req.body.roomType === "audio" ? "audio" : "video";
  const room = await Room.create({
    roomId,
    title: req.body.title || (roomType === "audio" ? "Audio meeting" : "Video meeting"),
    roomType,
    host: req.user._id,
    createdBy: req.user._id,
    participants: [req.user._id]
  });

  res.status(201).json({
    roomId: room.roomId,
    room
  });
};

export const joinRoom = async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId });
  if (!room) return res.status(404).json({ message: "Room not found" });
  if (room.status === "ended") return res.status(410).json({ message: "This meeting has ended" });

  if (!room.participants.some((id) => id.equals(req.user._id))) {
    room.participants.push(req.user._id);
    await room.save();
  }

  res.json({ room });
};

export const getRoom = async (req, res) => {
  const room = await Room.findOne({ roomId: req.params.roomId })
    .populate("host", "name email avatar")
    .populate("createdBy", "name email avatar")
    .populate("participants", "name email avatar");
  if (!room) return res.status(404).json({ message: "Room not found" });
  const roomObject = room.toObject();
  res.json({ room: { ...roomObject, roomType: roomObject.roomType || "video" } });
};
