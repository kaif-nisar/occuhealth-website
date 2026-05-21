import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { bookingAddLab } from "../models/bookingLabName.model.js"
import { ApiError } from "../utils/apiError.js"

const addLabController = asyncHandler(async (req, res) => {
    const { LabName, LabAddress, userId } = req.body
    
    if (!LabName) {
        throw new ApiError(500, "all fields are required")
    }
    const createdLab = await bookingAddLab.create({
        LabName,
        LabAddress,
        createdBy: userId,
        tenantId: req.user.tenantId // Ensure tenantId is provided from the request
    })
    if (!createdLab) {
        throw new ApiError(400, "something went wrong while creating lab")
    }
    return res.json(new ApiResponse(200, "Lab created successfully"))
})

const allLabController = asyncHandler(async (req, res) => {
     let userId;
    if(req.user.role === 'staff'){
        userId = req.user.parentUser
    }else{
        userId = req.user._id
    }
    const allLab = await bookingAddLab.find({ createdBy: userId });
    if (!allLab) {
        throw new ApiError(400, "something went wrong while fetching labs")
    }
    return res.json(allLab)
})

const getLabById = asyncHandler(async (req, res) => {
    const labId = req.params.labId || req.query.labId;
    console.log("Lab ID:", labId);
    if (!labId) {
        throw new ApiError(400, "labId is required");
    }
    const lab = await bookingAddLab.findById(labId);
    if (!lab) {
        throw new ApiError(404, "Lab not found");
    }
    console.log("Lab found:", lab);
    return res.json(new ApiResponse(200, lab, "Lab fetched successfully"));
});
// Update Lab Controller
const updateLabController = asyncHandler(async (req, res) => {
    const { labId, LabName, LabAddress } = req.body;
    if (!labId || (!LabName && !LabAddress)) {
        throw new ApiError(400, "labId and at least one field to update are required");
    }
    const updatedLab = await bookingAddLab.findByIdAndUpdate(
        labId,
        {
            ...(LabName && { LabName }),
            ...(LabAddress && { LabAddress }),
        },
        { new: true }
    );
    if (!updatedLab) {
        throw new ApiError(404, "Lab not found or update failed");
    }
    return res.json(new ApiResponse(200, "Lab updated successfully", updatedLab));
});

// Delete Lab Controller
const deleteLabController = asyncHandler(async (req, res) => {
    const { labId } = req.body;
    if (!labId) {
        throw new ApiError(400, "labId is required");
    }
    const deletedLab = await bookingAddLab.findByIdAndDelete(labId);
    if (!deletedLab) {
        throw new ApiError(404, "Lab not found or already deleted");
    }
    return res.json(new ApiResponse(200, "Lab deleted successfully"));
});

export {
    addLabController,
    allLabController,
    updateLabController,
    deleteLabController,
    getLabById
}