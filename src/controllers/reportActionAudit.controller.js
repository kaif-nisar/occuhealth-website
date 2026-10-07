import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
    recordButtonActionAudit,
    getButtonActionAudit
} from "../services/reportActionAudit.service.js";

const recordActionAuditController = asyncHandler(async (req, res) => {
    const { bookingId, reportId, action, buttonId, buttonLabel, details } = req.body;

    const normalizedBookingId = String(bookingId || "").trim();
    if (!normalizedBookingId) {
        throw new ApiError(400, "bookingId is required for action audit recording");
    }

    const tenantId = req.user.tenantId?._id || req.user.tenantId;

    const result = await recordButtonActionAudit({
        tenantId,
        bookingId: normalizedBookingId,
        reportId,
        user: req.user,
        action,
        buttonId,
        buttonLabel,
        details
    });

    return res.status(200).json(
        new ApiResponse(200, result || {}, "Button action audit recorded successfully")
    );
});

const getActionAuditController = asyncHandler(async (req, res) => {
    const bookingId = req.params.bookingId || req.query.bookingId;
    const normalizedBookingId = String(bookingId || "").trim();

    if (!normalizedBookingId) {
        throw new ApiError(400, "bookingId is required");
    }

    const tenantId = req.user.tenantId?._id || req.user.tenantId;

    const auditData = await getButtonActionAudit({
        tenantId,
        bookingId: normalizedBookingId
    });

    return res.status(200).json(
        new ApiResponse(200, auditData, "Action audit retrieved successfully")
    );
});

export {
    recordActionAuditController,
    getActionAuditController
};
