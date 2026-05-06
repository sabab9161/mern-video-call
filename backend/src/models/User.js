import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    mobile: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    password: {
      type: String,
      required() {
        return this.authProvider === "local";
      }
    },
    isVerified: { type: Boolean, default: false },
    googleId: { type: String, index: true, sparse: true },
    avatar: { type: String, default: "" },
    authProvider: { type: String, enum: ["local", "google"], default: "local" }
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
