import mongoose from 'mongoose';
import fetch from 'node-fetch';
import { PDFDocument } from 'pdf-lib';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { User } from '../models/user.model.js';
import { Tenant } from '../models/tenant.model.js';
import { reports } from '../models/reportData.model.js';
import { newBooking } from '../models/NewBooking.model.js';
import {
    sanitizeNablSettings,
    computePdfLogoPlacement,
    DEFAULT_NABL_SETTINGS
} from '../services/nablLogoSettings.service.js';

// In-memory cache for NABL logo buffers to avoid downloading the same image repeatedly
const nablLogoBufferCache = new Map();

/**
 * Fetch raw image buffer from an HTTP(S) URL or Data URI with in-memory caching.
 */
export async function fetchNablLogoBuffer(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed) return null;

    if (nablLogoBufferCache.has(trimmed)) {
        return nablLogoBufferCache.get(trimmed);
    }

    try {
        let buffer = null;
        if (trimmed.startsWith('data:image/')) {
            const commaIndex = trimmed.indexOf(',');
            buffer = commaIndex !== -1 ? Buffer.from(trimmed.slice(commaIndex + 1), 'base64') : null;
        } else {
            const response = await fetch(trimmed, { timeout: 15000 });
            if (!response.ok) {
                console.warn(`[nablLogoHelper] Failed to fetch NABL logo from ${trimmed}: status ${response.status}`);
                return null;
            }
            const arrayBuffer = await response.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
        }

        if (buffer && buffer.length > 0) {
            // Keep cache bounded
            if (nablLogoBufferCache.size > 100) {
                const firstKey = nablLogoBufferCache.keys().next().value;
                nablLogoBufferCache.delete(firstKey);
            }
            nablLogoBufferCache.set(trimmed, buffer);
        }
        return buffer;
    } catch (err) {
        console.warn('[nablLogoHelper] Error fetching NABL logo image:', err.message || err);
        return null;
    }
}

/**
 * Resolve the NABL logo URL for a report or booking.
 * Looks up user, tenant, creator, and booking data to find the appropriate NABL accreditation logo.
 */
export async function resolveNablLogoForReport({ tenantId, bookingId, reportId, user } = {}) {
    try {
        // 1. Direct from logged-in user if available
        if (user?.nabllogo && String(user.nabllogo).trim()) {
            return String(user.nabllogo).trim();
        }
        if (user?.role === 'staff' && user?.parentUser) {
            const parent = await User.findById(user.parentUser).select('nabllogo').lean();
            if (parent?.nabllogo && String(parent.nabllogo).trim()) {
                return String(parent.nabllogo).trim();
            }
        }

        // 2. From Tenant
        const resolvedTenantId = tenantId || user?.tenantId?._id || user?.tenantId;
        if (resolvedTenantId && mongoose.Types.ObjectId.isValid(resolvedTenantId)) {
            const tenantDoc = await Tenant.findById(resolvedTenantId).select('nabllogo adminDetails').lean();
            if (tenantDoc?.nabllogo && String(tenantDoc.nabllogo).trim()) {
                return String(tenantDoc.nabllogo).trim();
            }
            if (tenantDoc?.adminDetails?.userId) {
                const adminUser = await User.findById(tenantDoc.adminDetails.userId).select('nabllogo').lean();
                if (adminUser?.nabllogo && String(adminUser.nabllogo).trim()) {
                    return String(adminUser.nabllogo).trim();
                }
            }
            const tenantAdmin = await User.findOne({ tenantId: resolvedTenantId, role: 'admin' }).select('nabllogo').lean();
            if (tenantAdmin?.nabllogo && String(tenantAdmin.nabllogo).trim()) {
                return String(tenantAdmin.nabllogo).trim();
            }
        }

        // 3. From Report document
        let reportDoc = null;
        if (reportId && mongoose.Types.ObjectId.isValid(reportId)) {
            reportDoc = await reports.findById(reportId).select('tenantId createdBy franchisee').lean();
        }
        if (!reportDoc && bookingId) {
            reportDoc = await reports.findOne({ bookingId }).select('tenantId createdBy franchisee').lean();
        }

        if (reportDoc) {
            if (reportDoc.createdBy) {
                const creator = await User.findById(reportDoc.createdBy).select('nabllogo').lean();
                if (creator?.nabllogo && String(creator.nabllogo).trim()) {
                    return String(creator.nabllogo).trim();
                }
            }
            if (reportDoc.tenantId && String(reportDoc.tenantId) !== String(resolvedTenantId)) {
                const repTenant = await Tenant.findById(reportDoc.tenantId).select('nabllogo adminDetails').lean();
                if (repTenant?.nabllogo && String(repTenant.nabllogo).trim()) {
                    return String(repTenant.nabllogo).trim();
                }
                if (repTenant?.adminDetails?.userId) {
                    const repAdmin = await User.findById(repTenant.adminDetails.userId).select('nabllogo').lean();
                    if (repAdmin?.nabllogo && String(repAdmin.nabllogo).trim()) {
                        return String(repAdmin.nabllogo).trim();
                    }
                }
            }
            if (reportDoc.franchisee) {
                const fUser = await User.findOne({
                    $or: [
                        { username: reportDoc.franchisee },
                        { clinicName: reportDoc.franchisee },
                        { fullName: reportDoc.franchisee }
                    ]
                }).select('nabllogo').lean();
                if (fUser?.nabllogo && String(fUser.nabllogo).trim()) {
                    return String(fUser.nabllogo).trim();
                }
            }
        }

        // 4. From newBooking document if report didn't resolve it
        if (bookingId) {
            const bDoc = await newBooking.findOne({ bookingId }).select('tenantId createdBy userId franchisee').lean();
            if (bDoc?.createdBy) {
                const bCreator = await User.findById(bDoc.createdBy).select('nabllogo').lean();
                if (bCreator?.nabllogo && String(bCreator.nabllogo).trim()) {
                    return String(bCreator.nabllogo).trim();
                }
            }
            if (bDoc?.userId) {
                const bUser = await User.findById(bDoc.userId).select('nabllogo').lean();
                if (bUser?.nabllogo && String(bUser.nabllogo).trim()) {
                    return String(bUser.nabllogo).trim();
                }
            }
            if (bDoc?.tenantId && String(bDoc.tenantId) !== String(resolvedTenantId)) {
                const bTenant = await Tenant.findById(bDoc.tenantId).select('nabllogo').lean();
                if (bTenant?.nabllogo && String(bTenant.nabllogo).trim()) {
                    return String(bTenant.nabllogo).trim();
                }
            }
        }

        return '';
    } catch (err) {
        console.warn('[nablLogoHelper] Error resolving NABL logo for report:', err.message || err);
        return '';
    }
}

