import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  mobile: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
  used: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now, index: true }
});

otpSchema.index({ email: 1, createdAt: -1 });

export default mongoose.model("Otp", otpSchema);
