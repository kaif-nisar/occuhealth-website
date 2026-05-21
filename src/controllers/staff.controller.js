// controllers/staff.controller.js
import { Staff } from "../models/staff.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { SuperAdmin } from "../models/superAdmin.model.js";
import mongoose from "mongoose";
// YA phir directly:
import { Types } from 'mongoose';
// Create a new staff member
const createStaff = asyncHandler(async (req, res) => {
    const {
        username,
        email,
        fullName,
        password,
        phoneNo,
        address,
        city,
        state,
        pinCode,
        permissions
    } = req.body;
    console.log(req.body);
    // Validation
    if (!username || !email || !fullName || !password || !phoneNo) {
        throw new ApiError(400, "All required fields must be provided");
    }

    // Check if username or email already exists
    const existingUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existingUser) {
        throw new ApiError(409, "Username or Email already exists");
    }

    // Create staff with current user as parent
    const staff = await User.create({
        username,
        email,
        fullName,
        password,
        phoneNo,
        address,
        city,
        role: "staff",
        parentRole: req.user.role,
        state,
        pinCode,
        createdBy: req.user._id,
        parentUser: req.user._id,
        tenantId: req.user.tenantId?._id, // safe optional chaining
        permissions: permissions || {}
    });

    // Don't send password in response
    const createdStaff = await User.findById(staff._id).select(
        "-password -refreshToken"
    );

    if (!createdStaff) {
        throw new ApiError(500, "Something went wrong while registering the staff");
    }

    // Log this activity for the parent user
    if (req.user.logActivity) {
        await req.user.logActivity("user_management", {
            action: "created_staff",
            staffId: createdStaff._id,
            staffName: createdStaff.fullName
        });
    }

    return res.status(201).json(
        new ApiResponse(201, createdStaff, "Staff registered successfully")
    );
});

// Login staff
const loginStaff = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!username && !email) {
        throw new ApiError(400, "Username or email is required");
    }

    if (!password) {
        throw new ApiError(400, "Password is required");
    }

    const staff = await Staff.findOne({
        $or: [{ username }, { email }]
    });

    if (!staff) {
        throw new ApiError(404, "Staff not found");
    }

    if (!staff.isActive) {
        throw new ApiError(403, "Your account has been deactivated. Please contact your admin.");
    }

    const isPasswordValid = await staff.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    const accessToken = staff.generateAccessToken();
    const refreshToken = staff.generateRefreshToken();

    staff.refreshToken = refreshToken;
    staff.lastLogin = new Date();
    await staff.save();

    // Log login activity
    await staff.logActivity("login", {
        method: "credentials",
        timestamp: new Date()
    });

    const loggedInStaff = await Staff.findById(staff._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    staff: loggedInStaff,
                    accessToken,
                    refreshToken
                },
                "Staff logged in successfully"
            )
        );
});

// Logout staff
const logoutStaff = asyncHandler(async (req, res) => {
    await Staff.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        }
    );

    // Log logout activity
    if (req.user.logActivity) {
        await req.user.logActivity("login", {
            action: "logout",
            timestamp: new Date()
        });
    }

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production"
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "Staff logged out"));
});

// Get all staff for a parent user
const getAllStaff = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search = "" } = req.query;

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);

    const searchQuery = search ? {
        $and: [
            { parentUser: req.user._id },
            { role: 'staff' },
            {
                $or: [
                    { username: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { fullName: { $regex: search, $options: "i" } }
                ]
            }
        ]
    } : { parentUser: req.user._id, role: 'staff' };

    const staffCount = await User.countDocuments(searchQuery);
    const totalPages = Math.ceil(staffCount / pageSize);

    const staffList = await User.find(searchQuery)
        .select("-password -refreshToken")
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .sort({ createdAt: -1 });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                staff: staffList,
                pagination: {
                    totalDocuments: staffCount,
                    totalPages,
                    currentPage: pageNumber,
                    pageSize
                }
            },
            "Staff retrieved successfully"
        )
    );
});

