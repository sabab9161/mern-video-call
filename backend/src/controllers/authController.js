import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import Otp from "../models/Otp.js";
import User from "../models/User.js";
import sendEmail from "../utils/sendEmail.js";

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }

  return process.env.JWT_SECRET;
};

const signToken = (id) => jwt.sign({ id: id.toString() }, getJwtSecret(), { expiresIn: "7d" });

const serializeAuthUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  mobile: user.mobile || "",
  avatar: user.avatar || ""
});

const sendAuth = (res, user) => {
  res.json({
    token: signToken(user._id),
    user: serializeAuthUser(user)
  });
};

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const sendRegistrationOtpEmail = async ({ email, otp }) => {
  await sendEmail({
    to: email,
    subject: "Your MeetBridge Registration OTP",
    text: [
      `Your OTP is: ${otp}`,
      "This OTP is valid for 5 minutes.",
      "Do not share it with anyone."
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <p>Your OTP is: <strong style="font-size: 20px;">${otp}</strong></p>
        <p>This OTP is valid for 5 minutes.</p>
        <p>Do not share it with anyone.</p>
      </div>
    `
  });
};

const verifyGoogleCredential = async (credential) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is missing");
  }

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
  if (!response.ok) {
    throw new Error("Invalid Google credential");
  }

  const profile = await response.json();
  if (profile.aud !== process.env.GOOGLE_CLIENT_ID) {
    throw new Error("Google credential audience mismatch");
  }

  if (profile.email_verified !== "true" && profile.email_verified !== true) {
    throw new Error("Google email is not verified");
  }

  return {
    googleId: profile.sub,
    email: profile.email.toLowerCase().trim(),
    name: profile.name || profile.email.split("@")[0],
    avatar: profile.picture || ""
  };
};

export const sendRegisterOtp = async (req, res) => {
  let otpRecord;

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const name = req.body.name.trim();
    const email = req.body.email.toLowerCase().trim();
    const mobile = req.body.mobile.trim();
    const { password } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
    if (existingUser?.email === email) {
      return res.status(409).json({
        field: "email",
        message: "Email already registered. Use a different email or login instead."
      });
    }
    if (existingUser?.mobile === mobile) {
      return res.status(409).json({
        field: "mobile",
        message: "Mobile number already registered. Use a different mobile number or login instead."
      });
    }

    const hashed = await bcrypt.hash(password, 12);
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.updateMany({ email, used: false }, { $set: { used: true } });

    otpRecord = await Otp.create({
      name,
      email,
      mobile,
      password: hashed,
      otp,
      expiresAt,
      used: false
    });

    try {
      console.log("EMAIL_USER:", process.env.EMAIL_USER);
      console.log("Sending OTP to:", email);
      await sendRegistrationOtpEmail({ email, otp });
    } catch (error) {
      await Otp.findByIdAndDelete(otpRecord._id).catch(() => {});

      console.error("OTP email error:", error);
      return res.status(500).json({
        message: error.message === "SMTP credentials missing"
          ? "SMTP credentials missing"
          : "Unable to send OTP email. Check SMTP credentials.",
        ...(process.env.NODE_ENV !== "production" ? { error: error.message } : {})
      });
    }

    res.json({ message: "OTP sent to your email. It is valid for 5 minutes." });
  } catch (error) {
    if (otpRecord?._id) {
      await Otp.findByIdAndDelete(otpRecord._id).catch(() => {});
    }

    console.error("Send registration OTP failed", error);
    res.status(500).json({
      message: "Unable to send registration OTP",
      ...(process.env.NODE_ENV !== "production" ? { error: error.message } : {})
    });
  }
};

export const verifyRegisterOtp = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

  try {
    const email = req.body.email.toLowerCase().trim();
    const otp = String(req.body.otp || "").trim();

    const otpRecord = await Otp.findOne({ email }).sort({ createdAt: -1 });
    if (!otpRecord) {
      return res.status(400).json({ message: "OTP not found. Please request a new OTP." });
    }
    if (otpRecord.used) {
      return res.status(400).json({ message: "OTP has already been used. Please request a new OTP." });
    }
    if (otpRecord.expiresAt <= new Date()) {
      return res.status(400).json({ message: "OTP has expired. Please request a new OTP." });
    }
    if (otpRecord.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const consumedOtp = await Otp.findOneAndUpdate(
      {
        _id: otpRecord._id,
        used: false,
        expiresAt: { $gt: new Date() },
        otp
      },
      { $set: { used: true } },
      { new: true }
    );
    if (!consumedOtp) {
      return res.status(400).json({ message: "OTP has already been used or expired. Please request a new OTP." });
    }

    const existingUser = await User.findOne({
      $or: [{ email: consumedOtp.email }, { mobile: consumedOtp.mobile }]
    });
    if (existingUser?.email === consumedOtp.email) {
      return res.status(409).json({
        field: "email",
        message: "Email already registered. Use a different email or login instead."
      });
    }
    if (existingUser?.mobile === consumedOtp.mobile) {
      return res.status(409).json({
        field: "mobile",
        message: "Mobile number already registered. Use a different mobile number or login instead."
      });
    }

    const user = await User.create({
      name: consumedOtp.name,
      email: consumedOtp.email,
      mobile: consumedOtp.mobile,
      password: consumedOtp.password,
      isVerified: true,
      authProvider: "local"
    });

    sendAuth(res, user);
  } catch (error) {
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];
      return res.status(409).json({
        message: duplicateField === "mobile" ? "Mobile number already registered" : "Email already registered"
      });
    }

    console.error("Verify registration OTP failed", error);
    res.status(500).json({ message: "OTP verification failed" });
  }
};

export const register = sendRegisterOtp;

export const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

  try {
    const email = req.body.email.toLowerCase().trim();
    const { password } = req.body;
    const user = await User.findOne({ email });
    if (user?.authProvider === "google" && !user.password) {
      return res.status(400).json({ message: "Use Google login for this account" });
    }
    const valid = user ? await bcrypt.compare(password, user.password) : false;

    if (!valid) return res.status(401).json({ message: "Invalid email or password" });
    sendAuth(res, user);
  } catch (error) {
    console.error("Login failed", error);
    res.status(500).json({ message: "Login failed" });
  }
};

export const googleLogin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

  try {
    const profile = await verifyGoogleCredential(req.body.credential);
    let user = await User.findOne({ email: profile.email });

    if (user) {
      user.googleId = user.googleId || profile.googleId;
      user.avatar = profile.avatar || user.avatar;
      user.isVerified = true;
      user.authProvider = user.authProvider || "google";
      await user.save();
    } else {
      user = await User.create({
        name: profile.name,
        email: profile.email,
        googleId: profile.googleId,
        avatar: profile.avatar,
        isVerified: true,
        authProvider: "google"
      });
    }

    sendAuth(res, user);
  } catch (error) {
    console.error("Google login failed", error);
    res.status(401).json({ message: error.message || "Google login failed" });
  }
};

export const me = (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      mobile: req.user.mobile,
      avatar: req.user.avatar,
      isVerified: req.user.isVerified,
      authProvider: req.user.authProvider
    }
  });
};
