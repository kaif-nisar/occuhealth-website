import { reports } from "../models/reportData.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose"
import { User } from "../models/user.model.js";
import { Tenant } from "../models/tenant.model.js";
import { newBooking } from "../models/NewBooking.model.js";
import { defaultpdfsetting } from "../models/defaultpdfsettings.model.js";
import { customization } from "../models/printsetting.model.js";
import { recordButtonActionAudit } from "../services/reportActionAudit.service.js";
import { resolveNablLogoForReport } from "../utils/nablLogoHelper.js";
import { testSchema } from "../models/newTest.model.js";
import { addPannel } from "../models/AddPannel.model.js";
import { Package } from "../models/addPackage.model.js";

const normalizeInvLookupKey = (value) =>
    String(value ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

/**
 * Resolves compact clinical Investigation names for report headers:
 * - For booked Tests / Panels: resolves `Short_name` (or `defaultShortName`) from DB when defined.
 * - For booked Packages: preserves exact `packageName`.
 * Safe fallback keeps original item names if no short name is configured.
 */
const resolveInvestigationShortNames = async ({ Report = null, bookingDoc = null, tenantId = null } = {}) => {
    try {
        const tenantFilter = tenantId ? { tenantId } : {};

        // Collect raw entries preferring booking.tableData (preserves package grouping),
        // falling back to Report.uniquetestArray or CategoryAndTest headers.
        const rawEntries = [];
        const bookedTable = Array.isArray(bookingDoc?.tableData) ? bookingDoc.tableData : [];
        if (bookedTable.length > 0) {
            bookedTable.forEach((row) => {
                const name = String(row?.testName ?? "").trim();
                if (name) rawEntries.push(name);
            });
        }

        if (rawEntries.length === 0 && Array.isArray(Report?.uniquetestArray)) {
            Report.uniquetestArray.forEach((entry) => {
                const name = String(entry ?? "").trim();
                if (name) rawEntries.push(name);
            });
        }

        if (rawEntries.length === 0 && Array.isArray(Report?.CategoryAndTest)) {
            Report.CategoryAndTest.forEach((cat) => {
                if (cat?.packageName) rawEntries.push(String(cat.packageName).trim());
                else if (cat?.panelName) rawEntries.push(String(cat.panelName).trim());
                else if (cat?.title && !String(cat.title).includes("Unknown Title")) rawEntries.push(String(cat.title).trim());
                else if (cat?.category) rawEntries.push(String(cat.category).trim());
            });
        }

        if (rawEntries.length === 0) return [];

        const [testsList, panelsList, packagesList] = await Promise.all([
            testSchema.find(tenantFilter).select("Name Short_name defaultShortName").lean(),
            addPannel.find(tenantFilter).select("name Short_name").lean(),
            Package.find(tenantFilter).select("packageName").lean(),
        ]);

        const packageMap = new Map();
        packagesList.forEach((pkg) => {
            const pName = String(pkg?.packageName ?? "").trim();
            if (pName) packageMap.set(normalizeInvLookupKey(pName), pName);
        });

        const panelMap = new Map();
        panelsList.forEach((pan) => {
            const fullName = String(pan?.name ?? "").trim();
            const shortName = String(pan?.Short_name ?? "").trim();
            if (fullName) {
                panelMap.set(normalizeInvLookupKey(fullName), shortName || fullName);
            }
            if (shortName) {
                panelMap.set(normalizeInvLookupKey(shortName), shortName);
            }
        });

        const testMap = new Map();
        testsList.forEach((tst) => {
            const fullName = String(tst?.Name ?? "").trim();
            const shortName = String(tst?.Short_name ?? "").trim() || String(tst?.defaultShortName ?? "").trim();
            if (fullName) {
                testMap.set(normalizeInvLookupKey(fullName), shortName || fullName);
            }
            if (shortName) {
                testMap.set(normalizeInvLookupKey(shortName), shortName);
            }
        });

        const resolveToken = (token) => {
            const clean = String(token ?? "").trim();
            if (!clean) return "";
            const key = normalizeInvLookupKey(clean);
            if (packageMap.has(key)) return packageMap.get(key);
            if (panelMap.has(key)) return panelMap.get(key);
            if (testMap.has(key)) return testMap.get(key);
            return clean;
        };

        const resolved = [];
        const seen = new Set();
        const pushUnique = (val) => {
            const clean = String(val ?? "").trim();
            if (!clean) return;
            const k = normalizeInvLookupKey(clean);
            if (!seen.has(k)) {
                seen.add(k);
                resolved.push(clean);
            }
        };

        rawEntries.forEach((raw) => {
            const wholeKey = normalizeInvLookupKey(raw);
            // Check full string first (protects package/test names that themselves contain commas)
            if (packageMap.has(wholeKey) || panelMap.has(wholeKey) || testMap.has(wholeKey)) {
                pushUnique(resolveToken(raw));
                return;
            }
            // Otherwise split comma-joined strings (e.g. "Complete Blood Count, Liver Function Test")
            String(raw)
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean)
                .forEach((part) => pushUnique(resolveToken(part)));
        });

        return resolved;
    } catch (err) {
        console.warn("Could not resolve investigation short names:", err?.message);
        return [];
    }
};

