import express from "express";
import { body, validationResult } from "express-validator";
import { protect } from "../middleware/auth.js";

const router = express.Router();

const dictionary = {
  hello: "नमस्ते",
  hi: "नमस्ते",
  thanks: "धन्यवाद",
  "thank you": "धन्यवाद",
  yes: "हाँ",
  no: "नहीं",
  meeting: "मीटिंग",
  call: "कॉल",
  please: "कृपया"
  
};

const localTranslate = (text, target) => {
  if (target === "hi") {
    return dictionary[text.toLowerCase()] || `[Hindi] ${text}`;
  }

  const reverse = Object.entries(dictionary).find(([, value]) => value === text.trim());
  return reverse?.[0] || `[English] ${text}`;
};

router.post(
  "/",
  protect,
  body("text").trim().notEmpty().withMessage("Text is required"),
  body("target").isIn(["en", "hi"]).withMessage("Target language must be en or hi"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const { text, target } = req.body;

    try {
      if (process.env.TRANSLATE_API_KEY) {
        // Keep this integration point isolated. Configure your provider here using TRANSLATE_API_KEY.
      }

      res.json({ originalText: text, translatedText: localTranslate(text, target), target });
    } catch (error) {
      console.error("Translate failed", error);
      res.status(500).json({ message: "Unable to translate message" });
    }
  }
);

export default router;
