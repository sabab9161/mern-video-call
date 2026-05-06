import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    title: { type: String, default: "Untitled meeting" },
    roomType: { type: String, enum: ["audio", "video"], default: "video", required: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, enum: ["active", "ended"], default: "active", required: true }
  },
  { timestamps: true }
);

export default mongoose.model("Room", roomSchema);
