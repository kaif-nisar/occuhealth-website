import mongoose from "mongoose";

const notificationDeliverySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  bookingId: { type: String, required: true, index: true },
  statusHistoryId: { type: mongoose.Schema.Types.ObjectId, required: true },
  recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recipientPhone: String,
  recipientEmail: String,
  eventType: { type: String, required: true },
  channel: { type: String, enum: ["email", "whatsapp", "sms"], required: true },
  templateName: String,
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  idempotencyKey: { type: String, required: true, unique: true },
  status: { type: String, enum: ["queued", "retrying", "sent", "delivered", "read", "failed"], default: "queued", index: true },
  providerMessageId: String,
  attempts: { type: Number, default: 0 },
  lastError: String,
  queuedAt: { type: Date, default: Date.now },
  sentAt: Date,
  deliveredAt: Date,
  readAt: Date,
}, { timestamps: true });

notificationDeliverySchema.index({ tenantId: 1, bookingId: 1, createdAt: -1 });
notificationDeliverySchema.index({ status: 1, queuedAt: 1 });

export const NotificationDelivery = mongoose.models.NotificationDelivery || mongoose.model("NotificationDelivery", notificationDeliverySchema);