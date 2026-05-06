import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    roomId: { type: String, required: true, index: true },
    roomType: { type: String, enum: ["audio", "video"], required: true, default: "video" },
    scheduledDate: { type: String, trim: true },
    scheduledTime: { type: String, trim: true },
    scheduledAt: { type: Date, index: true },
    invitedEmails: [{ type: String, lowercase: true, trim: true }],
    joinLink: { type: String, required: true, trim: true },
    reminderSent: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["scheduled", "completed", "cancelled"], default: "scheduled", index: true },

    // Existing history code reads these legacy fields. Keep them populated to avoid
    // breaking completed meeting history while scheduled meetings move to createdBy/scheduledAt.
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    scheduledFor: { type: Date },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date },
    durationSeconds: { type: Number, default: 0 }
  },
  { timestamps: true }
);

meetingSchema.index({ createdBy: 1, status: 1, scheduledAt: 1 });
meetingSchema.index({ status: 1, reminderSent: 1, scheduledAt: 1 });

export default mongoose.model("Meeting", meetingSchema);
