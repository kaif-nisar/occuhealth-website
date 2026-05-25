import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises"; // Use promises for cleaner asynchronous file handling

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Function to upload a file to Cloudinary
const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) {
            throw new Error("Local file path is required for upload.");
        }

        console.log("Uploading file to Cloudinary:", localFilePath);

        // Upload the file to Cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "raw", // Adjust this for your file type
            use_filename: true,   // Keep the original file name if needed
            unique_filename: false, // Avoid Cloudinary generating unique filenames
        });

        console.log("Cloudinary upload response:", response);

        // Clean up local file after successful upload
        await fs.unlink(localFilePath);
        console.log("Deleted local file:", localFilePath);

        return response; // Return the Cloudinary response
    } catch (error) {
        console.error("Error uploading to Cloudinary:", error);

        // Ensure local file is deleted even if the upload fails
        try {
            await fs.unlink(localFilePath);
            console.log("Deleted local file after upload error:", localFilePath);
        } catch (unlinkError) {
            console.error("Error deleting local file:", unlinkError);
        }

        throw error; // Rethrow the error for the calling function to handle
    }
};

const deleteFromCloudinary = async (publicId) => {
    try {
        if (!publicId) {
            throw new Error("Public ID is required for deletion.");
        }

        console.log("Deleting file from Cloudinary using public_id:", publicId);

        // // Split on `.` and remove the last part (extension)
        // const parts = publicId.split(".");
        // const sanitizedPublicId = parts.length > 1 ? parts.slice(0, -1).join(".") : publicId;

        // console.log("Deleting file from Cloudinary using sanitized public_id:", sanitizedPublicId);

        // Correct method to delete a resource
        const response = await cloudinary.uploader.destroy(publicId, { resource_type: "raw",
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


export { uploadOnCloudinary, deleteFromCloudinary };
