import crypto from "crypto";
import { newBooking } from "../models/NewBooking.model.js";
import { User } from "../models/user.model.js";
import { NotificationDelivery } from "../models/notificationDelivery.model.js";

export const BOOKING_STATUSES = Object.freeze({
  HOLD: "Hold",
  CLINICAL: "Clinical",
  CANCELLED: "Cancelled",
  PENDING: "Pending",
  COMPLETED: "Completed",
  PARTIALLY_COMPLETED: "Partially Completed",
});

const STATUS_ALIASES = new Map([
  ["hold", BOOKING_STATUSES.HOLD],
  ["on hold", BOOKING_STATUSES.HOLD],
  ["clinical", BOOKING_STATUSES.CLINICAL],
  ["clinical stated", BOOKING_STATUSES.CLINICAL],
  ["cancelled", BOOKING_STATUSES.CANCELLED],
  ["canceled", BOOKING_STATUSES.CANCELLED],
  ["pending", BOOKING_STATUSES.PENDING],
  ["completed", BOOKING_STATUSES.COMPLETED],
  ["partially completed", BOOKING_STATUSES.PARTIALLY_COMPLETED],
  ["partial completed", BOOKING_STATUSES.PARTIALLY_COMPLETED],
]);

const REASON_REQUIRED = new Set([
  BOOKING_STATUSES.HOLD,
  BOOKING_STATUSES.CLINICAL,
  BOOKING_STATUSES.CANCELLED,
]);

export function normalizeBookingStatus(value) {
  const normalized = STATUS_ALIASES.get(String(value || "").trim().toLowerCase());
  if (!normalized) throw new Error("Unsupported booking status");
  return normalized;
}

function sameId(left, right) {
  return Boolean(left && right && String(left) === String(right));
}

async function canAccessBooking(actor, booking) {
  const actorId = actor.role === "staff" ? actor.parentUser : actor._id;
  if (!actorId) return false;
  if (actor.role === "admin" || (actor.role === "staff" && actor.parentRole === "admin")) return true;
  if (sameId(actorId, booking.createdBy)) return true;

  let current = await User.findById(booking.createdBy).select("parentUser").lean();
  const visited = new Set();
  while (current?.parentUser && !visited.has(String(current.parentUser))) {
    if (sameId(current.parentUser, actorId)) return true;
    visited.add(String(current.parentUser));
    current = await User.findById(current.parentUser).select("parentUser").lean();
  }
  return false;
}

async function getRecipients(booking) {
  const owner = await User.findById(booking.createdBy).select("_id email phoneNumber phoneNo emailVerified phoneVerified parentUser notificationPreferences emailNotificationEnabled whatsappNotificationEnabled whatsappOptIn").lean();
  if (!owner) return [];
  const recipients = [owner];
  let parent = owner;
  const visited = new Set([String(owner._id)]);
  while (parent?.parentUser && !visited.has(String(parent.parentUser))) {
    const parentUser = await User.findById(parent.parentUser).select("_id email phoneNumber phoneNo emailVerified phoneVerified parentUser notificationPreferences emailNotificationEnabled whatsappNotificationEnabled whatsappOptIn").lean();
    if (!parentUser) break;
    recipients.push(parentUser);
    visited.add(String(parentUser._id));
    parent = parentUser;
  }
  return [...new Map(recipients.map((recipient) => [String(recipient._id), recipient])).values()];
}

function buildDelivery(booking, history, recipient, channel) {
  const idempotencyKey = `${booking.bookingId}:${history._id}:${channel}:${recipient._id}`;
  const phone = recipient.phoneNumber || (recipient.phoneNo ? String(recipient.phoneNo) : "");
  const payload = {
    bookingId: booking.bookingId,
    patientName: booking.patientName,
    previousStatus: history.previousStatus,
    newStatus: history.newStatus,
    reason: history.reason,
    changedBy: String(history.changedBy),
    changedAt: history.changedAt,
  };
  return {
    tenantId: booking.tenantId,
    bookingId: booking.bookingId,
    statusHistoryId: history._id,
    recipientUserId: recipient._id,
    recipientPhone: phone,
    recipientEmail: recipient.email,
    eventType: "booking_status_changed",
    channel,
    templateName: channel === "whatsapp" ? `booking_${history.newStatus.toLowerCase()}` : "booking_status_changed",
    payload,
    idempotencyKey,
  };
}

export async function enqueueStatusDeliveries(booking, history) {
  const deliveries = [];
  for (const recipient of await getRecipients(booking)) {
    const emailEnabled = recipient.emailVerified && recipient.emailNotificationEnabled !== false;
    const whatsapp = recipient.notificationPreferences?.whatsapp || {};
    const whatsappEnabled = recipient.phoneVerified && (recipient.whatsappOptIn || whatsapp.userOptIn) && whatsapp.adminPolicy !== "disabled" && recipient.whatsappNotificationEnabled !== false;
    if (emailEnabled && recipient.email) deliveries.push(buildDelivery(booking, history, recipient, "email"));
    if (whatsappEnabled) deliveries.push(buildDelivery(booking, history, recipient, "whatsapp"));
  }
  if (deliveries.length) await NotificationDelivery.insertMany(deliveries, { ordered: false });
  return deliveries;
}

export async function transitionBookingStatus({ bookingId, tenantId, actor, status, reason = "", requestId = crypto.randomUUID(), session }) {
  const newStatus = normalizeBookingStatus(status);
  const normalizedReason = String(reason || "").trim();
  if (REASON_REQUIRED.has(newStatus) && !normalizedReason) {
    const error = new Error(`${newStatus} reason is required`);
    error.statusCode = 400;
    throw error;
  }

  const query = { bookingId, tenantId };
  const booking = await newBooking.findOne(query).session(session || null);
  if (!booking) {
    const error = new Error("Booking not found");
    error.statusCode = 404;
    throw error;
  }
  if (!(await canAccessBooking(actor, booking))) {
    const error = new Error("You are not authorized to update this booking");
    error.statusCode = 403;
    throw error;
  }
  const previousStatus = normalizeBookingStatus(booking.status);
  if (previousStatus === newStatus) return { booking, changed: false, deliveries: [] };

  const history = {
    previousStatus,
    newStatus,
    reason: normalizedReason || "Status updated",
    changedBy: actor._id,
    changedByRole: actor.role,
    changedAt: new Date(),
    requestId,
  };
  booking.status = newStatus === BOOKING_STATUSES.CANCELLED ? "cancelled" : newStatus;
  booking.statusHistory.push(history);
  if (newStatus === BOOKING_STATUSES.CANCELLED) {
    booking.cancelledAt = history.changedAt;
    booking.cancelledBy = actor._id;
    booking.cancellationReason = history.reason;
  }
  await booking.save({ session });

  const savedHistory = booking.statusHistory[booking.statusHistory.length - 1];
  let deliveries = [];
  try {
    deliveries = await enqueueStatusDeliveries(booking, savedHistory);
  } catch (notificationError) {
    console.error("Status notification enqueue failed:", notificationError.message);
  }
  return { booking, changed: true, deliveries };
}
