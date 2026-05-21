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
    if (!franchiseeId || !month || !amount) {
        throw new ApiError(400, "All fields are required");
    }

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
        existingTarget.amount = amount;
        existingTarget.remarks = remarks;
        existingTarget.lastUpdated = new Date();
        await existingTarget.save();

        return res.status(200).json(
            new ApiResponse(200, existingTarget, "Target updated successfully")
        );
    }

    // Create new target
    const target = await Target.create({
        franchiseeId,
        fullName,
        assignedBy: req.user._id,
        month,
        amount,
        remarks,
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
        .populate('franchiseeId', 'username fullName')
        .populate('assignedBy', 'username fullName')
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
        // If no target exists, log the achievement anyway
        const newTarget = await Target.create({
            franchiseeId,
            assignedBy: req.user._id,
            month: currentMonth,
            amount: 0, // No target set
            achieved: amount,
            tenantId: req.user.tenantId,
            history: [{
                amount,
                bookingId,
                description: 'Booking completed (No target set)'
            }]
        });

        return res.status(200).json(
            new ApiResponse(200, newTarget, "Achievement recorded without target")
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
        const franchisees = await User.find({ parentUser: userId });
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

    // If no target exists for current month
    if (!target) {
        return res.status(200).json(
            new ApiResponse(200, {
                month: currentMonth,
                amount: 0,
                achieved: 0,
                status: 'pending'
            }, "No target set for current month")
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

export {
    assignTarget,
    getTargets,
    getFranchiseePerformance,
    updateTargetAchievement,
    getTargetAnalytics,
    getCurrentMonthTarget
};