const PARTIALLY_COMPLETED_STATUS = "Partially Completed";

const normalizeSampleText = (value) => String(value ?? "").trim();

const isBlankOrDotOnlyValue = (value) => {
    const normalized = normalizeSampleText(value).replace(/\s+/g, "");
    return normalized === "" || /^\.+$/.test(normalized);
};

const buildUniqueSampleDetails = (reportData = []) => {
    const sampleDetails = [];
    const seen = new Set();

    for (const section of reportData) {
        for (const entry of (section?.sampleDetails || [])) {
            const barcodeId = normalizeSampleText(entry?.barcodeId);
            const sampleType = normalizeSampleText(entry?.sampleType);
            const testNames = Array.isArray(entry?.testNames)
                ? entry.testNames.map((name) => normalizeSampleText(name)).filter(Boolean)
                : [];

            if (!barcodeId && !sampleType) {
                continue;
            }

            const key = `${barcodeId}__${sampleType}`;
            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            sampleDetails.push({
                barcodeId,
                sampleType,
                testNames
            });
        }
    }

    return sampleDetails;
};

function hasExactDotOnlyValue(reportData = []) {
    return reportData.some(section =>
        Array.isArray(section?.tests) &&
        section.tests.some(test => typeof test?.value === "string" && test.value.trim() === ".")
    );
}

function hasMeaningfulReportValue(reportData = []) {
    return reportData.some((section) =>
        Array.isArray(section?.tests) &&
        section.tests.some((test) => !isBlankOrDotOnlyValue(test?.value))
    );
}

function shouldMarkReportPartial(reportData = [], reportMeta = {}) {
    if (typeof reportMeta?.hasIncompleteRows === "boolean" || typeof reportMeta?.hasMeaningfulRows === "boolean") {
        return Boolean(reportMeta.hasIncompleteRows) || !Boolean(reportMeta.hasMeaningfulRows);
    }

    return hasExactDotOnlyValue(reportData) || !hasMeaningfulReportValue(reportData);
}


