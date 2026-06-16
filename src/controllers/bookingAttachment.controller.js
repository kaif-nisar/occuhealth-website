import { customization } from "../models/printsetting.model.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";

const ATTACHMENT_DOC_FORMAT = "bookingAttachments";
const ATTACHMENT_FOLDER = "booking-attachments";

const resolveAttachmentFileMeta = (file) => {
    const mimeType = (file?.mimetype || "").toLowerCase();

    if (mimeType === "application/pdf") {
        return {
            fileType: "pdf",
            resourceType: "raw",
        };
    }

    if (mimeType.startsWith("image/")) {
        return {
            fileType: "image",
            resourceType: "image",
        };
    }

    return null;
};

const normalizeAttachment = (attachment) => ({
    url: attachment.url || "",
    publicId: attachment.publicId || "",
    fileType: attachment.fileType || "image",
    fileName: attachment.fileName || "attachment",
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

const uploadBookingAttachments = async (req, res) => {
    const tenantId = req.user?.tenantId?._id || req.user?.tenantId;
    const createdBy = req.user?.role === "staff" ? req.user?.parentUser : req.user?._id;
    const { bookingId } = req.body;
    const files = Array.isArray(req.files) ? req.files : [];

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
                throw new Error(`Unsupported file type: ${file?.mimetype || "unknown"}`);
            }

            const result = await uploadOnCloudinary(file.path, {
                resourceType: meta.resourceType,
                folder: ATTACHMENT_FOLDER,
                uniqueFilename: true,
            });

            uploadedAttachments.push({
                url: result.secure_url,
                publicId: result.public_id,
                fileType: meta.fileType,
                fileName: file.originalname,
                resourceType: meta.resourceType,
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
                        $each: uploadedAttachments.map(({ resourceType, ...attachment }) => attachment),
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
        return res.status(500).json({
            message: error.message || "Failed to upload attachments",
        });
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
            resourceType: attachment.fileType === "pdf" ? "raw" : "image",
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
