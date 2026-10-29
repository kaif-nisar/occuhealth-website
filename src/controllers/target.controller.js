import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Target } from "../models/target.model.js";
import { User } from "../models/user.model.js";
import mongoose from "mongoose";

// Assign monthly target to franchisee
const assignTarget = asyncHandler(async (req, res) => {
    const {
        franchiseeId,
        fullName,
        month,
        amount,
        remarks
    } = req.body;
    // Validation
    if (!franchiseeId || !month || amount === undefined || amount === null) {
        throw new ApiError(400, "Franchisee, month and target amount are required");
    }

    const numericAmount = Number(amount) >= 0 ? Number(amount) : 200000;

    // Check if franchisee exists
    const franchisee = await User.findById(franchiseeId);
    if (!franchisee) {
        throw new ApiError(404, "Franchisee not found");
    }

    // Check if target already exists for this month
    const existingTarget = await Target.findOne({
        franchiseeId,
        month,
        tenantId: req.user.tenantId
    });

    if (existingTarget) {
        // Update existing target
        existingTarget.amount = numericAmount;
        if (remarks !== undefined) existingTarget.remarks = remarks;
        if (fullName) existingTarget.fullName = fullName;
        existingTarget.lastUpdated = new Date();
        await existingTarget.save();

        return res.status(200).json(
            new ApiResponse(200, existingTarget, "Target updated successfully")
        );
    }

    // Create new target
    const target = await Target.create({
        franchiseeId,
        fullName: fullName || franchisee.fullName || franchisee.username,
        assignedBy: req.user._id,
        month,
        amount: numericAmount,
        remarks: remarks || "",
        tenantId: req.user.tenantId
    });

    return res.status(201).json(
        new ApiResponse(201, target, "Target assigned successfully")
    );
});

// Get targets for a specific month
const getTargets = asyncHandler(async (req, res) => {
    const { month, role, userId } = req.body;

    // Default to current month if not specified
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    let query = { 
        tenantId: req.user.tenantId,
        month: targetMonth
    };

    // If role is not admin, only show targets for the user's hierarchy
    if (role !== 'admin') {
        const userIds = await getUserHierarchy(userId);
        query.franchiseeId = { $in: userIds };
    }

    const targets = await Target.find(query)
        .populate('franchiseeId', 'username fullName role email phoneNumber phoneNo')
        .populate('assignedBy', 'username fullName role')
        .sort('-createdAt');

    // Calculate summary statistics
    const summary = {
        totalTarget: targets.reduce((sum, t) => sum + t.amount, 0),
        totalAchieved: targets.reduce((sum, t) => sum + t.achieved, 0),
        totalFranchisees: targets.length,
        achievedCount: targets.filter(t => t.status === 'achieved').length
    };

    return res.status(200).json(
        new ApiResponse(200, { targets, summary }, "Targets fetched successfully")
    );
});

// Get performance history for a franchisee
const getFranchiseePerformance = asyncHandler(async (req, res) => {
    const { franchiseeId, months = 6 } = req.params;

    const performance = await Target.getFranchiseePerformance(franchiseeId, parseInt(months));

    // Calculate performance metrics
    const metrics = {
        totalTargets: performance.length,
        achievedTargets: performance.filter(t => t.status === 'achieved').length,
        averageAchievement: performance.reduce((sum, t) => 
            sum + (t.achieved / t.amount) * 100, 0) / performance.length || 0
    };

    return res.status(200).json(
        new ApiResponse(200, 
            { performance, metrics }, 
            "Performance data fetched successfully"
        )
    );
});

// Update target achievement (called when a booking is completed)
const updateTargetAchievement = asyncHandler(async (req, res) => {
    const { franchiseeId, amount, bookingId } = req.body;
    
    // Find current month's target
    const currentMonth = new Date().toISOString().slice(0, 7);
    const target = await Target.findOne({
        franchiseeId,
        month: currentMonth,
        tenantId: req.user.tenantId
    });

    if (!target) {
        // If no target exists, log the achievement with default target 200,000 (2 Lakhs)
        const newTarget = await Target.create({
            franchiseeId,
            assignedBy: req.user._id,
            month: currentMonth,
            amount: 200000, // Default target 2 Lakhs
            achieved: amount,
            tenantId: req.user.tenantId,
            history: [{
                amount,
                bookingId,
                description: 'Booking completed (Default 2L target)'
            }]
        });

        return res.status(200).json(
            new ApiResponse(200, newTarget, "Achievement recorded with default target")
        );
    }

    // Update existing target
    await target.updateAchieved(amount, bookingId);

    return res.status(200).json(
        new ApiResponse(200, target, "Target achievement updated successfully")
    );
});

// Helper function to get user hierarchy
async function getUserHierarchy(userId) {
    const user = await User.findById(userId);
    if (!user) return [userId];

    let userIds = [userId];
    
    // If user is superFranchisee, include all their franchisees
    if (user.role === 'superFranchisee') {
        const franchisees = await User.find({
            $or: [{ parentUser: userId }, { createdBy: userId }]
        });
        userIds = userIds.concat(franchisees.map(f => f._id));
    }
    
    return userIds;
}

