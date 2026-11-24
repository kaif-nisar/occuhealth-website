/**
 * ============================================================================
 * NABL LOGO SETTINGS CONTROLLER
 * ============================================================================
 * File: src/controllers/nablSettings.controller.js
 * 
 * Purpose:
 * Provides dedicated, modular API controllers for:
 * 1. Fetching current NABL settings and logo URL (GET /api/v1/user/get-nabl-settings)
 * 2. Saving customized NABL layout & position settings (POST /api/v1/user/save-nabl-settings)
 * 3. Direct NABL logo image upload from Print Settings (POST /api/v1/user/upload-nabl-logo)
 * 
 * Keeping this logic in a dedicated controller guarantees zero regressions
 * for other sensitive print settings and user controllers.
 * ============================================================================
 */

import mongoose from 'mongoose';
import { defaultpdfsetting } from '../models/defaultpdfsettings.model.js';
import { User } from '../models/user.model.js';
import { Tenant } from '../models/tenant.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { resolveNablLogoForReport } from '../utils/nablLogoHelper.js';
import {
    sanitizeNablSettings,
    getTenantNablSettings,
    DEFAULT_NABL_SETTINGS
} from '../services/nablLogoSettings.service.js';

/**
 * Safely extracts effective tenantId from req.user
 */
const getTenantIdFromUser = (user) => {
    return user?.tenantId?._id || user?.tenantId || null;
};

/**
 * Controller: Get current NABL settings and active logo URL.
 * Route: GET /api/v1/user/get-nabl-settings
 */
export const getNablSettingsController = async (req, res) => {
    try {
        const tenantId = getTenantIdFromUser(req.user);
        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Tenant context is missing.' });
        }

        // 1. Fetch resolved settings from defaultpdfsetting
        const settings = await getTenantNablSettings(tenantId);

        // 2. Resolve active NABL logo URL
        const nablLogoUrl = await resolveNablLogoForReport({
            tenantId,
            user: req.user
        });

        return res.status(200).json({
            success: true,
            nablLogoUrl: nablLogoUrl || '',
            hasLogo: Boolean(nablLogoUrl),
            settings
        });
    } catch (error) {
        console.error('[nablSettings.controller] Error fetching NABL settings:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve NABL logo settings.',
            error: error.message
        });
    }
};

/**
 * Controller: Save or update NABL logo layout & position settings.
 * Route: POST /api/v1/user/save-nabl-settings
 */
export const saveNablSettingsController = async (req, res) => {
    try {
        const tenantId = getTenantIdFromUser(req.user);
        const createdBy = req.user?.role === 'staff' ? req.user.parentUser : req.user?._id;

        if (!tenantId) {
            return res.status(400).json({ success: false, message: 'Tenant context is missing.' });
        }

        // Sanitize incoming NABL settings strictly
        const sanitized = sanitizeNablSettings(req.body);

        // Find existing record or upsert a new defaultpdfsetting document
        let settingDoc = await defaultpdfsetting.findOne({ tenantId });

        if (!settingDoc) {
            settingDoc = await defaultpdfsetting.create({
                tenantId,
                createdBy,
                nablLogoWidth: sanitized.nablLogoWidth,
                nablLogoHeight: sanitized.nablLogoHeight,
                nablLogoX: sanitized.nablLogoX,
                nablLogoY: sanitized.nablLogoY,
                nablLogoPosition: sanitized.nablLogoPosition,
                nablLogoPageOption: sanitized.nablLogoPageOption,
                nablLogoVisible: sanitized.nablLogoVisible
            });
        } else {
            settingDoc.nablLogoWidth = sanitized.nablLogoWidth;
            settingDoc.nablLogoHeight = sanitized.nablLogoHeight;
            settingDoc.nablLogoX = sanitized.nablLogoX;
            settingDoc.nablLogoY = sanitized.nablLogoY;
            settingDoc.nablLogoPosition = sanitized.nablLogoPosition;
            settingDoc.nablLogoPageOption = sanitized.nablLogoPageOption;
            settingDoc.nablLogoVisible = sanitized.nablLogoVisible;
            await settingDoc.save();
        }

        // Return updated settings
        return res.status(200).json({
            success: true,
            message: 'NABL logo settings saved successfully!',
            settings: sanitized
        });
    } catch (error) {
        console.error('[nablSettings.controller] Error saving NABL settings:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to save NABL logo settings.',
            error: error.message
        });
    }
};

/**
 * Controller: Upload NABL accreditation logo directly from Print Settings.
 * Route: POST /api/v1/user/upload-nabl-logo
 */
export const uploadNablLogoController = async (req, res) => {
    try {
        const tenantId = getTenantIdFromUser(req.user);
        const userId = req.user?.role === 'staff' ? req.user.parentUser : req.user?._id;

        if (!req.file && !req.files?.nablLogo) {
            return res.status(400).json({ success: false, message: 'Please select an image file to upload.' });
        }

        const fileToUpload = req.file || req.files.nablLogo[0];
        const uploadResult = await uploadOnCloudinary(fileToUpload.path);

        if (!uploadResult?.secure_url) {
            return res.status(500).json({ success: false, message: 'Cloudinary upload failed.' });
        }

        const logoUrl = uploadResult.secure_url;
        const publicId = uploadResult.public_id;

        // Persist on User document
        if (userId) {
            await User.findByIdAndUpdate(userId, {
                $set: {
                    nabllogo: logoUrl,
                    nabllogopublicid: publicId
                }
            });
        }

        // Persist on Tenant document
        if (tenantId) {
            await Tenant.findByIdAndUpdate(tenantId, {
                $set: {
                    nabllogo: logoUrl,
                    nabllogopublicid: publicId
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: 'NABL logo uploaded successfully!',
            nablLogoUrl: logoUrl,
            publicId
        });
    } catch (error) {
        console.error('[nablSettings.controller] Error uploading NABL logo:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to upload NABL logo.',
            error: error.message
        });
    }
};

