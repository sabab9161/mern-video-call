import { v4 as uuidv4 } from "uuid";
import Meeting from "../models/Meeting.js";
import Notification from "../models/Notification.js";
import Room from "../models/Room.js";
import User from "../models/User.js";
import sendEmail from "../utils/sendEmail.js";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmails = (value) => {
  const rawEmails = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(rawEmails.map((email) => email.toLowerCase().trim()).filter(Boolean))];
};

const formatScheduledAt = (date) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: process.env.TZ || "Asia/Kolkata"
  }).format(date);

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const buildMeetingEmail = ({ title, roomType, scheduledAt, joinLink }) => {
  const formattedDate = formatScheduledAt(scheduledAt);
  const safeTitle = escapeHtml(title);
  const safeRoomType = escapeHtml(roomType);
  const safeJoinLink = escapeHtml(joinLink);

  return {
    subject: `Meeting Invitation - ${title}`,
    text: [
      `You have been invited to a ${roomType} meeting.`,
      "",
      `Title: ${title}`,
      `Date/Time: ${formattedDate}`,
      `Join Link: ${joinLink}`,
      "",
      "Please join using the link above."
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <p>You have been invited to a ${safeRoomType} meeting.</p>
        <p><strong>Title:</strong> ${safeTitle}</p>
        <p><strong>Date/Time:</strong> ${formattedDate}</p>
        <p><strong>Meeting Type:</strong> ${safeRoomType}</p>
        <p><strong>Join Link:</strong> <a href="${safeJoinLink}">${safeJoinLink}</a></p>
        <p>Please join using the link above.</p>
      </div>
    `
  };
};

export const startMeeting = async (req, res) => {
  const room = await Room.findOne({ roomId: req.body.roomId });
  if (!room) return res.status(404).json({ message: "Room not found" });

  const meeting = await Meeting.create({
    roomId: room.roomId,
    title: room.title || (room.roomType === "audio" ? "Audio meeting" : "Video meeting"),
    roomType: room.roomType || "video",
    joinLink: `${(process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "")}/room/${room.roomId}`,
    user: req.user._id,
    createdBy: req.user._id,
    status: "completed",
    joinedAt: new Date()
  });

  res.status(201).json({ meeting });
};

export const endMeeting = async (req, res) => {
  const meeting = await Meeting.findOne({
    _id: req.params.id,
    $or: [{ user: req.user._id }, { createdBy: req.user._id }]
  });
  if (!meeting) return res.status(404).json({ message: "Meeting history item not found" });

  const leftAt = new Date();
  meeting.leftAt = leftAt;
  meeting.durationSeconds = Math.max(0, Math.round((leftAt - meeting.joinedAt) / 1000));
  await meeting.save();

  res.json({ meeting });
};

export const getHistory = async (req, res) => {
  const meetings = await Meeting.find({
    status: "completed",
    $or: [{ user: req.user._id }, { createdBy: req.user._id }]
  }).sort({ createdAt: -1 }).limit(50).lean();
  const roomIdsWithoutType = meetings.filter((meeting) => !meeting.roomType).map((meeting) => meeting.roomId);
  const rooms = roomIdsWithoutType.length
    ? await Room.find({ roomId: { $in: roomIdsWithoutType } }).select("roomId roomType").lean()
    : [];
  const roomTypeById = new Map(rooms.map((room) => [room.roomId, room.roomType]));

  const normalizedMeetings = meetings.map((meeting) => ({
    ...meeting,
    roomType: meeting.roomType || roomTypeById.get(meeting.roomId) || "video"
  }));

  res.json({ meetings: normalizedMeetings });
};

export const scheduleMeeting = async (req, res) => {
  const { title, description = "", date, time, roomType = "video" } = req.body;
  if (!title?.trim()) return res.status(400).json({ message: "Title is required" });
  if (!date || !time) return res.status(400).json({ message: "Date and time are required" });
  if (!["audio", "video"].includes(roomType)) return res.status(400).json({ message: "Room type must be audio or video" });

  const scheduledAt = new Date(`${date}T${time}`);
  if (Number.isNaN(scheduledAt.getTime())) return res.status(400).json({ message: "Invalid schedule date or time" });
  if (scheduledAt <= new Date()) return res.status(400).json({ message: "Meeting time must be in the future" });

  const emails = normalizeEmails(req.body.invitedEmails ?? req.body.invitedEmail);
  if (!emails.length) return res.status(400).json({ message: "Invited user email is required" });

  const invalidEmails = emails.filter((email) => !emailRegex.test(email));
  if (invalidEmails.length) return res.status(400).json({ message: `Invalid invited email: ${invalidEmails[0]}` });

  let room;
  let meeting;

  try {
    const roomId = uuidv4();
    const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
    const joinLink = `${clientUrl}/room/${roomId}`;

    room = await Room.create({
      roomId,
      title: title.trim(),
      roomType,
      host: req.user._id,
      createdBy: req.user._id,
      participants: [req.user._id]
    });

    meeting = await Meeting.create({
      roomId: room.roomId,
      title: title.trim(),
      description: description.trim(),
      roomType,
      createdBy: req.user._id,
      user: req.user._id,
      scheduledDate: date,
      scheduledTime: time,
      scheduledAt,
      scheduledFor: scheduledAt,
      invitedEmails: emails,
      joinLink,
      reminderSent: false,
      status: "scheduled"
    });

    const inviteEmail = buildMeetingEmail({
      title: meeting.title,
      roomType: meeting.roomType,
      scheduledAt,
      joinLink
    });

    await sendEmail({
      to: emails,
      ...inviteEmail
    });
  } catch (error) {
    console.error("Schedule meeting failed:", error);

    if (meeting?._id) await Meeting.findByIdAndDelete(meeting._id).catch(() => {});
    if (room?._id) await Room.findByIdAndDelete(room._id).catch(() => {});

    return res.status(502).json({ message: "Unable to schedule meeting because the invite email could not be sent" });
  }

  await Notification.create({
    user: req.user._id,
    type: "meeting_scheduled",
    title: "Meeting scheduled",
    message: `${meeting.title} is scheduled for ${scheduledAt.toLocaleString()}`,
    roomId: room.roomId
  });

  if (emails.length) {
    const invitedUsers = await User.find({ email: { $in: emails } }).select("_id");
    if (invitedUsers.length) {
      await Notification.insertMany(invitedUsers.map((invitedUser) => ({
        user: invitedUser._id,
        type: "meeting_invite",
        title: "Meeting invite",
        message: `${req.user.name} invited you to ${meeting.title}`,
        roomId: room.roomId
      })));
    }
  }

  res.status(201).json({ message: "Meeting scheduled and invite email sent", meeting, room, inviteLink: meeting.joinLink });
};

export const getMyScheduled = async (req, res) => {
  const meetings = await Meeting.find({
    status: "scheduled",
    $or: [{ createdBy: req.user._id }, { user: req.user._id }]
  }).sort({ scheduledAt: 1, scheduledFor: 1 });
  res.json({ meetings });
};

export const deleteMeeting = async (req, res) => {
  const meeting = await Meeting.findOneAndDelete({
    _id: req.params.id,
    $or: [{ createdBy: req.user._id }, { user: req.user._id }]
  });
  if (!meeting) return res.status(404).json({ message: "Meeting not found" });
  res.json({ message: "Meeting deleted" });
};
