/**
 * ส่งอีเมลผ่าน SMTP (Brevo) — ใช้สำหรับส่ง OTP
 * ตั้งค่า SMTP_* และ EMAIL_FROM* ใน .env
 */
import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error("SMTP: ตั้งค่า SMTP_HOST, SMTP_USER, SMTP_PASS ใน .env");
  }
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail(options: SendMailOptions): Promise<void> {
  const from = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME || "Sakura Market";
  if (!from) throw new Error("EMAIL_FROM ต้องตั้งค่าใน .env");
  const transporter = getTransporter();
  await transporter.sendMail({
    from: fromName ? `"${fromName}" <${from}>` : from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html ?? options.text.replace(/\n/g, "<br>"),
  });
}
