import express from "express";
import { deleteMeeting, endMeeting, getHistory, getMyScheduled, scheduleMeeting, startMeeting } from "../controllers/meetingController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.use(protect);
router.get("/history", asyncHandler(getHistory));
router.get("/my-scheduled", asyncHandler(getMyScheduled));
router.post("/schedule", asyncHandler(scheduleMeeting));
router.post("/start", asyncHandler(startMeeting));
router.patch("/:id/end", asyncHandler(endMeeting));
router.delete("/:id", asyncHandler(deleteMeeting));

export default router;
