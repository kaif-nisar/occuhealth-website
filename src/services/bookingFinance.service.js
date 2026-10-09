import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Ledger } from "../models/ledger.model.js";
import { Target } from "../models/target.model.js";
import { testSchema } from "../models/newTest.model.js";
import { addPannel } from "../models/AddPannel.model.js";
import { Package } from "../models/addPackage.model.js";
import { ApiError } from "../utils/apiError.js";

function escapeRegex(value = "") {
    return String(value).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export function isAdminActor(user) {
    const role = user?.role?.toLowerCase();
    const parentRole = user?.parentRole?.toLowerCase();
    return role === "admin" || role === "superadmin" || (role === "staff" && (parentRole === "admin" || parentRole === "superadmin"));
}

/**
 * Resolves test/panel/package IDs from various inputs (array, stringified JSON, tableData, or names)
 */
export async function resolveBookingTestIds(bookingInput = {}, session = null) {
    let resolvedIds = [];

    // 1. Direct testIds array
    if (Array.isArray(bookingInput.testIds)) {
        resolvedIds = bookingInput.testIds.map(t => String(t?.id || t?._id || t)).filter(Boolean);
    } else if (typeof bookingInput.testIds === "string" && bookingInput.testIds.trim()) {
        try {
            const parsed = JSON.parse(bookingInput.testIds);
            if (Array.isArray(parsed)) {
                resolvedIds = parsed.map(t => String(t?.id || t?._id || t)).filter(Boolean);
            }
        } catch (_) {}
    }

    // 2. Derive from tableData
    const tableData = Array.isArray(bookingInput.tableData)
        ? bookingInput.tableData
        : (Array.isArray(bookingInput.TableData) ? bookingInput.TableData : []);

    if (resolvedIds.length === 0 && tableData.length > 0) {
        resolvedIds = tableData.flatMap(entry => {
            if (!Array.isArray(entry?.ids)) return [];
            return entry.ids.map(item => String(item?.id || item?._id || item)).filter(Boolean);
        });
    }

    // 3. Fallback by name lookup
    if (resolvedIds.length === 0) {
        const rawNames = String(bookingInput.TestNames || bookingInput.testNames || bookingInput.testName || "")
            .split(",")
            .map(t => t.trim())
            .filter(Boolean);

        if (rawNames.length > 0) {
            const nameRegexes = rawNames.map(n => new RegExp(`^${escapeRegex(n)}$`, "i"));
            const querySession = session ? { session } : {};

            const [foundTests, foundPanels, foundPackages] = await Promise.all([
                testSchema.find({ $or: [{ Name: { $in: nameRegexes } }, { Short_name: { $in: nameRegexes } }] })
                    .select("_id").setOptions(querySession).lean(),
                addPannel.find({ name: { $in: nameRegexes } })
                    .select("_id").setOptions(querySession).lean(),
                Package.find({ packageName: { $in: nameRegexes } })
                    .select("_id").setOptions(querySession).lean()
            ]);

            resolvedIds = [
                ...foundTests.map(t => t._id.toString()),
                ...foundPanels.map(p => p._id.toString()),
                ...foundPackages.map(pkg => pkg._id.toString())
            ];
        }
    }

    return Array.from(new Set(resolvedIds.filter(Boolean)));
}

/**
 * Validates wallet balance, overdraft, calculates multi-tier commissions,
 * and creates debit/credit ledger records inside a transaction session.
 */
export async function processBookingFinancials({
    bookingInput,
    currentUser,
    tenantId,
    session,
    parentUserCache = new Map()
}) {
    const rawTotal = bookingInput.total ?? bookingInput.Total ?? 0;
    const parsedTotal = Number(rawTotal) || 0;
    const bookingId = String(bookingInput.barcodeId || bookingInput.bookingId || "").trim();
    const patientName = String(bookingInput.patientName || bookingInput.PatientName || "").trim().toUpperCase();
    const discountamount = Number(bookingInput.discountamount ?? bookingInput.DiscountAmount ?? 0);
    const discountunit = Number(bookingInput.discountunit ?? bookingInput.DiscountPercentage ?? 0);

    const tableData = Array.isArray(bookingInput.tableData)
        ? bookingInput.tableData
        : (Array.isArray(bookingInput.TableData) ? bookingInput.TableData : []);

    const sampleBarcodeId = tableData
        .map(e => e.confirmBarcodeId || e.barcodeId)
        .filter(Boolean);

    if (sampleBarcodeId.length === 0 && bookingId) {
        sampleBarcodeId.push(bookingId);
    }

    const tenantModelType = tenantId?.modelType || currentUser?.tenantId?.modelType;
    const issinglelayeradmin = tenantModelType === "1layer" && isAdminActor(currentUser);

    // Determine bookingUser
    let bookingUserId = bookingInput.userId || bookingInput.createdBy;
    if (!bookingUserId || !mongoose.isValidObjectId(bookingUserId)) {
        bookingUserId = (currentUser.role === "staff" && currentUser.parentUser)
            ? currentUser.parentUser
            : currentUser._id;
    }

    const bookingUser = await User.findById(bookingUserId).session(session);
    if (!bookingUser) {
        throw new ApiError(404, `Booking user not found (ID: ${bookingUserId})`);
    }

    const transactionId = `#CR${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const isNonAdminUser = !isAdminActor(currentUser) || (
        bookingUser.role !== "admin" &&
        bookingUser.role !== "superadmin" &&
        String(bookingUser._id) !== String(currentUser._id)
    );

    if (isNonAdminUser) {
        // 1. Balance & Overdraft Validation
        const currentWallet = Number(bookingUser.bookingWallet || 0);
        const balanceAfterTransaction = currentWallet - parsedTotal;

        if (balanceAfterTransaction < 0) {
            const overdraftAllowed = Boolean(bookingUser.overdraftAllowed);
            const overdraftLimit = Number(bookingUser.overdraftLimit || 0);
            const overdraftNeeded = Math.abs(balanceAfterTransaction);

            if (!overdraftAllowed || overdraftNeeded > overdraftLimit) {
                throw new ApiError(402, `Insufficient Balance for ${bookingUser.username || 'user'}, recharge wallet`);
            }
        }

        // 2. Resolve Test IDs for Commission Calculation
        const parsedSelectedTestIds = await resolveBookingTestIds(bookingInput, session);

        let totalCommission = 0;
        const testDetailsForCurrentUser = [];

        for (const item of parsedSelectedTestIds) {
            const testOrPackage =
                await testSchema.findById(item).session(session) ||
                await addPannel.findById(item).session(session) ||
                await Package.findById(item).session(session);

            if (!testOrPackage) {
                continue;
            }

            const assignedPrices = testOrPackage.assignedPrices;

            const getAssignedPriceForUser = (targetUid) => {
                const normalizedUid = String(targetUid || "").trim();
                if (!normalizedUid || !Array.isArray(assignedPrices)) {
                    return undefined;
                }
                return assignedPrices.find(price =>
                    String(price?.userId || "").trim() === normalizedUid
                )?.price;
            };

            let currentPrice = getAssignedPriceForUser(bookingUser._id);
            if (currentPrice === undefined || currentPrice === null) {
                currentPrice = Number(testOrPackage.Price ?? testOrPackage.price ?? testOrPackage.packageFee ?? testOrPackage.final_price ?? 0);
            }

            testDetailsForCurrentUser.push({
                testName: testOrPackage.name || testOrPackage.packageName || testOrPackage.Name || "Unknown Test",
                testPrice: currentPrice,
            });

            // Commission distribution up the parent chain
            let parentId = bookingUser.createdBy || bookingUser.parentUser;
            let childUsername = bookingUser.username;

            while (parentId) {
                const parentIdStr = parentId.toString();
                let parentUser = parentUserCache.get(parentIdStr);
                if (!parentUser) {
                    parentUser = await User.findById(parentId).session(session);
                    if (!parentUser) {
                        break;
                    }
                    parentUserCache.set(parentIdStr, parentUser);
                }

                const parentPrice = getAssignedPriceForUser(parentUser._id);
                if (parentPrice === undefined || parentPrice === null) {
                    parentId = parentUser.createdBy || parentUser.parentUser;
                    continue;
                }

                const commissionForParent = currentPrice - parentPrice;

                if (commissionForParent < 0) {
                    parentId = parentUser.createdBy || parentUser.parentUser;
                    childUsername = parentUser.username;
                    currentPrice = parentPrice;
                    continue;
                }

                if (commissionForParent === 0) {
                    parentId = parentUser.createdBy || parentUser.parentUser;
                    childUsername = parentUser.username;
                    currentPrice = parentPrice;
                    continue;
                }

                totalCommission += commissionForParent;

                const parentCurrentWallet = Number(parentUser.bookingWallet || 0);
                const parentNewBalance = parentCurrentWallet + commissionForParent;

                const parentLedgerEntry = new Ledger({
                    userId: parentUser._id,
                    username: parentUser.username,
                    amount: commissionForParent,
                    type: "credit",
                    transactionId,
                    description: `${bookingId}`,
                    balanceAfterTransaction: parentNewBalance,
                    receivedFrom: childUsername,
                    myAmount: currentPrice,
                    testDetails: [{
                        testName: testOrPackage.name || testOrPackage.packageName || testOrPackage.Name || "Unknown Test",
                        testPrice: currentPrice,
                        commissionAmount: commissionForParent,
                    }],
                    patientName: patientName,
                    barcodeId: sampleBarcodeId,
                    discountamount: issinglelayeradmin ? discountamount : 0,
                    discountunit: issinglelayeradmin ? discountunit : 0,
                });

                await parentLedgerEntry.save({ session });
                parentUser.bookingWallet = parentNewBalance;
                await parentUser.save({ session });

                parentId = parentUser.createdBy || parentUser.parentUser;
                childUsername = parentUser.username;
                currentPrice = parentPrice;
            }
        }

        // 3. Create Debit Ledger Entry for Booking User
        const bookingLedgerEntry = new Ledger({
            userId: bookingUser._id,
            username: bookingUser.username,
            amount: parsedTotal,
            patientName: patientName,
            sampleBarcodeId: sampleBarcodeId,
            type: "debit",
            transactionId,
            description: `Booking for ${bookingId}`,
            balanceAfterTransaction,
            testDetails: testDetailsForCurrentUser,
            discountamount: issinglelayeradmin ? discountamount : 0,
            discountunit: issinglelayeradmin ? discountunit : 0,
        });

        await bookingLedgerEntry.save({ session });

        bookingUser.bookingWallet = balanceAfterTransaction;
        await bookingUser.save({ session });

        return {
            transactionId,
            bookingUser,
            parsedTotal,
            testDetailsForCurrentUser,
            sampleBarcodeId,
            issinglelayeradmin,
            isFinancialDebit: true
        };
    } else {
        // Admin Actor booking for self - record debit ledger entry for accounting
        const bookingLedgerEntry = new Ledger({
            userId: bookingUser._id,
            username: bookingUser.username,
            amount: parsedTotal,
            patientName: patientName,
            sampleBarcodeId: sampleBarcodeId,
            type: "debit",
            transactionId,
            description: `Booking for ${bookingId}`,
            discountamount: issinglelayeradmin ? discountamount : 0,
            discountunit: issinglelayeradmin ? discountunit : 0,
        });

        await bookingLedgerEntry.save({ session });

        return {
            transactionId,
            bookingUser,
            parsedTotal,
            testDetailsForCurrentUser: [],
            sampleBarcodeId,
            issinglelayeradmin,
            isFinancialDebit: false
        };
    }
}

/**
 * Links ledger entries to created booking._id, updates target achievement,
 * and logs staff activities if applicable.
 */
export async function completeBookingFinancials({
    booking,
    financialResult,
    currentUser,
    tenantId,
    session
}) {
    if (!booking?._id || !financialResult?.transactionId) {
        return;
    }

    const { transactionId, bookingUser, parsedTotal, isFinancialDebit } = financialResult;
    const resolvedTenantId = tenantId?._id || tenantId || currentUser?.tenantId?._id || currentUser?.tenantId;

    // 1. Link all ledger entries with caseId
    await Ledger.updateMany(
        { transactionId },
        { $set: { caseId: booking._id } },
        { session }
    );

    // 2. Update monthly Target if booking was financially debited / for non-admin
    if (isFinancialDebit && bookingUser) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const currentTarget = await Target.findOne({
            franchiseeId: bookingUser._id,
            month: currentMonth,
            tenantId: resolvedTenantId
        }).session(session);

        if (currentTarget) {
            await currentTarget.updateAchieved(parsedTotal, booking._id);
        } else {
            await Target.create([{
                franchiseeId: bookingUser._id,
                fullName: bookingUser.fullName || currentUser.fullName,
                assignedBy: currentUser._id,
                month: currentMonth,
                amount: 0,
                achieved: parsedTotal,
                tenantId: resolvedTenantId,
                history: [{
                    amount: parsedTotal,
                    bookingId: booking._id,
                    description: 'Booking completed (No target set)'
                }]
            }], { session });
        }
    }

    // 3. Staff activity tracking
    if (currentUser?.role === "staff") {
        await User.findByIdAndUpdate(
            currentUser._id,
            {
                $push: {
                    activities: {
                        activityType: "booking",
                        details: {
                            staffId: currentUser._id,
                            staffName: currentUser.fullName,
                            action: `${currentUser.fullName} created a new Booking (Bulk)`,
                            patientName: booking.patientName,
                            patientBookingId: booking._id
                        },
                        reference: {
                            model: "Booking",
                            id: booking._id
                        },
                        timestamp: new Date()
                    }
                }
            },
            { session }
        );
    }
}
