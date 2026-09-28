import { asyncHandler } from "../utils/asyncHandler.js";
import {
    getReportPrintAudit,
    recordReportPrintAudit
} from "../services/reportPrintAudit.service.js";

/**
 * printAudit.controller.js
 * ---------------------------------------------------------------------------
 * Read (and explicit write) endpoints for the report print / download audit
 * trail that lives on the booking document (`booking.printAudit`).
 *
 * These endpoints are additive — no existing endpoint or payload changes.
 */

const resolveTenantId = (req) => req.user?.tenantId?._id || req.user?.tenantId || null;

const resolveBookingId = (req) =>
    String(
        req.params?.bookingId ||
        req.body?.bookingId ||
        req.body?.value1 ||
        req.query?.bookingId ||
        ""
    ).trim();

/**
 * GET /api/v1/user/print-audit/:bookingId
 * Returns the complete (bounded) history for a booking. Legacy bookings
 * without the field return a safe, empty audit object.
 */
const getReportPrintAuditController = asyncHandler(async (req, res) => {
    const bookingId = resolveBookingId(req);
    const tenantId = resolveTenantId(req);

    if (!bookingId) {
        return res.status(400).json({
            success: false,
            message: "bookingId is required"
        });
    }

    const { found, booking, printAudit } = await getReportPrintAudit({ tenantId, bookingId });

    return res.status(200).json({
        success: true,
        found,
        bookingId,
        booking,
        printAudit
    });
});

/**
 * POST /api/v1/user/print-audit
 * Records an explicit PRINT / DOWNLOAD event. Used by the UI for browser
 * print flows that never round-trip through the PDF generator.
 * Body: { bookingId, action: 'PRINT' | 'DOWNLOAD' }
 */
const recordReportPrintAuditController = asyncHandler(async (req, res) => {
    const bookingId = resolveBookingId(req);
    const tenantId = resolveTenantId(req);
    const action = String(req.body?.action || "DOWNLOAD").trim().toUpperCase() === "PRINT" ? "PRINT" : "DOWNLOAD";

    if (!bookingId) {
        return res.status(400).json({
            success: false,
            message: "bookingId is required"
        });
    }

    const printAudit = await recordReportPrintAudit({
        tenantId,
        bookingId,
        reportId: req.body?.reportId || null,
        user: req.user,
        action
    });

    return res.status(200).json({
        success: Boolean(printAudit),
        bookingId,
        action,
        printAudit
    });
});

export {
    getReportPrintAuditController,
    recordReportPrintAuditController
};
