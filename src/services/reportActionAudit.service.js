import mongoose from "mongoose";
import { newBooking } from "../models/NewBooking.model.js";
import { reports } from "../models/reportData.model.js";

/**
 * reportActionAudit.service.js
 * ---------------------------------------------------------------------------
 * Single source of truth for action button tracking & sign-off audit trail
 * across Enter Result (labreport), Report Format (reportFormat) and All Cases.
 *
 * Tracks:
 *  - Who clicked (name, userId, role)
 *  - When clicked (timestamp)
 *  - How many times clicked (per-button count & total history)
 *  - Sign-off audit trail specifically for case status verification
 */

const MAX_HISTORY_ENTRIES = 50;

const resolveAuditActor = (user) => {
    const role = user?.role || null;
    const isStaff = role === "staff";
    const actorId = isStaff ? (user?.parentUser || user?._id) : user?._id;
    const name =
        user?.fullName ||
        user?.username ||
        user?.email ||
        (actorId ? String(actorId) : "Unknown user");

    return {
        userId: actorId && mongoose.Types.ObjectId.isValid(actorId) ? actorId : null,
        name: String(name).trim(),
        role: String(role || "user")
    };
};

/**
 * Records a button click or workflow action against a booking / report.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.tenantId
 * @param {string} params.bookingId
 * @param {string|ObjectId} [params.reportId]
 * @param {Object} params.user
 * @param {string} params.action - e.g. "SIGN_OFF", "FINAL", "SAVE_ONLY", "DOWNLOAD_PDF", "SAVE_PDF", "ENTER_RESULT", "BROWSER_PRINT", "SEND_REPORT", "PRINT_SETTINGS", etc.
 * @param {string} params.buttonId - e.g. "signOff", "finalBtn", "saveBtn", "downloadPDF", "savePDF", etc.
 * @param {string} [params.buttonLabel]
 * @param {Object} [params.details] - extra context (e.g. { signoff: true })
 *
 * @returns {Promise<Object|null>} Updated actionAudit (lean) or null on failure.
 */
