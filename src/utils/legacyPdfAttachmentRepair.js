import { buildCloudinaryImageUrl, uploadBufferOnCloudinary } from "./cloudinary.js";

const ATTACHMENT_FOLDER = "booking-attachments";

const normalizeText = (value) => String(value || "").trim();

const replaceUrlExtension = (value = "", nextExtension = "") => {
    const url = normalizeText(value);
    if (!url || !nextExtension) {
        return url;
    }

    return url.replace(/\.([a-z0-9]+)(?=([?#]|$))/i, `.${String(nextExtension).replace(/^\./, "")}`);
};

const isPdfAttachment = (attachment = {}) => {
    const fileType = normalizeText(attachment.fileType).toLowerCase();
    const mimeType = normalizeText(attachment.mimeType).toLowerCase();
    const fileExtension = normalizeText(attachment.fileExtension).toLowerCase();
    const attachmentUrl = normalizeText(attachment.url).toLowerCase();

    return (
        fileType === "pdf" ||
        mimeType === "application/pdf" ||
        fileExtension === ".pdf" ||
        attachmentUrl.includes(".pdf")
    );
};

const needsLegacyPdfRepair = (attachment = {}) => {
    if (!isPdfAttachment(attachment)) {
        return false;
    }

    const url = normalizeText(attachment.url).toLowerCase();
    const resourceType = normalizeText(attachment.resourceType).toLowerCase();

    return url.includes("/image/upload/") || resourceType !== "raw";
};

const buildLegacyPdfSourceCandidates = (attachment = {}) => {
    const existingUrl = normalizeText(attachment.url);
    const publicId = normalizeText(attachment.publicId);
    const fileExtension = normalizeText(attachment.fileExtension).replace(/^\./, "") || "pdf";
    const existingImageUrl = existingUrl.toLowerCase().includes(".pdf")
        ? replaceUrlExtension(existingUrl, "jpg")
        : existingUrl;

    const pdfUrls = [...new Set([
        existingUrl,
        existingUrl.includes("/image/upload/") ? existingUrl.replace("/image/upload/", "/raw/upload/") : "",
        publicId ? buildCloudinaryImageUrl(publicId, { resourceType: "raw", format: fileExtension }) : "",
    ])].filter(Boolean);

    const imageUrls = [...new Set([
        existingUrl,
        existingImageUrl && existingImageUrl !== existingUrl ? existingImageUrl : "",
        publicId ? buildCloudinaryImageUrl(publicId, { resourceType: "image", format: "jpg" }) : "",
    ])].filter(Boolean);

    return { pdfUrls, imageUrls };
};

const isLikelyPdfBuffer = (buffer) => {
    if (!Buffer.isBuffer(buffer) || buffer.length < 5) {
        return false;
    }

    return buffer.subarray(0, 5).toString("utf8") === "%PDF-";
};

const isLikelyImageBuffer = (buffer, contentType = "") => {
    if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
        return false;
    }

    const header = buffer.subarray(0, 16);
    const type = normalizeText(contentType).toLowerCase();

    if (type.startsWith("image/")) {
        return true;
    }

    if (header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
        return true;
    }

    if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return true;
    }

    if (header.subarray(0, 6).toString("utf8") === "GIF87a" || header.subarray(0, 6).toString("utf8") === "GIF89a") {
        return true;
    }

    if (header.subarray(0, 2).toString("utf8") === "BM") {
        return true;
    }

    if (header.subarray(0, 4).toString("utf8") === "RIFF" && buffer.subarray(8, 12).toString("utf8") === "WEBP") {
        return true;
    }

    return false;
};

const fetchBufferFromUrl = async (url) => {
    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to download attachment from ${url} (Status: ${response.status} ${response.statusText})`);
    }

    return {
        buffer: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get("content-type") || "",
    };
};

const uploadRepairedPdfAttachment = async (attachment, pdfBuffer, sourceUrlUsed) => {
    const uploadResult = await uploadBufferOnCloudinary(pdfBuffer, {
        resourceType: "raw",
        folder: ATTACHMENT_FOLDER,
        uniqueFilename: true,
    });

    return {
        ...attachment,
        url: uploadResult.secure_url || uploadResult.url || "",
        publicId: uploadResult.public_id || "",
        fileType: "pdf",
        fileName: attachment.fileName || "attachment",
        resourceType: uploadResult.resource_type || "raw",
        mimeType: "application/pdf",
        fileExtension: ".pdf",
        repairedFromUrl: sourceUrlUsed,
        repairedAt: new Date(),
    };
};

const uploadRepairedImageAttachment = async (attachment, imageBuffer, sourceUrlUsed, contentType = "") => {
    const uploadResult = await uploadBufferOnCloudinary(imageBuffer, {
        resourceType: "image",
        folder: ATTACHMENT_FOLDER,
        uniqueFilename: true,
    });

    const normalizedContentType = normalizeText(contentType).toLowerCase();
    const inferredExtension = normalizedContentType.includes("png")
        ? ".png"
        : normalizedContentType.includes("webp")
            ? ".webp"
            : normalizedContentType.includes("gif")
                ? ".gif"
                : normalizedContentType.includes("bmp")
                    ? ".bmp"
                    : ".jpg";

    return {
        ...attachment,
        url: uploadResult.secure_url || uploadResult.url || "",
        publicId: uploadResult.public_id || "",
        fileType: "image",
        fileName: attachment.fileName || "attachment",
        resourceType: uploadResult.resource_type || "image",
        mimeType: normalizedContentType || "image/jpeg",
        fileExtension: inferredExtension,
        repairedFromUrl: sourceUrlUsed,
        repairedAt: new Date(),
    };
};

const repairLegacyPdfAttachment = async (attachment = {}) => {
    if (!needsLegacyPdfRepair(attachment)) {
        return null;
    }

    const { pdfUrls, imageUrls } = buildLegacyPdfSourceCandidates(attachment);
    if (!pdfUrls.length && !imageUrls.length) {
        return null;
    }

    let pdfBuffer = null;
    let sourceUrlUsed = "";

    for (const sourceUrl of pdfUrls) {
        try {
            const { buffer } = await fetchBufferFromUrl(sourceUrl);
            if (!isLikelyPdfBuffer(buffer)) {
                continue;
            }

            pdfBuffer = buffer;
            sourceUrlUsed = sourceUrl;
            break;
        } catch (error) {
            console.warn(
                `[legacyPdfAttachmentRepair] Download failed for "${attachment.fileName || attachment.publicId || "unknown"}" using URL "${sourceUrl}"`,
                error.message || error
            );
        }
    }

    if (!pdfBuffer) {
        for (const sourceUrl of imageUrls) {
            try {
                const { buffer, contentType } = await fetchBufferFromUrl(sourceUrl);
                if (!isLikelyImageBuffer(buffer, contentType)) {
                    continue;
                }

                return await uploadRepairedImageAttachment(attachment, buffer, sourceUrl, contentType);
            } catch (error) {
                console.warn(
                    `[legacyPdfAttachmentRepair] Image fallback failed for "${attachment.fileName || attachment.publicId || "unknown"}" using URL "${sourceUrl}"`,
                    error.message || error
                );
            }
        }

        return null;
    }

    return await uploadRepairedPdfAttachment(attachment, pdfBuffer, sourceUrlUsed);
};

export {
    needsLegacyPdfRepair,
    repairLegacyPdfAttachment,
};
