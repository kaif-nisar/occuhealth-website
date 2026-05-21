import { uploadOnCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
import { Template } from '../models/template.model.js';

// Image Upload Controller
const uploadImage = async (req, res) => {
    try {
        let userId;
        if (req.user.role === "staff")
            userId = req.user.parentUser;
        else
            userId = req.user._id;

        // Check if a file is uploaded
        if (!req.files) {
            return res.status(400).json({ message: 'No file uploaded or file type is not supported' });
        }

        // Upload to Cloudinary using the helper function
        const result = await uploadOnCloudinary(req.files.template[0].path);

        // If upload failed
        if (!result) {
            return res.status(500).json({ message: 'Failed to upload image to Cloudinary' });
        }

        // Save the image URL to MongoDB
        const newTemplate = new Template({
            tenantId: req.user.tenantId._id,
            createdBy: userId,
            template: result.secure_url,
            public_id: result.public_id
        });
        await newTemplate.save();

        // अगर staff का parentUser है तो उसे भी notify करें
        if (req.user.role === 'staff') {
            await User.findByIdAndUpdate(req.user._id, {
                $push: {
                    activities: {
                        activityType: "other",
                        details: {
                            staffId: req.user._id,
                            staffName: req.user.fullName,
                            action: `${req.user.fullName} uploaded a new template.`,
                            template: newTemplate._id,

                        },
                        reference: {
                            model: "Template",
                            id: newTemplate._id
                        },
                        timestamp: new Date()
                    }
                }
            });
        }

        // Respond with success
        res.status(201).json({ message: 'File uploaded successfully', url: result.secure_url });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getAllTemplates = async (req, res) => {
    try {
        // Fetch all templates from MongoDB
        const templates = await Template.find({
            tenantId: req.user.tenantId._id,
        }); // Retrieves all documents in the Template collection

        // If no templates are found
        if (!templates || templates.length === 0) {
            return res.status(404).json({ message: 'No templates found' });
        }

        // Respond with the list of URLs
        const urls = templates
        res.status(200).json({ urls });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const deleteImage = async (req, res) => {
    try {
        const { url, public_id } = req.body; // The image URL is passed in the request body

        if (!url) {
            return res.status(400).json({ message: 'Image URL is required' });
        }

        // Delete the image from Cloudinary
        const cloudinaryResponse = await deleteFromCloudinary(public_id);

        if (!cloudinaryResponse || cloudinaryResponse.result !== 'ok') {
            return res.status(500).json({ message: 'Failed to delete image from Cloudinary' });
        }

        // Remove the image record from MongoDB
        const deletedTemplate = await Template.findOneAndDelete({
            template: url,
            tenantId: req.user.tenantId._id,
        });

        if (!deletedTemplate) {
            return res.status(404).json({ message: 'Image not found in database' });
        }

        // अगर staff का parentUser है तो उसे भी notify करें
        if (req.user.role === 'staff') {
            await User.findByIdAndUpdate(req.user._id, {
                $push: {
                    activities: {
                        activityType: "other",
                        details: {
                            staffId: req.user._id,
                            staffName: req.user.fullName,
                            action: `${req.user.fullName} deleted a template.`,
                            template: deletedTemplate._id,

                        },
                        reference: {
                            model: "Template",
                            id: deletedTemplate._id
                        },
                        timestamp: new Date()
                    }
                }
            });
        }

        // Respond with success
        res.status(200).json({ message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export {
    uploadImage,
    getAllTemplates,
    deleteImage
};
