import { customization } from "../models/printsetting.model.js";
import { deleteFromCloudinary, uploadBufferOnCloudinary } from "../utils/cloudinary.js";
import fs from "fs/promises";

const ATTACHMENT_DOC_FORMAT = "bookingAttachments";
const ATTACHMENT_FOLDER = "booking-attachments";
const SUPPORTED_IMAGE_EXTENSIONS = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".bmp",
    ".tif",
    ".tiff",
    ".avif",
    ".heic",
    ".heif",
]);
const SUPPORTED_PDF_EXTENSIONS = new Set([".pdf"]);

const getFileExtension = (fileName = "") => {
    const lastDotIndex = String(fileName).lastIndexOf(".");
    if (lastDotIndex < 0) {
        return "";
    }

    return String(fileName).slice(lastDotIndex).toLowerCase();
};

const resolveAttachmentFileMeta = (file) => {
    const mimeType = (file?.mimetype || "").toLowerCase();
    const originalName = file?.originalname || "";
    const extension = getFileExtension(originalName);
    const isPdfByMime = mimeType === "application/pdf" || mimeType === "application/x-pdf";
    const isPdfByExtension = SUPPORTED_PDF_EXTENSIONS.has(extension);
    const isImageByMime = mimeType.startsWith("image/");
    const isImageByExtension = SUPPORTED_IMAGE_EXTENSIONS.has(extension);

    if (isPdfByMime || isPdfByExtension) {
        return {
            fileType: "pdf",
            resourceType: "raw",
            mimeType: mimeType || "application/pdf",
            fileExtension: extension || ".pdf",
        };
    }

    if (isImageByMime || isImageByExtension) {
        return {
            fileType: "image",
            resourceType: "image",
            mimeType: mimeType || "image/*",
            fileExtension: extension,
        };
    }

    // Some mobile camera pickers return empty or generic metadata even though the payload is an image.
    if (!mimeType || mimeType === "application/octet-stream") {
        return {
            fileType: "image",
            resourceType: "auto",
            mimeType: mimeType || "image/*",
            fileExtension: extension,
        };
    }

    return null;
};

const uploadAttachmentBuffer = async (fileBuffer, meta) => {
    const uploadOptions = {
        resourceType: "auto",
        folder: ATTACHMENT_FOLDER,
        uniqueFilename: true,
    };

    try {
        return await uploadBufferOnCloudinary(fileBuffer, uploadOptions);
    } catch (error) {
        const looksLikeImage = Boolean(
            meta?.fileType === "image" ||
            meta?.mimeType?.startsWith("image/") ||
            SUPPORTED_IMAGE_EXTENSIONS.has(meta?.fileExtension || "")
        );

        if (!looksLikeImage) {
            throw error;
        }

        // Some mobile camera formats can be finicky. Retry as raw so the file still uploads.
        return await uploadBufferOnCloudinary(fileBuffer, {
            ...uploadOptions,
            resourceType: "raw",
        });
    }
};

const normalizeAttachment = (attachment) => ({
    url: attachment.url || "",
    publicId: attachment.publicId || "",
    fileType: attachment.fileType || "image",
    fileName: attachment.fileName || "attachment",
    resourceType: attachment.resourceType || (attachment.fileType === "pdf" ? "raw" : "image"),
    mimeType: attachment.mimeType || "",
    fileExtension: attachment.fileExtension || "",
    order: attachment.order || 0,
    uploadedAt: attachment.uploadedAt || new Date(),
});

const cleanupUploadedAttachments = async (attachments = []) => {
    for (const attachment of attachments) {
        try {
            await deleteFromCloudinary(attachment.publicId, {
                resourceType: attachment.resourceType || (attachment.fileType === "pdf" ? "raw" : "image"),
            });
        } catch (error) {
            console.warn("Failed to rollback uploaded attachment:", attachment.publicId, error.message);
        }
    }
};

const cleanupTempFiles = async (files = []) => {
    for (const file of files) {
        try {
            if (file?.path) {
                await fs.unlink(file.path);
            }
        } catch (error) {
            if (error?.code !== "ENOENT") {
                console.warn("Failed to clean up temp attachment file:", file?.path, error.message);
            }
        }
    }
};

