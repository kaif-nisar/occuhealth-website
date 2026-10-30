import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Target } from "../models/target.model.js";
import { User } from "../models/user.model.js";
import { newBooking } from "../models/NewBooking.model.js";
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

// Comprehensive Franchisee Business Analytics
// Provides revenue, target vs achieved, number of tests, number of tubes, samples, and daily averages
const getFranchiseeBusinessAnalytics = asyncHandler(async (req, res) => {
    // 1. Strict Layer Protection: Disallow single-layer setups
    const tenantModelType = req.user.tenantId?.modelType;
    if (tenantModelType === '1layer') {
        return res.status(403).json(
            new ApiResponse(403, null, "Franchisee Business Analytics is not accessible in a single-layer lab setup.")
        );
    }

    const authTenantId = req.user.tenantId?._id?.toString() || req.user.tenantId?.toString();
    if (!authTenantId) {
        throw new ApiError(400, "Tenant context is missing");
    }

    const {
        period = 'month', // 'today', 'week', 'month', 'custom'
        startDate,
        endDate,
        month, // 'YYYY-MM'
        franchiseeId // 'all' or specific ObjectId
    } = req.query;

    const now = new Date();
    const currentMonthStr = now.toISOString().slice(0, 7);
    const targetMonth = month || currentMonthStr;

    // 2. Date Range Computation
    let rangeStart;
    let rangeEnd = new Date();
    let daysCount = 30;

    if (period === 'today') {
        rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        daysCount = 1;
    } else if (period === 'week') {
        const d7 = new Date(now);
        d7.setDate(d7.getDate() - 6);
        rangeStart = new Date(d7.getFullYear(), d7.getMonth(), d7.getDate(), 0, 0, 0, 0);
        daysCount = 7;
    } else if (period === 'month') {
        if (month) {
            const [y, m] = month.split('-').map(Number);
            rangeStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
            const lastDayDate = new Date(y, m, 0);
            if (month === currentMonthStr) {
                rangeEnd = now;
                daysCount = Math.max(1, now.getDate());
            } else {
                rangeEnd = new Date(y, m, 0, 23, 59, 59, 999);
                daysCount = lastDayDate.getDate();
            }
        } else {
            rangeStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            rangeEnd = now;
            daysCount = Math.max(1, now.getDate());
        }
    } else if (period === 'custom') {
        if (startDate) {
            const pStart = new Date(startDate);
            rangeStart = isNaN(pStart.getTime()) ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(pStart.setHours(0, 0, 0, 0));
        } else {
            rangeStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        }

        if (endDate) {
            const pEnd = new Date(endDate);
            rangeEnd = isNaN(pEnd.getTime()) ? now : new Date(pEnd.setHours(23, 59, 59, 999));
        } else {
            rangeEnd = now;
        }

        const diffMs = rangeEnd.getTime() - rangeStart.getTime();
        daysCount = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    } else {
        const d30 = new Date(now);
        d30.setDate(d30.getDate() - 29);
        rangeStart = new Date(d30.getFullYear(), d30.getMonth(), d30.getDate(), 0, 0, 0, 0);
        daysCount = 30;
    }

    // 3. Franchisee Resolution based on User Role & Permission
    const tenantObjectId = new mongoose.Types.ObjectId(authTenantId);
    let baseFranchiseeFilter = {
        tenantId: tenantObjectId,
        role: { $in: ['superFranchisee', 'franchisee', 'subFranchisee'] }
    };

    if (req.user.role === 'superFranchisee') {
        const children = await User.find({
            $or: [{ parentUser: req.user._id }, { createdBy: req.user._id }]
        }).select('_id');
        const allowedIds = [req.user._id, ...children.map(c => c._id)];
        baseFranchiseeFilter._id = { $in: allowedIds };
    } else if (req.user.role === 'franchisee' || req.user.role === 'subFranchisee') {
        baseFranchiseeFilter._id = req.user._id;
    }

    // All available franchisees for dropdown
    const allDropdownFranchisees = await User.find(baseFranchiseeFilter)
        .select('_id fullName username role phoneNo email clinicName isActive')
        .sort({ fullName: 1, username: 1 })
        .lean();

    // Filter to specific franchisee if selected
    let activeFranchiseeList = allDropdownFranchisees;
    let isSingleFranchiseeFilter = false;

    if (franchiseeId && franchiseeId !== 'all' && mongoose.Types.ObjectId.isValid(franchiseeId)) {
        const selectedIdStr = franchiseeId.toString();
        activeFranchiseeList = allDropdownFranchisees.filter(f => f._id.toString() === selectedIdStr);
        isSingleFranchiseeFilter = true;
    }

    const activeFranchiseeIds = activeFranchiseeList.map(f => f._id);
    const activeFranchiseeObjectIds = activeFranchiseeIds.map(id => new mongoose.Types.ObjectId(id));
    const activeFranchiseeStringIds = activeFranchiseeIds.map(id => id.toString());
    const matchIds = [...activeFranchiseeObjectIds, ...activeFranchiseeStringIds];

    // 4. Fetch Monthly Targets (Default ₹2,00,000 if not set)
    const targetDocs = await Target.find({
        tenantId: tenantObjectId,
        month: targetMonth,
        franchiseeId: { $in: activeFranchiseeIds }
    }).lean();

    const targetMap = new Map();
    targetDocs.forEach(t => {
        targetMap.set(t.franchiseeId.toString(), t);
    });

    // 5. Booking Aggregation from newBooking
    let bookingAggregates = {
        byFranchisee: [],
        dailyTimeline: [],
        tubeTypes: [],
        topTests: []
    };

    if (activeFranchiseeIds.length > 0) {
        const bookingMatch = {
            tenantId: tenantObjectId,
            status: { $ne: 'cancelled' },
            $and: [
                {
                    $or: [
                        { createdAt: { $gte: rangeStart, $lte: rangeEnd } },
                        {
                            $and: [
                                { createdAt: { $exists: false } },
                                { date: { $gte: rangeStart, $lte: rangeEnd } }
                            ]
                        }
                    ]
                },
                {
                    $or: [
                        { createdBy: { $in: matchIds } },
                        { subFranchiseeId: { $in: matchIds } }
                    ]
                }
            ]
        };

        const aggregationResult = await newBooking.aggregate([
            { $match: bookingMatch },
            {
                $project: {
                    total: { $ifNull: ["$total", 0] },
                    createdBy: 1,
                    subFranchiseeId: 1,
                    bookingDate: { $ifNull: ["$createdAt", "$date"] },
                    tableData: { $ifNull: ["$tableData", []] }
                }
            },
            {
                $addFields: {
                    franchiseeRef: {
                        $cond: [
                            { $in: ["$subFranchiseeId", matchIds] },
                            "$subFranchiseeId",
                            "$createdBy"
                        ]
                    },
                    tubeCount: {
                        $cond: [
                            { $gt: [{ $size: "$tableData" }, 0] },
                            { $size: "$tableData" },
                            1
                        ]
                    },
                    testCount: {
                        $cond: [
                            { $gt: [{ $size: "$tableData" }, 0] },
                            { $size: "$tableData" },
                            1
                        ]
                    }
                }
            },
            {
                $facet: {
                    byFranchisee: [
                        {
                            $group: {
                                _id: "$franchiseeRef",
                                totalRevenue: { $sum: "$total" },
                                sampleCount: { $sum: 1 },
                                tubeCount: { $sum: "$tubeCount" },
                                testCount: { $sum: "$testCount" },
                                lastBooking: { $max: "$bookingDate" }
                            }
                        }
                    ],
                    dailyTimeline: [
                        {
                            $group: {
                                _id: {
                                    year: { $year: "$bookingDate" },
                                    month: { $month: "$bookingDate" },
                                    day: { $dayOfMonth: "$bookingDate" }
                                },
                                revenue: { $sum: "$total" },
                                samples: { $sum: 1 },
                                tubes: { $sum: "$tubeCount" },
                                tests: { $sum: "$testCount" }
                            }
                        },
                        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
                    ],
                    tubeTypes: [
                        { $unwind: "$tableData" },
                        {
                            $project: {
                                sampleType: {
                                    $trim: {
                                        input: { $ifNull: ["$tableData.typeOfSample", "General / Plain"] }
                                    }
                                }
                            }
                        },
                        {
                            $group: {
                                _id: {
                                    $cond: [
                                        { $or: [{ $eq: ["$sampleType", ""] }, { $eq: ["$sampleType", null] }] },
                                        "General / Plain",
                                        "$sampleType"
                                    ]
                                },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { count: -1 } },
                        { $limit: 8 }
                    ],
                    topTests: [
                        { $unwind: "$tableData" },
                        {
                            $project: {
                                testName: {
                                    $trim: {
                                        input: { $ifNull: ["$tableData.testName", "Routine Test"] }
                                    }
                                }
                            }
                        },
                        {
                            $group: {
                                _id: {
                                    $cond: [
                                        { $or: [{ $eq: ["$testName", ""] }, { $eq: ["$testName", null] }] },
                                        "Routine Test",
                                        "$testName"
                                    ]
                                },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { count: -1 } },
                        { $limit: 10 }
                    ]
                }
            }
        ]);

        if (aggregationResult && aggregationResult[0]) {
            bookingAggregates = aggregationResult[0];
        }
    }

    // Build Franchisee map from aggregation
    const franchiseeStatsMap = new Map();
    (bookingAggregates.byFranchisee || []).forEach(item => {
        if (item && item._id) {
            franchiseeStatsMap.set(item._id.toString(), item);
        }
    });

    // 6. Build Detailed Franchisee Records
    const DEFAULT_TARGET = 200000; // 2 Lakhs standard quota
    let overallTargetSum = 0;
    let overallRevenueSum = 0;
    let overallSampleSum = 0;
    let overallTestSum = 0;
    let overallTubeSum = 0;

    const detailedFranchisees = activeFranchiseeList.map(franchisee => {
        const fId = franchisee._id.toString();
        const targetDoc = targetMap.get(fId);
        const stats = franchiseeStatsMap.get(fId) || {
            totalRevenue: 0,
            sampleCount: 0,
            tubeCount: 0,
            testCount: 0,
            lastBooking: null
        };

        const targetAmount = targetDoc ? targetDoc.amount : DEFAULT_TARGET;
        const totalRevenue = stats.totalRevenue || 0;
        const totalSamples = stats.sampleCount || 0;
        const totalTubes = stats.tubeCount || 0;
        const totalTests = stats.testCount || 0;

        overallTargetSum += targetAmount;
        overallRevenueSum += totalRevenue;
        overallSampleSum += totalSamples;
        overallTestSum += totalTests;
        overallTubeSum += totalTubes;

        const percentage = targetAmount > 0
            ? Number(((totalRevenue / targetAmount) * 100).toFixed(1))
            : 0;

        const deficit = Math.max(0, targetAmount - totalRevenue);
        const surplus = Math.max(0, totalRevenue - targetAmount);

        let status = 'pending';
        if (totalRevenue >= targetAmount) {
            status = 'achieved';
        } else if (percentage >= 70) {
            status = 'on_track';
        }

        // Daily Averages
        const avgSamplesPerDay = Number((totalSamples / daysCount).toFixed(1));
        const avgRevenuePerDay = Math.round(totalRevenue / daysCount);
        const avgTestsPerDay = Number((totalTests / daysCount).toFixed(1));
        const avgTubesPerDay = Number((totalTubes / daysCount).toFixed(1));
        const avgTicketSize = totalSamples > 0 ? Math.round(totalRevenue / totalSamples) : 0;

        return {
            _id: franchisee._id,
            fullName: franchisee.fullName || franchisee.username,
            username: franchisee.username,
            role: franchisee.role,
            phoneNo: franchisee.phoneNo ? String(franchisee.phoneNo) : (franchisee.phoneNumber ? String(franchisee.phoneNumber) : ''),
            email: franchisee.email ? String(franchisee.email) : '',
            clinicName: franchisee.clinicName ? String(franchisee.clinicName) : '',
            isActive: franchisee.isActive !== false,
            target: targetAmount,
            isCustomTarget: Boolean(targetDoc),
            targetRemarks: targetDoc ? targetDoc.remarks : '',
            achievedRevenue: totalRevenue,
            percentage,
            deficit,
            surplus,
            status,
            totalSamples,
            totalTubes,
            totalTests,
            avgSamplesPerDay,
            avgRevenuePerDay,
            avgTestsPerDay,
            avgTubesPerDay,
            avgTicketSize,
            lastBooking: stats.lastBooking
        };
    });

    // Sort by achieved revenue descending
    detailedFranchisees.sort((a, b) => b.achievedRevenue - a.achievedRevenue);

    // 7. Overall Summary Metrics
    const achievementRate = overallTargetSum > 0
        ? Number(((overallRevenueSum / overallTargetSum) * 100).toFixed(1))
        : 0;

    const summary = {
        totalTarget: overallTargetSum,
        totalAchieved: overallRevenueSum,
        achievementRate,
        totalDeficit: Math.max(0, overallTargetSum - overallRevenueSum),
        totalSurplus: Math.max(0, overallRevenueSum - overallTargetSum),
        totalSamples: overallSampleSum,
        totalTests: overallTestSum,
        totalTubes: overallTubeSum,
        avgSamplesPerDay: Number((overallSampleSum / daysCount).toFixed(1)),
        avgRevenuePerDay: Math.round(overallRevenueSum / daysCount),
        avgTestsPerDay: Number((overallTestSum / daysCount).toFixed(1)),
        avgTubesPerDay: Number((overallTubeSum / daysCount).toFixed(1)),
        avgTicketSize: overallSampleSum > 0 ? Math.round(overallRevenueSum / overallSampleSum) : 0,
        daysCount,
        period,
        targetMonth,
        dateRange: {
            start: rangeStart.toISOString(),
            end: rangeEnd.toISOString()
        },
        franchiseeCount: detailedFranchisees.length,
        achievedCount: detailedFranchisees.filter(f => f.status === 'achieved').length
    };

    // 8. Format Chart Data
    // A) Continuous timeline generator
    const timelineLabels = [];
    const timelineRevenue = [];
    const timelineSamples = [];
    const timelineTubes = [];

    // Map aggregated daily rows by YYYY-MM-DD
    const dailyMap = new Map();
    (bookingAggregates.dailyTimeline || []).forEach(row => {
        if (row && row._id) {
            const y = row._id.year;
            const m = String(row._id.month).padStart(2, '0');
            const d = String(row._id.day).padStart(2, '0');
            const key = `${y}-${m}-${d}`;
            dailyMap.set(key, row);
        }
    });

    // Step day by day through range
    const cursor = new Date(rangeStart);
    const timelineEndLimit = new Date(rangeEnd);
    const maxTimelineDays = 60; // Cap to reasonable points
    let pointsCount = 0;

    while (cursor <= timelineEndLimit && pointsCount < maxTimelineDays) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = String(cursor.getDate()).padStart(2, '0');
        const dateKey = `${y}-${m}-${d}`;
        const label = cursor.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

        const row = dailyMap.get(dateKey) || { revenue: 0, samples: 0, tubes: 0 };
        timelineLabels.push(label);
        timelineRevenue.push(row.revenue || 0);
        timelineSamples.push(row.samples || 0);
        timelineTubes.push(row.tubes || 0);

        cursor.setDate(cursor.getDate() + 1);
        pointsCount++;
    }

    // B) Tube Types Data
    const tubeTypeLabels = [];
    const tubeTypeData = [];
    (bookingAggregates.tubeTypes || []).forEach(t => {
        tubeTypeLabels.push(t._id || 'Standard Tube');
        tubeTypeData.push(t.count || 0);
    });

    // C) Top Tests Data
    const topTestLabels = [];
    const topTestData = [];
    (bookingAggregates.topTests || []).forEach(t => {
        topTestLabels.push(t._id || 'Routine');
        topTestData.push(t.count || 0);
    });

    // D) Target Comparison (Top 5 Performers)
    const topPerformersComparison = detailedFranchisees.slice(0, 6).map(f => ({
        name: f.fullName.length > 15 ? f.fullName.slice(0, 15) + '…' : f.fullName,
        target: f.target,
        achieved: f.achievedRevenue,
        rate: f.percentage
    }));

    return res.status(200).json(
        new ApiResponse(200, {
            summary,
            franchisees: detailedFranchisees,
            dropdownFranchisees: allDropdownFranchisees.map(f => ({
                _id: f._id,
                fullName: f.fullName || f.username,
                username: f.username,
                role: f.role
            })),
            charts: {
                timeline: {
                    labels: timelineLabels,
                    revenue: timelineRevenue,
                    samples: timelineSamples,
                    tubes: timelineTubes
                },
                tubeTypes: {
                    labels: tubeTypeLabels,
                    data: tubeTypeData
                },
                topTests: {
                    labels: topTestLabels,
                    data: topTestData
                },
                topPerformers: topPerformersComparison
            }
        }, "Franchisee business analytics fetched successfully")
    );
});

export {
    assignTarget,
    bulkAssignTargets,
    getTargets,
    getFranchiseePerformance,
    updateTargetAchievement,
    getTargetAnalytics,
    getCurrentMonthTarget,
    getFranchiseeBusinessAnalytics
};