import mongoose from "mongoose";
import { User } from "../models/user.model.js";

/**
 * Resolves the downline hierarchy tree and flat ID lists for a sales user or admin.
 * @param {Object|String} userOrId - User document or User ObjectId
 * @param {Object|String} [tenantId] - Optional tenantId fallback
 * @returns {Promise<Object>} Resolved hierarchy object with flat arrays and structured tree
 */
export async function resolveSalesHierarchy(userOrId, tenantId = null) {
    let user;
    if (userOrId && typeof userOrId === 'object' && userOrId._id) {
        user = userOrId;
    } else if (mongoose.Types.ObjectId.isValid(userOrId)) {
        user = await User.findById(userOrId).lean();
    }

    if (!user) {
        throw new Error("User not found for sales hierarchy resolution");
    }

    const tid = user.tenantId?._id || user.tenantId || tenantId;
    const designation = (user.salesDesignation || "").toUpperCase();
    const isAdmin = user.role === 'admin' || user.role === 'superFranchisee' || user.role === 'superAdmin';

    // 1. ADMIN / SUPER-FRANCHISEE VIEW (Top-level full network)
    if (isAdmin && !designation) {
        const allSalesStaff = await User.find({
            tenantId: tid,
            role: 'staff',
            $or: [
                { staffType: 'sales' },
                { salesDesignation: { $in: ['ZSM', 'RSM', 'ASM', 'TH'] } }
            ]
        })
        .select('_id fullName username email phoneNo staffType salesDesignation assignedFranchisees assignedStaff parentSalesUser monthlySalesTarget isActive')
        .lean();

        const allFranchisees = await User.find({
            tenantId: tid,
            role: { $in: ['franchisee', 'subFranchisee', 'superFranchisee'] }
        })
        .select('_id fullName username email phoneNo clinicName bookingWallet isActive role')
        .lean();

        const zsmdocs = allSalesStaff.filter(s => s.salesDesignation === 'ZSM');
        const rsmdocs = allSalesStaff.filter(s => s.salesDesignation === 'RSM');
        const asmdocs = allSalesStaff.filter(s => s.salesDesignation === 'ASM');
        const thdocs  = allSalesStaff.filter(s => s.salesDesignation === 'TH');

        return {
            mode: 'admin',
            level: 'ADMIN',
            user: {
                _id: user._id,
                fullName: user.fullName,
                username: user.username,
                role: user.role,
                salesDesignation: 'ADMIN'
            },
            counts: {
                zsmCount: zsmdocs.length,
                rsmCount: rsmdocs.length,
                asmCount: asmdocs.length,
                thCount: thdocs.length,
                franchiseeCount: allFranchisees.length
            },
            flatIds: {
                zsmIds: zsmdocs.map(d => d._id),
                rsmIds: rsmdocs.map(d => d._id),
                asmIds: asmdocs.map(d => d._id),
                thIds: thdocs.map(d => d._id),
                franchiseeIds: allFranchisees.map(d => d._id)
            },
            allSalesStaff,
            allFranchisees
        };
    }

    // 2. TEAM HEAD (TH) - Base sales level managing direct labs/franchisees
    if (designation === 'TH') {
        const directIds = Array.isArray(user.assignedFranchisees) ? user.assignedFranchisees.map(id => id.toString()) : [];
        
        // Also include any franchisee created by this TH
        const createdFranchisees = await User.find({
            tenantId: tid,
            createdBy: user._id,
            role: { $in: ['franchisee', 'subFranchisee'] }
        }).select('_id').lean();

        const allFranchiseeIdStrings = Array.from(new Set([
            ...directIds,
            ...createdFranchisees.map(c => c._id.toString())
        ]));

        const franchiseeObjectIds = allFranchiseeIdStrings
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));

        const franchisees = await User.find({
            _id: { $in: franchiseeObjectIds }
        })
        .select('_id fullName username email phoneNo clinicName bookingWallet isActive role address city state')
        .sort({ fullName: 1 })
        .lean();

        return {
            mode: 'sales',
            level: 'TH',
            user: {
                _id: user._id,
                fullName: user.fullName,
                username: user.username,
                phoneNo: user.phoneNo,
                email: user.email,
                role: user.role,
                staffType: user.staffType,
                salesDesignation: 'TH',
                monthlySalesTarget: user.monthlySalesTarget || 200000
            },
            counts: {
                zsmCount: 0,
                rsmCount: 0,
                asmCount: 0,
                thCount: 1,
                franchiseeCount: franchisees.length
            },
            flatIds: {
                zsmIds: [],
                rsmIds: [],
                asmIds: [],
                thIds: [user._id],
                franchiseeIds: franchisees.map(f => f._id)
            },
            downline: {
                ths: [
                    {
                        ...user,
                        franchisees
                    }
                ],
                franchisees
            }
        };
    }

    // 3. AREA SALES MANAGER (ASM) - Manages Team Heads (THs)
    if (designation === 'ASM') {
        const assignedThIds = Array.isArray(user.assignedStaff) ? user.assignedStaff : [];
        
        // Find THs assigned directly or reporting to this ASM
        const thDocs = await User.find({
            tenantId: tid,
            $or: [
                { _id: { $in: assignedThIds } },
                { parentSalesUser: user._id },
                { createdBy: user._id, salesDesignation: 'TH' }
            ],
            salesDesignation: 'TH'
        })
        .select('_id fullName username email phoneNo assignedFranchisees monthlySalesTarget isActive')
        .lean();

        // Collect all franchisee IDs from all assigned THs
        let allFranchiseeIds = [];
        thDocs.forEach(th => {
            if (Array.isArray(th.assignedFranchisees)) {
                th.assignedFranchisees.forEach(fId => allFranchiseeIds.push(fId.toString()));
            }
        });
        allFranchiseeIds = Array.from(new Set(allFranchiseeIds));

        const franchiseeObjectIds = allFranchiseeIds
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));

        const franchisees = await User.find({
            _id: { $in: franchiseeObjectIds }
        })
        .select('_id fullName username email phoneNo clinicName bookingWallet isActive role address city state')
        .sort({ fullName: 1 })
        .lean();

        const franchiseeMap = new Map();
        franchisees.forEach(f => franchiseeMap.set(f._id.toString(), f));

        // Attach populated franchisees to each TH
        const structuredTHs = thDocs.map(th => {
            const assigned = (th.assignedFranchisees || [])
                .map(id => franchiseeMap.get(id.toString()))
                .filter(Boolean);
            return {
                ...th,
                franchisees: assigned,
                franchiseeCount: assigned.length
            };
        });

        return {
            mode: 'sales',
            level: 'ASM',
            user: {
                _id: user._id,
                fullName: user.fullName,
                username: user.username,
                phoneNo: user.phoneNo,
                email: user.email,
                role: user.role,
                staffType: user.staffType,
                salesDesignation: 'ASM',
                monthlySalesTarget: user.monthlySalesTarget || 0
            },
            counts: {
                zsmCount: 0,
                rsmCount: 0,
                asmCount: 1,
                thCount: thDocs.length,
                franchiseeCount: franchisees.length
            },
            flatIds: {
                zsmIds: [],
                rsmIds: [],
                asmIds: [user._id],
                thIds: thDocs.map(th => th._id),
                franchiseeIds: franchisees.map(f => f._id)
            },
            downline: {
                ths: structuredTHs,
                franchisees
            }
        };
    }

    // 4. REGIONAL SALES MANAGER (RSM) - Manages ASMs -> THs -> Franchisees
    if (designation === 'RSM') {
        const assignedAsmIds = Array.isArray(user.assignedStaff) ? user.assignedStaff : [];

        const asmDocs = await User.find({
            tenantId: tid,
            $or: [
                { _id: { $in: assignedAsmIds } },
                { parentSalesUser: user._id },
                { createdBy: user._id, salesDesignation: 'ASM' }
            ],
            salesDesignation: 'ASM'
        })
        .select('_id fullName username email phoneNo assignedStaff monthlySalesTarget isActive')
        .lean();

        // Collect all TH IDs from all ASMs
        let allThIds = [];
        asmDocs.forEach(asm => {
            if (Array.isArray(asm.assignedStaff)) {
                asm.assignedStaff.forEach(thId => allThIds.push(thId.toString()));
            }
        });
        allThIds = Array.from(new Set(allThIds));

        const thDocs = await User.find({
            _id: { $in: allThIds.map(id => new mongoose.Types.ObjectId(id)) },
            salesDesignation: 'TH'
        })
        .select('_id fullName username email phoneNo assignedFranchisees monthlySalesTarget isActive parentSalesUser')
        .lean();

        const thMap = new Map();
        thDocs.forEach(th => thMap.set(th._id.toString(), th));

        // Collect all Franchisee IDs
        let allFranchiseeIds = [];
        thDocs.forEach(th => {
            if (Array.isArray(th.assignedFranchisees)) {
                th.assignedFranchisees.forEach(fId => allFranchiseeIds.push(fId.toString()));
            }
        });
        allFranchiseeIds = Array.from(new Set(allFranchiseeIds));

        const franchisees = await User.find({
            _id: { $in: allFranchiseeIds.map(id => new mongoose.Types.ObjectId(id)) }
        })
        .select('_id fullName username email phoneNo clinicName bookingWallet isActive role address city state')
        .sort({ fullName: 1 })
        .lean();

        const franchiseeMap = new Map();
        franchisees.forEach(f => franchiseeMap.set(f._id.toString(), f));

        // Assemble tree: ASM -> THs -> Franchisees
        const structuredASMs = asmDocs.map(asm => {
            const myThs = (asm.assignedStaff || [])
                .map(thId => thMap.get(thId.toString()))
                .filter(Boolean)
                .map(th => {
                    const assignedFrans = (th.assignedFranchisees || [])
                        .map(fId => franchiseeMap.get(fId.toString()))
                        .filter(Boolean);
                    return {
                        ...th,
                        franchisees: assignedFrans,
                        franchiseeCount: assignedFrans.length
                    };
                });

            const totalFranchiseeCount = myThs.reduce((acc, t) => acc + t.franchiseeCount, 0);

            return {
                ...asm,
                ths: myThs,
                thCount: myThs.length,
                franchiseeCount: totalFranchiseeCount
            };
        });

        return {
            mode: 'sales',
            level: 'RSM',
            user: {
                _id: user._id,
                fullName: user.fullName,
                username: user.username,
                phoneNo: user.phoneNo,
                email: user.email,
                role: user.role,
                staffType: user.staffType,
                salesDesignation: 'RSM',
                monthlySalesTarget: user.monthlySalesTarget || 0
            },
            counts: {
                zsmCount: 0,
                rsmCount: 1,
                asmCount: asmDocs.length,
                thCount: thDocs.length,
                franchiseeCount: franchisees.length
            },
            flatIds: {
                zsmIds: [],
                rsmIds: [user._id],
                asmIds: asmDocs.map(a => a._id),
                thIds: thDocs.map(t => t._id),
                franchiseeIds: franchisees.map(f => f._id)
            },
            downline: {
                asms: structuredASMs,
                ths: thDocs,
                franchisees
            }
        };
    }

    // 5. ZONAL SALES MANAGER (ZSM) - Top Sales tier managing RSMs -> ASMs -> THs -> Franchisees
    if (designation === 'ZSM') {
        const assignedRsmIds = Array.isArray(user.assignedStaff) ? user.assignedStaff : [];

        const rsmDocs = await User.find({
            tenantId: tid,
            $or: [
                { _id: { $in: assignedRsmIds } },
                { parentSalesUser: user._id },
                { createdBy: user._id, salesDesignation: 'RSM' }
            ],
            salesDesignation: 'RSM'
        })
        .select('_id fullName username email phoneNo assignedStaff monthlySalesTarget isActive')
        .lean();

        // Collect ASMs
        let allAsmIds = [];
        rsmDocs.forEach(rsm => {
            if (Array.isArray(rsm.assignedStaff)) {
                rsm.assignedStaff.forEach(asmId => allAsmIds.push(asmId.toString()));
            }
        });
        allAsmIds = Array.from(new Set(allAsmIds));

        const asmDocs = await User.find({
            _id: { $in: allAsmIds.map(id => new mongoose.Types.ObjectId(id)) },
            salesDesignation: 'ASM'
        })
        .select('_id fullName username email phoneNo assignedStaff monthlySalesTarget isActive parentSalesUser')
        .lean();

        const asmMap = new Map();
        asmDocs.forEach(a => asmMap.set(a._id.toString(), a));

        // Collect THs
        let allThIds = [];
        asmDocs.forEach(asm => {
            if (Array.isArray(asm.assignedStaff)) {
                asm.assignedStaff.forEach(thId => allThIds.push(thId.toString()));
            }
        });
        allThIds = Array.from(new Set(allThIds));

        const thDocs = await User.find({
            _id: { $in: allThIds.map(id => new mongoose.Types.ObjectId(id)) },
            salesDesignation: 'TH'
        })
        .select('_id fullName username email phoneNo assignedFranchisees monthlySalesTarget isActive parentSalesUser')
        .lean();

        const thMap = new Map();
        thDocs.forEach(t => thMap.set(t._id.toString(), t));

        // Collect Franchisees
        let allFranchiseeIds = [];
        thDocs.forEach(th => {
            if (Array.isArray(th.assignedFranchisees)) {
                th.assignedFranchisees.forEach(fId => allFranchiseeIds.push(fId.toString()));
            }
        });
        allFranchiseeIds = Array.from(new Set(allFranchiseeIds));

        const franchisees = await User.find({
            _id: { $in: allFranchiseeIds.map(id => new mongoose.Types.ObjectId(id)) }
        })
        .select('_id fullName username email phoneNo clinicName bookingWallet isActive role address city state')
        .sort({ fullName: 1 })
        .lean();

        const franchiseeMap = new Map();
        franchisees.forEach(f => franchiseeMap.set(f._id.toString(), f));

        // Assemble pyramid: ZSM -> RSMs -> ASMs -> THs -> Franchisees
        const structuredRSMs = rsmDocs.map(rsm => {
            const myAsms = (rsm.assignedStaff || [])
                .map(asmId => asmMap.get(asmId.toString()))
                .filter(Boolean)
                .map(asm => {
                    const myThs = (asm.assignedStaff || [])
                        .map(thId => thMap.get(thId.toString()))
                        .filter(Boolean)
                        .map(th => {
                            const assignedFrans = (th.assignedFranchisees || [])
                                .map(fId => franchiseeMap.get(fId.toString()))
                                .filter(Boolean);
                            return {
                                ...th,
                                franchisees: assignedFrans,
                                franchiseeCount: assignedFrans.length
                            };
                        });
                    const asmFranchiseeCount = myThs.reduce((acc, t) => acc + t.franchiseeCount, 0);
                    return {
                        ...asm,
                        ths: myThs,
                        thCount: myThs.length,
                        franchiseeCount: asmFranchiseeCount
                    };
                });

            const totalThCount = myAsms.reduce((acc, a) => acc + a.thCount, 0);
            const totalFranchiseeCount = myAsms.reduce((acc, a) => acc + a.franchiseeCount, 0);

            return {
                ...rsm,
                asms: myAsms,
                asmCount: myAsms.length,
                thCount: totalThCount,
                franchiseeCount: totalFranchiseeCount
            };
        });

        return {
            mode: 'sales',
            level: 'ZSM',
            user: {
                _id: user._id,
                fullName: user.fullName,
                username: user.username,
                phoneNo: user.phoneNo,
                email: user.email,
                role: user.role,
                staffType: user.staffType,
                salesDesignation: 'ZSM',
                monthlySalesTarget: user.monthlySalesTarget || 0
            },
            counts: {
                zsmCount: 1,
                rsmCount: rsmDocs.length,
                asmCount: asmDocs.length,
                thCount: thDocs.length,
                franchiseeCount: franchisees.length
            },
            flatIds: {
                zsmIds: [user._id],
                rsmIds: rsmDocs.map(r => r._id),
                asmIds: asmDocs.map(a => a._id),
                thIds: thDocs.map(t => t._id),
                franchiseeIds: franchisees.map(f => f._id)
            },
            downline: {
                rsms: structuredRSMs,
                asms: asmDocs,
                ths: thDocs,
                franchisees
            }
        };
    }

    // Default fallback
    return {
        mode: 'standard',
        level: user.role,
        user,
        counts: { zsmCount: 0, rsmCount: 0, asmCount: 0, thCount: 0, franchiseeCount: 0 },
        flatIds: { zsmIds: [], rsmIds: [], asmIds: [], thIds: [], franchiseeIds: [] }
    };
}