const getReportByBookingId = async (req, res) => {
    const { bookingId } = req.params;
    try {
        const report = await Report.findOne({ bookingId });
        if (report) {
            return res.status(200).json(report);
        }
        return res.status(404).json({ message: "Report not found" });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
};


const sanitizeCategoryAndTestData = (categories) => {
    if (!Array.isArray(categories)) return [];
    const result = [];
    const stripHtml = (val) => {
        if (!val) return '';
        return String(val).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
    };

    categories.forEach((cat) => {
        if (!cat) return;
        const catName = String(cat.category || '').trim();
        const titleName = String(cat.title || cat.panelName || '').trim();
        const panelId = cat.panelId ? String(cat.panelId).trim() : null;

        const hasTests = Array.isArray(cat.tests) && cat.tests.length > 0;
        const interpText = stripHtml(cat.interpretation);
        const hasInterp = interpText.length > 0;
        const hasNotes = Boolean(cat.notes || cat.remarks || cat.advice);

        const existing = result.find(c => {
            const cCat = String(c.category || '').trim();
            const cTitle = String(c.title || c.panelName || '').trim();
            const cPanelId = c.panelId ? String(c.panelId).trim() : null;

            if (cCat !== catName) return false;
            if (panelId && cPanelId && panelId === cPanelId) return true;
            return cTitle === titleName;
        });

        if (existing) {
            if (hasTests) {
                existing.tests = (existing.tests || []).concat(cat.tests);
            }
            if (!existing.interpretation && hasInterp) {
                existing.interpretation = cat.interpretation;
            }
            if (!existing.notes && cat.notes) existing.notes = cat.notes;
            if (!existing.remarks && cat.remarks) existing.remarks = cat.remarks;
            if (!existing.advice && cat.advice) existing.advice = cat.advice;
            if (!existing.panelId && panelId) existing.panelId = panelId;
            if (!existing.panelName && cat.panelName) existing.panelName = cat.panelName;
        } else {
            if (hasTests || hasInterp || hasNotes) {
                result.push({ ...cat });
            }
        }
    });

    result.forEach(cat => {
        if (cat.interpretation && Array.isArray(cat.tests)) {
            const interpClean = stripHtml(cat.interpretation);
            if (interpClean.length > 0) {
                cat.tests = cat.tests.filter(t => {
                    if (t && t.details && !t.testName && !t.value) {
                        const dClean = stripHtml(t.details);
                        if (dClean === interpClean || (dClean.length > 20 && (interpClean.includes(dClean) || dClean.includes(interpClean)))) {
                            return false;
                        }
                    }
                    return true;
                });
            }
        }
    });

    return result;
};

const SaveReportController = asyncHandler(async (req, res) => {
    const { reportData, reportMeta, reg_id, booking, registeredOn, collectedOn, receivedOn, reportedOn, categorized,
        moredetails, uniquetestArray, isdocumented, saveMode, bookedItems } = req.body;

    const tenantId = req.user?.tenantId?._id || req.user?.tenantId;

    const resolvedBookingId = String(booking?.bookingId || reg_id || booking?._id || "").trim();

    if (!reportData || !resolvedBookingId || !booking) {
        throw new ApiError(400, "Please try again after sometime, and fill all test values");
    }

    // 1. Resolve booking (tenant-scoped first, with global fallback)
    let existingBooking = null;
    if (tenantId) {
        existingBooking = await newBooking.findOne({
            $or: [
                { bookingId: resolvedBookingId },
                ...(mongoose.Types.ObjectId.isValid(resolvedBookingId) ? [{ _id: resolvedBookingId }] : [])
            ],
            tenantId
        }).select("status isreportready tableData testIds bookingId tenantId");
    }
    if (!existingBooking) {
        existingBooking = await newBooking.findOne({
            $or: [
                { bookingId: resolvedBookingId },
                ...(mongoose.Types.ObjectId.isValid(resolvedBookingId) ? [{ _id: resolvedBookingId }] : [])
            ]
        }).select("status isreportready tableData testIds bookingId tenantId");
    }

    const actualBookingId = String(existingBooking?.bookingId || resolvedBookingId || "").trim();

    // 2. Resolve existing report in reports collection
    let existingReport = null;
    if (tenantId) {
        existingReport = await reports.findOne({
            bookingId: actualBookingId,
            tenantId: tenantId
        });
    }
    if (!existingReport) {
        existingReport = await reports.findOne({
            bookingId: actualBookingId
        });
    }
    if (!existingReport) {
        // Case-insensitive regex fallback for robust matching
        existingReport = await reports.findOne({
            bookingId: { $regex: new RegExp(`^${actualBookingId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
    }
    if (!existingReport && mongoose.Types.ObjectId.isValid(resolvedBookingId)) {
        existingReport = await reports.findOne({
            _id: resolvedBookingId
        });
    }

    const effectiveTenantId = existingBooking?.tenantId || existingReport?.tenantId || tenantId;

    const currentBookingStatus = existingBooking?.status || booking.status || "pending";
    let bookingStatus = currentBookingStatus;
    const sampleDetails = buildUniqueSampleDetails(reportData);

    const sanitizedReportData = sanitizeCategoryAndTestData(reportData);
    const isPartialReport = shouldMarkReportPartial(sanitizedReportData, reportMeta);
    const normalizedCurrentStatus = String(currentBookingStatus || "").toLowerCase();

    /* Booking completion must be sign-off only. Report save flows may persist the
       report data, but they must never advance booking status on their own. */
    bookingStatus = currentBookingStatus;

    if (saveMode === "saveOnly" && normalizedCurrentStatus !== "completed" && isPartialReport) {
        bookingStatus = currentBookingStatus;
    }

    const effectiveRegisteredOn = registeredOn || booking?.registeredOn;
    const effectiveCollectedOn = collectedOn || booking?.collectedOn;
    const effectiveReceivedOn = receivedOn || booking?.receivedOn;
    const effectiveReportedOn = reportedOn || booking?.reportedOn;

    const updateFields = {
        CategoryAndTest: sanitizedReportData,
        reg_id: actualBookingId,
        ...booking,
        bookingId: actualBookingId,
        status: bookingStatus,
        registeredOn: effectiveRegisteredOn,
        collectedOn: effectiveCollectedOn,
        receivedOn: effectiveReceivedOn,
        reportedOn: effectiveReportedOn,
        categorizedPDF: categorized,
        MoreDetails: moredetails,
        uniquetestArray,
        sampleDetails,
        isdocumented,
        completionMeta: {
            hasIncompleteRows: Boolean(reportMeta?.hasIncompleteRows),
            hasMeaningfulRows: Boolean(reportMeta?.hasMeaningfulRows),
        }
    };

    if (registeredOn) {
        updateFields.registeredOn = registeredOn;
    }
    if (booking?.date) {
        updateFields.date = new Date(booking.date);
    }
    if (booking?.time) {
        updateFields.time = booking.time;
    }

    if (bookedItems) {
        updateFields.bookedItems = bookedItems;
    }

    // Strip immutable and internal fields that cause MongoServerError
    delete updateFields._id;
    delete updateFields.__v;
    delete updateFields.createdAt;
    delete updateFields.updatedAt;
    delete updateFields.tableData;

    delete updateFields.tenantId;
    if (effectiveTenantId) {
        updateFields.tenantId = effectiveTenantId;
    }

    if (req.user?._id && !updateFields.createdBy) {
        updateFields.createdBy = req.user._id;
    }

    if (updateFields.total === undefined || updateFields.total === null || isNaN(Number(updateFields.total))) {
        updateFields.total = 0;
    } else {
        updateFields.total = Number(updateFields.total);
    }

    if (updateFields.patientPhone === undefined || updateFields.patientPhone === null) {
        updateFields.patientPhone = "";
    }

    // Always guarantee bookingId and reg_id match actualBookingId
    updateFields.bookingId = actualBookingId;
    updateFields.reg_id = actualBookingId;

    let savedREport = null;

    // Helper for direct update without upsert
    const executeDirectUpdate = async (filter) => {
        return await reports.findOneAndUpdate(
            filter,
            { $set: updateFields },
            { new: true }
        );
    };

    // Helper for upsert by bookingId with automatic duplicate key recovery
    const executeSafeUpsert = async () => {
        try {
            return await reports.findOneAndUpdate(
                { bookingId: actualBookingId },
                { $set: updateFields },
                {
                    upsert: true,
                    new: true
                }
            );
        } catch (upsertErr) {
            // E11000 duplicate key error means a document with actualBookingId already exists in the collection.
            // Immediately resolve it via direct update without crashing!
            if (upsertErr.code === 11000 || (upsertErr.message && upsertErr.message.includes("E11000"))) {
                console.warn(`[SaveReportController] E11000 duplicate key on upsert for ${actualBookingId}. Resolving via direct update...`);
                let recovered = await executeDirectUpdate({ bookingId: actualBookingId });
                if (!recovered) {
                    recovered = await executeDirectUpdate({
                        bookingId: { $regex: new RegExp(`^${actualBookingId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
                    });
                }
                return recovered;
            }
            throw upsertErr;
        }
    };

    if (existingReport?._id) {
        try {
            savedREport = await reports.findByIdAndUpdate(
                existingReport._id,
                { $set: updateFields },
                { new: true }
            );
        } catch (findErr) {
            if (findErr.code === 11000 || (findErr.message && findErr.message.includes("E11000"))) {
                console.warn(`[SaveReportController] E11000 on findByIdAndUpdate for ${actualBookingId}. Falling back to safe upsert...`);
                savedREport = await executeSafeUpsert();
            } else {
                throw findErr;
            }
        }
    } else {
        savedREport = await executeSafeUpsert();
    }

    // Safety fallback: if somehow still null, attempt direct lookup
    if (!savedREport) {
        savedREport = await reports.findOne({ bookingId: actualBookingId });
    }

    if (!savedREport) {
        throw new ApiError(400, "please try again after sometime, report not saved");
    }

    if (saveMode === "final") {
        const customizationIdentity = [{ bookingId: actualBookingId }];
        if (savedREport._id) customizationIdentity.push({ reportId: savedREport._id });
        const customFilter = { $or: customizationIdentity };
        if (effectiveTenantId) {
            customFilter.tenantId = effectiveTenantId;
        }
        await customization.deleteMany(customFilter);
    }

    if (existingBooking) {
        const bookingUpdateFields = {};
        if (bookingStatus !== currentBookingStatus) {
            bookingUpdateFields.status = bookingStatus;
        }
        if (booking?.date) {
            bookingUpdateFields.date = new Date(booking.date);
        }
        if (booking?.time) {
            bookingUpdateFields.time = booking.time;
        }
        if (typeof categorized === "boolean") {
            bookingUpdateFields.categorizedPDF = categorized;
        }
        if (effectiveRegisteredOn) {
            bookingUpdateFields.registeredOn = effectiveRegisteredOn;
        }
        if (effectiveCollectedOn) {
            bookingUpdateFields.collectedOn = effectiveCollectedOn;
        }
        if (effectiveReceivedOn) {
            bookingUpdateFields.receivedOn = effectiveReceivedOn;
        }
        if (effectiveReportedOn) {
            bookingUpdateFields.reportedOn = effectiveReportedOn;
        }

        if (Object.keys(bookingUpdateFields).length > 0) {
            await newBooking.findOneAndUpdate(
                {
                    bookingId: actualBookingId,
                    ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {})
                },
                bookingUpdateFields,
                { new: true }
            );
        }
    }

    // अगर staff का parentUser है तो उसे भी notify करें
    if (req.user?.role === 'staff') {
        console.log("Staff report update activity log");
        await User.findByIdAndUpdate(req.user._id, {
            $push: {
                activities: {
                    activityType: "other",
                    details: {
                        staffId: req.user._id,
                        staffName: req.user.fullName,
                        action: `${req.user.fullName} has updated a report.`,
                        reports: savedREport.bookingId,
                        patientName: savedREport.patientName
                    },
                    reference: {
                        model: "Report",
                        id: savedREport._id
                    },
                    timestamp: new Date()
                }
            }
        });
    }

    const responsePayload = savedREport.toObject();
    responsePayload.bookingStatus = bookingStatus;
    responsePayload.categorizedPDF = savedREport.categorizedPDF;

    return res.status(200).json(responsePayload);
});

