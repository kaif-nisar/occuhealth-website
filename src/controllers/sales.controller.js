import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { newBooking } from "../models/NewBooking.model.js";
import { Target } from "../models/target.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { resolveSalesHierarchy } from "../services/salesHierarchy.service.js";

/**
 * 1. GET /api/v1/sales/hierarchy
 * Returns user profile, sales designation, subordinate counts, and full tree structure.
 */
export const getSalesHierarchy = asyncHandler(async (req, res) => {
    const targetUserId = req.query.userId || req.user._id;
    const hierarchy = await resolveSalesHierarchy(targetUserId, req.user.tenantId?._id);

    return res.status(200).json(
        new ApiResponse(200, hierarchy, "Sales hierarchy retrieved successfully")
    );
});

/**
 * 2. GET /api/v1/sales/business-analytics
 * Real-time business analytics for Sales Team (matching Franchisee Business portal):
 * Target quotas vs achieved, Revenue, Patient samples, Tests, Tube types breakdown,
 * daily averages, timeline trend, and downline breakdown table.
 */
export const getSalesBusinessAnalytics = asyncHandler(async (req, res) => {
    const authTenantId = req.user.tenantId?._id?.toString() || req.user.tenantId?.toString();
    if (!authTenantId) {
        throw new ApiError(400, "Tenant context is missing");
    }
    const tenantObjectId = new mongoose.Types.ObjectId(authTenantId);

    const {
        period = 'month', // 'today', 'week', 'month', 'custom'
        startDate,
        endDate,
        month, // 'YYYY-MM'
        filterType = 'all', // 'all', 'rsm', 'asm', 'th', 'franchisee'
        filterId,
        targetUserId
    } = req.query;

    const now = new Date();
    const currentMonthStr = now.toISOString().slice(0, 7);
    const targetMonth = month || currentMonthStr;

    // 1. Date Range Computation
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

    // 2. Resolve Sales Hierarchy
    const effectiveUserId = targetUserId || req.user._id;
    const hierarchy = await resolveSalesHierarchy(effectiveUserId, authTenantId);

    // 3. Resolve Target Franchisee Scope based on filters
    let activeFranchiseeIds = [];

    if (filterType === 'franchisee' && filterId && mongoose.Types.ObjectId.isValid(filterId)) {
        activeFranchiseeIds = [new mongoose.Types.ObjectId(filterId)];
    } else if (filterType === 'th' && filterId && mongoose.Types.ObjectId.isValid(filterId)) {
        const subHierarchy = await resolveSalesHierarchy(filterId, authTenantId);
        activeFranchiseeIds = subHierarchy.flatIds.franchiseeIds;
    } else if (filterType === 'asm' && filterId && mongoose.Types.ObjectId.isValid(filterId)) {
        const subHierarchy = await resolveSalesHierarchy(filterId, authTenantId);
        activeFranchiseeIds = subHierarchy.flatIds.franchiseeIds;
    } else if (filterType === 'rsm' && filterId && mongoose.Types.ObjectId.isValid(filterId)) {
        const subHierarchy = await resolveSalesHierarchy(filterId, authTenantId);
        activeFranchiseeIds = subHierarchy.flatIds.franchiseeIds;
    } else {
        // 'all' -> all franchisees in hierarchy
        activeFranchiseeIds = hierarchy.flatIds.franchiseeIds;
    }

    const activeFranchiseeObjectIds = activeFranchiseeIds.map(id => new mongoose.Types.ObjectId(id));
    const activeFranchiseeStringIds = activeFranchiseeIds.map(id => id.toString());
    const matchIds = [...activeFranchiseeObjectIds, ...activeFranchiseeStringIds];

    // 4. Fetch Monthly Targets for the active franchisees & user target
    const targetDocs = await Target.find({
        tenantId: tenantObjectId,
        month: targetMonth,
        franchiseeId: { $in: activeFranchiseeObjectIds }
    }).lean();

    const targetMap = new Map();
    targetDocs.forEach(t => {
        targetMap.set(t.franchiseeId.toString(), t);
    });

    let defaultTargetPerLab = 200000;
    let totalTargetAmount = 0;

    if (hierarchy.user.monthlySalesTarget && hierarchy.user.monthlySalesTarget > 0 && filterType === 'all') {
        totalTargetAmount = hierarchy.user.monthlySalesTarget;
    } else {
        activeFranchiseeObjectIds.forEach(fId => {
            const t = targetMap.get(fId.toString());
            totalTargetAmount += t?.amount !== undefined ? Number(t.amount) : defaultTargetPerLab;
        });
    }

    // 5. Booking Aggregation from newBooking
    let bookingAggregates = {
        byFranchisee: [],
        dailyTimeline: [],
        tubeTypes: [],
        topTests: []
    };

    if (activeFranchiseeObjectIds.length > 0) {
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

    // 6. Calculate Totals & Averages
    let totalRevenue = 0;
    let totalSamples = 0;
    let totalTubes = 0;
    let totalTests = 0;

    const franchiseeSalesMap = new Map();

    bookingAggregates.byFranchisee.forEach(item => {
        const idKey = item._id ? item._id.toString() : '';
        totalRevenue += Number(item.totalRevenue || 0);
        totalSamples += Number(item.sampleCount || 0);
        totalTubes += Number(item.tubeCount || 0);
        totalTests += Number(item.testCount || 0);

        franchiseeSalesMap.set(idKey, item);
    });

    const avgRevenuePerDay = daysCount > 0 ? (totalRevenue / daysCount) : 0;
    const avgSamplesPerDay = daysCount > 0 ? (totalSamples / daysCount) : 0;
    const avgTestsPerDay = daysCount > 0 ? (totalTests / daysCount) : 0;
    const avgTubesPerDay = daysCount > 0 ? (totalTubes / daysCount) : 0;
    const avgTicketSize = totalSamples > 0 ? (totalRevenue / totalSamples) : 0;
    const avgTubesPerSample = totalSamples > 0 ? (totalTubes / totalSamples) : 0;
    const avgTestsPerSample = totalSamples > 0 ? (totalTests / totalSamples) : 0;

    const achievementPct = totalTargetAmount > 0 ? Math.min(Math.round((totalRevenue / totalTargetAmount) * 100), 1000) : 0;
    const deficitAmount = Math.max(0, totalTargetAmount - totalRevenue);

    // 7. Format Daily Timeline
    const formattedTimeline = bookingAggregates.dailyTimeline.map(item => {
        const pad = n => String(n).padStart(2, '0');
        const dateStr = `${item._id.year}-${pad(item._id.month)}-${pad(item._id.day)}`;
        return {
            date: dateStr,
            revenue: Number(item.revenue || 0),
            samples: Number(item.samples || 0),
            tubes: Number(item.tubes || 0),
            tests: Number(item.tests || 0)
        };
    });

    // 8. Build Downline Performance Table based on designation
    let breakdownRows = [];
    const desig = hierarchy.user.salesDesignation;

    // Helper to sum stats for a list of franchisee IDs
    const getStatsForFranchiseeIds = (fIds = []) => {
        let rev = 0, samp = 0, tubes = 0, tests = 0, targetAmt = 0;
        fIds.forEach(id => {
            const key = id.toString();
            const b = franchiseeSalesMap.get(key);
            if (b) {
                rev += Number(b.totalRevenue || 0);
                samp += Number(b.sampleCount || 0);
                tubes += Number(b.tubeCount || 0);
                tests += Number(b.testCount || 0);
            }
            const t = targetMap.get(key);
            targetAmt += t?.amount !== undefined ? Number(t.amount) : defaultTargetPerLab;
        });
        const pct = targetAmt > 0 ? Math.round((rev / targetAmt) * 100) : 0;
        return { revenue: rev, samples: samp, tubes, tests, target: targetAmt, achievementPct: pct };
    };

    if (desig === 'ZSM' && hierarchy.downline?.rsms) {
        breakdownRows = hierarchy.downline.rsms.map(rsm => {
            // Collect all franchisees under this RSM
            let rsmFrans = [];
            (rsm.asms || []).forEach(asm => {
                (asm.ths || []).forEach(th => {
                    (th.franchisees || []).forEach(f => rsmFrans.push(f._id));
                });
            });
            const stats = getStatsForFranchiseeIds(rsmFrans);
            return {
                id: rsm._id,
                name: rsm.fullName,
                username: rsm.username,
                designation: 'RSM',
                phoneNo: rsm.phoneNo,
                subordinateCount: `${rsm.asmCount || 0} ASMs • ${rsm.thCount || 0} THs • ${rsmFrans.length} Labs`,
                ...stats
            };
        });
    } else if (desig === 'RSM' && hierarchy.downline?.asms) {
        breakdownRows = hierarchy.downline.asms.map(asm => {
            let asmFrans = [];
            (asm.ths || []).forEach(th => {
                (th.franchisees || []).forEach(f => asmFrans.push(f._id));
            });
            const stats = getStatsForFranchiseeIds(asmFrans);
            return {
                id: asm._id,
                name: asm.fullName,
                username: asm.username,
                designation: 'ASM',
                phoneNo: asm.phoneNo,
                subordinateCount: `${asm.thCount || 0} THs • ${asmFrans.length} Labs`,
                ...stats
            };
        });
    } else if (desig === 'ASM' && hierarchy.downline?.ths) {
        breakdownRows = hierarchy.downline.ths.map(th => {
            const thFrans = (th.franchisees || []).map(f => f._id);
            const stats = getStatsForFranchiseeIds(thFrans);
            return {
                id: th._id,
                name: th.fullName,
                username: th.username,
                designation: 'TH',
                phoneNo: th.phoneNo,
                subordinateCount: `${thFrans.length} Labs Tagged`,
                ...stats
            };
        });
    } else {
        // TH level or Franchisee drilldown: list individual Franchisees
        const franchiseeList = hierarchy.downline?.franchisees || hierarchy.allFranchisees || [];
        breakdownRows = franchiseeList.map(f => {
            const stats = getStatsForFranchiseeIds([f._id]);
            const bookingData = franchiseeSalesMap.get(f._id.toString());
            return {
                id: f._id,
                name: f.fullName,
                clinicName: f.clinicName || f.fullName,
                username: f.username,
                designation: f.role || 'franchisee',
                phoneNo: f.phoneNo,
                walletBalance: Number(f.bookingWallet || 0),
                isWalletPositive: Number(f.bookingWallet || 0) >= 0,
                lastBookingDate: bookingData?.lastBooking || null,
                ...stats
            };
        });
    }

    return res.status(200).json(
        new ApiResponse(200, {
            user: hierarchy.user,
            counts: hierarchy.counts,
            period,
            month: targetMonth,
            daysCount,
            scope: {
                filterType,
                filterId: filterId || 'all',
                totalLabsInScope: activeFranchiseeObjectIds.length
            },
            kpis: {
                targetAmount: totalTargetAmount,
                totalRevenue,
                achievementPct,
                deficitAmount,
                totalSamples,
                totalTests,
                totalTubes,
                avgRevenuePerDay: Math.round(avgRevenuePerDay),
                avgSamplesPerDay: Number(avgSamplesPerDay.toFixed(1)),
                avgTestsPerDay: Number(avgTestsPerDay.toFixed(1)),
                avgTubesPerDay: Number(avgTubesPerDay.toFixed(1)),
                avgTicketSize: Math.round(avgTicketSize),
                avgTubesPerSample: Number(avgTubesPerSample.toFixed(1)),
                avgTestsPerSample: Number(avgTestsPerSample.toFixed(1))
            },
            timeline: formattedTimeline,
            tubeTypes: bookingAggregates.tubeTypes || [],
            topTests: bookingAggregates.topTests || [],
            breakdownRows
        }, "Sales business analytics retrieved successfully")
    );
});

/**
 * 3. GET /api/v1/sales/downline-options
 * Returns available units to select when creating/editing ZSM, RSM, ASM, TH.
 */
export const getAvailableDownlines = asyncHandler(async (req, res) => {
    const { designation } = req.query;
    const tid = req.user.tenantId?._id || req.user.tenantId;

    if (!designation) {
        throw new ApiError(400, "Designation parameter is required (TH, ASM, RSM, ZSM)");
    }

    const upperDesig = designation.toUpperCase();

    // When creating TH -> Return all Franchisees / Sub-Franchisees
    if (upperDesig === 'TH') {
        const franchisees = await User.find({
            tenantId: tid,
            role: { $in: ['franchisee', 'subFranchisee'] },
            isActive: true
        })
        .select('_id fullName username email phoneNo clinicName bookingWallet address city state role createdBy')
        .sort({ fullName: 1 })
        .lean();

        // Also check if any are currently assigned to another TH
        const existingTHs = await User.find({
            tenantId: tid,
            salesDesignation: 'TH',
            isActive: true
        }).select('_id fullName assignedFranchisees').lean();

        const assignedMap = new Map();
        existingTHs.forEach(th => {
            (th.assignedFranchisees || []).forEach(fId => {
                assignedMap.set(fId.toString(), { thId: th._id, thName: th.fullName });
            });
        });

        const options = franchisees.map(f => ({
            _id: f._id,
            name: f.fullName,
            username: f.username,
            clinicName: f.clinicName || f.fullName,
            phoneNo: f.phoneNo,
            city: f.city || '',
            role: f.role,
            walletBalance: f.bookingWallet || 0,
            alreadyAssignedTo: assignedMap.get(f._id.toString()) || null
        }));

        return res.status(200).json(
            new ApiResponse(200, { type: 'FRANCHISEE', options }, "Franchisees list retrieved successfully")
        );
    }

    // When creating ASM -> Return all THs
    if (upperDesig === 'ASM') {
        const thDocs = await User.find({
            tenantId: tid,
            role: 'staff',
            salesDesignation: 'TH',
            isActive: true
        })
        .select('_id fullName username email phoneNo assignedFranchisees parentSalesUser monthlySalesTarget')
        .sort({ fullName: 1 })
        .lean();

        const options = thDocs.map(th => ({
            _id: th._id,
            name: th.fullName,
            username: th.username,
            phoneNo: th.phoneNo,
            designation: 'TH',
            franchiseeCount: (th.assignedFranchisees || []).length,
            assignedFranchisees: th.assignedFranchisees || [],
            parentSalesUser: th.parentSalesUser || null
        }));

        return res.status(200).json(
            new ApiResponse(200, { type: 'TH', options }, "Team Heads retrieved successfully")
        );
    }

    // When creating RSM -> Return all ASMs
    if (upperDesig === 'RSM') {
        const asmDocs = await User.find({
            tenantId: tid,
            role: 'staff',
            salesDesignation: 'ASM',
            isActive: true
        })
        .select('_id fullName username email phoneNo assignedStaff parentSalesUser monthlySalesTarget')
        .sort({ fullName: 1 })
        .lean();

        const options = asmDocs.map(asm => ({
            _id: asm._id,
            name: asm.fullName,
            username: asm.username,
            phoneNo: asm.phoneNo,
            designation: 'ASM',
            thCount: (asm.assignedStaff || []).length,
            assignedStaff: asm.assignedStaff || [],
            parentSalesUser: asm.parentSalesUser || null
        }));

        return res.status(200).json(
            new ApiResponse(200, { type: 'ASM', options }, "Area Sales Managers retrieved successfully")
        );
    }

    // When creating ZSM -> Return all RSMs
    if (upperDesig === 'ZSM') {
        const rsmDocs = await User.find({
            tenantId: tid,
            role: 'staff',
            salesDesignation: 'RSM',
            isActive: true
        })
        .select('_id fullName username email phoneNo assignedStaff parentSalesUser monthlySalesTarget')
        .sort({ fullName: 1 })
        .lean();

        const options = rsmDocs.map(rsm => ({
            _id: rsm._id,
            name: rsm.fullName,
            username: rsm.username,
            phoneNo: rsm.phoneNo,
            designation: 'RSM',
            asmCount: (rsm.assignedStaff || []).length,
            assignedStaff: rsm.assignedStaff || [],
            parentSalesUser: rsm.parentSalesUser || null
        }));

        return res.status(200).json(
            new ApiResponse(200, { type: 'RSM', options }, "Regional Sales Managers retrieved successfully")
        );
    }

    return res.status(400).json(new ApiResponse(400, null, "Invalid sales designation specified"));
});

/**
 * 4. GET /api/v1/sales/my-franchisees
 * Returns accessible franchisees list for the logged-in sales user (for Booking dropdown & filters).
 */
export const getMySalesFranchisees = asyncHandler(async (req, res) => {
    const hierarchy = await resolveSalesHierarchy(req.user);
    const franchiseeIds = hierarchy.flatIds.franchiseeIds;

    const franchisees = await User.find({
        _id: { $in: franchiseeIds }
    })
    .select('_id fullName username email phoneNo clinicName bookingWallet isActive role address city')
    .sort({ fullName: 1 })
    .lean();

    return res.status(200).json(
        new ApiResponse(200, franchisees, "Franchisees retrieved successfully")
    );
});

/**
 * 5. GET /api/v1/sales/bookings
 * Returns bookings belonging to the sales user's tagged franchisees with wallet balance & report eligibility.
 */
export const getSalesBookings = asyncHandler(async (req, res) => {
    const hierarchy = await resolveSalesHierarchy(req.user);
    const franchiseeIds = hierarchy.flatIds.franchiseeIds;

    if (!franchiseeIds.length) {
        return res.status(200).json(
            new ApiResponse(200, { bookings: [], total: 0, page: 1, limit: 20 }, "No franchisees tagged")
        );
    }

    const {
        page = 1,
        limit = 20,
        search = '',
        franchiseeId,
        fromDate,
        toDate,
        status
    } = req.query;

    const pageNumber = Math.max(1, parseInt(page, 10));
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNumber - 1) * limitNumber;

    let targetFranchiseeIds = franchiseeIds;
    if (franchiseeId && mongoose.Types.ObjectId.isValid(franchiseeId)) {
        targetFranchiseeIds = [new mongoose.Types.ObjectId(franchiseeId)];
    }

    const matchIds = [
        ...targetFranchiseeIds.map(id => new mongoose.Types.ObjectId(id)),
        ...targetFranchiseeIds.map(id => id.toString())
    ];

    const matchQuery = {
        tenantId: req.user.tenantId?._id || req.user.tenantId,
        status: { $ne: 'cancelled' },
        $or: [
            { createdBy: { $in: matchIds } },
            { subFranchiseeId: { $in: matchIds } }
        ]
    };

    if (status) {
        matchQuery.status = status;
    }

    if (fromDate || toDate) {
        const dateQuery = {};
        if (fromDate) dateQuery.$gte = new Date(fromDate);
        if (toDate) {
            const endD = new Date(toDate);
            endD.setHours(23, 59, 59, 999);
            dateQuery.$lte = endD;
        }
        matchQuery.createdAt = dateQuery;
    }

    if (search) {
        matchQuery.$or = [
            { bookingId: { $regex: search, $options: 'i' } },
            { patientName: { $regex: search, $options: 'i' } },
            { patientPhone: { $regex: search, $options: 'i' } },
            { doctorName: { $regex: search, $options: 'i' } },
            { "tableData.barcodeId": { $regex: search, $options: 'i' } },
            { "tableData.testName": { $regex: search, $options: 'i' } }
        ];
    }

    const [total, rawBookings] = await Promise.all([
        newBooking.countDocuments(matchQuery),
        newBooking.find(matchQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNumber)
            .populate('subFranchiseeId', 'fullName username clinicName bookingWallet')
            .populate('createdBy', 'fullName username clinicName bookingWallet')
            .lean()
    ]);

    // Map bookings and attach franchisee wallet & report download eligibility
    const processedBookings = rawBookings.map(b => {
        const fran = b.subFranchiseeId || b.createdBy || {};
        const walletBal = Number(fran.bookingWallet || 0);
        const canDownload = walletBal >= 0;

        return {
            _id: b._id,
            bookingId: b.bookingId,
            patientName: b.patientName,
            age: b.age,
            year: b.year,
            gender: b.gender,
            patientPhone: b.patientPhone,
            doctorName: b.doctorName || b.savedDoctor?.doctorName || 'Self',
            total: b.total || 0,
            status: b.status,
            createdAt: b.createdAt || b.date,
            tests: (b.tableData || []).map(t => ({
                testName: t.testName,
                barcodeId: t.barcodeId,
                sampleType: t.typeOfSample
            })),
            franchisee: {
                _id: fran._id,
                fullName: fran.fullName || b.createdbyuser || 'Lab',
                username: fran.username || '',
                clinicName: fran.clinicName || fran.fullName || '',
                walletBalance: walletBal,
                isPositive: canDownload
            },
            canDownloadReport: canDownload,
            isreportready: b.isreportready || false,
            isSignedOff: b.isSignedOff || false
        };
    });

    return res.status(200).json(
        new ApiResponse(200, {
            bookings: processedBookings,
            total,
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.ceil(total / limitNumber)
        }, "Bookings retrieved successfully")
    );
});

