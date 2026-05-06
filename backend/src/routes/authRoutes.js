import express from "express";
import { body } from "express-validator";
import { googleLogin, login, me, register, sendRegisterOtp, verifyRegisterOtp } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.#_-])[A-Za-z\d@$!%*?&.#_-]{8,}$/;
const passwordMessage = "Password must be at least 8 characters and include uppercase, lowercase, number, and special character";

router.post(
  "/send-register-otp",
  body("name").trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
  body("email").trim().isEmail().withMessage("Enter a valid email").normalizeEmail(),
  body("mobile").trim().matches(/^\d{10}$/).withMessage("Mobile number must be 10 digits"),
  body("password").matches(passwordRegex).withMessage(passwordMessage),
  asyncHandler(sendRegisterOtp)
);

router.all("/send-register-otp", (_req, res) => {
  res.status(405).json({ message: "Use POST /api/auth/send-register-otp to send registration OTP" });
});

router.post(
  "/verify-register-otp",
  body("email").trim().isEmail().withMessage("Enter a valid email").normalizeEmail(),
  body("otp").trim().matches(/^\d{6}$/).withMessage("OTP must be 6 digits"),
  asyncHandler(verifyRegisterOtp)
);

router.post(
  "/register",
  body("name").trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
  body("email").trim().isEmail().withMessage("Enter a valid email").normalizeEmail(),
  body("mobile").trim().matches(/^\d{10}$/).withMessage("Mobile number must be 10 digits"),
  body("password").matches(passwordRegex).withMessage(passwordMessage),
  asyncHandler(register)
);

router.post(
  "/login",
  body("email").trim().isEmail().withMessage("Enter a valid email").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
  asyncHandler(login)
);

router.post(
  "/google",
  body("credential").notEmpty().withMessage("Google credential is required"),
  asyncHandler(googleLogin)
);

router.get("/me", protect, asyncHandler(me));

export default router;