const editReportController = asyncHandler(async (req, res) => {
    const { reportData, reg_id, booking, signedBy, collectedOn, receivedOn, reportedOn } = req.body;

    const resolvedBookingId = String(booking?.bookingId || reg_id || booking?._id || "").trim();

    if (!reportData || !resolvedBookingId || !booking || !signedBy) {
        throw new ApiError(400, "please try again after sometime, and fill all test values");
    }

    const updateFields = {
        CategoryAndTest: reportData,
        reg_id: resolvedBookingId,
        ...booking,
        bookingId: resolvedBookingId,
        signedBy,
        collectedOn,
        receivedOn,
        reportedOn,
        sampleDetails: buildUniqueSampleDetails(reportData)
    };

    delete updateFields._id;
    delete updateFields.__v;
    delete updateFields.createdAt;
    delete updateFields.updatedAt;
    delete updateFields.tableData;

    const savedREport = await reports.findOneAndUpdate(
        { bookingId: resolvedBookingId },
        updateFields,
        { new: true }
    );

    if (!savedREport) {
        throw new ApiError(400, "please try again after sometime, report not saved");
    }

    return res.status(200).json(savedREport);
});

const editReportsignofffieldController = asyncHandler(async (req, res) => {
    const { value1, signoff } = req.body;

    if (!value1) {
        console.log("value1 is not recieved for edit report sign off field");
        throw new ApiError(500, "value1 is not recieved for edit report sign off field");
    }

    const signerName = signoff ? (req.user?.fullName || req.user?.username || "Doctor") : null;
    const signedAtTime = signoff ? new Date() : null;

    const reportUpdateFields = {
        signOff: Boolean(signoff),
        isSignedOff: Boolean(signoff),
        signedBy: signerName,
        signedAt: signedAtTime,
        signedById: signoff ? req.user?._id : null,
        signedByRole: signoff ? req.user?.role : null
    };

    let savedREport;
    if (mongoose.Types.ObjectId.isValid(value1)) {
        savedREport = await reports.findOneAndUpdate(
            { _id: value1 },
            reportUpdateFields,
            { new: true }
        );
    } else {
        savedREport = await reports.findOneAndUpdate(
            { bookingId: value1 },
            reportUpdateFields,
            { new: true }
        );
    }

    if (!savedREport) {
        console.log("signoff field not updated");
        throw new ApiError(400, "please try again after sometime, report not saved");
    }

    const bId = savedREport.bookingId || (!mongoose.Types.ObjectId.isValid(value1) ? value1 : null);
    if (bId) {
        try {
            await newBooking.findOneAndUpdate(
                { bookingId: bId },
                {
                    isSignedOff: Boolean(signoff),
                    signedBy: signerName,
                    signedAt: signedAtTime,
                    "signOffAudit.isSignedOff": Boolean(signoff),
                    "signOffAudit.signedBy": signerName,
                    "signOffAudit.signedAt": signedAtTime,
                    "signOffAudit.signedById": signoff ? req.user?._id : null,
                    "signOffAudit.role": signoff ? req.user?.role : null
                }
            );
        } catch (nbErr) {
            console.warn("Failed to update newBooking sign-off status:", nbErr);
        }
    }

    try {
        const tenantId = req.user?.tenantId?._id || req.user?.tenantId;
        const bookingId = savedREport.bookingId || (mongoose.Types.ObjectId.isValid(value1) ? null : value1);
        if (bookingId) {
            await recordButtonActionAudit({
                tenantId,
                bookingId,
                reportId: savedREport._id,
                user: req.user,
                action: "SIGN_OFF",
                buttonId: "signOff",
                buttonLabel: "Sign off",
                details: { signoff }
            });
        }
    } catch (auditErr) {
        console.warn("Auto-audit failed in editReportsignofffieldController:", auditErr);
    }

    return res.status(200).json(savedREport);
})

