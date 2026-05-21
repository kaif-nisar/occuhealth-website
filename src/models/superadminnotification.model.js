// models/notification.model.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    userId: {
        // जिस user को ये notification गया
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false, // optional अगर सिर्फ email हो
    },
    userEmail: {
        type: String,
        required: false,
    },
    message: {
        // Notification content
        type: String,
        required: true,
    },
    relatedBookingId: {
        type: String,
        required: false,
    },
    relatedPlan: {
        type: String,
        required: false,
    },
    type: {
        // For example: info, success, error
        type: String,
        enum: ["info", "success", "warning", "error"],
        default: "info",
    },
    read: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    // Extra field for optional future scheduling
    scheduledFor: {
        type: Date,
        required: false,
    },
    // For tracking if notification was sent via email/SMS etc.
    deliveryStatus: {
        type: String,
        enum: ["pending", "sent", "failed"],
        default: "pending",
    },
});

// Rename model to avoid conflict with regular Notification model
const SuperAdminNotification = mongoose.model("SuperAdminNotification", notificationSchema);

export {
    SuperAdminNotification
}