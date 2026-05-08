import nodemailer from "nodemailer";

const requiredEmailConfig = [
  "EMAIL_HOST",
  "EMAIL_PORT",
  "EMAIL_USER",
  "EMAIL_PASSWORD",
  "EMAIL_FROM_NAME",
  "EMAIL_FROM_ADDRESS",
];

const getTransporter = () => {
  const missingKeys = requiredEmailConfig.filter(
    (key) => !process.env[key]
  );

  if (missingKeys.length) {
    throw new Error(
      `Email configuration missing: ${missingKeys.join(", ")}`
    );
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error("SMTP credentials missing");
  }

  const port = Number(process.env.EMAIL_PORT);

  if (!Number.isInteger(port)) {
    throw new Error("EMAIL_PORT must be a valid number");
  }

  if (
    process.env.EMAIL_USER === "your_email@gmail.com" ||
    process.env.EMAIL_USER === "yourgmail@gmail.com" ||
    process.env.EMAIL_PASSWORD === "your_gmail_app_password" ||
    process.env.EMAIL_PASSWORD === "your_16_digit_app_password" ||
    process.env.EMAIL_PASSWORD === "your_16_digit_gmail_app_password"
  ) {
    throw new Error("SMTP credentials missing");
  }

  console.log("EMAIL_USER:", process.env.EMAIL_USER);

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: process.env.EMAIL_SECURE === "true",

    // Force IPv4 for Render
    family: 4,

    tls: {
      rejectUnauthorized: false,
    },

    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

const formatFromAddress = () => {
  const fromName = process.env.EMAIL_FROM_NAME || "MeetBridge";

  const fromAddress =
    process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER;

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