const getReportController = asyncHandler(async (req, res) => {
    const { value1, bookingId } = req.body;
    const searchKey = String(value1 || bookingId || "").trim();
    if (!searchKey) {
        throw new ApiError(400, "Booking ID or Report ID is required");
    }

    const tenantId = req.user.tenantId?._id || req.user.tenantId;

    // 1. Pehle bookingId ke basis par report dhundho (tenant scoped)
    let Report = null;
    if (tenantId) {
        Report = await reports.findOne({
            bookingId: searchKey,
            tenantId: tenantId
        }).lean();
    }

    // 2. Agar bookingId se report na mile aur searchKey ek valid ObjectId hai to _id se dhundho (tenant scoped)
    if (!Report && tenantId && mongoose.Types.ObjectId.isValid(searchKey)) {
        Report = await reports.findOne({
            _id: searchKey,
            tenantId: tenantId
        }).lean();
    }

    // 2b. If searchKey is a booking ObjectId, resolve bookingId from newBooking
    if (!Report && tenantId && mongoose.Types.ObjectId.isValid(searchKey)) {
        const bDoc = await newBooking.findOne({ _id: searchKey, tenantId }).select("bookingId").lean();
        if (bDoc?.bookingId) {
            Report = await reports.findOne({ bookingId: bDoc.bookingId, tenantId }).lean();
        }
    }

    // 3. Fallback: bookingId ke basis par bina tenantId filter dhundho (for admin, staff, or cross-tenant/sub-franchisee bookings)
    if (!Report) {
        Report = await reports.findOne({
            bookingId: searchKey
        }).lean();
    }

    // 4. Fallback: _id ke basis par bina tenantId filter dhundho
    if (!Report && mongoose.Types.ObjectId.isValid(searchKey)) {
        Report = await reports.findOne({
            _id: searchKey
        }).lean();
    }

    // 4b. Fallback: newBooking ObjectId lookup without tenant filter
    if (!Report && mongoose.Types.ObjectId.isValid(searchKey)) {
        const bDoc = await newBooking.findById(searchKey).select("bookingId").lean();
        if (bDoc?.bookingId) {
            Report = await reports.findOne({ bookingId: bDoc.bookingId }).lean();
        }
    }

    // 5. Fallback: Case-insensitive bookingId match
    if (!Report) {
        Report = await reports.findOne({
            bookingId: { $regex: new RegExp(`^${searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        }).lean();
    }

    // Fallback: If report not found yet, check if newBooking exists to return its categorizedPDF and tableData
    if (!Report) {
        const existingBooking = await newBooking.findOne({
            $or: [
                { bookingId: searchKey },
                ...(mongoose.Types.ObjectId.isValid(searchKey) ? [{ _id: searchKey }] : [])
            ],
            ...(tenantId ? { tenantId } : {})
        }).select("bookingId categorizedPDF tableData testIds registeredOn collectedOn receivedOn reportedOn").lean();

        if (existingBooking) {
            return res.status(200).json({
                bookingId: existingBooking.bookingId,
                categorizedPDF: typeof existingBooking.categorizedPDF === 'boolean' ? existingBooking.categorizedPDF : true,
                isDraft: true,
                bookingTableData: existingBooking.tableData || [],
                printSettings: {},
                registeredOn: existingBooking.registeredOn,
                collectedOn: existingBooking.collectedOn,
                receivedOn: existingBooking.receivedOn,
                reportedOn: existingBooking.reportedOn
            });
        }

        throw new ApiError(400, "Please try again after sometime, report not found");
    }

    const resolvedTenantId = Report.tenantId || tenantId;
    const [user, usertenant, reportCustomization, tenantDefaults, bookingDoc, investigationShortNames] = await Promise.all([
        User.findOne({ _id: req.user._id, tenantId }).select("pdfFormat").lean(),
        Tenant.findById(resolvedTenantId).select("modelType").lean(),
        customization.findOne({ reportId: Report._id, tenantId: resolvedTenantId }).lean(),
        defaultpdfsetting.findOne({ tenantId: resolvedTenantId }).lean(),
        newBooking.findOne({ bookingId: Report.bookingId, ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}) }).select("tableData testIds").lean(),
        resolveInvestigationShortNames({ Report, tenantId: resolvedTenantId }),
    ]);

    const printSettings = {
        ...(reportCustomization || {}),
        ...(tenantDefaults || {}),
    };

    const responsePayload = { ...Report };
    responsePayload.pdfFormat = user?.pdfFormat || "";
    responsePayload.layerOne = usertenant?.modelType || "";
    responsePayload.savedPdfLayout = reportCustomization?.htmlContent || null;
    responsePayload.bookingTableData = bookingDoc?.tableData || [];
    // Include refined investigation short names from DB when bookingDoc wasn't loaded at initial Promise.all
    const resolvedShortNames = (bookingDoc?.tableData?.length > 0)
        ? await resolveInvestigationShortNames({ Report, bookingDoc, tenantId: resolvedTenantId })
        : investigationShortNames;
    responsePayload.investigationShortNames = resolvedShortNames;
    responsePayload.nablLogo = await resolveNablLogoForReport({
        tenantId: resolvedTenantId,
        bookingId: Report.bookingId,
        reportId: Report._id,
        user: req.user
    });

    return res.status(200).json({
        ...responsePayload,
        printSettings,
    });
});
const getReportControlleruser = asyncHandler(async (req, res) => {
    const { value1, bookingId , tenantId} = req.body;
    // console.log( typeof bookingId)
    // console.log(typeof value1)
    // Pehle bookingId ke basis par report dhundho
    let Report = await reports.findOne({
        bookingId: value1,
        tenantId: tenantId
    }).lean();

    // Agar bookingId se report na mile aur value1 ek valid ObjectId hai to _id se dhundho
    if (Report == null && mongoose.Types.ObjectId.isValid(value1)) {
        Report = await reports.findOne({
            _id: value1,
            tenantId: tenantId
        }).lean();
    }

    // Agar Report nahi mili to error throw karo
    if (!Report) {
        throw new ApiError(400, "Please try again after sometime, report not found");
    }

    const [adminUser, fallbackUser, usertenant, reportCustomization, tenantDefaults, userBookingDoc] = await Promise.all([
        User.findOne({ tenantId, role: "admin" }).select("pdfFormat").lean(),
        User.findOne({ tenantId }).select("pdfFormat").lean(),
        Tenant.findById(tenantId).select("modelType").lean(),
        customization.findOne({ reportId: Report._id, tenantId }).lean(),
        defaultpdfsetting.findOne({ tenantId }).lean(),
        newBooking.findOne({ bookingId: Report.bookingId, ...(tenantId ? { tenantId } : {}) }).select("tableData testIds").lean(),
    ]);
    const user = adminUser || fallbackUser;
    const printSettings = {
        ...(reportCustomization || {}),
        ...(tenantDefaults || {}),
    };

    const responsePayload = { ...Report };
    responsePayload.pdfFormat = user?.pdfFormat || "";
    responsePayload.layerOne = usertenant?.modelType || "";
    responsePayload.investigationShortNames = await resolveInvestigationShortNames({
        Report,
        bookingDoc: userBookingDoc,
        tenantId: Report.tenantId || tenantId,
    });
    responsePayload.nablLogo = await resolveNablLogoForReport({ tenantId: Report.tenantId || tenantId, bookingId: Report.bookingId, reportId: Report._id, user: null });

    return res.status(200).json({
        ...responsePayload,
        printSettings,
    });
});

const updateReportCategorizedPdf = asyncHandler(async (req, res) => {
    const { bookingId, value1, categorized } = req.body;
    const searchKey = String(bookingId || value1 || "").trim();
    if (!searchKey) {
        throw new ApiError(400, "Booking ID is required");
    }

    const tenantId = req.user?.tenantId?._id || req.user?.tenantId;
    const isCategorized = Boolean(categorized);

    const bookingFilter = {
        $or: [
            { bookingId: searchKey },
            ...(mongoose.Types.ObjectId.isValid(searchKey) ? [{ _id: searchKey }] : [])
        ],
        ...(tenantId ? { tenantId } : {})
    };

    const bDoc = await newBooking.findOneAndUpdate(
        bookingFilter,
        { categorizedPDF: isCategorized },
        { new: true }
    );

    const actualBookingId = bDoc?.bookingId || searchKey;

    await reports.updateMany(
        {
            $or: [
                { bookingId: actualBookingId },
                { bookingId: searchKey },
                ...(mongoose.Types.ObjectId.isValid(searchKey) ? [{ _id: searchKey }] : [])
            ],
            ...(tenantId ? { tenantId } : {})
        },
        { categorizedPDF: isCategorized }
    );

    return res.status(200).json(new ApiResponse(200, { categorizedPDF: isCategorized }, "Updated successfully"));
});

export {
    SaveReportController,
    getReportController,
    getReportByBookingId,
    editReportController,
    editReportsignofffieldController,
    getReportControlleruser,
    updateReportCategorizedPdf,
    resolveInvestigationShortNames
}