// Get staff details by ID
const getStaffById = async (req, res) => {

    const staffId = req.query.staffId;

    const staff = await SuperAdmin.findOne({
        _id: staffId,
        parentUser: req.user._id
    }).select("-password -refreshToken");

    if (!staff) {
        throw new ApiError(401, "Staff not found");
    }

    return res.status(200).json(
        new ApiResponse(200, staff, "Staff details retrieved successfully")
    );
};

// Update staff details
const updateStaff = asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    // const staffId = req.params;
    const {
        fullName,
        phoneNo,
        email,
        username,
        permissions,
        isActive
    } = req.body;
    console.log(staffId)
    const staff = await SuperAdmin.findOne({
        _id: staffId,
        parentUser: req.user._id
    });

    if (!staff) {
        throw new ApiError(401, "Staff not found");
    }

    // Update fields if provided
    if (fullName) staff.fullName = fullName;
    if (phoneNo) staff.phoneNo = phoneNo;
    if (email) staff.email = email;
    if (username) staff.username = username;
    if (permissions) {
        staff.permissions = {
            ...staff.permissions,
            ...permissions
        };
    }
    if (isActive !== undefined) staff.isActive = isActive;

    await staff.save();

    const updatedStaff = await SuperAdmin.findById(staffId).select("-password -refreshToken");

    // Log this activity
    if (req.user.logActivity) {
        await req.user.logActivity("user_management", {
            action: "updated_staff",
            staffId: updatedStaff._id,
            staffName: updatedStaff.fullName
        });
    }

    return res.status(200).json(
        new ApiResponse(200, updatedStaff, "Staff updated successfully")
    );
});

// Delete staff
const deleteStaff = asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    console.log(staffId)
    const staff = await User.findOne({
        _id: staffId,
        parentUser: req.user._id
    });

    if (!staff) {
        throw new ApiError(401, "Staff not found");
    }

    const staffInfo = {
        id: staff._id,
        name: staff.fullName
    };

    await User.findByIdAndDelete(staffId);
    console.log(req.user.logActivity)
    // Log this activity
    if (req.user.logActivity) {
        await req.user.logActivity("user_management", {
            action: "deleted_staff",
            staffId: staffInfo.id,
            staffName: staffInfo.name
        });
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "Staff deleted successfully")
    );
});

// Get staff activity logs
const getStaffActivities = asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    const { page = 1, limit = 20, type } = req.query;

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);

    const staff = await Staff.findOne({
        _id: staffId,
        parentUser: req.user._id
    });

    if (!staff) {
        throw new ApiError(404, "Staff not found");
    }

    // Filter activities by type if provided
    let activities = staff.activities;
    if (type) {
        activities = activities.filter(activity => activity.activityType === type);
    }

    // Sort activities by timestamp (newest first)
    activities.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const paginatedActivities = activities.slice(
        (pageNumber - 1) * pageSize,
        pageNumber * pageSize
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                activities: paginatedActivities,
                pagination: {
                    totalActivities: activities.length,
                    totalPages: Math.ceil(activities.length / pageSize),
                    currentPage: pageNumber,
                    pageSize
                }
            },
            "Staff activities retrieved successfully"
        )
    );
});

// Change staff password
const changeStaffPassword = asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
        throw new ApiError(400, "New password is required");
    }

    const staff = await Staff.findOne({
        _id: staffId,
        parentUser: req.user._id
    });

    if (!staff) {
        throw new ApiError(404, "Staff not found");
    }

    staff.password = newPassword;
    await staff.save();

    // Log this activity
    if (req.user.logActivity) {
        await req.user.logActivity("user_management", {
            action: "changed_staff_password",
            staffId: staff._id,
            staffName: staff.fullName
        });
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "Staff password changed successfully")
    );
});



