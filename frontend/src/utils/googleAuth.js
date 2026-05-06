export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export const isGoogleAuthEnabled =
  GOOGLE_CLIENT_ID.endsWith(".apps.googleusercontent.com") &&
  !GOOGLE_CLIENT_ID.startsWith("your_");