const uploadBookingAttachments = async (req, res) => {
    const tenantId = req.user?.tenantId?._id || req.user?.tenantId;
    const createdBy = req.user?.role === "staff" ? req.user?.parentUser : req.user?._id;
    const { bookingId } = req.body;
    const files = Array.isArray(req.files) ? req.files : [];

    if (!tenantId) {
        return res.status(400).json({ message: "Tenant context not found" });
    }

    if (!bookingId) {
        return res.status(400).json({ message: "bookingId is required" });
    }

    if (!files.length) {
        return res.status(400).json({ message: "Please select at least one file to upload" });
    }

    const existingDoc = await customization.findOne({
        tenantId,
        bookingId,
        format: ATTACHMENT_DOC_FORMAT,
    }).select("attachments").lean();

    const nextOrder = existingDoc?.attachments?.length || 0;
    const uploadedAttachments = [];

    try {
        for (const [index, file] of files.entries()) {
            const meta = resolveAttachmentFileMeta(file);
            if (!meta) {
                throw new Error(
                    `Unsupported file type for ${file?.originalname || "attachment"}. Please upload JPG, PNG, WEBP, HEIC, HEIF or PDF files.`
                );
            }

            const fileBuffer = await fs.readFile(file.path);
            const result = await uploadAttachmentBuffer(fileBuffer, meta);

            uploadedAttachments.push({
                url: result.secure_url,
                publicId: result.public_id,
                fileType: meta.fileType,
                fileName: file.originalname,
                resourceType: result.resource_type || meta.resourceType,
                mimeType: meta.mimeType,
                fileExtension: meta.fileExtension,
                order: nextOrder + index + 1,
                uploadedAt: new Date(),
            });
        }

        const attachmentDoc = await customization.findOneAndUpdate(
            {
                tenantId,
                bookingId,
                format: ATTACHMENT_DOC_FORMAT,
            },
            {
                $setOnInsert: {
                    tenantId,
                    createdBy,
                    bookingId,
                    format: ATTACHMENT_DOC_FORMAT,
                    isdocumented: true,
                },
                $set: {
                    updatedAt: new Date(),
                },
                $push: {
                    attachments: {
                        $each: uploadedAttachments,
                    },
                },
            },
            {
                new: true,
                upsert: true,
            }
        ).lean();

        return res.status(201).json({
            message: "Attachments uploaded successfully",
            bookingId,
            attachments: (attachmentDoc?.attachments || []).map(normalizeAttachment),
        });
    } catch (error) {
        await cleanupUploadedAttachments(uploadedAttachments);
        console.error("Upload attachment error:", error);
        const message = error.message || "Failed to upload attachments";
        const statusCode = message.toLowerCase().includes("unsupported file type") ? 400 : 500;
        return res.status(statusCode).json({
            message,
        });
    } finally {
        await cleanupTempFiles(files);
    }
};

const getBookingAttachments = async (req, res) => {
    try {
        const tenantId = req.user?.tenantId?._id || req.user?.tenantId;
        const bookingId = req.params.bookingId;

        if (!bookingId) {
            return res.status(400).json({ message: "bookingId is required" });
        }

        const attachmentDoc = await customization.findOne({
            tenantId,
            bookingId,
            format: ATTACHMENT_DOC_FORMAT,
        }).select("bookingId attachments").lean();

        return res.status(200).json({
            bookingId,
            attachments: (attachmentDoc?.attachments || []).map(normalizeAttachment),
        });
    } catch (error) {
        console.error("Get attachments error:", error);
        return res.status(500).json({ message: "Failed to load attachments" });
    }
};

const deleteBookingAttachment = async (req, res) => {
    try {
        const tenantId = req.user?.tenantId?._id || req.user?.tenantId;
        const { bookingId, publicId } = req.body;

        if (!bookingId || !publicId) {
            return res.status(400).json({ message: "bookingId and publicId are required" });
        }

        const attachmentDoc = await customization.findOne({
            tenantId,
            bookingId,
            format: ATTACHMENT_DOC_FORMAT,
        });

        if (!attachmentDoc) {
            return res.status(404).json({ message: "Attachment record not found" });
        }

        const attachment = attachmentDoc.attachments?.find((item) => item.publicId === publicId);
        if (!attachment) {
            return res.status(404).json({ message: "Attachment not found" });
        }

        await deleteFromCloudinary(publicId, {
            resourceType: attachment.resourceType || (attachment.fileType === "pdf" ? "raw" : "image"),
        });

        attachmentDoc.attachments = (attachmentDoc.attachments || []).filter((item) => item.publicId !== publicId);

        if (attachmentDoc.attachments.length === 0) {
            await attachmentDoc.deleteOne();
        } else {
            attachmentDoc.updatedAt = new Date();
            attachmentDoc.isdocumented = true;
            attachmentDoc.format = ATTACHMENT_DOC_FORMAT;
            await attachmentDoc.save();
        }

        return res.status(200).json({
            message: "Attachment deleted successfully",
            bookingId,
            publicId,
        });
    } catch (error) {
        console.error("Delete attachment error:", error);
        return res.status(500).json({ message: "Failed to delete attachment" });
    }
};

export {
    deleteBookingAttachment,
    getBookingAttachments,
    uploadBookingAttachments,
};