/**
 * Apply the NABL logo image to the PDF buffer using user-customized position,
 * size, and page options (or falling back to standard top-right defaults).
 * 
 * @param {Buffer} inputPdfBuffer - The generated PDF buffer
 * @param {string} nablLogoUrl - HTTP(S) URL or Data URI of the NABL accreditation logo
 * @param {Object} [nablSettings] - Optional custom layout settings (width, height, X, Y, page option)
 * @returns {Promise<Buffer>} Modified PDF buffer with NABL logo applied
 */
export async function applyNablLogoToPdf(inputPdfBuffer, nablLogoUrl, nablSettings = null) {
    if (!inputPdfBuffer) return null;
    if (!nablLogoUrl || typeof nablLogoUrl !== 'string' || !nablLogoUrl.trim()) {
        return inputPdfBuffer;
    }

    // Sanitize user settings with strict bounds checks
    const settings = sanitizeNablSettings(nablSettings || {});
    if (settings.nablLogoVisible === false) {
        // User explicitly toggled off NABL logo visibility in print settings
        return inputPdfBuffer;
    }

    try {
        const rawBuffer = await fetchNablLogoBuffer(nablLogoUrl);
        if (!rawBuffer || rawBuffer.length === 0) {
            return inputPdfBuffer;
        }

        // Decode with canvas to guarantee clean standard PNG bytes with transparency
        const img = await loadImage(rawBuffer);
        if (!img.width || !img.height) {
            return inputPdfBuffer;
        }

        const cv = createCanvas(img.width, img.height);
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const pngBuffer = cv.toBuffer('image/png');

        const pdfDoc = await PDFDocument.load(inputPdfBuffer);
        const embeddedLogo = await pdfDoc.embedPng(pngBuffer);

        const pages = pdfDoc.getPages();
        if (!pages || pages.length === 0) {
            return inputPdfBuffer;
        }

        const isFirstPageOnly = settings.nablLogoPageOption === 'first-page';
        const pagesToStamp = isFirstPageOnly ? [pages[0]] : pages;

        for (let i = 0; i < pagesToStamp.length; i++) {
            const page = pagesToStamp[i];
            const { width: pagePtWidth, height: pagePtHeight } = page.getSize();

            // Compute exact rendering dimensions & PDF-lib coordinates
            const placement = computePdfLogoPlacement({
                pagePtWidth,
                pagePtHeight,
                imgRawWidth: img.width,
                imgRawHeight: img.height,
                settings
            });

            if (placement.shouldDraw && placement.width > 0 && placement.height > 0) {
                page.drawImage(embeddedLogo, {
                    x: placement.x,
                    y: placement.y,
                    width: placement.width,
                    height: placement.height,
                });
            }
        }

        const modifiedPdfBytes = await pdfDoc.save();
        return Buffer.from(modifiedPdfBytes);
    } catch (err) {
        console.warn('[nablLogoHelper] Error applying NABL logo to PDF:', err.message || err);
        return inputPdfBuffer;
    }
}

