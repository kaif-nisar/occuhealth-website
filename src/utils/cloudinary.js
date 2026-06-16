import { configDotenv } from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises"; // Use promises for cleaner asynchronous file handling

configDotenv();

const cloudinaryCloudName =
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUDINARY_NAME ||
    "";
const cloudinaryApiKey =
    process.env.CLOUDINARY_API_KEY ||
    process.env.CLOUD_API_KEY ||
    "";
const cloudinaryApiSecret =
    process.env.CLOUDINARY_API_SECRET ||
    process.env.CLOUD_API_SECRET ||
    "";

cloudinary.config({
  cloud_name: cloudinaryCloudName,
  api_key: cloudinaryApiKey,
  api_secret: cloudinaryApiSecret,
});

if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
    throw new Error(
        "Cloudinary config missing. Set CLOUDINARY_CLOUD_NAME/CLOUDINARY_NAME, CLOUDINARY_API_KEY/CLOUD_API_KEY, and CLOUDINARY_API_SECRET/CLOUD_API_SECRET in .env."
    );
}

const cleanupLocalFile = async (localFilePath) => {
    if (!localFilePath) {
        return;
    }

    try {
        await fs.unlink(localFilePath);
    } catch (error) {
        console.warn("Unable to delete local file:", localFilePath, error.message);
    }
};

// Function to upload a file to Cloudinary
const uploadOnCloudinary = async (localFilePath, options = {}) => {
    try {
        if (!localFilePath) {
            throw new Error("Local file path is required for upload.");
        }

        const {
            resourceType = "raw",
            folder,
            uniqueFilename = false,
        } = options;

        console.log("Uploading file to Cloudinary:", localFilePath);

        // Upload the file to Cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: resourceType,
            use_filename: true,   // Keep the original file name if needed
            unique_filename: uniqueFilename,
            overwrite: false,
            ...(folder ? { folder } : {}),
        });

        console.log("Cloudinary upload response:", response);

        // Clean up local file after successful upload
        await cleanupLocalFile(localFilePath);
        console.log("Deleted local file:", localFilePath);

        return response; // Return the Cloudinary response
    } catch (error) {
        console.error("Error uploading to Cloudinary:", error);

        // Ensure local file is deleted even if the upload fails
        await cleanupLocalFile(localFilePath);

        throw error; // Rethrow the error for the calling function to handle
    }
};

const deleteFromCloudinary = async (publicId, options = {}) => {
    try {
        if (!publicId) {
            throw new Error("Public ID is required for deletion.");
        }

        const {
            resourceType = "raw",
        } = options;

        console.log("Deleting file from Cloudinary using public_id:", publicId);

        // Correct method to delete a resource
        const response = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
            invalidate: true
        });

        console.log("Cloudinary deletion response:", response);

        if (response.result !== "ok") {
            throw new Error(`Failed to delete file with public_id: ${publicId}`);
        }

        return response; // Return the API response
    } catch (error) {
        console.error("Error deleting file from Cloudinary:", error);
        throw error; // Rethrow the error for the calling function to handle
    }
};

const buildCloudinaryImageUrl = (publicId, options = {}) => {
    if (!publicId) {
        return "";
    }

    const {
        format = "png",
        secure = true,
    } = options;

    return cloudinary.url(publicId, {
        resource_type: "image",
        secure,
        format,
    });
};


export { uploadOnCloudinary, deleteFromCloudinary, buildCloudinaryImageUrl };