/**
 * 6. GET /api/v1/sales/check-report-eligibility/:bookingId
 * Checks whether report can be downloaded (blocked if franchisee wallet is in negative).
 */
export const checkSalesReportEligibility = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

    if (!bookingId) {
        throw new ApiError(400, "Booking ID is required");
    }

    const booking = await newBooking.findById(bookingId)
        .populate('subFranchiseeId', 'fullName username clinicName bookingWallet role')
        .populate('createdBy', 'fullName username clinicName bookingWallet role')
        .lean();

    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    const franchisee = booking.subFranchiseeId || booking.createdBy;
    if (!franchisee) {
        return res.status(200).json(
            new ApiResponse(200, { allowed: true, walletBalance: 0 }, "No associated franchisee restriction")
        );
    }

    const currentBalance = Number(franchisee.bookingWallet || 0);

    if (currentBalance < 0) {
        const negativeAmount = Math.abs(currentBalance).toFixed(2);
        return res.status(403).json(
            new ApiResponse(403, {
                allowed: false,
                walletBalance: currentBalance,
                franchiseeName: franchisee.fullName || franchisee.username
            }, `Report download restricted. Franchisee (${franchisee.fullName || 'Franchise'}) account balance is in negative (-₹${negativeAmount}). Reports can only be downloaded when account balance is positive. Please recharge the franchisee account first.`)
        );
    }

    return res.status(200).json(
        new ApiResponse(200, {
            allowed: true,
            walletBalance: currentBalance,
            franchiseeName: franchisee.fullName || franchisee.username
        }, "Report download allowed")
    );
});

