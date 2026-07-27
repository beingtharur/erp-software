import "server-only";
import nodemailer from "nodemailer";

// Free transactional email via Gmail's SMTP relay — no third-party service,
// no signup, no domain verification. SMTP_USER is the sending Gmail address;
// SMTP_APP_PASSWORD is a Google Account "App Password" (Account > Security >
// 2-Step Verification > App passwords), never the account's real password.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_APP_PASSWORD,
  },
});

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_APP_PASSWORD) {
    // Local dev without SMTP configured — log the link instead of sending,
    // so the flow is still fully testable without real credentials.
    console.log(`[email] Password reset link for ${to}: ${resetUrl}`);
    return;
  }

  await transporter.sendMail({
    from: `"Exist Digitally" <${process.env.SMTP_USER}>`,
    to,
    subject: "Reset your password — Exist Digitally",
    text: `We received a request to reset your password.\n\nReset it here (valid for 1 hour): ${resetUrl}\n\nIf you didn't request this, you can safely ignore this email — your password won't change.`,
    html: `
      <p>We received a request to reset your password.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a> (valid for 1 hour).</p>
      <p style="color:#666;font-size:13px">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    `,
  });
}