const recordButtonActionAudit = async ({
    tenantId,
    bookingId,
    reportId,
    user,
    action,
    buttonId,
    buttonLabel,
    details = {}
} = {}) => {
    try {
        const normalizedBookingId = String(bookingId || "").trim();
        const normalizedAction = String(action || buttonId || "ACTION").trim().toUpperCase();
        const normalizedButtonId = String(buttonId || action || "action").trim();
        const normalizedButtonLabel = String(buttonLabel || buttonId || action || "").trim();

        if (!normalizedBookingId) {
            return null;
        }

        const actor = resolveAuditActor(user);
        const timestamp = new Date();

        const historyEntry = {
            action: normalizedAction,
            buttonId: normalizedButtonId,
            buttonLabel: normalizedButtonLabel,
            user: actor.name,
            userId: actor.userId,
            role: actor.role,
            timestamp,
            details: details || {}
        };

        const isSignOffAction =
            normalizedAction === "SIGN_OFF" ||
            normalizedButtonId === "signOff" ||
            typeof details?.signoff === "boolean";

        const isSignedOff = isSignOffAction
            ? (details?.signoff !== undefined ? Boolean(details.signoff) : true)
            : undefined;

        // -------------------------------------------------------------
        // 1. Update `reports` collection
        // -------------------------------------------------------------
        let reportQuery = { bookingId: normalizedBookingId };
        if (tenantId) {
            reportQuery.tenantId = tenantId;
        }

        const reportSetFields = {
            [`actionAudit.buttons.${normalizedButtonId}.lastClickedBy`]: actor.name,
            [`actionAudit.buttons.${normalizedButtonId}.lastClickedById`]: actor.userId,
            [`actionAudit.buttons.${normalizedButtonId}.lastClickedByRole`]: actor.role,
            [`actionAudit.buttons.${normalizedButtonId}.lastClickedAt`]: timestamp,
            [`actionAudit.buttons.${normalizedButtonId}.buttonLabel`]: normalizedButtonLabel,
            [`actionAudit.lastAction`]: normalizedAction,
            [`actionAudit.lastActionBy`]: actor.name,
            [`actionAudit.lastActionAt`]: timestamp,
        };

        if (isSignOffAction) {
            reportSetFields["signOff"] = isSignedOff;
            reportSetFields["signedBy"] = isSignedOff ? actor.name : null;
            reportSetFields["signedAt"] = isSignedOff ? timestamp : null;
            reportSetFields["signedById"] = isSignedOff ? actor.userId : null;
            reportSetFields["signedByRole"] = isSignedOff ? actor.role : null;

            reportSetFields["actionAudit.signOff.isSignedOff"] = isSignedOff;
            reportSetFields["actionAudit.signOff.signedBy"] = isSignedOff ? actor.name : null;
            reportSetFields["actionAudit.signOff.signedAt"] = isSignedOff ? timestamp : null;
            reportSetFields["actionAudit.signOff.signedById"] = isSignedOff ? actor.userId : null;
            reportSetFields["actionAudit.signOff.signedByRole"] = isSignedOff ? actor.role : null;
        }

        const reportIncFields = {
            [`actionAudit.buttons.${normalizedButtonId}.count`]: 1,
            [`actionAudit.totalClicks`]: 1
        };

        if (isSignOffAction) {
            reportIncFields["actionAudit.signOff.count"] = 1;
        }

        const reportUpdate = {
            $set: reportSetFields,
            $inc: reportIncFields,
            $push: {
                "actionAudit.history": {
                    $each: [historyEntry],
                    $slice: -MAX_HISTORY_ENTRIES
                }
            }
        };

        let updatedReport = await reports.findOneAndUpdate(
            reportQuery,
            reportUpdate,
            { new: true, projection: { bookingId: 1, actionAudit: 1, signOff: 1, signedBy: 1, signedAt: 1 } }
        ).lean();

        // Fallback without tenantId if not found (for admin / cross-tenant)
        if (!updatedReport && tenantId) {
            updatedReport = await reports.findOneAndUpdate(
                { bookingId: normalizedBookingId },
                reportUpdate,
                { new: true, projection: { bookingId: 1, actionAudit: 1, signOff: 1, signedBy: 1, signedAt: 1 } }
            ).lean();
        }

        // -------------------------------------------------------------
        // 2. Update `newBooking` collection
        // -------------------------------------------------------------
        let bookingQuery = { bookingId: normalizedBookingId };
        if (tenantId) {
            bookingQuery.tenantId = tenantId;
        }

        const bookingSetFields = {
            [`actionAudit.buttons.${normalizedButtonId}.lastClickedBy`]: actor.name,
            [`actionAudit.buttons.${normalizedButtonId}.lastClickedById`]: actor.userId,
            [`actionAudit.buttons.${normalizedButtonId}.lastClickedByRole`]: actor.role,
            [`actionAudit.buttons.${normalizedButtonId}.lastClickedAt`]: timestamp,
            [`actionAudit.buttons.${normalizedButtonId}.buttonLabel`]: normalizedButtonLabel,
            [`actionAudit.lastAction`]: normalizedAction,
            [`actionAudit.lastActionBy`]: actor.name,
            [`actionAudit.lastActionAt`]: timestamp,
        };

        if (isSignOffAction) {
            bookingSetFields["isSignedOff"] = isSignedOff;
            bookingSetFields["signedBy"] = isSignedOff ? actor.name : null;
            bookingSetFields["signedAt"] = isSignedOff ? timestamp : null;

            bookingSetFields["signOffAudit.isSignedOff"] = isSignedOff;
            bookingSetFields["signOffAudit.signedBy"] = isSignedOff ? actor.name : null;
            bookingSetFields["signOffAudit.signedAt"] = isSignedOff ? timestamp : null;
            bookingSetFields["signOffAudit.signedById"] = isSignedOff ? actor.userId : null;
            bookingSetFields["signOffAudit.signedByRole"] = isSignedOff ? actor.role : null;

            bookingSetFields["actionAudit.signOff.isSignedOff"] = isSignedOff;
            bookingSetFields["actionAudit.signOff.signedBy"] = isSignedOff ? actor.name : null;
            bookingSetFields["actionAudit.signOff.signedAt"] = isSignedOff ? timestamp : null;
            bookingSetFields["actionAudit.signOff.signedById"] = isSignedOff ? actor.userId : null;
            bookingSetFields["actionAudit.signOff.signedByRole"] = isSignedOff ? actor.role : null;
        }

        const bookingIncFields = {
            [`actionAudit.buttons.${normalizedButtonId}.count`]: 1,
            [`actionAudit.totalClicks`]: 1
        };

        if (isSignOffAction) {
            bookingIncFields["signOffAudit.count"] = 1;
            bookingIncFields["actionAudit.signOff.count"] = 1;
        }

        const bookingUpdate = {
            $set: bookingSetFields,
            $inc: bookingIncFields,
            $push: {
                "actionAudit.history": {
                    $each: [historyEntry],
                    $slice: -MAX_HISTORY_ENTRIES
                }
            }
        };

        let updatedBooking = await newBooking.findOneAndUpdate(
            bookingQuery,
            bookingUpdate,
            { new: true, projection: { bookingId: 1, actionAudit: 1, signOffAudit: 1, signedBy: 1, signedAt: 1, isSignedOff: 1 } }
        ).lean();

        if (!updatedBooking && tenantId) {
            updatedBooking = await newBooking.findOneAndUpdate(
                { bookingId: normalizedBookingId },
                bookingUpdate,
                { new: true }
            ).lean();
        }
        if (!updatedBooking) {
            updatedBooking = await newBooking.findOneAndUpdate(
                { bookingId: { $regex: new RegExp(`^${normalizedBookingId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
                bookingUpdate,
                { new: true }
            ).lean();
        }

        if (!updatedReport) {
            updatedReport = await reports.findOneAndUpdate(
                { bookingId: { $regex: new RegExp(`^${normalizedBookingId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
                reportUpdate,
                { new: true }
            ).lean();
        }

        const fallbackButtons = {
            [normalizedButtonId]: {
                count: 1,
                lastClickedBy: actor.name,
                lastClickedById: actor.userId,
                lastClickedByRole: actor.role,
                lastClickedAt: timestamp,
                buttonLabel: normalizedButtonLabel
            }
        };

        const resultAudit = updatedReport?.actionAudit || updatedBooking?.actionAudit || {
            buttons: fallbackButtons,
            totalClicks: 1,
            lastAction: normalizedAction,
            lastActionBy: actor.name,
            lastActionAt: timestamp,
            history: [historyEntry],
            signOff: isSignOffAction ? {
                isSignedOff,
                signedBy: isSignedOff ? actor.name : null,
                signedAt: isSignedOff ? timestamp : null
            } : undefined
        };

        const signOffData = updatedBooking?.signOffAudit || (updatedReport ? {
            isSignedOff: Boolean(updatedReport.signOff),
            signedBy: updatedReport.signedBy || (updatedReport.signOff ? actor.name : null),
            signedAt: updatedReport.signedAt || timestamp,
        } : null);

        return {
            buttons: resultAudit.buttons || fallbackButtons,
            history: resultAudit.history || [historyEntry],
            totalClicks: resultAudit.totalClicks || 1,
            actionAudit: resultAudit,
            signOffAudit: signOffData,
            signOff: signOffData,
            lastEntry: historyEntry
        };
    } catch (error) {
        console.error("[action-audit] Failed to record button action audit:", error?.message || error);
        // Fallback response so user action never fails with 500
        return {
            buttons: {},
            history: [],
            totalClicks: 0
        };
    }
};

/**
 * Returns the button action audit for a booking.
 */
const getButtonActionAudit = async ({ tenantId, bookingId } = {}) => {
    try {
        const normalizedBookingId = String(bookingId || "").trim();
        if (!normalizedBookingId) {
            return { buttons: {}, history: [], signOff: null };
        }

        let query = { bookingId: normalizedBookingId };
        if (tenantId) query.tenantId = tenantId;

        let reportDoc = null;
        if (tenantId) {
            reportDoc = await reports.findOne(query).select("actionAudit signOff signedBy signedAt updatedAt").lean();
        }
        if (!reportDoc) {
            reportDoc = await reports.findOne({ bookingId: normalizedBookingId }).select("actionAudit signOff signedBy signedAt updatedAt").lean();
        }
        if (!reportDoc) {
            reportDoc = await reports.findOne({ bookingId: { $regex: new RegExp(`^${normalizedBookingId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }).select("actionAudit signOff signedBy signedAt updatedAt").lean();
        }

        let bookingDoc = null;
        if (tenantId) {
            bookingDoc = await newBooking.findOne(query).select("actionAudit signOffAudit signedBy signedAt isSignedOff updatedAt").lean();
        }
        if (!bookingDoc) {
            bookingDoc = await newBooking.findOne({ bookingId: normalizedBookingId }).select("actionAudit signOffAudit signedBy signedAt isSignedOff updatedAt").lean();
        }
        if (!bookingDoc) {
            bookingDoc = await newBooking.findOne({ bookingId: { $regex: new RegExp(`^${normalizedBookingId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }).select("actionAudit signOffAudit signedBy signedAt isSignedOff updatedAt").lean();
        }

        const actionAudit = bookingDoc?.actionAudit || reportDoc?.actionAudit || { buttons: {}, history: [] };

        let signOffAudit = bookingDoc?.signOffAudit || actionAudit?.signOff || null;
        if (!signOffAudit && (reportDoc?.signedBy || reportDoc?.signOff || bookingDoc?.signedBy || bookingDoc?.isSignedOff)) {
            signOffAudit = {
                isSignedOff: Boolean(reportDoc?.signOff ?? bookingDoc?.isSignedOff),
                signedBy: reportDoc?.signedBy || bookingDoc?.signedBy || "Signed Off",
                signedAt: reportDoc?.signedAt || bookingDoc?.signedAt || reportDoc?.updatedAt || bookingDoc?.updatedAt || null,
                count: 1
            };
        }

        return {
            buttons: actionAudit?.buttons || {},
            history: actionAudit?.history || [],
            totalClicks: actionAudit?.totalClicks || 0,
            actionAudit,
            signOffAudit,
            signOff: signOffAudit,
            signedBy: signOffAudit?.signedBy || null,
            signedAt: signOffAudit?.signedAt || null,
            isSignedOff: Boolean(signOffAudit?.isSignedOff)
        };
    } catch (error) {
        console.error("[action-audit] Failed to fetch button action audit:", error?.message || error);
        return { buttons: {}, history: [], signOff: null };
    }
};

export {
    recordButtonActionAudit,
    getButtonActionAudit,
    resolveAuditActor
};
