import fs from "fs/promises";
import nodemailer from "nodemailer";
import PQueue from "p-queue";

const dispatchQueue = new PQueue({
  concurrency: Math.max(1, Number(process.env.REPORT_DISPATCH_CONCURRENCY || 2)),
  timeout: Math.max(5000, Number(process.env.REPORT_DISPATCH_TIMEOUT_MS || 120000)),
  throwOnTimeout: true,
});

const getTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.REPORT_EMAIL_USER, pass: process.env.REPORT_EMAIL_PASS },
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
};

export function enqueueReportEmail({ filePath, email, subject, body }) {
  return dispatchQueue.add(async () => {
    try {
      await getTransporter().sendMail({
        from: process.env.SMTP_FROM || process.env.REPORT_EMAIL_USER || process.env.SMTP_USER,
        to: email,
        subject,
        text: body,
        attachments: [{ filename: "report.pdf", path: filePath, contentType: "application/pdf" }],
      });
    } finally {
      await fs.unlink(filePath).catch(() => {});
    }
  });
}

export const reportDispatchQueue = dispatchQueue;
