import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["user_joined", "user_left", "meeting_invite", "meeting_scheduled", "meeting_ended"],
      required: true
    },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    roomId: { type: String, default: "" },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
