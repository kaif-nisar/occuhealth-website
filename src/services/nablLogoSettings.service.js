/**
 * ============================================================================
 * NABL LOGO SETTINGS SERVICE
 * ============================================================================
 * File: src/services/nablLogoSettings.service.js
 * 
 * Purpose:
 * Provides isolated, robust, production-grade business logic, validation,
 * coordinate calculation, and persistence helpers for customizable NABL logo
 * positioning and sizing on diagnostic lab reports / PDFs.
 * 
 * Features Supported:
 * 1. Custom logo sizing (width, height in mm)
 * 2. Custom logo positioning (X, Y offsets from top/left margins in mm)
 * 3. Position presets: 'top-right', 'top-left', 'top-center', 'bottom-right', 'bottom-left', 'custom'
 * 4. Multi-page options: 'all-pages' (default) or 'first-page'
 * 5. High-precision coordinate conversion between UI (mm) and PDF-lib points (pt)
 * 6. Non-distortion aspect-ratio fitting and boundary clamping
 * ============================================================================
 */

import { defaultpdfsetting } from '../models/defaultpdfsettings.model.js';

// Standard A4 Paper Dimensions in Millimeters
export const A4_PAGE_WIDTH_MM = 210;
export const A4_PAGE_HEIGHT_MM = 297;

// Conversion factor: 1 inch = 25.4 mm, 1 inch = 72 PDF points (DPI 72 standard)
export const PDF_POINTS_PER_MM = 72 / 25.4; // approx 2.83464567 pt/mm

// Default Accreditation Badge Dimension & Coordinates (Safe Defaults)
export const DEFAULT_NABL_SETTINGS = Object.freeze({
    nablLogoWidth: 30,         // Width in mm (~85 pt)
    nablLogoHeight: 18,        // Height in mm (~50 pt)
    nablLogoX: 170,            // X in mm from left edge (Top-Right: 210 - 30 - 10 = 170mm)
    nablLogoY: 5,              // Y in mm from top edge
    nablLogoPosition: 'top-right', // Preset name
    nablLogoPageOption: 'all-pages', // 'all-pages' or 'first-page'
    nablLogoVisible: true      // Visibility toggle
});

/**
 * Validates, bounds-checks, and sanitizes user-provided NABL logo settings.
 * Ensures that values cannot cause crashes, overflows, or draw off-screen.
 * 
 * @param {Object} input - Raw settings from request body or query
 * @returns {Object} Sanitized settings object
 */
export function sanitizeNablSettings(input = {}) {
    if (!input || typeof input !== 'object') {
        return { ...DEFAULT_NABL_SETTINGS };
    }

    // Parse and clamp dimensions (Width: 5mm to 100mm, Height: 5mm to 80mm)
    let width = Number(input.nablLogoWidth);
    if (!Number.isFinite(width) || width < 5 || width > 100) {
        width = DEFAULT_NABL_SETTINGS.nablLogoWidth;
    }

    let height = Number(input.nablLogoHeight);
    if (!Number.isFinite(height) || height < 5 || height > 80) {
        height = DEFAULT_NABL_SETTINGS.nablLogoHeight;
    }

    // Parse and clamp X & Y offsets (X: 0 to 210 - width, Y: 0 to 297 - height)
    let x = Number(input.nablLogoX);
    if (!Number.isFinite(x) || x < 0 || x > A4_PAGE_WIDTH_MM) {
        x = DEFAULT_NABL_SETTINGS.nablLogoX;
    }

    let y = Number(input.nablLogoY);
    if (!Number.isFinite(y) || y < 0 || y > A4_PAGE_HEIGHT_MM) {
        y = DEFAULT_NABL_SETTINGS.nablLogoY;
    }

    // Preset identifier
    const validPositions = ['top-right', 'top-left', 'top-center', 'bottom-right', 'bottom-left', 'custom'];
    const position = validPositions.includes(input.nablLogoPosition) ? input.nablLogoPosition : 'custom';

    // Page target option
    const pageOption = input.nablLogoPageOption === 'first-page' ? 'first-page' : 'all-pages';

    // Visibility flag
    const visible = input.nablLogoVisible !== false && input.nablLogoVisible !== 'false';

    return {
        nablLogoWidth: Math.round(width * 10) / 10,
        nablLogoHeight: Math.round(height * 10) / 10,
        nablLogoX: Math.round(x * 10) / 10,
        nablLogoY: Math.round(y * 10) / 10,
        nablLogoPosition: position,
        nablLogoPageOption: pageOption,
        nablLogoVisible: visible
    };
}

/**
 * Calculates preset X and Y coordinates (in mm) based on chosen position preset.
 * 
 * @param {string} preset - 'top-right', 'top-left', 'top-center', 'bottom-right', 'bottom-left'
 * @param {number} widthMm - Logo width in mm
 * @param {number} heightMm - Logo height in mm
 * @param {number} marginMm - Edge safety margin in mm (default: 8mm)
 * @returns {{ x: number, y: number }} Computed X and Y offsets in mm
 */