// Get all staff members
const allStaff = asyncHandler(async (req, res) => {
    try {
        const { page = 1, limit = 50, active, search } = req.query;

        // Build query
        const query = { role: 'staff' };

        // Filter by active status if provided
        if (active !== undefined) {
            query.isActive = active === 'true';
        }

        // Search functionality
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const staff = await SuperAdmin.find(query)
            .select('-password') // Exclude password from response
            .populate('createdBy', 'fullName username')
            .populate('parentUser', 'fullName username')
            .sort({ lastLogin: -1, createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await User.countDocuments(query);

        res.json({
            success: true,
            data: staff,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        console.error('Error fetching staff:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching staff members',
            error: error.message
        });
    }
});




const staffActivity = asyncHandler(async (req, res) => {
    try {
        const { page = 1, limit = 100, activityType, dateFrom, dateTo } = req.query;

        // Build aggregation pipeline
        const pipeline = [
            // Match only staff members
            { $match: { role: 'staff' } },

            // Unwind activities array
            { $unwind: '$activities' },

            // Match activity filters if provided
            ...(activityType ? [{
                $match: { 'activities.activityType': activityType }
            }] : []),

            // Date range filter
            ...(dateFrom || dateTo ? [{
                $match: {
                    'activities.timestamp': {
                        ...(dateFrom ? { $gte: new Date(dateFrom) } : {}),
                        ...(dateTo ? { $lte: new Date(dateTo) } : {})
                    }
                }
            }] : []),

            // Project required fields
            {
                $project: {
                    _id: '$activities._id',
                    activityType: '$activities.activityType',
                    details: '$activities.details',
                    reference: '$activities.reference',
                    timestamp: '$activities.timestamp',
                    staffId: '$_id',
                    staffName: '$fullName',
                    staffUsername: '$username',
                    staffEmail: '$email'
                }
            },

            // Sort by timestamp (newest first)
            { $sort: { timestamp: -1 } },

            // Pagination
            { $skip: (page - 1) * limit },
            { $limit: parseInt(limit) }
        ];

        const activities = await SuperAdmin.aggregate(pipeline);

        // Get total count for pagination
        const countPipeline = [
            { $match: { role: 'staff' } },
            { $unwind: '$activities' },
            ...(activityType ? [{
                $match: { 'activities.activityType': activityType }
            }] : []),
            ...(dateFrom || dateTo ? [{
                $match: {
                    'activities.timestamp': {
                        ...(dateFrom ? { $gte: new Date(dateFrom) } : {}),
                        ...(dateTo ? { $lte: new Date(dateTo) } : {})
                    }
                }
            }] : []),
            { $count: 'total' }
        ];

        const countResult = await User.aggregate(countPipeline);
        const total = countResult[0]?.total || 0;

        res.json({
            success: true,
            data: activities,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching activities',
            error: error.message
        });
    }
});

// Get activities for specific staff member
const oneStaffActivity = asyncHandler(async (req, res) => {
    try {
        const { page = 1, limit = 50, activityType } = req.query;

        const staff = await User.findOne({
            _id: req.params.id,
            role: 'staff'
        });

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Staff member not found'
            });
        }

        let activities = staff.activities || [];

        // Filter by activity type if provided
        if (activityType) {
            activities = activities.filter(activity =>
                activity.activityType === activityType
            );
        }

        // Sort by timestamp (newest first)
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedActivities = activities.slice(startIndex, endIndex);

        res.json({
            success: true,
            data: paginatedActivities,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(activities.length / limit),
                total: activities.length
            },
            staff: {
                id: staff._id,
                fullName: staff.fullName,
                username: staff.username
            }
        });
    } catch (error) {
        console.error('Error fetching staff activities:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching staff activities',
            error: error.message
        });
    }
});

