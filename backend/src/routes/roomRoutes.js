import express from "express";
import { v4 as uuidv4 } from "uuid";
import { getRoom, joinRoom } from "../controllers/roomController.js";
import { protect } from "../middleware/auth.js";
import Room from "../models/Room.js";

const router = express.Router();

router.post("/create", protect, async (req, res) => {
  try {
    const { roomType = "video" } = req.body;
    const normalizedRoomType = roomType === "audio" ? "audio" : "video";

    const room = await Room.create({
      roomId: uuidv4(),
      title: req.body.title || (normalizedRoomType === "audio" ? "Audio meeting" : "Video meeting"),
      roomType: normalizedRoomType,
      host: req.user._id,
      createdBy: req.user._id,
      participants: [req.user._id]
    });

    res.status(201).json({
      roomId: room.roomId,
      room
    });
  } catch (err) {
    console.error("Create room failed", err);
    res.status(500).json({ message: "Unable to create room" });
  }
});

router.post("/", protect, async (req, res) => {
  try {
    const { roomType = "video" } = req.body;
    const normalizedRoomType = roomType === "audio" ? "audio" : "video";

    const room = await Room.create({
      roomId: uuidv4(),
      title: req.body.title || (normalizedRoomType === "audio" ? "Audio meeting" : "Video meeting"),
      roomType: normalizedRoomType,
      host: req.user._id,
      createdBy: req.user._id,
      participants: [req.user._id]
    });

    res.status(201).json({
      roomId: room.roomId,
      room
    });
  } catch (err) {
    console.error("Create room failed", err);
    res.status(500).json({ message: "Unable to create room" });
  }
});

router.get("/:roomId", protect, getRoom);
router.post("/:roomId/join", protect, joinRoom);

export default router;
