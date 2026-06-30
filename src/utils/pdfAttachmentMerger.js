import { createCanvas, loadImage } from "canvas";
import { PDFDocument } from "pdf-lib";
import { customization } from "../models/printsetting.model.js";
import { reports } from "../models/reportData.model.js";
import { buildCloudinaryImageUrl } from "./cloudinary.js";
import { needsLegacyPdfRepair, repairLegacyPdfAttachment } from "./legacyPdfAttachmentRepair.js";

const ATTACHMENT_DOC_FORMAT = "bookingAttachments";
const A4_PORTRAIT = { width: 595.28, height: 841.89 };
const PAGE_MARGIN = 28;

const sortAttachments = (attachments = []) => {
    return [...attachments].sort((left, right) => {
        const leftOrder = Number(left?.order || 0);
        const rightOrder = Number(right?.order || 0);

        if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
        }

        const leftTime = new Date(left?.uploadedAt || 0).getTime();
        const rightTime = new Date(right?.uploadedAt || 0).getTime();
        return leftTime - rightTime;
    });
};

const fetchArrayBuffer = async (url) => {
    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch attachment from ${url} (Status: ${response.status} ${response.statusText})`);
    }

    return await response.arrayBuffer();
};

const isPdfAttachment = (attachment = {}) => {
    const fileType = String(attachment.fileType || "").toLowerCase();
    const mimeType = String(attachment.mimeType || "").toLowerCase();
    const resourceType = String(attachment.resourceType || "").toLowerCase();
    const fileExtension = String(attachment.fileExtension || "").toLowerCase();
    const attachmentUrl = String(attachment.url || "").toLowerCase();

    return (
        fileType === "pdf" ||
        mimeType === "application/pdf" ||
        resourceType === "raw" ||
        fileExtension === ".pdf" ||
        attachmentUrl.includes(".pdf")
    );
};

const buildPdfAttachmentUrl = (attachment = {}, resourceType = "raw") => {
    const publicId = String(attachment?.publicId || "").trim();
    const fileExtension = String(attachment?.fileExtension || ".pdf").replace(/^\./, "") || "pdf";
    const attachmentUrl = String(attachment?.url || "").trim();

    if (publicId) {
        return buildCloudinaryImageUrl(publicId, {
            resourceType: resourceType,
            format: fileExtension,
        });
    }

    if (attachmentUrl.includes("/image/upload/")) {
        return attachmentUrl.replace("/image/upload/", "/raw/upload/");
    }

    return attachmentUrl;
};

const sortAttachmentDocs = (docs = []) => {
    return [...docs].sort((left, right) => {
        const leftHasAttachments = Array.isArray(left?.attachments) && left.attachments.length > 0 ? 1 : 0;
        const rightHasAttachments = Array.isArray(right?.attachments) && right.attachments.length > 0 ? 1 : 0;

        if (leftHasAttachments !== rightHasAttachments) {
            return rightHasAttachments - leftHasAttachments;
        }

        const leftFormatMatch = String(left?.format || "") === ATTACHMENT_DOC_FORMAT ? 1 : 0;
        const rightFormatMatch = String(right?.format || "") === ATTACHMENT_DOC_FORMAT ? 1 : 0;

        if (leftFormatMatch !== rightFormatMatch) {
            return rightFormatMatch - leftFormatMatch;
        }

        const leftTime = new Date(left?.updatedAt || left?.createdAt || 0).getTime();
        const rightTime = new Date(right?.updatedAt || right?.createdAt || 0).getTime();
        return rightTime - leftTime;
    });
};

const resolveAttachmentContext = async ({ tenantId, bookingId, reportId }) => {
    let resolvedTenantId = tenantId || "";
    let resolvedBookingId = bookingId || "";

    const isObjectId = (id) => {
        return typeof id === "string" && id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id);
    };

    if (resolvedTenantId && resolvedBookingId && !isObjectId(resolvedBookingId)) {
        return { resolvedTenantId, resolvedBookingId };
    }

    const lookupId = (resolvedBookingId && isObjectId(resolvedBookingId))
        ? resolvedBookingId
        : reportId;

    if (!lookupId) {
        return { resolvedTenantId, resolvedBookingId };
    }

    const reportContext = await reports.findOne({
        $or: [
            { _id: lookupId },
            { bookingId: lookupId },
        ],
    }).select("tenantId bookingId").lean();

    if (reportContext) {
        resolvedTenantId = resolvedTenantId || reportContext.tenantId || "";
        resolvedBookingId = reportContext.bookingId || resolvedBookingId || "";
    }

    if (isObjectId(resolvedBookingId)) {
        resolvedBookingId = "";
    }

    return { resolvedTenantId, resolvedBookingId };
};

const getBookingAttachments = async ({ tenantId, bookingId }) => {
    if (!tenantId || !bookingId) {
        return [];
    }

    const attachmentDocs = await customization.find({
        tenantId,
        bookingId,
    }).select("attachments format updatedAt createdAt").lean();

    const sortedDocs = sortAttachmentDocs(attachmentDocs);
    const attachmentDoc = sortedDocs.find((doc) => Array.isArray(doc?.attachments) && doc.attachments.length > 0);

    if (!attachmentDoc) {
        return [];
    }

    const normalizedAttachments = [];
    let hasRepairs = false;

    for (const attachment of attachmentDoc.attachments || []) {
        let nextAttachment = attachment;

        if (needsLegacyPdfRepair(attachment)) {
            const repaired = await repairLegacyPdfAttachment(attachment);
            if (repaired) {
                nextAttachment = repaired;
                hasRepairs = true;
            }
        }

        normalizedAttachments.push({
            url: nextAttachment.url || "",
            publicId: nextAttachment.publicId || "",
            fileType: nextAttachment.fileType || "image",
            fileName: nextAttachment.fileName || "attachment",
            resourceType: nextAttachment.resourceType || (nextAttachment.fileType === "pdf" ? "raw" : "image"),
            mimeType: nextAttachment.mimeType || "",
            fileExtension: nextAttachment.fileExtension || "",
            order: nextAttachment.order || 0,
            uploadedAt: nextAttachment.uploadedAt || new Date(),
        });
    }

    if (hasRepairs && attachmentDoc._id) {
        await customization.findByIdAndUpdate(attachmentDoc._id, {
            attachments: normalizedAttachments,
            updatedAt: new Date(),
        });
    }

    return sortAttachments(normalizedAttachments);
};

const renderImageBufferToPng = async (buffer, fallbackUrl = "") => {
    let image;

    try {
        image = await loadImage(Buffer.from(buffer));
    } catch (firstError) {
        if (fallbackUrl) {
            image = await loadImage(fallbackUrl);
        } else {
            throw firstError;
        }
    }

    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, image.width, image.height);

    return canvas.toBuffer("image/png");
};

const appendImagePage = async (targetDoc, attachment) => {
    const sourceUrl = attachment?.url || buildCloudinaryImageUrl(attachment?.publicId, { format: "png" });

    if (!sourceUrl) {
        throw new Error(`Missing image URL for attachment ${attachment?.fileName || attachment?.publicId || "unknown"}`);
    }

    const rawBuffer = await fetchArrayBuffer(sourceUrl);
    const pngBuffer = await renderImageBufferToPng(rawBuffer, attachment?.publicId ? buildCloudinaryImageUrl(attachment.publicId, { format: "png" }) : "");
    const embeddedImage = await targetDoc.embedPng(pngBuffer);

    const pageOrientationLandscape = embeddedImage.width > embeddedImage.height;
    const pageWidth = pageOrientationLandscape ? A4_PORTRAIT.height : A4_PORTRAIT.width;
    const pageHeight = pageOrientationLandscape ? A4_PORTRAIT.width : A4_PORTRAIT.height;
    const availableWidth = pageWidth - PAGE_MARGIN * 2;
    const availableHeight = pageHeight - PAGE_MARGIN * 2;
    const scale = Math.min(availableWidth / embeddedImage.width, availableHeight / embeddedImage.height, 1);
    const drawWidth = embeddedImage.width * scale;
    const drawHeight = embeddedImage.height * scale;

    const page = targetDoc.addPage([pageWidth, pageHeight]);
    page.drawImage(embeddedImage, {
        x: (pageWidth - drawWidth) / 2,
        y: (pageHeight - drawHeight) / 2,
        width: drawWidth,
        height: drawHeight,
    });
};

const appendPdfBuffer = async (targetDoc, pdfBuffer) => {
    const sourceDoc = await PDFDocument.load(pdfBuffer);
    const copiedPages = await targetDoc.copyPages(sourceDoc, sourceDoc.getPageIndices());

    copiedPages.forEach((page) => {
        targetDoc.addPage(page);
    });
};

const mergePdfWithBookingAttachments = async ({ pdfBuffer, tenantId, bookingId, reportId }) => {
    if (!pdfBuffer?.length) {
        return pdfBuffer;
    }

    const { resolvedTenantId, resolvedBookingId } = await resolveAttachmentContext({
        tenantId,
        bookingId,
        reportId,
    });

    if (!resolvedTenantId || !resolvedBookingId) {
        return pdfBuffer;
    }

    const attachments = await getBookingAttachments({
        tenantId: resolvedTenantId,
        bookingId: resolvedBookingId,
    });
    if (!attachments.length) {
        return pdfBuffer;
    }

    const mergedDoc = await PDFDocument.create();
    const baseDoc = await PDFDocument.load(pdfBuffer);
    const basePages = await mergedDoc.copyPages(baseDoc, baseDoc.getPageIndices());
    basePages.forEach((page) => mergedDoc.addPage(page));

    for (const attachment of attachments) {
        try {
            if (!attachment?.url && !attachment?.publicId) {
                continue;
            }

            const isPdf = isPdfAttachment(attachment);

            if (isPdf) {
                const pdfUrls = [...new Set([
                    attachment.url || "",
                    buildPdfAttachmentUrl(attachment, attachment.resourceType || "raw") || "",
                    buildPdfAttachmentUrl(attachment, "raw") || "",
                    buildPdfAttachmentUrl(attachment, "image") || "",
                ])].filter(Boolean);

                if (!pdfUrls.length) {
                    console.warn("[pdfAttachmentMerger] Skipping PDF attachment with missing URL:", attachment);
                    continue;
                }

                let mergedPdfSuccessfully = false;

                for (const pdfUrl of pdfUrls) {
                    try {
                        const attachmentPdfBuffer = await fetchArrayBuffer(pdfUrl);
                        await appendPdfBuffer(mergedDoc, attachmentPdfBuffer);
                        mergedPdfSuccessfully = true;
                        break;
                    } catch (error) {
                        console.warn(
                            `[pdfAttachmentMerger] PDF fetch failed for "${attachment?.fileName || 'unknown'}" using URL "${pdfUrl}"`,
                            error.message || error
                        );
                    }
                }

                if (!mergedPdfSuccessfully) {
                    console.warn("[pdfAttachmentMerger] Unable to merge PDF attachment after retrying URLs:", attachment);
                }

                continue;
            }

            await appendImagePage(mergedDoc, attachment);
        } catch (error) {
            console.error(
                `[pdfAttachmentMerger] Failed to merge attachment: file="${attachment?.fileName || 'unknown'}", url="${attachment?.url || ''}"`,
                error.message || error
            );
        }
    }

    return Buffer.from(await mergedDoc.save());
};

export {
    mergePdfWithBookingAttachments,
};