// Get dashboard statistics
const staffDashboard = asyncHandler(async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay());

        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

        // Aggregation pipeline for comprehensive stats
        const statsData = await User.aggregate([
            { $match: { role: 'staff' } },
            {
                $group: {
                    _id: null,
                    totalStaff: { $sum: 1 },
                    activeStaff: {
                        $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
                    },
                    inactiveStaff: {
                        $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
                    },
                    totalActivities: {
                        $sum: { $size: { $ifNull: ['$activities', []] } }
                    },
                    todayActivities: {
                        $sum: {
                            $size: {
                                $filter: {
                                    input: { $ifNull: ['$activities', []] },
                                    cond: {
                                        $and: [
                                            { $gte: ['$$this.timestamp', today] },
                                            { $lt: ['$$this.timestamp', tomorrow] }
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    thisWeekActivities: {
                        $sum: {
                            $size: {
                                $filter: {
                                    input: { $ifNull: ['$activities', []] },
                                    cond: { $gte: ['$$this.timestamp', thisWeekStart] }
                                }
                            }
                        }
                    },
                    thisMonthActivities: {
                        $sum: {
                            $size: {
                                $filter: {
                                    input: { $ifNull: ['$activities', []] },
                                    cond: { $gte: ['$$this.timestamp', thisMonthStart] }
                                }
                            }
                        }
                    }
                }
            }
        ]);

        // Get activity type breakdown
        const activityBreakdown = await User.aggregate([
            { $match: { role: 'staff' } },
            { $unwind: '$activities' },
            {
                $group: {
                    _id: '$activities.activityType',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Get most active staff
        const mostActiveStaff = await User.aggregate([
            { $match: { role: 'staff' } },
            {
                $project: {
                    fullName: 1,
                    username: 1,
                    isActive: 1,
                    lastLogin: 1,
                    activityCount: { $size: { $ifNull: ['$activities', []] } }
                }
            },
            { $sort: { activityCount: -1 } },
            { $limit: 5 }
        ]);

        const stats = statsData[0] || {
            totalStaff: 0,
            activeStaff: 0,
            inactiveStaff: 0,
            totalActivities: 0,
            todayActivities: 0,
            thisWeekActivities: 0,
            thisMonthActivities: 0
        };

        res.json({
            success: true,
            data: {
                overview: stats,
                activityBreakdown,
                mostActiveStaff
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard statistics',
            error: error.message
        });
    }
});



// Get staff details by ID
const getStaffByIdTenant = async (req, res) => {

    const staffId = req.query.staffId;

    const staff = await User.findOne({
        _id: staffId,
        parentUser: req.user._id
    }).select("-password -refreshToken");

    if (!staff) {
        throw new ApiError(401, "Staff not found");
    }

    return res.status(200).json(
        new ApiResponse(200, staff, "Staff details retrieved successfully")
    );
};

const updateStaffTenant = asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    let { fullName, phoneNo, email, username, permissions, isActive } = req.body;

    const updateFields = {};

    if (fullName) updateFields.fullName = fullName;
    if (phoneNo) updateFields.phoneNo = phoneNo;
    if (email) updateFields.email = email;
    if (username) updateFields.username = username;
    if (isActive !== undefined) updateFields.isActive = isActive;

    if (permissions) {
        if (typeof permissions === "string") permissions = JSON.parse(permissions);
        Object.keys(permissions).forEach(key => {
            updateFields[`permissions.${key}`] = Boolean(permissions[key]);
        });
    }

    const result = await User.updateOne(
        {
            _id: new mongoose.Types.ObjectId(staffId),
            parentUser: new mongoose.Types.ObjectId(req.user._id)
        },
        { $set: updateFields }
    );

    console.log("UPDATE RESULT:", result);

    if (result.matchedCount === 0) {
        throw new ApiError(404, "Staff not found under this admin");
    }

    const updatedStaff = await User.findById(staffId)
        .select("-password -refreshToken");

    return res.status(200).json(
        new ApiResponse(200, updatedStaff, "Staff updated successfully")
    );
});

const deleteStaffTenant = asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    console.log("staffId (raw from params):", staffId);
    console.log("staffId type:", typeof staffId);
    console.log("req.user._id:", req.user._id);
    
    // ✅ Validate ObjectId format
    if (!Types.ObjectId.isValid(staffId)) {
        throw new ApiError(400, "Invalid staff ID format");
    }

    // 🔍 Step 1: Check if staff exists (findById automatically converts string to ObjectId)
    const staffExists = await User.findById(staffId);
    console.log("Staff exists (without filter):", staffExists);

    if (!staffExists) {
        throw new ApiError(404, "Staff not found");
    }

    // 🔍 Step 2: Check parentUser permission
    // Convert both to strings for comparison
    const staffParentUser = String(staffExists.parentUser || '');
    const currentUserId = String(req.user._id);
    
    console.log("Staff's parentUser:", staffParentUser);
    console.log("Current user ID:", currentUserId);
    console.log("Do they match?", staffParentUser === currentUserId);

    if (staffParentUser !== currentUserId) {
        throw new ApiError(403, "You don't have permission to delete this staff");
    }

    const staffInfo = {
        id: staffExists._id,
        name: staffExists.fullName
    };

    // ✅ Delete staff (findByIdAndDelete automatically converts string to ObjectId)
    await User.findByIdAndDelete(staffId);
    
    console.log("✅ Staff deleted successfully");
    
    // Log this activity
    if (req.user.logActivity) {
        await req.user.logActivity("user_management", {
            action: "deleted_staff",
            staffId: staffInfo.id,
            staffName: staffInfo.name
        });
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "Staff deleted successfully")
    );
});












// new tenant routes

// ========================================
// GET ALL STAFF WITH ACTIVITIES API
// ========================================

const getAllStaffWithActivities = asyncHandler(async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        let userId;
        if (req.user.role === "staff") {
            userId = req.user.parentUser
        }
        else {
            userId = req.user._id
        }

        // Validate if user is admin or has permission to view staff activities
        // if (req.user.role !== "admin" && !req.user.permissions?.canManageUsers) {
        //     return res.status(403).json({
        //         success: false,
        //         message: 'Access denied. Admin privileges required.'
        //     });
        // }

        // Find all staff members under this tenant
        const staffMembers = await User.find({
            tenantId: tenantId._id,
            role: "staff",
            createdBy: userId
            // $or: [
            //     { createdBy: req.user._id }, // Staff created by current admin
            //     { parentUser: req.user._id }  // Staff under current admin
            // ]
        })
            .select('fullName username email phoneNo isActive lastLogin activities permissions parentRole createdAt updatedAt')
            .sort({ createdAt: -1 });

        // Calculate statistics
        const stats = {
            totalStaff: staffMembers.length,
            activeStaff: staffMembers.filter(staff => staff.isActive).length,
            inactiveStaff: staffMembers.filter(staff => !staff.isActive).length,
            totalActivities: staffMembers.reduce((total, staff) => total + (staff.activities?.length || 0), 0),
            todayActivities: 0
        };

        // Calculate today's activities
        const today = new Date().toDateString();
        staffMembers.forEach(staff => {
            if (staff.activities) {
                staff.activities.forEach(activity => {
                    if (new Date(activity.timestamp).toDateString() === today) {
                        stats.todayActivities++;
                    }
                });
            }
        });

        // Add activity count to each staff member
        const enrichedStaffMembers = staffMembers.map(staff => ({
            ...staff.toObject(),
            activityCount: staff.activities?.length || 0,
            todayActivityCount: staff.activities?.filter(activity =>
                new Date(activity.timestamp).toDateString() === today
            ).length || 0
        }));

        res.status(200).json({
            success: true,
            message: 'Staff members retrieved successfully',
            data: enrichedStaffMembers,
            stats
        });

    } catch (error) {
        console.error("Get all staff error:", error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// ========================================
// GET SINGLE STAFF WITH ACTIVITIES API
// ========================================

const getTenantStaffActivities = asyncHandler(async (req, res) => {
    try {
        const { staffId } = req.params;
        const { page = 1, limit = 50, activityType, dateFrom, dateTo } = req.query;
        let userId;
        const tenantId = req.user.tenantId;
        if (req.user.role === "staff") {
            userId = req.user.parentUser;
        }
        else {
            userId = req.user._id
        }
        // Validate if user is admin or has permission
        // if (req.user.role !== "admin" && !req.user.permissions?.canManageUsers) {
        //     return res.status(403).json({
        //         success: false,
        //         message: 'Access denied. Admin privileges required.'
        //     });
        // }

        // Find staff member
        const staff = await User.findOne({
            _id: staffId,
            tenantId: tenantId._id,
            role: "staff",
            createdBy: userId
            // $or: [
            //     { createdBy: req.user._id },
            //     { parentUser: req.user._id }
            // ]
        })
            .select('fullName username email phoneNo isActive lastLogin activities permissions parentRole');

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Staff member not found'
            });
        }

        let activities = staff.activities || [];

        // Filter by activity type if provided
        if (activityType && activityType !== 'all') {
            activities = activities.filter(activity => activity.activityType === activityType);
        }

        // Filter by date range if provided
        if (dateFrom || dateTo) {
            const fromDate = dateFrom ? new Date(dateFrom) : new Date('1970-01-01');
            const toDate = dateTo ? new Date(dateTo) : new Date();

            activities = activities.filter(activity => {
                const activityDate = new Date(activity.timestamp);
                return activityDate >= fromDate && activityDate <= toDate;
            });
        }

        // Sort activities by timestamp (newest first)
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const paginatedActivities = activities.slice(skip, skip + parseInt(limit));

        // Calculate statistics
        const stats = {
            totalActivities: activities.length,
            todayActivities: activities.filter(activity =>
                new Date(activity.timestamp).toDateString() === new Date().toDateString()
            ).length,
            activityTypes: {}
        };

        // Count activities by type
        activities.forEach(activity => {
            const type = activity.activityType;
            stats.activityTypes[type] = (stats.activityTypes[type] || 0) + 1;
        });

        res.status(200).json({
            success: true,
            message: 'Staff activities retrieved successfully',
            data: {
                staff: {
                    _id: staff._id,
                    fullName: staff.fullName,
                    username: staff.username,
                    email: staff.email,
                    phoneNo: staff.phoneNo,
                    isActive: staff.isActive,
                    lastLogin: staff.lastLogin,
                    permissions: staff.permissions,
                    parentRole: staff.parentRole
                },
                activities: paginatedActivities,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(activities.length / parseInt(limit)),
                    totalActivities: activities.length,
                    hasNextPage: skip + parseInt(limit) < activities.length,
                    hasPrevPage: parseInt(page) > 1
                },
                stats
            }
        });

    } catch (error) {
        console.error("Get staff activities error:", error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// ========================================
// GET ACTIVITY STATISTICS API
// ========================================

const getActivityStatistics = asyncHandler(async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { dateFrom, dateTo, staffId } = req.query;

        // Validate permissions
        if (req.user.role !== "admin" && !req.user.permissions?.canViewReports) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }

        // Build query
        let query = {
            tenantId: tenantId._id,
            role: "staff",
            $or: [
                { createdBy: req.user._id },
                { parentUser: req.user._id }
            ]
        };

        // Filter by specific staff if provided
        if (staffId) {
            query._id = staffId;
        }

        const staffMembers = await User.find(query)
            .select('fullName username activities isActive');

        // Date range for filtering
        const fromDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        const toDate = dateTo ? new Date(dateTo) : new Date();

        // Initialize statistics
        const stats = {
            totalStaff: staffMembers.length,
            activeStaff: staffMembers.filter(staff => staff.isActive).length,
            totalActivities: 0,
            activityTypes: {},
            dailyActivities: {},
            topStaff: [],
            recentActivities: []
        };

        const staffActivityCounts = [];

        // Process each staff member's activities
        staffMembers.forEach(staff => {
            if (!staff.activities) return;

            let staffActivityCount = 0;

            staff.activities.forEach(activity => {
                const activityDate = new Date(activity.timestamp);

                // Filter by date range
                if (activityDate >= fromDate && activityDate <= toDate) {
                    stats.totalActivities++;
                    staffActivityCount++;

                    // Count by activity type
                    const type = activity.activityType;
                    stats.activityTypes[type] = (stats.activityTypes[type] || 0) + 1;

                    // Count by day
                    const dayKey = activityDate.toDateString();
                    stats.dailyActivities[dayKey] = (stats.dailyActivities[dayKey] || 0) + 1;

                    // Add to recent activities (for top 20)
                    stats.recentActivities.push({
                        ...activity,
                        staffName: staff.fullName,
                        staffUsername: staff.username
                    });
                }
            });

            // Track staff activity counts
            if (staffActivityCount > 0) {
                staffActivityCounts.push({
                    staffId: staff._id,
                    fullName: staff.fullName,
                    username: staff.username,
                    activityCount: staffActivityCount,
                    isActive: staff.isActive
                });
            }
        });

        // Sort and get top 10 most active staff
        stats.topStaff = staffActivityCounts
            .sort((a, b) => b.activityCount - a.activityCount)
            .slice(0, 10);

        // Sort recent activities and get top 20
        stats.recentActivities = stats.recentActivities
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 20);

        // Calculate today's activities
        const today = new Date().toDateString();
        stats.todayActivities = stats.dailyActivities[today] || 0;

        // Calculate activity trends (last 7 days)
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayKey = date.toDateString();
            last7Days.push({
                date: dayKey,
                count: stats.dailyActivities[dayKey] || 0
            });
        }
        stats.weeklyTrend = last7Days;

        res.status(200).json({
            success: true,
            message: 'Activity statistics retrieved successfully',
            data: stats,
            dateRange: {
                from: fromDate,
                to: toDate
            }
        });

    } catch (error) {
        console.error("Get activity statistics error:", error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// ========================================
// GET ACTIVITY TYPES API
// ========================================

const getActivityTypes = asyncHandler(async (req, res) => {
    try {
        const activityTypes = [
            {
                value: 'login',
                label: 'System Login',
                icon: 'fas fa-sign-in-alt',
                color: '#38a169'
            },
            {
                value: 'booking',
                label: 'Booking Created',
                icon: 'fas fa-calendar-plus',
                color: '#319795'
            },
            {
                value: 'booking_cancellation',
                label: 'Booking Cancelled',
                icon: 'fas fa-calendar-times',
                color: '#e53e3e'
            },
            {
                value: 'payment',
                label: 'Payment Processing',
                icon: 'fas fa-credit-card',
                color: '#3182ce'
            },
            {
                value: 'user_management',
                label: 'User Management',
                icon: 'fas fa-users-cog',
                color: '#805ad5'
            },
            {
                value: 'test_create',
                label: 'Test/Lab Management',
                icon: 'fas fa-flask',
                color: '#805ad5'
            },
            {
                value: 'subscription_renewal',
                label: 'Subscription Renewal',
                icon: 'fas fa-redo-alt',
                color: '#38a169'
            },
            {
                value: 'subscription_expiry',
                label: 'Subscription Expiry',
                icon: 'fas fa-exclamation-triangle',
                color: '#d69e2e'
            },
            {
                value: 'referral_commission',
                label: 'Referral Commission',
                icon: 'fas fa-handshake',
                color: '#38a169'
            },
            {
                value: 'withdrawal_request',
                label: 'Withdrawal Request',
                icon: 'fas fa-money-bill-wave',
                color: '#3182ce'
            },
            {
                value: 'other',
                label: 'Other Activities',
                icon: 'fas fa-activity',
                color: '#718096'
            }
        ];

        res.status(200).json({
            success: true,
            message: 'Activity types retrieved successfully',
            data: activityTypes
        });

    } catch (error) {
        console.error("Get activity types error:", error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// ========================================
// EXPORT STAFF ACTIVITIES API
// ========================================

export {
    createStaff,
    loginStaff,
    logoutStaff,
    getAllStaff,
    getStaffById,
    updateStaff,
    deleteStaff,
    getStaffActivities,
    changeStaffPassword,
    staffActivity,
    oneStaffActivity,
    staffDashboard,
    allStaff,
    getAllStaffWithActivities,
    getTenantStaffActivities,
    getStaffByIdTenant,
    updateStaffTenant,
    deleteStaffTenant,
};