/**
 * 7. POST /api/v1/sales/assign-target
 * Set monthly target for any sales staff.
 */
export const assignSalesTarget = asyncHandler(async (req, res) => {
    const { staffId, monthlySalesTarget } = req.body;

    if (!staffId || monthlySalesTarget === undefined) {
        throw new ApiError(400, "staffId and monthlySalesTarget are required");
    }

    const updatedUser = await User.findByIdAndUpdate(
        staffId,
        { monthlySalesTarget: Number(monthlySalesTarget) },
        { new: true }
    ).select('_id fullName username salesDesignation monthlySalesTarget');

    if (!updatedUser) {
        throw new ApiError(404, "Sales staff member not found");
    }

    return res.status(200).json(
        new ApiResponse(200, updatedUser, "Sales target assigned successfully")
    );
});

/**
 * 8. GET /api/v1/sales/all-sales-staff
 * Returns all sales personnel in tenant for management and review.
 */
export const getAllSalesStaff = asyncHandler(async (req, res) => {
    const tid = req.user.tenantId?._id || req.user.tenantId;

    const staffList = await User.find({
        tenantId: tid,
        role: 'staff',
        $or: [
            { staffType: 'sales' },
            { salesDesignation: { $in: ['ZSM', 'RSM', 'ASM', 'TH'] } }
        ]
    })
    .select('_id fullName username email phoneNo staffType salesDesignation assignedFranchisees assignedStaff parentSalesUser monthlySalesTarget isActive createdAt')
    .sort({ salesDesignation: 1, fullName: 1 })
    .lean();

    // Populate downline counts
    const enrichedList = staffList.map(s => {
        let downlineCount = 0;
        let downlineType = '';
        if (s.salesDesignation === 'TH') {
            downlineCount = (s.assignedFranchisees || []).length;
            downlineType = 'Franchisees';
        } else if (s.salesDesignation === 'ASM') {
            downlineCount = (s.assignedStaff || []).length;
            downlineType = 'THs';
        } else if (s.salesDesignation === 'RSM') {
            downlineCount = (s.assignedStaff || []).length;
            downlineType = 'ASMs';
        } else if (s.salesDesignation === 'ZSM') {
            downlineCount = (s.assignedStaff || []).length;
            downlineType = 'RSMs';
        }

        return {
            ...s,
            downlineCount,
            downlineType
        };
    });

    return res.status(200).json(
        new ApiResponse(200, enrichedList, "Sales staff retrieved successfully")
    );
});

