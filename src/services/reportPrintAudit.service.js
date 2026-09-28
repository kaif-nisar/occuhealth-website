import mongoose from "mongoose";
import { newBooking } from "../models/NewBooking.model.js";

/**
 * reportPrintAudit.service.js
 * ---------------------------------------------------------------------------
 * Single source of truth for the report print / download audit trail that is
 * embedded on every booking document (`booking.printAudit`).
 *
 * Design rules:
 *  - Never throw. Auditing must NEVER break report generation or downloads.
 *  - Never assume the field exists. Legacy bookings have no `printAudit` at
 *    all, so all reads are null/undefined safe.
 *  - Bounded history: only the most recent MAX_HISTORY_ENTRIES entries are
 *    kept so a booking document can never grow unbounded.
 */

const MAX_HISTORY_ENTRIES = 50;
const AUDIT_ACTIONS = ["PRINT", "DOWNLOAD"];

const normalizeAction = (value) => {
    const raw = String(value ?? "").trim().toUpperCase();
    return AUDIT_ACTIONS.includes(raw) ? raw : "DOWNLOAD";
};

/**
 * Resolves the acting user for the audit entry.
 * Staff users always act on behalf of their parent portal, mirroring the rest
 * of the codebase (e.g. getpdfcontroller uses `parentUser` for staff).
 */
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
        name: String(name),
        role
    };
};

/**
 * Records a PRINT / DOWNLOAD event against a booking.
 *
 * @returns {Promise<object|null>} Updated printAudit (lean) or null on failure.
 */
const recordReportPrintAudit = async ({ tenantId, bookingId, reportId, user, action } = {}) => {
    try {
        const normalizedBookingId = String(bookingId || "").trim();
        if (!normalizedBookingId || !tenantId) {
            return null;
        }

        const actor = resolveAuditActor(user);
        const normalizedAction = normalizeAction(action);
        const timestamp = new Date();

        const entry = {
            action: normalizedAction,
            user: actor.name,
            userId: actor.userId,
            role: actor.role,
            reportId: reportId ? String(reportId) : null,
            bookingId: normalizedBookingId,
            timestamp
        };

        const update = {
            $set: {
                "printAudit.isPrinted": true,
                "printAudit.printedBy": actor.name,
                "printAudit.printedById": actor.userId,
                "printAudit.printedByRole": actor.role,
                "printAudit.printedAt": timestamp,
                "printAudit.lastAction": normalizedAction,
                "printAudit.lastReportId": entry.reportId
            },
            $inc: { "printAudit.printCount": 1 },
            $push: {
                "printAudit.history": {
                    $each: [entry],
                    $slice: -MAX_HISTORY_ENTRIES
                }
            }
        };

        const updated = await newBooking
            .findOneAndUpdate(
                { tenantId, bookingId: normalizedBookingId },
                update,
                { new: true, projection: { bookingId: 1, printAudit: 1 } }
            )
            .lean();

        return updated?.printAudit || null;
    } catch (error) {
        console.error("[print-audit] Failed to record audit entry:", error?.message || error);
        return null;
    }
};


/**
 * Records the same audit entry for multiple bookings (used by merge-pdfs).
 * `reportIds` is index aligned with `bookingIds`.
 */
const recordReportPrintAuditForMany = async ({ tenantId, bookingIds = [], reportIds = [], user, action } = {}) => {
    const uniqueBookingIds = [...new Set((bookingIds || []).map((id) => String(id || "").trim()).filter(Boolean))];
    const results = [];

    for (let index = 0; index < uniqueBookingIds.length; index += 1) {
        results.push(
            await recordReportPrintAudit({
                tenantId,
                bookingId: uniqueBookingIds[index],
                reportId: reportIds[index] || null,
                user,
                action
            })
        );
    }

    return results;
};

/**
 * Returns the (safe) audit trail for a single booking.
 * Never throws — returns an empty, well-formed audit for legacy bookings.
 */
const getReportPrintAudit = async ({ tenantId, bookingId } = {}) => {
    const emptyAudit = {
        isPrinted: false,
        printedBy: null,
        printedById: null,
        printedByRole: null,
        printedAt: null,
        lastAction: null,
        lastReportId: null,
        printCount: 0,
        history: []
    };

    try {
        const normalizedBookingId = String(bookingId || "").trim();
        if (!normalizedBookingId) {
            return { found: false, booking: null, printAudit: emptyAudit };
        }

        const query = { bookingId: normalizedBookingId };
        if (tenantId) {
            query.tenantId = tenantId;
        }

        const booking = await newBooking
            .findOne(query)
            .select("bookingId patientName status printAudit")
            .lean();

        if (!booking) {
            return { found: false, booking: null, printAudit: emptyAudit };
        }

        const audit = booking.printAudit && typeof booking.printAudit === "object" ? booking.printAudit : {};

        return {
            found: true,
            booking: {
                bookingId: booking.bookingId,
                patientName: booking.patientName,
                status: booking.status
            },
            printAudit: {
                ...emptyAudit,
                ...audit,
                isPrinted: Boolean(audit.isPrinted || audit.printedAt),
                printCount: Number(audit.printCount || (Array.isArray(audit.history) ? audit.history.length : 0) || 0),
                history: Array.isArray(audit.history) ? audit.history.slice(-MAX_HISTORY_ENTRIES) : []
            }
        };
    } catch (error) {
        console.error("[print-audit] Failed to read audit entry:", error?.message || error);
        return { found: false, booking: null, printAudit: emptyAudit };
    }
};

export {
    MAX_HISTORY_ENTRIES,
    recordReportPrintAudit,
    recordReportPrintAuditForMany,
    getReportPrintAudit
};
