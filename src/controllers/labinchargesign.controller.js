import { uploadOnCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
import { doctorsign } from '../models/labinchargesign.model.js';
import { User } from '../models/user.model.js';

// Helper to resolve the owner ID of doctor signatures.
// If the user is a staff member, signatures and print settings belong to the parent user who created them.
const resolveEffectiveSignUserId = async (user) => {
    if (!user) return null;
    if (user.role !== 'staff') {
        return user._id;
    }
    let currentId = user.parentUser || user.createdBy?._id || user.createdBy;
    const visited = new Set();
    while (currentId && !visited.has(String(currentId))) {
        visited.add(String(currentId));
        const signExists = await doctorsign.exists({ createdBy: currentId });
        if (signExists) {
            return currentId;
        }
        const parentDoc = await User.findById(currentId).select('role parentUser createdBy').lean();
        if (parentDoc?.role === 'staff') {
            currentId = parentDoc.parentUser || parentDoc.createdBy;
        } else {
            return currentId;
        }
    }
    return user.parentUser || user.createdBy?._id || user.createdBy || user._id;
};

// Image Upload Controller
const uploadDoctorsSign = async (req, res) => {
    const { showlab, showdoctorfirst, showdoctorsecond, labinchargeinfo, leftdoctorinfo, rightdoctorinfo } = req.body;
    const { labsign, firstdoctorsign, seconddoctorsign } = req.files || {};
    const userId = await resolveEffectiveSignUserId(req.user);
    const tenantId = req.user.tenantId?._id || req.user.tenantId;

    try {

        if (!tenantId || !userId) {
            return res.status(401).json({ message: 'Unauthorized or missing user info' });
        }

        const toBoolean = (value, fallback = false) => {
            if (typeof value === 'boolean') return value;
            if (typeof value === 'string') return value.toLowerCase() === 'true';
            return fallback;
        };

        // Upload to Cloudinary using the helper function
        let labsignresult = labsign ? await uploadOnCloudinary(labsign?.[0]?.path) : null;
        let firstdoctorsignresult = firstdoctorsign ? await uploadOnCloudinary(firstdoctorsign?.[0]?.path) : null;
        let seconddoctorsignresult = seconddoctorsign ? await uploadOnCloudinary(seconddoctorsign?.[0]?.path) : null;

        const updatedata = {
            tenantId,
            createdBy: userId,
            showlabinchargesign: toBoolean(showlab),
            labinchargeinfo: labinchargeinfo,
            showfirstdoctorsign: toBoolean(showdoctorfirst),
            firstdoctorsigninfo: leftdoctorinfo,
            showseconddoctorsign: toBoolean(showdoctorsecond),
            seconddoctorsigninfo: rightdoctorinfo
        }

        if (labsignresult) {
            updatedata.labinchargesign = labsignresult.secure_url;
            updatedata.labinchargesignpublicid = labsignresult.public_id;
        }

        if (firstdoctorsignresult) {
            updatedata.firstdoctorsign = firstdoctorsignresult.secure_url;
            updatedata.firstdoctorsignpublicid = firstdoctorsignresult.public_id;
        }

        if (seconddoctorsignresult) {
            updatedata.seconddoctorsign = seconddoctorsignresult.secure_url;
            updatedata.seconddoctorsignpublicid = seconddoctorsignresult.public_id;
        }

        const templateData = await doctorsign.findOneAndUpdate(
            {
                tenantId: tenantId._id,
                createdBy: userId
            },
            {
                $set: updatedata
            },
            {
                new: true,    // Return the updated document after the update
                upsert: true, // Create a new document if none matches the filter
            }
        );

        if (!templateData) {
            return res.status(500).json({ message: 'Failed to save in database' });
        }
        // Respond with success
        res.status(201).json({ message: 'changed saved successfully', data: templateData });

    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getDoctorsSign = async (req, res) => {
    const tenantId = req.user.tenantId?._id || req.user.tenantId;
    const userId = await resolveEffectiveSignUserId(req.user);

    try {
        let labsigndata = await doctorsign.findOne({
            tenantId: tenantId,
            createdBy: userId
        });

        // Fallback: If not found under target parent, check tenant admin or any signature in this tenant for staff
        if (!labsigndata && req.user.role === 'staff') {
            const tenantAdminId = req.user.tenantId?.adminDetails?.userId?._id || req.user.tenantId?.adminDetails?.userId;
            if (tenantAdminId && String(tenantAdminId) !== String(userId)) {
                labsigndata = await doctorsign.findOne({ tenantId, createdBy: tenantAdminId });
            }
            if (!labsigndata) {
                labsigndata = await doctorsign.findOne({ tenantId });
            }
        }

        if (!labsigndata) {
            // Missing signatures are normal in some setups, especially during bulk finalize.
            return res.status(200).json({
                showlabinchargesign: false,
                showfirstdoctorsign: false,
                showseconddoctorsign: false,
                labinchargeinfo: "",
                firstdoctorsigninfo: "",
                seconddoctorsigninfo: "",
                labinchargesign: "",
                firstdoctorsign: "",
                seconddoctorsign: "",
                isAvailable: false,
            });
        }

        res.status(200).json(labsigndata);
    } catch (error) {
        console.error('Error fetching doctor signature:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const editdoctorsvisibility = async (req, res) => {
    try {
        const { showlab, showfirstdoctor, showseconddoctor } = req.body;
        const tenantId = req.user?.tenantId?._id || req.user?.tenantId;
        const userId = await resolveEffectiveSignUserId(req.user);

        // 1️⃣ Input validation
        if (
            typeof showlab !== 'boolean' ||
            typeof showfirstdoctor !== 'boolean' ||
            typeof showseconddoctor !== 'boolean'
        ) {
            return res.status(400).json({ message: 'Invalid input types. All fields must be boolean.' });
        }

        // 2️⃣ Ensure user & tenant exist
        if (!tenantId || !userId) {
            return res.status(401).json({ message: 'Unauthorized or missing user info' });
        }

        // 3️⃣ Perform update
        const editeddoc = await doctorsign.findOneAndUpdate(
            { tenantId: tenantId, createdBy: userId },
            {
                $set: {
                    showlabinchargesign: showlab,
                    showfirstdoctorsign: showfirstdoctor,
                    showseconddoctorsign: showseconddoctor
                }
            },
            { new: true }
        );

        // 4️⃣ Document not found
        if (!editeddoc) {
            return res.status(404).json({ message: 'Signature record not found or not updated.' });
        }

        // 5️⃣ Success response
        return res.status(200).json({ message: 'Signature updated successfully' });

    } catch (error) {
        console.error('Error updating signature visibility:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const deleteLabInchargeSign = async (req, res) => {
    try {
        const { publicId, publicIdfield, urlfield } = req.body; // The image URL is passed in the request body
        const tenantId = req.user?.tenantId?._id || req.user?.tenantId;
        const userId = await resolveEffectiveSignUserId(req.user);
        console.log("this is a url of image:", publicId);

        // Delete the image from Cloudinary
        const cloudinaryResponse = await deleteFromCloudinary(publicId);

        if (!cloudinaryResponse || cloudinaryResponse.result !== 'ok') {
            console.log('error deleting from cloudinary:', cloudinaryResponse);
            return res.status(500).json({ message: 'Failed to delete image from Cloudinary' });
        }

        const templateData = await doctorsign.findOneAndUpdate(
            {
                tenantId: tenantId,
                createdBy: userId
            },
            {
                $set: {
                    [publicIdfield]: "",
                    [urlfield]: ""
                }
            },
            {
                new: true,    // Return the updated document after the update
                upsert: true, // Create a new document if none matches the filter
            }
        );

        if (!templateData) {
            return res.status(500).json({ message: 'Failed to delete image from database' });
        }

        // Respond with success
        res.status(200).json({ message: 'Image deleted successfully' });

    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export {
    uploadDoctorsSign,
    getDoctorsSign,
    deleteLabInchargeSign,
    editdoctorsvisibility
};
