// accessControlMiddleware.js
import { asyncHandler } from "../src/utils/asyncHandler.js";
import { User } from "../models/user.model.js";

export const verifyTenantAdmin = asyncHandler(async (req, res, next) => {
    const { tenantInfo } = req;
    const userId = req.user?._id;
    
    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }
    
    const user = await User.findOne({
        _id: userId,
        tenantId: tenantInfo._id,
        role: 'admin'
    });
    
    if (!user) {
        return res.status(403).json({
            success: false,
            message: "Access forbidden: Only tenant admins can perform this action"
        });
    }
    
    next();
});

// अन्य रोल वेरिफिकेशन मिडलवेयर्स...
export const verifySuperFranchisee = asyncHandler(async (req, res, next) => {
    // Similar implementation
});

export const verifyFranchisee = asyncHandler(async (req, res, next) => {
    // Similar implementation
});

export const verifySubFranchisee = asyncHandler(async (req, res, next) => {
    // Similar implementation
});

// Role hierarchy check
export const verifyRoleHierarchy = asyncHandler(async (req, res, next) => {
    const { userId } = req.params;
    
    const currentUserId = req.user._id;
    
    // Get target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
        return res.status(404).json({
            success: false,
            message: "User not found"
        });
    }
    
    // Check if target user's hierarchyPath contains current user's ID
    if (!targetUser.hierarchyPath.includes(`/${currentUserId}/`)) {
        return res.status(403).json({
            success: false,
            message: "You don't have permission to access this user's data"
        });
    }
    
    next();
});