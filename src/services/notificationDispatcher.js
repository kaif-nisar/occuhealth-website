import nodemailer from "nodemailer";
import { NotificationDelivery } from "../models/notificationDelivery.model.js";

const MAX_ATTEMPTS = Math.max(1, Number(process.env.NOTIFICATION_MAX_ATTEMPTS || 5));

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function formatMessage(payload) {
  return [
    "Booking Status Update",
    `Booking ID: ${payload.bookingId}`,
    `Patient: ${payload.patientName || ""}`,
    `Previous Status: ${payload.previousStatus}`,
    `New Status: ${payload.newStatus}`,
    `Reason: ${payload.reason}`,
    `Changed At: ${payload.changedAt}`,
  ].join("\n");
}

async function sendEmail(delivery) {
  const transporter = getTransporter();
  if (!transporter) throw new Error("SMTP is not configured");
  const message = formatMessage(delivery.payload);
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: delivery.recipientEmail,
    subject: `Booking ${delivery.payload.bookingId} status updated`,
    text: message,
  });
  return info.messageId;
}

async function sendWhatsApp(delivery) {
  if ((process.env.WHATSAPP_ENABLED || "false").toLowerCase() !== "true") throw new Error("WhatsApp notifications are disabled");
  if (process.env.WHATSAPP_PROVIDER !== "meta") throw new Error("Unsupported WhatsApp provider");
  const response = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: delivery.recipientPhone,
      type: "template",
      template: {
        name: delivery.templateName,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US" },
        components: [{ type: "body", parameters: [
          { type: "text", text: String(delivery.payload.bookingId) },
          { type: "text", text: String(delivery.payload.patientName || "") },
          { type: "text", text: String(delivery.payload.previousStatus) },
          { type: "text", text: String(delivery.payload.newStatus) },
          { type: "text", text: String(delivery.payload.reason) },
          { type: "text", text: String(delivery.payload.changedBy || "") },
          { type: "text", text: String(delivery.payload.changedAt || "") },
        ] }],
      },
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "WhatsApp provider request failed");
  return result.messages?.[0]?.id || null;
}

export async function dispatchNotificationDelivery(delivery) {
  const providerMessageId = delivery.channel === "email" ? await sendEmail(delivery) : await sendWhatsApp(delivery);
  await NotificationDelivery.updateOne({ _id: delivery._id }, { $set: { status: "sent", providerMessageId, sentAt: new Date(), lastError: null }, $inc: { attempts: 1 } });
}

export async function processPendingNotificationDeliveries(limit = 25) {
  const deliveries = await NotificationDelivery.find({ status: { $in: ["queued", "retrying"] }, attempts: { $lt: MAX_ATTEMPTS } }).sort({ queuedAt: 1 }).limit(limit);
  for (const delivery of deliveries) {
    try {
      await dispatchNotificationDelivery(delivery);
    } catch (error) {
      const attempts = (delivery.attempts || 0) + 1;
      await NotificationDelivery.updateOne({ _id: delivery._id }, { $set: { status: attempts >= MAX_ATTEMPTS ? "failed" : "retrying", lastError: error.message }, $inc: { attempts: 1 } });
    }
  }
}

export function startNotificationDispatcher() {
  const intervalMs = Math.max(5000, Number(process.env.NOTIFICATION_POLL_INTERVAL_MS || 15000));
  return setInterval(() => processPendingNotificationDeliveries().catch((error) => console.error("Notification dispatcher error:", error.message)), intervalMs);
}

export async function handleWhatsAppWebhook(req, res) {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(req.query["hub.challenge"]);
  }
  if (req.query["hub.mode"]) return res.sendStatus(403);

  const changes = req.body?.entry?.flatMap((entry) => entry.changes || []) || [];
  for (const change of changes) {
    for (const status of change.value?.statuses || []) {
      const state = status.status === "read" ? "read" : status.status === "delivered" ? "delivered" : status.status === "sent" ? "sent" : status.status === "failed" ? "failed" : null;
      if (!state) continue;
      const update = { status: state, providerMessageId: status.id };
      if (state === "delivered") update.deliveredAt = new Date();
      if (state === "read") update.readAt = new Date();
      if (state === "failed") update.lastError = status.errors?.map((error) => error.title || error.message).join(", ") || "WhatsApp delivery failed";
      await NotificationDelivery.updateOne({ providerMessageId: status.id }, { $set: update });
    }
  }
  return res.sendStatus(200);
}