export function calculatePresetCoordinates(preset, widthMm, heightMm, marginMm = 8) {
    const safeMargin = Math.max(2, Math.min(20, marginMm));
    const safeWidth = Math.max(5, Math.min(100, widthMm));
    const safeHeight = Math.max(5, Math.min(80, heightMm));

    switch (preset) {
        case 'top-left':
            return {
                x: safeMargin,
                y: safeMargin
            };
        case 'top-center':
            return {
                x: Math.round(((A4_PAGE_WIDTH_MM - safeWidth) / 2) * 10) / 10,
                y: safeMargin
            };
        case 'bottom-left':
            return {
                x: safeMargin,
                y: Math.max(0, A4_PAGE_HEIGHT_MM - safeHeight - safeMargin)
            };
        case 'bottom-right':
            return {
                x: Math.max(0, A4_PAGE_WIDTH_MM - safeWidth - safeMargin),
                y: Math.max(0, A4_PAGE_HEIGHT_MM - safeHeight - safeMargin)
            };
        case 'top-right':
        default:
            return {
                x: Math.max(0, A4_PAGE_WIDTH_MM - safeWidth - safeMargin),
                y: safeMargin
            };
    }
}

/**
 * Computes exact rendering dimensions and coordinates in PDF-lib point space.
 * 
 * Note on PDF-lib coordinates:
 * - (0, 0) is at the BOTTOM-LEFT corner of the page.
 * - X increases from left to right.
 * - Y increases from bottom to top.
 * - UI values are given from the TOP-LEFT corner (xFromLeft, yFromTop).
 * 
 * @param {Object} params
 * @param {number} params.pagePtWidth - Actual width of PDF page in points
 * @param {number} params.pagePtHeight - Actual height of PDF page in points
 * @param {number} params.imgRawWidth - Native image pixel width
 * @param {number} params.imgRawHeight - Native image pixel height
 * @param {Object} params.settings - Sanitized NABL settings
 * @returns {{ x: number, y: number, width: number, height: number, shouldDraw: boolean }}
 */
export function computePdfLogoPlacement({ pagePtWidth, pagePtHeight, imgRawWidth, imgRawHeight, settings }) {
    if (!settings?.nablLogoVisible) {
        return { x: 0, y: 0, width: 0, height: 0, shouldDraw: false };
    }

    // 1. Target bounding box in PDF points
    const targetBoxWidthPt = (settings.nablLogoWidth || DEFAULT_NABL_SETTINGS.nablLogoWidth) * PDF_POINTS_PER_MM;
    const targetBoxHeightPt = (settings.nablLogoHeight || DEFAULT_NABL_SETTINGS.nablLogoHeight) * PDF_POINTS_PER_MM;

    // 2. Preserve image aspect ratio inside target box
    let renderWidth = targetBoxWidthPt;
    let renderHeight = targetBoxHeightPt;
    if (imgRawWidth > 0 && imgRawHeight > 0) {
        const scale = Math.min(targetBoxWidthPt / imgRawWidth, targetBoxHeightPt / imgRawHeight);
        renderWidth = Math.round(imgRawWidth * scale);
        renderHeight = Math.round(imgRawHeight * scale);
    }

    // 3. Convert X (left) and Y (top) from millimeters to PDF points
    const xOffsetPt = (settings.nablLogoX ?? DEFAULT_NABL_SETTINGS.nablLogoX) * PDF_POINTS_PER_MM;
    const yOffsetFromTopPt = (settings.nablLogoY ?? DEFAULT_NABL_SETTINGS.nablLogoY) * PDF_POINTS_PER_MM;

    // 4. Translate Y to PDF-lib coordinate space: y = pageHeight - renderHeight - yOffsetFromTop
    const pdfLibX = xOffsetPt;
    const pdfLibY = pagePtHeight - renderHeight - yOffsetFromTopPt;

    // 5. Clamping to ensure image stays strictly within page boundaries
    const clampedX = Math.max(0, Math.min(pagePtWidth - renderWidth, pdfLibX));
    const clampedY = Math.max(0, Math.min(pagePtHeight - renderHeight, pdfLibY));

    return {
        x: Math.round(clampedX),
        y: Math.round(clampedY),
        width: Math.round(renderWidth),
        height: Math.round(renderHeight),
        shouldDraw: true
    };
}

/**
 * Retrieve saved NABL settings for a given tenant from defaultpdfsetting collection.
 * 
 * @param {string|mongoose.Types.ObjectId} tenantId - Tenant ID
 * @returns {Promise<Object>} Clean NABL settings object
 */
export async function getTenantNablSettings(tenantId) {
    try {
        if (!tenantId) return { ...DEFAULT_NABL_SETTINGS };

        const settingDoc = await defaultpdfsetting.findOne({ tenantId })
            .select('nablLogoWidth nablLogoHeight nablLogoX nablLogoY nablLogoPosition nablLogoPageOption nablLogoVisible')
            .lean();

        if (!settingDoc) {
            return { ...DEFAULT_NABL_SETTINGS };
        }

        return sanitizeNablSettings({
            nablLogoWidth: settingDoc.nablLogoWidth,
            nablLogoHeight: settingDoc.nablLogoHeight,
            nablLogoX: settingDoc.nablLogoX,
            nablLogoY: settingDoc.nablLogoY,
            nablLogoPosition: settingDoc.nablLogoPosition,
            nablLogoPageOption: settingDoc.nablLogoPageOption,
            nablLogoVisible: settingDoc.nablLogoVisible
        });
    } catch (err) {
        console.warn('[nablLogoSettings.service] Error retrieving NABL settings:', err.message || err);
        return { ...DEFAULT_NABL_SETTINGS };
    }
}

