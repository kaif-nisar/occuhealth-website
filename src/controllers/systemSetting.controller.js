import { asyncHandler } from "../utils/asyncHandler.js";
import { SystemSetting } from "../models/systemSetting.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// @desc    Get system settings
// @route   GET /api/v1/settings
export const getSettings = asyncHandler(async (req, res) => {
    let settings = await SystemSetting.findOne();
    if (!settings) {
        settings = await SystemSetting.create({ isPaymentGatewayEnabled: true });
    }
    return res.status(200).json(
        new ApiResponse(200, settings, "Settings fetched successfully")
    );
});

// @desc    Toggle Payment Gateway
// @route   PUT /api/v1/settings/toggle-payment-gateway
export const togglePaymentGateway = asyncHandler(async (req, res) => {
    let settings = await SystemSetting.findOne();
    if (!settings) {
        settings = await SystemSetting.create({ isPaymentGatewayEnabled: true });
    }

    settings.isPaymentGatewayEnabled = !settings.isPaymentGatewayEnabled;
    settings.lastUpdatedBy = req.user?.name || req.user?.fullName || req.user?.email || "SuperAdmin";
    settings.lastUpdatedTime = new Date();
    await settings.save();

    return res.status(200).json(
        new ApiResponse(200, settings, `Payment Gateway has been ${settings.isPaymentGatewayEnabled ? 'enabled' : 'disabled'}`)
    );
});
