import { createCanvas, loadImage } from "canvas";
import { PDFDocument } from "pdf-lib";
import { customization } from "../models/printsetting.model.js";
import { buildCloudinaryImageUrl } from "./cloudinary.js";

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

const getBookingAttachments = async ({ tenantId, bookingId }) => {
    if (!tenantId || !bookingId) {
        return [];
    }

    const attachmentDoc = await customization.findOne({
        tenantId,
        bookingId,
        format: ATTACHMENT_DOC_FORMAT,
    }).select("attachments").lean();

    return sortAttachments(attachmentDoc?.attachments || []);
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

const mergePdfWithBookingAttachments = async ({ pdfBuffer, tenantId, bookingId }) => {
    if (!pdfBuffer?.length || !tenantId || !bookingId) {
        return pdfBuffer;
    }

    const attachments = await getBookingAttachments({ tenantId, bookingId });
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

            const fileType = String(attachment.fileType || "").toLowerCase();
            const isPdf = fileType === "pdf" || (attachment.url || "").toLowerCase().includes(".pdf");

            if (isPdf) {
                if (!attachment.url) {
                    console.warn("[pdfAttachmentMerger] Skipping PDF attachment with missing URL:", attachment);
                    continue;
                }
                const attachmentPdfBuffer = await fetchArrayBuffer(attachment.url);
                await appendPdfBuffer(mergedDoc, attachmentPdfBuffer);
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
