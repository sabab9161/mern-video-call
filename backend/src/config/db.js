import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "url";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;

  if (!mongoUri) {
    throw new Error("MongoDB URI is missing. Add MONGO_URI to backend/.env");
  }

  const maxAttempts = Number(process.env.MONGO_CONNECT_RETRIES || 3);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 30000
      });
      console.log("MongoDB connected");
      return;
    } catch (error) {
      console.error(`MongoDB connection failed (${attempt}/${maxAttempts}):`, error.message);

      if (attempt === maxAttempts) {
        throw error;
      }

      await wait(3000);
    }
  }
};
