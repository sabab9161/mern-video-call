import nodemailer from "nodemailer";

const requiredEmailConfig = [
  "EMAIL_USER",
  "EMAIL_PASSWORD",
  "EMAIL_FROM_NAME",
  "EMAIL_FROM_ADDRESS",
];

const getTransporter = () => {
  const missingKeys = requiredEmailConfig.filter((key) => !process.env[key]);

  if (missingKeys.length) {
    throw new Error(`Email configuration missing: ${missingKeys.join(", ")}`);
  }

  console.log("EMAIL_USER:", process.env.EMAIL_USER);

  return nodemailer.createTransport({
    service: "gmail",
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.EMAIL_PORT || 465),
    secure: true,

    // Important for Render SMTP
    family: 4,

    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },

    tls: {
      rejectUnauthorized: false,
    },
  });
};

const formatFromAddress = () => {
  const fromName = process.env.EMAIL_FROM_NAME || "MeetBridge";
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER;

  return `"${fromName}" <${fromAddress}>`;
};

const sendEmail = async ({ to, subject, text, html }) => {
  const recipients = Array.isArray(to)
    ? to.filter(Boolean)
    : [to].filter(Boolean);

  if (!recipients.length) {
    throw new Error("At least one email recipient is required");
  }

  const transporter = getTransporter();

  return transporter.sendMail({
    from: formatFromAddress(),
    to: recipients.join(", "),
    subject,
    text,
    html,
  });
};

export default sendEmail;