import cron from "node-cron";
import Meeting from "../models/Meeting.js";
import sendEmail from "../utils/sendEmail.js";

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

const buildReminderEmail = (meeting) => {
  const formattedDate = formatScheduledAt(meeting.scheduledAt);
  const safeTitle = escapeHtml(meeting.title);
  const safeRoomType = escapeHtml(meeting.roomType);
  const safeJoinLink = escapeHtml(meeting.joinLink);

  return {
    subject: `Meeting Reminder - ${meeting.title}`,
    text: [
      `Reminder: your ${meeting.roomType} meeting starts soon.`,
      "",
      `Title: ${meeting.title}`,
      `Date/Time: ${formattedDate}`,
      `Join Link: ${meeting.joinLink}`,
      "",
      "Please join using the link above."
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <p>Reminder: your ${safeRoomType} meeting starts soon.</p>
        <p><strong>Title:</strong> ${safeTitle}</p>
        <p><strong>Date/Time:</strong> ${formattedDate}</p>
        <p><strong>Meeting Type:</strong> ${safeRoomType}</p>
        <p><strong>Join Link:</strong> <a href="${safeJoinLink}">${safeJoinLink}</a></p>
        <p>Please join using the link above.</p>
      </div>
    `
  };
};

export const sendDueMeetingReminders = async () => {
  const now = new Date();
  const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

  const meetings = await Meeting.find({
    reminderSent: false,
    status: "scheduled",
    scheduledAt: { $gte: now, $lte: tenMinutesFromNow }
  });

  for (const meeting of meetings) {
    try {
      if (meeting.invitedEmails.length) {
        await sendEmail({
          to: meeting.invitedEmails,
          ...buildReminderEmail(meeting)
        });
      }

      meeting.reminderSent = true;
      await meeting.save();
    } catch (error) {
      console.error(`Failed to send reminder for meeting ${meeting._id}:`, error);
    }
  }
};

export const startReminderJob = () => {
  const task = cron.schedule("* * * * *", () => {
    sendDueMeetingReminders().catch((error) => {
      console.error("Reminder job failed:", error);
    });
  });

  console.log("Meeting reminder job started");
  return task;
};