// Get dashboard analytics
// Get current month's target for logged in user
const getCurrentMonthTarget = asyncHandler(async (req, res) => {
    const currentMonth = new Date().toISOString().slice(0, 7); // Format: YYYY-MM
    
    const target = await Target.findOne({
        franchiseeId: req.user._id,
        month: currentMonth,
        tenantId: req.user.tenantId._id
    }).select('month amount achieved status');

    // If no target exists for current month, return default 2 Lakhs target
    if (!target) {
        return res.status(200).json(
            new ApiResponse(200, {
                month: currentMonth,
                amount: 200000,
                achieved: 0,
                status: 'pending'
            }, "Default target for current month (₹2,00,000)")
        );
    }

    return res.status(200).json(
        new ApiResponse(200, target, "Current month target fetched successfully")
    );
});

const getTargetAnalytics = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const tenantId = req.user.tenantId;

    // Default to last 6 months if dates not provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getFullYear(), end.getMonth() - 5, 1);

    const targets = await Target.find({
        tenantId,
        createdAt: { $gte: start, $lte: end }
    }).populate('franchiseeId', 'username fullName');

    // Monthly trends
    const monthlyData = {};
    targets.forEach(target => {
        const month = target.month;
        if (!monthlyData[month]) {
            monthlyData[month] = {
                target: 0,
                achieved: 0,
                count: 0
            };
        }
        monthlyData[month].target += target.amount;
        monthlyData[month].achieved += target.achieved;
        monthlyData[month].count++;
    });

    // Top performers
    const topPerformers = await Target.aggregate([
        {
            $match: {
                tenantId: new mongoose.Types.ObjectId(tenantId),
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: '$franchiseeId',
                totalTarget: { $sum: '$amount' },
                totalAchieved: { $sum: '$achieved' },
                completionRate: { 
                    $avg: { 
                        $multiply: [
                            { $divide: ['$achieved', '$amount'] },
                            100
                        ]
                    }
                }
            }
        },
        {
            $sort: { completionRate: -1 }
        },
        {
            $limit: 5
        }
    ]);

    // Populate franchisee details for top performers
    const populatedTopPerformers = await User.populate(topPerformers, {
        path: '_id',
        select: 'username fullName'
    });

    const analytics = {
        monthlyTrends: monthlyData,
        topPerformers: populatedTopPerformers,
        summary: {
            totalTargets: targets.length,
            averageCompletion: targets.reduce((sum, t) => 
                sum + (t.achieved / t.amount) * 100, 0) / targets.length || 0,
            totalAmount: targets.reduce((sum, t) => sum + t.amount, 0),
            totalAchieved: targets.reduce((sum, t) => sum + t.achieved, 0)
        }
    };

    return res.status(200).json(
        new ApiResponse(200, analytics, "Target analytics fetched successfully")
    );
});

// Bulk assign or update targets (e.g. set default 2 Lakhs to all or multiple franchisees)
const bulkAssignTargets = asyncHandler(async (req, res) => {
    const { month, amount = 200000, targets = [], remarks = "Default monthly target" } = req.body;

    if (!month) {
        throw new ApiError(400, "Target month is required");
    }

    const defaultAmount = Number(amount) >= 0 ? Number(amount) : 200000;
    const authTenantId = req.user.tenantId?._id?.toString() || req.user.tenantId?.toString();

    let itemsToProcess = [];
    if (Array.isArray(targets) && targets.length > 0) {
        itemsToProcess = targets;
    } else {
        // Find all franchisees (superFranchisee, franchisee, subFranchisee) for this tenant
        const users = await User.find({
            tenantId: authTenantId,
            role: { $in: ['superFranchisee', 'franchisee', 'subFranchisee'] }
        }).select('_id fullName username role');

        itemsToProcess = users.map(u => ({
            franchiseeId: u._id,
            fullName: u.fullName || u.username,
            amount: defaultAmount,
            remarks: remarks
        }));
    }

    const updated = [];
    for (const item of itemsToProcess) {
        if (!item.franchiseeId) continue;
        const targetAmount = item.amount !== undefined ? Number(item.amount) : defaultAmount;
        
        const existing = await Target.findOne({
            franchiseeId: item.franchiseeId,
            month,
            tenantId: req.user.tenantId
        });

        if (existing) {
            existing.amount = targetAmount;
            if (item.remarks) existing.remarks = item.remarks;
            if (item.fullName) existing.fullName = item.fullName;
            existing.lastUpdated = new Date();
            await existing.save();
            updated.push(existing);
        } else {
            const created = await Target.create({
                franchiseeId: item.franchiseeId,
                fullName: item.fullName || "Franchisee",
                assignedBy: req.user._id,
                month,
                amount: targetAmount,
                remarks: item.remarks || remarks,
                tenantId: req.user.tenantId
            });
            updated.push(created);
        }
    }

    return res.status(200).json(
        new ApiResponse(200, { count: updated.length, targets: updated }, "Targets assigned/updated successfully")
    );
});

export {
    assignTarget,
    bulkAssignTargets,
    getTargets,
    getFranchiseePerformance,
    updateTargetAchievement,
    getTargetAnalytics,
    getCurrentMonthTarget
};